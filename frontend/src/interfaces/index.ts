/* ─────────── Réponses API ─────────── */

export interface ResponseApi<T> {
  success: boolean;
  data: T;
  message?: string;
  /** Code HTTP (0 = serveur injoignable). */
  status?: number;
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}

/* ─────────── Authentification ─────────── */

export interface LoginData {
  email: string;
  password: string;
}

export interface UserData {
  id: string;
  nom: string;
  surnom: string;
  email: string;
  type: string;
}

export interface SignupData {
  nomUtilisateur: string;
  surnomUtilisateur: string;
  mailUtilisateur: string;
  mdpUtilisateur: string;
}

export interface Session {
  token: string;
  user: UserData;
}

/* ─────────── Stockage ─────────── */

export interface Espace {
  idEspace: string;
  nomEspace: string;
  /** Quota en octets. */
  tailleEspace: number;
  /** Espace utilisé en octets. */
  tailleOccupee: number;
  cheminEspace: string;
  idUtilisateur: string;
  idFichiers: string[];
}

export interface Fichier {
  idFichier: string;
  nomFichier: string;
  cheminFichier: string;
  /** Taille en octets. */
  tailleFichier: number;
  /** Type déclaré à l'envoi (ex. image/png). */
  typeMime?: string | null;
  dateCreation: string;
  /** Dernier renommage ou déplacement. */
  dateModification: string;
  /** Archivé à cette date (figé, conservé sans limite) ; null = non archivé. */
  dateArchivage?: string | null;
  idEspaces: string[];
  idUtilisateur: string;
  /** Responsable : auteur de l'ajout. */
  utilisateur?: { nomUtilisateur: string; surnomUtilisateur: string };
}

/* ─────────── Bases de données ─────────── */

export interface Database {
  idBD: string;
  nomBD: string;
  typeBD: string;
  userBD: string;
  dateCreation: string;
  idUtilisateur: string;
  versionBD: string | null;
  etatBD: "CREATION" | "EN_LIGNE" | "ARRETE" | "ERREUR";
  messageEtat: string | null;
  nomBase: string | null;
  imageDocker: string | null;
  nomConteneur: string | null;
  portHote: number | null;
}

export interface ConnexionDatabase {
  type: string;
  hote: string;
  port: number;
  baseDeDonnees: string | null;
  utilisateur: string;
  motDePasse: string;
  url: string;
}

export interface DatabaseType {
  type: string;
  label: string;
  versions: string[];
  versionParDefaut: string;
  portInterne: number;
  avecNomBase: boolean;
}

export interface PayloadCreateDatabase {
  nomBD: string;
  typeBD: string;
  version: string;
}

/* ─────────── Projets & déploiements ─────────── */

export type EtatProjet = "CREE" | "EN_COURS" | "DEPLOYE" | "ERREUR" | "ARRETE";

export type EtatDeploiement =
  | "EN_ATTENTE"
  | "CLONAGE"
  | "CONSTRUCTION"
  | "TESTS"
  | "DEMARRAGE"
  | "DEPLOYE"
  | "ERREUR"
  | "ARRETE";

export type EtatTests = "REUSSIS" | "ECHEC" | "AUCUN";

export interface ProjectParams {
  page?: number;
  limit?: number;
  q?: string;
  etat?: EtatProjet;
}

export interface Projet {
  idProjet: string;
  nomProjet: string;
  sourceProjet: string;
  etatProjet: EtatProjet;
  dateProjet: string;
  idUtilisateur: string;
  depotGithub: string | null;
  brancheProjet: string | null;
  typeStack: string | null;
  portApplication: number | null;
  commandeInstallation: string | null;
  commandeDemarrage: string | null;
  commandeTest?: string | null;
  _count?: { deploiements: number };
  deploiements?: Deploiement[];
}

export interface Deploiement {
  idDeploiement: string;
  idProjet: string;
  dateDeploiement: string;
  etatDeploiement: EtatDeploiement;
  messageEtat?: string | null;
  dateFin?: string | null;
  /** Résultat de l'étape de tests du pipeline (null : étape pas encore atteinte). */
  etatTests?: EtatTests | null;
  commitSha: string | null;
  branche: string | null;
  idConteneur: string | null;
  nomConteneur: string | null;
  imageDocker: string | null;
  portHote: number | null;
  urlDeploiement: string | null;
  _count?: { logs: number; alertes: number };
}

export interface DeploiementDetail extends Deploiement {
  projet: Pick<
    Projet,
    "idProjet" | "nomProjet" | "depotGithub" | "brancheProjet" | "typeStack" | "portApplication" | "etatProjet"
  >;
}

/* ─────────── Logs & santé ─────────── */

export interface LogEntry {
  idLog: string;
  objetLog: string;
  detailLog: string;
  dateLog: string;
  idDeploiement: string;
}

export interface HealthEvaluation {
  idDeploiement: string;
  fenetreMinutes: number;
  etat: "SAIN" | "DEGRADE" | "CRITIQUE";
  totalErreurs: number;
  erreursFenetre: number;
  parCategorie: { categorie: string; total: number }[];
  derniereErreur: LogEntry | null;
  alertesOuvertes: number;
  surveillanceActive: boolean;
}
