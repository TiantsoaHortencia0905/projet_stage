import { type Request, type Response, Router } from "express";
import OAuthController from "../controller/Auth/OAuth.controller.ts";
import { sendResult, sendServerError } from "../utils/Http/Http.utils.ts";

const OAuthRouter = Router();

const qs = (v: unknown): string | undefined => (typeof v === "string" && v.trim() !== "" ? v.trim() : undefined);

/**
 * @swagger
 * /oauth/{provider}:
 *   get:
 *     summary: Se connecter / s'inscrire avec GitHub ou Google
 *     description: |
 *       Démarre le flux OAuth. Par défaut le serveur **redirige (302)** le navigateur vers la page d'autorisation
 *       du fournisseur : le front n'a qu'à ouvrir `GET /auth/oauth/google` ou `/auth/oauth/github`.
 *       Avec `?mode=json`, l'URL est renvoyée dans la réponse au lieu d'être suivie.
 *
 *       Déroulement : fournisseur → `GET /auth/oauth/{provider}/callback` → redirection vers le front avec un
 *       **code d'échange à usage unique** → `POST /auth/oauth/exchange` → JWT (même réponse que `/auth/login`).
 *
 *       Au premier passage le compte est créé (type `USER`) ; si l'e-mail vérifié correspond à un compte existant,
 *       l'identité y est liée. Seules les adresses e-mail **vérifiées** par le fournisseur sont acceptées.
 *     tags: [OAuth]
 *     security: []
 *     parameters:
 *       - in: path
 *         name: provider
 *         required: true
 *         schema:
 *           type: string
 *           enum: [github, google]
 *       - in: query
 *         name: mode
 *         schema:
 *           type: string
 *           enum: [json]
 *         description: "`json` : renvoie l'URL au lieu de rediriger"
 *     responses:
 *       200:
 *         description: URL d'autorisation (mode=json)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     url:
 *                       type: string
 *       302:
 *         description: Redirection vers le fournisseur
 *       404:
 *         description: Fournisseur inconnu
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 *       503:
 *         description: Fournisseur non configuré (variables d'environnement manquantes)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
OAuthRouter.get("/:provider", (req: Request, res: Response) => {
    try {
        const result = OAuthController.urlAutorisation(req.params.provider as string);
        if (!result.success || req.query.mode === "json") {
            sendResult(res, result);
            return;
        }
        res.redirect(result.data!.url);
    } catch (error) {
        sendServerError(res, error, "auth/oauth/start");
    }
});

/**
 * @swagger
 * /oauth/{provider}/callback:
 *   get:
 *     summary: Retour OAuth du fournisseur (appelé par le navigateur)
 *     description: |
 *       **Ne pas appeler directement** : c'est l'URL de redirection à déclarer chez GitHub / Google.
 *       Vérifie le `state`, récupère le profil, retrouve / lie / crée le compte, puis redirige vers
 *       `OAUTH_FRONTEND_REDIRECT` (ou `FRONTEND_URL/auth/callback`) avec :
 *       - succès : `?status=success&code=<code d'échange>` (valable 60 s, usage unique) ;
 *       - échec : `?status=error&message=<motif>`.
 *     tags: [OAuth]
 *     security: []
 *     parameters:
 *       - in: path
 *         name: provider
 *         required: true
 *         schema:
 *           type: string
 *           enum: [github, google]
 *       - in: query
 *         name: code
 *         schema:
 *           type: string
 *       - in: query
 *         name: state
 *         schema:
 *           type: string
 *       - in: query
 *         name: error
 *         schema:
 *           type: string
 *         description: Renseigné par le fournisseur si l'utilisateur a refusé
 *     responses:
 *       302:
 *         description: Redirection vers le front avec le résultat
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
OAuthRouter.get("/:provider/callback", async (req: Request, res: Response) => {
    try {
        const result =
            typeof req.query.error === "string"
                ? { success: false, status: 400, message: "Autorisation refusée.", data: undefined }
                : await OAuthController.callback(req.params.provider as string, qs(req.query.code), qs(req.query.state));

        const base = process.env.OAUTH_FRONTEND_REDIRECT ?? (process.env.FRONTEND_URL ? `${process.env.FRONTEND_URL}/auth/callback` : undefined);
        if (!base) {
            sendResult(res, result as Parameters<typeof sendResult>[1]);
            return;
        }
        const url = new URL(base);
        url.searchParams.set("status", result.success ? "success" : "error");
        if (result.success && result.data) url.searchParams.set("code", result.data.codeEchange);
        else url.searchParams.set("message", result.message ?? "Échec de la connexion.");
        res.redirect(url.toString());
    } catch (error) {
        sendServerError(res, error, "auth/oauth/callback");
    }
});

/**
 * @swagger
 * /oauth/exchange:
 *   post:
 *     summary: Échanger le code de connexion OAuth contre le JWT
 *     description: |
 *       À appeler par le front avec le `code` reçu dans l'URL de redirection. Le code est **à usage unique** et expire
 *       après 60 secondes ; la réponse est identique à celle de `POST /auth/login`.
 *     tags: [OAuth]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [code]
 *             properties:
 *               code:
 *                 type: string
 *                 example: "q3JmZ0xkVwYyN2c0..."
 *     responses:
 *       200:
 *         description: Connexion réussie
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/LoginResponse'
 *       400:
 *         description: Code manquant, invalide, expiré ou déjà utilisé
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
OAuthRouter.post("/exchange", (req: Request, res: Response) => {
    try {
        sendResult(res, OAuthController.echanger(req.body?.code));
    } catch (error) {
        sendServerError(res, error, "auth/oauth/exchange");
    }
});

export default OAuthRouter;
