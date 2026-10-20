// src/services/log.watcher.service.ts
// Lecture en temps réel des logs d'un déploiement -> analyse -> stockage des erreurs.
//
// Deux sources supportées :
//  - "file"   : suivi (tail) d'un fichier de logs par polling (1 s), tolère rotation/troncature
//  - "docker" : `docker logs --follow` du conteneur nommé `<DEPLOY_CONTAINER_PREFIX><idDeploiement>`
import { spawn } from "child_process";
import fs from "fs";
import path from "path";
import { StringDecoder } from "string_decoder";
import { socketManager } from "../config/socket.manager.ts";
import { LogAggregator, type Analysis } from "./log.analyzer.service.ts";
import { ingestErrors, type DeploymentContext } from "./log.ingest.service.ts";

export type WatchSource =
    | { type: "file"; cheminAbsolu: string; depuisDebut?: boolean }
    | { type: "docker"; depuisDebut?: boolean };

export interface WatcherInfo {
    idDeploiement: string;
    idUtilisateur: string;
    projet: string;
    source: "file" | "docker";
    cible: string;
    demarreLe: Date;
    lignesLues: number;
    erreursDetectees: number;
}

interface ActiveWatcher extends WatcherInfo {
    stop: () => void;
}

const POLL_INTERVAL_MS = 1000;
const IDLE_FLUSH_MS = 500; // délai avant de considérer une stack trace comme terminée
const MAX_READ_PER_TICK = 1024 * 1024;
export const MAX_WATCHERS_PER_USER = 10;
const CONTAINER_PREFIX = process.env.DEPLOY_CONTAINER_PREFIX ?? "deploy-";
const STORE_WARNINGS = process.env.LOG_STORE_WARNINGS! === "true";

/** Découpe en lignes, regroupe les stack traces, stocke les erreurs (dans l'ordre). */
const createPipeline = (ctx: DeploymentContext, info: WatcherInfo) => {
    const aggregator = new LogAggregator(STORE_WARNINGS);
    let partial = "";
    let idleTimer: NodeJS.Timeout | undefined;
    let queue: Promise<unknown> = Promise.resolve();

    const emit = (a: Analysis | null) => {
        if (!a) return;
        info.erreursDetectees += 1;
        queue = queue.then(() => ingestErrors(ctx, [a])).catch((e) => console.error("[log.watcher]", e));
    };

    const flushIdle = () => emit(aggregator.flush());

    return {
        onData(chunk: string) {
            partial += chunk;
            const lines = partial.split(/\r?\n/);
            partial = lines.pop() ?? ""; // dernière ligne potentiellement incomplète
            for (const line of lines) {
                info.lignesLues += 1;
                emit(aggregator.push(line));
            }
            clearTimeout(idleTimer);
            if (aggregator.hasPending) idleTimer = setTimeout(flushIdle, IDLE_FLUSH_MS);
        },
        end() {
            clearTimeout(idleTimer);
            if (partial) emit(aggregator.push(partial));
            partial = "";
            flushIdle();
        },
    };
};

const tailFile = (absPath: string, fromStart: boolean, onData: (s: string) => void): (() => void) => {
    const decoder = new StringDecoder("utf8");
    let pos = -1;
    let stopped = false;
    let reading = false;

    const tick = async () => {
        if (stopped || reading) return;
        reading = true;
        try {
            const st = await fs.promises.stat(absPath).catch(() => null);
            if (pos === -1) pos = st && !fromStart ? st.size : 0; // fichier absent au départ => lire dès sa création
            if (!st) return;
            if (st.size < pos) pos = 0; // fichier tronqué / roté
            if (st.size > pos) {
                const len = Math.min(st.size - pos, MAX_READ_PER_TICK);
                const buf = Buffer.alloc(len);
                const fh = await fs.promises.open(absPath, "r");
                try {
                    const { bytesRead } = await fh.read(buf, 0, len, pos);
                    pos += bytesRead;
                    onData(decoder.write(buf.subarray(0, bytesRead)));
                } finally {
                    await fh.close();
                }
            }
        } catch (error) {
            console.error("[log.watcher] lecture fichier:", error);
        } finally {
            reading = false;
        }
    };

    const timer = setInterval(tick, POLL_INTERVAL_MS);
    void tick();
    return () => {
        stopped = true;
        clearInterval(timer);
    };
};

class LogWatcherService {
    private watchers = new Map<string, ActiveWatcher>();

    isWatching(idDeploiement: string): boolean {
        return this.watchers.has(idDeploiement);
    }

    countForUser(idUtilisateur: string): number {
        return this.list(idUtilisateur).length;
    }

    list(idUtilisateur: string): WatcherInfo[] {
        return [...this.watchers.values()]
            .filter((w) => w.idUtilisateur === idUtilisateur)
            .map(({ stop, ...info }) => info);
    }

    start(ctx: DeploymentContext, source: WatchSource): WatcherInfo {
        const existing = this.watchers.get(ctx.idDeploiement);
        if (existing) {
            const { stop, ...info } = existing;
            return info;
        }

        const info: WatcherInfo = {
            idDeploiement: ctx.idDeploiement,
            idUtilisateur: ctx.idUtilisateur,
            projet: ctx.nomProjet,
            source: source.type,
            cible: source.type === "file" ? path.relative(process.cwd(), source.cheminAbsolu) : `${CONTAINER_PREFIX}${ctx.idDeploiement}`,
            demarreLe: new Date(),
            lignesLues: 0,
            erreursDetectees: 0,
        };

        let stop: () => void;

        if (source.type === "file") {
            const pipeline = createPipeline(ctx, info);
            const stopTail = tailFile(source.cheminAbsolu, source.depuisDebut ?? false, pipeline.onData);
            stop = () => {
                stopTail();
                pipeline.end();
            };
        } else {
            // Pas de shell : arguments passés en tableau, nom de conteneur dérivé d'un UUID => pas d'injection,
            // et un utilisateur ne peut lire que le conteneur de SON déploiement.
            const child = spawn(
                "docker",
                ["logs", "--follow", "--tail", source.depuisDebut ? "all" : "0", info.cible],
                { stdio: ["ignore", "pipe", "pipe"] },
            );
            const out = createPipeline(ctx, info);
            const err = createPipeline(ctx, info);
            child.stdout.setEncoding("utf8").on("data", out.onData);
            child.stderr.setEncoding("utf8").on("data", err.onData);
            child.on("error", (e) => console.error(`[log.watcher] docker (${info.cible}):`, e.message));
            child.on("close", (code) => {
                out.end();
                err.end();
                if (this.watchers.delete(ctx.idDeploiement)) {
                    socketManager.emitToUser(ctx.idUtilisateur, "log:watch-stopped", {
                        idDeploiement: ctx.idDeploiement,
                        code,
                    });
                }
            });
            stop = () => child.kill("SIGTERM");
        }

        // `info` est partagé avec les pipelines : ses compteurs restent à jour dans list().
        const active: ActiveWatcher = Object.assign(info, { stop });
        this.watchers.set(ctx.idDeploiement, active);
        const { stop: _stop, ...snapshot } = active;
        return snapshot;
    }

    stop(idDeploiement: string): boolean {
        const w = this.watchers.get(idDeploiement);
        if (!w) return false;
        this.watchers.delete(idDeploiement);
        w.stop();
        return true;
    }

    stopMany(ids: string[]): void {
        ids.forEach((id) => this.stop(id));
    }

    stopAll(): void {
        [...this.watchers.keys()].forEach((id) => this.stop(id));
    }
}

export const logWatcher = new LogWatcherService();