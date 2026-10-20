/** Présentation des moteurs proposés par l'API (/database/types). */
export const ENGINE_INFO: Record<string, { short: string; description: string; color: string }> = {
  postgresql: { short: "Pg", description: "Relationnelle, robuste et polyvalente.", color: "#336791" },
  mysql: { short: "My", description: "Relationnelle, la plus répandue sur le web.", color: "#00758f" },
  mariadb: { short: "Ma", description: "Alternative open source compatible MySQL.", color: "#8a5a2b" },
  mongodb: { short: "Mo", description: "Orientée documents, schéma flexible.", color: "#3f8a3a" },
  redis: { short: "Re", description: "Clé-valeur en mémoire : cache, files, sessions.", color: "#c6302b" },
};

export const engineInfo = (type: string) =>
  ENGINE_INFO[type.toLowerCase()] ?? { short: type.slice(0, 2), description: "", color: "var(--neutral)" };
