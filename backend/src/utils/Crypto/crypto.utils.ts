// src/utils/crypto.ts
// Chiffrement réversible (AES-256-GCM) pour les mots de passe de bases de données
// (on doit pouvoir les réafficher à l'utilisateur, donc pas de hash).
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";

const getKey = (): Buffer => {
    const secret = process.env.DB_SECRET_KEY;
    if (!secret) throw new Error("DB_SECRET_KEY non défini");
    return createHash("sha256").update(secret).digest();
};

export const encryptSecret = (plain: string): string => {
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", getKey(), iv);
    const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
    return [iv, cipher.getAuthTag(), enc].map((b) => b.toString("base64")).join(":");
};

export const decryptSecret = (payload: string): string => {
    const [iv, tag, enc] = payload.split(":").map((p) => Buffer.from(p, "base64")) as [Buffer, Buffer, Buffer];
    const decipher = createDecipheriv("aes-256-gcm", getKey(), iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(enc), decipher.final()]).toString("utf8");
};