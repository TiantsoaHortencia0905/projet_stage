// src/utils/OAuth/github.utils.ts
// OAuth GitHub pour la CONNEXION / INSCRIPTION (identité uniquement : scopes `read:user user:email`).
// Distinct de services/github.service.ts, qui gère l'accès aux dépôts (scope `repo`) pour le déploiement.
//
// Variables : GITHUB_LOGIN_CLIENT_ID, GITHUB_LOGIN_CLIENT_SECRET (à défaut GITHUB_CLIENT_ID / GITHUB_CLIENT_SECRET)
//             GITHUB_LOGIN_CALLBACK_URL  ex: http://localhost:3000/auth/oauth/github/callback
// Une OAuth App GitHub n'accepte qu'une URL de callback : utilisez une seconde app si le flux de liaison
// (GITHUB_CALLBACK_URL) existe déjà.
import axios, { AxiosError } from "axios";
import { OAuthError, requireEnv, type OAuthProfile, type OAuthProvider } from "./oauth.common.utils.ts";

const AUTHORIZE_URL = "https://github.com/login/oauth/authorize";
const TOKEN_URL = "https://github.com/login/oauth/access_token";
const API = "https://api.github.com";

const clientId = () => process.env.GITHUB_LOGIN_CLIENT_ID ?? requireEnv("GITHUB_CLIENT_ID");
const clientSecret = () => process.env.GITHUB_LOGIN_CLIENT_SECRET ?? requireEnv("GITHUB_CLIENT_SECRET");
const callbackUrl = () => requireEnv("GITHUB_LOGIN_CALLBACK_URL");

const apiHeaders = (token: string) => ({
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "ArchiCloud",
});

const toOAuthError = (e: unknown): OAuthError => {
    if (e instanceof OAuthError) return e;
    const status = (e as AxiosError).response?.status;
    return new OAuthError(status === 401 || status === 403 ? 400 : 502, "Impossible de contacter GitHub ou jeton refusé.");
};

const exchangeCode = async (code: string): Promise<string> => {
    const { data } = await axios.post(
        TOKEN_URL,
        { client_id: clientId(), client_secret: clientSecret(), code, redirect_uri: callbackUrl() },
        { headers: { Accept: "application/json" }, timeout: 15_000 },
    );
    // GitHub répond 200 même en cas d'erreur (champ `error`)
    if (data.error || !data.access_token) throw new OAuthError(400, "Code d'autorisation GitHub invalide ou expiré.");
    return data.access_token as string;
};

/** Le jeton ne sert qu'à lire l'identité : on le révoque aussitôt (sans toucher à l'autorisation de l'app). */
const revokeToken = (token: string) =>
    axios
        .delete(`${API}/applications/${clientId()}/token`, {
            auth: { username: clientId(), password: clientSecret() },
            headers: { Accept: "application/vnd.github+json", "User-Agent": "ArchiCloud" },
            data: { access_token: token },
            timeout: 10_000,
        })
        .catch(() => undefined);

export const githubProvider: OAuthProvider = {
    name: "github",

    isConfigured: () =>
        !!(process.env.GITHUB_LOGIN_CLIENT_ID ?? process.env.GITHUB_CLIENT_ID) &&
        !!(process.env.GITHUB_LOGIN_CLIENT_SECRET ?? process.env.GITHUB_CLIENT_SECRET) &&
        !!process.env.GITHUB_LOGIN_CALLBACK_URL,

    buildAuthorizeUrl: (state) =>
        `${AUTHORIZE_URL}?${new URLSearchParams({
            client_id: clientId(),
            redirect_uri: callbackUrl(),
            scope: "read:user user:email",
            state,
            allow_signup: "true",
        }).toString()}`,

    // GitHub n'a pas de nonce (OAuth 2.0 pur) : le `state` signé suffit contre le CSRF.
    async fetchProfile(code): Promise<OAuthProfile> {
        let token: string | undefined;
        try {
            token = await exchangeCode(code);
            const [user, emails] = await Promise.all([
                axios.get<{ id: number; login: string; name: string | null; avatar_url: string }>(`${API}/user`, { headers: apiHeaders(token), timeout: 15_000 }),
                axios.get<{ email: string; primary: boolean; verified: boolean }[]>(`${API}/user/emails`, { headers: apiHeaders(token), timeout: 15_000 }),
            ]);

            // Seules les adresses VÉRIFIÉES par GitHub comptent (le champ `email` du profil public n'est pas fiable)
            const verified = emails.data.filter((e) => e.verified);
            const chosen = verified.find((e) => e.primary) ?? verified[0];

            return {
                provider: "github",
                providerId: String(user.data.id),
                email: (chosen?.email ?? "").toLowerCase(),
                emailVerified: !!chosen,
                name: user.data.name || user.data.login,
                username: user.data.login,
                avatarUrl: user.data.avatar_url,
            };
        } catch (e) {
            throw toOAuthError(e);
        } finally {
            if (token) void revokeToken(token);
        }
    },
};
