import CopyField from "../../components/ui/CopyField";
import type { ConnexionDatabase } from "../../interfaces";

/** Paramètres de connexion copiables (mot de passe et URL masqués par défaut). */
const ConnectionDetails = ({ connexion }: { connexion: ConnexionDatabase }) => (
  <div className="connection-grid">
    <CopyField label="Hôte" value={connexion.hote} />
    <CopyField label="Port" value={connexion.port} />
    {connexion.baseDeDonnees && <CopyField label="Base de données" value={connexion.baseDeDonnees} />}
    <CopyField label="Utilisateur" value={connexion.utilisateur} />
    <CopyField label="Mot de passe" value={connexion.motDePasse} secret />
    <div className="connection-grid-full">
      <CopyField label="URL de connexion" value={connexion.url} secret />
    </div>
  </div>
);

export default ConnectionDetails;
