import { LuInfo } from "react-icons/lu";
import { fileUrl } from "../../api/files.api";
import Button from "../../components/ui/Button";
import CopyField from "../../components/ui/CopyField";
import Modal from "../../components/ui/Modal";
import { formatBytes, formatDateTime } from "../../lib/format";
import type { Fichier } from "../../interfaces";
import { extensionOf, fileKind } from "./fileTypes";

interface Props {
  fichier: Fichier | null;
  /** Nom de l'espace où se trouve le fichier (emplacement). */
  nomEspace?: string;
  onClose: () => void;
}

/** Propriétés d'un objet stocké : emplacement, dates, responsable, type, état. */
const FilePropertiesDialog = ({ fichier, nomEspace, onClose }: Props) => {
  if (!fichier) return null;
  const kind = fileKind(fichier.nomFichier);
  const ext = extensionOf(fichier.nomFichier);
  const modified = fichier.dateModification && fichier.dateModification !== fichier.dateCreation;

  return (
    <Modal
      open
      onClose={onClose}
      size="md"
      title="Propriétés"
      description={<span className="mono">{fichier.nomFichier}</span>}
      icon={<LuInfo size={18} />}
      footer={
        <Button variant="primary" onClick={onClose}>
          Fermer
        </Button>
      }
    >
      <dl className="dl props-dl">
        <dt>Type</dt>
        <dd>
          <span className="row">
            {kind.icon}
            {kind.label}
            {ext && <span className="muted mono">.{ext}</span>}
          </span>
        </dd>
        <dt>Type MIME</dt>
        <dd className="mono">{fichier.typeMime || "—"}</dd>
        <dt>Taille</dt>
        <dd>
          {formatBytes(fichier.tailleFichier)} <span className="muted">({fichier.tailleFichier.toLocaleString("fr-FR")} octets)</span>
        </dd>
        <dt>Emplacement</dt>
        <dd>{nomEspace ? `Espace « ${nomEspace} »` : "—"}</dd>
        <dt>Responsable</dt>
        <dd>
          {fichier.utilisateur ? (
            <>
              {fichier.utilisateur.nomUtilisateur} <span className="muted">@{fichier.utilisateur.surnomUtilisateur}</span>
            </>
          ) : (
            "—"
          )}
        </dd>
        <dt>Ajouté le</dt>
        <dd>{formatDateTime(fichier.dateCreation)}</dd>
        <dt>Modifié le</dt>
        <dd>{modified ? formatDateTime(fichier.dateModification) : <span className="muted">jamais modifié</span>}</dd>
        <dt>État</dt>
        <dd>
          {fichier.dateArchivage ? (
            <span className="badge badge-dot badge-warning">Archivé le {formatDateTime(fichier.dateArchivage)}</span>
          ) : (
            <span className="badge badge-dot badge-success">Actif</span>
          )}
        </dd>
      </dl>
      <div style={{ marginTop: 18 }}>
        <CopyField label="Lien direct" value={fileUrl(fichier)} />
      </div>
    </Modal>
  );
};

export default FilePropertiesDialog;
