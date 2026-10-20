import { Link } from "react-router-dom";
import {
  LuArrowRight,
  LuDatabase,
  LuFolderOpen,
  LuKeyRound,
  LuLock,
  LuRocket,
  LuShieldCheck,
} from "react-icons/lu";
import githubLogo from "../assets/github.png";
import Logo from "../components/ui/Logo";
import "./LandingPage.css";

const PILLARS = [
  {
    icon: LuFolderOpen,
    title: "Stockage de données",
    text: "Créez des espaces dédiés, déposez vos fichiers par glisser-déposer et gardez un œil sur le quota utilisé.",
    points: ["Espaces avec quota", "Copie, déplacement, duplication", "Aperçu et téléchargement"],
  },
  {
    icon: LuDatabase,
    title: "Bases de données",
    text: "Choisissez un moteur et une version : ArchiCloud lance une instance isolée et vous fournit les accès.",
    points: ["PostgreSQL, MySQL, MariaDB", "MongoDB et Redis", "Démarrage, arrêt, rotation du mot de passe"],
  },
  {
    icon: LuRocket,
    title: "Déploiement continu",
    text: "Reliez votre compte GitHub, choisissez un dépôt et une branche : le build et la mise en ligne sont automatiques.",
    points: ["Détection Dockerfile, Node.js, Python", "Variables d'environnement chiffrées", "Suivi de l'état et des erreurs"],
  },
];

const SECURITY = [
  { icon: LuKeyRound, title: "Connexion Google & GitHub", text: "Ou un compte lié à votre adresse e-mail." },
  { icon: LuLock, title: "Secrets chiffrés", text: "Mots de passe et tokens chiffrés en AES-256-GCM." },
  { icon: LuShieldCheck, title: "Sessions maîtrisées", text: "Jetons à durée limitée, révoqués à la déconnexion." },
];

const LandingPage = () => (
  <div className="landing">
    <header className="landing-header">
      <div className="landing-container landing-header-inner">
        <Link to="/" className="landing-brand" aria-label="ArchiCloud, accueil">
          <Logo />
        </Link>
        <nav className="landing-nav" aria-label="Navigation">
          <a href="#fonctionnalites">Fonctionnalités</a>
          <a href="#securite">Sécurité</a>
        </nav>
        <div className="landing-header-actions">
          <Link to="/login" className="btn btn-ghost">
            Se connecter
          </Link>
          <Link to="/register" className="btn btn-primary">
            Créer un compte
          </Link>
        </div>
      </div>
    </header>

    <main>
      <section className="landing-container hero">
        <div className="hero-text">
          <p className="eyebrow">Services de données & DevOps</p>
          <h1 className="hero-title">
            Stockez, provisionnez, déployez.
            <br />
            <span>Depuis une seule console.</span>
          </h1>
          <p className="hero-lead">
            ArchiCloud réunit le stockage de fichiers, les bases de données et le déploiement de vos applications.
            Moins d'outils à assembler, plus de temps pour votre projet.
          </p>
          <div className="hero-actions">
            <Link to="/register" className="btn btn-primary btn-lg">
              Commencer gratuitement
              <LuArrowRight size={17} />
            </Link>
            <Link to="/login" className="btn btn-secondary btn-lg">
              J'ai déjà un compte
            </Link>
          </div>
        </div>

        {/* Aperçu de la console (purement illustratif) */}
        <div className="preview" aria-hidden>
          <div className="preview-bar">
            <span />
            <span />
            <span />
            <p>console.archicloud</p>
          </div>
          <div className="preview-body">
            <p className="preview-heading">Vue d'ensemble</p>
            <div className="preview-row">
              <span className="preview-icon">
                <LuRocket size={14} />
              </span>
              <div className="preview-main">
                <strong>portfolio-api</strong>
                <span className="mono">main · a1f9c2e</span>
              </div>
              <span className="badge badge-dot badge-success">En ligne</span>
            </div>
            <div className="preview-row">
              <span className="preview-icon">
                <LuRocket size={14} />
              </span>
              <div className="preview-main">
                <strong>dashboard-web</strong>
                <span className="mono">develop · 7be04d1</span>
              </div>
              <span className="badge badge-dot badge-info badge-pulse">Build</span>
            </div>
            <div className="preview-row">
              <span className="preview-icon">
                <LuDatabase size={14} />
              </span>
              <div className="preview-main">
                <strong>ventes_prod</strong>
                <span>PostgreSQL 16</span>
              </div>
              <span className="badge badge-dot badge-success">En ligne</span>
            </div>
            <div className="preview-row preview-row-storage">
              <span className="preview-icon">
                <LuFolderOpen size={14} />
              </span>
              <div className="preview-main">
                <strong>Documents projet</strong>
                <div className="usage-track">
                  <div className="usage-fill" style={{ width: "62%" }} />
                </div>
              </div>
              <span className="preview-meta mono">1,2 / 2 Go</span>
            </div>
          </div>
        </div>
      </section>

      <section className="landing-section" id="fonctionnalites">
        <div className="landing-container">
          <div className="section-intro">
            <p className="eyebrow">Fonctionnalités</p>
            <h2>Trois briques, une seule plateforme</h2>
            <p>Pour un utilisateur qui range ses fichiers comme pour une équipe qui livre en continu.</p>
          </div>
          <div className="pillars">
            {PILLARS.map(({ icon: Icon, title, text, points }) => (
              <article className="pillar" key={title}>
                <span className="pillar-icon">
                  <Icon size={18} />
                </span>
                <h3>{title}</h3>
                <p>{text}</p>
                <ul>
                  {points.map((p) => (
                    <li key={p}>{p}</li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="landing-section landing-section-alt" id="securite">
        <div className="landing-container security">
          <div className="section-intro section-intro-left">
            <p className="eyebrow">Sécurité</p>
            <h2>La sécurité intégrée dès la conception</h2>
            <p>Authentification, contrôle d'accès et chiffrement s'appliquent à chaque ressource que vous créez.</p>
          </div>
          <div className="security-grid">
            {SECURITY.map(({ icon: Icon, title, text }) => (
              <div className="security-item" key={title}>
                <Icon size={18} />
                <div>
                  <strong>{title}</strong>
                  <p>{text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="landing-container cta">
        <div>
          <h2>Prêt à lancer votre premier projet ?</h2>
          <p>Créez un compte, connectez GitHub et déployez en quelques minutes.</p>
        </div>
        <div className="cta-actions">
          <Link to="/register" className="btn btn-primary btn-lg">
            Créer un compte
          </Link>
          <span className="cta-github">
            <img src={githubLogo} alt="" width={16} height={16} /> Connexion GitHub disponible
          </span>
        </div>
      </section>
    </main>

    <footer className="landing-footer">
      <div className="landing-container landing-footer-inner">
        <Logo size={22} />
        <p>Conception et réalisation d'une architecture cloud pour les services de données et le DevOps.</p>
      </div>
    </footer>
  </div>
);

export default LandingPage;
