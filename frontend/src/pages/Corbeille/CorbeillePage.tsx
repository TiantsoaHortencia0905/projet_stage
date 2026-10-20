import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { LuRotateCcw, LuSearch, LuTrash, LuTrash2 } from "react-icons/lu";
import { deleteFile, emptyTrash, listTrash, restoreFile, type TrashItem } from "../../api/files.api";
import Button from "../../components/ui/Button";
import Callout from "../../components/ui/Callout";
import ConfirmDialog from "../../components/ui/ConfirmDialog";
import EmptyState from "../../components/ui/EmptyState";
import LoadError from "../../components/ui/LoadError";
import Menu from "../../components/ui/Menu";
import PageHeader from "../../components/ui/PageHeader";
import { SkeletonRows } from "../../components/ui/Skeleton";
import { useResource } from "../../hooks/useResource";
import { formatBytes, formatDate, formatRelative, pluralize } from "../../lib/format";
import { useToast } from "../../redux/hooks/useToast";
import { fileKind } from "../Fichier/fileTypes";
import Pagination from "../../components/ui/Pagination";
import { usePagination } from "../../hooks/usePagination";
import "./CorbeillePage.css";

const DAY = 86_400_000;

/** Échéance de suppression définitive : « dans 12 jours », « demain »… et si elle est proche (moins de 3 jours). */
const purgeInfo = (datePurge: string) => {
  const days = Math.ceil((new Date(datePurge).getTime() - Date.now()) / DAY);
  const label = days <= 0 ? "aujourd'hui" : days === 1 ? "demain" : `dans ${days} jours`;
  return { label, soon: days <= 3 };
};

const CorbeillePage = () => {
  const toast = useToast();
  const trash = useResource(listTrash);
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<TrashItem | null>(null);
  const [emptying, setEmptying] = useState(false);

  const items = useMemo(() => trash.data?.items ?? [], [trash.data]);
  const totalSize = items.reduce((s, f) => s + f.tailleFichier, 0);
  const retention = trash.data?.retentionJours ?? 30;

  const list = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((f) => !q || f.nomFichier.toLowerCase().includes(q) || f.nomEspace?.toLowerCase().includes(q));
  }, [items, search]);

  const removeLocal = (idFichier: string) =>
    trash.mutate((cur) => cur && { ...cur, items: cur.items.filter((f) => f.idFichier !== idFichier) });

  const handleRestore = async (f: TrashItem) => {
    setBusy(f.idFichier);
    const res = await restoreFile(f.idFichier);
    setBusy(null);
    if (!res.success) {
      toast.error("Restauration impossible", res.message);
      return;
    }
    removeLocal(f.idFichier);
    toast.success(res.message ?? "Fichier restauré", f.nomEspace ? `Dans l'espace « ${f.nomEspace} ».` : undefined);
  };

  const handleDelete = async () => {
    if (!deleting) return;
    const res = await deleteFile(deleting.idFichier);
    if (!res.success) {
      toast.error("Suppression impossible", res.message);
      return false;
    }
    removeLocal(deleting.idFichier);
    toast.success("Fichier supprimé définitivement", deleting.nomFichier);
  };

  const handleEmpty = async () => {
    const res = await emptyTrash();
    if (!res.success) {
      toast.error("La corbeille n'a pas pu être entièrement vidée", res.message);
      void trash.reload(true);
      return false;
    }
    trash.mutate((cur) => cur && { ...cur, items: [] });
    toast.success("Corbeille vidée", `${pluralize(res.data.supprimes, "fichier supprimé", "fichiers supprimés")} définitivement.`);
  };

  const pagination = usePagination(list, "corbeille", search);

  return (
    <div>
      <PageHeader
        title="Corbeille"
        description={`Les fichiers supprimés y restent ${retention} jours, puis sont effacés définitivement.`}
        actions={
          <Button variant="danger" icon={<LuTrash size={15} />} onClick={() => setEmptying(true)} disabled={items.length === 0}>
            Vider la corbeille
          </Button>
        }
      />

      {items.length > 0 && (
        <div className="trash-info">
          <Callout tone="info">
            {pluralize(items.length, "fichier")} · {formatBytes(totalSize)}.{" "}
            {items.length > 1
              ? "Tant qu'ils sont dans la corbeille, ces fichiers comptent dans le quota de leur espace."
              : "Tant qu'il est dans la corbeille, ce fichier compte dans le quota de son espace."}
          </Callout>
        </div>
      )}

      {trash.error && !trash.data ? (
        <LoadError message={trash.error} onRetry={() => trash.reload()} retrying={trash.refreshing} />
      ) : (
        <div className="card">
          {!trash.loading && items.length === 0 ? (
            <EmptyState
              icon={<LuTrash2 size={20} />}
              title="La corbeille est vide"
              description="Les fichiers que vous supprimez d'un espace apparaissent ici. Vous pouvez les restaurer tant qu'ils n'ont pas été effacés."
            />
          ) : (
            <>
              <div className="toolbar">
                <div className="input-group">
                  <span className="input-icon-left">
                    <LuSearch size={15} />
                  </span>
                  <input
                    className="input"
                    type="search"
                    placeholder="Rechercher dans la corbeille…"
                    aria-label="Rechercher dans la corbeille"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
              </div>
              {!trash.loading && list.length === 0 ? (
                <EmptyState compact icon={<LuSearch size={20} />} title="Aucun résultat" description={`Aucun fichier ne correspond à « ${search} ».`} />
              ) : (
                <>
                  <div className="table-wrap">
                    <table className="table">
                      <thead>
                        <tr>
                          <th>Nom</th>
                          <th className="col-origin">Espace d'origine</th>
                          <th className="col-num">Taille</th>
                          <th className="col-deleted">Supprimé</th>
                          <th className="col-purge">Effacement</th>
                          <th className="col-actions">
                            <span className="visually-hidden">Actions</span>
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {trash.loading ? (
                          <SkeletonRows columns={6} rows={3} />
                        ) : (
                          pagination.pageItems.map((f) => {
                            const kind = fileKind(f.nomFichier);
                            const purge = purgeInfo(f.datePurge);
                            return (
                              <tr key={f.idFichier}>
                                <td>
                                  <div className="row gap-12">
                                    <span className="res-icon">{kind.icon}</span>
                                    <span className="res-name truncate trash-name" title={f.nomFichier}>
                                      {f.nomFichier}
                                    </span>
                                  </div>
                                </td>
                                <td className="col-origin">
                                  {f.nomEspace && f.idEspaces[0] ? (
                                    <Link to={`/espace/${f.idEspaces[0]}`}>{f.nomEspace}</Link>
                                  ) : (
                                    <span className="muted">—</span>
                                  )}
                                </td>
                                <td className="col-num muted">{formatBytes(f.tailleFichier)}</td>
                                <td className="col-deleted muted" title={formatDate(f.dateSuppression)}>
                                  {formatRelative(f.dateSuppression)}
                                </td>
                                <td className={`col-purge${purge.soon ? " is-soon" : ""}`} title={formatDate(f.datePurge)}>
                                  {purge.label}
                                </td>
                                <td className="col-actions">
                                  <div className="row gap-4">
                                    <Button
                                      variant="secondary"
                                      size="sm"
                                      icon={<LuRotateCcw size={14} />}
                                      loading={busy === f.idFichier}
                                      onClick={() => handleRestore(f)}
                                    >
                                      Restaurer
                                    </Button>
                                    <Menu
                                      label={`Actions pour ${f.nomFichier}`}
                                      items={[
                                        {
                                          label: "Supprimer définitivement",
                                          icon: <LuTrash2 size={16} />,
                                          danger: true,
                                          onSelect: () => setDeleting(f),
                                        },
                                      ]}
                                    />
                                  </div>
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                  <Pagination {...pagination} itemsLabel={["fichier", "fichiers"]} />
                </>
              )}
            </>
          )}
        </div>
      )}

      <ConfirmDialog
        open={!!deleting}
        title="Supprimer définitivement ce fichier ?"
        description={
          <>
            <strong>{deleting?.nomFichier}</strong> sera effacé et ne pourra plus être restauré. L'espace occupé sera libéré.
          </>
        }
        confirmLabel="Supprimer définitivement"
        onConfirm={handleDelete}
        onClose={() => setDeleting(null)}
      />

      <ConfirmDialog
        open={emptying}
        title="Vider la corbeille ?"
        description={`Les ${pluralize(items.length, "fichier")} de la corbeille (${formatBytes(totalSize)}) seront effacés définitivement. Cette action est irréversible.`}
        confirmLabel="Vider la corbeille"
        onConfirm={handleEmpty}
        onClose={() => setEmptying(false)}
      />
    </div>
  );
};

export default CorbeillePage;
