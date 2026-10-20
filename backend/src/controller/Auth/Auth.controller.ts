import type {
    LoginPayload,
    LoginResponse,
    RequestResponse,
    UserProfile,
} from "../../model/index.ts";
import type { Utilisateur } from "../../generated/prisma/index.js";
import { compare, hash } from "bcrypt";
import jwt from "jsonwebtoken";
import prisma from "../../config/prisma.config.ts";

const { sign } = jwt;

const JWT_EXPIRES_IN = "1h";
const BCRYPT_ROUNDS = 12;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SURNOM_REGEX = /^[a-zA-Z0-9_.-]{3,30}$/;
/** Types qu'un visiteur peut s'attribuer à l'inscription (jamais ADMIN). */
const SELF_REGISTER_TYPES = ["USER"];
const DEFAULT_USER_TYPE = "USER";

const toProfile = (u: Utilisateur): UserProfile => ({
    id: u.idUtilisateur,
    nom: u.nomUtilisateur,
    surnom: u.surnomUtilisateur,
    email: u.mailUtilisateur,
    type: u.typeUtilisateur,
});

const str = (v: unknown): string => (typeof v === "string" ? v.trim() : "");

export default class AuthController {
    static async login(credentials: LoginPayload): Promise<LoginResponse> {
        const email = str(credentials?.email).toLowerCase();
        const password = typeof credentials?.password === "string" ? credentials.password : "";

        if (!email || !password) {
            return { success: false, status: 400, message: "Email et mot de passe requis." };
        }

        const utilisateur = await prisma.utilisateur.findUnique({
            where: { mailUtilisateur: email },
        });

        // Même message dans les 2 cas : on ne révèle pas si l'email existe.
        const passwordMatch = utilisateur
            ? await compare(password, utilisateur.mdpUtilisateur)
            : false;

        if (!utilisateur || !passwordMatch) {
            return { success: false, status: 401, message: "Identifiants invalides" };
        }

        const token = sign(
            {
                userId: utilisateur.idUtilisateur,
                email: utilisateur.mailUtilisateur,
                nom: utilisateur.nomUtilisateur,
                type: utilisateur.typeUtilisateur,
            },
            process.env.JWT_PASSWORD_ENCRYPTOR_KEY!,
            { algorithm: "HS256", expiresIn: JWT_EXPIRES_IN },
        );

        return {
            success: true,
            message: "Connexion réussie",
            data: { token, user: toProfile(utilisateur) },
        };
    }

    static async register(
        informations: Partial<Utilisateur>,
    ): Promise<RequestResponse<{ user: UserProfile }>> {
        const nom = str(informations?.nomUtilisateur);
        const surnom = str(informations?.surnomUtilisateur);
        const email = str(informations?.mailUtilisateur).toLowerCase();
        const password =
            typeof informations?.mdpUtilisateur === "string" ? informations.mdpUtilisateur : "";
        const type = str(informations?.typeUtilisateur) || DEFAULT_USER_TYPE;

        if (!nom || !surnom || !email || !password) {
            return { success: false, status: 400, message: "Nom, surnom, email et mot de passe sont requis." };
        }
        if (!EMAIL_REGEX.test(email)) {
            return { success: false, status: 400, message: "Adresse e-mail invalide." };
        }
        if (!SURNOM_REGEX.test(surnom)) {
            return {
                success: false,
                status: 400,
                message: "Surnom invalide (3 à 30 caractères : lettres, chiffres, _ . -).",
            };
        }
        if (password.length < 8) {
            return { success: false, status: 400, message: "Le mot de passe doit contenir au moins 8 caractères." };
        }
        if (!SELF_REGISTER_TYPES.includes(type)) {
            return { success: false, status: 403, message: "Ce type de compte ne peut pas être créé par inscription." };
        }

        const [emailTaken, surnomTaken] = await Promise.all([
            prisma.utilisateur.findUnique({ where: { mailUtilisateur: email } }),
            prisma.utilisateur.findUnique({ where: { surnomUtilisateur: surnom } }),
        ]);
        if (emailTaken) {
            return { success: false, status: 409, message: "Cette adresse e-mail a déjà un compte existant." };
        }
        if (surnomTaken) {
            return { success: false, status: 409, message: "Surnom déjà utilisé" };
        }

        try {
            const newUser = await prisma.utilisateur.create({
                data: {
                    nomUtilisateur: nom,
                    surnomUtilisateur: surnom,
                    mailUtilisateur: email,
                    typeUtilisateur: type,
                    // BUG corrigé : le 2e argument de bcrypt.hash est le nombre de tours (ou un salt bcrypt),
                    // pas la clé secrète du JWT.
                    mdpUtilisateur: await hash(password, BCRYPT_ROUNDS),
                },
            });
            return {
                success: true,
                status: 201,
                message: "Compte créé avec succès",
                data: { user: toProfile(newUser) },
            };
        } catch (error: any) {
            // Course critique entre 2 inscriptions simultanées (contrainte unique)
            if (error?.code === "P2002") {
                return { success: false, status: 409, message: "Email ou surnom déjà utilisé." };
            }
            throw error;
        }
    }

    static async verifyUsername(username: string): Promise<RequestResponse<null>> {
        const surnom = str(username);
        if (!SURNOM_REGEX.test(surnom)) {
            return { success: false, status: 400, message: "Surnom invalide (3 à 30 caractères : lettres, chiffres, _ . -)." };
        }
        // BUG corrigé : l'ancien try/catch renvoyait "Surnom valide" sur N'IMPORTE QUELLE erreur (ex: DB down).
        const existing = await prisma.utilisateur.findUnique({
            where: { surnomUtilisateur: surnom },
            select: { idUtilisateur: true },
        });
        if (existing) {
            return { success: false, status: 409, message: "Surnom déjà utilisé" };
        }
        return { success: true, message: "Surnom valide" };
    }

    /** Révoque le token courant (blacklist). */
    static async logout(token: string): Promise<RequestResponse<null>> {
        await prisma.blackListedTokens.create({ data: { token } });
        return { success: true, message: "Déconnexion réussie" };
    }
}