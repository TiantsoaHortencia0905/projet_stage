import { type Request, type Response, Router } from "express";
import DatabaseController from "../controller/Database/Database.controller.ts";
import { authMiddleware } from "../middlewares/Auth.middleware.ts";
import { sendResult, sendServerError } from "../utils/Http/Http.utils.ts";

const DatabaseRouter = Router();

/**
 * @swagger
 * /database/types:
 *   get:
 *     summary: Lister les moteurs de base de données disponibles
 *     description: |
 *       Retourne les moteurs proposés (PostgreSQL, MySQL, MariaDB, MongoDB, Redis), leurs versions autorisées
 *       et la version par défaut. Utiliser `type` et `versions` pour `POST /database/new`.
 *     tags: [Database]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Catalogue des moteurs
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/DatabaseTypeListResponse'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
DatabaseRouter.get("/types", authMiddleware, (_req: Request, res: Response) => {
    sendResult(res, DatabaseController.types());
});

/**
 * @swagger
 * /database/new:
 *   post:
 *     summary: Créer une base de données (conteneur Docker dédié)
 *     description: |
 *       Lance la création d'une base **réelle** dans son propre conteneur Docker (image officielle, volume
 *       persistant, utilisateur et mot de passe générés, limites de mémoire / CPU). La réponse est immédiate
 *       (**202**) ; le téléchargement de l'image et le démarrage se font en arrière-plan.
 *
 *       États : `CREATION` → `EN_LIGNE` (ou `ERREUR`, motif dans `messageEtat`). Suivi via `GET /database/{idBD}`
 *       ou Socket.IO (`database:etat`, `database:progression`).
 *
 *       Les informations de connexion (hôte, port, URL, mot de passe) sont renvoyées dès la réponse.
 *       Limites : 5 bases par utilisateur, nom unique par utilisateur.
 *     tags: [Database]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [nomBD]
 *             properties:
 *               nomBD:
 *                 type: string
 *                 pattern: '^[a-z][a-z0-9_]{2,29}$'
 *                 example: "ma_base"
 *               typeBD:
 *                 type: string
 *                 enum: [postgresql, mysql, mariadb, mongodb, redis]
 *                 default: postgresql
 *               version:
 *                 type: string
 *                 description: Tag de l'image (voir GET /database/types). Défaut = version par défaut du moteur.
 *                 example: "16-alpine"
 *     responses:
 *       202:
 *         description: Création acceptée et en cours
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/BaseDeDonneesConnexionResponse'
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         description: Limite de bases atteinte
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       409:
 *         $ref: '#/components/responses/Conflict'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 *       503:
 *         description: Docker indisponible ou aucun port libre
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
DatabaseRouter.post("/new", authMiddleware, async (req: Request, res: Response) => {
    try {
        sendResult(res, await DatabaseController.creer(req.currentUser!.userId, req.body ?? {}), 202);
    } catch (error) {
        sendServerError(res, error, "database/new");
    }
});

/**
 * @swagger
 * /database/all:
 *   get:
 *     summary: Lister les bases de données de l'utilisateur connecté
 *     description: Retourne les bases avec leur état, sans mot de passe (utiliser `GET /database/{idBD}` pour la connexion).
 *     tags: [Database]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Liste des bases (peut être vide)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/BaseDeDonneesListResponse'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
DatabaseRouter.get("/all", authMiddleware, async (req: Request, res: Response) => {
    try {
        sendResult(res, await DatabaseController.lister(req.currentUser!.userId));
    } catch (error) {
        sendServerError(res, error, "database/all");
    }
});

/**
 * @swagger
 * /database/{idBD}:
 *   get:
 *     summary: Afficher une base, son état et ses informations de connexion
 *     description: |
 *       Retourne la base et les informations de connexion, **mot de passe inclus**. L'état est resynchronisé
 *       avec Docker (conteneur arrêté ou supprimé en dehors de l'API).
 *     tags: [Database]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: idBD
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Identifiant de la base
 *     responses:
 *       200:
 *         description: Base trouvée
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/BaseDeDonneesConnexionResponse'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
DatabaseRouter.get("/:idBD", authMiddleware, async (req: Request, res: Response) => {
    try {
        sendResult(res, await DatabaseController.prendreParId(req.currentUser!.userId, req.params.idBD as string));
    } catch (error) {
        sendServerError(res, error, "database/:id");
    }
});

/**
 * @swagger
 * /database/{idBD}/arreter:
 *   post:
 *     summary: Arrêter une base de données
 *     description: Arrête le conteneur ; les données (volume) et le port sont conservés. Seule une base `EN_LIGNE` peut être arrêtée.
 *     tags: [Database]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: idBD
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Identifiant de la base
 *     responses:
 *       200:
 *         description: Base arrêtée
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessMessage'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       409:
 *         $ref: '#/components/responses/Conflict'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 *       503:
 *         $ref: '#/components/responses/ServiceUnavailable'
 */
DatabaseRouter.post("/:idBD/arreter", authMiddleware, async (req: Request, res: Response) => {
    try {
        sendResult(res, await DatabaseController.arreter(req.currentUser!.userId, req.params.idBD as string));
    } catch (error) {
        sendServerError(res, error, "database/arreter");
    }
});

/**
 * @swagger
 * /database/{idBD}/demarrer:
 *   post:
 *     summary: Démarrer une base de données arrêtée
 *     description: Relance le conteneur et attend que le moteur réponde. Seule une base `ARRETE` peut être démarrée.
 *     tags: [Database]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: idBD
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Identifiant de la base
 *     responses:
 *       200:
 *         description: Base démarrée
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessMessage'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       409:
 *         $ref: '#/components/responses/Conflict'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 *       502:
 *         description: La base n'a pas redémarré (détail dans `messageEtat`)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       503:
 *         $ref: '#/components/responses/ServiceUnavailable'
 */
DatabaseRouter.post("/:idBD/demarrer", authMiddleware, async (req: Request, res: Response) => {
    try {
        sendResult(res, await DatabaseController.demarrer(req.currentUser!.userId, req.params.idBD as string));
    } catch (error) {
        sendServerError(res, error, "database/demarrer");
    }
});

/**
 * @swagger
 * /database/{idBD}/reset-password:
 *   post:
 *     summary: Réinitialiser le mot de passe d'une base
 *     description: |
 *       Génère un nouveau mot de passe et le renvoie ; l'ancien cesse immédiatement de fonctionner.
 *       La base doit être `EN_LIGNE`. Pour Redis, le conteneur est recréé (données conservées) : brève coupure.
 *     tags: [Database]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: idBD
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Identifiant de la base
 *     responses:
 *       200:
 *         description: Mot de passe réinitialisé
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ConnexionResponse'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       409:
 *         $ref: '#/components/responses/Conflict'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 *       503:
 *         $ref: '#/components/responses/ServiceUnavailable'
 */
DatabaseRouter.post("/:idBD/reset-password", authMiddleware, async (req: Request, res: Response) => {
    try {
        sendResult(res, await DatabaseController.reinitialiserMotDePasse(req.currentUser!.userId, req.params.idBD as string));
    } catch (error) {
        sendServerError(res, error, "database/reset-password");
    }
});

/**
 * @swagger
 * /database/{idBD}:
 *   delete:
 *     summary: Supprimer une base de données
 *     description: Supprimer la base de données (son container et les données qui s'y trouvent)
 *     tags: [Database]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: idBD
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Identifiant de la base
 *     responses:
 *       200:
 *         description: Base supprimée
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessMessage'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       409:
 *         $ref: '#/components/responses/Conflict'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 *       503:
 *         $ref: '#/components/responses/ServiceUnavailable'
 */
DatabaseRouter.delete("/:idBD", authMiddleware, async (req: Request, res: Response) => {
    try {
        sendResult(res, await DatabaseController.supprimer(req.currentUser!.userId, req.params.idBD as string));
    } catch (error) {
        sendServerError(res, error, "database/delete");
    }
});

export default DatabaseRouter;
