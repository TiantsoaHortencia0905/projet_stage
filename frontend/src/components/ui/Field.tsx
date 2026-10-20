import { cloneElement, isValidElement, useId, type ReactElement, type ReactNode } from "react";
import { LuCircleAlert } from "react-icons/lu";

interface FieldProps {
  label: ReactNode;
  /** Le contrôle (input, select…) : reçoit automatiquement id, aria-invalid et aria-describedby. */
  children: ReactElement<Record<string, unknown>>;
  hint?: ReactNode;
  error?: string | null;
  /** Message positif (ex. « Nom disponible »), affiché s'il n'y a pas d'erreur. */
  success?: ReactNode;
  optional?: boolean;
  labelAside?: ReactNode;
}

const Field = ({ label, children, hint, error, success, optional, labelAside }: FieldProps) => {
  const id = useId();
  const messageId = `${id}-msg`;
  const hasMessage = !!error || !!success || !!hint;

  const control = isValidElement(children)
    ? cloneElement(children, {
        id,
        "aria-invalid": error ? true : undefined,
        "aria-describedby": hasMessage ? messageId : undefined,
      })
    : children;

  return (
    <div className="field">
      <label className="field-label" htmlFor={id}>
        <span>
          {label}
          {optional && <span className="field-optional"> (facultatif)</span>}
        </span>
        {labelAside}
      </label>
      {control}
      {error ? (
        <p className="field-error" id={messageId}>
          <LuCircleAlert size={13} aria-hidden />
          {error}
        </p>
      ) : success ? (
        <p className="field-success" id={messageId}>
          {success}
        </p>
      ) : hint ? (
        <p className="field-hint" id={messageId}>
          {hint}
        </p>
      ) : null}
    </div>
  );
};

export default Field;
