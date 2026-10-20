export interface LoginPayload {
    email: string;
    password: string;
}

export interface UserProfile {
    id: string;
    nom: string;
    surnom: string;
    email: string;
    type: string;
}

export interface LoginResponse {
    success: boolean;
    data?: {
        token: string;
        user: UserProfile;
    };
    message?: string;
    /** Code HTTP suggéré par le controller (retiré avant l'envoi au client). */
    status?: number;
}

export interface RequestResponse<T> {
    data?: T;
    message?: string;
    success: boolean;
    /** Code HTTP suggéré par le controller (retiré avant l'envoi au client). */
    status?: number;
}