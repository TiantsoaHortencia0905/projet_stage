import { useMemo, useState } from "react";
import {
  LuArchive,
  LuArchiveRestore,
  LuArrowDown,
  LuArrowUp,
  LuCopy,
  LuCopyPlus,
  LuDownload,
  LuExternalLink,
  LuFiles,
  LuFolderInput,
  LuInfo,
  LuPencil,
  LuSearch,
  LuTrash2,
} from "react-icons/lu";
import { archiveFile, copyFile, duplicateFile, fileUrl, moveFile, renameFile, trashFile, unarchiveFile } from "../../api/files.api";
import Button from "../../components/ui/Button";
import EmptyState from "../../components/ui/EmptyState";
import Field from "../../components/ui/Field";
import Menu, { type MenuEntry } from "../../components/ui/Menu";
import Modal from "../../components/ui/Modal";
import Pagination from "../../components/ui/Pagination";
import PromptDialog from "../../components/ui/PromptDialog";
import { SkeletonRows } from "../../components/ui/Skeleton";
import { usePagination } from "../../hooks/usePagination";
import { formatBytes, formatDateTime, formatRelative } from "../../lib/format";
import { useToast } from "../../redux/hooks/useToast";
import type { Espace, Fichier } from "../../interfaces";
import FilePropertiesDialog from "./FilePropertiesDialog";
import { fileKind } from "./fileTypes";
import "./FichierPage.css";

type SortKey = "name" | "size" | "date";

interface FichierPageProps {
  idEspace: string;
  /** Nom de l'espace (emplacement affiché dans les propriétés). */
  nomEspace?: string;
  fichiers: Fichier[] | undefined;
  loading: boolean;
  /** « archives » : fichiers figés (consultation, désarchivage, corbeille uniquement). */
  mode?: "actifs" | "archives";
  /** Tous les espaces de l'utilisateur (destinations de copie / déplacement). */
  espaces: Espace[];
  /** À appeler après toute opération qui modifie l'espace (taille occupée, listes). */
  onChanged: () => void;
  onLocalUpdate: (updater: (current: Fichier[] | undefined) => Fichier[] | undefined) => void;
  emptyAction?: React.ReactNode;
}

/** Liste des fichiers (actifs ou archivés) d'un espace, avec recherche, tri, pagination et actions. */
const FichierPage = ({ idEspace, nomEspace, fichiers, loading, mode = "actifs", espaces, onChanged, onLocalUpdate, emptyAction }: FichierPageProps) => {
  const toast = useToast();
  const archived = mode === "archives";
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "date", dir: -1 });
  const [renaming, setRenaming] = useState<Fichier | null>(null);
  const [transfer, setTransfer] = useState<{ file: Fichier; mode: "copy" | "move" } | null>(null);
  const [details, setDetails] = useState<Fichier | null>(null);

  /** Date affichée : d'archivage pour les archives, d'ajout sinon. */
  const dateOf = (f: Fichier) => (archived ? f.dateArchivage : f.dateCreation) ?? f.dateCreation;

  const list = useMemo(() => {
    const q = search.trim().toLowerCase();
    return [...(fichiers ?? [])]
      .filter((f) => !q || f.nomFichier.toLowerCase().includes(q))
      .sort((a, b) =>
        sort.key === "name"
          ? a.nomFichier.localeCompare(b.nomFichier, "fr", { numeric: true }) * sort.dir
          : sort.key === "size"
            ? (a.tailleFichier - b.tailleFichier) * sort.dir
            : (dateOf(a) ?? "").localeCompare(dateOf(b) ?? "") * sort.dir,
      );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fichiers, search, sort, archived]);

  const pagination = usePagination(list, archived ? "archives" : "fichiers", search);

  const toggleSort = (key: SortKey) =>
    setSort((s) => (s.key === key ? { key, dir: s.dir === 1 ? -1 : 1 } : { key, dir: key === "name" ? 1 : -1 }));
  const ariaSort = (key: SortKey) => (sort.key === key ? (sort.dir === 1 ? "ascending" : "descending") : "none");
  const sortIcon = (key: SortKey) => (sort.key === key ? sort.dir === 1 ? <LuArrowUp size={12} /> : <LuArrowDown size={12} /> : null);

  /* ─── Actions ─── */

  const download = async (f: Fichier) => {
    try {
      const res = await fetch(fileUrl(f));
      if (!res.ok) throw new Error();
      const url = URL.createObjectURL(await res.blob());
      const a = document.createElement("a");
      a.href = url;
      a.download = f.nomFichier;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      toast.error("Téléchargement impossible", "Le fichier n'a pas pu être récupéré.");
    }
  };

  const handleRename = async (name: string) => {
    if (!renaming) return null;
    const res = await renameFile(renaming.idFichier, name);
    if (!res.success) return res.message ?? "Renommage impossible.";
    onLocalUpdate((cur) => cur?.map((f) => (f.idFichier === renaming.idFichier ? { ...f, ...res.data } : f)));
    toast.success("Fichier renommé");
    return null;
  };

  const handleDuplicate = async (f: Fichier) => {
    const res = await duplicateFile(f.idFichier);
    if (!res.success) {
      toast.error("Duplication impossible", res.message);
      return;
    }
    toast.success("Fichier dupliqué", res.data.nomFichier);
    onChanged();
  };

  /** Retire le fichier de la liste tout de suite, exécute l'action, rétablit la liste en cas d'échec. */
  const removeThen = async (f: Fichier, action: () => ReturnType<typeof trashFile>, failure: string, success: [string, string]) => {
    onLocalUpdate((cur) => cur?.filter((x) => x.idFichier !== f.idFichier));
    const res = await action();
    if (!res.success) {
      toast.error(failure, res.message);
    } else {
      toast.success(...success);
    }
    onChanged();
  };

  /** Réversibles : pas de confirmation. */
  const handleTrash = (f: Fichier) =>
    removeThen(f, () => trashFile(f.idFichier), "Impossible de mettre à la corbeille", [
      "Fichier placé dans la corbeille",
      `« ${f.nomFichier} » reste restaurable depuis la page Corbeille.`,
    ]);
  const handleArchive = (f: Fichier) =>
    removeThen(f, () => archiveFile(f.idFichier), "Archivage impossible", ["Fichier archivé", `« ${f.nomFichier} » est conservé dans l'onglet Archives.`]);
  const handleUnarchive = (f: Fichier) =>
    removeThen(f, () => unarchiveFile(f.idFichier), "Désarchivage impossible", ["Fichier désarchivé", `« ${f.nomFichier} » est de retour dans les fichiers.`]);

  const menuItems = (f: Fichier): MenuEntry[] => {
    const consult: MenuEntry[] = [
      { label: "Ouvrir dans un onglet", icon: <LuExternalLink size={16} />, onSelect: () => window.open(fileUrl(f), "_blank", "noopener") },
      { label: "Propriétés", icon: <LuInfo size={16} />, onSelect: () => setDetails(f) },
    ];
    const trash: MenuEntry = { label: "Mettre à la corbeille", icon: <LuTrash2 size={16} />, danger: true, onSelect: () => void handleTrash(f) };
    if (archived) {
      return [...consult, { separator: true }, { label: "Désarchiver", icon: <LuArchiveRestore size={16} />, onSelect: () => void handleUnarchive(f) }, { separator: true }, trash];
    }
    return [
      ...consult,
      { separator: true },
      { label: "Renommer", icon: <LuPencil size={16} />, onSelect: () => setRenaming(f) },
      { label: "Dupliquer", icon: <LuCopyPlus size={16} />, onSelect: () => void handleDuplicate(f) },
      { label: "Copier vers…", icon: <LuCopy size={16} />, onSelect: () => setTransfer({ file: f, mode: "copy" }) },
      { label: "Déplacer vers…", icon: <LuFolderInput size={16} />, onSelect: () => setTransfer({ file: f, mode: "move" }) },
      { separator: true },
      { label: "Archiver", icon: <LuArchive size={16} />, onSelect: () => void handleArchive(f) },
      trash,
    ];
  };

  const isEmpty = !loading && (fichiers?.length ?? 0) === 0;

  return (
    <section className="card">
      <div className="card-header">
        <div>
          <h2 className="card-title">{archived ? "Fichiers archivés" : "Fichiers"}</h2>
          {archived && <p className="card-subtitle">Conservés sans limite de durée et figés : désarchivez un fichier pour le modifier.</p>}
        </div>
        {!isEmpty && (
          <div className="input-group files-search">
            <span className="input-icon-left">
              <LuSearch size={15} />
            </span>
            <input
              className="input"
              type="search"
              placeholder={archived ? "Rechercher dans les archives…" : "Rechercher un fichier…"}
              aria-label={archived ? "Rechercher dans les archives" : "Rechercher un fichier"}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        )}
      </div>

      {isEmpty ? (
        archived ? (
          <EmptyState
            icon={<LuArchive size={20} />}
            title="Aucun fichier archivé"
            description="Archivez un fichier (menu « … » → Archiver) pour le conserver à part, sans limite de durée."
          />
        ) : (
          <EmptyState
            icon={<LuFiles size={20} />}
            title="Cet espace est vide"
            description="Glissez-déposez des fichiers n'importe où sur la page, ou utilisez le bouton d'import."
            action={emptyAction}
          />
        )
      ) : !loading && list.length === 0 ? (
        <EmptyState compact icon={<LuSearch size={20} />} title="Aucun résultat" description={`Aucun fichier ne correspond à « ${search} ».`} />
      ) : (
        <>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th aria-sort={ariaSort("name")}>
                    <button type="button" className="th-sort" onClick={() => toggleSort("name")}>
                      Nom {sortIcon("name")}
                    </button>
                  </th>
                  <th className="col-type">Type</th>
                  <th className="col-date" aria-sort={ariaSort("date")}>
                    <button type="button" className="th-sort" onClick={() => toggleSort("date")}>
                      {archived ? "Archivé" : "Ajouté"} {sortIcon("date")}
                    </button>
                  </th>
                  <th className="col-num" aria-sort={ariaSort("size")}>
                    <button type="button" className="th-sort" onClick={() => toggleSort("size")}>
                      Taille {sortIcon("size")}
                    </button>
                  </th>
                  <th className="col-actions">
                    <span className="visually-hidden">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <SkeletonRows columns={5} rows={4} />
                ) : (
                  pagination.pageItems.map((f) => {
                    const kind = fileKind(f.nomFichier);
                    const date = dateOf(f);
                    return (
                      <tr key={f.idFichier}>
                        <td>
                          <div className="row gap-12">
                            <span className="res-icon">{kind.icon}</span>
                            <a className="res-name truncate file-name" href={fileUrl(f)} target="_blank" rel="noopener noreferrer" title={f.nomFichier}>
                              {f.nomFichier}
                            </a>
                          </div>
                        </td>
                        <td className="col-type muted">{kind.label}</td>
                        <td className="col-date muted" title={formatDateTime(date)}>
                          {formatRelative(date)}
                        </td>
                        <td className="col-num muted">{formatBytes(f.tailleFichier)}</td>
                        <td className="col-actions">
                          <div className="row gap-4">
                            <Button
                              variant="ghost"
                              size="sm"
                              iconOnly
                              aria-label={`Télécharger ${f.nomFichier}`}
                              title="Télécharger"
                              onClick={() => download(f)}
                              icon={<LuDownload size={15} />}
                            />
                            <Menu label={`Actions pour ${f.nomFichier}`} items={menuItems(f)} />
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

      <PromptDialog
        open={!!renaming}
        title="Renommer le fichier"
        label="Nom du fichier"
        initialValue={renaming?.nomFichier ?? ""}
        maxLength={255}
        submitLabel="Renommer"
        onSubmit={handleRename}
        onClose={() => setRenaming(null)}
      />

      <TransferDialog
        transfer={transfer}
        espaces={espaces.filter((e) => e.idEspace !== idEspace)}
        onClose={() => setTransfer(null)}
        onDone={onChanged}
      />

      <FilePropertiesDialog fichier={details} nomEspace={nomEspace} onClose={() => setDetails(null)} />
    </section>
  );
};

/* ─── Copier / déplacer vers un autre espace ─── */

const TransferDialog = ({
  transfer,
  espaces,
  onClose,
  onDone,
}: {
  transfer: { file: Fichier; mode: "copy" | "move" } | null;
  espaces: Espace[];
  onClose: () => void;
  onDone: () => void;
}) => {
  const toast = useToast();
  const [destination, setDestination] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openedFor, setOpenedFor] = useState<Fichier | null>(null);

  // Réinitialise la sélection à chaque ouverture
  if (transfer && transfer.file !== openedFor) {
    setOpenedFor(transfer.file);
    setDestination(espaces[0]?.idEspace ?? "");
    setError(null);
  }

  if (!transfer) return null;
  const { file, mode } = transfer;
  const isCopy = mode === "copy";
  const target = espaces.find((e) => e.idEspace === destination);
  const free = target ? target.tailleEspace - target.tailleOccupee : 0;
  const notEnoughRoom = isCopy && !!target && file.tailleFichier > free;

  const submit = async () => {
    if (!destination) return;
    setBusy(true);
    setError(null);
    const res = isCopy ? await copyFile(file.idFichier, destination) : await moveFile(file.idFichier, destination);
    setBusy(false);
    if (!res.success) {
      setError(res.message ?? "L'opération a échoué.");
      return;
    }
    toast.success(isCopy ? "Fichier copié" : "Fichier déplacé", `Vers « ${target?.nomEspace ?? "l'espace choisi"} ».`);
    onDone();
    onClose();
  };

  return (
    <Modal
      open
      onClose={onClose}
      busy={busy}
      title={isCopy ? "Copier vers un autre espace" : "Déplacer vers un autre espace"}
      description={
        <>
          <span className="mono">{file.nomFichier}</span> · {formatBytes(file.tailleFichier)}
        </>
      }
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Annuler
          </Button>
          <Button variant="primary" onClick={submit} loading={busy} disabled={!destination || notEnoughRoom}>
            {isCopy ? "Copier" : "Déplacer"}
          </Button>
        </>
      }
    >
      {espaces.length === 0 ? (
        <p className="muted">Vous n'avez pas d'autre espace. Créez-en un depuis la page « Espaces de stockage ».</p>
      ) : (
        <Field
          label="Espace de destination"
          error={error ?? (notEnoughRoom ? "Espace libre insuffisant dans cet espace." : null)}
          hint={target ? `${formatBytes(Math.max(0, free))} disponibles` : undefined}
        >
          <select className="select" value={destination} onChange={(e) => setDestination(e.target.value)}>
            {espaces.map((e) => (
              <option key={e.idEspace} value={e.idEspace}>
                {e.nomEspace}
              </option>
            ))}
          </select>
        </Field>
      )}
    </Modal>
  );
};

export default FichierPage;
