import { request } from "../lib/http";
import type { HealthEvaluation, LogEntry, Paginated } from "../interfaces";

export const listDeploymentLogs = (idDeploiement: string, params: { page?: number; limit?: number; q?: string } = {}) => {
  const search = new URLSearchParams();
  if (params.page) search.set("page", String(params.page));
  if (params.limit) search.set("limit", String(params.limit));
  if (params.q) search.set("q", params.q);
  return request<Paginated<LogEntry>>(`/logs/deploiement/${idDeploiement}?${search}`);
};

export const evaluateDeployment = (idDeploiement: string, minutes = 15) =>
  request<HealthEvaluation>(`/logs/evaluer/${idDeploiement}?minutes=${minutes}`);
