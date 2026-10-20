import { request } from "../lib/http";
import type { ConnexionDatabase, Database, DatabaseType, PayloadCreateDatabase } from "../interfaces";

export type DatabaseWithConnexion = {
  baseDeDonnees: Database;
  connexion: ConnexionDatabase;
};

/* ─── Lecture ─── */

export const listAllDatabases = () => request<Database[]>("/database/all");

export const getDatabaseById = (idDatabase: string) => request<DatabaseWithConnexion>(`/database/${idDatabase}`);

export const listDatabaseTypes = () => request<DatabaseType[]>("/database/types");

/* ─── Création (asynchrone côté serveur : la base démarre en état CREATION) ─── */

export const newDatabase = (payload: PayloadCreateDatabase) =>
  request<DatabaseWithConnexion>("/database/new", { method: "POST", body: payload });

/* ─── Cycle de vie ─── */

export const stopDatabase = (idDatabase: string) =>
  request<null>(`/database/${idDatabase}/arreter`, { method: "POST" });

export const startDatabase = (idDatabase: string) =>
  request<null>(`/database/${idDatabase}/demarrer`, { method: "POST" });

export const resetDatabasePassword = (idDatabase: string) =>
  request<{ connexion: ConnexionDatabase }>(`/database/${idDatabase}/reset-password`, { method: "POST" });

export const deleteDatabase = (idDatabase: string) =>
  request<null>(`/database/${idDatabase}`, { method: "DELETE" });
