// src/utils/OAuth/oauth.common.utils.ts
// Types et helpers partagés par les fournisseurs OAuth (GitHub, Google).
import { randomBytes } from "crypto";
import jwt from "jsonwebtoken";

export type ProviderName = "github" | "google";

/** Identité normalisée renvoyée par n'importe quel fournisseur. */
export interface OAuthProfile {
    provider: ProviderName;
    providerId: string;
    email: string; // en minuscules
    /** Le fournisseur certifie que l'adresse e-mail appartient à l'utilisateur. */
    emailVerified: boolean;
    name: string;
    username?: string;
    avatarUrl?: string;
}

export interface OAuthProvider {
    readonly name: ProviderName;
    isConfigured(): boolean;
    buildAuthorizeUrl(state: string, nonce: string): string;
    /** Échange le `code` puis retourne le profil vérifié. Lève OAuthError. */
    fetchProfile(code: string, nonce: string): Promise<OAuthProfile>;
}

export class OAuthError extends Error {
    constructor(public readonly status: number, message: string) {
        super(message);
    }
}

export const requireEnv = (name: string): string => {
    const v = process.env[name];
    if (!v) throw new Error(`${name} non défini`);
    return v;
};

export const newNonce = (): string => randomBytes(16).toString("hex");

const secret = () => requireEnv("JWT_PASSWORD_ENCRYPTOR_KEY");

/**
 * `state` signé (10 min) : protège contre le CSRF et transporte le fournisseur + le nonce.
 * `purpose` le distingue des JWT de session et du state de liaison GitHub (`github-oauth`).
 */
export const createState = (provider: ProviderName, nonce: string): string =>
    jwt.sign({ purpose: "oauth-login", provider, nonce }, secret(), { algorithm: "HS256", expiresIn: "10m" });

export const readState = (state: string): { provider: ProviderName; nonce: string } => {
    let decoded: string | jwt.JwtPayload;
    try {
        decoded = jwt.verify(state, secret(), { algorithms: ["HS256"] });
    } catch {
        throw new OAuthError(400, "Session d'autorisation invalide ou expirée, recommencez.");
    }
    if (typeof decoded === "string" || decoded.purpose !== "oauth-login" || typeof decoded.nonce !== "string" || (decoded.provider !== "github" && decoded.provider !== "google")) {
        throw new OAuthError(400, "Session d'autorisation invalide.");
    }
    return { provider: decoded.provider, nonce: decoded.nonce };
};
