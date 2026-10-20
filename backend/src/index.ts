import express , {type Express} from "express";
import cors from "cors"
import dotenv from "dotenv"
import http from "http"
import { socketManager } from "./config/socket.manager.ts";
import { setupSocketHandlers } from "./config/socket.handlers.ts";
import AuthRouter from "./router/auth.route.ts";
import path from "path";
import fileRouter from "./router/fichiers.route.ts";
import EspaceRouter from "./router/espace.route.ts";
import LogsRouter from "./router/logs.route.ts";
import DatabaseRouter from "./router/database.route.ts";
import type { ServerOptions } from "socket.io";
import alerteRoutes from './router/alerts.route.ts';
import OAuthRouter from "./router/oauth.route.ts";
import { fileURLToPath } from "url";
import { initDatabases } from "./services/database.provisioner.service.ts";
import FichierController from "./controller/Fichiers/Fichiers.controller.ts";

// fileURLToPath : `URL.pathname` donne "/E:/..." sous Windows, chemin que dotenv ne trouve pas
dotenv.config({
  path: fileURLToPath(new URL('../.env', import.meta.url)),
  override: true,
});

const app:Express = express();

const FRONTEND_URL = process.env.FRONTEND_URL!
const corsOptions = {
  origin: [
    FRONTEND_URL,
    'http://localhost:5173'
  ],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'X-Requested-With'],
  credentials: true,
  optionsSuccessStatus: 200,
};

const { swaggerUiServe, swaggerUiSetup } = await import('./swagger.ts');

// ── Middlewares Express ────────────────────────────────────────────────────
app.use(express.json());
app.use(cors(corsOptions));
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

//---Routes-------------------------------------------------------------------
app.use('/auth',AuthRouter)
app.use('/fichier',fileRouter)
app.use('/espace',EspaceRouter)
app.use('/logs',LogsRouter)
app.use('/database',DatabaseRouter)
app.use('/alerte', alerteRoutes)
app.use('/oauth',OAuthRouter)

// ── Serveur HTTP ───────────────────────────────────────────────────────────
const server = http.createServer(app);
// Uploads volumineux (jusqu'au quota d'un espace) : Node coupe sinon toute requête au bout de 5 min.
// Les en-têtes restent soumis à headersTimeout (60 s par défaut).
server.requestTimeout = 60 * 60 * 1000;

// ── Config Socket.IO ───────────────────────────────────────────────────────
const socketConfig:Partial<ServerOptions> = {
  cors: {
    origin: corsOptions.origin,
    methods: ['GET', 'POST'],
    credentials: true,
  },
  pingTimeout: 60000,
  pingInterval: 25000,
  transports: ['websocket', 'polling'],
};

// ── Initialisation Socket.IO ───────────────────────────────────────────────
const io = socketManager.initialize(server, socketConfig);
setupSocketHandlers(io);

app.use('/api-docs', swaggerUiServe, swaggerUiSetup);

server.listen(process.env.PORT!, () => {
  console.log("Server running on "+process.env.PORT!);
  console.log(path.resolve(path.dirname("../uploads")))

  // Resynchronise les bases et déploiements avec Docker (créations interrompues, conteneurs arrêtés,
  // reprise de la lecture des logs) — sans bloquer le démarrage de l'API.
  initDatabases().catch((e) => console.error("[database] initialisation impossible:", e));

  // Corbeille : suppression définitive des fichiers expirés, au démarrage puis toutes les 6 h
  const purger = () =>
    FichierController.purgerCorbeille()
      .then((n) => n > 0 && console.log(`[corbeille] ${n} fichier(s) expiré(s) supprimé(s) définitivement.`))
      .catch((e) => console.error("[corbeille] purge impossible:", e));
  void purger();
  setInterval(purger, 6 * 60 * 60 * 1000).unref();
});

// ── Arrêt propre ───────────────────────────────────────────────────────────
process.on('SIGTERM', () => {
  console.log('SIGTERM received, closing server...');
  socketManager.close();
  server.close(() => process.exit(0));
});

process.on('SIGINT', () => {
  console.log('SIGINT received, closing server...');
  socketManager.close();
  server.close(() => process.exit(0));
});
