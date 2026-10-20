import type { Projet } from "../../generated/prisma/index.js";
import type { RequestResponse } from "../../model/index.ts";
import prisma from "../../config/prisma.config.ts";
import { teardownDeployment } from "../../services/deploy.service.ts";

/** Projet sans le champ sensible `configEnv` (variables d'environnement chiffrées). */
export type ProjetPublic = Omit<Projet, "configEnv">;

export const PROJECT_STATES = ["CREE", "EN_COURS", "DEPLOYE", "ERREUR", "ARRETE"] as const;
const NAME_MAX_LENGTH = 100;
const SOURCE_MAX_LENGTH = 500;

const clean = (v: unknown): string => (typeof v === "string" ? v.trim() : "");

/** Source acceptée : URL http(s)/git ou chemin relatif dans `uploads/` (sans `..`). */
const isValidSource = (s: string): boolean => {
    if (!s || s.length > SOURCE_MAX_LENGTH || /[\u0000-\u001f]/.test(s)) return false;
    if (/^(https?|git):\/\/\S+$/i.test(s)) return true;
    return /^uploads\//.test(s) && !s.split("/").includes("..");
};

export interface ProjectList {
    items: (ProjetPublic & { _count: { deploiements: number } })[];
    total: number;
    page: number;
    limit: number;
}

export default class ProjectController {
    static async ajouter(
        idUser: string,
        { nomProjet, sourceProjet }: { nomProjet: unknown; sourceProjet: unknown },
    ): Promise<RequestResponse<ProjetPublic>> {
        const nom = clean(nomProjet);
        const source = clean(sourceProjet);

        if (!nom || nom.length > NAME_MAX_LENGTH) {
            return { success: false, status: 400, message: `Nom de projet requis (${NAME_MAX_LENGTH} caractères maximum).` };
        }
        if (!isValidSource(source)) {
            return {
                success: false,
                status: 400,
                message: "Source invalide : URL http(s)/git ou chemin relatif commençant par « uploads/ ».",
            };
        }

        const duplicate = await prisma.projet.findFirst({ where: { nomProjet: nom, idUtilisateur: idUser } });
        if (duplicate) {
            return { success: false, status: 409, message: "Un projet porte déjà ce nom." };
        }

        // Pour créer un projet depuis GitHub ET le déployer : POST /deploiement/github

        const projet = await prisma.projet.create({
            data: { nomProjet: nom, sourceProjet: source, etatProjet: "CREE", idUtilisateur: idUser },
            omit: { configEnv: true },
        });
        return { success: true, status: 201, message: "Projet créé avec succès", data: projet };
    }

    static async renommer(
        idUser: string,
        idProjet: string,
        nouveauNom: unknown,
    ): Promise<RequestResponse<ProjetPublic>> {
        const nom = clean(nouveauNom);
        if (!nom || nom.length > NAME_MAX_LENGTH) {
            return { success: false, status: 400, message: `Nouveau nom requis (${NAME_MAX_LENGTH} caractères maximum).` };
        }

        const projet = await prisma.projet.findFirst({ where: { idProjet, idUtilisateur: idUser } });
        if (!projet) return { success: false, status: 404, message: "Projet introuvable" };

        const sameName = await prisma.projet.findFirst({
            where: { nomProjet: nom, idUtilisateur: idUser, NOT: { idProjet } },
        });
        if (sameName) return { success: false, status: 409, message: "Un projet porte déjà ce nom." };

        const updated = await prisma.projet.update({ where: { idProjet }, data: { nomProjet: nom }, omit: { configEnv: true } });
        return { success: true, message: "Projet renommé avec succès", data: updated };
    }

    static async supprimer(idUser: string, idProjet: string): Promise<RequestResponse<null>> {
        const projet = await prisma.projet.findFirst({
            where: { idProjet, idUtilisateur: idUser },
            include: { deploiements: { select: { idDeploiement: true } } },
        });
        if (!projet) return { success: false, status: 404, message: "Projet introuvable" };

        const ids = projet.deploiements.map((d) => d.idDeploiement);
        // Arrête la lecture des logs, supprime conteneurs, images et sources temporaires
        await Promise.all(ids.map((id: string) => teardownDeployment(id)));

        // Le schéma n'a pas de cascade : suppression manuelle dans l'ordre des dépendances
        await prisma.$transaction([
            prisma.log.deleteMany({ where: { idDeploiement: { in: ids } } }),
            prisma.alerte.deleteMany({ where: { idDeploiement: { in: ids } } }),
            prisma.deploiement.deleteMany({ where: { idProjet } }),
            prisma.projet.delete({ where: { idProjet } }),
        ]);

        return { success: true, message: "Projet supprimé avec succès" };
    }

    static async lister(
        idUser: string,
        opts: { page: number; limit: number; etat?: string; q?: string },
    ): Promise<RequestResponse<ProjectList>> {
        if (opts.etat && !(PROJECT_STATES as readonly string[]).includes(opts.etat)) {
            return { success: false, status: 400, message: `État invalide (${PROJECT_STATES.join(", ")}).` };
        }

        const where = {
            idUtilisateur: idUser,
            ...(opts.etat ? { etatProjet: opts.etat } : {}),
            ...(opts.q ? { nomProjet: { contains: opts.q, mode: "insensitive" as const } } : {}),
        };

        const [total, items] = await Promise.all([
            prisma.projet.count({ where }),
            prisma.projet.findMany({
                where,
                orderBy: { dateProjet: "desc" },
                skip: (opts.page - 1) * opts.limit,
                take: opts.limit,
                omit: { configEnv: true },
                include: { _count: { select: { deploiements: true } } },
            }),
        ]);

        return { success: true, data: { items, total, page: opts.page, limit: opts.limit } };
    }

    static async prendreParId(idUser: string, idProjet: string): Promise<RequestResponse<ProjetPublic>> {
        const projet = await prisma.projet.findFirst({
            where: { idProjet, idUtilisateur: idUser },
            omit: { configEnv: true },
            include: {
                deploiements: { orderBy: { dateDeploiement: "desc" }, take: 10 },
                _count: { select: { deploiements: true } },
            },
        });
        if (!projet) return { success: false, status: 404, message: "Projet introuvable" };
        return { success: true, data: projet };
    }
}