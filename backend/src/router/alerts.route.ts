import { Router } from 'express';
import AlertsController from '../controller/Alerts/Alerts.controller.ts';
import { authMiddleware } from '../middlewares/Auth.middleware.ts';

const router = Router();
const controller = new AlertsController();

/**
 * @swagger
 * tags:
 *   name: Alerte
 *   description: Gestion des alertes générées sur les déploiements de l'utilisateur connecté
 */

/**
   * @swagger
   * /alerte:
   *   get:
   *     summary: Liste paginée des alertes de l'utilisateur
   *     tags: [Alerte]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: query
   *         name: page
   *         schema: { type: integer, default: 1, minimum: 1 }
   *       - in: query
   *         name: limit
   *         schema: { type: integer, default: 20, minimum: 1, maximum: 100 }
   *       - in: query
   *         name: idDeploiement
   *         schema: { type: string, format: uuid }
   *       - in: query
   *         name: prioriteAlerte
   *         schema: { type: string, enum: [BASSE, MOYENNE, HAUTE, CRITIQUE] }
   *       - in: query
   *         name: validationAlerte
   *         schema: { type: boolean }
   *       - in: query
   *         name: alerteResolu
   *         schema: { type: boolean }
   *     responses:
   *       200:
   *         description: Liste récupérée
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/AlerteListResponse'
   *       401:
   *         $ref: '#/components/responses/Unauthorized'
   *       500:
   *         $ref: '#/components/responses/ServerError'
   */
router.get('/', authMiddleware, controller.findAll.bind(controller));


  /**
   * @swagger
   * /alerte/{idAlerte}:
   *   get:
   *     summary: Détail d'une alerte
   *     tags: [Alerte]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: idAlerte
   *         required: true
   *         schema: { type: string, format: uuid }
   *     responses:
   *       200:
   *         description: Alerte trouvée
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/AlerteResponse'
   *       401:
   *         $ref: '#/components/responses/Unauthorized'
   *       404:
   *         $ref: '#/components/responses/AlerteNotFound'
   *       500:
   *         $ref: '#/components/responses/ServerError'
   */
router.get('/:idAlerte', authMiddleware, controller.findOne.bind(controller));

/**
   * @swagger
   * /alerte:
   *   post:
   *     summary: Créer une alerte sur un déploiement de l'utilisateur
   *     tags: [Alerte]
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/AlerteBody'
   *     responses:
   *       201:
   *         description: Alerte créée
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/AlerteResponse'
   *       400:
   *         $ref: '#/components/responses/BadRequest'
   *       401:
   *         $ref: '#/components/responses/Unauthorized'
   *       404:
   *         description: Déploiement introuvable
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   *       500:
   *         $ref: '#/components/responses/ServerError'
   */
router.post('/', authMiddleware, controller.create.bind(controller));

/**
   * @swagger
   * /alerte/{idAlerte}:
   *   patch:
   *     summary: Mettre à jour une alerte (titre, priorité, validation, résolution)
   *     tags: [Alerte]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: idAlerte
   *         required: true
   *         schema: { type: string, format: uuid }
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/AlerteUpdateBody'
   *     responses:
   *       200:
   *         description: Alerte mise à jour
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/AlerteResponse'
   *       400:
   *         $ref: '#/components/responses/BadRequest'
   *       401:
   *         $ref: '#/components/responses/Unauthorized'
   *       404:
   *         $ref: '#/components/responses/AlerteNotFound'
   *       500:
   *         $ref: '#/components/responses/ServerError'
   */
router.patch('/:idAlerte', authMiddleware, controller.update.bind(controller));

/**
   * @swagger
   * /alerte/{idAlerte}:
   *   delete:
   *     summary: Supprimer une alerte
   *     tags: [Alerte]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: idAlerte
   *         required: true
   *         schema: { type: string, format: uuid }
   *     responses:
   *       200:
   *         description: Alerte supprimée
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/SuccessMessage'
   *       401:
   *         $ref: '#/components/responses/Unauthorized'
   *       404:
   *         $ref: '#/components/responses/AlerteNotFound'
   *       500:
   *         $ref: '#/components/responses/ServerError'
   */
router.delete('/:idAlerte', authMiddleware, controller.remove.bind(controller));

export default router;