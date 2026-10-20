import type { ReactNode } from "react";

interface EmptyStateProps {
  icon: ReactNode;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  compact?: boolean;
}

const EmptyState = ({ icon, title, description, action, compact }: EmptyStateProps) => (
  <div className={`empty${compact ? " empty-compact" : ""}`}>
    <div className="empty-icon">{icon}</div>
    <p className="empty-title">{title}</p>
    {description && <p className="empty-text">{description}</p>}
    {action && <div className="empty-action">{action}</div>}
  </div>
);

export default EmptyState;
