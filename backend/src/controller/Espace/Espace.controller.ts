import type { EspaceStockage } from "../../generated/prisma/index.js";
import type { RequestResponse } from "../../model/index.ts";
import { randomUUID } from "crypto";
import fs from "fs";
import path from "path";
import { defaultSpaceSize, resolveUploadPath } from "../../utils/Storage/storage.utils.ts";
import { PrismaClient } from "../../generated/prisma/index.js";

const prisma = new PrismaClient();

const NAME_MAX_LENGTH = 100;
const cleanName = (v: unknown): string => (typeof v === "string" ? v.trim() : "");

export default class Espacecontroller {
    static async createSpace(
        { idUser, nomEspace }: { idUser: string; nomEspace: string },
    ): Promise<RequestResponse<EspaceStockage>> {
        const nom = cleanName(nomEspace);
        if (!nom || nom.length > NAME_MAX_LENGTH) {
            return {
                success: false,
                status: 400,
                message: `Nom d'espace requis (${NAME_MAX_LENGTH} caractères maximum).`,
            };
        }

        const user = await prisma.utilisateur.findUnique({ where: { idUtilisateur: idUser } });
        if (!user) {
            return { success: false, status: 404, message: "Utilisateur introuvable" };
        }

        const duplicate = await prisma.espaceStockage.findFirst({
            where: { nomEspace: nom, idUtilisateur: idUser },
        });
        if (duplicate) {
            return { success: false, status: 409, message: "Nom d'espace de stockage déjà existant." };
        }

        // BUG corrigé : un dossier PAR ESPACE (avant : un seul dossier par utilisateur,
        // donc mkdirSync plantait au 2e espace et la suppression d'un espace effaçait tout).
        const idEspace = randomUUID();
        const cheminEspace = path.posix.join("uploads", idUser, idEspace);
        const absDir = resolveUploadPath(cheminEspace);
        fs.mkdirSync(absDir, { recursive: true });

        try {
            const espace = await prisma.espaceStockage.create({
                data: {
                    idEspace,
                    tailleEspace: defaultSpaceSize(),
                    tailleOccupee: 0,
                    idUtilisateur: idUser,
                    cheminEspace,
                    nomEspace: nom,
                },
            });
            return { success: true, status: 201, message: "Espace de stockage créé", data: espace };
        } catch (error) {
            fs.rmSync(absDir, { recursive: true, force: true });
            throw error;
        }
    }

    static async renameSpace(
        { idSpace, newName, idUser }: { idSpace: string; newName: string; idUser: string },
    ): Promise<RequestResponse<EspaceStockage>> {
        const nom = cleanName(newName);
        if (!nom || nom.length > NAME_MAX_LENGTH) {
            return {
                success: false,
                status: 400,
                message: `Nouveau nom requis (${NAME_MAX_LENGTH} caractères maximum).`,
            };
        }

        const espace = await prisma.espaceStockage.findFirst({
            where: { idEspace: idSpace, idUtilisateur: idUser },
        });
        if (!espace) {
            return { success: false, status: 404, message: "Espace de stockage non identifié." };
        }

        // BUG corrigé : la condition était inversée (`verifyName?.idEspace !== idSpace`
        // renvoyait une erreur même quand aucun doublon n'existait).
        const sameName = await prisma.espaceStockage.findFirst({
            where: { nomEspace: nom, idUtilisateur: idUser, NOT: { idEspace: idSpace } },
        });
        if (sameName) {
            return { success: false, status: 409, message: "Nom d'espace de stockage déjà existant." };
        }

        const updated = await prisma.espaceStockage.update({
            where: { idEspace: idSpace },
            data: { nomEspace: nom },
        });
        return { success: true, data: updated, message: "Espace de stockage renommé avec succès." };
    }

    static async deleteSpace(
        { idSpace, idUser }: { idSpace: string; idUser: string },
    ): Promise<RequestResponse<null>> {
        const espace = await prisma.espaceStockage.findFirst({
            where: { idEspace: idSpace, idUtilisateur: idUser },
        });
        if (!espace) {
            return { success: false, status: 404, message: "Espace de stockage non identifié." };
        }

        // 1. Base de données : fichiers de l'espace puis l'espace (atomique)
        await prisma.$transaction([
            prisma.fichier.deleteMany({
                where: { idUtilisateur: idUser, idEspaces: { has: idSpace } },
            }),
            prisma.espaceStockage.delete({ where: { idEspace: idSpace } }),
        ]);

        // 2. Disque : dossier de l'espace (force => pas d'erreur s'il n'existe plus)
        fs.rmSync(resolveUploadPath(espace.cheminEspace), { recursive: true, force: true });

        return { success: true, message: "Suppression réussie" };
    }

    static async listAllSpaces(idUser: string): Promise<RequestResponse<EspaceStockage[]>> {
        const espaces = await prisma.espaceStockage.findMany({
            where: { idUtilisateur: idUser },
            orderBy: { nomEspace: "asc" },
        });
        return { success: true, data: espaces };
    }

    /** Un utilisateur ne peut lire que ses propres espaces (un ADMIN peut passer idUser = undefined). */
    static async findById(
        idSpace: string,
        idUser?: string,
    ): Promise<RequestResponse<EspaceStockage>> {
        const espace = await prisma.espaceStockage.findFirst({
            where: { idEspace: idSpace, ...(idUser ? { idUtilisateur: idUser } : {}) },
        });
        if (!espace) {
            return { success: false, status: 404, message: "Espace de stockage introuvable" };
        }
        return { success: true, data: espace };
    }
}