import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import prisma from "../config/prisma.config.ts";

export interface AuthenticatedUser {
    userId: string;
    email: string;
    nom: string;
    surnom: string;
    type: string;
    token: string;
}

declare global {
    namespace Express {
        interface Request {
            currentUser?: AuthenticatedUser;
        }
    }
}

/** Erreur d'authentification "attendue" => réponse 401. */
export class AuthError extends Error {}

const getSecret = (): string => {
    const secret = process.env.JWT_PASSWORD_ENCRYPTOR_KEY;
    if (!secret) throw new Error("JWT_PASSWORD_ENCRYPTOR_KEY non défini");
    return secret;
};

/**
 * Vérifie un JWT (signature, expiration, blacklist, utilisateur existant).
 * Réutilisée par le middleware HTTP et par Socket.IO.
 * Lance jwt.TokenExpiredError / jwt.JsonWebTokenError / AuthError.
 */
export const verifyAccessToken = async (
    token: string,
): Promise<AuthenticatedUser & { exp?: number }> => {
    // 1. Signature + expiration (peu coûteux, avant tout accès DB)
    const decoded = jwt.verify(token, getSecret(), { algorithms: ["HS256"] });
    if (typeof decoded === "string" || typeof decoded.userId !== "string") {
        throw new AuthError("Token invalide");
    }

    // 2. Token révoqué (logout)
    const revoked = await prisma.blackListedTokens.findFirst({
        where: { token },
        select: { id: true },
    });
    if (revoked) throw new AuthError("Token expiré ou session arrêtée.");

    // 3. L'utilisateur existe toujours
    const user = await prisma.utilisateur.findUnique({
        where: { idUtilisateur: decoded.userId },
        select: {
            idUtilisateur: true,
            mailUtilisateur: true,
            nomUtilisateur: true,
            surnomUtilisateur: true,
            typeUtilisateur: true,
        },
    });
    if (!user) throw new AuthError("Utilisateur introuvable ou supprimé");

    return {
        userId: user.idUtilisateur,
        email: user.mailUtilisateur,
        nom: user.nomUtilisateur,
        surnom: user.surnomUtilisateur,
        type: user.typeUtilisateur,
        token,
        exp: decoded.exp!,
    };
};

export const authMiddleware = async (
    req: Request,
    res: Response,
    next: NextFunction,
): Promise<void> => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader?.startsWith("Bearer ")) {
            res.status(401).json({ success: false, message: "Token manquant ou invalide" });
            return;
        }

        const token = authHeader.slice("Bearer ".length).trim();
        if (!token) {
            res.status(401).json({ success: false, message: "Token manquant" });
            return;
        }

        const { exp, ...currentUser } = await verifyAccessToken(token);
        req.currentUser = currentUser;
        next();
    } catch (error: any) {
        if (error?.name === "TokenExpiredError") {
            res.status(401).json({ success: false, message: "Token expiré. Veuillez vous reconnecter." });
        } else if (error instanceof AuthError) {
            res.status(401).json({ success: false, message: error.message });
        } else if (error?.name === "JsonWebTokenError") {
            res.status(401).json({ success: false, message: "Token invalide" });
        } else {
            console.error("Erreur AuthMiddleware:", error);
            res.status(500).json({ success: false, message: "Erreur d'authentification" });
        }
    }
};

/**
 * Autorise uniquement le propriétaire (req.params[paramName] === userId du token)
 * ou un ADMIN. À placer APRÈS authMiddleware.
 */
export const ensureSelfOrAdmin =
    (paramName = "idUser") =>
    (req: Request, res: Response, next: NextFunction): void => {
        const user = req.currentUser;
        if (!user) {
            res.status(401).json({ success: false, message: "Non authentifié" });
            return;
        }
        if (req.params[paramName] !== user.userId && user.type !== "ADMIN") {
            res.status(403).json({ success: false, message: "Accès refusé à cette ressource" });
            return;
        }
        next();
    };