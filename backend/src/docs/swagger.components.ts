// src/docs/swagger.components.ts
// Schémas et réponses partagés par toute la documentation Swagger.
// ⚠️ Ce fichier doit être couvert par le glob `apis` de swagger-jsdoc (ex: "./src/**/*.ts").

/**
 * @swagger
 * components:
 *   securitySchemes:
 *     bearerAuth:
 *       type: http
 *       scheme: bearer
 *       bearerFormat: JWT
 *       description: "Token JWT obtenu via POST /auth/login (durée de vie : 1 heure)."
 *   schemas:
 *     UserProfile:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *           example: "0b8f6a1e-5d0c-4a4e-9a55-2f3c9f0d7a11"
 *         nom:
 *           type: string
 *           example: "Jean Rakoto"
 *         surnom:
 *           type: string
 *           example: "jrakoto"
 *         email:
 *           type: string
 *           format: email
 *           example: "jean.rakoto@acme.mg"
 *         type:
 *           type: string
 *           example: "USER"
 *     LoginBody:
 *       type: object
 *       required: [email, password]
 *       properties:
 *         email:
 *           type: string
 *           format: email
 *           example: "jean.rakoto@acme.mg"
 *         password:
 *           type: string
 *           format: password
 *           example: "MonMotDePasse123"
 *     RegisterBody:
 *       type: object
 *       required: [nomUtilisateur, surnomUtilisateur, mailUtilisateur, mdpUtilisateur]
 *       properties:
 *         nomUtilisateur:
 *           type: string
 *           example: "Jean Rakoto"
 *         surnomUtilisateur:
 *           type: string
 *           pattern: '^[a-zA-Z0-9_.-]{3,30}$'
 *           description: "Unique. 3 à 30 caractères (lettres, chiffres, _ . -)."
 *           example: "jrakoto"
 *         mailUtilisateur:
 *           type: string
 *           format: email
 *           description: "Unique."
 *           example: "jean.rakoto@acme.mg"
 *         mdpUtilisateur:
 *           type: string
 *           format: password
 *           minLength: 8
 *           example: "MonMotDePasse123"
 *         typeUtilisateur:
 *           type: string
 *           enum: [USER]
 *           default: USER
 *           description: "Optionnel. Seul USER est autorisé à l'inscription (les comptes ADMIN sont créés autrement)."
 *     LoginResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           example: true
 *         message:
 *           type: string
 *           example: "Connexion réussie"
 *         data:
 *           type: object
 *           properties:
 *             token:
 *               type: string
 *               example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
 *             user:
 *               $ref: '#/components/schemas/UserProfile'
 *     RegisterResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           example: true
 *         message:
 *           type: string
 *           example: "Compte créé avec succès"
 *         data:
 *           type: object
 *           properties:
 *             user:
 *               $ref: '#/components/schemas/UserProfile'
 *     EspaceStockage:
 *       type: object
 *       properties:
 *         idEspace:
 *           type: string
 *           format: uuid
 *         nomEspace:
 *           type: string
 *           example: "Documents"
 *         tailleEspace:
 *           type: number
 *           description: "Quota total en octets."
 *           example: 15728640
 *         tailleOccupee:
 *           type: number
 *           description: "Espace utilisé en octets."
 *           example: 2048
 *         cheminEspace:
 *           type: string
 *           example: "uploads/<idUtilisateur>/<idEspace>"
 *         idUtilisateur:
 *           type: string
 *           format: uuid
 *         idFichiers:
 *           type: array
 *           items:
 *             type: string
 *             format: uuid
 *     Fichier:
 *       type: object
 *       properties:
 *         idFichier:
 *           type: string
 *           format: uuid
 *         nomFichier:
 *           type: string
 *           description: "Nom affiché (nom d'origine du fichier ou nom choisi via /renommer)."
 *           example: "rapport.pdf"
 *         cheminFichier:
 *           type: string
 *           example: "uploads/<idUtilisateur>/<idEspace>/fichier_1700000000000-123456789.pdf"
 *         tailleFichier:
 *           type: number
 *           description: "Taille en octets."
 *           example: 204800
 *         idEspaces:
 *           type: array
 *           items:
 *             type: string
 *             format: uuid
 *         idUtilisateur:
 *           type: string
 *           format: uuid
 *     EspaceResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           example: true
 *         message:
 *           type: string
 *         data:
 *           $ref: '#/components/schemas/EspaceStockage'
 *     EspaceListResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           example: true
 *         data:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/EspaceStockage'
 *     FichierResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           example: true
 *         message:
 *           type: string
 *         data:
 *           $ref: '#/components/schemas/Fichier'
 *     FichierListResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           example: true
 *         data:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/Fichier'
 *     SuccessMessage:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           example: true
 *         message:
 *           type: string
 *           example: "Opération réussie"
 *     ErrorResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           example: false
 *         message:
 *           type: string
 *           example: "Description de l'erreur"
 *   responses:
 *     BadRequest:
 *       description: Requête invalide (paramètre ou champ manquant / mal formé)
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ErrorResponse'
 *     Unauthorized:
 *       description: Token manquant, invalide, expiré ou révoqué
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ErrorResponse'
 *           example:
 *             success: false
 *             message: "Token manquant ou invalide"
 *     Forbidden:
 *       description: Accès refusé (ressource d'un autre utilisateur)
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ErrorResponse'
 *           example:
 *             success: false
 *             message: "Accès refusé à cette ressource"
 *     NotFound:
 *       description: Ressource introuvable (ou n'appartenant pas à l'utilisateur)
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ErrorResponse'
 *     Conflict:
 *       description: Conflit (valeur déjà utilisée)
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ErrorResponse'
 *     ServerError:
 *       description: Erreur interne du serveur
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ErrorResponse'
 *           example:
 *             success: false
 *             message: "Erreur interne du serveur"
 */
export {};