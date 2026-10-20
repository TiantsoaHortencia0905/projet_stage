import { BASE_URL } from "../config/api.config";
import type { ResponseApi } from "../interfaces";

/** Émis quand le serveur refuse le token (expiré, révoqué) : l'AuthProvider déconnecte. */
export const SESSION_EXPIRED_EVENT = "archicloud:session-expired";

export const NETWORK_ERROR_MESSAGE =
  "Impossible de joindre le serveur. Vérifiez votre connexion et réessayez.";

const STATUS_MESSAGES: Record<number, string> = {
  400: "La requête est invalide.",
  401: "Votre session a expiré. Veuillez vous reconnecter.",
  403: "Vous n'avez pas l'autorisation d'effectuer cette action.",
  404: "Ressource introuvable.",
  409: "Cette opération entre en conflit avec l'état actuel.",
  413: "Le fichier est trop volumineux.",
  429: "Trop de requêtes. Patientez quelques instants.",
  503: "Service momentanément indisponible.",
};

export const messageForStatus = (status: number): string =>
  STATUS_MESSAGES[status] ??
  (status >= 500
    ? "Une erreur est survenue sur le serveur. Réessayez plus tard."
    : "Une erreur inattendue est survenue.");

const failure = <T>(status: number, message: string): ResponseApi<T> => ({
  success: false,
  status,
  message,
  data: undefined as T,
});

export const getToken = () => localStorage.getItem("token");

interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  /** false pour les routes publiques (login, register…) : pas d'en-tête Authorization. */
  auth?: boolean;
}

/**
 * Appel à l'API ArchiCloud. Ne lève jamais d'exception : renvoie toujours un
 * `ResponseApi`, avec `success: false` et un message lisible en cas d'échec
 * (réseau coupé, réponse non JSON, erreur serveur…).
 */
export async function request<T>(
  path: string,
  { method = "GET", body, auth = true }: RequestOptions = {},
): Promise<ResponseApi<T>> {
  const headers: Record<string, string> = { Accept: "application/json" };
  const isForm = body instanceof FormData;
  if (body !== undefined && !isForm) headers["Content-Type"] = "application/json";

  const token = getToken();
  if (auth && token) headers.Authorization = `Bearer ${token}`;

  let res: Response;
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : isForm ? (body as FormData) : JSON.stringify(body),
    });
  } catch {
    return failure(0, NETWORK_ERROR_MESSAGE);
  }

  return parseResponse<T>(res.status, await res.text(), auth && !!token);
}

/** Transforme une réponse brute en `ResponseApi` (partagé avec l'upload XHR). */
export function parseResponse<T>(status: number, text: string, authenticated: boolean): ResponseApi<T> {
  if (status === 401 && authenticated) {
    window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
  }

  let payload: Partial<ResponseApi<T>> | null = null;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = null;
  }

  if (!payload || typeof payload.success !== "boolean") {
    return failure(status, status >= 200 && status < 300 ? "Réponse inattendue du serveur." : messageForStatus(status));
  }

  return {
    ...payload,
    status,
    message: payload.message ?? (payload.success ? undefined : messageForStatus(status)),
  } as ResponseApi<T>;
}
