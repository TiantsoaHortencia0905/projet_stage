import { BASE_URL } from "../config/api.config";
import { getToken, NETWORK_ERROR_MESSAGE, parseResponse, request } from "../lib/http";
import type { Fichier, ResponseApi } from "../interfaces";

/* ─── Lecture ─── */

/** Tous les fichiers de l'utilisateur connecté. */
export const listAllfiles = () => request<Fichier[]>("/fichier/all");

/** Fichiers d'un espace de stockage : actifs, ou archivés avec `archives = true`. */
export const listAllfilesBySpace = (idEspace: string, archives = false) =>
  request<Fichier[]>(`/fichier/espace/${idEspace}${archives ? "?archives=true" : ""}`);

export const getFileById = (idFichier: string) => request<Fichier>(`/fichier/${idFichier}`);

export interface UploadFormats {
  /** Extensions acceptées, par catégorie (images, videos, audio…). */
  extensions: Record<string, string[]>;
  /** Taille maximale d'un fichier, en octets. */
  tailleMax: number;
}

/** Formats acceptés par le serveur (source unique, vérifiée avant l'envoi). */
export const getUploadFormats = () => request<UploadFormats>("/fichier/formats");

/** URL publique du fichier (servi par le backend sous /uploads). */
export const fileUrl = (fichier: Pick<Fichier, "cheminFichier">) =>
  `${BASE_URL}/${fichier.cheminFichier.split("/").map(encodeURIComponent).join("/")}`;

/* ─── Écriture ─── */

/**
 * Upload multipart avec suivi de progression (XHR : fetch ne fournit pas la progression d'envoi).
 * Ne lève jamais d'exception.
 */
export const uploadFile = (
  fichier: File,
  idEspace: string,
  onProgress?: (ratio: number) => void,
): Promise<ResponseApi<Fichier>> =>
  new Promise((resolve) => {
    const formData = new FormData();
    // idEspace avant le fichier : le serveur peut le lire dès la réception du fichier
    formData.append("idEspace", idEspace);
    formData.append("fichier", fichier);

    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${BASE_URL}/fichier/ajout`);
    const token = getToken();
    if (token) xhr.setRequestHeader("Authorization", `Bearer ${token}`);

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress?.(event.loaded / event.total);
    };
    xhr.onload = () => resolve(parseResponse<Fichier>(xhr.status, xhr.responseText, !!token));
    xhr.onerror = () =>
      resolve({ success: false, status: 0, message: NETWORK_ERROR_MESSAGE, data: undefined as unknown as Fichier });
    xhr.send(formData);
  });

export const renameFile = (idFichier: string, nouveauNom: string) =>
  request<Fichier>(`/fichier/renommer/${idFichier}`, { method: "PUT", body: { nouveauNom: nouveauNom.trim() } });

export const deleteFile = (idFichier: string) =>
  request<Fichier>(`/fichier/supprimer/${idFichier}`, { method: "DELETE" });

/* ─── Archives ─── */

/** Archive le fichier : il reste dans son espace, figé, sans limite de durée. */
export const archiveFile = (idFichier: string) => request<Fichier>(`/fichier/${idFichier}/archiver`, { method: "POST" });

export const unarchiveFile = (idFichier: string) => request<Fichier>(`/fichier/${idFichier}/desarchiver`, { method: "POST" });

/* ─── Corbeille ─── */

export interface TrashItem extends Fichier {
  /** Date de mise à la corbeille. */
  dateSuppression: string;
  /** Suppression définitive automatique à cette date. */
  datePurge: string;
  nomEspace: string | null;
}

/** Met le fichier à la corbeille (restaurable). */
export const trashFile = (idFichier: string) => request<Fichier>(`/fichier/${idFichier}/corbeille`, { method: "POST" });

/** Remet le fichier dans son espace d'origine. */
export const restoreFile = (idFichier: string) => request<Fichier>(`/fichier/${idFichier}/restaurer`, { method: "POST" });

export const listTrash = () => request<{ retentionJours: number; items: TrashItem[] }>("/fichier/corbeille");

/** Supprime définitivement tout le contenu de la corbeille. */
export const emptyTrash = () => request<{ supprimes: number }>("/fichier/corbeille", { method: "DELETE" });

/* ─── Copier / Dupliquer / Déplacer ─── */

/** Copie un fichier dans un autre espace (nouveau fichier indépendant). */
export const copyFile = (idFichier: string, idEspaceDestination: string, nouveauNom?: string) =>
  request<Fichier>(`/fichier/${idFichier}/copier`, {
    method: "POST",
    body: { idEspaceDestination, ...(nouveauNom ? { nouveauNom } : {}) },
  });

/** Duplique un fichier dans son propre espace (« nom (copie).ext »). */
export const duplicateFile = (idFichier: string, nouveauNom?: string) =>
  request<Fichier>(`/fichier/${idFichier}/dupliquer`, {
    method: "POST",
    body: nouveauNom ? { nouveauNom } : {},
  });

/** Déplace un fichier vers un autre espace (même fichier, id conservé). */
export const moveFile = (idFichier: string, idEspaceDestination: string) =>
  request<Fichier>(`/fichier/${idFichier}/deplacer`, { method: "POST", body: { idEspaceDestination } });
