import { hash } from "bcrypt";
import { randomBytes } from "crypto";
import jwt from "jsonwebtoken";
import type { Utilisateur } from "../../generated/prisma/index.js";
import type { LoginResponse, RequestResponse } from "../../model/index.ts";
import prisma from "../../config/prisma.config.ts";
import { githubProvider } from "../../utils/OAuth/github.utils.ts";
import { googleProvider } from "../../utils/OAuth/google.utils.ts";
import { createState, newNonce, OAuthError, readState, type OAuthProfile, type OAuthProvider, type ProviderName } from "../../utils/OAuth/oauth.common.utils.ts";

const PROVIDERS: Record<ProviderName, OAuthProvider> = { github: githubProvider, google: googleProvider };
const EXCHANGE_TTL_MS = 60_000;
const BCRYPT_ROUNDS = 12;

// Codes d'échange à usage unique (60 s) : le JWT ne transite jamais par l'URL de redirection.
// En mémoire => à remplacer par Redis si plusieurs instances du serveur tournent.
const exchangeCodes = new Map<string, { data: NonNullable<LoginResponse["data"]>; expires: number }>();

const pruneCodes = () => {
    const now = Date.now();
    for (const [k, v] of exchangeCodes) if (v.expires < now) exchangeCodes.delete(k);
};

const getProvider = (name: string): OAuthProvider | undefined => (name === "github" || name === "google" ? PROVIDERS[name] : undefined);

/** Même format de JWT que AuthController.login : le middleware d'authentification les traite à l'identique. */
const signSession = (u: Utilisateur): string =>
    jwt.sign(
        { userId: u.idUtilisateur, email: u.mailUtilisateur, nom: u.nomUtilisateur, type: u.typeUtilisateur },
        process.env.JWT_PASSWORD_ENCRYPTOR_KEY!,
        { algorithm: "HS256", expiresIn: "1h" },
    );

/** Surnom unique dérivé du profil (3-30 caractères : lettres, chiffres, _ . -). */
const candidateSurnoms = function* (p: OAuthProfile): Generator<string> {
    const base = (p.username ?? p.email.split("@")[0] ?? "user").replace(/[^a-zA-Z0-9_.-]/g, "").slice(0, 24).padEnd(3, "0");
    yield base;
    for (let i = 0; i < 8; i++) yield `${base}${Math.floor(1000 + Math.random() * 9000)}`;
};

const creerUtilisateur = async (p: OAuthProfile): Promise<Utilisateur> => {
    // Mot de passe aléatoire inconnu de tous : le compte ne se connecte que via le fournisseur (ou après « mot de passe oublié »)
    const mdp = await hash(randomBytes(32).toString("hex"), BCRYPT_ROUNDS);
    for (const surnom of candidateSurnoms(p)) {
        try {
            return await prisma.utilisateur.create({
                data: { nomUtilisateur: p.name.slice(0, 100), surnomUtilisateur: surnom, mailUtilisateur: p.email, typeUtilisateur: "USER", mdpUtilisateur: mdp },
            });
        } catch (error: any) {
            if (error?.code === "P2002" && String(error?.meta?.target ?? "").includes("surnom")) continue; // surnom pris : suivant
            throw error;
        }
    }
    throw new OAuthError(409, "Impossible de générer un surnom disponible.");
};

export default class OAuthController {
    /** Redirige (ou renvoie) vers la page d'autorisation du fournisseur. */
    static urlAutorisation(name: string): RequestResponse<{ url: string }> {
        const provider = getProvider(name);
        if (!provider) return { success: false, status: 404, message: "Fournisseur inconnu (github, google)." };
        if (!provider.isConfigured()) return { success: false, status: 503, message: `Connexion ${name} non configurée sur le serveur.` };

        const nonce = newNonce();
        return { success: true, data: { url: provider.buildAuthorizeUrl(createState(provider.name, nonce), nonce) } };
    }

    /**
     * Retour du fournisseur : vérifie le state, récupère le profil, retrouve / lie / crée le compte,
     * puis produit un code d'échange à usage unique.
     */
    static async callback(name: string, code: string | undefined, state: string | undefined): Promise<RequestResponse<{ codeEchange: string }>> {
        const provider = getProvider(name);
        if (!provider) return { success: false, status: 404, message: "Fournisseur inconnu." };
        if (!code || !state) return { success: false, status: 400, message: "Paramètres OAuth manquants." };

        try {
            const st = readState(state);
            if (st.provider !== provider.name) return { success: false, status: 400, message: "Fournisseur incohérent avec la session d'autorisation." };

            const profil = await provider.fetchProfile(code, st.nonce);
            if (!profil.emailVerified) {
                return { success: false, status: 403, message: `Votre compte ${name} n'a aucune adresse e-mail vérifiée : vérifiez-la chez ${name} puis réessayez.` };
            }

            const utilisateur = await OAuthController.resoudreUtilisateur(profil);

            pruneCodes();
            const codeEchange = randomBytes(24).toString("base64url");
            exchangeCodes.set(codeEchange, {
                expires: Date.now() + EXCHANGE_TTL_MS,
                data: {
                    token: signSession(utilisateur),
                    user: {
                        id: utilisateur.idUtilisateur,
                        nom: utilisateur.nomUtilisateur,
                        surnom: utilisateur.surnomUtilisateur,
                        email: utilisateur.mailUtilisateur,
                        type: utilisateur.typeUtilisateur,
                    },
                },
            });
            return { success: true, data: { codeEchange } };
        } catch (error) {
            if (error instanceof OAuthError) return { success: false, status: error.status, message: error.message };
            throw error;
        }
    }

    /** identité connue → son compte ; sinon e-mail vérifié déjà inscrit → on lie ; sinon on crée le compte. */
    private static async resoudreUtilisateur(p: OAuthProfile): Promise<Utilisateur> {
        const identite = await prisma.identiteOAuth.findUnique({
            where: { provider_providerId: { provider: p.provider, providerId: p.providerId } },
            include: { utilisateur: true },
        });
        if (identite) return identite.utilisateur;

        const utilisateur = (await prisma.utilisateur.findUnique({ where: { mailUtilisateur: p.email } })) ?? (await creerUtilisateur(p));
        try {
            await prisma.identiteOAuth.create({ data: { provider: p.provider, providerId: p.providerId, email: p.email, idUtilisateur: utilisateur.idUtilisateur } });
        } catch (error: any) {
            if (error?.code !== "P2002") throw error; // course entre deux callbacks simultanés : déjà lié, on continue
        }
        return utilisateur;
    }

    /** Échange le code à usage unique contre la session (même réponse que POST /auth/login). */
    static echanger(code: unknown): LoginResponse {
        if (typeof code !== "string" || !code) return { success: false, status: 400, message: "Code requis." };
        pruneCodes();
        const entry = exchangeCodes.get(code);
        exchangeCodes.delete(code); // usage unique, même en cas d'échec
        if (!entry || entry.expires < Date.now()) return { success: false, status: 400, message: "Code invalide ou expiré." };
        return { success: true, message: "Connexion réussie", data: entry.data };
    }
}
