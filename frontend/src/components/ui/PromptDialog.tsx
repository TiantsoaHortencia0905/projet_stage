import { useState, type FormEvent, type ReactNode } from "react";
import Button from "./Button";
import Field from "./Field";
import Modal from "./Modal";

interface PromptDialogProps {
  open: boolean;
  title: string;
  description?: ReactNode;
  label: string;
  initialValue?: string;
  placeholder?: string;
  hint?: string;
  submitLabel?: string;
  maxLength?: number;
  icon?: ReactNode;
  /** Validation locale ; renvoie un message d'erreur ou null. */
  validate?: (value: string) => string | null;
  /**
   * Envoi. Renvoie `null` en cas de succès (le dialogue se ferme),
   * sinon le message d'erreur à afficher sous le champ.
   */
  onSubmit: (value: string) => Promise<string | null>;
  onClose: () => void;
}

/** Dialogue à un seul champ texte (création, renommage…). Monté seulement à l'ouverture. */
const PromptDialog = (props: PromptDialogProps) => (props.open ? <PromptDialogContent {...props} /> : null);

const PromptDialogContent = ({
  open,
  title,
  description,
  label,
  initialValue = "",
  placeholder,
  hint,
  submitLabel = "Enregistrer",
  maxLength = 100,
  icon,
  validate,
  onSubmit,
  onClose,
}: PromptDialogProps) => {
  const [value, setValue] = useState(initialValue);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const unchanged = initialValue !== "" && value.trim() === initialValue.trim();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const trimmed = value.trim();
    const localError = validate ? validate(trimmed) : trimmed ? null : "Ce champ est requis.";
    if (localError) {
      setError(localError);
      return;
    }
    if (unchanged) {
      onClose();
      return;
    }
    setBusy(true);
    const serverError = await onSubmit(trimmed);
    setBusy(false);
    if (serverError) setError(serverError);
    else onClose();
  };

  return (
    <Modal open={open} onClose={onClose} busy={busy} title={title} description={description} icon={icon}>
      <form onSubmit={handleSubmit} noValidate id="prompt-dialog-form">
        <Field label={label} error={error} hint={hint}>
          <input
            className="input"
            value={value}
            placeholder={placeholder}
            maxLength={maxLength}
            onChange={(e) => {
              setValue(e.target.value);
              if (error) setError(null);
            }}
            onFocus={(e) => {
              // Renommage d'un fichier : sélectionne le nom sans l'extension
              const dot = e.target.value.lastIndexOf(".");
              if (initialValue && dot > 0) e.target.setSelectionRange(0, dot);
              else e.target.select();
            }}
          />
        </Field>
        <div className="prompt-actions">
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Annuler
          </Button>
          <Button type="submit" variant="primary" loading={busy}>
            {submitLabel}
          </Button>
        </div>
      </form>
    </Modal>
  );
};

export default PromptDialog;
