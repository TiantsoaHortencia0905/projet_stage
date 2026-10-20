import type { ReactNode } from "react";
import {
  LuFile,
  LuFileArchive,
  LuFileAudio,
  LuFileCode,
  LuFileImage,
  LuFileSpreadsheet,
  LuFileText,
  LuFileVideo,
  LuPresentation,
} from "react-icons/lu";

interface FileKind {
  label: string;
  icon: ReactNode;
}

const KINDS: { exts: string[]; kind: FileKind }[] = [
  { exts: ["png", "jpg", "jpeg", "gif", "webp", "svg", "bmp", "ico", "avif", "tif", "tiff", "heic", "heif"], kind: { label: "Image", icon: <LuFileImage size={16} /> } },
  { exts: ["mp4", "m4v", "mov", "avi", "mkv", "webm", "ogv", "wmv", "flv", "3gp", "mpeg", "mpg"], kind: { label: "Vidéo", icon: <LuFileVideo size={16} /> } },
  { exts: ["mp3", "wav", "ogg", "oga", "opus", "flac", "m4a", "aac", "weba"], kind: { label: "Audio", icon: <LuFileAudio size={16} /> } },
  { exts: ["pdf"], kind: { label: "PDF", icon: <LuFileText size={16} /> } },
  { exts: ["doc", "docx", "odt", "rtf", "txt", "md"], kind: { label: "Document", icon: <LuFileText size={16} /> } },
  { exts: ["xls", "xlsx", "ods", "csv", "tsv"], kind: { label: "Tableur", icon: <LuFileSpreadsheet size={16} /> } },
  { exts: ["ppt", "pptx", "odp"], kind: { label: "Présentation", icon: <LuPresentation size={16} /> } },
  { exts: ["zip", "rar", "7z", "tar", "gz", "tgz", "bz2"], kind: { label: "Archive", icon: <LuFileArchive size={16} /> } },
  {
    exts: ["js", "ts", "tsx", "jsx", "json", "html", "css", "py", "java", "c", "cpp", "sql", "sh", "yml", "yaml", "xml"],
    kind: { label: "Code", icon: <LuFileCode size={16} /> },
  },
];

export const extensionOf = (name: string) => {
  const dot = name.lastIndexOf(".");
  return dot > 0 ? name.slice(dot + 1).toLowerCase() : "";
};

export const fileKind = (name: string): FileKind => {
  const ext = extensionOf(name);
  return KINDS.find((k) => k.exts.includes(ext))?.kind ?? { label: ext ? ext.toUpperCase() : "Fichier", icon: <LuFile size={16} /> };
};
