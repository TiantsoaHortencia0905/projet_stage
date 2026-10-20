// src/services/database.provisioner.service.ts
// Chaque base de données = un conteneur Docker dédié (image officielle), piloté avec la librairie `dockerode`.
// Prérequis : `npm i dockerode && npm i -D @types/dockerode`, et un accès au socket Docker.
import Docker from "dockerode";
import { PassThrough } from "stream";
import prisma from "../config/prisma.config.ts";
import { socketManager } from "../config/socket.manager.ts";
import { isPortFree } from "./docker.service.ts";

export const docker = new Docker(
    process.env.DOCKER_SOCKET_PATH
        ? { socketPath: process.env.DOCKER_SOCKET_PATH }
        : undefined,
);

const PREFIX = process.env.DB_CONTAINER_PREFIX ?? "db-";
const PORT_MIN = Number(process.env.DB_PORT_MIN ?? 30000);
const PORT_MAX = Number(process.env.DB_PORT_MAX ?? 39999);
const BIND = process.env.DB_BIND_ADDRESS ?? "0.0.0.0";
const CPUS = Number(process.env.DB_CPUS ?? 0.5);

export const containerName = (idBD: string) => `${PREFIX}${idBD}`;
export const volumeName = (idBD: string) => `${PREFIX}data-${idBD}`;

// ───────── Catalogue des moteurs ─────────

export interface Credentials {
    user: string;
    password: string;
    adminPassword?: string; // root MySQL / MariaDB
    database: string | null;
}

interface ReadyCheck {
    cmd: string[];
    env?: string[];
    expect?: string; // texte attendu dans la sortie
}

export interface DbTypeSpec {
    type: string;
    label: string;
    image: string;
    versions: string[]; // liste blanche : aucune image arbitraire
    defaultVersion: string;
    internalPort: number;
    dataPath: string;
    memoryMb: number;
    hasDatabaseName: boolean;
    separateAdminPassword: boolean;
    env(c: Credentials): string[];
    cmd?(c: Credentials): string[];
    readyCheck(c: Credentials): ReadyCheck;
    /** Au 1er démarrage, attendre ce message (fin de l'initialisation) avant de tester la connexion. */
    readyLogOnCreate?: RegExp;
    resetMode: "exec" | "recreate";
    resetCommand?(
        c: Credentials,
        oldPassword: string,
        newPassword: string,
    ): ReadyCheck;
    url(c: Credentials, host: string, port: number): string;
}

const enc = encodeURIComponent;

export const DB_TYPES: Record<string, DbTypeSpec> = {
    postgresql: {
        type: "postgresql",
        label: "PostgreSQL",
        image: "postgres",
        versions: ["17-alpine", "16-alpine", "15-alpine", "14-alpine"],
        defaultVersion: "16-alpine",
        internalPort: 5432,
        dataPath: "/var/lib/postgresql/data",
        memoryMb: 512,
        hasDatabaseName: true,
        separateAdminPassword: false,
        env: (c) => [
            `POSTGRES_USER=${c.user}`,
            `POSTGRES_PASSWORD=${c.password}`,
            `POSTGRES_DB=${c.database}`,
        ],
        readyCheck: (c) => ({
            cmd: [
                "pg_isready",
                "-h",
                "127.0.0.1",
                "-U",
                c.user,
                "-d",
                c.database!,
            ],
        }),
        resetMode: "exec",
        resetCommand: (c, _old, pwd) => ({
            cmd: [
                "psql",
                "-U",
                c.user,
                "-d",
                c.database!,
                "-v",
                "ON_ERROR_STOP=1",
                "-c",
                `ALTER USER "${c.user}" WITH PASSWORD '${pwd}'`,
            ],
        }),
        url: (c, h, p) =>
            `postgresql://${c.user}:${enc(c.password)}@${h}:${p}/${c.database}`,
    },
    mysql: {
        type: "mysql",
        label: "MySQL",
        image: "mysql",
        versions: ["8.4", "8.0"],
        defaultVersion: "8.4",
        internalPort: 3306,
        dataPath: "/var/lib/mysql",
        memoryMb: 768,
        hasDatabaseName: true,
        separateAdminPassword: true,
        env: (c) => [
            `MYSQL_ROOT_PASSWORD=${c.adminPassword}`,
            `MYSQL_DATABASE=${c.database}`,
            `MYSQL_USER=${c.user}`,
            `MYSQL_PASSWORD=${c.password}`,
        ],
        readyCheck: (c) => ({
            cmd: ["mysqladmin", "ping", "-h", "127.0.0.1", "-uroot"],
            env: [`MYSQL_PWD=${c.adminPassword}`],
            expect: "alive",
        }),
        resetMode: "exec",
        resetCommand: (c, _old, pwd) => ({
            cmd: [
                "mysql",
                "-h",
                "127.0.0.1",
                "-uroot",
                "-e",
                `ALTER USER '${c.user}'@'%' IDENTIFIED BY '${pwd}'`,
            ],
            env: [`MYSQL_PWD=${c.adminPassword}`],
        }),
        url: (c, h, p) =>
            `mysql://${c.user}:${enc(c.password)}@${h}:${p}/${c.database}`,
    },
    mariadb: {
        type: "mariadb",
        label: "MariaDB",
        image: "mariadb",
        versions: ["11.4", "10.11"],
        defaultVersion: "11.4",
        internalPort: 3306,
        dataPath: "/var/lib/mysql",
        memoryMb: 512,
        hasDatabaseName: true,
        separateAdminPassword: true,
        env: (c) => [
            `MARIADB_ROOT_PASSWORD=${c.adminPassword}`,
            `MARIADB_DATABASE=${c.database}`,
            `MARIADB_USER=${c.user}`,
            `MARIADB_PASSWORD=${c.password}`,
        ],
        readyCheck: (c) => ({
            cmd: ["mariadb-admin", "ping", "-h", "127.0.0.1", "-uroot"],
            env: [`MYSQL_PWD=${c.adminPassword}`],
            expect: "alive",
        }),
        resetMode: "exec",
        resetCommand: (c, _old, pwd) => ({
            cmd: [
                "mariadb",
                "-h",
                "127.0.0.1",
                "-uroot",
                "-e",
                `ALTER USER '${c.user}'@'%' IDENTIFIED BY '${pwd}'`,
            ],
            env: [`MYSQL_PWD=${c.adminPassword}`],
        }),
        url: (c, h, p) =>
            `mysql://${c.user}:${enc(c.password)}@${h}:${p}/${c.database}`,
    },
    mongodb: {
        type: "mongodb",
        label: "MongoDB",
        image: "mongo",
        versions: ["8.0", "7.0", "6.0"],
        defaultVersion: "7.0",
        internalPort: 27017,
        dataPath: "/data/db",
        memoryMb: 768,
        hasDatabaseName: true,
        separateAdminPassword: false,
        env: (c) => [
            `MONGO_INITDB_ROOT_USERNAME=${c.user}`,
            `MONGO_INITDB_ROOT_PASSWORD=${c.password}`,
            `MONGO_INITDB_DATABASE=${c.database}`,
        ],
        readyLogOnCreate: /init process complete; ready for start up/i,
        readyCheck: () => ({
            cmd: ["mongosh", "--quiet", "--eval", "db.adminCommand('ping').ok"],
            expect: "1",
        }),
        resetMode: "exec",
        resetCommand: (c, oldPwd, pwd) => ({
            cmd: [
                "mongosh",
                "--quiet",
                "-u",
                c.user,
                "-p",
                oldPwd,
                "--authenticationDatabase",
                "admin",
                "admin",
                "--eval",
                `db.changeUserPassword("${c.user}","${pwd}")`,
            ],
        }),
        url: (c, h, p) =>
            `mongodb://${c.user}:${
                enc(c.password)
            }@${h}:${p}/${c.database}?authSource=admin`,
    },
    redis: {
        type: "redis",
        label: "Redis",
        image: "redis",
        versions: ["7-alpine", "6-alpine"],
        defaultVersion: "7-alpine",
        internalPort: 6379,
        dataPath: "/data",
        memoryMb: 256,
        hasDatabaseName: false,
        separateAdminPassword: false,
        env: () => [],
        cmd: (c) => [
            "redis-server",
            "--requirepass",
            c.password,
            "--appendonly",
            "yes",
        ],
        readyCheck: (c) => ({
            cmd: ["redis-cli", "ping"],
            env: [`REDISCLI_AUTH=${c.password}`],
            expect: "PONG",
        }),
        resetMode: "recreate", // requirepass est fixé par la ligne de commande : on recrée le conteneur (volume conservé)
        url: (c, h, p) => `redis://:${enc(c.password)}@${h}:${p}`,
    },
};

export const getSpec = (type: string): DbTypeSpec | undefined => DB_TYPES[type];

// ───────── Utilitaires Docker ─────────

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const isStatus = (e: unknown, ...codes: number[]) =>
    codes.includes((e as { statusCode?: number })?.statusCode ?? -1);

export const isDockerAvailable = async (): Promise<boolean> => {
    try {
        await docker.ping();
        return true;
    } catch {
        return false;
    }
};

const demux = (buf: Buffer): string => {
    let out = "";
    let i = 0;
    while (i + 8 <= buf.length) {
        const size = buf.readUInt32BE(i + 4);
        out += buf.subarray(i + 8, i + 8 + size).toString("utf8");
        i += 8 + size;
    }
    return out || buf.toString("utf8");
};

const tailLogs = async (name: string, lines = 200): Promise<string> => {
    try {
        return demux(
            (await docker.getContainer(name).logs({
                stdout: true,
                stderr: true,
                tail: lines,
                follow: false,
            })) as Buffer,
        );
    } catch {
        return "";
    }
};

const execIn = async (
    name: string,
    cmd: string[],
    env?: string[],
    timeoutMs = 15_000,
): Promise<{ exitCode: number; output: string }> => {
    const exec = await docker.getContainer(name).exec({
        Cmd: cmd,
        Env: env,
        AttachStdout: true,
        AttachStderr: true,
    });
    const stream = await exec.start({ hijack: true, stdin: false });
    let output = "";
    await Promise.race([
        new Promise<void>((resolve, reject) => {
            const out = new PassThrough();
            const err = new PassThrough();
            out.on("data", (d) => (output += d.toString()));
            err.on("data", (d) => (output += d.toString()));
            docker.modem.demuxStream(stream, out, err);
            stream.on("end", resolve);
            stream.on("error", reject);
        }),
        sleep(timeoutMs).then(() => {
            throw new Error("Délai dépassé pour la commande exec");
        }),
    ]);
    const info = await exec.inspect();
    return { exitCode: info.ExitCode ?? 1, output };
};

const imageRef = (spec: DbTypeSpec, version: string) =>
    `${spec.image}:${version}`;

const ensureImage = async (
    ref: string,
    onProgress: (status: string) => void,
): Promise<void> => {
    try {
        await docker.getImage(ref).inspect();
        return; // déjà présente
    } catch (e) {
        if (!isStatus(e, 404)) throw e;
    }
    const stream = await docker.pull(ref);
    await Promise.race([
        new Promise<void>((resolve, reject) =>
            docker.modem.followProgress(
                stream,
                (err: Error | null) => (err ? reject(err) : resolve()),
                (evt: { status?: string; progress?: string }) =>
                    evt.status &&
                    onProgress(`${evt.status} ${evt.progress ?? ""}`.trim()),
            ),
        ),
        sleep(Number(process.env.DB_PULL_TIMEOUT_MS ?? 10 * 60_000)).then(
            () => {
                throw new Error(
                    `Téléchargement de l'image ${ref} trop long (délai dépassé).`,
                );
            },
        ),
    ]);
};

const createContainer = async (
    p: {
        idBD: string;
        idUtilisateur: string;
        spec: DbTypeSpec;
        version: string;
        creds: Credentials;
        portHote: number;
    },
) => {
    const memory = p.spec.memoryMb * 1024 * 1024;
    const port = `${p.spec.internalPort}/tcp`;
    return docker.createContainer({
        name: containerName(p.idBD),
        Image: imageRef(p.spec, p.version),
        Env: p.spec.env(p.creds),
        Cmd: p.spec.cmd?.(p.creds),
        Labels: {
            "archicloud.database": p.idBD,
            "archicloud.user": p.idUtilisateur,
            "archicloud.type": p.spec.type,
        },
        ExposedPorts: { [port]: {} },
        HostConfig: {
            PortBindings: {
                [port]: [{ HostIp: BIND, HostPort: String(p.portHote) }],
            },
            Mounts: [
                {
                    Type: "volume",
                    Source: volumeName(p.idBD),
                    Target: p.spec.dataPath,
                },
            ],
            Memory: memory,
            MemorySwap: memory,
            NanoCpus: Math.round(CPUS * 1e9),
            PidsLimit: 1024,
            RestartPolicy: { Name: "unless-stopped" },
            SecurityOpt: ["no-new-privileges"],
            LogConfig: {
                Type: "json-file",
                Config: { "max-size": "10m", "max-file": "3" },
            },
        },
    });
};

export interface ReadyResult {
    ok: boolean;
    reason?: string;
}

export const waitReady = async (
    idBD: string,
    spec: DbTypeSpec,
    creds: Credentials,
    firstStart: boolean,
    timeoutMs = 120_000,
): Promise<ReadyResult> => {
    const name = containerName(idBD);
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
        try {
            const st = (await docker.getContainer(name).inspect()).State;
            if (!st.Running || st.Restarting) {
                const logs = (await tailLogs(name, 15))
                    .split(creds.password)
                    .join("***");
                return {
                    ok: false,
                    reason:
                        `Le conteneur s'est arrêté (code ${st.ExitCode}).\n${logs}`
                            .trim(),
                };
            }
            const logsOk =
                !(firstStart && spec.readyLogOnCreate) ||
                spec.readyLogOnCreate.test(await tailLogs(name, 300));
            if (logsOk) {
                const chk = spec.readyCheck(creds);
                const r = await execIn(name, chk.cmd, chk.env).catch(
                    () => null,
                );
                if (
                    r &&
                    r.exitCode === 0 &&
                    (!chk.expect || r.output.includes(chk.expect))
                )
                    return { ok: true };
            }
        } catch {
            /* conteneur pas encore prêt : on réessaie */
        }
        await sleep(2000);
    }
    return {
        ok: false,
        reason: "Délai dépassé : la base n'a pas répondu à temps.",
    };
};

// ───────── État & notifications ─────────

export interface DbRef {
    idBD: string;
    idUtilisateur: string;
}

export const setEtat = async (
    ref: DbRef,
    etat: "CREATION" | "EN_LIGNE" | "ARRETE" | "ERREUR",
    message: string | null = null,
    extra: Record<string, unknown> = {},
) => {
    await prisma.baseDeDonnees.update({
        where: { idBD: ref.idBD },
        data: { etatBD: etat, messageEtat: message, ...extra },
    });
    socketManager.emitToUser(ref.idUtilisateur, "database:etat", {
        idBD: ref.idBD,
        etat,
        message,
    });
};

// ───────── Port ─────────

/** Réserve un port hôte (colonne unique => aucun doublon même en cas de créations simultanées). */
export const reservePort = async (idBD: string): Promise<number> => {
    for (let i = 0; i < 60; i++) {
        const port =
            PORT_MIN +
            Math.floor(Math.random() * (PORT_MAX - PORT_MIN + 1));
        if (!(await isPortFree(port))) continue;
        try {
            await prisma.baseDeDonnees.update({
                where: { idBD },
                data: { portHote: port },
            });
            return port;
        } catch (error: any) {
            if (error?.code === "P2002") continue;
            throw error;
        }
    }
    throw new Error("Aucun port disponible.");
};

// ───────── Création (arrière-plan) ─────────

export interface ProvisionJob extends DbRef {
    spec: DbTypeSpec;
    version: string;
    creds: Credentials;
    portHote: number;
}

const limiter = (() => {
    const max = Number(process.env.DB_MAX_CONCURRENT_PROVISIONS ?? 2);
    let active = 0;
    const queue: (() => void)[] = [];
    return async <T>(fn: () => Promise<T>): Promise<T> => {
        if (active >= max) await new Promise<void>((r) => queue.push(r));
        else active++;
        try {
            return await fn();
        } finally {
            const next = queue.shift();
            if (next) next();
            else active--;
        }
    };
})();

const runProvision = async (job: ProvisionJob): Promise<void> => {
    const { idBD, spec, version, creds } = job;
    try {
        // 1. Image
        let last = 0;
        await setEtat(
            job,
            "CREATION",
            `Téléchargement de l'image ${imageRef(spec, version)}…`,
        );
        await ensureImage(imageRef(spec, version), (status) => {
            if (Date.now() - last < 1000) return; // limite à 1 message / seconde
            last = Date.now();
            socketManager.emitToUser(
                job.idUtilisateur,
                "database:progression",
                { idBD, message: status },
            );
        });

        // 2. Volume + conteneur
        await setEtat(job, "CREATION", "Création du conteneur…");
        await docker.createVolume({
            Name: volumeName(idBD),
            Labels: { "archicloud.database": idBD },
        });
        const container = await createContainer({ ...job, creds });
        await container.start();

        // 3. Attente de disponibilité
        await setEtat(job, "CREATION", "Démarrage du moteur…");
        const ready = await waitReady(idBD, spec, creds, true);
        if (!ready.ok) throw new Error(ready.reason);

        await setEtat(job, "EN_LIGNE", "Base de données en ligne.", {
            idConteneur: container.id,
        });
    } catch (error) {
        const message = (
            error instanceof Error ? error.message : String(error)
        )
            .split(creds.password)
            .join("***")
            .slice(0, 1500);
        await removeAll(idBD).catch(() => undefined);
        await setEtat(job, "ERREUR", message, {
            idConteneur: null,
            portHote: null,
        }).catch((e) =>
            console.error("[database] échec enregistrement erreur:", e),
        );
    }
};

export const enqueueProvision = (job: ProvisionJob): void => {
    void limiter(() => runProvision(job)).catch((e) =>
        console.error("[database] erreur inattendue:", e),
    );
};

// ───────── Actions sur une base existante ─────────

export const stopContainer = async (idBD: string): Promise<void> => {
    try {
        await docker.getContainer(containerName(idBD)).stop({ t: 10 });
    } catch (e) {
        if (!isStatus(e, 304)) throw e; // 304 = déjà arrêté
    }
};

export const startContainer = async (idBD: string): Promise<void> => {
    try {
        await docker.getContainer(containerName(idBD)).start();
    } catch (e) {
        if (!isStatus(e, 304)) throw e;
    }
};

export const inspectState = async (
    idBD: string,
): Promise<{ exists: boolean; running: boolean }> => {
    try {
        const st = (await docker.getContainer(containerName(idBD)).inspect())
            .State;
        return { exists: true, running: !!st.Running };
    } catch (e) {
        if (isStatus(e, 404)) return { exists: false, running: false };
        throw e;
    }
};

/** Supprime conteneur puis volume (les données sont perdues). Sans erreur si déjà absents. */
export const removeAll = async (idBD: string): Promise<void> => {
    try {
        await docker.getContainer(containerName(idBD)).remove({ force: true });
    } catch (e) {
        if (!isStatus(e, 404)) throw e;
    }
    try {
        await docker.getVolume(volumeName(idBD)).remove();
    } catch (e) {
        if (!isStatus(e, 404)) throw e;
    }
};

/** Change le mot de passe applicatif : commande interne (SQL / Mongo) ou recréation du conteneur (Redis). */
export const changePassword = async (
    p: ProvisionJob & { oldPassword: string; newPassword: string },
): Promise<void> => {
    const { spec, creds, idBD } = p;
    if (spec.resetMode === "exec") {
        const cmd = spec.resetCommand!(creds, p.oldPassword, p.newPassword);
        const r = await execIn(containerName(idBD), cmd.cmd, cmd.env);
        if (r.exitCode !== 0) {
            throw new Error(
                `Échec du changement de mot de passe : ${
                    r.output.split(p.newPassword).join("***").slice(0, 300)
                }`,
            );
        }
        return;
    }
    // recréation : même volume, même port, nouveau mot de passe
    const next = { ...creds, password: p.newPassword };
    await docker.getContainer(containerName(idBD)).remove({ force: true });
    const container = await createContainer({ ...p, creds: next });
    await container.start();
    const ready = await waitReady(idBD, spec, next, false, 60_000);
    if (!ready.ok) throw new Error(ready.reason);
};

// ───────── Démarrage du serveur ─────────

/** Résout les créations interrompues par un redémarrage et resynchronise les états avec Docker. */
export const initDatabases = async (): Promise<void> => {
    if (!(await isDockerAvailable())) {
        console.warn(
            "[database] Docker indisponible : bases de données désactivées.",
        );
        return;
    }
    const stuck = await prisma.baseDeDonnees.findMany({
        where: { etatBD: "CREATION" },
        select: { idBD: true, idUtilisateur: true },
    });
    for (const d of stuck) {
        await removeAll(d.idBD).catch(() => undefined);
        await prisma.baseDeDonnees.update({
            where: { idBD: d.idBD },
            data: {
                etatBD: "ERREUR",
                messageEtat:
                    "Création interrompue par un redémarrage du serveur.",
                portHote: null,
                idConteneur: null,
            },
        });
    }
    const live = await prisma.baseDeDonnees.findMany({
        where: { etatBD: { in: ["EN_LIGNE", "ARRETE"] } },
        select: { idBD: true, idUtilisateur: true, etatBD: true },
    });
    for (const d of live) {
        const st = await inspectState(d.idBD).catch(() => null);
        if (!st) continue;
        if (!st.exists) await setEtat(d, "ERREUR", "Conteneur introuvable.");
        else if (st.running && d.etatBD !== "EN_LIGNE") {
            await setEtat(d, "EN_LIGNE", null);
        } else if (!st.running && d.etatBD !== "ARRETE") {
            await setEtat(d, "ARRETE", "Conteneur arrêté.");
        }
    }
    console.log(
        `[database] ${live.length} base(s) synchronisée(s), ${stuck.length} création(s) interrompue(s).`,
    );
};