import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { LuFolderOpen, LuFolderPlus, LuPencil, LuPlus, LuSearch, LuTrash2 } from "react-icons/lu";
import { listEspace, newSpace, renameSpace, SupprSpace } from "../../api/espace.api";
import { useAuth } from "../../components/contexts/AuthContext";
import Button from "../../components/ui/Button";
import ConfirmDialog from "../../components/ui/ConfirmDialog";
import EmptyState from "../../components/ui/EmptyState";
import LoadError from "../../components/ui/LoadError";
import Menu from "../../components/ui/Menu";
import PageHeader from "../../components/ui/PageHeader";
import PromptDialog from "../../components/ui/PromptDialog";
import { SkeletonRows } from "../../components/ui/Skeleton";
import UsageBar from "../../components/ui/UsageBar";
import { useResource } from "../../hooks/useResource";
import { formatBytes, pluralize } from "../../lib/format";
import { validateName } from "../../lib/validation";
import { useToast } from "../../redux/hooks/useToast";
import type { Espace } from "../../interfaces";
import Pagination from "../../components/ui/Pagination";
import { usePagination } from "../../hooks/usePagination";
import "./EspacePage.css";

const EspacePage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const userId = user?.id ?? "";

  const espaces = useResource(() => listEspace(userId), [userId]);
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);
  const [renaming, setRenaming] = useState<Espace | null>(null);
  const [deleting, setDeleting] = useState<Espace | null>(null);

  const list = useMemo(() => {
    const q = search.trim().toLowerCase();
    return [...(espaces.data ?? [])]
      .filter((e) => !q || e.nomEspace.toLowerCase().includes(q))
      .sort((a, b) => a.nomEspace.localeCompare(b.nomEspace, "fr"));
  }, [espaces.data, search]);

  const totals = useMemo(() => {
    const all = espaces.data ?? [];
    return {
      used: all.reduce((s, e) => s + e.tailleOccupee, 0),
      total: all.reduce((s, e) => s + e.tailleEspace, 0),
    };
  }, [espaces.data]);

  const handleCreate = async (name: string) => {
    const res = await newSpace(name, userId);
    if (!res.success) return res.message ?? "Création impossible.";
    espaces.mutate((current) => [...(current ?? []), res.data]);
    toast.success("Espace créé", `« ${res.data.nomEspace} » est prêt à recevoir vos fichiers.`);
    return null;
  };

  const handleRename = async (name: string) => {
    if (!renaming) return null;
    const res = await renameSpace(renaming.idEspace, name);
    if (!res.success) return res.message ?? "Renommage impossible.";
    espaces.mutate((current) => current?.map((e) => (e.idEspace === renaming.idEspace ? { ...e, ...res.data } : e)));
    toast.success("Espace renommé");
    return null;
  };

  const handleDelete = async () => {
    if (!deleting) return;
    const res = await SupprSpace(deleting.idEspace);
    if (!res.success) {
      toast.error("Suppression impossible", res.message);
      return false;
    }
    espaces.mutate((current) => current?.filter((e) => e.idEspace !== deleting.idEspace));
    toast.success("Espace supprimé", `« ${deleting.nomEspace} » et ses fichiers ont été supprimés.`);
  };

  const count = espaces.data?.length ?? 0;

  const pagination = usePagination(list, "espaces", search);

  return (
    <div>
      <PageHeader
        title="Espaces de stockage"
        description="Organisez vos fichiers dans des espaces indépendants, chacun avec son propre quota."
        actions={
          <Button variant="primary" icon={<LuPlus size={16} />} onClick={() => setCreating(true)}>
            Nouvel espace
          </Button>
        }
      />

      {espaces.error && !espaces.data ? (
        <LoadError message={espaces.error} onRetry={() => espaces.reload()} retrying={espaces.refreshing} />
      ) : (
        <>
          {count > 0 && (
            <div className="card storage-summary">
              <div>
                <p className="storage-summary-label">Utilisation totale</p>
                <p className="storage-summary-value">
                  {formatBytes(totals.used)} <span>sur {formatBytes(totals.total)}</span>
                </p>
              </div>
              <div className="storage-summary-bar">
                <UsageBar used={totals.used} total={totals.total} legend={false} />
                <p className="muted">{pluralize(count, "espace")}</p>
              </div>
            </div>
          )}

          <div className="card">
            {count > 0 && (
              <div className="toolbar">
                <div className="input-group">
                  <span className="input-icon-left">
                    <LuSearch size={15} />
                  </span>
                  <input
                    className="input"
                    type="search"
                    placeholder="Rechercher un espace…"
                    aria-label="Rechercher un espace"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
              </div>
            )}

            {!espaces.loading && count === 0 ? (
              <EmptyState
                icon={<LuFolderOpen size={20} />}
                title="Aucun espace de stockage"
                description="Créez votre premier espace pour commencer à déposer des fichiers."
                action={
                  <Button variant="primary" icon={<LuFolderPlus size={16} />} onClick={() => setCreating(true)}>
                    Créer un espace
                  </Button>
                }
              />
            ) : !espaces.loading && list.length === 0 ? (
              <EmptyState compact icon={<LuSearch size={20} />} title="Aucun résultat" description={`Aucun espace ne correspond à « ${search} ».`} />
            ) : (
              <>
                <div className="table-wrap">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Nom</th>
                        <th className="col-usage">Utilisation</th>
                        <th className="col-num">Fichiers</th>
                        <th className="col-actions">
                          <span className="visually-hidden">Actions</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {espaces.loading ? (
                        <SkeletonRows columns={4} rows={3} />
                      ) : (
                        pagination.pageItems.map((e) => (
                          <tr key={e.idEspace} className="is-clickable" onClick={() => navigate(`/espace/${e.idEspace}`)}>
                            <td>
                              <div className="row gap-12">
                                <span className="res-icon res-icon-accent">
                                  <LuFolderOpen size={16} />
                                </span>
                                <a
                                  href={`/espace/${e.idEspace}`}
                                  className="res-name truncate"
                                  onClick={(ev) => {
                                    ev.preventDefault();
                                    navigate(`/espace/${e.idEspace}`);
                                  }}
                                >
                                  {e.nomEspace}
                                </a>
                              </div>
                            </td>
                            <td className="col-usage">
                              <UsageBar used={e.tailleOccupee} total={e.tailleEspace} />
                            </td>
                            <td className="col-num">{e.idFichiers?.length ?? 0}</td>
                            <td className="col-actions">
                              <Menu
                                label={`Actions pour ${e.nomEspace}`}
                                items={[
                                  { label: "Ouvrir", icon: <LuFolderOpen size={16} />, onSelect: () => navigate(`/espace/${e.idEspace}`) },
                                  { label: "Renommer", icon: <LuPencil size={16} />, onSelect: () => setRenaming(e) },
                                  { separator: true },
                                  { label: "Supprimer", icon: <LuTrash2 size={16} />, danger: true, onSelect: () => setDeleting(e) },
                                ]}
                              />
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
                <Pagination {...pagination} itemsLabel={["espace", "espaces"]} />
              </>
            )}
          </div>
        </>
      )}

      <PromptDialog
        open={creating}
        title="Nouvel espace de stockage"
        description="Chaque espace dispose d'un quota de 2 Go."
        label="Nom de l'espace"
        placeholder="ex. Documents projet"
        submitLabel="Créer l'espace"
        icon={<LuFolderPlus size={18} />}
        validate={(v) => validateName(v, "Le nom")}
        onSubmit={handleCreate}
        onClose={() => setCreating(false)}
      />

      <PromptDialog
        open={!!renaming}
        title="Renommer l'espace"
        label="Nouveau nom"
        initialValue={renaming?.nomEspace ?? ""}
        submitLabel="Renommer"
        validate={(v) => validateName(v, "Le nom")}
        onSubmit={handleRename}
        onClose={() => setRenaming(null)}
      />

      <ConfirmDialog
        open={!!deleting}
        title={`Supprimer « ${deleting?.nomEspace ?? ""} » ?`}
        description={
          deleting && (deleting.idFichiers?.length ?? 0) > 0
            ? `Les ${pluralize(deleting.idFichiers.length, "fichier")} de cet espace seront définitivement supprimés, ainsi que ses fichiers archivés et ceux de sa corbeille.`
            : "Cet espace ne contient aucun fichier visible ; ses éventuels fichiers archivés ou en corbeille seront aussi supprimés. Action irréversible."
        }
        confirmLabel="Supprimer l'espace"
        onConfirm={handleDelete}
        onClose={() => setDeleting(null)}
      />
    </div>
  );
};

export default EspacePage;
