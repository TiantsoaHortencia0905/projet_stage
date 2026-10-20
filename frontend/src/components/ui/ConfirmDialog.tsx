import { useState, type ReactNode } from "react";
import { LuTriangleAlert } from "react-icons/lu";
import Button from "./Button";
import Field from "./Field";
import Modal from "./Modal";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description?: ReactNode;
  children?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "danger" | "default";
  /** Texte à recopier pour activer la confirmation (actions très destructrices). */
  requireText?: string;
  /**
   * Action confirmée. Le dialogue reste ouvert (avec spinner) pendant l'exécution
   * et se ferme seulement si elle ne renvoie pas `false`.
   */
  onConfirm: () => Promise<boolean | void> | boolean | void;
  onClose: () => void;
}

/** Le contenu n'est monté qu'à l'ouverture : chaque ouverture repart d'un état vierge. */
const ConfirmDialog = (props: ConfirmDialogProps) => (props.open ? <ConfirmDialogContent {...props} /> : null);

const ConfirmDialogContent = ({
  open,
  title,
  description,
  children,
  confirmLabel = "Confirmer",
  cancelLabel = "Annuler",
  tone = "danger",
  requireText,
  onConfirm,
  onClose,
}: ConfirmDialogProps) => {
  const [busy, setBusy] = useState(false);
  const [typed, setTyped] = useState("");

  const blocked = !!requireText && typed.trim() !== requireText;

  const handleConfirm = async () => {
    if (blocked) return;
    setBusy(true);
    try {
      const result = await onConfirm();
      if (result !== false) onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      busy={busy}
      title={title}
      description={description}
      icon={tone === "danger" ? <LuTriangleAlert size={18} /> : undefined}
      iconTone="danger"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            {cancelLabel}
          </Button>
          <Button variant={tone === "danger" ? "danger" : "primary"} onClick={handleConfirm} loading={busy} disabled={blocked}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      {(children || requireText) && (
        <>
          {children}
          {requireText && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void handleConfirm();
              }}
              style={{ marginTop: children ? 16 : 0 }}
            >
              <Field
                label={
                  <>
                    Saisissez <strong className="mono">{requireText}</strong> pour confirmer
                  </>
                }
              >
                <input
                  className="input mono"
                  value={typed}
                  onChange={(e) => setTyped(e.target.value)}
                  autoComplete="off"
                  spellCheck={false}
                  disabled={busy}
                />
              </Field>
            </form>
          )}
        </>
      )}
    </Modal>
  );
};

export default ConfirmDialog;
