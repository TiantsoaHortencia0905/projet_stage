// Règles alignées sur celles du backend, pour signaler les erreurs avant l'envoi.

export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const SURNOM_REGEX = /^[a-zA-Z0-9_.-]{3,30}$/;
export const DB_NAME_REGEX = /^[a-z][a-z0-9_]{2,29}$/;
export const ENV_KEY_REGEX = /^[A-Za-z_][A-Za-z0-9_]*$/;
export const PASSWORD_MIN_LENGTH = 8;
export const NAME_MAX_LENGTH = 100;

export const validateEmail = (value: string): string | null => {
  if (!value.trim()) return "L'adresse e-mail est requise.";
  if (!EMAIL_REGEX.test(value.trim())) return "Adresse e-mail invalide.";
  return null;
};

export const validatePassword = (value: string): string | null => {
  if (!value) return "Le mot de passe est requis.";
  if (value.length < PASSWORD_MIN_LENGTH) return `Au moins ${PASSWORD_MIN_LENGTH} caractères.`;
  return null;
};

export const validateSurnom = (value: string): string | null => {
  if (!value.trim()) return "Le nom d'utilisateur est requis.";
  if (!SURNOM_REGEX.test(value.trim())) return "3 à 30 caractères : lettres, chiffres, _ . -";
  return null;
};

export const validateDbName = (value: string): string | null => {
  if (!value) return "Le nom est requis.";
  if (!DB_NAME_REGEX.test(value))
    return "3 à 30 caractères en minuscules, chiffres ou _, commençant par une lettre.";
  return null;
};

export const validateName = (value: string, label = "Le nom"): string | null => {
  const trimmed = value.trim();
  if (!trimmed) return `${label} est requis.`;
  if (trimmed.length > NAME_MAX_LENGTH) return `${NAME_MAX_LENGTH} caractères maximum.`;
  return null;
};

/** 0 à 4 : indication simple de robustesse du mot de passe. */
export const passwordStrength = (value: string): number => {
  if (!value) return 0;
  let score = 0;
  if (value.length >= PASSWORD_MIN_LENGTH) score++;
  if (value.length >= 12) score++;
  if (/[a-z]/.test(value) && /[A-Z]/.test(value)) score++;
  if (/\d/.test(value) && /[^A-Za-z0-9]/.test(value)) score++;
  return score;
};
