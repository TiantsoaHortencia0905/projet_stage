import { request } from "../lib/http";
import type { Paginated } from "../interfaces";

export type AlertPriority = "BASSE" | "MOYENNE" | "HAUTE" | "CRITIQUE";

export interface Alerte {
  idAlerte: string;
  titreAlerte: string;
  /** Date ISO. */
  dateAlerte: string;
  prioriteAlerte: AlertPriority;
  /** Alerte prise en compte par l'utilisateur. */
  validationAlerte: boolean;
  alerteResolu: boolean;
  idDeploiement: string;
  deploiement?: { idDeploiement: string; projet: { idProjet: string; nomProjet: string } };
}

export const listAlerts = (params: { idDeploiement?: string; resolues?: boolean; limit?: number; page?: number } = {}) => {
  const search = new URLSearchParams();
  if (params.idDeploiement) search.set("idDeploiement", params.idDeploiement);
  if (params.resolues !== undefined) search.set("alerteResolu", String(params.resolues));
  if (params.limit) search.set("limit", String(params.limit));
  if (params.page) search.set("page", String(params.page));
  return request<Paginated<Alerte>>(`/alerte?${search}`);
};

/** Marque une alerte comme résolue (et prise en compte) ou la rouvre. */
export const setAlertResolved = (idAlerte: string, resolue: boolean) =>
  request<Alerte>(`/alerte/${idAlerte}`, {
    method: "PATCH",
    body: resolue ? { alerteResolu: true, validationAlerte: true } : { alerteResolu: false },
  });
