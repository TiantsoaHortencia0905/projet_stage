import { useMemo, useState } from "react";

export const PAGE_SIZES = [10, 25, 50, 100] as const;
export type PageSize = (typeof PAGE_SIZES)[number];

const storageKey = (key: string) => `archicloud:pageSize:${key}`;

const readPageSize = (key: string): PageSize => {
  try {
    const n = Number(localStorage.getItem(storageKey(key)));
    return (PAGE_SIZES as readonly number[]).includes(n) ? (n as PageSize) : 10;
  } catch {
    return 10;
  }
};

/**
 * Pagination côté client d'une liste déjà chargée (et déjà filtrée / triée).
 * @param key      identifiant du tableau : mémorise le nombre de lignes choisi
 * @param resetKey quand cette valeur change (recherche, filtre…), on revient à la page 1
 */
export function usePagination<T>(items: T[], key: string, resetKey: unknown = null) {
  const [pageSize, setPageSizeState] = useState<PageSize>(() => readPageSize(key));
  const [state, setState] = useState({ page: 1, resetKey });

  const total = items.length;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  // Nouvelle recherche → page 1 ; page devenue vide (suppression) → dernière page existante
  const page = Math.min(state.resetKey === resetKey ? state.page : 1, pageCount);

  const pageItems = useMemo(() => items.slice((page - 1) * pageSize, page * pageSize), [items, page, pageSize]);

  const setPage = (p: number) => setState({ page: Math.max(1, Math.min(p, pageCount)), resetKey });

  const setPageSize = (size: PageSize) => {
    // Garde en vue le premier élément affiché
    const firstIndex = (page - 1) * pageSize;
    setPageSizeState(size);
    setState({ page: Math.floor(firstIndex / size) + 1, resetKey });
    try {
      localStorage.setItem(storageKey(key), String(size));
    } catch {
      /* stockage indisponible : le choix vaut pour la session */
    }
  };

  return { pageItems, page, pageSize, pageCount, total, setPage, setPageSize };
}

export type PaginationState = ReturnType<typeof usePagination<unknown>>;
