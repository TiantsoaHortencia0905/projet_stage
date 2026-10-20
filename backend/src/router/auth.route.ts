import { type Request, type Response, Router } from "express";
import AuthController from "../controller/Auth/Auth.controller.ts";
import type { Utilisateur } from "../generated/prisma/index.js";
import { authMiddleware } from "../middlewares/Auth.middleware.ts";
import { sendResult, sendServerError } from "../utils/Http/Http.utils.ts";

const AuthRouter = Router();

/**
 * @swagger
 * /auth/login:
 *   post:
 *     summary: Connexion utilisateur
 *     description: |
 *       Authentifie un utilisateur avec son email et son mot de passe.
 *       Retourne un token JWT (valable **1 heure**) à envoyer dans le header
 *       `Authorization: Bearer <token>` ainsi que le profil de l'utilisateur.
 *
 *       Pour des raisons de sécurité, le même message d'erreur est renvoyé que
 *       l'email n'existe pas ou que le mot de passe soit incorrect.
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/LoginBody'
 *     responses:
 *       200:
 *         description: Connexion réussie
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/LoginResponse'
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         description: Identifiants invalides
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               success: false
 *               message: "Identifiants invalides"
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
AuthRouter.post("/login", async (req: Request, res: Response) => {
    try {
        const result = await AuthController.login(req.body);
        sendResult(res, result);
    } catch (error) {
        sendServerError(res, error, "auth/login");
    }
});

/**
 * @swagger
 * /auth/register:
 *   post:
 *     summary: Création de compte utilisateur
 *     description: |
 *       Crée un compte avec nom, surnom, email et mot de passe (8 caractères minimum).
 *       L'email et le surnom doivent être uniques. Le mot de passe est haché (bcrypt).
 *
 *       Seul le type `USER` est autorisé à l'inscription ; si `typeUtilisateur` est omis,
 *       `USER` est utilisé.
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/RegisterBody'
 *     responses:
 *       201:
 *         description: Compte créé
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/RegisterResponse'
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       403:
 *         description: Type de compte non autorisé à l'inscription (ex. ADMIN)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       409:
 *         $ref: '#/components/responses/Conflict'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
AuthRouter.post("/register", async (req: Request, res: Response) => {
    try {
        const result = await AuthController.register(req.body as Partial<Utilisateur>);
        sendResult(res, result, 201);
    } catch (error) {
        sendServerError(res, error, "auth/register");
    }
});

/**
 * @swagger
 * /auth/verify_username/{username}:
 *   get:
 *     summary: Vérifier la disponibilité d'un surnom
 *     description: |
 *       Indique si un surnom est disponible (utile pour la validation en temps réel
 *       d'un formulaire d'inscription).
 *     tags: [Auth]
 *     parameters:
 *       - in: path
 *         name: username
 *         required: true
 *         schema:
 *           type: string
 *         description: Surnom à vérifier (3 à 30 caractères)
 *         example: "jrakoto"
 *     responses:
 *       200:
 *         description: Surnom disponible
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessMessage'
 *             example:
 *               success: true
 *               message: "Surnom valide"
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       409:
 *         description: Surnom déjà utilisé
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               success: false
 *               message: "Surnom déjà utilisé"
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
AuthRouter.get("/verify_username/:username", async (req: Request, res: Response) => {
    try {
        const result = await AuthController.verifyUsername(req.params.username as string);
        sendResult(res, result);
    } catch (error) {
        sendServerError(res, error, "auth/verify_username");
    }
});

/**
 * @swagger
 * /auth/logout:
 *   post:
 *     summary: Déconnexion
 *     description: |
 *       Révoque le token JWT courant (ajouté à la liste noire). Il ne pourra plus
 *       être utilisé, même s'il n'a pas encore expiré.
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Déconnexion réussie
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessMessage'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
AuthRouter.post("/logout", authMiddleware, async (req: Request, res: Response) => {
    try {
        const result = await AuthController.logout(req.currentUser!.token);
        sendResult(res, result);
    } catch (error) {
        sendServerError(res, error, "auth/logout");
    }
});

export default AuthRouter;