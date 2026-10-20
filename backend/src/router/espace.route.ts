import { type Request, type Response, Router } from "express";
import Espacecontroller from "../controller/Espace/Espace.controller.ts";
import { authMiddleware, ensureSelfOrAdmin } from "../middlewares/Auth.middleware.ts";
import { sendResult, sendServerError } from "../utils/Http/Http.utils.ts";

const EspaceRouter = Router();

/**
 * @swagger
 * /espace/new/{idUser}:
 *   post:
 *     summary: Créer un espace de stockage
 *     description: |
 *       Crée un espace de stockage (quota par défaut : **2 Go**, variable SPACE_QUOTA_MB) et son dossier sur le serveur.
 *       Le nom doit être unique parmi les espaces de l'utilisateur.
 *       `idUser` doit être l'utilisateur connecté (sauf pour un ADMIN).
 *     tags: [Espace]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: idUser
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Identifiant du propriétaire de l'espace
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [nomEspace]
 *             properties:
 *               nomEspace:
 *                 type: string
 *                 maxLength: 100
 *                 example: "Documents"
 *     responses:
 *       201:
 *         description: Espace créé
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/EspaceResponse'
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       409:
 *         $ref: '#/components/responses/Conflict'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
EspaceRouter.post(
    "/new/:idUser",
    authMiddleware,
    ensureSelfOrAdmin("idUser"),
    async (req: Request, res: Response) => {
        try {
            const result = await Espacecontroller.createSpace({
                idUser: req.params.idUser as string,
                nomEspace: req.body?.nomEspace,
            });
            sendResult(res, result, 201);
        } catch (error) {
            sendServerError(res, error, "espace/new");
        }
    },
);

/**
 * @swagger
 * /espace/rename/{idSpace}:
 *   patch:
 *     summary: Renommer un espace de stockage
 *     description: |
 *       Renomme un espace appartenant à l'utilisateur connecté.
 *       Le nouveau nom doit être unique parmi ses espaces.
 *     tags: [Espace]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: idSpace
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Identifiant de l'espace à renommer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [newName]
 *             properties:
 *               newName:
 *                 type: string
 *                 maxLength: 100
 *                 example: "Projets 2026"
 *     responses:
 *       200:
 *         description: Espace renommé
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/EspaceResponse'
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       409:
 *         $ref: '#/components/responses/Conflict'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
EspaceRouter.patch("/rename/:idSpace", authMiddleware, async (req: Request, res: Response) => {
    try {
        const result = await Espacecontroller.renameSpace({
            idUser: req.currentUser!.userId,
            idSpace: req.params.idSpace as string,
            newName: req.body?.newName,
        });
        sendResult(res, result);
    } catch (error) {
        sendServerError(res, error, "espace/rename");
    }
});

/**
 * @swagger
 * /espace/delete/{idSpace}:
 *   delete:
 *     summary: Supprimer un espace de stockage
 *     description: |
 *       Supprime l'espace **et tous les fichiers qu'il contient** (base de données et disque).
 *       Action irréversible.
 *     tags: [Espace]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: idSpace
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Identifiant de l'espace à supprimer
 *     responses:
 *       200:
 *         description: Espace supprimé
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessMessage'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
EspaceRouter.delete("/delete/:idSpace", authMiddleware, async (req: Request, res: Response) => {
    try {
        const result = await Espacecontroller.deleteSpace({
            idUser: req.currentUser!.userId,
            idSpace: req.params.idSpace as string,
        });
        sendResult(res, result);
    } catch (error) {
        sendServerError(res, error, "espace/delete");
    }
});

/**
 * @swagger
 * /espace/all/{idUser}:
 *   get:
 *     summary: Lister les espaces de stockage d'un utilisateur
 *     description: |
 *       Retourne tous les espaces de l'utilisateur, triés par nom.
 *       `idUser` doit être l'utilisateur connecté (sauf pour un ADMIN).
 *     tags: [Espace]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: idUser
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Identifiant du propriétaire
 *     responses:
 *       200:
 *         description: Liste des espaces (peut être vide)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/EspaceListResponse'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
EspaceRouter.get(
    "/all/:idUser",
    authMiddleware,
    ensureSelfOrAdmin("idUser"),
    async (req: Request, res: Response) => {
        try {
            const result = await Espacecontroller.listAllSpaces(req.params.idUser as string);
            sendResult(res, result);
        } catch (error) {
            sendServerError(res, error, "espace/all");
        }
    },
);

/**
 * @swagger
 * /espace/id/{idSpace}:
 *   get:
 *     summary: Afficher un espace de stockage par son id
 *     description: |
 *       Retourne un espace appartenant à l'utilisateur connecté (un ADMIN peut consulter n'importe quel espace).
 *     tags: [Espace]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: idSpace
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Identifiant de l'espace
 *     responses:
 *       200:
 *         description: Espace trouvé
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/EspaceResponse'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
EspaceRouter.get("/id/:idSpace", authMiddleware, async (req: Request, res: Response) => {
    try {
        const user = req.currentUser!;
        const result = await Espacecontroller.findById(
            req.params.idSpace as string,
            user.type === "ADMIN" ? undefined : user.userId,
        );
        sendResult(res, result);
    } catch (error) {
        sendServerError(res, error, "espace/id");
    }
});

export default EspaceRouter;