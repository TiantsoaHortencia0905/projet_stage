import { useRef, type ReactNode } from "react";

export interface TabItem<T extends string> {
  id: T;
  label: string;
  icon?: ReactNode;
  /** Compteur affiché à côté du libellé (masqué si 0 ou absent). */
  count?: number;
  /** Compteur mis en évidence (ex. alertes ouvertes). */
  countTone?: "neutral" | "danger";
}

interface TabsProps<T extends string> {
  items: TabItem<T>[];
  value: T;
  onChange: (id: T) => void;
  label: string;
  /** Préfixe des id : chaque panneau doit porter id={`${idPrefix}-panel-${tab}`}. */
  idPrefix: string;
}

/** Onglets de page (navigation au clavier : flèches gauche / droite, Début, Fin). */
function Tabs<T extends string>({ items, value, onChange, label, idPrefix }: TabsProps<T>) {
  const listRef = useRef<HTMLDivElement>(null);

  const onKeyDown = (e: React.KeyboardEvent) => {
    const index = items.findIndex((t) => t.id === value);
    const next =
      e.key === "ArrowRight" ? (index + 1) % items.length
      : e.key === "ArrowLeft" ? (index - 1 + items.length) % items.length
      : e.key === "Home" ? 0
      : e.key === "End" ? items.length - 1
      : -1;
    if (next < 0) return;
    e.preventDefault();
    onChange(items[next].id);
    listRef.current?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[next]?.focus();
  };

  return (
    <div className="tabs" role="tablist" aria-label={label} ref={listRef} onKeyDown={onKeyDown}>
      {items.map((t) => {
        const selected = t.id === value;
        return (
          <button
            key={t.id}
            type="button"
            role="tab"
            id={`${idPrefix}-tab-${t.id}`}
            aria-selected={selected}
            aria-controls={`${idPrefix}-panel-${t.id}`}
            tabIndex={selected ? 0 : -1}
            className={`tab${selected ? " is-active" : ""}`}
            onClick={() => onChange(t.id)}
          >
            {t.icon}
            {t.label}
            {!!t.count && <span className={`tab-count${t.countTone === "danger" ? " is-danger" : ""}`}>{t.count > 99 ? "99+" : t.count}</span>}
          </button>
        );
      })}
    </div>
  );
}

export default Tabs;
