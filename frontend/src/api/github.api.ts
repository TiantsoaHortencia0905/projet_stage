import { request } from "../lib/http";

export interface GithubStatus {
  connecte: boolean;
  tokenValide?: boolean;
  login?: string;
  avatarUrl?: string | null;
  emailVerifie?: boolean;
  emailPrincipal?: string | null;
  emailCorrespond?: boolean;
  scope?: string;
  dateLiaison?: string;
  dateVerification?: string;
}

export interface GithubRepo {
  id: number;
  nom: string;
  nomComplet: string;
  prive: boolean;
  fork: boolean;
  archive: boolean;
  brancheParDefaut: string;
  description: string | null;
  langage: string | null;
  url: string;
  tailleKo: number;
  dernierPush: string | null;
}

export interface GithubBranch {
  name: string;
  protected: boolean;
}

export const getGithubConnectUrl = () => request<{ url: string }>("/github/connect");

export const getGithubStatus = () => request<GithubStatus>("/github/status");

export const disconnectGithub = () => request<null>("/github/disconnect", { method: "DELETE" });

export const listGithubRepos = (page = 1, limit = 30) =>
  request<{ page: number; limit: number; pageSuivante: boolean; items: GithubRepo[] }>(
    `/github/repos?${new URLSearchParams({ page: String(page), limit: String(limit) })}`,
  );

export const listGithubBranches = (owner: string, repo: string) =>
  request<{ brancheParDefaut: string; branches: GithubBranch[] }>(
    `/github/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/branches`,
  );
