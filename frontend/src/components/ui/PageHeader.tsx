import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { LuChevronRight } from "react-icons/lu";

interface Crumb {
  label: string;
  to?: string;
}

interface PageHeaderProps {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  breadcrumbs?: Crumb[];
  /** Élément affiché à côté du titre (badge d'état…). */
  meta?: ReactNode;
}

const PageHeader = ({ title, description, actions, breadcrumbs, meta }: PageHeaderProps) => (
  <header className="page-header">
    {breadcrumbs && breadcrumbs.length > 0 && (
      <nav className="breadcrumbs" aria-label="Fil d'Ariane">
        {breadcrumbs.map((crumb, i) => (
          <span key={i} className="breadcrumb">
            {crumb.to ? <Link to={crumb.to}>{crumb.label}</Link> : <span>{crumb.label}</span>}
            {i < breadcrumbs.length - 1 && <LuChevronRight size={14} aria-hidden />}
          </span>
        ))}
      </nav>
    )}
    <div className="page-header-row">
      <div className="page-header-text">
        <div className="page-title-row">
          <h1 className="page-title">{title}</h1>
          {meta}
        </div>
        {description && <p className="page-description">{description}</p>}
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </div>
  </header>
);

export default PageHeader;
