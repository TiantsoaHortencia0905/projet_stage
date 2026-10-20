import type { Fichier } from "../../generated/prisma/index.js";
import type { RequestResponse } from "../../model/index.ts";
import { randomUUID } from "crypto";
import fs from "fs";
import path from "path";
import prisma from "../../config/prisma.config.ts";
import { moveFile, nomDisponible, resolveUploadPath } from "../../utils/Storage/storage.utils.ts";

const NAME_MAX_LENGTH = 255;

class QuotaError extends Error {}

const fail = (status: number, message: string) => ({ success: false as const, status, message });

/** Nom optionnel saisi par l'utilisateur : undefined = non fourni, null = invalide. */
const parseNom = (v: unknown): string | undefined | null => {
    if (v === undefined || v === null || v === "") return undefined;
    if (typeof v !== "string") return null;
    const nom = v.trim();
    return nom && nom.length <= NAME_MAX_LENGTH && !/[\\/]/.test(nom) ? nom : null;
};

/** Durée de conservation dans la corbeille (CORBEILLE_JOURS, 30 par défaut). */
const corbeilleJours = () => {
    const n = Number(process.env.CORBEILLE_JOURS);
    return Number.isFinite(n) && n > 0 ? n : 30;
};

/** Fichier archivé : erreur explicite au lieu d'un « introuvable » (renommage, copie, déplacement). */
const archivedError = async (idUser: string, idFichier: string) => {
    const archived = await prisma.fichier.findFirst({
        where: { idFichier, idUtilisateur: idUser, dateSuppression: null, dateArchivage: { not: null } },
        select: { idFichier: true },
    });
    return archived ? fail(409, "Ce fichier est archivé : désarchivez-le pour le renommer, le copier ou le déplacer.") : null;
};

const nouveauNomPhysique = (ext: string) => `fichier_${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;

export default class FichierController {
    /**
     * Dépose un fichier (déjà reçu par multer dans uploads/.tmp) dans un espace de l'utilisateur.
     * Vérifie : espace appartenant à l'utilisateur, quota disponible.
     */
    static async deposit(
        idUser: string,
        idEspace: string | undefined,
        file: Express.Multer.File | undefined,
    ): Promise<RequestResponse<Fichier>> {
        // BUG corrigé : `req.file!` + `fichier.filename.trim()` plantait si aucun fichier n'était envoyé.
        if (!file) {
            return { success: false, status: 400, message: "Fichier non uploadé, veuillez vérifier." };
        }

        let destAbs: string | undefined;
        const cleanup = () => {
            fs.rmSync(file.path, { force: true });
            if (destAbs) fs.rmSync(destAbs, { force: true });
        };

        try {
            if (!idEspace) {
                cleanup();
                return { success: false, status: 400, message: "idEspace requis." };
            }

            // Sécurité : l'espace doit appartenir à l'utilisateur authentifié
            const espace = await prisma.espaceStockage.findFirst({
                where: { idEspace, idUtilisateur: idUser },
            });
            if (!espace) {
                cleanup();
                return { success: false, status: 404, message: "Espace de stockage introuvable" };
            }

            // Quota (le champ tailleEspace n'était jamais contrôlé ni tailleOccupee mise à jour)
            if (espace.tailleOccupee + file.size > espace.tailleEspace) {
                cleanup();
                return { success: false, status: 413, message: "Espace de stockage insuffisant." };
            }

            // Déplacement dans le dossier de l'espace
            destAbs = path.join(resolveUploadPath(espace.cheminEspace), file.filename);
            fs.mkdirSync(path.dirname(destAbs), { recursive: true });
            fs.renameSync(file.path, destAbs);

            // multer décode le nom en latin1 : on le remet en UTF-8 (accents)
            const nomOriginal = Buffer.from(file.originalname, "latin1").toString("utf8");
            const idFichier = randomUUID();

            const [fichier] = await prisma.$transaction([
                prisma.fichier.create({
                    data: {
                        idFichier,
                        idEspaces: [idEspace],
                        typeMime: file.mimetype || null,
                        cheminFichier: path.posix.join(espace.cheminEspace, file.filename),
                        tailleFichier: file.size,
                        // BUG corrigé : on stockait le nom aléatoire de multer ; on garde le vrai nom.
                        nomFichier: nomOriginal,
                        idUtilisateur: idUser,
                    },
                }),
                prisma.espaceStockage.update({
                    where: { idEspace },
                    data: {
                        tailleOccupee: { increment: file.size },
                        idFichiers: { push: idFichier },
                    },
                }),
            ]);

            return { success: true, status: 201, message: "Fichier uploadé avec succès", data: fichier };
        } catch (error) {
            cleanup();
            throw error;
        }
    }

    static async delete(idFichier: string, idUser: string): Promise<RequestResponse<Fichier>> {
        // Propriétaire uniquement (avant : n'importe quel utilisateur connecté pouvait supprimer n'importe quel fichier)
        const fichier = await prisma.fichier.findFirst({ where: { idFichier, idUtilisateur: idUser } });
        if (!fichier) {
            return { success: false, status: 404, message: "Fichier non identifié" };
        }

        try {
            fs.rmSync(resolveUploadPath(fichier.cheminFichier), { force: true });
        } catch (error) {
            console.error("Suppression disque impossible:", error);
            return { success: false, status: 500, message: "Erreur interne lors de la suppression du fichier" };
        }

        // Mise à jour des espaces (quota + liste des ids)
        const espaces = await prisma.espaceStockage.findMany({
            where: { idEspace: { in: fichier.idEspaces } },
        });

        const [deleted] = await prisma.$transaction([
            prisma.fichier.delete({ where: { idFichier } }),
            ...espaces.map((e) =>
                prisma.espaceStockage.update({
                    where: { idEspace: e.idEspace },
                    data: {
                        tailleOccupee: Math.max(0, e.tailleOccupee - fichier.tailleFichier),
                        idFichiers: e.idFichiers.filter((id) => id !== idFichier),
                    },
                }),
            ),
        ]);

        return { success: true, data: deleted, message: "Fichier supprimé avec succès" };
    }

    // ───────── Archives ─────────
    // Un fichier archivé reste dans son espace (et dans le quota) sans limite de durée, mais il est figé :
    // ni renommage, ni copie, ni déplacement tant qu'il n'est pas désarchivé. Il reste consultable.

    static async archiver(idUser: string, idFichier: string): Promise<RequestResponse<Fichier>> {
        const fichier = await prisma.fichier.findFirst({ where: { idFichier, idUtilisateur: idUser, dateSuppression: null } });
        if (!fichier) return fail(404, "Fichier non identifié");
        if (fichier.dateArchivage) return fail(409, "Ce fichier est déjà archivé.");
        const archived = await prisma.fichier.update({ where: { idFichier }, data: { dateArchivage: new Date() } });
        return { success: true, data: archived, message: "Fichier archivé" };
    }

    static async desarchiver(idUser: string, idFichier: string): Promise<RequestResponse<Fichier>> {
        const fichier = await prisma.fichier.findFirst({ where: { idFichier, idUtilisateur: idUser, dateSuppression: null, dateArchivage: { not: null } } });
        if (!fichier) return fail(404, "Fichier introuvable dans les archives");
        const restored = await prisma.fichier.update({ where: { idFichier }, data: { dateArchivage: null } });
        return { success: true, data: restored, message: "Fichier désarchivé" };
    }

    // ───────── Corbeille ─────────
    // Un fichier à la corbeille reste sur le disque et compte dans le quota de son espace,
    // mais n'apparaît plus dans l'espace. Il est purgé définitivement après CORBEILLE_JOURS jours.

    /** Met le fichier à la corbeille (restaurable). */
    static async mettreCorbeille(idUser: string, idFichier: string): Promise<RequestResponse<Fichier>> {
        const fichier = await prisma.fichier.findFirst({ where: { idFichier, idUtilisateur: idUser, dateSuppression: null } });
        if (!fichier) return fail(404, "Fichier non identifié");

        const espaces = await prisma.espaceStockage.findMany({ where: { idEspace: { in: fichier.idEspaces } } });
        const [trashed] = await prisma.$transaction([
            prisma.fichier.update({ where: { idFichier }, data: { dateSuppression: new Date() } }),
            // L'espace ne liste plus le fichier (le quota, lui, reste occupé)
            ...espaces.map((e) =>
                prisma.espaceStockage.update({
                    where: { idEspace: e.idEspace },
                    data: { idFichiers: e.idFichiers.filter((id) => id !== idFichier) },
                }),
            ),
        ]);
        return { success: true, data: trashed, message: "Fichier placé dans la corbeille" };
    }

    /** Remet le fichier dans son espace ; renommé « (copie) » si un fichier du même nom y est apparu entre-temps. */
    static async restaurer(idUser: string, idFichier: string): Promise<RequestResponse<Fichier>> {
        const fichier = await prisma.fichier.findFirst({ where: { idFichier, idUtilisateur: idUser, dateSuppression: { not: null } } });
        if (!fichier) return fail(404, "Fichier introuvable dans la corbeille");

        const idEspace = fichier.idEspaces[0];
        const espace = idEspace ? await prisma.espaceStockage.findFirst({ where: { idEspace, idUtilisateur: idUser } }) : null;
        if (!espace) return fail(409, "L'espace d'origine n'existe plus : ce fichier ne peut pas être restauré.");

        const existants = await prisma.fichier.findMany({
            where: { idUtilisateur: idUser, idEspaces: { has: espace.idEspace }, dateSuppression: null },
            select: { nomFichier: true },
        });
        const nomFinal = nomDisponible(fichier.nomFichier, new Set(existants.map((f) => f.nomFichier)), NAME_MAX_LENGTH);

        const [restored] = await prisma.$transaction([
            prisma.fichier.update({ where: { idFichier }, data: { dateSuppression: null, nomFichier: nomFinal } }),
            prisma.espaceStockage.update({
                where: { idEspace: espace.idEspace },
                data: { idFichiers: [...espace.idFichiers.filter((id) => id !== idFichier), idFichier] },
            }),
        ]);
        return {
            success: true,
            data: restored,
            message: nomFinal === fichier.nomFichier ? "Fichier restauré" : `Fichier restauré sous le nom « ${nomFinal} »`,
        };
    }

    /** Contenu de la corbeille, du plus récent au plus ancien, avec l'espace d'origine et la date de purge. */
    static async listerCorbeille(idUser: string) {
        const fichiers = await prisma.fichier.findMany({
            where: { idUtilisateur: idUser, dateSuppression: { not: null } },
            orderBy: { dateSuppression: "desc" },
        });
        const espaces = await prisma.espaceStockage.findMany({
            where: { idEspace: { in: [...new Set(fichiers.flatMap((f) => f.idEspaces))] } },
            select: { idEspace: true, nomEspace: true },
        });
        const noms = new Map(espaces.map((e) => [e.idEspace, e.nomEspace]));
        const jours = corbeilleJours();
        return {
            success: true as const,
            data: {
                retentionJours: jours,
                items: fichiers.map((f) => ({
                    ...f,
                    nomEspace: noms.get(f.idEspaces[0] ?? "") ?? null,
                    datePurge: new Date(f.dateSuppression!.getTime() + jours * 86_400_000),
                })),
            },
        };
    }

    /** Supprime définitivement tout le contenu de la corbeille. */
    static async viderCorbeille(idUser: string): Promise<RequestResponse<{ supprimes: number }>> {
        const fichiers = await prisma.fichier.findMany({
            where: { idUtilisateur: idUser, dateSuppression: { not: null } },
            select: { idFichier: true },
        });
        let supprimes = 0;
        for (const f of fichiers) {
            const res = await FichierController.delete(f.idFichier, idUser);
            if (res.success) supprimes++;
        }
        return {
            success: supprimes === fichiers.length,
            ...(supprimes === fichiers.length ? {} : { status: 500 }),
            message: `${supprimes} fichier(s) supprimé(s) définitivement`,
            data: { supprimes },
        };
    }

    /** Purge les fichiers restés plus de CORBEILLE_JOURS jours dans la corbeille (tâche périodique). */
    static async purgerCorbeille(): Promise<number> {
        const limite = new Date(Date.now() - corbeilleJours() * 86_400_000);
        const expires = await prisma.fichier.findMany({
            where: { dateSuppression: { lt: limite } },
            select: { idFichier: true, idUtilisateur: true },
        });
        let n = 0;
        for (const f of expires) {
            if ((await FichierController.delete(f.idFichier, f.idUtilisateur)).success) n++;
        }
        return n;
    }

    static async rename(
        idFichier: string,
        idUser: string,
        newName: unknown,
    ): Promise<RequestResponse<Fichier>> {
        const nom = typeof newName === "string" ? newName.trim() : "";
        if (!nom || nom.length > NAME_MAX_LENGTH || /[\\/]/.test(nom)) {
            return {
                success: false,
                status: 400,
                message: `Nouveau nom invalide (1 à ${NAME_MAX_LENGTH} caractères, sans / ni \\).`,
            };
        }

        const fichier = await prisma.fichier.findFirst({ where: { idFichier, idUtilisateur: idUser, dateSuppression: null, dateArchivage: null } });
        if (!fichier) return (await archivedError(idUser, idFichier)) ?? fail(404, "Fichier non identifié");

        // BUG corrigé : fs.renameSync(fichier.nomFichier, newName) renommait un chemin relatif au cwd
        // (et plantait toujours). Le nom affiché est désormais indépendant du fichier physique => simple update DB.
        const renamed = await prisma.fichier.update({
            where: { idFichier },
            data: { nomFichier: nom, dateModification: new Date() },
        });

        return { success: true, data: renamed, message: "Fichier renommé avec succès" };
    }

    static async listAll(idUser: string): Promise<RequestResponse<Fichier[]>> {
        const data = await prisma.fichier.findMany({ where: { idUtilisateur: idUser, dateSuppression: null } });
        return { success: true, data };
    }

    /** Fichiers d'un espace : actifs (par défaut) ou archivés, avec le responsable (auteur de l'ajout). */
    static async listByEspace(idEspace: string, idUser: string, archives = false): Promise<RequestResponse<Fichier[]>> {
        const espace = await prisma.espaceStockage.findFirst({
            where: { idEspace, idUtilisateur: idUser },
            select: { idEspace: true },
        });
        if (!espace) {
            return { success: false, status: 404, message: "Espace de stockage introuvable" };
        }
        const data = await prisma.fichier.findMany({
            where: { idUtilisateur: idUser, idEspaces: { has: idEspace }, dateSuppression: null, dateArchivage: archives ? { not: null } : null },
            include: { utilisateur: { select: { nomUtilisateur: true, surnomUtilisateur: true } } },
            orderBy: archives ? { dateArchivage: "desc" } : { dateCreation: "desc" },
        });
        return { success: true, data };
    }

    static async listById(idFichier: string, idUser: string): Promise<RequestResponse<Fichier>> {
        const fichier = await prisma.fichier.findFirst({ where: { idFichier, idUtilisateur: idUser, dateSuppression: null } });
        if (!fichier) {
            return { success: false, status: 404, message: "Fichier non trouvé" };
        }
        return { success: true, data: fichier };
    }

    // ───────── Copier / dupliquer / déplacer ─────────

    /** Copie le fichier dans un autre espace (nouveau fichier indépendant, quota de destination consommé). */
    static async copier(
        idUser: string,
        idFichier: string,
        body: { idEspaceDestination?: unknown; nouveauNom?: unknown },
    ): Promise<RequestResponse<Fichier>> {
        const dest = typeof body?.idEspaceDestination === "string" ? body.idEspaceDestination.trim() : "";
        if (!dest) return fail(400, "`idEspaceDestination` requis.");
        return FichierController.creerCopie(idUser, idFichier, dest, body?.nouveauNom);
    }

    /** Duplique le fichier dans SON espace actuel (« nom (copie).ext »). */
    static async dupliquer(
        idUser: string,
        idFichier: string,
        body: { nouveauNom?: unknown },
    ): Promise<RequestResponse<Fichier>> {
        return FichierController.creerCopie(idUser, idFichier, undefined, body?.nouveauNom);
    }

    private static async creerCopie(
        idUser: string,
        idFichier: string,
        idEspaceDest: string | undefined,
        nouveauNom: unknown,
    ): Promise<RequestResponse<Fichier>> {
        const nomSaisi = parseNom(nouveauNom);
        if (nomSaisi === null) return fail(400, `Nom invalide (1 à ${NAME_MAX_LENGTH} caractères, sans / ni \\).`);

        const fichier = await prisma.fichier.findFirst({ where: { idFichier, idUtilisateur: idUser, dateSuppression: null, dateArchivage: null } });
        if (!fichier) return (await archivedError(idUser, idFichier)) ?? fail(404, "Fichier non identifié");

        const idDest = idEspaceDest ?? fichier.idEspaces[0];
        if (!idDest) return fail(409, "Ce fichier n'appartient à aucun espace.");

        const espaceDest = await prisma.espaceStockage.findFirst({ where: { idEspace: idDest, idUtilisateur: idUser } });
        if (!espaceDest) return fail(404, "Espace de destination introuvable");

        if (espaceDest.tailleOccupee + fichier.tailleFichier > espaceDest.tailleEspace) {
            return fail(413, "Espace de destination insuffisant.");
        }

        const srcAbs = resolveUploadPath(fichier.cheminFichier);
        if (!fs.existsSync(srcAbs)) return fail(404, "Le fichier physique est introuvable sur le serveur.");

        // Nom : celui demandé, sinon l'original ; suffixé « (copie) » s'il existe déjà dans l'espace de destination
        const existants = await prisma.fichier.findMany({
            where: { idUtilisateur: idUser, idEspaces: { has: idDest }, dateSuppression: null },
            select: { nomFichier: true },
        });
        const nomFinal = nomDisponible(nomSaisi ?? fichier.nomFichier, new Set(existants.map((f) => f.nomFichier)), NAME_MAX_LENGTH);

        // 1. Copie physique (COPYFILE_EXCL : n'écrase jamais un fichier existant)
        const filename = nouveauNomPhysique(path.extname(fichier.cheminFichier));
        const destAbs = path.join(resolveUploadPath(espaceDest.cheminEspace), filename);
        await fs.promises.mkdir(path.dirname(destAbs), { recursive: true });
        await fs.promises.copyFile(srcAbs, destAbs, fs.constants.COPYFILE_EXCL);

        // 2. Base de données, atomique. Le quota est réservé par un UPDATE conditionnel :
        //    deux copies simultanées ne peuvent pas dépasser la limite ensemble.
        const idNouveau = randomUUID();
        try {
            const copie = await prisma.$transaction(async (tx) => {
                const reserve = await tx.espaceStockage.updateMany({
                    where: { idEspace: idDest, tailleOccupee: { lte: espaceDest.tailleEspace - fichier.tailleFichier } },
                    data: { tailleOccupee: { increment: fichier.tailleFichier } },
                });
                if (reserve.count === 0) throw new QuotaError();
                await tx.espaceStockage.update({ where: { idEspace: idDest }, data: { idFichiers: { push: idNouveau } } });
                return tx.fichier.create({
                    data: {
                        idFichier: idNouveau,
                        idEspaces: [idDest],
                        cheminFichier: path.posix.join(espaceDest.cheminEspace, filename),
                        tailleFichier: fichier.tailleFichier,
                        typeMime: fichier.typeMime,
                        nomFichier: nomFinal,
                        idUtilisateur: idUser,
                    },
                });
            });
            return {
                success: true,
                status: 201,
                message: idDest === fichier.idEspaces[0] ? "Fichier dupliqué avec succès" : "Fichier copié avec succès",
                data: copie,
            };
        } catch (error) {
            await fs.promises.rm(destAbs, { force: true }); // pas de fichier orphelin
            if (error instanceof QuotaError) return fail(413, "Espace de destination insuffisant.");
            throw error;
        }
    }

    /** Déplace le fichier vers un autre espace (même fichier : le quota passe de l'espace source à la destination). */
    static async deplacer(
        idUser: string,
        idFichier: string,
        body: { idEspaceDestination?: unknown },
    ): Promise<RequestResponse<Fichier>> {
        const idDest = typeof body?.idEspaceDestination === "string" ? body.idEspaceDestination.trim() : "";
        if (!idDest) return fail(400, "`idEspaceDestination` requis.");

        const fichier = await prisma.fichier.findFirst({ where: { idFichier, idUtilisateur: idUser, dateSuppression: null, dateArchivage: null } });
        if (!fichier) return (await archivedError(idUser, idFichier)) ?? fail(404, "Fichier non identifié");

        const idSource = fichier.idEspaces[0];
        if (idSource === idDest) return fail(409, "Le fichier se trouve déjà dans cet espace.");

        const espaceDest = await prisma.espaceStockage.findFirst({ where: { idEspace: idDest, idUtilisateur: idUser } });
        if (!espaceDest) return fail(404, "Espace de destination introuvable");
        if (espaceDest.tailleOccupee + fichier.tailleFichier > espaceDest.tailleEspace) {
            return fail(413, "Espace de destination insuffisant.");
        }

        const srcAbs = resolveUploadPath(fichier.cheminFichier);
        if (!fs.existsSync(srcAbs)) return fail(404, "Le fichier physique est introuvable sur le serveur.");

        const existants = await prisma.fichier.findMany({
            where: { idUtilisateur: idUser, idEspaces: { has: idDest }, dateSuppression: null },
            select: { nomFichier: true },
        });
        const nomFinal = nomDisponible(fichier.nomFichier, new Set(existants.map((f) => f.nomFichier)), NAME_MAX_LENGTH);

        // 1. Déplacement physique (nom physique conservé, sauf collision improbable)
        const destDir = resolveUploadPath(espaceDest.cheminEspace);
        let filename = path.basename(fichier.cheminFichier);
        if (fs.existsSync(path.join(destDir, filename))) filename = nouveauNomPhysique(path.extname(filename));
        const destAbs = path.join(destDir, filename);
        await fs.promises.mkdir(destDir, { recursive: true });
        await moveFile(srcAbs, destAbs);

        // 2. Base de données, atomique ; en cas d'échec le fichier est remis à sa place
        try {
            return await prisma.$transaction(async (tx) => {
                const reserve = await tx.espaceStockage.updateMany({
                    where: { idEspace: idDest, tailleOccupee: { lte: espaceDest.tailleEspace - fichier.tailleFichier } },
                    data: { tailleOccupee: { increment: fichier.tailleFichier } },
                });
                if (reserve.count === 0) throw new QuotaError();
                await tx.espaceStockage.update({ where: { idEspace: idDest }, data: { idFichiers: { push: idFichier } } });

                const source = idSource ? await tx.espaceStockage.findUnique({ where: { idEspace: idSource } }) : null;
                if (source) {
                    await tx.espaceStockage.update({
                        where: { idEspace: source.idEspace },
                        data: {
                            tailleOccupee: Math.max(0, source.tailleOccupee - fichier.tailleFichier),
                            idFichiers: source.idFichiers.filter((id) => id !== idFichier),
                        },
                    });
                }

                const deplace = await tx.fichier.update({
                    where: { idFichier },
                    data: {
                        idEspaces: [idDest],
                        cheminFichier: path.posix.join(espaceDest.cheminEspace, filename),
                        nomFichier: nomFinal,
                        dateModification: new Date(),
                    },
                });
                return { success: true as const, message: "Fichier déplacé avec succès", data: deplace };
            });
        } catch (error) {
            await moveFile(destAbs, srcAbs).catch((e:any) => console.error("Restauration du fichier impossible:", e));
            if (error instanceof QuotaError) return fail(413, "Espace de destination insuffisant.");
            throw error;
        }
    }
}