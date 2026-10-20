// src/services/log.analyzer.service.ts
// Identifie les erreurs dans un flux de lignes de logs (texte brut ou JSON, ex: pino/winston).

export type Niveau = "warning" | "error" | "fatal";
export type Severite = "faible" | "moyenne" | "haute" | "critique";

export interface Analysis {
    niveau: Niveau;
    categorie: string;
    severite: Severite;
    /** Première ligne, tronquée (pour les notifications). */
    message: string;
    /** Ligne complète + stack trace éventuelle. */
    detail: string;
    /** Empreinte normalisée pour dédupliquer les erreurs répétitives. */
    fingerprint: string;
}

interface CategorieRule {
    nom: string;
    regex: RegExp;
    severite: Severite;
}

// L'ORDRE COMPTE : la première règle qui correspond gagne.
const CATEGORIES: CategorieRule[] = [
    { nom: "ERREUR_MEMOIRE", regex: /out of memory|heap out of memory|\bOOM\b|ENOMEM|Cannot allocate memory|OutOfMemoryError/i, severite: "critique" },
    { nom: "DISQUE_PLEIN", regex: /ENOSPC|no space left on device|disk (is )?full/i, severite: "critique" },
    { nom: "CRASH_PROCESSUS", regex: /segmentation fault|core dumped|exited with code [1-9]|exit code [1-9]|\bkilled\b|SIGSEGV|SIGKILL/i, severite: "critique" },
    { nom: "PORT_OCCUPE", regex: /EADDRINUSE|address already in use/i, severite: "haute" },
    { nom: "BASE_DE_DONNEES", regex: /SQLSTATE|deadlock detected|too many connections|relation ".+" does not exist|PrismaClient\w*Error|\bP[12]\d{3}\b|\bER_[A-Z_]+\b|database .+ (does not exist|is locked)|MongoServerError|MongoNetworkError/i, severite: "haute" },
    { nom: "ERREUR_RESEAU", regex: /ECONNREFUSED|ECONNRESET|ETIMEDOUT|ENOTFOUND|EAI_AGAIN|EHOSTUNREACH|connection (refused|reset|timed out)|socket hang up/i, severite: "haute" },
    { nom: "PERMISSION_REFUSEE", regex: /EACCES|EPERM|permission denied/i, severite: "haute" },
    { nom: "FICHIER_INTROUVABLE", regex: /ENOENT|no such file or directory|Cannot find module|ModuleNotFoundError/i, severite: "moyenne" },
    { nom: "AUTHENTIFICATION", regex: /authentication failed|unauthorized|invalid (token|credentials)|JsonWebTokenError|TokenExpiredError/i, severite: "moyenne" },
    { nom: "HTTP_5XX", regex: /(?:status|code)\W{0,3}5\d\d\b|"\s5\d\d\s/i, severite: "haute" },
    { nom: "TIMEOUT", regex: /timed? ?out|timeout/i, severite: "moyenne" },
    { nom: "EXCEPTION_CODE", regex: /\b(TypeError|ReferenceError|SyntaxError|RangeError|NullPointerException|IllegalStateException|UnhandledPromiseRejection)\b|Cannot read propert|Traceback \(most recent/i, severite: "moyenne" },
];

export const CATEGORIES_CRITIQUES = new Set<string>([
    ...CATEGORIES.filter((c) => c.severite === "critique").map((c) => c.nom),
    "ERREUR_FATALE",
]);

export const MAX_DETAIL_LENGTH = 4000;
const MAX_STACK_LINES = 60;
// eslint-disable-next-line no-control-regex
const ANSI_REGEX = /\u001b\[[0-9;]*m/g;

const LEVEL_TOKEN = /\b(FATAL|CRITICAL|PANIC|EMERG|ERROR|ERR|SEVERE|WARN|WARNING|INFO|DEBUG|TRACE|NOTICE)\b/i;
const EXCEPTION_START = /^\s*(?:Uncaught\s+|Unhandled\s+)?(?:[\w$]+\.)*\w*(?:Error|Exception)\b|UnhandledPromiseRejection|Traceback \(most recent/;

type NiveauBrut = Niveau | "info";

const mapLevel = (token: string): NiveauBrut => {
    switch (token.toUpperCase()) {
        case "FATAL": case "CRITICAL": case "PANIC": case "EMERG": return "fatal";
        case "ERROR": case "ERR": case "SEVERE": return "error";
        case "WARN": case "WARNING": return "warning";
        default: return "info";
    }
};

/** Détecte un niveau explicite dans le début de la ligne (ex: "2026-09-29T10:00:00Z ERROR ..."). */
const detectLevel = (line: string): NiveauBrut | undefined => {
    const m = line.slice(0, 80).match(LEVEL_TOKEN);
    if (m?.[1]) return mapLevel(m[1]);
    if (EXCEPTION_START.test(line)) return "error";
    return undefined;
};

/** Logs JSON (pino: level numérique ; winston/bunyan: level texte). */
const parseStructured = (line: string): { level?: NiveauBrut; message: string } | null => {
    if (!line.startsWith("{")) return null;
    try {
        const o = JSON.parse(line) as Record<string, any>;
        const raw = o.level ?? o.severity ?? o.lvl;
        let level: NiveauBrut | undefined;
        if (typeof raw === "number") level = raw >= 60 ? "fatal" : raw >= 50 ? "error" : raw >= 40 ? "warning" : "info";
        else if (typeof raw === "string") level = mapLevel(raw);
        const message = String(o.msg ?? o.message ?? o.error?.message ?? line);
        return { level:level!, message };
    } catch {
        return null;
    }
};

export const stripAnsi = (s: string): string => s.replace(ANSI_REGEX, "");

const makeFingerprint = (message: string): string =>
    message
        .toLowerCase()
        .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g, "#")
        .replace(/0x[0-9a-f]+/g, "#")
        .replace(/\d+/g, "#")
        .slice(0, 200);

/**
 * Analyse UNE ligne. Retourne null si ce n'est pas une erreur à stocker.
 * @param storeWarnings stocker aussi les avertissements (défaut : non)
 */
export const analyzeLine = (rawLine: string, storeWarnings = false): Analysis | null => {
    const line = stripAnsi(rawLine).trim();
    if (!line) return null;

    const structured = parseStructured(line);
    let niveau: NiveauBrut | undefined = structured ? structured.level : detectLevel(line);
    const texte = structured?.message ?? line;

    if (niveau === "info") return null; // INFO / DEBUG / TRACE explicites : jamais une erreur

    const rule = CATEGORIES.find((c) => c.regex.test(line));
    if (!niveau && !rule) return null;
    if (!niveau) niveau = "error"; // pas de niveau mais une signature d'erreur connue
    if (niveau === "warning" && !storeWarnings) return null;

    const categorie =
        rule?.nom ??
        (niveau === "fatal" ? "ERREUR_FATALE" : niveau === "warning" ? "AVERTISSEMENT" : "ERREUR_GENERIQUE");

    let severite: Severite = rule?.severite ?? "moyenne";
    if (niveau === "fatal") severite = "critique";
    else if (niveau === "warning") severite = "faible";

    const message = texte.slice(0, 300);
    return {
        niveau,
        categorie,
        severite,
        message,
        detail: line.slice(0, MAX_DETAIL_LENGTH),
        fingerprint: makeFingerprint(message),
    };
};

const isContinuation = (line: string): boolean => /^(\s+\S|Caused by:|Traceback )/.test(line);

/**
 * Regroupe une erreur et sa stack trace (lignes indentées / "Caused by") en une seule entrée.
 * push() renvoie l'entrée PRÉCÉDENTE quand elle est terminée ; flush() force la sortie.
 */
export class LogAggregator {
    private pending: Analysis | null = null;
    private extra: string[] = [];

    constructor(private readonly storeWarnings = false) {}

    push(rawLine: string): Analysis | null {
        const line = stripAnsi(rawLine).replace(/\s+$/, "");
        if (!line.trim()) return null;

        if (this.pending && isContinuation(line) && this.extra.length < MAX_STACK_LINES) {
            this.extra.push(line);
            return null;
        }

        const done = this.flush();
        const analysis = analyzeLine(line, this.storeWarnings);
        if (analysis) this.pending = analysis;
        return done;
    }

    flush(): Analysis | null {
        if (!this.pending) return null;
        const result: Analysis = {
            ...this.pending,
            detail: [this.pending.detail, ...this.extra].join("\n").slice(0, MAX_DETAIL_LENGTH),
        };
        this.pending = null;
        this.extra = [];
        return result;
    }

    get hasPending(): boolean {
        return this.pending !== null;
    }
}

/** Analyse un lot de lignes déjà collectées (ingestion HTTP). */
export const analyzeLines = (lines: string[], storeWarnings = false): Analysis[] => {
    const agg = new LogAggregator(storeWarnings);
    const out: Analysis[] = [];
    for (const l of lines) {
        const a = agg.push(l);
        if (a) out.push(a);
    }
    const last = agg.flush();
    if (last) out.push(last);
    return out;
};