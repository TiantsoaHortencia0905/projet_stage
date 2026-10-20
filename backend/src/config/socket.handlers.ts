// src/config/socket.handlers.ts
import type { Server } from "socket.io";
import { verifyAccessToken } from "../middlewares/Auth.middleware.ts";

// BUG corrigé : l'ancienne version dépendait de NotificationSocketService, de verifyToken,
// d'idEntreprise et de roles (hérités d'un autre projet, absents ici, ids numériques).
// L'authentification réutilise maintenant exactement la même logique que l'API HTTP
// (signature, expiration, blacklist, utilisateur existant).
export const setupSocketHandlers = (io: Server) => {
  io.use(async (socket, next) => {
    try {
      const raw = socket.handshake.auth?.token ?? socket.handshake.headers.authorization;
      if (!raw || typeof raw !== "string") {
        return next(new Error("Authentication required"));
      }
      const { exp, ...user } = await verifyAccessToken(raw.replace(/^Bearer\s+/i, ""));
      socket.data.user = user;
      socket.data.exp = exp;
      next();
    } catch {
      next(new Error("Invalid token"));
    }
  });

  io.on("connection", (socket) => {
    const { userId, type } = socket.data.user as { userId: string; type: string };
    console.log(`🔌 Client connected: ${socket.id} (User: ${userId})`);

    socket.join(`user-${userId}`);
    if (type === "ADMIN") socket.join("admins");

    // Le JWT expire au bout d'1h : on coupe aussi la connexion à ce moment-là.
    const exp = socket.data.exp as number | undefined;
    const timer = exp
      ? setTimeout(() => socket.disconnect(true), Math.max(0, exp * 1000 - Date.now()))
      : undefined;

    // → Ajouter ici les événements métier (socket.on("...", ...))

    socket.on("disconnect", () => {
      if (timer) clearTimeout(timer);
      console.log(`🔌 Client disconnected: ${socket.id}`);
    });
  });
};