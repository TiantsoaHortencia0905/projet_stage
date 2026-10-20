import { request } from "../lib/http";
import type { Espace } from "../interfaces";

export const listEspace = (idUser: string) => request<Espace[]>(`/espace/all/${idUser}`);

export const newSpace = (spaceName: string, idUser: string) =>
  request<Espace>(`/espace/new/${idUser}`, { method: "POST", body: { nomEspace: spaceName.trim() } });

export const renameSpace = (idEspace: string, newName: string) =>
  request<Espace>(`/espace/rename/${idEspace}`, { method: "PATCH", body: { newName: newName.trim() } });

export const SupprSpace = (idEspace: string) =>
  request<null>(`/espace/delete/${idEspace}`, { method: "DELETE" });

export const GetSpace = (idEspace: string) => request<Espace>(`/espace/id/${idEspace}`);
