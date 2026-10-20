// src/docs/swagger.components.deploy.ts
// Schémas Swagger : GitHub et déploiements Docker (couvert par le glob "./src/docs/*.ts").

/**
 * @swagger
 * components:
 *   schemas:
 *     GithubStatus:
 *       type: object
 *       properties:
 *         connecte:
 *           type: boolean
 *         tokenValide:
 *           type: boolean
 *           description: false si le jeton a été révoqué côté GitHub (reconnexion nécessaire)
 *         login:
 *           type: string
 *           example: "jrakoto"
 *         avatarUrl:
 *           type: string
 *           nullable: true
 *         emailVerifie:
 *           type: boolean
 *           description: Le compte GitHub possède au moins un e-mail vérifié
 *         emailPrincipal:
 *           type: string
 *           nullable: true
 *         emailCorrespond:
 *           type: boolean
 *           description: Un e-mail vérifié GitHub est identique à l'e-mail du compte ArchiCloud
 *         scope:
 *           type: string
 *           example: "repo,read:user,user:email"
 *         dateLiaison:
 *           type: string
 *           format: date-time
 *         dateVerification:
 *           type: string
 *           format: date-time
 *     GithubStatusResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           example: true
 *         data:
 *           $ref: '#/components/schemas/GithubStatus'
 *     GithubRepoItem:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *         nom:
 *           type: string
 *           example: "mon-api"
 *         nomComplet:
 *           type: string
 *           description: À utiliser comme `depot` pour le déploiement
 *           example: "acme/mon-api"
 *         prive:
 *           type: boolean
 *         fork:
 *           type: boolean
 *         archive:
 *           type: boolean
 *         brancheParDefaut:
 *           type: string
 *           example: "main"
 *         description:
 *           type: string
 *           nullable: true
 *         langage:
 *           type: string
 *           nullable: true
 *           example: "TypeScript"
 *         url:
 *           type: string
 *         tailleKo:
 *           type: integer
 *         dernierPush:
 *           type: string
 *           format: date-time
 *           nullable: true
 *     GithubRepoListResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           example: true
 *         data:
 *           type: object
 *           properties:
 *             page:
 *               type: integer
 *             limit:
 *               type: integer
 *             pageSuivante:
 *               type: boolean
 *               description: Il existe une page suivante
 *             items:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/GithubRepoItem'
 *     GithubBranchListResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           example: true
 *         data:
 *           type: object
 *           properties:
 *             brancheParDefaut:
 *               type: string
 *               example: "main"
 *             branches:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   name:
 *                     type: string
 *                   protected:
 *                     type: boolean
 *     DeployBody:
 *       type: object
 *       required: [depot]
 *       properties:
 *         depot:
 *           type: string
 *           description: Dépôt au format `proprietaire/nom` (voir GET /github/repos)
 *           example: "acme/mon-api"
 *         branche:
 *           type: string
 *           description: Branche à déployer (défaut = branche par défaut du dépôt)
 *           example: "main"
 *         nomProjet:
 *           type: string
 *           maxLength: 100
 *           description: Défaut = nom du dépôt (suffixé -2, -3… s'il existe déjà)
 *         port:
 *           type: integer
 *           minimum: 1
 *           maximum: 65535
 *           description: Port d'écoute de l'application dans le conteneur (défaut Node 3000, Python 8000, ou EXPOSE du Dockerfile)
 *           example: 3000
 *         commandeInstallation:
 *           type: string
 *           maxLength: 500
 *           description: Une ligne. Défaut Node `npm ci` / `npm install`, Python `pip install -r requirements.txt`. Ignorée si le dépôt fournit un Dockerfile.
 *           example: "npm ci"
 *         commandeDemarrage:
 *           type: string
 *           maxLength: 500
 *           description: Une ligne. Défaut Node `npm start`. Requise pour Python sans main.py / app.py. Ignorée si le dépôt fournit un Dockerfile.
 *           example: "node dist/index.js"
 *         commandeTest:
 *           type: string
 *           maxLength: 500
 *           description: |
 *             Une ligne. Exécutée avant la mise en ligne dans un conteneur jetable : un échec annule le déploiement.
 *             Défaut : `npm test` (si le package.json a un vrai script « test »), `pytest` ou `unittest` pour Python.
 *           example: "npm test"
 *         variablesEnv:
 *           type: object
 *           additionalProperties:
 *             type: string
 *           description: Variables d'environnement du conteneur (50 max, `PORT` réservé). Stockées chiffrées, jamais renvoyées.
 *           example:
 *             NODE_ENV: "production"
 *             DATABASE_URL: "postgresql://..."
 *     ProjetDeploye:
 *       type: object
 *       properties:
 *         idProjet:
 *           type: string
 *           format: uuid
 *         nomProjet:
 *           type: string
 *         sourceProjet:
 *           type: string
 *           example: "https://github.com/acme/mon-api.git"
 *         etatProjet:
 *           type: string
 *           enum: [CREE, EN_COURS, DEPLOYE, ERREUR, ARRETE]
 *         depotGithub:
 *           type: string
 *           nullable: true
 *           example: "acme/mon-api"
 *         brancheProjet:
 *           type: string
 *           nullable: true
 *         typeStack:
 *           type: string
 *           nullable: true
 *           enum: [dockerfile, node, python]
 *         portApplication:
 *           type: integer
 *           nullable: true
 *         commandeInstallation:
 *           type: string
 *           nullable: true
 *         commandeDemarrage:
 *           type: string
 *           nullable: true
 *         commandeTest:
 *           type: string
 *           nullable: true
 *         dateProjet:
 *           type: string
 *           format: date-time
 *     DeploiementEntity:
 *       type: object
 *       properties:
 *         idDeploiement:
 *           type: string
 *           format: uuid
 *         etatDeploiement:
 *           type: string
 *           enum: [EN_ATTENTE, CLONAGE, CONSTRUCTION, DEMARRAGE, DEPLOYE, ERREUR, ARRETE]
 *         messageEtat:
 *           type: string
 *           nullable: true
 *           description: Détail de l'état (motif de l'échec en cas d'ERREUR)
 *         dateDeploiement:
 *           type: string
 *           format: date-time
 *         dateFin:
 *           type: string
 *           format: date-time
 *           nullable: true
 *         idProjet:
 *           type: string
 *           format: uuid
 *         commitSha:
 *           type: string
 *           nullable: true
 *         branche:
 *           type: string
 *           nullable: true
 *         idConteneur:
 *           type: string
 *           nullable: true
 *         nomConteneur:
 *           type: string
 *           nullable: true
 *           example: "deploy-3f2c9a1b-..."
 *         imageDocker:
 *           type: string
 *           nullable: true
 *         portHote:
 *           type: integer
 *           nullable: true
 *           example: 20417
 *         urlDeploiement:
 *           type: string
 *           nullable: true
 *           example: "http://localhost:20417"
 *         _count:
 *           type: object
 *           description: Présent dans les listes et le détail
 *           properties:
 *             logs:
 *               type: integer
 *             alertes:
 *               type: integer
 *     DeployAcceptedResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           example: true
 *         message:
 *           type: string
 *           example: "Déploiement lancé."
 *         data:
 *           type: object
 *           properties:
 *             projet:
 *               $ref: '#/components/schemas/ProjetDeploye'
 *             deploiement:
 *               $ref: '#/components/schemas/DeploiementEntity'
 *     RedeployAcceptedResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           example: true
 *         message:
 *           type: string
 *           example: "Redéploiement lancé."
 *         data:
 *           type: object
 *           properties:
 *             deploiement:
 *               $ref: '#/components/schemas/DeploiementEntity'
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
 *                 $ref: '#/components/schemas/DeploiementEntity'
 *             total:
 *               type: integer
 *             page:
 *               type: integer
 *             limit:
 *               type: integer
 *     DeploiementDetailResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           example: true
 *         data:
 *           allOf:
 *             - $ref: '#/components/schemas/DeploiementEntity'
 *             - type: object
 *               properties:
 *                 projet:
 *                   $ref: '#/components/schemas/ProjetDeploye'
 */
export {};
