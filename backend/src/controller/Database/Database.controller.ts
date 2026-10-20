import { generateKey, randomBytes, randomUUID } from "crypto";
import type { BaseDeDonnees } from "../../generated/prisma/index.js";
import type { RequestResponse } from "../../model/index.ts";
import prisma from "../../config/prisma.config.ts";
import { decryptSecret, encryptSecret } from "../../utils/Crypto/crypto.utils.ts";
import {
    changePassword,
    containerName,
    DB_TYPES,
    enqueueProvision,
    getSpec,
    inspectState,
    isDockerAvailable,
    removeAll,
    reservePort,
    setEtat,
    startContainer,
    stopContainer,
    volumeName,
    waitReady,
    type Credentials,
    type DbTypeSpec,
} from "../../services/database.provisioner.service.ts";

const MAX_DB_PER_USER = 5;
const NAME_REGEX = /^[a-z][a-z0-9_]{2,29}$/;
const RESERVED_NAMES = new Set(["postgres", "template0", "template1", "mysql", "information_schema", "performance_schema", "sys", "admin", "local", "config", "test"]);

export type BaseDeDonneesPublic = Omit<BaseDeDonnees, "mdpBD" | "mdpAdminBD">;

export interface Connexion {
    type: string;
    hote: string;
    port: number | null;
    baseDeDonnees: string | null;
    utilisateur: string;
    motDePasse: string;
    url: string | null;
}

const fail = (status: number, message: string) => ({ success: false as const, status, message });

const toPublic = ({ mdpBD, mdpAdminBD, ...rest }: BaseDeDonnees): BaseDeDonneesPublic => rest;

// Mot de passe hexadécimal : sûr dans les URLs, les commandes et le SQL (ne commence jamais par « - »)
const newPassword = () => randomBytes(24).toString("hex");

const credsOf = (bd: BaseDeDonnees): Credentials => ({
    user: bd.userBD!,
    password: decryptSecret(bd.mdpBD)!,
    adminPassword: bd.mdpAdminBD!,
    database: bd.nomBase!,
});

const buildConnexion = (bd: BaseDeDonnees, spec: DbTypeSpec, creds: Credentials): Connexion => {
    const hote = process.env.DB_PUBLIC_HOST ?? "localhost";
    return {
        type: bd.typeBD,
        hote,
        port: bd.portHote,
        baseDeDonnees: bd.nomBase,
        utilisateur: bd.userBD,
        motDePasse: creds.password,
        url: bd.portHote ? spec.url(creds, hote, bd.portHote) : null,
    };
};

const findOwned = (idUser: string, idBD: string) => prisma.baseDeDonnees.findFirst({ where: { idBD, idUtilisateur: idUser } });

export default class DatabaseController {
    /** Catalogue des moteurs disponibles et de leurs versions. */
    static types() {
        return {
            success: true as const,
            data: Object.values(DB_TYPES).map((s) => ({
                type: s.type,
                label: s.label,
                versions: s.versions,
                versionParDefaut: s.defaultVersion,
                portInterne: s.internalPort,
                avecNomBase: s.hasDatabaseName,
            })),
        };
    }

    /**
     * Crée une base : enregistre la demande, réserve un port, puis lance en arrière-plan
     * téléchargement de l'image, création du volume et du conteneur. Réponse immédiate (202).
     */
    static async creer(idUser: string, body: { nomBD?: unknown; typeBD?: unknown; version?: unknown }) {
        const nom = typeof body?.nomBD === "string" ? body.nomBD.trim().toLowerCase() : "";
        const type = typeof body?.typeBD === "string" ? body.typeBD.trim().toLowerCase() : "postgresql";
        const spec = getSpec(type);

        if (!NAME_REGEX.test(nom)) return fail(400, "Nom invalide : 3 à 30 caractères, minuscules, chiffres ou _, commençant par une lettre.");
        if (RESERVED_NAMES.has(nom)) return fail(400, "Ce nom est réservé, choisissez-en un autre.");
        if (!spec) return fail(400, `Type non supporté (${Object.keys(DB_TYPES).join(", ")}).`);

        const version = typeof body?.version === "string" && body.version.trim() ? body.version.trim() : spec.defaultVersion;
        if (!spec.versions.includes(version)) return fail(400, `Version non supportée pour ${spec.label} (${spec.versions.join(", ")}).`);

        if (!(await isDockerAvailable())) return fail(503, "Docker est indisponible sur le serveur.");

        const [count, duplicate] = await Promise.all([
            prisma.baseDeDonnees.count({ where: { idUtilisateur: idUser } }),
            prisma.baseDeDonnees.findFirst({ where: { idUtilisateur: idUser, nomBD: nom } }),
        ]);
        if (count >= MAX_DB_PER_USER) return fail(403, `Limite de ${MAX_DB_PER_USER} bases de données atteinte.`);
        if (duplicate) return fail(409, "Vous avez déjà une base portant ce nom.");

        const idBD = randomUUID();
        const creds: Credentials = {
            user: `u_${idBD.replace(/-/g, "").slice(0, 12)}`,
            password: newPassword(),
            adminPassword: spec.separateAdminPassword ? newPassword():process.env.JWT_PASSWORD_ENCRYPTOR_KEY!.substring(0,10),
            database: spec.hasDatabaseName ? nom : null,
        };

        await prisma.baseDeDonnees.create({
            data: {
                idBD,
                nomBD: nom,
                typeBD: type,
                versionBD: version,
                nomBase: creds.database,
                userBD: creds.user,
                mdpBD: encryptSecret(creds.password),
                mdpAdminBD: creds.adminPassword ? encryptSecret(creds.adminPassword) : null,
                etatBD: "CREATION",
                messageEtat: "En attente de traitement.",
                imageDocker: `${spec.image}:${version}`,
                nomVolume: volumeName(idBD),
                nomConteneur: containerName(idBD),
                idUtilisateur: idUser,
            },
        });

        let portHote: number;
        try {
            portHote = await reservePort(idBD);
        } catch {
            await prisma.baseDeDonnees.delete({ where: { idBD } });
            return fail(503, "Aucun port disponible pour cette base.");
        }

        enqueueProvision({ idBD, idUtilisateur: idUser, spec, version, creds, portHote });

        const bd = await prisma.baseDeDonnees.findUniqueOrThrow({ where: { idBD } });
        return {
            success: true as const,
            status: 202,
            message: "Création lancée : suivez l'état via GET /database/{idBD} ou l'événement Socket.IO `database:etat`.",
            data: { baseDeDonnees: toPublic(bd), connexion: buildConnexion(bd, spec, creds) },
        };
    }

    static async lister(idUser: string): Promise<RequestResponse<BaseDeDonneesPublic[]>> {
        const bds = await prisma.baseDeDonnees.findMany({ where: { idUtilisateur: idUser }, orderBy: { dateCreation: "desc" } });
        return { success: true, data: bds.map(toPublic) };
    }

    /** Détail + connexion ; l'état est resynchronisé avec Docker (conteneur arrêté ou supprimé hors de l'API). */
    static async prendreParId(idUser: string, idBD: string) {
        let bd = await findOwned(idUser, idBD);
        if (!bd) return fail(404, "Base de données introuvable");

        if ((bd.etatBD === "EN_LIGNE" || bd.etatBD === "ARRETE") && (await isDockerAvailable())) {
            const st = await inspectState(idBD).catch(() => null);
            const ref = { idBD, idUtilisateur: idUser };
            if (st && !st.exists) await setEtat(ref, "ERREUR", "Conteneur introuvable.");
            else if (st?.running && bd.etatBD !== "EN_LIGNE") await setEtat(ref, "EN_LIGNE", null);
            else if (st && !st.running && bd.etatBD !== "ARRETE") await setEtat(ref, "ARRETE", "Conteneur arrêté.");
            bd = (await findOwned(idUser, idBD)) ?? bd;
        }

        const spec = getSpec(bd.typeBD)!;
        return { success: true as const, data: { baseDeDonnees: toPublic(bd), connexion: buildConnexion(bd, spec, credsOf(bd)) } };
    }

    static async arreter(idUser: string, idBD: string): Promise<RequestResponse<null>> {
        const bd = await findOwned(idUser, idBD);
        if (!bd) return fail(404, "Base de données introuvable");
        if (bd.etatBD !== "EN_LIGNE") return fail(409, "Seule une base en ligne peut être arrêtée.");
        if (!(await isDockerAvailable())) return fail(503, "Docker est indisponible sur le serveur.");

        await stopContainer(idBD);
        await setEtat({ idBD, idUtilisateur: idUser }, "ARRETE", "Arrêtée par l'utilisateur.");
        return { success: true, message: "Base de données arrêtée." };
    }

    static async demarrer(idUser: string, idBD: string): Promise<RequestResponse<null>> {
        const bd = await findOwned(idUser, idBD);
        if (!bd) return fail(404, "Base de données introuvable");
        if (bd.etatBD !== "ARRETE") return fail(409, "Seule une base arrêtée peut être démarrée.");
        if (!(await isDockerAvailable())) return fail(503, "Docker est indisponible sur le serveur.");

        const ref = { idBD, idUtilisateur: idUser };
        await startContainer(idBD);
        const ready = await waitReady(idBD, getSpec(bd.typeBD)!, credsOf(bd), false, 90_000);
        if (!ready.ok) {
            await setEtat(ref, "ERREUR", ready.reason ?? "La base n'a pas redémarré.");
            return fail(502, "La base n'a pas pu redémarrer (voir messageEtat).");
        }
        await setEtat(ref, "EN_LIGNE", null);
        return { success: true, message: "Base de données démarrée." };
    }

    static async reinitialiserMotDePasse(idUser: string, idBD: string) {
        const bd = await findOwned(idUser, idBD);
        if (!bd) return fail(404, "Base de données introuvable");
        if (bd.etatBD !== "EN_LIGNE") return fail(409, "La base doit être en ligne pour changer son mot de passe.");
        if (!(await isDockerAvailable())) return fail(503, "Docker est indisponible sur le serveur.");

        const spec = getSpec(bd.typeBD)!;
        const creds = credsOf(bd);
        const nouveau = newPassword();

        await changePassword({
            idBD,
            idUtilisateur: idUser,
            spec,
            version: bd.versionBD ?? spec.defaultVersion,
            creds,
            portHote: bd.portHote!,
            oldPassword: creds.password,
            newPassword: nouveau,
        });
        const maj = await prisma.baseDeDonnees.update({ where: { idBD }, data: { mdpBD: encryptSecret(nouveau) } });

        return {
            success: true as const,
            message: "Mot de passe réinitialisé.",
            data: { connexion: buildConnexion(maj, spec, { ...creds, password: nouveau }) },
        };
    }

    static async supprimer(idUser: string, idBD: string): Promise<RequestResponse<null>> {
        const bd = await findOwned(idUser, idBD);
        if (!bd) return fail(404, "Base de données introuvable");
        if (bd.etatBD === "CREATION") return fail(409, "La création est en cours : attendez sa fin avant de supprimer.");
        if (!(await isDockerAvailable())) return fail(503, "Docker est indisponible sur le serveur.");

        // D'abord conteneur + volume (en cas d'échec on garde l'enregistrement pour réessayer), puis la ligne
        await removeAll(idBD);
        await prisma.baseDeDonnees.delete({ where: { idBD } });
        return { success: true, message: "Base de données supprimée avec succès (données incluses)." };
    }
}
