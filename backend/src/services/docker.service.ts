// src/services/docker.service.ts
// Enveloppe fine autour de la CLI `docker` et de `git` (spawn, sans shell => pas d'injection de commande).
import { spawn } from "child_process";
import net from "net";

export const CONTAINER_PREFIX = process.env.DEPLOY_CONTAINER_PREFIX ?? "deploy-";
export const containerName = (idDeploiement: string) => `${CONTAINER_PREFIX}${idDeploiement}`;
export const imageName = (idDeploiement: string) => `archicloud/dep-${idDeploiement}:latest`;

export class CommandError extends Error {
    constructor(message: string, public readonly code: number | null) {
        super(message);
    }
}

export interface ExecOptions {
    cwd?: string;
    env?: NodeJS.ProcessEnv;
    timeoutMs?: number;
    /** Appelée pour chaque ligne de stdout/stderr (temps réel). */
    onLine?: (line: string) => void;
}

const MAX_CAPTURE = 1024 * 1024;

/** Exécute une commande et renvoie { code, output }. Ne lève pas si le code de sortie ≠ 0. */
export const exec = (cmd: string, args: string[], opts: ExecOptions = {}): Promise<{ code: number | null; output: string }> =>
    new Promise((resolve, reject) => {
        const child = spawn(cmd, args, { cwd: opts.cwd, env: opts.env ?? process.env, stdio: ["ignore", "pipe", "pipe"] });
        let output = "";
        const partial = { out: "", err: "" };

        const feed = (key: "out" | "err") => (chunk: Buffer) => {
            const text = chunk.toString("utf8");
            if (output.length < MAX_CAPTURE) output += text;
            partial[key] += text;
            const lines = partial[key].split(/\r?\n/);
            partial[key] = lines.pop() ?? "";
            if (opts.onLine) lines.forEach((l) => l && opts.onLine!(l));
        };
        child.stdout.on("data", feed("out"));
        child.stderr.on("data", feed("err"));

        const timer = opts.timeoutMs
            ? setTimeout(() => {
                  child.kill("SIGKILL");
                  reject(new CommandError(`Délai dépassé (${Math.round(opts.timeoutMs! / 1000)} s) : ${cmd} ${args[0] ?? ""}`, null));
              }, opts.timeoutMs)
            : undefined;

        child.on("error", (e) => {
            clearTimeout(timer);
            reject(new CommandError(`Impossible d'exécuter « ${cmd} » : ${e.message}`, null));
        });
        child.on("close", (code) => {
            clearTimeout(timer);
            if (opts.onLine) [partial.out, partial.err].forEach((l) => l && opts.onLine!(l));
            resolve({ code, output });
        });
    });

export const execOrThrow = async (cmd: string, args: string[], opts: ExecOptions = {}): Promise<string> => {
    const { code, output } = await exec(cmd, args, opts);
    if (code !== 0) {
        const tail = output.trim().split("\n").slice(-5).join("\n");
        throw new CommandError(`« ${cmd} ${args[0] ?? ""} » a échoué (code ${code})${tail ? `:\n${tail}` : ""}`, code);
    }
    return output.trim();
};

// ───────── Docker ─────────

export const isDockerAvailable = async (): Promise<boolean> => {
    try {
        const { code } = await exec("docker", ["version", "--format", "{{.Server.Version}}"], { timeoutMs: 10_000 });
        return code === 0;
    } catch(error:any) {
        console.log(error)
        return false;
    }
};

export const dockerBuild = (image: string, contextDir: string, dockerfile: string, onLine: (l: string) => void) =>
    execOrThrow("docker", ["build", "--progress=plain", "-t", image, "-f", dockerfile, contextDir], {
        timeoutMs: Number(process.env.DEPLOY_BUILD_TIMEOUT_MS ?? 15 * 60_000),
        env: { ...process.env, DOCKER_BUILDKIT: "1" },
        onLine,
    });

export interface RunSpec {
    idDeploiement: string;
    idUtilisateur: string;
    image: string;
    envFile: string;
    portHote: number;
    portConteneur: number;
}

/** Lance le conteneur (détaché) avec limites de ressources. Retourne l'id du conteneur. */
export const dockerRun = (s: RunSpec) => {
    const memory = process.env.DEPLOY_MEMORY ?? "512m";
    return execOrThrow(
        "docker",
        [
            "run", "-d",
            "--name", containerName(s.idDeploiement),
            "--label", `archicloud.deployment=${s.idDeploiement}`,
            "--label", `archicloud.user=${s.idUtilisateur}`,
            "-p", `${process.env.DEPLOY_BIND_ADDRESS ?? "0.0.0.0"}:${s.portHote}:${s.portConteneur}`,
            "--memory", memory, "--memory-swap", memory,
            "--cpus", process.env.DEPLOY_CPUS ?? "0.5",
            "--pids-limit", "256",
            "--security-opt", "no-new-privileges",
            "--log-opt", "max-size=10m", "--log-opt", "max-file=3",
            "--restart", "unless-stopped",
            "--env-file", s.envFile,
            s.image,
        ],
        { timeoutMs: 60_000 },
    );
};

export interface TestSpec {
    idDeploiement: string;
    image: string;
    /** Commande shell exécutée dans le conteneur (ex. « npm test »). */
    command: string;
    /** Variables d'environnement du projet (mêmes que l'application). */
    envFile: string;
    onLine: (line: string) => void;
}

/**
 * Exécute les tests dans un conteneur jetable créé depuis l'image construite (mêmes limites que l'application).
 * Renvoie le code de sortie ; le conteneur est toujours supprimé, même en cas de délai dépassé.
 */
export const dockerTest = async (s: TestSpec): Promise<number | null> => {
    const name = `${CONTAINER_PREFIX}test-${s.idDeploiement}`;
    const memory = process.env.DEPLOY_MEMORY ?? "512m";
    try {
        const { code } = await exec(
            "docker",
            [
                "run", "--rm",
                "--name", name,
                "--label", `archicloud.deployment=${s.idDeploiement}`,
                "--memory", memory, "--memory-swap", memory,
                "--cpus", process.env.DEPLOY_CPUS ?? "0.5",
                "--pids-limit", "256",
                "--security-opt", "no-new-privileges",
                "--env-file", s.envFile,
                // Mode non interactif des lanceurs de tests (Jest, Vitest, CRA…)
                "-e", "CI=true", "-e", "NODE_ENV=test",
                s.image,
                "sh", "-c", s.command,
            ],
            { timeoutMs: Number(process.env.DEPLOY_TEST_TIMEOUT_MS ?? 10 * 60_000), onLine: s.onLine },
        );
        return code;
    } finally {
        await exec("docker", ["rm", "-f", name], { timeoutMs: 30_000 }).catch(() => undefined);
    }
};

export const dockerStop = (idDeploiement: string) => execOrThrow("docker", ["stop", "-t", "10", containerName(idDeploiement)], { timeoutMs: 30_000 });
export const dockerStart = (idDeploiement: string) => execOrThrow("docker", ["start", containerName(idDeploiement)], { timeoutMs: 30_000 });

/** Supprime conteneur puis image, sans erreur si absents. */
export const dockerRemoveAll = async (idDeploiement: string): Promise<void> => {
    await exec("docker", ["rm", "-f", containerName(idDeploiement)], { timeoutMs: 30_000 }).catch(() => undefined);
    await exec("docker", ["rmi", "-f", imageName(idDeploiement)], { timeoutMs: 30_000 }).catch(() => undefined);
};

export const dockerInspectState = async (idDeploiement: string): Promise<{ exists: boolean; running: boolean; restarting: boolean; exitCode: number }> => {
    const { code, output } = await exec(
        "docker",
        ["inspect", "-f", "{{.State.Running}}|{{.State.Restarting}}|{{.State.ExitCode}}", containerName(idDeploiement)],
        { timeoutMs: 10_000 },
    ).catch(() => ({ code: 1, output: "" }));
    if (code !== 0) return { exists: false, running: false, restarting: false, exitCode: 0 };
    const [running, restarting, exit] = output.trim().split("|");
    return { exists: true, running: running === "true", restarting: restarting === "true", exitCode: Number(exit) || 0 };
};

export const dockerLogsTail = async (idDeploiement: string, lines = 100): Promise<string[]> => {
    const { output } = await exec("docker", ["logs", "--tail", String(lines), containerName(idDeploiement)], { timeoutMs: 15_000 }).catch(() => ({ output: "" }));
    return output.split(/\r?\n/).filter(Boolean);
};

// ───────── Git ─────────

/**
 * Clone un dépôt GitHub (shallow, une branche). Le jeton est passé via l'environnement git
 * (GIT_CONFIG_*) : il n'apparaît ni dans la ligne de commande, ni dans l'URL, ni dans .git/config.
 */
export const gitClone = (depot: string, branche: string, destDir: string, token: string, onLine: (l: string) => void) =>
    execOrThrow(
        "git",
        ["clone", "--depth", "1", "--single-branch", "--branch", branche, "--", `https://github.com/${depot}.git`, destDir],
        {
            timeoutMs: 5 * 60_000,
            onLine,
            env: {
                ...process.env,
                GIT_TERMINAL_PROMPT: "0",
                GIT_CONFIG_COUNT: "1",
                GIT_CONFIG_KEY_0: "http.https://github.com/.extraheader",
                GIT_CONFIG_VALUE_0: `AUTHORIZATION: basic ${Buffer.from(`x-access-token:${token}`).toString("base64")}`,
            },
        },
    );

// ───────── Réseau ─────────

export const isPortFree = (port: number): Promise<boolean> =>
    new Promise((resolve) => {
        const srv = net.createServer();
        srv.once("error", () => resolve(false));
        srv.once("listening", () => srv.close(() => resolve(true)));
        srv.listen(port, "0.0.0.0");
    });
