import { io, type Socket } from "socket.io-client";
import { BASE_URL } from "../config/api.config";
import { getToken } from "../lib/http";

let socket: Socket | null = null;
let socketToken: string | null = null;

/** Connexion Socket.IO authentifiée, partagée par toute l'application (une par session). */
export const connectSocket = (): Socket | null => {
  const token = getToken();
  if (!token) return null;
  if (socket && socketToken === token) return socket;

  socket?.disconnect();
  socketToken = token;
  socket = io(BASE_URL, {
    auth: { token },
    transports: ["websocket", "polling"],
  });
  return socket;
};

export const disconnectSocket = () => {
  socket?.disconnect();
  socket = null;
  socketToken = null;
};

export const getSocket = (): Socket | null => socket;
