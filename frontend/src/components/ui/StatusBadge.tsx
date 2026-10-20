import type { StatusInfo } from "../../lib/status";

const StatusBadge = ({ status, className }: { status: StatusInfo; className?: string }) => (
  <span
    className={[
      "badge badge-dot",
      status.tone !== "neutral" && `badge-${status.tone}`,
      status.pending && "badge-pulse",
      className,
    ]
      .filter(Boolean)
      .join(" ")}
  >
    {status.label}
  </span>
);

export default StatusBadge;
