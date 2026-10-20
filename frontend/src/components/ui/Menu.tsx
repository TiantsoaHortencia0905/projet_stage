import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { LuEllipsis } from "react-icons/lu";
import Button from "./Button";

export type MenuEntry =
  | {
      label: string;
      icon?: ReactNode;
      onSelect: () => void;
      danger?: boolean;
      disabled?: boolean;
    }
  | { separator: true }
  | { heading: string };

interface MenuProps {
  items: MenuEntry[];
  /** Libellé accessible du bouton déclencheur. */
  label: string;
  /** Contenu personnalisé du déclencheur (par défaut : « … »). */
  trigger?: (props: { open: boolean; toggle: () => void; id: string }) => ReactNode;
  /** Position préférée ; le menu se retourne automatiquement s'il manque de place. */
  placement?: "down-right" | "down-left" | "up-left" | "up-right";
  /** Le menu prend la largeur du déclencheur (ex. menu du compte). */
  matchTriggerWidth?: boolean;
}

const GAP = 4;
const MARGIN = 8;

/**
 * Menu déroulant affiché dans un portail (position fixe) : il n'est jamais coupé par un conteneur
 * qui défile (tableaux, cartes…), se retourne vers le haut s'il manque de place en bas
 * et reste dans la fenêtre.
 */
const Menu = ({ items, label, trigger, placement = "down-right", matchTriggerWidth = false }: MenuProps) => {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const id = useId();

  /** Place le menu par rapport au déclencheur (écrit directement le style : pas de rendu supplémentaire). */
  const position = useCallback(() => {
    const anchor = rootRef.current;
    const list = listRef.current;
    if (!anchor || !list) return;
    const r = anchor.getBoundingClientRect();
    if (matchTriggerWidth) list.style.width = `${r.width}px`;
    const { width, height } = list.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    const spaceBelow = vh - r.bottom - MARGIN;
    const spaceAbove = r.top - MARGIN;
    const fitsBelow = height + GAP <= spaceBelow;
    const fitsAbove = height + GAP <= spaceAbove;
    const up = placement.startsWith("up") ? fitsAbove || !fitsBelow && spaceAbove > spaceBelow : !fitsBelow && (fitsAbove || spaceAbove > spaceBelow);

    const top = up ? r.top - height - GAP : r.bottom + GAP;
    const left = placement.endsWith("left") ? r.left : r.right - width;
    list.style.top = `${Math.max(MARGIN, Math.min(top, vh - height - MARGIN))}px`;
    list.style.left = `${Math.max(MARGIN, Math.min(left, vw - width - MARGIN))}px`;
    list.dataset.side = up ? "top" : "bottom";
  }, [placement, matchTriggerWidth]);

  // Positionnement avant l'affichage, puis à chaque défilement / redimensionnement
  useLayoutEffect(() => {
    if (!open) return;
    position();
    window.addEventListener("scroll", position, true);
    window.addEventListener("resize", position);
    return () => {
      window.removeEventListener("scroll", position, true);
      window.removeEventListener("resize", position);
    };
  }, [open, position]);

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!rootRef.current?.contains(target) && !listRef.current?.contains(target)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      const nodes = Array.from(listRef.current?.querySelectorAll<HTMLButtonElement>(".menu-item:not(:disabled)") ?? []);
      const index = nodes.indexOf(document.activeElement as HTMLButtonElement);
      if (event.key === "Escape") {
        event.stopPropagation();
        setOpen(false);
        rootRef.current?.querySelector<HTMLElement>("[aria-haspopup]")?.focus();
      } else if (event.key === "ArrowDown") {
        event.preventDefault();
        nodes[(index + 1) % nodes.length]?.focus();
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        nodes[(index - 1 + nodes.length) % nodes.length]?.focus();
      } else if (event.key === "Tab") {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    const frame = requestAnimationFrame(() => listRef.current?.querySelector<HTMLElement>(".menu-item:not(:disabled)")?.focus({ preventScroll: true }));
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
      cancelAnimationFrame(frame);
    };
  }, [open]);

  const toggle = () => setOpen((o) => !o);

  return (
    <div className="menu" ref={rootRef} onClick={(e) => e.stopPropagation()}>
      {trigger ? (
        trigger({ open, toggle, id })
      ) : (
        <Button
          variant="ghost"
          size="sm"
          iconOnly
          aria-label={label}
          aria-haspopup="menu"
          aria-expanded={open}
          aria-controls={open ? id : undefined}
          onClick={toggle}
          icon={<LuEllipsis size={16} />}
        />
      )}
      {open &&
        createPortal(
          <div className="menu-list" role="menu" id={id} ref={listRef} aria-label={label} onClick={(e) => e.stopPropagation()}>
            {items.map((item, i) => {
              if ("separator" in item) return <div key={i} className="menu-separator" role="separator" />;
              if ("heading" in item)
                return (
                  <div key={i} className="menu-label">
                    {item.heading}
                  </div>
                );
              return (
                <button
                  key={i}
                  type="button"
                  role="menuitem"
                  className={`menu-item${item.danger ? " menu-item-danger" : ""}`}
                  disabled={item.disabled}
                  onClick={() => {
                    setOpen(false);
                    item.onSelect();
                  }}
                >
                  {item.icon}
                  {item.label}
                </button>
              );
            })}
          </div>,
          document.body,
        )}
    </div>
  );
};

export default Menu;
