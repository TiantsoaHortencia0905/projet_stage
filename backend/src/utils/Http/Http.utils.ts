// src/utils/http.ts
import type { Response } from "express";

/**
 * Envoie le résultat d'un controller.
 * Utilise `result.status` s'il existe, sinon `successStatus` (succès) ou 400 (échec).
 * Le champ `status` n'est pas renvoyé dans le corps JSON.
 */
export const sendResult = <T extends { success: boolean; status?: number }>(
    res: Response,
    result: T,
    successStatus = 200,
) => {
    const { status, ...body } = result;
    return res
        .status(status ?? (result.success ? successStatus : 400))
        .json(body);
};

/** Réponse 500 générique : on log l'erreur côté serveur, sans la divulguer au client. */
export const sendServerError = (res: Response, error: unknown, context: string) => {
    console.error(`[${context}]`, error);
    if (!res.headersSent) {
        res.status(500).json({ success: false, message: "Erreur interne du serveur" });
    }
};