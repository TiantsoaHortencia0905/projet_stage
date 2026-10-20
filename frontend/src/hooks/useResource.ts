import { useCallback, useEffect, useRef, useState } from "react";
import type { ResponseApi } from "../interfaces";

interface ResourceState<T> {
  data: T | undefined;
  error: string | null;
  /** Premier chargement (pas encore de données). */
  loading: boolean;
  /** Rechargement en arrière-plan (données déjà affichées). */
  refreshing: boolean;
  status?: number;
}

/**
 * Charge une ressource API et expose son état (chargement, erreur, rechargement).
 * Recharge quand `deps` change ; les réponses obsolètes sont ignorées.
 */
export function useResource<T>(fetcher: () => Promise<ResponseApi<T>>, deps: unknown[] = []) {
  const [state, setState] = useState<ResourceState<T>>({ data: undefined, error: null, loading: true, refreshing: false });
  const fetcherRef = useRef(fetcher);
  const requestId = useRef(0);

  useEffect(() => {
    fetcherRef.current = fetcher;
  });

  const apply = useCallback((res: ResponseApi<T>) => {
    setState((s) =>
      res.success
        ? { data: res.data, error: null, loading: false, refreshing: false, status: res.status }
        : { data: s.data, error: res.message ?? "Chargement impossible.", loading: false, refreshing: false, status: res.status },
    );
  }, []);

  useEffect(() => {
    const id = ++requestId.current;
    void fetcherRef.current().then((res) => {
      if (id === requestId.current) apply(res);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  /** Recharge ; `background` garde les données affichées pendant le chargement. */
  const reload = useCallback(
    async (background = false) => {
      const id = ++requestId.current;
      setState((s) => ({ ...s, loading: !background && s.data === undefined, refreshing: true }));
      const res = await fetcherRef.current();
      if (id === requestId.current) apply(res);
      return res;
    },
    [apply],
  );

  /** Met à jour les données localement (après une action réussie). */
  const mutate = useCallback((updater: (current: T | undefined) => T | undefined) => {
    setState((s) => ({ ...s, data: updater(s.data) }));
  }, []);

  return { ...state, reload, mutate };
}

export type Resource<T> = ReturnType<typeof useResource<T>>;
