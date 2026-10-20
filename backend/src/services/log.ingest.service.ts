// src/services/log.ingest.service.ts
// Stocke les erreurs identifiées, crée les alertes et pousse l'événement en temps réel.
import type { Log } from "../generated/prisma/index.js";
import prisma from "../config/prisma.config.ts";
import { socketManager } from "../config/socket.manager.ts";
import type { Analysis } from "./log.analyzer.service.ts";

export interface DeploymentContext {
    idDeploiement: string;
    idUtilisateur: string;
    nomProjet: string;
}

const DEDUPE_WINDOW_MS = 5_000; // même erreur < 5 s : ignorée (boucle d'erreurs)
const ALERT_WINDOW_MS = 60_000; // fenêtre de comptage pour les alertes
const ALERT_THRESHOLD = 5; // >= 5 erreurs de même catégorie dans la fenêtre => alerte

const lastSeen = new Map<string, number>(); // dep|fingerprint -> timestamp
const windows = new Map<string, number[]>(); // dep|categorie -> timestamps

const prune = () => {
    if (lastSeen.size < 5000 && windows.size < 5000) return;
    const now = Date.now();
    for (const [k, t] of lastSeen) if (now - t > DEDUPE_WINDOW_MS) lastSeen.delete(k);
    for (const [k, ts] of windows) if (!ts.some((t) => now - t <= ALERT_WINDOW_MS)) windows.delete(k);
};

// Un seul nettoyage périodique pour tout le processus (il était recréé à chaque appel de ingestErrors)
setInterval(prune, 60_000).unref();

const priorite = (s: Analysis["severite"]) =>
    s === "critique" ? "CRITIQUE" : s === "haute" ? "HAUTE" : "MOYENNE";

const maybeCreateAlert = async (ctx: DeploymentContext, a: Analysis): Promise<void> => {
    const now = Date.now();
    const key = `${ctx.idDeploiement}|${a.categorie}`;
    const recent = [...(windows.get(key) ?? []).filter((t) => now - t <= ALERT_WINDOW_MS), now];
    windows.set(key, recent);

    if (a.severite !== "critique" && recent.length < ALERT_THRESHOLD) return;

    const titreAlerte = `${a.categorie} sur ${ctx.nomProjet}`;
    const existing = await prisma.alerte.findFirst({
        where: { idDeploiement: ctx.idDeploiement, titreAlerte, alerteResolu: false },
        select: { idAlerte: true },
    });
    if (existing) return; // une alerte ouverte existe déjà

    const alerte = await prisma.alerte.create({
        data: {
            titreAlerte,
            dateAlerte: new Date().toISOString(),
            prioriteAlerte: priorite(a.severite),
            validationAlerte: false,
            alerteResolu: false,
            idDeploiement: ctx.idDeploiement,
        },
    });
    socketManager.emitToUser(ctx.idUtilisateur, "alerte:new", alerte);
};

/** Stocke une liste d'erreurs identifiées. Ne lève jamais : un échec DB ne doit pas casser le flux de logs. */
export const ingestErrors = async (ctx: DeploymentContext, entries: Analysis[]): Promise<Log[]> => {
    const stored: Log[] = [];
    const now = Date.now();

    for (const a of entries) {
        try {
            const fpKey = `${ctx.idDeploiement}|${a.fingerprint}`;
            const previous = lastSeen.get(fpKey);
            lastSeen.set(fpKey, now);
            if (previous && now - previous < DEDUPE_WINDOW_MS) continue;

            const log = await prisma.log.create({
                data: {
                    objetLog: a.categorie,
                    detailLog: `[${a.niveau.toUpperCase()}] ${a.detail}`,
                    idDeploiement: ctx.idDeploiement,
                },
            });
            stored.push(log);

            socketManager.emitToUser(ctx.idUtilisateur, "log:error", {
                idLog: log.idLog,
                idDeploiement: ctx.idDeploiement,
                projet: ctx.nomProjet,
                categorie: a.categorie,
                severite: a.severite,
                niveau: a.niveau,
                message: a.message,
                dateLog: log.dateLog,
            });

            await maybeCreateAlert(ctx, a);
        } catch (error) {
            console.error("[log.ingest] échec de stockage:", error);
        }
    }
    return stored;
};