import path from "path";
import type { Log } from "../../generated/prisma/index.js";
import type { RequestResponse } from "../../model/index.ts";
import prisma from "../../config/prisma.config.ts";
import { analyzeLines, CATEGORIES_CRITIQUES } from "../../services/log.analyzer.service.ts";
import { ingestErrors, type DeploymentContext } from "../../services/log.ingest.service.ts";
import {
    logWatcher,
    MAX_WATCHERS_PER_USER,
    type WatcherInfo,
} from "../../services/log.watcher.service.ts"
import { UPLOADS_ROOT } from "../../utils/Storage/storage.utils.ts";

const MAX_LINES_PER_REQUEST = 500;
const MAX_LINE_LENGTH = 8000;
const STORE_WARNINGS = process.env.LOG_STORE_WARNINGS === "true";

export interface LogFilters {
    page: number;
    limit: number;
    categorie?: string;
    q?: string;
    depuis?: Date;
    jusqua?: Date;
}

export interface Evaluation {
    idDeploiement: string;
    fenetreMinutes: number;
    etat: "SAIN" | "DEGRADE" | "CRITIQUE";
    totalErreurs: number;
    erreursFenetre: number;
    parCategorie: { categorie: string; total: number }[];
    derniereErreur: Log | null;
    alertesOuvertes: number;
    surveillanceActive: boolean;
}

const NOT_FOUND_DEPLOY = { success: false as const, status: 404, message: "Déploiement introuvable" };

/** Déploiement appartenant à l'utilisateur (via son projet). */
const findOwnedDeployment = async (
    idUser: string,
    idDeploiement: string,
): Promise<DeploymentContext | null> => {
    const d = await prisma.deploiement.findFirst({
        where: { idDeploiement, projet: { idUtilisateur: idUser } },
        select: { idDeploiement: true, projet: { select: { nomProjet: true } } },
    });
    return d ? { idDeploiement: d.idDeploiement, idUtilisateur: idUser, nomProjet: d.projet.nomProjet } : null;
};

export default class LogsController {
    /**
     * Ajoute des logs à un déploiement. Deux modes :
     *  - `lignes` : lignes brutes -> analysées, seules les erreurs sont stockées (ingestion depuis un agent/conteneur)
     *  - `objetLog` + `detailLog` : entrée créée telle quelle (ajout manuel)
     */
    static async ajouter(
        idUser: string,
        idDeploiement: string,
        body: { lignes?: unknown; objetLog?: unknown; detailLog?: unknown },
    ): Promise<RequestResponse<{ recues: number; stockees: number; logs: Log[] }>> {
        const ctx = await findOwnedDeployment(idUser, idDeploiement);
        if (!ctx) return NOT_FOUND_DEPLOY;

        if (Array.isArray(body?.lignes)) {
            const lignes = body.lignes;
            if (lignes.length === 0 || lignes.length > MAX_LINES_PER_REQUEST) {
                return { success: false, status: 400, message: `Fournissez 1 à ${MAX_LINES_PER_REQUEST} lignes.` };
            }
            if (lignes.some((l) => typeof l !== "string" || l.length > MAX_LINE_LENGTH)) {
                return { success: false, status: 400, message: `Chaque ligne doit être une chaîne (${MAX_LINE_LENGTH} caractères max).` };
            }
            const erreurs = analyzeLines(lignes as string[], STORE_WARNINGS);
            const logs = await ingestErrors(ctx, erreurs);
            return {
                success: true,
                status: 201,
                message: `${logs.length} erreur(s) stockée(s) sur ${lignes.length} ligne(s) analysée(s).`,
                data: { recues: lignes.length, stockees: logs.length, logs },
            };
        }

        const objet = typeof body?.objetLog === "string" ? body.objetLog.trim() : "";
        const detail = typeof body?.detailLog === "string" ? body.detailLog.trim() : "";
        if (!objet || !detail || objet.length > 100 || detail.length > 4000) {
            return {
                success: false,
                status: 400,
                message: "Fournissez `lignes` (tableau) ou `objetLog` (≤100) + `detailLog` (≤4000).",
            };
        }
        const log = await prisma.log.create({ data: { objetLog: objet, detailLog: detail, idDeploiement } });
        return { success: true, status: 201, message: "Log ajouté", data: { recues: 1, stockees: 1, logs: [log] } };
    }

    static async supprimer(idUser: string, idLog: string): Promise<RequestResponse<Log>> {
        const log = await prisma.log.findFirst({
            where: { idLog, deploiement: { projet: { idUtilisateur: idUser } } },
        });
        if (!log) return { success: false, status: 404, message: "Log introuvable" };

        const deleted = await prisma.log.delete({ where: { idLog } });
        return { success: true, data: deleted, message: "Log supprimé avec succès" };
    }

    /** Supprime les logs d'un déploiement (optionnellement ceux antérieurs à `avant`). */
    static async purger(
        idUser: string,
        idDeploiement: string,
        avant?: Date,
    ): Promise<RequestResponse<{ supprimes: number }>> {
        const ctx = await findOwnedDeployment(idUser, idDeploiement);
        if (!ctx) return NOT_FOUND_DEPLOY;

        const { count } = await prisma.log.deleteMany({
            where: { idDeploiement, ...(avant ? { dateLog: { lt: avant } } : {}) },
        });
        return { success: true, message: `${count} log(s) supprimé(s)`, data: { supprimes: count } };
    }

    static async lister(
        idUser: string,
        idDeploiement: string,
        f: LogFilters,
    ): Promise<RequestResponse<{ items: Log[]; total: number; page: number; limit: number }>> {
        const ctx = await findOwnedDeployment(idUser, idDeploiement);
        if (!ctx) return NOT_FOUND_DEPLOY;

        const where = {
            idDeploiement,
            ...(f.categorie ? { objetLog: f.categorie } : {}),
            ...(f.q ? { detailLog: { contains: f.q, mode: "insensitive" as const } } : {}),
            ...(f.depuis || f.jusqua
                ? { dateLog: { ...(f.depuis ? { gte: f.depuis } : {}), ...(f.jusqua ? { lte: f.jusqua } : {}) } }
                : {}),
        };

        const [total, items] = await Promise.all([
            prisma.log.count({ where }),
            prisma.log.findMany({
                where,
                orderBy: { dateLog: "desc" },
                skip: (f.page - 1) * f.limit,
                take: f.limit,
            }),
        ]);
        return { success: true, data: { items, total, page: f.page, limit: f.limit } };
    }

    /** Évalue la santé d'un déploiement à partir des erreurs récentes. */
    static async evaluer(
        idUser: string,
        idDeploiement: string,
        fenetreMinutes = 15,
    ): Promise<RequestResponse<Evaluation>> {
        const ctx = await findOwnedDeployment(idUser, idDeploiement);
        if (!ctx) return NOT_FOUND_DEPLOY;

        const depuis = new Date(Date.now() - fenetreMinutes * 60_000);
        const [totalErreurs, erreursFenetre, groupes, derniereErreur, alertesOuvertes] = await Promise.all([
            prisma.log.count({ where: { idDeploiement } }),
            prisma.log.count({ where: { idDeploiement, dateLog: { gte: depuis } } }),
            prisma.log.groupBy({
                by: ["objetLog"],
                where: { idDeploiement, dateLog: { gte: depuis } },
                _count: { _all: true },
                orderBy: { _count: { objetLog: "desc" } },
            }),
            prisma.log.findFirst({ where: { idDeploiement }, orderBy: { dateLog: "desc" } }),
            prisma.alerte.count({ where: { idDeploiement, alerteResolu: false } }),
        ]);

        const parCategorie = groupes.map((g:any) => ({ categorie: g.objetLog, total: g._count._all }));
        const critique = parCategorie.some((c:any) => CATEGORIES_CRITIQUES.has(c.categorie));
        const etat: Evaluation["etat"] =
            erreursFenetre === 0 ? "SAIN" : critique || erreursFenetre >= 10 ? "CRITIQUE" : "DEGRADE";

        return {
            success: true,
            data: {
                idDeploiement,
                fenetreMinutes,
                etat,
                totalErreurs,
                erreursFenetre,
                parCategorie,
                derniereErreur,
                alertesOuvertes,
                surveillanceActive: logWatcher.isWatching(idDeploiement),
            },
        };
    }

    // ───────── Surveillance temps réel ─────────

    static async demarrerSurveillance(
        idUser: string,
        userType: string,
        idDeploiement: string,
        body: { type?: unknown; chemin?: unknown; depuisDebut?: unknown },
    ): Promise<RequestResponse<WatcherInfo>> {
        const ctx = await findOwnedDeployment(idUser, idDeploiement);
        if (!ctx) return NOT_FOUND_DEPLOY;

        if (logWatcher.isWatching(idDeploiement)) {
            return { success: false, status: 409, message: "Ce déploiement est déjà surveillé." };
        }
        if (logWatcher.countForUser(idUser) >= MAX_WATCHERS_PER_USER) {
            return { success: false, status: 429, message: `Maximum ${MAX_WATCHERS_PER_USER} surveillances simultanées.` };
        }

        const depuisDebut = body?.depuisDebut === true;

        if (body?.type === "docker") {
            const info = logWatcher.start(ctx, { type: "docker", depuisDebut });
            return { success: true, status: 201, message: "Surveillance démarrée", data: info };
        }

        if (body?.type === "file") {
            const chemin = typeof body.chemin === "string" ? body.chemin.trim() : "";
            if (!chemin) return { success: false, status: 400, message: "`chemin` requis pour une source fichier." };

            // Le fichier doit se trouver dans uploads/<idUser>/ (un ADMIN : n'importe où dans uploads/)
            const root = userType === "ADMIN" ? UPLOADS_ROOT : path.join(UPLOADS_ROOT, idUser);
            const absolu = path.resolve(root, chemin);
            if (!absolu.startsWith(root + path.sep)) {
                return { success: false, status: 403, message: "Chemin en dehors de votre espace de stockage." };
            }
            const info = logWatcher.start(ctx, { type: "file", cheminAbsolu: absolu, depuisDebut });
            return { success: true, status: 201, message: "Surveillance démarrée", data: info };
        }

        return { success: false, status: 400, message: "`type` doit valoir « file » ou « docker »." };
    }

    static async arreterSurveillance(idUser: string, idDeploiement: string): Promise<RequestResponse<null>> {
        const ctx = await findOwnedDeployment(idUser, idDeploiement);
        if (!ctx) return NOT_FOUND_DEPLOY;
        if (!logWatcher.stop(idDeploiement)) {
            return { success: false, status: 404, message: "Aucune surveillance active pour ce déploiement." };
        }
        return { success: true, message: "Surveillance arrêtée" };
    }

    static listerSurveillances(idUser: string): RequestResponse<WatcherInfo[]> {
        return { success: true, data: logWatcher.list(idUser) };
    }
}