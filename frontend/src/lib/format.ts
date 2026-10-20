const UNITS = ["o", "Ko", "Mo", "Go", "To"];

/** 2147483648 → « 2 Go ». Les tailles de l'API sont en octets. */
export const formatBytes = (bytes: number | null | undefined, digits = 1): string => {
  if (bytes === null || bytes === undefined || !Number.isFinite(bytes) || bytes <= 0) return "0 o";
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), UNITS.length - 1);
  const value = bytes / 1024 ** i;
  const rounded = i === 0 ? Math.round(value) : Number(value.toFixed(value >= 100 ? 0 : digits));
  return `${rounded.toLocaleString("fr-FR")} ${UNITS[i]}`;
};

export const percent = (value: number, max: number): number =>
  max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;

const dateFmt = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", year: "numeric" });
const dateTimeFmt = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});
const timeFmt = new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });

const toDate = (value: string | Date | null | undefined): Date | null => {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
};

export const formatDate = (value: string | Date | null | undefined): string => {
  const d = toDate(value);
  return d ? dateFmt.format(d) : "—";
};

export const formatDateTime = (value: string | Date | null | undefined): string => {
  const d = toDate(value);
  return d ? dateTimeFmt.format(d) : "—";
};

export const formatTime = (value: string | Date | null | undefined): string => {
  const d = toDate(value);
  return d ? timeFmt.format(d) : "—";
};

const rtf = new Intl.RelativeTimeFormat("fr-FR", { numeric: "auto" });

/** « il y a 5 minutes », « hier »… */
export const formatRelative = (value: string | Date | null | undefined): string => {
  const d = toDate(value);
  if (!d) return "—";
  const seconds = Math.round((d.getTime() - Date.now()) / 1000);
  const abs = Math.abs(seconds);
  if (abs < 45) return "à l'instant";
  if (abs < 3600) return rtf.format(Math.round(seconds / 60), "minute");
  if (abs < 86400) return rtf.format(Math.round(seconds / 3600), "hour");
  if (abs < 86400 * 30) return rtf.format(Math.round(seconds / 86400), "day");
  return formatDate(d);
};

export const pluralize = (count: number, singular: string, plural = `${singular}s`) =>
  `${count.toLocaleString("fr-FR")} ${count > 1 ? plural : singular}`;

export const initials = (name: string | undefined | null): string =>
  (name ?? "")
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() || "?";

export const shortId = (id: string | null | undefined, length = 8) => (id ? id.slice(0, length) : "—");
