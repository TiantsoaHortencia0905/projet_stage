import { useState, type FormEvent } from "react";
import { LuDatabase } from "react-icons/lu";
import { newDatabase, type DatabaseWithConnexion } from "../../api/database.api";
import Button from "../../components/ui/Button";
import Callout from "../../components/ui/Callout";
import Field from "../../components/ui/Field";
import Modal from "../../components/ui/Modal";
import Skeleton from "../../components/ui/Skeleton";
import { validateDbName } from "../../lib/validation";
import type { DatabaseType } from "../../interfaces";
import EngineIcon from "./EngineIcon";
import { engineInfo } from "./engines";

interface Props {
  open: boolean;
  types: DatabaseType[] | undefined;
  typesError: string | null;
  onClose: () => void;
  onCreated: (result: DatabaseWithConnexion) => void;
}

/** Monté seulement à l'ouverture : chaque ouverture repart d'un formulaire vierge. */
const CreateDatabaseDialog = (props: Props) => (props.open ? <CreateDatabaseForm {...props} /> : null);

const CreateDatabaseForm = ({ open, types, typesError, onClose, onCreated }: Props) => {
  const [type, setType] = useState("");
  const [version, setVersion] = useState("");
  const [name, setName] = useState("");
  const [nameError, setNameError] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Par défaut (y compris si les types arrivent après l'ouverture) : premier moteur, version recommandée
  const selected = types?.find((t) => t.type === type) ?? types?.[0];
  const effectiveVersion = version || selected?.versionParDefaut || "";

  const selectType = (t: DatabaseType) => {
    setType(t.type);
    setVersion(t.versionParDefaut);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const normalized = name.trim().toLowerCase();
    const err = validateDbName(normalized);
    setNameError(err);
    if (err || !selected) return;

    setBusy(true);
    setServerError(null);
    const res = await newDatabase({ nomBD: normalized, typeBD: selected.type, version: effectiveVersion });
    setBusy(false);
    if (!res.success) {
      if (res.status === 409 || /nom/i.test(res.message ?? "")) setNameError(res.message ?? "Nom invalide.");
      else setServerError(res.message ?? "La création a échoué.");
      return;
    }
    onCreated(res.data);
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      busy={busy}
      size="md"
      title="Nouvelle base de données"
      description="Une instance isolée est créée pour vous, avec un utilisateur et un mot de passe dédiés."
      icon={<LuDatabase size={18} />}
    >
      <form onSubmit={handleSubmit} noValidate>
        {serverError && (
          <div style={{ marginBottom: 16 }}>
            <Callout tone="danger">{serverError}</Callout>
          </div>
        )}

        <fieldset className="engine-fieldset">
          <legend className="field-label">Moteur</legend>
          {typesError ? (
            <Callout tone="danger">{typesError}</Callout>
          ) : !types ? (
            <div className="engine-grid">
              {[0, 1, 2, 3, 4].map((i) => (
                <Skeleton key={i} height={74} radius={8} />
              ))}
            </div>
          ) : (
            <div className="engine-grid" role="radiogroup">
              {types.map((t) => (
                <label key={t.type} className={`engine-option${t.type === selected?.type ? " is-selected" : ""}`}>
                  <input type="radio" name="engine" value={t.type} checked={t.type === selected?.type} onChange={() => selectType(t)} className="visually-hidden" />
                  <EngineIcon type={t.type} />
                  <span className="engine-option-text">
                    <strong>{t.label}</strong>
                    <span>{engineInfo(t.type).description}</span>
                  </span>
                </label>
              ))}
            </div>
          )}
        </fieldset>

        <div className="form-row" style={{ marginTop: 18 }}>
          <Field
            label="Nom de la base"
            error={nameError}
            hint="Minuscules, chiffres et _, en commençant par une lettre."
          >
            <input
              className="input mono"
              placeholder="ma_base"
              value={name}
              maxLength={30}
              autoComplete="off"
              spellCheck={false}
              onChange={(e) => {
                setName(e.target.value.toLowerCase().replace(/[\s-]/g, "_"));
                if (nameError) setNameError(null);
              }}
            />
          </Field>
          <Field label="Version" hint={selected ? `Recommandée : ${selected.versionParDefaut}` : undefined}>
            <select className="select" value={effectiveVersion} onChange={(e) => setVersion(e.target.value)} disabled={!selected}>
              {(selected?.versions ?? []).map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <div className="prompt-actions">
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Annuler
          </Button>
          <Button type="submit" variant="primary" loading={busy} disabled={!selected}>
            Créer la base
          </Button>
        </div>
      </form>
    </Modal>
  );
};

export default CreateDatabaseDialog;
