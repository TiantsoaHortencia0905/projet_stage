// src/config/socket.config.ts
import type { Server as HttpServer } from "http";
import type { ServerOptions } from "socket.io";
import { socketManager } from "./socket.manager.ts";

// BUG corrigé : `origin: "*"` combiné à `credentials: true` est refusé par les navigateurs.
// Définir CORS_ORIGIN (liste séparée par des virgules) ; hors production, l'origine appelante est acceptée.
const allowedOrigins = process.env.CORS_ORIGIN?.split(",").map((o) => o.trim());

export const socketOptions: Partial<ServerOptions> = {
  cors: {
    origin: allowedOrigins ?? (process.env.NODE_ENV === "production" ? false : true),
    methods: ["GET", "POST"],
    credentials: true,
  },
  pingTimeout: 60000,
  pingInterval: 25000,
  transports: ["websocket", "polling"],
};

// BUG corrigé : avant, ce fichier créait son propre Server alors que SocketManager en crée un aussi
// (2 serveurs Socket.IO sur le même HTTP server). Il passe maintenant par le singleton.
export const createSocketServer = (server: HttpServer) =>
  socketManager.initialize(server, socketOptions);