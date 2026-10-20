// src/config/socket.manager.ts
import type { Server as HttpServer } from "http";
import { Server as SocketServer, type ServerOptions } from "socket.io";

export class SocketManager {
  private static instance: SocketManager;
  private _io: SocketServer | null = null;

  private constructor() {}

  public static getInstance(): SocketManager {
    if (!SocketManager.instance) {
      SocketManager.instance = new SocketManager();
    }
    return SocketManager.instance;
  }

  // Initialiser Socket.IO avec le serveur HTTP (idempotent)
  public initialize(httpServer: HttpServer, socketConfig?: Partial<ServerOptions>): SocketServer {
    if (!this._io) {
      this._io = new SocketServer(httpServer, socketConfig);
      console.log("🚀 Socket.IO initialized (Singleton)");
    }
    return this._io;
  }

  public getIO(): SocketServer {
    if (!this._io) {
      throw new Error("Socket.IO not initialized! Call initialize() first.");
    }
    return this._io;
  }

  public isInitialized(): boolean {
    return this._io !== null;
  }

  // Les ids utilisateur sont des UUID (string) dans ce projet (avant : number, hérité d'un autre projet)
  public emitToUser(userId: string, event: string, data: unknown): void {
    this._io?.to(`user-${userId}`).emit(event, data);
  }

  public emitToAdmins(event: string, data: unknown): void {
    this._io?.to("admins").emit(event, data);
  }

  public async getRoomSize(room: string): Promise<number> {
    if (!this._io) return 0;
    const sockets = await this._io.in(room).fetchSockets();
    return sockets.length;
  }

  public close(): void {
    if (this._io) {
      this._io.close();
      this._io = null;
      console.log("🔌 Socket.IO closed");
    }
  }
}

export const socketManager = SocketManager.getInstance();