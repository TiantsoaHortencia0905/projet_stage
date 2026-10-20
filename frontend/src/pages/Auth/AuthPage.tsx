import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { sendLoginCredentials } from "../../api/auth.api";
import { useAuth } from "../../components/contexts/AuthContext";
import Button from "../../components/ui/Button";
import Callout from "../../components/ui/Callout";
import Field from "../../components/ui/Field";
import PasswordInput from "../../components/ui/PasswordInput";
import { validateEmail } from "../../lib/validation";
import AuthLayout from "./AuthLayout";
import OAuthButtons from "./OAuthButtons";

const AuthScreen = () => {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<{ email?: string | null; password?: string | null }>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const nextErrors = {
      email: validateEmail(email),
      password: password ? null : "Le mot de passe est requis.",
    };
    setErrors(nextErrors);
    setServerError(null);
    if (nextErrors.email || nextErrors.password) return;

    setSubmitting(true);
    const res = await sendLoginCredentials({ email, password });
    if (res.success) {
      login(res.data);
      return;
    }
    setSubmitting(false);
    setServerError(
      res.status === 401 ? "Adresse e-mail ou mot de passe incorrect." : res.message ?? "Connexion impossible.",
    );
  };

  return (
    <AuthLayout>
      <h1 className="auth-title">Connexion</h1>
      <p className="auth-subtitle">Accédez à votre console ArchiCloud.</p>

      <form className="auth-form" onSubmit={handleSubmit} noValidate>
        {serverError && <Callout tone="danger">{serverError}</Callout>}

        <Field label="Adresse e-mail" error={errors.email}>
          <input
            className="input"
            type="email"
            autoComplete="email"
            placeholder="vous@exemple.com"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              if (errors.email) setErrors((er) => ({ ...er, email: null }));
            }}
            autoFocus
          />
        </Field>

        <Field label="Mot de passe" error={errors.password}>
          <PasswordInput
            autoComplete="current-password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              if (errors.password) setErrors((er) => ({ ...er, password: null }));
            }}
          />
        </Field>

        <Button type="submit" variant="primary" size="lg" block loading={submitting} className="auth-submit">
          Se connecter
        </Button>
      </form>

      <div className="divider">ou</div>
      <OAuthButtons />

      <p className="auth-switch">
        Pas encore de compte ? <Link to="/register">Créer un compte</Link>
      </p>
    </AuthLayout>
  );
};

export default AuthScreen;
