// src/config/prisma.ts
// Une seule instance PrismaClient pour toute l'application
// (avant : 1 instance par fichier => pool de connexions multiplié).
import { PrismaClient } from "../generated/prisma/index.js";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
    globalForPrisma.prisma = prisma; // évite les doublons avec le hot-reload
}

export default prisma;