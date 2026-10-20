import { useId, type ReactNode } from "react";
import { LuChevronLeft, LuChevronRight } from "react-icons/lu";
import { PAGE_SIZES, type PageSize } from "../../hooks/usePagination";
import Button from "./Button";

interface PaginationProps {
  page: number;
  pageSize: number;
  pageCount: number;
  total: number;
  setPage: (page: number) => void;
  setPageSize: (size: PageSize) => void;
  /** Nom des éléments : [singulier, pluriel], ex. ["fichier", "fichiers"]. */
  itemsLabel?: [string, string];
  /** Contenu supplémentaire à gauche (ex. « 3 / 5 bases utilisées »). */
  aside?: ReactNode;
}

/** Numéros affichés : 1 … 4 5 6 … 20 (toujours la première, la dernière et les voisines). */
const pageNumbers = (page: number, count: number): (number | "…")[] => {
  if (count <= 7) return Array.from({ length: count }, (_, i) => i + 1);
  const pages = new Set([1, count, page - 1, page, page + 1]);
  if (page <= 3) [2, 3, 4].forEach((p) => pages.add(p));
  if (page >= count - 2) [count - 3, count - 2, count - 1].forEach((p) => pages.add(p));
  const sorted = [...pages].filter((p) => p >= 1 && p <= count).sort((a, b) => a - b);
  return sorted.flatMap((p, i) => (i > 0 && p - sorted[i - 1] > 1 ? (["…", p] as const) : [p]));
};

/** Pied de tableau : lignes par page, position, numéros de page. */
const Pagination = ({ page, pageSize, pageCount, total, setPage, setPageSize, itemsLabel = ["élément", "éléments"], aside }: PaginationProps) => {
  const selectId = useId();
  if (total === 0) return null;
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  return (
    <div className="pagination">
      <div className="pagination-info">
        {aside}
        <label className="pagination-size" htmlFor={selectId}>
          Afficher
          <select id={selectId} className="select" value={pageSize} onChange={(e) => setPageSize(Number(e.target.value) as PageSize)}>
            {PAGE_SIZES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <span className="pagination-range">
          {from === to ? from.toLocaleString("fr-FR") : `${from.toLocaleString("fr-FR")}–${to.toLocaleString("fr-FR")}`} sur{" "}
          {total.toLocaleString("fr-FR")} {total > 1 ? itemsLabel[1] : itemsLabel[0]}
        </span>
      </div>

      {pageCount > 1 && (
        <nav className="pagination-pages" aria-label="Pagination">
          <Button
            variant="ghost"
            size="sm"
            iconOnly
            aria-label="Page précédente"
            disabled={page === 1}
            onClick={() => setPage(page - 1)}
            icon={<LuChevronLeft size={16} />}
          />
          {pageNumbers(page, pageCount).map((p, i) =>
            p === "…" ? (
              <span key={`gap-${i}`} className="pagination-gap" aria-hidden>
                …
              </span>
            ) : (
              <button
                key={p}
                type="button"
                className={`pagination-page${p === page ? " is-current" : ""}`}
                aria-current={p === page ? "page" : undefined}
                aria-label={`Page ${p}`}
                onClick={() => setPage(p)}
              >
                {p}
              </button>
            ),
          )}
          <Button
            variant="ghost"
            size="sm"
            iconOnly
            aria-label="Page suivante"
            disabled={page === pageCount}
            onClick={() => setPage(page + 1)}
            icon={<LuChevronRight size={16} />}
          />
        </nav>
      )}
    </div>
  );
};

export default Pagination;
