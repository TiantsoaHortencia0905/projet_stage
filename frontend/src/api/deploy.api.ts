import { request } from "../lib/http";
import type { Deploiement, DeploiementDetail, EtatDeploiement, Paginated, Projet } from "../interfaces";

export interface PayloadDeployGithub {
  /** « proprietaire/nom » */
  depot: string;
  branche: string;
  nomProjet?: string;
  port?: number;
  commandeInstallation?: string;
  commandeDemarrage?: string;
  commandeTest?: string;
  variablesEnv?: Record<string, string>;
}

export const deployFromGithub = (payload: PayloadDeployGithub) =>
  request<{ projet: Projet; deploiement: Deploiement }>("/deploiement/github", { method: "POST", body: payload });

export const listDeployments = (params?: { page?: number; limit?: number; idProjet?: string; etat?: EtatDeploiement }) => {
  const search = new URLSearchParams();
  if (params?.page) search.set("page", String(params.page));
  if (params?.limit) search.set("limit", String(params.limit));
  if (params?.idProjet) search.set("idProjet", params.idProjet);
  if (params?.etat) search.set("etat", params.etat);
  return request<Paginated<Deploiement>>(`/deploiement/all?${search}`);
};

export const getDeploymentById = (id: string) => request<DeploiementDetail>(`/deploiement/${id}`);

export const stopDeployment = (id: string) => request<null>(`/deploiement/${id}/arreter`, { method: "POST" });

export const startDeployment = (id: string) => request<null>(`/deploiement/${id}/demarrer`, { method: "POST" });

export const deleteDeployment = (id: string) => request<null>(`/deploiement/${id}`, { method: "DELETE" });

export interface DeployConfig {
  branche: string | null;
  port: number | null;
  commandeInstallation: string | null;
  commandeDemarrage: string | null;
  commandeTest: string | null;
  variablesEnv: Record<string, string>;
}

/** Configuration utilisée par les prochains (re)déploiements du projet. */
export const getDeployConfig = (idProjet: string) => request<DeployConfig>(`/deploiement/configuration/${idProjet}`);

export const updateDeployConfig = (idProjet: string, config: DeployConfig) =>
  request<null>(`/deploiement/configuration/${idProjet}`, { method: "PUT", body: config });

export const redeployProject =(idProjet: string) =>
  request<{ deploiement: Deploiement }>(`/deploiement/redeployer/${idProjet}`, { method: "POST" });
