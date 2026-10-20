import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { LuDatabase, LuKeyRound, LuPlay, LuSquare, LuTrash2 } from "react-icons/lu";
import {
  deleteDatabase,
  getDatabaseById,
  listDatabaseTypes,
  resetDatabasePassword,
  startDatabase,
  stopDatabase,
} from "../../api/database.api";
import Button from "../../components/ui/Button";
import Callout from "../../components/ui/Callout";
import ConfirmDialog from "../../components/ui/ConfirmDialog";
import CopyField from "../../components/ui/CopyField";
import EmptyState from "../../components/ui/EmptyState";
import LoadError from "../../components/ui/LoadError";
import Menu from "../../components/ui/Menu";
import PageHeader from "../../components/ui/PageHeader";
import Skeleton from "../../components/ui/Skeleton";
import StatusBadge from "../../components/ui/StatusBadge";
import { usePolling } from "../../hooks/usePolling";
import { useResource } from "../../hooks/useResource";
import { useSocketEvent } from "../../hooks/useSocketEvent";
import { formatDateTime } from "../../lib/format";
import { databaseStatus } from "../../lib/status";
import { useToast } from "../../redux/hooks/useToast";
import type { Database } from "../../interfaces";
import ConnectionDetails from "./ConnectionDetails";
import EngineIcon from "./EngineIcon";
import "./DatabasePage.css";

const DatabaseSelectedPage = () => {
  const { id = "" } = useParams();
  return <DatabaseDetail key={id} id={id} />;
};

const DatabaseDetail = ({ id }: { id: string }) => {
  const navigate = useNavigate();
  const toast = useToast();

  const db = useResource(() => getDatabaseById(id), [id]);
  const types = useResource(listDatabaseTypes);
  const [busy, setBusy] = useState<"start" | "stop" | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const [newPassword, setNewPassword] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const base = db.data?.baseDeDonnees;
  const etat = base?.etatBD;
  const notFound = !db.data && (db.status === 404 || db.status === 400);

  usePolling(() => void db.reload(true), etat === "CREATION", 3000);
  useSocketEvent<{ idBD: string; etat: Database["etatBD"]; message: string | null }>("database:etat", (p) => {
    if (p.idBD === id) void db.reload(true);
  });

  const toggle = async (action: "start" | "stop") => {
    setBusy(action);
    const res = action === "start" ? await startDatabase(id) : await stopDatabase(id);
    setBusy(null);
    if (!res.success) {
      toast.error(action === "start" ? "Démarrage impossible" : "Arrêt impossible", res.message);
      return;
    }
    toast.success(action === "start" ? "Base démarrée" : "Base arrêtée");
    void db.reload(true);
  };

  const handleReset = async () => {
    const res = await resetDatabasePassword(id);
    if (!res.success) {
      toast.error("Réinitialisation impossible", res.message);
      return false;
    }
    db.mutate((cur) => (cur ? { ...cur, connexion: res.data.connexion } : cur));
    setNewPassword(res.data.connexion.motDePasse);
    toast.success("Mot de passe réinitialisé", "Mettez à jour vos applications qui utilisent cette base.");
  };

  const handleDelete = async () => {
    const res = await deleteDatabase(id);
    if (!res.success) {
      toast.error("Suppression impossible", res.message);
      return false;
    }
    toast.success("Base supprimée", base?.nomBD);
    navigate("/database", { replace: true });
  };

  if (notFound) {
    return (
      <EmptyState
        icon={<LuDatabase size={20} />}
        title="Base introuvable"
        description="Cette base n'existe pas ou ne vous appartient pas."
        action={
          <Button variant="primary" onClick={() => navigate("/database")}>
            Retour aux bases
          </Button>
        }
      />
    );
  }

  const typeLabel = base ? (types.data?.find((t) => t.type === base.typeBD)?.label ?? base.typeBD) : "";

  return (
    <div>
      <PageHeader
        breadcrumbs={[{ label: "Bases de données", to: "/database" }, { label: base?.nomBD ?? "…" }]}
        title={base ? <span className="mono">{base.nomBD}</span> : <Skeleton width={200} height={28} />}
        meta={base && <StatusBadge status={databaseStatus(base.etatBD)} />}
        actions={
          base && (
            <>
              {etat === "ARRETE" ? (
                <Button variant="secondary" icon={<LuPlay size={15} />} loading={busy === "start"} onClick={() => toggle("start")}>
                  Démarrer
                </Button>
              ) : (
                <Button
                  variant="secondary"
                  icon={<LuSquare size={15} />}
                  loading={busy === "stop"}
                  disabled={etat !== "EN_LIGNE" || busy !== null}
                  onClick={() => toggle("stop")}
                >
                  Arrêter
                </Button>
              )}
              <Menu
                label="Autres actions"
                items={[
                  {
                    label: "Réinitialiser le mot de passe",
                    icon: <LuKeyRound size={16} />,
                    disabled: etat !== "EN_LIGNE",
                    onSelect: () => setConfirmReset(true),
                  },
                  { separator: true },
                  {
                    label: "Supprimer la base",
                    icon: <LuTrash2 size={16} />,
                    danger: true,
                    disabled: etat === "CREATION",
                    onSelect: () => setConfirmDelete(true),
                  },
                ]}
              />
            </>
          )
        }
      />

      {db.error && !db.data ? (
        <LoadError message={db.error} onRetry={() => db.reload()} retrying={db.refreshing} />
      ) : (
        <>
          {etat === "CREATION" && (
            <div className="detail-callout">
              <Callout tone="info" icon={<span className="spinner" />} title="Provisionnement en cours">
                {base?.messageEtat || "Téléchargement de l'image et création du conteneur. Cela peut prendre une minute."}
              </Callout>
            </div>
          )}
          {etat === "ERREUR" && (
            <div className="detail-callout">
              <Callout tone="danger" title="La base est en erreur">
                {base?.messageEtat || "Une erreur est survenue lors de la création ou du démarrage du conteneur."}
              </Callout>
            </div>
          )}
          {etat === "ARRETE" && (
            <div className="detail-callout">
              <Callout tone="warning">La base est arrêtée : elle n'accepte plus de connexions. Démarrez-la pour l'utiliser.</Callout>
            </div>
          )}

          <div className="detail-grid">
            <section className="card">
              <div className="card-header">
                <div>
                  <h2 className="card-title">Connexion</h2>
                  <p className="card-subtitle">Utilisez ces paramètres dans vos applications ou votre client SQL.</p>
                </div>
              </div>
              <div className="card-body">
                {db.data ? <ConnectionDetails connexion={db.data.connexion} /> : <Skeleton height={180} />}
              </div>
            </section>

            <section className="card">
              <div className="card-header">
                <h2 className="card-title">Informations</h2>
              </div>
              <div className="card-body">
                {base ? (
                  <dl className="dl">
                    <dt>Moteur</dt>
                    <dd>
                      <span className="row">
                        <EngineIcon type={base.typeBD} size={22} />
                        {typeLabel}
                      </span>
                    </dd>
                    <dt>Version</dt>
                    <dd className="mono">{base.versionBD ?? "—"}</dd>
                    <dt>Port hôte</dt>
                    <dd className="mono">{base.portHote ?? "—"}</dd>
                    <dt>Conteneur</dt>
                    <dd className="mono">{base.nomConteneur ?? "—"}</dd>
                    <dt>Image</dt>
                    <dd className="mono">{base.imageDocker ?? "—"}</dd>
                    <dt>Créée le</dt>
                    <dd>{formatDateTime(base.dateCreation)}</dd>
                  </dl>
                ) : (
                  <Skeleton height={180} />
                )}
              </div>
            </section>
          </div>
        </>
      )}

      <ConfirmDialog
        open={confirmReset}
        tone="default"
        title="Réinitialiser le mot de passe ?"
        description="Un nouveau mot de passe sera généré. Les applications utilisant l'ancien ne pourront plus se connecter."
        confirmLabel="Réinitialiser"
        onConfirm={handleReset}
        onClose={() => setConfirmReset(false)}
      />

      <ConfirmDialog
        open={!!newPassword}
        tone="default"
        title="Nouveau mot de passe"
        description="Il est aussi visible dans les paramètres de connexion de la base."
        confirmLabel="Terminé"
        cancelLabel="Fermer"
        onConfirm={() => setNewPassword(null)}
        onClose={() => setNewPassword(null)}
      >
        <CopyField label="Mot de passe" value={newPassword} />
      </ConfirmDialog>

      <ConfirmDialog
        open={confirmDelete}
        title={`Supprimer la base « ${base?.nomBD ?? ""} » ?`}
        description="Le conteneur et son volume seront supprimés. Toutes les données seront définitivement perdues."
        confirmLabel="Supprimer définitivement"
        requireText={base?.nomBD}
        onConfirm={handleDelete}
        onClose={() => setConfirmDelete(false)}
      />
    </div>
  );
};

export default DatabaseSelectedPage;
