import { useEffect, useRef } from "react";

/** Exécute `callback` toutes les `intervalMs` tant que `active` est vrai (et que l'onglet est visible). */
export function usePolling(callback: () => void, active: boolean, intervalMs = 3000) {
  const callbackRef = useRef(callback);

  useEffect(() => {
    callbackRef.current = callback;
  });

  useEffect(() => {
    if (!active) return;
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") callbackRef.current();
    }, intervalMs);
    return () => clearInterval(timer);
  }, [active, intervalMs]);
}
