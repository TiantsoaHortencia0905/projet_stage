// src/utils/OAuth/google.utils.ts
// OAuth 2.0 / OpenID Connect Google (flux « authorization code »).
//
// Variables : GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET
//             GOOGLE_CALLBACK_URL  ex: http://localhost:3000/auth/oauth/google/callback
// Console Google Cloud : APIs & Services > Credentials > OAuth client ID (Web application),
// puis ajouter GOOGLE_CALLBACK_URL dans « Authorized redirect URIs ».
import axios, { AxiosError } from "axios";
import { createPublicKey, type KeyObject } from "crypto";
import jwt from "jsonwebtoken";
import { OAuthError, requireEnv, type OAuthProfile, type OAuthProvider } from "./oauth.common.utils.ts";

const AUTHORIZE_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const JWKS_URL = "https://www.googleapis.com/oauth2/v3/certs";
const ISSUERS: [string, string] = ["https://accounts.google.com", "accounts.google.com"];

const clientId = () => requireEnv("GOOGLE_CLIENT_ID");

// ───────── Clés de signature (JWKS) avec cache ─────────

type Jwk = { kid?: string; kty: string; [k: string]: unknown };
let jwksCache: { keys: Jwk[]; expires: number } | null = null;

const loadJwks = async (force: boolean): Promise<Jwk[]> => {
    if (!force && jwksCache && jwksCache.expires > Date.now()) return jwksCache.keys;
    const res = await axios.get<{ keys: Jwk[] }>(JWKS_URL, { timeout: 10_000 });
    const maxAge = /max-age=(\d+)/.exec(String(res.headers["cache-control"] ?? ""))?.[1];
    jwksCache = { keys: res.data.keys, expires: Date.now() + (maxAge ? Number(maxAge) : 3600) * 1000 };
    return jwksCache.keys;
};

export type KeyResolver = (kid: string) => Promise<KeyObject | null>;

const defaultResolver: KeyResolver = async (kid) => {
    // 2e essai avec rechargement : Google fait tourner ses clés
    for (const force of [false, true]) {
        const jwk = (await loadJwks(force)).find((k) => k.kid === kid);
        if (jwk) return createPublicKey({ key: jwk, format: "jwk" } as Parameters<typeof createPublicKey>[0]);
    }
    return null;
};

// ───────── Vérification de l'ID token ─────────

/**
 * Vérifie signature (RS256), émetteur, audience, expiration et nonce, puis normalise le profil.
 * `resolveKey` est injectable pour les tests.
 */
export const verifyGoogleIdToken = async (idToken: string, expectedNonce: string, resolveKey: KeyResolver = defaultResolver): Promise<OAuthProfile> => {
    const decoded = jwt.decode(idToken, { complete: true });
    const kid = decoded && typeof decoded !== "string" ? decoded.header.kid : undefined;
    if (!kid) throw new OAuthError(400, "ID token Google invalide.");

    const key = await resolveKey(kid);
    if (!key) throw new OAuthError(502, "Clé de signature Google introuvable.");

    let claims: string | jwt.JwtPayload;
    try {
        claims = jwt.verify(idToken, key, { algorithms: ["RS256"], audience: clientId(), issuer: ISSUERS });
    } catch {
        throw new OAuthError(400, "ID token Google invalide ou expiré.");
    }
    if (typeof claims === "string" || claims.nonce !== expectedNonce) throw new OAuthError(400, "ID token Google invalide (nonce).");

    const email = String(claims.email ?? "").toLowerCase();
    const verified = claims.email_verified === true || claims.email_verified === "true"; // ancien format : chaîne
    return {
        provider: "google",
        providerId: String(claims.sub),
        email,
        emailVerified: verified && email !== "",
        name: String(claims.name ?? claims.given_name ?? email.split("@")[0] ?? "Utilisateur"),
        avatarUrl: typeof claims.picture === "string" ? claims.picture : "",
    };
};

// ───────── Fournisseur ─────────

export const googleProvider: OAuthProvider = {
    name: "google",

    isConfigured: () => !!process.env.GOOGLE_CLIENT_ID && !!process.env.GOOGLE_CLIENT_SECRET && !!process.env.GOOGLE_CALLBACK_URL,

    buildAuthorizeUrl: (state, nonce) =>
        `${AUTHORIZE_URL}?${new URLSearchParams({
            client_id: clientId(),
            redirect_uri: requireEnv("GOOGLE_CALLBACK_URL"),
            response_type: "code",
            scope: "openid email profile",
            state,
            nonce,
            prompt: "select_account",
            access_type: "online",
        }).toString()}`,

    async fetchProfile(code, nonce) {
        let idToken: string;
        try {
            const { data } = await axios.post(
                TOKEN_URL,
                new URLSearchParams({
                    code,
                    client_id: clientId(),
                    client_secret: requireEnv("GOOGLE_CLIENT_SECRET"),
                    redirect_uri: requireEnv("GOOGLE_CALLBACK_URL"),
                    grant_type: "authorization_code",
                }).toString(),
                { headers: { "Content-Type": "application/x-www-form-urlencoded" }, timeout: 15_000 },
            );
            if (!data.id_token) throw new OAuthError(400, "Réponse Google sans ID token.");
            idToken = data.id_token as string;
        } catch (e) {
            if (e instanceof OAuthError) throw e;
            const status = (e as AxiosError).response?.status;
            throw new OAuthError(status === 400 || status === 401 ? 400 : 502, "Code d'autorisation Google invalide, expiré, ou Google injoignable.");
        }
        return verifyGoogleIdToken(idToken, nonce);
    },
};
