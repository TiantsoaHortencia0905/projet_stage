// src/components/contexts/AuthContext.tsx
import { createContext, type ReactNode, useCallback, useContext, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { confirmLogoutAction } from "../../api/auth.api";
import { disconnectSocket } from "../../api/socket";
import { SESSION_EXPIRED_EVENT } from "../../lib/http";
import { useToast } from "../../redux/hooks/useToast";
import type { Session, UserData } from "../../interfaces";

// ─── Types ────────────────────────────────────────────────────────────────────

interface AuthState {
  user: UserData | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

interface AuthContextType extends AuthState {
  /** Ouvre la session puis redirige vers la page demandée avant connexion (ou le tableau de bord). */
  login: (session: Session) => void;
  logout: () => Promise<void>;
}

// ─── Constantes ───────────────────────────────────────────────────────────────

const TOKEN_KEY = "token";
const USER_KEY = "userDetails";

/** Durée d'inactivité avant déconnexion automatique : 15 minutes */
const INACTIVITY_LIMIT_MS = 15 * 60 * 1000;

/** Événements considérés comme une "interaction" utilisateur */
const ACTIVITY_EVENTS: (keyof WindowEventMap)[] = ["mousedown", "keydown", "scroll", "touchstart"];

/** Date d'expiration du JWT (ms), ou null si illisible. */
const tokenExpiry = (token: string): number | null => {
  try {
    const payload = JSON.parse(atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
    return typeof payload.exp === "number" ? payload.exp * 1000 : null;
  } catch {
    return null;
  }
};

const readStoredSession = (): Session | null => {
  const token = localStorage.getItem(TOKEN_KEY);
  const rawUser = localStorage.getItem(USER_KEY);
  if (!token || !rawUser) return null;
  const exp = tokenExpiry(token);
  if (!exp || exp <= Date.now()) return null;
  try {
    return { token, user: JSON.parse(rawUser) as UserData };
  } catch {
    return null;
  }
};

const clearStoredSession = () => {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  localStorage.removeItem("user"); // ancienne clé
};

// ─── Context ──────────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextType | null>(null);

// eslint-disable-next-line react-refresh/only-export-components -- hook indissociable de son provider
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth doit être utilisé à l'intérieur de AuthProvider");
  }
  return context;
};

// ─── Provider ─────────────────────────────────────────────────────────────────

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();

  const [state, setState] = useState<AuthState>(() => {
    const session = readStoredSession();
    if (!session) clearStoredSession();
    return {
      token: session?.token ?? null,
      user: session?.user ?? null,
      isAuthenticated: !!session,
      isLoading: false,
    };
  });

  const inactivityTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /** Ferme la session localement (sans appel serveur). */
  const endSession = useCallback(
    (reason?: "expired" | "inactive") => {
      clearStoredSession();
      disconnectSocket();
      setState({ token: null, user: null, isAuthenticated: false, isLoading: false });
      if (reason === "expired") toast.warning("Session expirée", "Veuillez vous reconnecter pour continuer.");
      if (reason === "inactive") toast.info("Déconnexion automatique", "Vous avez été déconnecté après 15 minutes d'inactivité.");
      navigate("/login", { replace: true });
    },
    [navigate, toast],
  );

  // ── Déconnexion volontaire : révoque le token côté serveur (au mieux) ──────
  const logout = useCallback(async () => {
    await confirmLogoutAction(); // échec réseau toléré : la session locale est fermée quoi qu'il arrive
    endSession();
  }, [endSession]);

  // ── Connexion ──────────────────────────────────────────────────────────────
  const login = useCallback(
    (session: Session) => {
      localStorage.setItem(TOKEN_KEY, session.token);
      localStorage.setItem(USER_KEY, JSON.stringify(session.user));
      setState({ token: session.token, user: session.user, isAuthenticated: true, isLoading: false });
      const from = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname;
      navigate(from && from !== "/login" ? from : "/dashboard", { replace: true });
    },
    [navigate, location.state],
  );

  // ── Token refusé par le serveur (401) ──────────────────────────────────────
  useEffect(() => {
    if (!state.isAuthenticated) return;
    const onExpired = () => endSession("expired");
    window.addEventListener(SESSION_EXPIRED_EVENT, onExpired);
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, onExpired);
  }, [state.isAuthenticated, endSession]);

  // ── Expiration du JWT : fin de session à l'échéance ────────────────────────
  useEffect(() => {
    if (!state.token) return;
    const exp = tokenExpiry(state.token);
    if (!exp) return;
    const timer = setTimeout(() => endSession("expired"), Math.max(0, exp - Date.now()));
    return () => clearTimeout(timer);
  }, [state.token, endSession]);

  // ── Inactivité : déconnexion après 15 minutes sans interaction ─────────────
  useEffect(() => {
    if (!state.isAuthenticated) return;
    const reset = () => {
      if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
      inactivityTimer.current = setTimeout(() => {
        void confirmLogoutAction();
        endSession("inactive");
      }, INACTIVITY_LIMIT_MS);
    };
    reset();
    ACTIVITY_EVENTS.forEach((event) => window.addEventListener(event, reset, { passive: true }));
    return () => {
      ACTIVITY_EVENTS.forEach((event) => window.removeEventListener(event, reset));
      if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
    };
  }, [state.isAuthenticated, endSession]);

  return <AuthContext.Provider value={{ ...state, login, logout }}>{children}</AuthContext.Provider>;
};
