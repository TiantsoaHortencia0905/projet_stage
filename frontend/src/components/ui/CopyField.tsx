import { useState } from "react";
import { LuCheck, LuCopy, LuEye, LuEyeOff } from "react-icons/lu";
import { useCopy } from "../../hooks/useCopy";
import Button from "./Button";

interface CopyFieldProps {
  label: string;
  value: string | number | null | undefined;
  /** Masque la valeur (mot de passe) avec un bouton pour l'afficher. */
  secret?: boolean;
}

const CopyField = ({ label, value, secret = false }: CopyFieldProps) => {
  const [revealed, setRevealed] = useState(false);
  const { copied, copy } = useCopy();
  const text = value === null || value === undefined || value === "" ? "" : String(value);
  const display = !text ? "—" : secret && !revealed ? "•".repeat(Math.min(text.length, 24)) : text;

  return (
    <div className="copy-field">
      <span className="copy-field-label">{label}</span>
      <div className="copy-field-box">
        <code className="copy-field-value mono" title={secret && !revealed ? undefined : text}>
          {display}
        </code>
        {secret && text && (
          <Button
            variant="ghost"
            size="sm"
            iconOnly
            aria-label={revealed ? "Masquer" : "Afficher"}
            onClick={() => setRevealed((r) => !r)}
            icon={revealed ? <LuEyeOff size={15} /> : <LuEye size={15} />}
          />
        )}
        <Button
          variant="ghost"
          size="sm"
          iconOnly
          aria-label={copied ? "Copié" : `Copier ${label.toLowerCase()}`}
          title={copied ? "Copié" : "Copier"}
          disabled={!text}
          onClick={() => copy(text)}
          icon={copied ? <LuCheck size={15} color="var(--success)" /> : <LuCopy size={15} />}
        />
      </div>
    </div>
  );
};

export default CopyField;
