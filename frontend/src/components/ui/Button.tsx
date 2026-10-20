import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "danger-ghost";
type Size = "sm" | "md" | "lg";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  /** Affiche un spinner et désactive le bouton (anti double-soumission). */
  loading?: boolean;
  icon?: ReactNode;
  /** Bouton carré sans texte : `aria-label` obligatoire. */
  iconOnly?: boolean;
  block?: boolean;
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    { variant = "secondary", size = "md", loading = false, icon, iconOnly, block, className, children, disabled, type = "button", ...rest },
    ref,
  ) => {
    const classes = [
      "btn",
      `btn-${variant}`,
      size !== "md" && `btn-${size}`,
      iconOnly && "btn-icon",
      block && "btn-block",
      className,
    ]
      .filter(Boolean)
      .join(" ");

    return (
      <button
        ref={ref}
        type={type}
        className={classes}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        {...rest}
      >
        {loading ? <span className="spinner" aria-hidden /> : icon}
        {children}
      </button>
    );
  },
);

Button.displayName = "Button";
export default Button;
