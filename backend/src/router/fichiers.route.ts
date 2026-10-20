import { type Request, type Response, Router } from "express";
import { uploadSingleToSpace } from "../config/multer.config.ts";
import FichierController from "../controller/Fichiers/Fichiers.controller.ts";
import { authMiddleware } from "../middlewares/Auth.middleware.ts";
import { sendResult, sendServerError } from "../utils/Http/Http.utils.ts";
import { ALLOWED_UPLOAD_EXTENSIONS, maxUploadSize } from "../utils/Storage/storage.utils.ts";

const fileRouter = Router();

/**
 * @swagger
 * /fichier/ajout:
 *   post:
 *     summary: Uploader un fichier dans un espace de stockage
 *     description: |
 *       Envoie un fichier (multipart/form-data) dans un espace appartenant à l'utilisateur connecté.
 *
 *       - Taille maximale par fichier : **2 Go** par défaut (UPLOAD_MAX_FILE_MB) ; le quota restant de l'espace est vérifié.
 *       - Types acceptés : images (jpeg, png, gif, webp, svg), vidéos (mp4, webm, ogg),
 *         PDF, Word, Excel, texte et CSV.
 *       - L'utilisateur est déduit du token (plus besoin d'envoyer `idUser`).
 *     tags: [Fichier]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [fichier, idEspace]
 *             properties:
 *               idEspace:
 *                 type: string
 *                 format: uuid
 *                 description: Espace de destination
 *               fichier:
 *                 type: string
 *                 format: binary
 *                 description: Le fichier à envoyer
 *     responses:
 *       201:
 *         description: Fichier uploadé
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/FichierResponse'
 *       400:
 *         description: Fichier absent, type non supporté ou idEspace manquant
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       413:
 *         description: Fichier trop volumineux ou quota de l'espace dépassé
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               success: false
 *               message: "Espace de stockage insuffisant."
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
fileRouter.post("/ajout", authMiddleware, uploadSingleToSpace, async (req: Request, res: Response) => {
    try {
        const result = await FichierController.deposit(
            req.currentUser!.userId,
            req.body?.idEspace,
            req.file,
        );
        sendResult(res, result, 201);
    } catch (error) {
        sendServerError(res, error, "fichier/ajout");
    }
});

/**
 * @swagger
 * /fichier/supprimer/{idFichier}:
 *   delete:
 *     summary: Supprimer un fichier
 *     description: |
 *       Supprime le fichier (disque et base de données) et libère l'espace occupé dans son espace de stockage.
 *       Seul le propriétaire peut supprimer son fichier.
 *     tags: [Fichier]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: idFichier
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Identifiant du fichier
 *     responses:
 *       200:
 *         description: Fichier supprimé
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/FichierResponse'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
fileRouter.delete("/supprimer/:idFichier", authMiddleware, async (req: Request, res: Response) => {
    try {
        const result = await FichierController.delete(
            req.params.idFichier as string,
            req.currentUser!.userId,
        );
        sendResult(res, result);
    } catch (error) {
        sendServerError(res, error, "fichier/supprimer");
    }
});

/**
 * @swagger
 * /fichier/renommer/{idFichier}:
 *   put:
 *     summary: Renommer un fichier
 *     description: |
 *       Modifie le nom affiché du fichier (le fichier physique n'est pas déplacé).
 *       Le nom ne doit pas contenir `/` ni `\` et faire au maximum 255 caractères.
 *     tags: [Fichier]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: idFichier
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Identifiant du fichier
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [nouveauNom]
 *             properties:
 *               nouveauNom:
 *                 type: string
 *                 maxLength: 255
 *                 example: "rapport-final.pdf"
 *     responses:
 *       200:
 *         description: Fichier renommé
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/FichierResponse'
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
fileRouter.put("/renommer/:idFichier", authMiddleware, async (req: Request, res: Response) => {
    try {
        const result = await FichierController.rename(
            req.params.idFichier as string,
            req.currentUser!.userId,
            req.body?.nouveauNom,
        );
        sendResult(res, result);
    } catch (error) {
        sendServerError(res, error, "fichier/renommer");
    }
});

/**
 * @swagger
 * /fichier/all:
 *   get:
 *     summary: Lister tous les fichiers de l'utilisateur connecté
 *     description: Retourne les fichiers de tous les espaces de l'utilisateur authentifié.
 *     tags: [Fichier]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Liste des fichiers (peut être vide)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/FichierListResponse'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
/**
 * @swagger
 * /fichier/formats:
 *   get:
 *     summary: Formats acceptés et taille maximale d'un fichier
 *     description: Extensions autorisées par catégorie (le contrôle se fait sur l'extension) et limite par fichier en octets.
 *     tags: [Fichier]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200: { description: Formats et limite }
 */
// Déclarée avant « /:idFichier », qui capturerait sinon « formats »
fileRouter.get("/formats", authMiddleware, (_req: Request, res: Response) => {
    sendResult(res, { success: true, data: { extensions: ALLOWED_UPLOAD_EXTENSIONS, tailleMax: maxUploadSize() } });
});

/**
 * @swagger
 * /fichier/corbeille:
 *   get:
 *     summary: Contenu de la corbeille
 *     description: |
 *       Fichiers mis à la corbeille, avec leur espace d'origine et la date de suppression définitive automatique
 *       (après CORBEILLE_JOURS jours, 30 par défaut). Ils comptent toujours dans le quota de leur espace.
 *     tags: [Fichier]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200: { description: Contenu de la corbeille }
 *   delete:
 *     summary: Vider la corbeille (suppression définitive)
 *     tags: [Fichier]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200: { description: Corbeille vidée }
 */
// Déclarées avant « /:idFichier », qui capturerait sinon « corbeille »
fileRouter.get("/corbeille", authMiddleware, async (req: Request, res: Response) => {
    try {
        sendResult(res, await FichierController.listerCorbeille(req.currentUser!.userId));
    } catch (error) {
        sendServerError(res, error, "fichier/corbeille");
    }
});

fileRouter.delete("/corbeille", authMiddleware, async (req: Request, res: Response) => {
    try {
        sendResult(res, await FichierController.viderCorbeille(req.currentUser!.userId));
    } catch (error) {
        sendServerError(res, error, "fichier/corbeille/vider");
    }
});

/**
 * @swagger
 * /fichier/{idFichier}/corbeille:
 *   post:
 *     summary: Mettre un fichier à la corbeille (restaurable)
 *     description: Le fichier disparaît de son espace mais reste restaurable. Pour une suppression définitive, utiliser DELETE /fichier/supprimer/{idFichier}.
 *     tags: [Fichier]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: idFichier
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200: { description: Fichier placé dans la corbeille }
 *       404: { description: Fichier introuvable }
 * /fichier/{idFichier}/restaurer:
 *   post:
 *     summary: Restaurer un fichier de la corbeille dans son espace d'origine
 *     description: Si un fichier du même nom existe déjà dans l'espace, le fichier restauré est renommé « nom (copie).ext ».
 *     tags: [Fichier]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: idFichier
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200: { description: Fichier restauré }
 *       404: { description: Fichier absent de la corbeille }
 *       409: { description: L'espace d'origine n'existe plus }
 */
fileRouter.post("/:idFichier/corbeille", authMiddleware, async (req: Request, res: Response) => {
    try {
        sendResult(res, await FichierController.mettreCorbeille(req.currentUser!.userId, req.params.idFichier as string));
    } catch (error) {
        sendServerError(res, error, "fichier/mettre-corbeille");
    }
});

/**
 * @swagger
 * /fichier/{idFichier}/archiver:
 *   post:
 *     summary: Archiver un fichier
 *     description: |
 *       Le fichier quitte la liste principale de son espace mais y reste, sans limite de durée (et dans le quota).
 *       Il est figé : ni renommage, ni copie, ni déplacement tant qu'il n'est pas désarchivé. Liste : GET /fichier/espace/{idEspace}?archives=true.
 *     tags: [Fichier]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: idFichier
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200: { description: Fichier archivé }
 *       404: { description: Fichier introuvable }
 *       409: { description: Fichier déjà archivé }
 * /fichier/{idFichier}/desarchiver:
 *   post:
 *     summary: Désarchiver un fichier (retour dans la liste principale de son espace)
 *     tags: [Fichier]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: idFichier
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200: { description: Fichier désarchivé }
 *       404: { description: Fichier absent des archives }
 */
fileRouter.post("/:idFichier/archiver", authMiddleware, async (req: Request, res: Response) => {
    try {
        sendResult(res, await FichierController.archiver(req.currentUser!.userId, req.params.idFichier as string));
    } catch (error) {
        sendServerError(res, error, "fichier/archiver");
    }
});

fileRouter.post("/:idFichier/desarchiver", authMiddleware, async (req: Request, res: Response) => {
    try {
        sendResult(res, await FichierController.desarchiver(req.currentUser!.userId, req.params.idFichier as string));
    } catch (error) {
        sendServerError(res, error, "fichier/desarchiver");
    }
});

fileRouter.post("/:idFichier/restaurer", authMiddleware, async (req: Request, res: Response) => {
    try {
        sendResult(res, await FichierController.restaurer(req.currentUser!.userId, req.params.idFichier as string));
    } catch (error) {
        sendServerError(res, error, "fichier/restaurer");
    }
});

fileRouter.get("/all", authMiddleware, async (req: Request, res: Response) => {
    try {
        const result = await FichierController.listAll(req.currentUser!.userId);
        sendResult(res, result);
    } catch (error) {
        sendServerError(res, error, "fichier/all");
    }
});

/**
 * @swagger
 * /fichier/espace/{idEspace}:
 *   get:
 *     summary: Lister les fichiers d'un espace de stockage
 *     description: Retourne les fichiers de l'utilisateur connecté contenus dans l'espace demandé.
 *     tags: [Fichier]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: idEspace
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Identifiant de l'espace
 *     responses:
 *       200:
 *         description: Liste des fichiers de l'espace (peut être vide)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/FichierListResponse'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
fileRouter.get("/espace/:idEspace", authMiddleware, async (req: Request, res: Response) => {
    try {
        const result = await FichierController.listByEspace(
            req.params.idEspace as string,
            req.currentUser!.userId,
            req.query.archives === "true", // ?archives=true : fichiers archivés de l'espace
        );
        sendResult(res, result);
    } catch (error) {
        sendServerError(res, error, "fichier/espace");
    }
});

/**
 * @swagger
 * /fichier/{idFichier}:
 *   get:
 *     summary: Afficher un fichier par son id
 *     description: Retourne les métadonnées d'un fichier appartenant à l'utilisateur connecté.
 *     tags: [Fichier]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: idFichier
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Identifiant du fichier
 *     responses:
 *       200:
 *         description: Fichier trouvé
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/FichierResponse'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
fileRouter.get("/:idFichier", authMiddleware, async (req: Request, res: Response) => {
    try {
        const result = await FichierController.listById(
            req.params.idFichier as string,
            req.currentUser!.userId,
        );
        sendResult(res, result);
    } catch (error) {
        sendServerError(res, error, "fichier/:id");
    }
});

/**
 * @swagger
 * /fichier/{idFichier}/copier:
 *   post:
 *     summary: Copier un fichier dans un autre espace
 *     description: |
 *       Crée un **nouveau fichier indépendant** (copie physique + nouvelle entrée) dans l'espace de destination.
 *       Le fichier d'origine n'est pas modifié ; le quota de l'espace de destination est consommé.
 *       Si un fichier du même nom existe déjà à destination, la copie est nommée « nom (copie).ext »,
 *       « nom (copie 2).ext »… Les deux espaces doivent appartenir à l'utilisateur connecté.
 *     tags: [Fichier]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: idFichier
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Fichier à copier
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [idEspaceDestination]
 *             properties:
 *               idEspaceDestination:
 *                 type: string
 *                 format: uuid
 *               nouveauNom:
 *                 type: string
 *                 maxLength: 255
 *                 description: Optionnel. Défaut = nom d'origine.
 *                 example: "rapport-v2.pdf"
 *     responses:
 *       201:
 *         description: Fichier copié (la réponse décrit la copie)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/FichierResponse'
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         description: Fichier, espace de destination ou fichier physique introuvable
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       413:
 *         description: Quota de l'espace de destination insuffisant
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
fileRouter.post("/:idFichier/copier", authMiddleware, async (req: Request, res: Response) => {
    try {
        sendResult(res, await FichierController.copier(req.currentUser!.userId, req.params.idFichier as string, req.body ?? {}), 201);
    } catch (error) {
        sendServerError(res, error, "fichier/copier");
    }
});

/**
 * @swagger
 * /fichier/{idFichier}/dupliquer:
 *   post:
 *     summary: Dupliquer un fichier dans son propre espace
 *     description: |
 *       Crée une copie dans **le même espace** que l'original, nommée « nom (copie).ext » (ou « (copie 2) »…
 *       si ce nom existe déjà), sauf si `nouveauNom` est fourni. Le quota de l'espace est consommé.
 *     tags: [Fichier]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: idFichier
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Fichier à dupliquer
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               nouveauNom:
 *                 type: string
 *                 maxLength: 255
 *                 description: Optionnel. Défaut = « nom (copie).ext ».
 *     responses:
 *       201:
 *         description: Fichier dupliqué (la réponse décrit la copie)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/FichierResponse'
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       409:
 *         description: Le fichier n'appartient à aucun espace
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       413:
 *         description: Quota de l'espace insuffisant
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
fileRouter.post("/:idFichier/dupliquer", authMiddleware, async (req: Request, res: Response) => {
    try {
        sendResult(res, await FichierController.dupliquer(req.currentUser!.userId, req.params.idFichier as string, req.body ?? {}), 201);
    } catch (error) {
        sendServerError(res, error, "fichier/dupliquer");
    }
});

/**
 * @swagger
 * /fichier/{idFichier}/deplacer:
 *   post:
 *     summary: Déplacer un fichier vers un autre espace
 *     description: |
 *       Déplace le **même fichier** (identifiant conservé) : le fichier physique change de dossier, et le quota
 *       est libéré dans l'espace source puis consommé dans l'espace de destination. En cas de nom déjà pris à
 *       destination, le fichier est renommé « nom (copie).ext ».
 *     tags: [Fichier]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: idFichier
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Fichier à déplacer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [idEspaceDestination]
 *             properties:
 *               idEspaceDestination:
 *                 type: string
 *                 format: uuid
 *     responses:
 *       200:
 *         description: Fichier déplacé
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/FichierResponse'
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         description: Fichier, espace de destination ou fichier physique introuvable
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       409:
 *         description: Le fichier se trouve déjà dans cet espace
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       413:
 *         description: Quota de l'espace de destination insuffisant
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
fileRouter.post("/:idFichier/deplacer", authMiddleware, async (req: Request, res: Response) => {
    try {
        sendResult(res, await FichierController.deplacer(req.currentUser!.userId, req.params.idFichier as string, req.body ?? {}));
    } catch (error) {
        sendServerError(res, error, "fichier/deplacer");
    }
});

export default fileRouter;