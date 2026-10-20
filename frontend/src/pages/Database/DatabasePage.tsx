import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { LuDatabase, LuExternalLink, LuPlay, LuPlus, LuSquare, LuTrash2 } from "react-icons/lu";
import {
  deleteDatabase,
  listAllDatabases,
  listDatabaseTypes,
  startDatabase,
  stopDatabase,
  type DatabaseWithConnexion,
} from "../../api/database.api";
import Button from "../../components/ui/Button";
import Callout from "../../components/ui/Callout";
import ConfirmDialog from "../../components/ui/ConfirmDialog";
import EmptyState from "../../components/ui/EmptyState";
import LoadError from "../../components/ui/LoadError";
import Menu from "../../components/ui/Menu";
import Modal from "../../components/ui/Modal";
import PageHeader from "../../components/ui/PageHeader";
import { SkeletonRows } from "../../components/ui/Skeleton";
import StatusBadge from "../../components/ui/StatusBadge";
import { usePolling } from "../../hooks/usePolling";
import { useResource } from "../../hooks/useResource";
import { useSocketEvent } from "../../hooks/useSocketEvent";
import { formatDate } from "../../lib/format";
import { databaseStatus } from "../../lib/status";
import { useToast } from "../../redux/hooks/useToast";
import type { Database } from "../../interfaces";
import ConnectionDetails from "./ConnectionDetails";
import CreateDatabaseDialog from "./CreateDatabaseDialog";
import EngineIcon from "./EngineIcon";
import Pagination from "../../components/ui/Pagination";
import { usePagination } from "../../hooks/usePagination";
import "./DatabasePage.css";

/** Limite imposée par le serveur. */
const MAX_DATABASES = 5;

const DatabasePage = () => {
  const navigate = useNavigate();
  const toast = useToast();

  const databases = useResource(listAllDatabases);
  const types = useResource(listDatabaseTypes);
  const [creating, setCreating] = useState(false);
  const [created, setCreated] = useState<DatabaseWithConnexion | null>(null);
  const [deleting, setDeleting] = useState<Database | null>(null);
  const [pendingAction, setPendingAction] = useState<string | null>(null);

  const list = databases.data ?? [];
  const count = list.length;
  const limitReached = count >= MAX_DATABASES;
  const provisioning = list.some((d) => d.etatBD === "CREATION");

  // Suivi du provisionnement : temps réel + rafraîchissement de secours
  usePolling(() => void databases.reload(true), provisioning, 4000);
  useSocketEvent<{ idBD: string; etat: Database["etatBD"]; message: string | null }>("database:etat", (p) => {
    databases.mutate((cur) => cur?.map((d) => (d.idBD === p.idBD ? { ...d, etatBD: p.etat, messageEtat: p.message } : d)));
  });

  const typeLabel = (type: string) => types.data?.find((t) => t.type === type)?.label ?? type;

  const toggle = async (db: Database) => {
    const starting = db.etatBD === "ARRETE";
    setPendingAction(db.idBD);
    const res = starting ? await startDatabase(db.idBD) : await stopDatabase(db.idBD);
    setPendingAction(null);
    if (!res.success) {
      toast.error(starting ? "Démarrage impossible" : "Arrêt impossible", res.message);
      return;
    }
    toast.success(starting ? "Base démarrée" : "Base arrêtée", db.nomBD);
    void databases.reload(true);
  };

  const handleDelete = async () => {
    if (!deleting) return;
    const res = await deleteDatabase(deleting.idBD);
    if (!res.success) {
      toast.error("Suppression impossible", res.message);
      return false;
    }
    databases.mutate((cur) => cur?.filter((d) => d.idBD !== deleting.idBD));
    toast.success("Base supprimée", `« ${deleting.nomBD} » et ses données ont été supprimées.`);
  };

  const newButton = (
    <Button
      variant="primary"
      icon={<LuPlus size={16} />}
      onClick={() => setCreating(true)}
      disabled={limitReached || databases.loading}
      title={limitReached ? `Limite de ${MAX_DATABASES} bases atteinte` : undefined}
    >
      Nouvelle base
    </Button>
  );

  const pagination = usePagination(list, "bases");

  return (
    <div>
      <PageHeader
        title="Bases de données"
        description="Instances dédiées et isolées, prêtes à être utilisées par vos applications."
        actions={newButton}
      />

      {limitReached && (
        <div style={{ marginBottom: 16 }}>
          <Callout tone="info">
            Vous utilisez {count} bases sur {MAX_DATABASES}. Supprimez une base inutilisée pour en créer une nouvelle.
          </Callout>
        </div>
      )}

      {databases.error && !databases.data ? (
        <LoadError message={databases.error} onRetry={() => databases.reload()} retrying={databases.refreshing} />
      ) : !databases.loading && count === 0 ? (
        <div className="card">
          <EmptyState
            icon={<LuDatabase size={20} />}
            title="Aucune base de données"
            description="PostgreSQL, MySQL, MariaDB, MongoDB ou Redis : choisissez un moteur, ArchiCloud s'occupe du reste."
            action={
              <Button variant="primary" icon={<LuPlus size={16} />} onClick={() => setCreating(true)}>
                Créer une base
              </Button>
            }
          />
        </div>
      ) : (
        <div className="card">
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Nom</th>
                  <th>Moteur</th>
                  <th>État</th>
                  <th className="col-port">Port</th>
                  <th className="col-date">Créée le</th>
                  <th className="col-actions">
                    <span className="visually-hidden">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {databases.loading ? (
                  <SkeletonRows columns={6} rows={3} />
                ) : (
                  pagination.pageItems.map((db) => (
                    <tr key={db.idBD} className="is-clickable" onClick={() => navigate(`/database/${db.idBD}`)}>
                      <td>
                        <div className="row gap-12">
                          <EngineIcon type={db.typeBD} />
                          <a
                            href={`/database/${db.idBD}`}
                            className="res-name mono"
                            onClick={(e) => {
                              e.preventDefault();
                              navigate(`/database/${db.idBD}`);
                            }}
                          >
                            {db.nomBD}
                          </a>
                        </div>
                      </td>
                      <td>
                        {typeLabel(db.typeBD)} <span className="muted">{db.versionBD}</span>
                      </td>
                      <td>
                        <StatusBadge status={databaseStatus(db.etatBD)} />
                      </td>
                      <td className="col-port mono">{db.portHote ?? "—"}</td>
                      <td className="col-date muted">{formatDate(db.dateCreation)}</td>
                      <td className="col-actions">
                        {pendingAction === db.idBD ? (
                          <span className="spinner" style={{ color: "var(--text-3)", margin: "0 9px" }} aria-label="Action en cours" />
                        ) : (
                          <Menu
                            label={`Actions pour ${db.nomBD}`}
                            items={[
                              { label: "Voir les accès", icon: <LuExternalLink size={16} />, onSelect: () => navigate(`/database/${db.idBD}`) },
                              db.etatBD === "ARRETE"
                                ? { label: "Démarrer", icon: <LuPlay size={16} />, onSelect: () => void toggle(db) }
                                : {
                                    label: "Arrêter",
                                    icon: <LuSquare size={16} />,
                                    disabled: db.etatBD !== "EN_LIGNE",
                                    onSelect: () => void toggle(db),
                                  },
                              { separator: true },
                              {
                                label: "Supprimer",
                                icon: <LuTrash2 size={16} />,
                                danger: true,
                                disabled: db.etatBD === "CREATION",
                                onSelect: () => setDeleting(db),
                              },
                            ]}
                          />
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <Pagination {...pagination} itemsLabel={["base", "bases"]}
            aside={<span>{count} / {MAX_DATABASES} bases utilisées</span>} />
        </div>
      )}

      <CreateDatabaseDialog
        open={creating}
        types={types.data}
        typesError={types.error}
        onClose={() => setCreating(false)}
        onCreated={(result) => {
          setCreating(false);
          setCreated(result);
          databases.mutate((cur) => [...(cur ?? []), result.baseDeDonnees]);
          toast.success("Création lancée", `« ${result.baseDeDonnees.nomBD} » sera disponible dans quelques instants.`);
        }}
      />

      <Modal
        open={!!created}
        onClose={() => setCreated(null)}
        size="md"
        title="Accès à votre base de données"
        description="Ces informations restent consultables à tout moment depuis la page de la base."
        icon={<LuDatabase size={18} />}
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => {
                const id = created?.baseDeDonnees.idBD;
                setCreated(null);
                if (id) navigate(`/database/${id}`);
              }}
            >
              Ouvrir la base
            </Button>
            <Button variant="primary" onClick={() => setCreated(null)}>
              Terminé
            </Button>
          </>
        }
      >
        {created && (
          <>
            <div style={{ marginBottom: 16 }}>
              <Callout tone="info">
                Le conteneur est en cours de création. La base sera joignable dès qu'elle passera à l'état « En ligne ».
              </Callout>
            </div>
            <ConnectionDetails connexion={created.connexion} />
          </>
        )}
      </Modal>

      <ConfirmDialog
        open={!!deleting}
        title={`Supprimer la base « ${deleting?.nomBD ?? ""} » ?`}
        description="Le conteneur et son volume seront supprimés. Toutes les données seront définitivement perdues."
        confirmLabel="Supprimer définitivement"
        requireText={deleting?.nomBD}
        onConfirm={handleDelete}
        onClose={() => setDeleting(null)}
      />
    </div>
  );
};

export default DatabasePage;
