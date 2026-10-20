import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { LuCircleCheck } from "react-icons/lu";
import { sendLoginCredentials, sendSignupCredentials, verifyUserName } from "../../api/auth.api";
import { useAuth } from "../../components/contexts/AuthContext";
import Button from "../../components/ui/Button";
import Callout from "../../components/ui/Callout";
import Field from "../../components/ui/Field";
import PasswordInput from "../../components/ui/PasswordInput";
import { useToast } from "../../redux/hooks/useToast";
import { passwordStrength, validateEmail, validateName, validatePassword, validateSurnom } from "../../lib/validation";
import AuthLayout from "./AuthLayout";
import OAuthButtons from "./OAuthButtons";

type FieldName = "nom" | "surnom" | "email" | "password" | "confirm";
type Availability = "idle" | "checking" | "available" | "taken";

const STRENGTH_LABELS = ["", "Faible", "Moyen", "Bon", "Excellent"];

const RegisterPage = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();

  const [values, setValues] = useState({ nom: "", surnom: "", email: "", password: "", confirm: "" });
  const [errors, setErrors] = useState<Partial<Record<FieldName, string | null>>>({});
  const [check, setCheck] = useState<{ surnom: string; result: Availability } | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const set = (name: FieldName) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setValues((v) => ({ ...v, [name]: e.target.value }));
    if (errors[name]) setErrors((er) => ({ ...er, [name]: null }));
  };

  // Disponibilité du nom d'utilisateur (vérifiée après une courte pause de saisie)
  const surnom = values.surnom.trim();
  const surnomFormatOk = !validateSurnom(surnom);
  const availability: Availability = !surnomFormatOk ? "idle" : check?.surnom === surnom ? check.result : "checking";

  useEffect(() => {
    if (!surnomFormatOk) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      const res = await verifyUserName(surnom);
      if (cancelled) return;
      // 409 = déjà pris ; toute autre erreur (réseau…) laisse la vérification finale au serveur
      setCheck({ surnom, result: res.success ? "available" : res.status === 409 ? "taken" : "idle" });
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [surnom, surnomFormatOk]);

  const validate = () => {
    const next: Partial<Record<FieldName, string | null>> = {
      nom: validateName(values.nom, "Le nom"),
      surnom: validateSurnom(values.surnom) ?? (availability === "taken" ? "Ce nom d'utilisateur est déjà pris." : null),
      email: validateEmail(values.email),
      password: validatePassword(values.password),
      confirm: !values.confirm
        ? "Confirmez le mot de passe."
        : values.confirm !== values.password
          ? "Les mots de passe ne correspondent pas."
          : null,
    };
    setErrors(next);
    return !Object.values(next).some(Boolean);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setServerError(null);
    if (!validate()) return;

    setSubmitting(true);
    const res = await sendSignupCredentials({
      nomUtilisateur: values.nom,
      surnomUtilisateur: values.surnom,
      mailUtilisateur: values.email,
      mdpUtilisateur: values.password,
    });

    if (!res.success) {
      setSubmitting(false);
      const message = res.message ?? "Inscription impossible.";
      // Rattache l'erreur au bon champ quand c'est possible
      if (/surnom/i.test(message)) setErrors((er) => ({ ...er, surnom: message }));
      else if (/e-?mail/i.test(message)) setErrors((er) => ({ ...er, email: message }));
      else setServerError(message);
      return;
    }

    // Le compte existe : on ouvre directement la session
    const session = await sendLoginCredentials({ email: values.email, password: values.password });
    if (session.success) {
      toast.success("Bienvenue sur ArchiCloud", "Votre compte a été créé.");
      login(session.data);
    } else {
      toast.success("Compte créé", "Connectez-vous pour continuer.");
      navigate("/login", { replace: true });
    }
  };

  const strength = passwordStrength(values.password);

  return (
    <AuthLayout>
      <h1 className="auth-title">Créer un compte</h1>
      <p className="auth-subtitle">Quelques secondes suffisent pour démarrer.</p>

      <form className="auth-form" onSubmit={handleSubmit} noValidate>
        {serverError && <Callout tone="danger">{serverError}</Callout>}

        <Field label="Nom complet" error={errors.nom}>
          <input
            className="input"
            autoComplete="name"
            placeholder="Jeanne Rakoto"
            value={values.nom}
            onChange={set("nom")}
            maxLength={100}
            autoFocus
          />
        </Field>

        <Field
          label="Nom d'utilisateur"
          error={errors.surnom ?? (availability === "taken" ? "Ce nom d'utilisateur est déjà pris." : null)}
          success={
            availability === "available" ? (
              <>
                <LuCircleCheck size={13} aria-hidden /> Disponible
              </>
            ) : null
          }
          hint={availability === "checking" ? "Vérification…" : "3 à 30 caractères : lettres, chiffres, _ . -"}
        >
          <input
            className="input"
            autoComplete="username"
            placeholder="jeanne.r"
            value={values.surnom}
            onChange={set("surnom")}
            maxLength={30}
          />
        </Field>

        <Field label="Adresse e-mail" error={errors.email}>
          <input
            className="input"
            type="email"
            autoComplete="email"
            placeholder="vous@exemple.com"
            value={values.email}
            onChange={set("email")}
          />
        </Field>

        <Field
          label="Mot de passe"
          error={errors.password}
          hint="8 caractères minimum."
          labelAside={values.password ? <span className="field-hint">{STRENGTH_LABELS[strength]}</span> : null}
        >
          <PasswordInput autoComplete="new-password" value={values.password} onChange={set("password")} />
        </Field>
        {values.password && (
          <div className="strength" data-score={strength} aria-hidden>
            <span />
            <span />
            <span />
            <span />
          </div>
        )}

        <Field label="Confirmer le mot de passe" error={errors.confirm}>
          <PasswordInput autoComplete="new-password" value={values.confirm} onChange={set("confirm")} />
        </Field>

        <Button type="submit" variant="primary" size="lg" block loading={submitting} className="auth-submit">
          Créer mon compte
        </Button>
      </form>

      <div className="divider">ou</div>
      <OAuthButtons />

      <p className="auth-switch">
        Déjà un compte ? <Link to="/login">Se connecter</Link>
      </p>
    </AuthLayout>
  );
};

export default RegisterPage;
