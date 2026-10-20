// src/config/multer.config.ts
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { type Request, type RequestHandler } from 'express';
import { formatSize, isAllowedUpload, maxUploadSize } from '../utils/Storage/storage.utils.ts';

// Ensure upload directories exist
const ensureDir = (dir: string) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
};

// Configure storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    let folder = 'uploads';
    
    // ─── Formations ──────────────────────────────────────────────────────────
    if (file.fieldname === 'miniature') {
      folder = path.join('uploads', 'formations', 'miniatures');
    } else if (file.fieldname === 'fichierVideo') {
      folder = path.join('uploads', 'cours', 'videos');
    } else if (file.fieldname === 'fichierImage') {
      folder = path.join('uploads', 'cours', 'lecons-images');
    } else if (file.fieldname === 'fichier' || file.fieldname === 'fichierMedia') {
      if (file.mimetype.startsWith('image/')) {
        folder = path.join('uploads', 'cours', 'images');
      } else if (file.mimetype.startsWith('video/')) {
        folder = path.join('uploads', 'cours', 'videos');
      } else {
        folder = path.join('uploads', 'cours', 'documents');
      }
    }
    
    // ─── Profils / Avatars ──────────────────────────────────────────────────
    else if (file.fieldname === 'photo' || file.fieldname === 'avatar' || file.fieldname === 'profile') {
      folder = path.join('uploads', 'profils');
    }
    
    // ─── Logo Entreprise ────────────────────────────────────────────────────
    else if (file.fieldname === 'logo') {
      folder = path.join('uploads', 'logos');
    }
    
    // ─── Stock / Produits ───────────────────────────────────────────────────
    else if (file.fieldname === 'produitImage' || file.fieldname === 'productImage') {
      folder = path.join('uploads', 'produits');
    }
    
    // ─── Documents divers ──────────────────────────────────────────────────
    else if (file.fieldname === 'document') {
      if (file.mimetype.startsWith('image/')) {
        folder = path.join('uploads', 'documents', 'images');
      } else if (file.mimetype.startsWith('video/')) {
        folder = path.join('uploads', 'documents', 'videos');
      } else {
        folder = path.join('uploads', 'documents', 'autres');
      }
    }
    
    ensureDir(folder);
    cb(null, folder);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    // Nettoyer le nom du fichier
    const cleanName = file.fieldname + '_' + uniqueSuffix + ext;
    cb(null, cleanName);
  }
});

// ─── File Filters ─────────────────────────────────────────────────────────────

// Filtre pour les images
const imageFilter = (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedMimes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'];
  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Format d\'image non supporté. Utilisez JPEG, PNG, GIF, WebP ou SVG.'));
  }
};

// Filtre pour les vidéos
const videoFilter = (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedMimes = ['video/mp4', 'video/webm', 'video/ogg'];
  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Format vidéo non supporté. Utilisez MP4, WebM ou OGG.'));
  }
};

// Filtre pour les fichiers génériques
const anyFileFilter = (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedMimes = [
    'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml',
    'video/mp4', 'video/webm', 'video/ogg',
    'application/pdf', 'application/msword', 
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain', 'text/csv'
  ];
  
  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Type de fichier non supporté.'));
  }
};

// Filtre pour les logos (images uniquement, avec validation supplémentaire)
const logoFilter = (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedMimes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'];
  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Format de logo non supporté. Utilisez JPEG, PNG, GIF, WebP ou SVG.'));
  }
};

// ─── Multer Instances ─────────────────────────────────────────────────────────

// Upload d'images (5 Mo max)
export const uploadImage = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: imageFilter
});

// Upload de vidéos (100 Mo max)
export const uploadVideo = multer({
  storage: storage,
  limits: { fileSize: 100 * 1024 * 1024 },
  fileFilter: videoFilter
});

// Upload de documents (10 Mo max)
export const uploadDocument = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: anyFileFilter
});

// Upload générique (50 Mo max)
export const uploadAny = multer({
  storage: storage,
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: anyFileFilter
});

// ✅ Upload pour la photo de profil (5 Mo max)
export const uploadProfilePhoto = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: imageFilter
});

// ✅ Upload pour le logo de l'entreprise (2 Mo max - plus restrictif)
export const uploadLogo = multer({
  storage: storage,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2 Mo max pour le logo
  fileFilter: logoFilter
});

// Pour la création/modif d'une LEÇON
const leconMediaFilter = (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedMimes = [
    'image/jpeg', 'image/png', 'image/gif', 'image/webp',
    'video/mp4', 'video/webm', 'video/ogg',
  ];
  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Format de fichier non supporté pour une leçon (image ou vidéo attendue).'));
  }
};

export const uploadLeconMedia = multer({
  storage: storage,
  limits: { fileSize: 100 * 1024 * 1024 },
  fileFilter: leconMediaFilter
});

// ─── Export unifié ────────────────────────────────────────────────────────────

export const upload = {
  image: uploadImage,
  video: uploadVideo,
  document: uploadDocument,
  any: uploadAny,
  profilePhoto: uploadProfilePhoto,
  logo: uploadLogo,          // ✅ Nouveau : upload de logo
  leconMedia: uploadLeconMedia,
};

// ─── Fonctions utilitaires ────────────────────────────────────────────────────

export const generateFileName = (originalName: string): string => {
  const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
  const ext = path.extname(originalName);
  return `${uniqueSuffix}${ext}`;
};

/**
 * Supprime un fichier du système de fichiers
 */
export const deleteFile = (filePath: string): boolean => {
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      return true;
    }
    return false;
  } catch (error) {
    console.error('Erreur lors de la suppression du fichier:', error);
    return false;
  }
};

/**
 * Vérifie si un fichier existe
 */
export const fileExists = (filePath: string): boolean => {
  return fs.existsSync(filePath);
};

/**
 * Récupère le chemin complet d'un fichier uploadé
 */
export const getUploadPath = (relativePath: string): string => {
  return path.join(process.cwd(), relativePath);
};

/**
 * Nettoyer les anciens fichiers dans un dossier
 * (supprime les fichiers de plus de X jours)
 */
export const cleanOldFiles = (dir: string, days: number = 30): void => {
  const dirPath = path.join(process.cwd(), dir);
  if (!fs.existsSync(dirPath)) return;

  const now = Date.now();
  const maxAge = days * 24 * 60 * 60 * 1000;

  const files = fs.readdirSync(dirPath);
  for (const file of files) {
    const filePath = path.join(dirPath, file);
    const stats = fs.statSync(filePath);
    if (stats.isFile() && (now - stats.mtimeMs) > maxAge) {
      try {
        fs.unlinkSync(filePath);
        console.log(`Fichier ancien supprimé: ${filePath}`);
      } catch (error) {
        console.error(`Erreur suppression ${filePath}:`, error);
      }
    }
  }
};

// ─── Upload vers un espace de stockage (route /fichier/ajout) ────────────────
// multer écrit d'abord dans uploads/.tmp ; le controller vérifie ensuite l'espace
// et le quota puis déplace le fichier dans uploads/<idUser>/<idEspace>/.
// (multer ne peut pas connaître l'idEspace au moment du choix du dossier : le body n'est
// pas encore parsé si le champ arrive après le fichier.)
const tmpStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    const dir = path.join('uploads', '.tmp');
    ensureDir(dir);
    cb(null, dir);
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, `${file.fieldname}_${uniqueSuffix}${path.extname(file.originalname)}`);
  }
});

// Créé à la première requête : la limite (UPLOAD_MAX_FILE_MB) est lue après le chargement du .env
let spaceUploader: multer.Multer | null = null;
export const uploadToSpace = (): multer.Multer =>
  (spaceUploader ??= multer({
    storage: tmpStorage,
    limits: { fileSize: maxUploadSize() }, // = quota par défaut d'un espace, sauf réglage contraire
    // Contrôle par extension (les navigateurs envoient souvent un type vide pour .mkv, .mov…)
    fileFilter: (_req, file, cb) =>
      isAllowedUpload(file.originalname, file.mimetype)
        ? cb(null, true)
        : cb(new Error(`Format non accepté (.${path.extname(file.originalname).slice(1) || "sans extension"}).`)),
  }));

/**
 * Middleware `single('fichier')` qui renvoie une réponse JSON propre
 * (400 / 413) au lieu de laisser Express répondre 500 sur une erreur multer.
 */
export const uploadSingleToSpace: RequestHandler = (req, res, next) => {
  uploadToSpace().single('fichier')(req, res, (err: any) => {
    if (!err) return next();
    const tooLarge = err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE';
    res.status(tooLarge ? 413 : 400).json({
      success: false,
      message: tooLarge ? `Fichier trop volumineux (${formatSize(maxUploadSize())} maximum).` : err.message,
    });
  });
};