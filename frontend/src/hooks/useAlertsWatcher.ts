import { useEffect } from "react";
import { listAlerts, type Alerte } from "../api/alerts.api";
import { useToast } from "../redux/hooks/useToast";
import { alertsChanged, setOpenCount } from "../redux/slices/alertsSlice";
import { useAppDispatch, useAppSelector } from "../redux/store";
import { useSocketEvent } from "./useSocketEvent";

/**
 * À monter une seule fois (structure de l'application) : tient à jour le nombre d'alertes ouvertes
 * et notifie l'utilisateur de chaque nouvelle alerte reçue en temps réel.
 */
export function useAlertsWatcher() {
  const dispatch = useAppDispatch();
  const toast = useToast();
  const version = useAppSelector((s) => s.alerts.version);

  useEffect(() => {
    let active = true;
    void listAlerts({ resolues: false, limit: 1 }).then((res) => {
      if (active && res.success) dispatch(setOpenCount(res.data.total));
    });
    return () => {
      active = false;
    };
  }, [version, dispatch]);

  useSocketEvent<Alerte>("alerte:new", (alerte) => {
    const urgent = alerte.prioriteAlerte === "CRITIQUE" || alerte.prioriteAlerte === "HAUTE";
    (urgent ? toast.error : toast.warning)(`Alerte ${alerte.prioriteAlerte.toLowerCase()}`, alerte.titreAlerte);
    dispatch(alertsChanged());
  });
}
