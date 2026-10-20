import { formatBytes, percent } from "../../lib/format";

interface UsageBarProps {
  used: number;
  total: number;
  /** Affiche la légende « x sur y ». */
  legend?: boolean;
}

const UsageBar = ({ used, total, legend = true }: UsageBarProps) => {
  const pct = percent(used, total);
  const level = pct >= 90 ? " is-danger" : pct >= 75 ? " is-warning" : "";

  return (
    <div className="usage">
      <div
        className="usage-track"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(pct)}
        aria-label={`${formatBytes(used)} utilisés sur ${formatBytes(total)}`}
      >
        <div className={`usage-fill${level}`} style={{ width: `${Math.max(pct, used > 0 ? 1.5 : 0)}%` }} />
      </div>
      {legend && (
        <div className="usage-legend">
          <span>
            {formatBytes(used)} sur {formatBytes(total)}
          </span>
          <span>{used > 0 && pct < 1 ? "< 1" : Math.round(pct)} %</span>
        </div>
      )}
    </div>
  );
};

export default UsageBar;
