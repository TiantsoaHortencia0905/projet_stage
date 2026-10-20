// src/utils/Pagination/pagination.utils.ts
export const qs = (v: unknown): string | undefined =>
    typeof v === "string" && v.trim() !== "" ? v.trim() : undefined;

export const toPositiveInt = (v: unknown, def: number, max: number): number => {
    const n = Number.parseInt(String(v ?? ""), 10);
    return Number.isFinite(n) && n > 0 ? Math.min(n, max) : def;
};

/** undefined = non fourni, null = date invalide, Date = ok */
export const toDate = (v: unknown): Date | undefined | null => {
    const s = qs(v);
    if (!s) return undefined;
    const d = new Date(s);
    return Number.isNaN(d.getTime()) ? null : d;
};