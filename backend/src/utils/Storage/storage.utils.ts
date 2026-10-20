// src/utils/storage.ts
import fs from "fs";
import path from "path";

const MB = 1024 * 1024;
const envMb = (name: string, fallback: number) => {
    const n = Number(process.env[name]);
    return Number.isFinite(n) && n > 0 ? n : fallback;
};

// Fonctions (et non constantes) : lues à l'usage, après le chargement du .env dans index.ts.

/** Quota par défaut d'un espace de stockage : 2 Go (SPACE_QUOTA_MB). */
export const defaultSpaceSize = () => envMb("SPACE_QUOTA_MB", 2048) * MB;

/** Taille maximale d'un fichier envoyé : par défaut le quota d'un espace (UPLOAD_MAX_FILE_MB). */
export const maxUploadSize = () => envMb("UPLOAD_MAX_FILE_MB", defaultSpaceSize() / MB) * MB;

/**
 * Extensions acceptées dans les espaces de stockage, par catégorie.
 * L'extension décide du type sous lequel /uploads sert le fichier : HTML et scripts restent exclus
 * (ils pourraient s'exécuter dans le navigateur depuis l'origine de l'API).
 */
export const ALLOWED_UPLOAD_EXTENSIONS: Record<string, string[]> = {
    images: ["jpg", "jpeg", "png", "gif", "webp", "avif", "bmp", "ico", "tif", "tiff", "heic", "heif", "svg"],
    videos: ["mp4", "m4v", "webm", "ogv", "mov", "mkv", "avi", "wmv", "flv", "3gp", "mpeg", "mpg"],
    audio: ["mp3", "wav", "ogg", "oga", "opus", "m4a", "aac", "flac", "weba"],
    documents: ["pdf", "doc", "docx", "odt", "rtf", "txt", "md"],
    tableurs: ["xls", "xlsx", "ods", "csv", "tsv"],
    presentations: ["ppt", "pptx", "odp"],
    archives: ["zip", "rar", "7z", "tar", "gz", "tgz", "bz2"],
    donnees: ["json", "xml", "yaml", "yml", "sql"],
};

const ALLOWED_EXTENSIONS = new Set(Object.values(ALLOWED_UPLOAD_EXTENSIONS).flat());

/** Types MIME refusés même avec une extension autorisée (contenu exécutable par le navigateur). */
const BLOCKED_MIMES = new Set(["text/html", "application/xhtml+xml", "text/javascript", "application/javascript", "application/x-msdownload"]);

export const isAllowedUpload = (originalName: string, mimetype: string): boolean => {
    const ext = path.extname(originalName).slice(1).toLowerCase();
    return ALLOWED_EXTENSIONS.has(ext) && !BLOCKED_MIMES.has(mimetype.toLowerCase());
};

/** « 2 Go », « 500 Mo » : pour les messages d'erreur. */
export const formatSize = (bytes: number) =>
    bytes >= 1024 * MB ? `${+(bytes / (1024 * MB)).toFixed(1)} Go` : `${Math.round(bytes / MB)} Mo`;

export const UPLOADS_ROOT = path.resolve(process.cwd(), "uploads");

/**
 * Transforme un chemin relatif stocké en base (ex: "uploads/<user>/<espace>")
 * en chemin absolu, en garantissant qu'il reste dans le dossier `uploads`
 * (protection contre le path traversal).
 */
export const resolveUploadPath = (relativePath: string): string => {
    const absolute = path.resolve(process.cwd(), relativePath);
    if (!absolute.startsWith(UPLOADS_ROOT + path.sep)) {
        throw new Error("Chemin de stockage invalide");
    }
    return absolute;
};
/**
 * Retourne `nom` s'il est libre, sinon « nom (copie).ext », « nom (copie 2).ext »…
 * @param pris noms déjà utilisés dans l'espace de destination
 */
export const nomDisponible = (nom: string, pris: ReadonlySet<string>, max = 255): string => {
    if (!pris.has(nom)) return nom;
    const ext = path.extname(nom);
    const base = ext ? nom.slice(0, -ext.length) : nom;
    for (let i = 1; ; i++) {
        const suffixe = ` (copie${i > 1 ? ` ${i}` : ""})${ext}`;
        const candidat = base.slice(0, Math.max(1, max - suffixe.length)) + suffixe;
        if (!pris.has(candidat)) return candidat;
    }
};

/** Déplace un fichier ; retombe sur copie + suppression si les dossiers sont sur des disques différents (EXDEV). */
export const moveFile = async (src: string, dest: string): Promise<void> => {
    try {
        await fs.promises.rename(src, dest);
    } catch (error: any) {
        if (error?.code !== "EXDEV") throw error;
        await fs.promises.copyFile(src, dest, fs.constants.COPYFILE_EXCL);
        await fs.promises.rm(src, { force: true });
    }
};