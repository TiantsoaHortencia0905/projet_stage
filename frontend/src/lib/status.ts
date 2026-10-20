import type { Database, EtatDeploiement, EtatTests } from "../interfaces";

export type Tone = "success" | "warning" | "danger" | "info" | "neutral";

export interface StatusInfo {
  label: string;
  tone: Tone;
  /** État transitoire : le badge pulse. */
  pending?: boolean;
}

export const DATABASE_STATUS: Record<Database["etatBD"], StatusInfo> = {
  CREATION: { label: "Création", tone: "info", pending: true },
  EN_LIGNE: { label: "En ligne", tone: "success" },
  ARRETE: { label: "Arrêtée", tone: "neutral" },
  ERREUR: { label: "Erreur", tone: "danger" },
};

export const DEPLOYMENT_STATUS: Record<EtatDeploiement, StatusInfo> = {
  EN_ATTENTE: { label: "En file d'attente", tone: "info", pending: true },
  CLONAGE: { label: "Clonage", tone: "info", pending: true },
  CONSTRUCTION: { label: "Build", tone: "info", pending: true },
  TESTS: { label: "Tests", tone: "info", pending: true },
  DEMARRAGE: { label: "Démarrage", tone: "info", pending: true },
  DEPLOYE: { label: "En ligne", tone: "success" },
  ERREUR: { label: "Échec", tone: "danger" },
  ARRETE: { label: "Arrêté", tone: "neutral" },
};

export const DEPLOYMENT_STEPS: { etat: EtatDeploiement; label: string }[] = [
  { etat: "EN_ATTENTE", label: "File d'attente" },
  { etat: "CLONAGE", label: "Clonage du dépôt" },
  { etat: "CONSTRUCTION", label: "Build de l'image" },
  { etat: "TESTS", label: "Tests" },
  { etat: "DEMARRAGE", label: "Démarrage" },
  { etat: "DEPLOYE", label: "En ligne" },
];

export const TRANSIENT_DEPLOYMENT_STATES: EtatDeploiement[] = ["EN_ATTENTE", "CLONAGE", "CONSTRUCTION", "TESTS", "DEMARRAGE"];

/** Résultat de l'étape de tests. */
export const TESTS_STATUS: Record<EtatTests, StatusInfo> = {
  REUSSIS: { label: "Tests réussis", tone: "success" },
  ECHEC: { label: "Tests en échec", tone: "danger" },
  AUCUN: { label: "Aucun test", tone: "warning" },
};

export const isDeploymentPending = (etat: string) =>
  (TRANSIENT_DEPLOYMENT_STATES as string[]).includes(etat);

export const HEALTH_STATUS: Record<"SAIN" | "DEGRADE" | "CRITIQUE", StatusInfo> = {
  SAIN: { label: "Sain", tone: "success" },
  DEGRADE: { label: "Dégradé", tone: "warning" },
  CRITIQUE: { label: "Critique", tone: "danger" },
};

export const databaseStatus = (etat: string): StatusInfo =>
  DATABASE_STATUS[etat as Database["etatBD"]] ?? { label: etat, tone: "neutral" };

export const deploymentStatus = (etat: string): StatusInfo =>
  DEPLOYMENT_STATUS[etat as EtatDeploiement] ?? { label: etat, tone: "neutral" };
