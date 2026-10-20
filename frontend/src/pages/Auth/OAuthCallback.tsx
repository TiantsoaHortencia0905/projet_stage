import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { LuCircleAlert } from "react-icons/lu";
import { exchangeOAuthCode } from "../../api/auth.api";
import { useAuth } from "../../components/contexts/AuthContext";
import Logo from "../../components/ui/Logo";
import "./AuthPage.css";

/** Retour Google / GitHub : échange le code à usage unique contre une session. */
const OAuthCallback = () => {
  const [params] = useSearchParams();
  const { login } = useAuth();
  const [exchangeError, setExchangeError] = useState<string | null>(null);
  const started = useRef(false); // le code est à usage unique : jamais deux échanges (StrictMode)

  const code = params.get("code");
  const refused = params.get("status") !== "success" || !code;
  const error = refused ? params.get("message") || "La connexion a été refusée ou a échoué." : exchangeError;

  useEffect(() => {
    if (refused || !code || started.current) return;
    started.current = true;
    exchangeOAuthCode(code).then((res) => {
      if (res.success) login(res.data);
      else setExchangeError(res.message ?? "La connexion a échoué.");
    });
  }, [refused, code, login]);

  return (
    <div className="auth-shell auth-shell-centered">
      <div className="auth-panel" role="status">
        <Logo />
        {error ? (
          <>
            <div className="callback-status" style={{ color: "var(--danger)" }}>
              <LuCircleAlert size={36} />
            </div>
            <h1 className="auth-title">Connexion impossible</h1>
            <p className="auth-subtitle">{error}</p>
            <Link to="/login" className="btn btn-primary" style={{ marginTop: 24 }}>
              Retour à la connexion
            </Link>
          </>
        ) : (
          <>
            <div className="callback-status">
              <span className="spinner" style={{ width: 28, height: 28, color: "var(--accent)" }} />
            </div>
            <h1 className="auth-title">Connexion en cours…</h1>
            <p className="auth-subtitle">Finalisation de votre session.</p>
          </>
        )}
      </div>
    </div>
  );
};

export default OAuthCallback;
