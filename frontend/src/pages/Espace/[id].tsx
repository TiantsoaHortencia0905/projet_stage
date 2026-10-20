import { useCallback, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { LuArchive, LuCircleAlert, LuCircleCheck, LuCloudUpload, LuFiles, LuFolderOpen, LuPencil, LuTrash2, LuUpload, LuX } from "react-icons/lu";
import { GetSpace, listEspace, renameSpace, SupprSpace } from "../../api/espace.api";
import { getUploadFormats, listAllfilesBySpace, uploadFile } from "../../api/files.api";
import { useAuth } from "../../components/contexts/AuthContext";
import Button from "../../components/ui/Button";
import ConfirmDialog from "../../components/ui/ConfirmDialog";
import EmptyState from "../../components/ui/EmptyState";
import LoadError from "../../components/ui/LoadError";
import Menu from "../../components/ui/Menu";
import PageHeader from "../../components/ui/PageHeader";
import PromptDialog from "../../components/ui/PromptDialog";
import Skeleton from "../../components/ui/Skeleton";
import Tabs from "../../components/ui/Tabs";
import UsageBar from "../../components/ui/UsageBar";
import { useResource } from "../../hooks/useResource";
import { formatBytes, pluralize } from "../../lib/format";
import { validateName } from "../../lib/validation";
import { useToast } from "../../redux/hooks/useToast";
import FichierPage from "../Fichier/FichierPage";
import { extensionOf } from "../Fichier/fileTypes";
import "./EspacePage.css";

/** Limite par défaut si les formats du serveur n'ont pas pu être chargés ; le serveur reste l'arbitre final. */
const DEFAULT_MAX_FILE_SIZE = 2 * 1024 * 1024 * 1024;

const CATEGORY_LABELS: Record<string, string> = {
  images: "images",
  videos: "vidéos",
  audio: "audio",
  documents: "documents",
  tableurs: "tableurs",
  presentations: "présentations",
  archives: "archives",
  donnees: "données (JSON, XML, SQL…)",
};


type SpaceTab = "fichiers" | "archives";

interface UploadItem {
  id: string;
  name: string;
  size: number;
  progress: number;
  status: "pending" | "uploading" | "done" | "error";
  error?: string;
}

const SpaceById = () => {
  const { id = "" } = useParams();
  return <SpaceDetail key={id} id={id} />;
};

const SpaceDetail = ({ id }: { id: string }) => {
  const navigate = useNavigate();
  const toast = useToast();
  const { user } = useAuth();
  const userId = user?.id ?? "";

  const espace = useResource(() => GetSpace(id), [id]);
  const fichiers = useResource(() => listAllfilesBySpace(id), [id]);
  const archives = useResource(() => listAllfilesBySpace(id, true), [id]);
  const [params, setParams] = useSearchParams();
  const tab: SpaceTab = params.get("onglet") === "archives" ? "archives" : "fichiers";
  const setTab = (t: SpaceTab) => setParams(t === "archives" ? { onglet: "archives" } : {});
  const espaces = useResource(() => listEspace(userId), [userId]);
  const formats = useResource(getUploadFormats);

  const maxFileSize = formats.data?.tailleMax ?? DEFAULT_MAX_FILE_SIZE;
  const allowedExtensions = useMemo(() => new Set(Object.values(formats.data?.extensions ?? {}).flat()), [formats.data]);
  const acceptAttr = [...allowedExtensions].map((e) => `.${e}`).join(",");

  const [uploads, setUploads] = useState<UploadItem[]>([]);
  const [dragging, setDragging] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const dragDepth = useRef(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const queue = useRef<Promise<void>>(Promise.resolve());

  const refreshAll = useCallback(() => {
    void espace.reload(true);
    void fichiers.reload(true);
    void archives.reload(true);
    void espaces.reload(true);
  }, [espace, fichiers, archives, espaces]);

  const free = espace.data ? Math.max(0, espace.data.tailleEspace - espace.data.tailleOccupee) : 0;
  const notFound = espace.status === 404 || espace.status === 400;

  /* ─── Upload ─── */

  const patchUpload = (uid: string, patch: Partial<UploadItem>) =>
    setUploads((list) => list.map((u) => (u.id === uid ? { ...u, ...patch } : u)));

  const enqueue = async (files: File[]) => {
    if (!espace.data || files.length === 0) return;

    // Vérifications locales avant envoi : format, taille max et quota restant
    let budget = free;
    const items: { item: UploadItem; file: File }[] = files.map((file) => {
      const item: UploadItem = { id: `${file.name}-${file.size}-${Math.random()}`, name: file.name, size: file.size, progress: 0, status: "pending" };
      const ext = extensionOf(file.name);
      if (allowedExtensions.size > 0 && !allowedExtensions.has(ext)) {
        item.status = "error";
        item.error = ext ? `Format .${ext} non accepté.` : "Fichier sans extension : format non reconnu.";
      } else if (file.size > maxFileSize) {
        item.status = "error";
        item.error = `Dépasse la taille maximale de ${formatBytes(maxFileSize)}.`;
      } else if (file.size > budget) {
        item.status = "error";
        item.error = "Espace libre insuffisant dans cet espace.";
      } else {
        budget -= file.size;
      }
      return { item, file };
    });

    setUploads((list) => [...list.filter((u) => u.status === "uploading" || u.status === "pending"), ...items.map((i) => i.item)]);

    // Les lots s'enchaînent : un nouvel import attend la fin du précédent
    queue.current = queue.current.then(async () => {
      let ok = 0;
      let failed = items.filter((i) => i.item.status === "error").length;

      for (const { item, file } of items) {
        if (item.status === "error") continue;
        patchUpload(item.id, { status: "uploading" });
        const res = await uploadFile(file, id, (ratio) => patchUpload(item.id, { progress: ratio }));
        if (res.success) {
          ok++;
          patchUpload(item.id, { status: "done", progress: 1 });
        } else {
          failed++;
          patchUpload(item.id, { status: "error", error: res.message ?? "Échec de l'envoi." });
        }
      }

      if (ok > 0) {
        refreshAll();
        toast.success(ok > 1 ? `${ok} fichiers importés` : "Fichier importé");
      }
      if (failed > 0)
        toast.error(failed > 1 ? `${failed} fichiers n'ont pas été importés` : "Un fichier n'a pas été importé", "Consultez le détail ci-dessous.");
    });
  };

  const onDragEnter = (e: React.DragEvent) => {
    if (!e.dataTransfer.types.includes("Files")) return;
    e.preventDefault();
    dragDepth.current += 1;
    setDragging(true);
  };
  const onDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    dragDepth.current = Math.max(0, dragDepth.current - 1);
    if (dragDepth.current === 0) setDragging(false);
  };
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    dragDepth.current = 0;
    setDragging(false);
    void enqueue(Array.from(e.dataTransfer.files));
  };

  /* ─── Actions sur l'espace ─── */

  const handleRename = async (name: string) => {
    const res = await renameSpace(id, name);
    if (!res.success) return res.message ?? "Renommage impossible.";
    espace.mutate((cur) => (cur ? { ...cur, ...res.data } : cur));
    toast.success("Espace renommé");
    return null;
  };

  const handleDelete = async () => {
    const res = await SupprSpace(id);
    if (!res.success) {
      toast.error("Suppression impossible", res.message);
      return false;
    }
    toast.success("Espace supprimé", espace.data?.nomEspace);
    navigate("/espace", { replace: true });
  };

  const uploadSummary = useMemo(() => {
    const active = uploads.filter((u) => u.status === "uploading" || u.status === "pending").length;
    return { active, total: uploads.length };
  }, [uploads]);

  if (notFound) {
    return (
      <EmptyState
        icon={<LuFolderOpen size={20} />}
        title="Espace introuvable"
        description="Cet espace n'existe pas ou ne vous appartient pas."
        action={
          <Button variant="primary" onClick={() => navigate("/espace")}>
            Retour aux espaces
          </Button>
        }
      />
    );
  }

  const fileCount = fichiers.data?.length ?? espace.data?.idFichiers.length ?? 0;
  const importButton = (
    <Button variant="primary" icon={<LuUpload size={16} />} onClick={() => inputRef.current?.click()} disabled={!espace.data}>
      Importer des fichiers
    </Button>
  );

  return (
    <div className="space-detail" onDragEnter={onDragEnter} onDragLeave={onDragLeave} onDragOver={(e) => e.preventDefault()} onDrop={onDrop}>
      {dragging && (
        <div className="drop-overlay" aria-hidden>
          <div className="drop-overlay-box">
            <LuCloudUpload size={32} />
            <p>Déposez vos fichiers pour les importer</p>
            <span>dans « {espace.data?.nomEspace} » · {formatBytes(free)} disponibles</span>
          </div>
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        multiple
        accept={acceptAttr || undefined}
        hidden
        onChange={(e) => {
          void enqueue(Array.from(e.target.files ?? []));
          e.target.value = "";
        }}
      />

      <PageHeader
        breadcrumbs={[{ label: "Espaces de stockage", to: "/espace" }, { label: espace.data?.nomEspace ?? "…" }]}
        title={espace.data?.nomEspace ?? <Skeleton width={220} height={28} />}
        actions={
          <>
            <Menu
              label="Actions de l'espace"
              trigger={({ open, toggle, id: menuId }) => (
                <Button variant="secondary" onClick={toggle} aria-haspopup="menu" aria-expanded={open} aria-controls={open ? menuId : undefined} disabled={!espace.data}>
                  Gérer
                </Button>
              )}
              items={[
                { label: "Renommer", icon: <LuPencil size={16} />, onSelect: () => setRenaming(true) },
                { label: "Supprimer l'espace", icon: <LuTrash2 size={16} />, danger: true, onSelect: () => setDeleting(true) },
              ]}
            />
            {importButton}
          </>
        }
      />

      {espace.error && !espace.data ? (
        <LoadError message={espace.error} onRetry={() => espace.reload()} retrying={espace.refreshing} />
      ) : (
        <>
          <div className="card space-usage">
            {espace.data ? (
              <>
                <div className="space-usage-figures">
                  <div>
                    <p className="space-usage-label">Utilisé</p>
                    <p className="space-usage-value">{formatBytes(espace.data.tailleOccupee)}</p>
                  </div>
                  <div>
                    <p className="space-usage-label">Disponible</p>
                    <p className="space-usage-value">{formatBytes(free)}</p>
                  </div>
                  <div>
                    <p className="space-usage-label">Fichiers</p>
                    <p className="space-usage-value">{fileCount}</p>
                  </div>
                </div>
                <UsageBar used={espace.data.tailleOccupee} total={espace.data.tailleEspace} />
                {formats.data && (
                  <p className="space-formats" title={[...allowedExtensions].map((e) => `.${e}`).join("  ")}>
                    Formats acceptés : {Object.keys(formats.data.extensions).map((k) => CATEGORY_LABELS[k] ?? k).join(", ")} ·{" "}
                    {formatBytes(maxFileSize)} max par fichier
                  </p>
                )}
              </>
            ) : (
              <Skeleton height={56} />
            )}
          </div>

          {uploads.length > 0 && (
            <div className="card upload-panel">
              <div className="upload-panel-header">
                <p>
                  {uploadSummary.active > 0
                    ? `Import en cours · ${pluralize(uploadSummary.active, "fichier restant", "fichiers restants")}`
                    : "Imports terminés"}
                </p>
                {uploadSummary.active === 0 && (
                  <Button variant="ghost" size="sm" icon={<LuX size={14} />} onClick={() => setUploads([])}>
                    Effacer
                  </Button>
                )}
              </div>
              <ul className="upload-list">
                {uploads.map((u) => (
                  <li key={u.id} className={`upload-item is-${u.status}`}>
                    <span className="upload-status" aria-hidden>
                      {u.status === "done" ? (
                        <LuCircleCheck size={16} />
                      ) : u.status === "error" ? (
                        <LuCircleAlert size={16} />
                      ) : (
                        <span className="spinner" />
                      )}
                    </span>
                    <div className="upload-main">
                      <div className="upload-line">
                        <span className="truncate">{u.name}</span>
                        <span className="muted upload-size">{formatBytes(u.size)}</span>
                      </div>
                      {u.status === "error" ? (
                        <p className="upload-error">{u.error}</p>
                      ) : u.status !== "done" ? (
                        <div className="usage-track">
                          <div className="usage-fill" style={{ width: `${Math.round(u.progress * 100)}%` }} />
                        </div>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {fichiers.error && !fichiers.data ? (
            <LoadError message={fichiers.error} onRetry={() => fichiers.reload()} retrying={fichiers.refreshing} />
          ) : (
            <>
              <Tabs
                label="Contenu de l'espace"
                idPrefix="espace"
                value={tab}
                onChange={setTab}
                items={[
                  { id: "fichiers", label: "Fichiers", icon: <LuFiles size={16} />, count: fichiers.data?.length },
                  { id: "archives", label: "Archives", icon: <LuArchive size={16} />, count: archives.data?.length },
                ]}
              />
              <div role="tabpanel" id={`espace-panel-${tab}`} aria-labelledby={`espace-tab-${tab}`}>
                {tab === "archives" && archives.error && !archives.data ? (
                  <LoadError message={archives.error} onRetry={() => archives.reload()} retrying={archives.refreshing} />
                ) : (
                  <FichierPage
                    key={tab}
                    mode={tab === "archives" ? "archives" : "actifs"}
                    idEspace={id}
                    nomEspace={espace.data?.nomEspace}
                    fichiers={tab === "archives" ? archives.data : fichiers.data}
                    loading={tab === "archives" ? archives.loading : fichiers.loading}
                    espaces={espaces.data ?? []}
                    onChanged={refreshAll}
                    onLocalUpdate={tab === "archives" ? archives.mutate : fichiers.mutate}
                    emptyAction={importButton}
                  />
                )}
              </div>
            </>
          )}
        </>
      )}

      <PromptDialog
        open={renaming}
        title="Renommer l'espace"
        label="Nouveau nom"
        initialValue={espace.data?.nomEspace ?? ""}
        submitLabel="Renommer"
        validate={(v) => validateName(v, "Le nom")}
        onSubmit={handleRename}
        onClose={() => setRenaming(false)}
      />

      <ConfirmDialog
        open={deleting}
        title={`Supprimer « ${espace.data?.nomEspace ?? ""} » ?`}
        description={
          fileCount > 0
            ? `Les ${pluralize(fileCount, "fichier")} de cet espace seront définitivement supprimés, ainsi que ses fichiers archivés et ceux de sa corbeille.`
            : "Cet espace ne contient aucun fichier visible ; ses éventuels fichiers archivés ou en corbeille seront aussi supprimés. Action irréversible."
        }
        confirmLabel="Supprimer l'espace"
        onConfirm={handleDelete}
        onClose={() => setDeleting(false)}
      />
    </div>
  );
};

export default SpaceById;
