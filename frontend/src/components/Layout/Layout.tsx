// src/components/Layout/Layout.tsx
import { useEffect, useState } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import {
  LuBookOpen,
  LuChevronsUpDown,
  LuDatabase,
  LuFolderOpen,
  LuLayoutDashboard,
  LuLogOut,
  LuMenu,
  LuRocket,
  LuTrash2,
  LuX,
} from "react-icons/lu";
import { BASE_URL } from "../../config/api.config";
import { useAlertsWatcher } from "../../hooks/useAlertsWatcher";
import { initials } from "../../lib/format";
import { useAppSelector } from "../../redux/store";
import { useAuth } from "../contexts/AuthContext";
import Button from "../ui/Button";
import Logo from "../ui/Logo";
import ConfirmDialog from "../ui/ConfirmDialog";
import Menu from "../ui/Menu";
import "./Layout.css";

const NAV_SECTIONS = [
  {
    items: [{ to: "/dashboard", label: "Vue d'ensemble", icon: LuLayoutDashboard }],
  },
  {
    title: "Stockage",
    items: [
      { to: "/espace", label: "Espaces de stockage", icon: LuFolderOpen },
      { to: "/corbeille", label: "Corbeille", icon: LuTrash2 },
    ],
  },
  {
    title: "Données",
    items: [{ to: "/database", label: "Bases de données", icon: LuDatabase }],
  },
  {
    title: "DevOps",
    items: [{ to: "/deploy", label: "Déploiements", icon: LuRocket }],
  },
];

const Layout = () => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [confirmLogout, setConfirmLogout] = useState(false);
  const { user, logout } = useAuth();
  useAlertsWatcher();
  const openAlerts = useAppSelector((st) => st.alerts.openCount ?? 0);
  const location = useLocation();

  // Ferme le menu mobile à chaque navigation
  const [lastPath, setLastPath] = useState(location.pathname);
  if (lastPath !== location.pathname) {
    setLastPath(location.pathname);
    setMobileOpen(false);
  }

  // Échap ferme le menu mobile
  useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMobileOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [mobileOpen]);

  return (
    <div className="shell">
      <a href="#main" className="skip-link">
        Aller au contenu
      </a>

      {/* Barre supérieure mobile */}
      <header className="mobile-bar">
        <Button
          variant="ghost"
          iconOnly
          aria-label="Ouvrir la navigation"
          aria-expanded={mobileOpen}
          onClick={() => setMobileOpen(true)}
          icon={<LuMenu size={20} />}
        />
        <Link to="/dashboard" className="mobile-bar-brand" aria-label="ArchiCloud, vue d'ensemble">
          <Logo size={24} />
        </Link>
      </header>

      {mobileOpen && <div className="sidebar-scrim" onClick={() => setMobileOpen(false)} aria-hidden />}

      <aside className={`sidebar${mobileOpen ? " is-open" : ""}`} aria-label="Navigation principale">
        <div className="sidebar-brand">
          <Link to="/dashboard" aria-label="ArchiCloud, vue d'ensemble">
            <Logo />
          </Link>
          <Button
            variant="ghost"
            size="sm"
            iconOnly
            className="sidebar-close"
            aria-label="Fermer la navigation"
            onClick={() => setMobileOpen(false)}
            icon={<LuX size={18} />}
          />
        </div>

        <nav className="sidebar-nav">
          {NAV_SECTIONS.map((section, i) => (
            <div className="nav-section" key={i}>
              {section.title && <p className="nav-section-title">{section.title}</p>}
              {section.items.map(({ to, label, icon: Icon }) => (
                <div key={to} className="nav-item">
                  <NavLink to={to} className={({ isActive }) => `nav-link${isActive ? " is-active" : ""}`}>
                    <Icon size={17} aria-hidden />
                    <span>{label}</span>
                  </NavLink>
                  {to === "/deploy" && openAlerts > 0 && (
                    <Link
                      to="/deploy?onglet=alertes"
                      className="nav-badge"
                      title="Voir les alertes ouvertes"
                      aria-label={`${openAlerts} alerte(s) ouverte(s) : voir les alertes`}
                    >
                      {openAlerts > 99 ? "99+" : openAlerts}
                    </Link>
                  )}
                </div>
              ))}
            </div>
          ))}
        </nav>

        <div className="sidebar-footer">
          <a className="nav-link nav-link-subtle" href={`${BASE_URL}/api-docs`} target="_blank" rel="noopener noreferrer">
            <LuBookOpen size={17} aria-hidden />
            <span>Documentation API</span>
          </a>

          <Menu
            label="Compte"
            placement="up-left"
            matchTriggerWidth
            items={[
              { heading: user?.email ?? "" },
              { separator: true },
              { label: "Se déconnecter", icon: <LuLogOut size={16} />, onSelect: () => setConfirmLogout(true) },
            ]}
            trigger={({ open, toggle, id }) => (
              <button
                type="button"
                className="account"
                onClick={toggle}
                aria-haspopup="menu"
                aria-expanded={open}
                aria-controls={open ? id : undefined}
              >
                <span className="avatar" aria-hidden>
                  {initials(user?.nom)}
                </span>
                <span className="account-text">
                  <span className="account-name truncate">{user?.nom ?? "Utilisateur"}</span>
                  <span className="account-handle truncate">@{user?.surnom}</span>
                </span>
                <LuChevronsUpDown size={15} className="account-chevron" aria-hidden />
              </button>
            )}
          />
        </div>
      </aside>

      <main className="main" id="main" tabIndex={-1}>
        <div className="content">
          <Outlet />
        </div>
      </main>

      <ConfirmDialog
        open={confirmLogout}
        tone="default"
        title="Se déconnecter ?"
        description="Votre session sera fermée sur cet appareil. Vos fichiers, bases de données et applications restent disponibles et en ligne."
        confirmLabel="Se déconnecter"
        onConfirm={logout}
        onClose={() => setConfirmLogout(false)}
      />
    </div>
  );
};

export default Layout;
