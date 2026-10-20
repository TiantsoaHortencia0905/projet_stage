import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { LuDatabase, LuFolderOpen, LuRocket } from "react-icons/lu";
import Logo from "../../components/ui/Logo";
import "./AuthPage.css";

/** Mise en page commune connexion / inscription : formulaire à gauche, présentation à droite. */
const AuthLayout = ({ children, headerAction }: { children: ReactNode; headerAction?: ReactNode }) => (
  <div className="auth-shell">
    <div className="auth-main">
      <div className="auth-main-header">
        <Link to="/" aria-label="Accueil ArchiCloud">
          <Logo />
        </Link>
        {headerAction}
      </div>
      <div className="auth-main-body">
        <div className="auth-panel">{children}</div>
      </div>
    </div>

    <aside className="auth-aside" aria-hidden>
      <h2 className="auth-aside-title">Votre infrastructure, au même endroit.</h2>
      <p className="auth-aside-text">
        Stockez vos fichiers, provisionnez vos bases de données et déployez vos applications depuis une seule console.
      </p>
      <ul className="auth-aside-list">
        <li>
          <span className="auth-aside-icon">
            <LuFolderOpen size={17} />
          </span>
          <div>
            <strong>Stockage</strong>
            <span>Espaces avec quota, organisation et partage de fichiers.</span>
          </div>
        </li>
        <li>
          <span className="auth-aside-icon">
            <LuDatabase size={17} />
          </span>
          <div>
            <strong>Bases de données</strong>
            <span>PostgreSQL, MySQL, MariaDB, MongoDB ou Redis en un clic.</span>
          </div>
        </li>
        <li>
          <span className="auth-aside-icon">
            <LuRocket size={17} />
          </span>
          <div>
            <strong>Déploiement</strong>
            <span>De votre dépôt GitHub à une URL en ligne, avec suivi des logs.</span>
          </div>
        </li>
      </ul>
    </aside>
  </div>
);

export default AuthLayout;
