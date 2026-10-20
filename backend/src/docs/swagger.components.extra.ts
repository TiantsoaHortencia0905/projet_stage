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

/**
 * @swagger
 * components:
 *   schemas:
 *     Deploiement:
 *       type: object
 *       properties:
 *         idDeploiement:
 *           type: string
 *           format: uuid
 *         dateDeploiement:
 *           type: string
 *           format: date-time
 *         etatDeploiement:
 *           type: string
 *           enum: [EN_COURS, SUCCES, ECHEC, ARRETE]
 *         idProjet:
 *           type: string
 *           format: uuid
 *         projet:
 *           type: object
 *           description: Présent sur GET /deploiement/{idDeploiement}
 *           properties:
 *             idProjet:
 *               type: string
 *               format: uuid
 *             nomProjet:
 *               type: string
 *             sourceProjet:
 *               type: string
 *             etatProjet:
 *               type: string
 *         _count:
 *           type: object
 *           description: Présent dans les listes
 *           properties:
 *             logs:
 *               type: integer
 *             alertes:
 *               type: integer
 *     DeploiementResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           example: true
 *         message:
 *           type: string
 *         data:
 *           $ref: '#/components/schemas/Deploiement'
 *     DeploiementListResponse:
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
 *                 $ref: '#/components/schemas/Deploiement'
 *             total:
 *               type: integer
 *             page:
 *               type: integer
 *             limit:
 *               type: integer
 *     DeploiementBody:
 *       type: object
 *       required: [idProjet]
 *       properties:
 *         idProjet:
 *           type: string
 *           format: uuid
 *           example: "0b8f6a1e-5d0c-4a4e-9a55-2f3c9f0d7a11"
 *         etatDeploiement:
 *           type: string
 *           enum: [EN_COURS, SUCCES, ECHEC, ARRETE]
 *           default: EN_COURS
 *     DeploiementUpdateBody:
 *       type: object
 *       properties:
 *         etatDeploiement:
 *           type: string
 *           enum: [EN_COURS, SUCCES, ECHEC, ARRETE]
 *     Alerte:
 *       type: object
 *       properties:
 *         idAlerte:
 *           type: string
 *           format: uuid
 *         titreAlerte:
 *           type: string
 *           example: "Pic d'erreurs détecté"
 *         dateAlerte:
 *           type: string
 *           example: "2026-09-29T10:15:00.000Z"
 *         prioriteAlerte:
 *           type: string
 *           enum: [BASSE, MOYENNE, HAUTE, CRITIQUE]
 *         validationAlerte:
 *           type: boolean
 *           description: "L'alerte a été vue/validée par l'utilisateur."
 *         alerteResolu:
 *           type: boolean
 *           description: "L'alerte a été marquée comme résolue."
 *         idDeploiement:
 *           type: string
 *           format: uuid
 *         deploiement:
 *           type: object
 *           description: Présent sur GET /alerte/{idAlerte}
 *           properties:
 *             idDeploiement:
 *               type: string
 *               format: uuid
 *             etatDeploiement:
 *               type: string
 *             idProjet:
 *               type: string
 *               format: uuid
 *     AlerteResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           example: true
 *         message:
 *           type: string
 *         data:
 *           $ref: '#/components/schemas/Alerte'
 *     AlerteListResponse:
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
 *                 $ref: '#/components/schemas/Alerte'
 *             total:
 *               type: integer
 *             page:
 *               type: integer
 *             limit:
 *               type: integer
 *     AlerteBody:
 *       type: object
 *       required: [titreAlerte, prioriteAlerte, idDeploiement]
 *       properties:
 *         titreAlerte:
 *           type: string
 *           example: "Pic d'erreurs détecté"
 *         prioriteAlerte:
 *           type: string
 *           enum: [BASSE, MOYENNE, HAUTE, CRITIQUE]
 *           example: "HAUTE"
 *         idDeploiement:
 *           type: string
 *           format: uuid
 *         validationAlerte:
 *           type: boolean
 *           default: false
 *         alerteResolu:
 *           type: boolean
 *           default: false
 *     AlerteUpdateBody:
 *       type: object
 *       properties:
 *         titreAlerte:
 *           type: string
 *         prioriteAlerte:
 *           type: string
 *           enum: [BASSE, MOYENNE, HAUTE, CRITIQUE]
 *         validationAlerte:
 *           type: boolean
 *         alerteResolu:
 *           type: boolean
 *   responses:
 *     DeploiementNotFound:
 *       description: Déploiement introuvable ou n'appartenant pas à l'utilisateur
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ErrorResponse'
 *           example:
 *             success: false
 *             message: "Déploiement introuvable"
 *     AlerteNotFound:
 *       description: Alerte introuvable ou n'appartenant pas à l'utilisateur
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ErrorResponse'
 *           example:
 *             success: false
 *             message: "Alerte introuvable"
 */
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
 *           enum: [postgresql, mysql, mariadb, mongodb, redis]
 *         versionBD:
 *           type: string
 *           nullable: true
 *           example: "16-alpine"
 *         etatBD:
 *           type: string
 *           enum: [CREATION, EN_LIGNE, ARRETE, ERREUR]
 *         messageEtat:
 *           type: string
 *           nullable: true
 *           description: Détail de l'état (motif de l'échec en cas d'ERREUR)
 *         nomBase:
 *           type: string
 *           nullable: true
 *           description: Nom de la base dans le moteur (null pour Redis)
 *         userBD:
 *           type: string
 *           example: "u_3f2c9a1b7d4e"
 *         imageDocker:
 *           type: string
 *           nullable: true
 *           example: "postgres:16-alpine"
 *         nomConteneur:
 *           type: string
 *           nullable: true
 *         portHote:
 *           type: integer
 *           nullable: true
 *           example: 31542
 *         dateCreation:
 *           type: string
 *           format: date-time
 *         idUtilisateur:
 *           type: string
 *           format: uuid
 *     Connexion:
 *       type: object
 *       properties:
 *         type:
 *           type: string
 *           example: "postgresql"
 *         hote:
 *           type: string
 *           example: "db.example.com"
 *         port:
 *           type: integer
 *           nullable: true
 *           example: 31542
 *         baseDeDonnees:
 *           type: string
 *           nullable: true
 *           example: "ma_base"
 *         utilisateur:
 *           type: string
 *           example: "u_3f2c9a1b7d4e"
 *         motDePasse:
 *           type: string
 *         url:
 *           type: string
 *           nullable: true
 *           example: "postgresql://u_3f2c9a1b7d4e:***@db.example.com:31542/ma_base"
 *     DatabaseTypeListResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           example: true
 *         data:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               type:
 *                 type: string
 *                 example: "postgresql"
 *               label:
 *                 type: string
 *                 example: "PostgreSQL"
 *               versions:
 *                 type: array
 *                 items:
 *                   type: string
 *                 example: ["17-alpine", "16-alpine"]
 *               versionParDefaut:
 *                 type: string
 *                 example: "16-alpine"
 *               portInterne:
 *                 type: integer
 *                 example: 5432
 *               avecNomBase:
 *                 type: boolean
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