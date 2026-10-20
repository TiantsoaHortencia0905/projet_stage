import { Link } from "react-router-dom";
import { LuArrowLeft } from "react-icons/lu";
import { useAuth } from "../components/contexts/AuthContext";
import Logo from "../components/ui/Logo";
import "./Auth/AuthPage.css";

const NotFoundPage = () => {
  const { isAuthenticated } = useAuth();
  return (
    <div className="auth-shell auth-shell-centered">
      <div className="auth-panel">
        <Logo />
        <p className="notfound-code mono">404</p>
        <h1 className="auth-title">Page introuvable</h1>
        <p className="auth-subtitle">L'adresse demandée n'existe pas ou a été déplacée.</p>
        <Link to={isAuthenticated ? "/dashboard" : "/"} className="btn btn-primary" style={{ marginTop: 24 }}>
          <LuArrowLeft size={16} />
          {isAuthenticated ? "Retour à la vue d'ensemble" : "Retour à l'accueil"}
        </Link>
      </div>
    </div>
  );
};

export default NotFoundPage;
