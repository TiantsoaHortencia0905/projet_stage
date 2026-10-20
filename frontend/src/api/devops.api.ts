import { request } from "../lib/http";
import type { Paginated, ProjectParams, Projet } from "../interfaces";

export const listProjects = (params: ProjectParams = {}) => {
  const search = new URLSearchParams();
  if (params.page) search.set("page", String(params.page));
  if (params.limit) search.set("limit", String(params.limit));
  if (params.etat) search.set("etat", params.etat);
  if (params.q) search.set("q", params.q);
  return request<Paginated<Projet>>(`/projet/all?${search}`);
};

export const getProjectById = (idProjet: string) => request<Projet>(`/projet/${idProjet}`);

export const deleteProject = (idProjet: string) =>
  request<null>(`/projet/supprimer/${idProjet}`, { method: "DELETE" });
