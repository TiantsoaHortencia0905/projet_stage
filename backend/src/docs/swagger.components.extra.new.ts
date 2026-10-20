// src/docs/swagger.components.extra.ts
// Schémas Swagger des modules Projet, Database et Logs.
// (à couvrir par le glob `apis` de swagger-jsdoc, comme swagger.components.ts)

/**
 * @swagger
 * components:
 *   schemas:
 *     Projet:
 *       type: object
 *       properties:
 *         idProjet:
 *           type: string
 *           format: uuid
 *         nomProjet:
 *           type: string
 *           example: "Mon API"
 *         sourceProjet:
 *           type: string
 *           example: "https://github.com/acme/mon-api.git"
 *         etatProjet:
 *           type: string
 *           enum: [CREE, EN_COURS, DEPLOYE, ERREUR, ARRETE]
 *         dateProjet:
 *           type: string
 *           format: date-time
 *         idUtilisateur:
 *           type: string
 *           format: uuid
 *         depotGithub:
 *           type: string
 *           nullable: true
 *         brancheProjet:
 *           type: string
 *           nullable: true
 *         typeStack:
 *           type: string
 *           nullable: true
 *         portApplication:
 *           type: integer
 *           nullable: true
 *         commandeInstallation:
 *           type: string
 *           nullable: true
 *         commandeDemarrage:
 *           type: string
 *           nullable: true
 *         _count:
 *           type: object
 *           description: Présent dans les listes
 *           properties:
 *             deploiements:
 *               type: integer
 *         deploiements:
 *           type: array
 *           description: Présent sur GET /projet/{idProjet} (10 derniers)
 *           items:
 *             type: object
 *             properties:
 *               idDeploiement:
 *                 type: string
 *                 format: uuid
 *               dateDeploiement:
 *                 type: string
 *                 format: date-time
 *               etatDeploiement:
 *                 type: string
 *     ProjetResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           example: true
 *         message:
 *           type: string
 *         data:
 *           $ref: '#/components/schemas/Projet'
 *     ProjetListResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           example: true
 *         data:
 *           type: object
 *           properties:
 *             items:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Projet'
 *             total:
 *               type: integer
 *             page:
 *               type: integer
 *             limit:
 *               type: integer
 *     BaseDeDonnees:
 *       type: object
 *       properties:
 *         idBD:
 *           type: string
 *           format: uuid
 *         nomBD:
 *           type: string
 *           example: "ma_base"
 *         typeBD:
 *           type: string
 *           example: "postgresql"
 *         userBD:
 *           type: string
 *           example: "u_3f2c9a1b7d4e"
 *         dateCreation:
 *           type: string
 *           format: date-time
 *         idUtilisateur:
 *           type: string
 *           format: uuid
 *     Connexion:
 *       type: object
 *       properties:
 *         hote:
 *           type: string
 *           example: "db.example.com"
 *         port:
 *           type: integer
 *           example: 5432
 *         baseDeDonnees:
 *           type: string
 *           example: "bd_3f2c9a1b_ma_base"
 *         utilisateur:
 *           type: string
 *           example: "u_3f2c9a1b7d4e"
 *         motDePasse:
 *           type: string
 *         url:
 *           type: string
 *           example: "postgresql://u_3f2c9a1b7d4e:***@db.example.com:5432/bd_3f2c9a1b_ma_base"
 *     BaseDeDonneesConnexionResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           example: true
 *         message:
 *           type: string
 *         data:
 *           type: object
 *           properties:
 *             baseDeDonnees:
 *               $ref: '#/components/schemas/BaseDeDonnees'
 *             connexion:
 *               $ref: '#/components/schemas/Connexion'
 *     ConnexionResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           example: true
 *         message:
 *           type: string
 *         data:
 *           type: object
 *           properties:
 *             connexion:
 *               $ref: '#/components/schemas/Connexion'
 *     BaseDeDonneesListResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           example: true
 *         data:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/BaseDeDonnees'
 *     LogEntry:
 *       type: object
 *       properties:
 *         idLog:
 *           type: string
 *           format: uuid
 *         objetLog:
 *           type: string
 *           description: Catégorie identifiée
 *           example: "ERREUR_RESEAU"
 *         detailLog:
 *           type: string
 *           description: Niveau, ligne d'erreur et stack trace éventuelle
 *           example: "[ERROR] connect ECONNREFUSED 127.0.0.1:5432"
 *         dateLog:
 *           type: string
 *           format: date-time
 *         idDeploiement:
 *           type: string
 *           format: uuid
 *     LogAjoutResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           example: true
 *         message:
 *           type: string
 *           example: "1 erreur(s) stockée(s) sur 3 ligne(s) analysée(s)."
 *         data:
 *           type: object
 *           properties:
 *             recues:
 *               type: integer
 *             stockees:
 *               type: integer
 *             logs:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/LogEntry'
 *     LogListResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           example: true
 *         data:
 *           type: object
 *           properties:
 *             items:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/LogEntry'
 *             total:
 *               type: integer
 *             page:
 *               type: integer
 *             limit:
 *               type: integer
 *     Evaluation:
 *       type: object
 *       properties:
 *         idDeploiement:
 *           type: string
 *           format: uuid
 *         fenetreMinutes:
 *           type: integer
 *           example: 15
 *         etat:
 *           type: string
 *           enum: [SAIN, DEGRADE, CRITIQUE]
 *         totalErreurs:
 *           type: integer
 *         erreursFenetre:
 *           type: integer
 *         parCategorie:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               categorie:
 *                 type: string
 *                 example: "ERREUR_RESEAU"
 *               total:
 *                 type: integer
 *         derniereErreur:
 *           nullable: true
 *           allOf:
 *             - $ref: '#/components/schemas/LogEntry'
 *         alertesOuvertes:
 *           type: integer
 *         surveillanceActive:
 *           type: boolean
 *     EvaluationResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           example: true
 *         data:
 *           $ref: '#/components/schemas/Evaluation'
 *     Surveillance:
 *       type: object
 *       properties:
 *         idDeploiement:
 *           type: string
 *           format: uuid
 *         projet:
 *           type: string
 *         source:
 *           type: string
 *           enum: [file, docker]
 *         cible:
 *           type: string
 *           example: "uploads/<idUtilisateur>/app.log"
 *         demarreLe:
 *           type: string
 *           format: date-time
 *         lignesLues:
 *           type: integer
 *         erreursDetectees:
 *           type: integer
 *     SurveillanceResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           example: true
 *         message:
 *           type: string
 *         data:
 *           $ref: '#/components/schemas/Surveillance'
 *     SurveillanceListResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           example: true
 *         data:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/Surveillance'
 *   responses:
 *     ServiceUnavailable:
 *       description: Service indisponible (provisioning des bases non configuré)
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ErrorResponse'
 *           example:
 *             success: false
 *             message: "Service de création de bases indisponible."
 */
export {};
