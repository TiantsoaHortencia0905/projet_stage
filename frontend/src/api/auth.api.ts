import { request } from "../lib/http";
import type { LoginData, Session, SignupData, UserData } from "../interfaces";

export type OAuthProvider = "github" | "google";

export const sendSignupCredentials = (registerData: SignupData) =>
  request<{ user: UserData }>("/auth/register", {
    method: "POST",
    auth: false,
    body: {
      nomUtilisateur: registerData.nomUtilisateur.trim(),
      surnomUtilisateur: registerData.surnomUtilisateur.trim(),
      mailUtilisateur: registerData.mailUtilisateur.trim(),
      mdpUtilisateur: registerData.mdpUtilisateur,
      typeUtilisateur: "USER",
    },
  });

export const sendLoginCredentials = (loginData: LoginData) =>
  request<Session>("/auth/login", {
    method: "POST",
    auth: false,
    body: { email: loginData.email.trim(), password: loginData.password },
  });

export const confirmLogoutAction = () => request<null>("/auth/logout", { method: "POST" });

export const verifyUserName = (username: string) =>
  request<null>(`/auth/verify_username/${encodeURIComponent(username)}`, { auth: false });

/** URL d'autorisation du fournisseur OAuth (échoue proprement si non configuré sur le serveur). */
export const getOAuthUrl = (provider: OAuthProvider) =>
  request<{ url: string }>(`/oauth/${provider}?mode=json`, { auth: false });

/** Échange le code à usage unique reçu après l'OAuth contre une session. */
export const exchangeOAuthCode = (code: string) =>
  request<Session>("/oauth/exchange", { method: "POST", auth: false, body: { code } });
