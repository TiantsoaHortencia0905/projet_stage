import type { CSSProperties } from "react";

const Skeleton = ({ width = "100%", height = 14, radius, style }: { width?: number | string; height?: number | string; radius?: number; style?: CSSProperties }) => (
  <span className="skeleton" style={{ width, height, borderRadius: radius, ...style }} aria-hidden />
);

/** Lignes de tableau fictives pendant le chargement. */
export const SkeletonRows = ({ rows = 4, columns }: { rows?: number; columns: number }) => (
  <>
    {Array.from({ length: rows }, (_, r) => (
      <tr key={r} aria-hidden>
        {Array.from({ length: columns }, (_, c) => (
          <td key={c}>
            <Skeleton width={c === 0 ? "70%" : "50%"} />
          </td>
        ))}
      </tr>
    ))}
  </>
);

export default Skeleton;
