import { type Request, type Response, Router } from "express";
import LogsController from "../controller/Logs/Logs.controller.ts";
import { authMiddleware } from "../middlewares/Auth.middleware.ts";
import { sendResult, sendServerError } from "../utils/Http/Http.utils.ts";
import { qs, toDate, toPositiveInt } from "../utils/Pagination/pagination.utils.ts";

const LogsRouter = Router();

/**
 * @swagger
 * /logs/ajouter/{idDeploiement}:
 *   post:
 *     summary: Ajouter des logs à un déploiement
 *     description: |
 *       Deux modes :
 *       - **`lignes`** : lignes brutes (max 500). Elles sont analysées, seules les **erreurs** sont stockées
 *         (les stack traces sont regroupées avec leur erreur). Utile pour un agent qui pousse ses logs.
 *       - **`objetLog` + `detailLog`** : création manuelle d'une entrée.
 *
 *       Les erreurs stockées déclenchent une notification temps réel (`log:error`) et, si elles sont
 *       critiques ou répétées, une alerte (`alerte:new`).
 *     tags: [Logs]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: idDeploiement
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Identifiant du déploiement
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               lignes:
 *                 type: array
 *                 maxItems: 500
 *                 items:
 *                   type: string
 *                 example:
 *                   - "2026-09-29T10:00:00Z INFO Server started"
 *                   - "2026-09-29T10:00:05Z ERROR connect ECONNREFUSED 127.0.0.1:5432"
 *                   - "    at TCPConnectWrap.afterConnect (net.js:1141:16)"
 *               objetLog:
 *                 type: string
 *                 maxLength: 100
 *                 example: "ERREUR_MANUELLE"
 *               detailLog:
 *                 type: string
 *                 maxLength: 4000
 *                 example: "Description de l'incident"
 *     responses:
 *       201:
 *         description: Logs traités
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/LogAjoutResponse'
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
LogsRouter.post("/ajouter/:idDeploiement", authMiddleware, async (req: Request, res: Response) => {
    try {
        const result = await LogsController.ajouter(
            req.currentUser!.userId,
            req.params.idDeploiement as string,
            req.body ?? {},
        );
        sendResult(res, result, 201);
    } catch (error) {
        sendServerError(res, error, "logs/ajouter");
    }
});

/**
 * @swagger
 * /logs/deploiement/{idDeploiement}:
 *   get:
 *     summary: Lister les erreurs d'un déploiement
 *     description: Liste paginée (du plus récent au plus ancien) des erreurs stockées, avec filtres.
 *     tags: [Logs]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: idDeploiement
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Identifiant du déploiement
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 200
 *           default: 50
 *       - in: query
 *         name: categorie
 *         schema:
 *           type: string
 *         description: Catégorie exacte (ex. ERREUR_RESEAU, BASE_DE_DONNEES, ERREUR_MEMOIRE)
 *       - in: query
 *         name: q
 *         schema:
 *           type: string
 *         description: Recherche dans le détail (insensible à la casse)
 *       - in: query
 *         name: depuis
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Date minimale (ISO 8601)
 *       - in: query
 *         name: jusqua
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Date maximale (ISO 8601)
 *     responses:
 *       200:
 *         description: Liste des logs
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/LogListResponse'
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
LogsRouter.get("/deploiement/:idDeploiement", authMiddleware, async (req: Request, res: Response) => {
    try {
        const depuis = toDate(req.query.depuis);
        const jusqua = toDate(req.query.jusqua);
        if (depuis === null || jusqua === null) {
            res.status(400).json({ success: false, message: "Date invalide (format ISO 8601 attendu)." });
            return;
        }
        const result = await LogsController.lister(req.currentUser!.userId, req.params.idDeploiement as string, {
            page: toPositiveInt(req.query.page, 1, 100000)!,
            limit: toPositiveInt(req.query.limit, 50, 200)!,
            categorie: qs(req.query.categorie)!,
            q: qs(req.query.q)!,
            depuis:depuis!,
            jusqua: jusqua!,
        });
        sendResult(res, result);
    } catch (error) {
        sendServerError(res, error, "logs/lister");
    }
});

/**
 * @swagger
 * /logs/evaluer/{idDeploiement}:
 *   get:
 *     summary: Évaluer la santé d'un déploiement
 *     description: |
 *       Synthétise les erreurs récentes :
 *       - `SAIN` : aucune erreur dans la fenêtre ;
 *       - `DEGRADE` : quelques erreurs non critiques ;
 *       - `CRITIQUE` : erreur critique (mémoire, disque plein, crash, fatale) ou au moins 10 erreurs dans la fenêtre.
 *     tags: [Logs]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: idDeploiement
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Identifiant du déploiement
 *       - in: query
 *         name: minutes
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 1440
 *           default: 15
 *         description: Taille de la fenêtre d'analyse en minutes
 *     responses:
 *       200:
 *         description: Évaluation
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/EvaluationResponse'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
LogsRouter.get("/evaluer/:idDeploiement", authMiddleware, async (req: Request, res: Response) => {
    try {
        const result = await LogsController.evaluer(
            req.currentUser!.userId,
            req.params.idDeploiement as string,
            toPositiveInt(req.query.minutes, 15, 1440),
        );
        sendResult(res, result);
    } catch (error) {
        sendServerError(res, error, "logs/evaluer");
    }
});

/**
 * @swagger
 * /logs/surveillance:
 *   get:
 *     summary: Lister mes surveillances actives
 *     description: Retourne les lectures de logs en temps réel en cours pour l'utilisateur connecté (avec compteurs).
 *     tags: [Logs]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Surveillances actives (peut être vide)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SurveillanceListResponse'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
LogsRouter.get("/surveillance", authMiddleware, (req: Request, res: Response) => {
    try {
        sendResult(res, LogsController.listerSurveillances(req.currentUser!.userId));
    } catch (error) {
        sendServerError(res, error, "logs/surveillance");
    }
});

/**
 * @swagger
 * /logs/surveillance/{idDeploiement}:
 *   post:
 *     summary: Démarrer la lecture en temps réel des logs
 *     description: |
 *       Lit les logs du déploiement en continu, identifie les erreurs (réseau, base de données, mémoire,
 *       port occupé, exceptions, crash, HTTP 5xx, etc.), les stocke et les pousse en temps réel via Socket.IO :
 *       événements `log:error`, `alerte:new` et `log:watch-stopped` (room `user-<idUtilisateur>`).
 *
 *       Sources :
 *       - **`file`** : suivi d'un fichier ; `chemin` est relatif à `uploads/<votre id>/`.
 *       - **`docker`** : `docker logs --follow` du conteneur `deploy-<idDeploiement>`.
 *
 *       La surveillance est en mémoire : elle doit être relancée après un redémarrage du serveur.
 *     tags: [Logs]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: idDeploiement
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Identifiant du déploiement
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [type]
 *             properties:
 *               type:
 *                 type: string
 *                 enum: [file, docker]
 *               chemin:
 *                 type: string
 *                 description: Requis si type = file
 *                 example: "3f2c.../app.log"
 *               depuisDebut:
 *                 type: boolean
 *                 default: false
 *                 description: Relire l'historique existant au lieu de ne suivre que les nouvelles lignes
 *     responses:
 *       201:
 *         description: Surveillance démarrée
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SurveillanceResponse'
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         description: Chemin en dehors de l'espace de stockage de l'utilisateur
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       409:
 *         description: Ce déploiement est déjà surveillé
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       429:
 *         description: Nombre maximal de surveillances simultanées atteint (10)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
LogsRouter.post("/surveillance/:idDeploiement", authMiddleware, async (req: Request, res: Response) => {
    try {
        const user = req.currentUser!;
        const result = await LogsController.demarrerSurveillance(
            user.userId,
            user.type,
            req.params.idDeploiement as string,
            req.body ?? {},
        );
        sendResult(res, result, 201);
    } catch (error) {
        sendServerError(res, error, "logs/surveillance/start");
    }
});

/**
 * @swagger
 * /logs/surveillance/{idDeploiement}:
 *   delete:
 *     summary: Arrêter la lecture en temps réel
 *     description: Arrête la surveillance du déploiement (les logs déjà stockés sont conservés).
 *     tags: [Logs]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: idDeploiement
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Identifiant du déploiement
 *     responses:
 *       200:
 *         description: Surveillance arrêtée
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
LogsRouter.delete("/surveillance/:idDeploiement", authMiddleware, async (req: Request, res: Response) => {
    try {
        sendResult(res, await LogsController.arreterSurveillance(req.currentUser!.userId, req.params.idDeploiement as string));
    } catch (error) {
        sendServerError(res, error, "logs/surveillance/stop");
    }
});

/**
 * @swagger
 * /logs/deploiement/{idDeploiement}:
 *   delete:
 *     summary: Purger les logs d'un déploiement
 *     description: Supprime tous les logs du déploiement, ou seulement ceux antérieurs à `avant`.
 *     tags: [Logs]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: idDeploiement
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Identifiant du déploiement
 *       - in: query
 *         name: avant
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Ne supprimer que les logs antérieurs à cette date (ISO 8601)
 *     responses:
 *       200:
 *         description: Logs supprimés
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "12 log(s) supprimé(s)"
 *                 data:
 *                   type: object
 *                   properties:
 *                     supprimes:
 *                       type: integer
 *                       example: 12
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
LogsRouter.delete("/deploiement/:idDeploiement", authMiddleware, async (req: Request, res: Response) => {
    try {
        const avant = toDate(req.query.avant);
        if (avant === null) {
            res.status(400).json({ success: false, message: "Date invalide (format ISO 8601 attendu)." });
            return;
        }
        sendResult(res, await LogsController.purger(req.currentUser!.userId, req.params.idDeploiement as string, avant));
    } catch (error) {
        sendServerError(res, error, "logs/purger");
    }
});

/**
 * @swagger
 * /logs/{idLog}:
 *   delete:
 *     summary: Supprimer un log
 *     description: Supprime une entrée de log appartenant à un déploiement de l'utilisateur connecté.
 *     tags: [Logs]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: idLog
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Identifiant du log
 *     responses:
 *       200:
 *         description: Log supprimé
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
LogsRouter.delete("/:idLog", authMiddleware, async (req: Request, res: Response) => {
    try {
        sendResult(res, await LogsController.supprimer(req.currentUser!.userId, req.params.idLog as string));
    } catch (error) {
        sendServerError(res, error, "logs/supprimer");
    }
});

export default LogsRouter;