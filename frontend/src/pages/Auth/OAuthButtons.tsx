import { useState } from "react";
import githubLogo from "../../assets/github.png";
import googleLogo from "../../assets/google.png";
import { getOAuthUrl, type OAuthProvider } from "../../api/auth.api";
import Button from "../../components/ui/Button";
import { useToast } from "../../redux/hooks/useToast";

/** Connexion via GitHub / Google : redirige vers le fournisseur, ou explique pourquoi c'est impossible. */
const OAuthButtons = () => {
  const toast = useToast();
  const [pending, setPending] = useState<OAuthProvider | null>(null);

  const start = async (provider: OAuthProvider) => {
    setPending(provider);
    const res = await getOAuthUrl(provider);
    if (res.success) {
      window.location.assign(res.data.url);
      return; // la page change : on garde l'indicateur de chargement
    }
    toast.error(
      `Connexion ${provider === "github" ? "GitHub" : "Google"} indisponible`,
      res.message ?? "Réessayez plus tard.",
    );
    setPending(null);
  };

  return (
    <div className="oauth-buttons">
      <Button
        variant="secondary"
        onClick={() => start("github")}
        loading={pending === "github"}
        disabled={pending !== null}
        icon={<img src={githubLogo} alt="" className="oauth-logo" width={18} height={18} />}
      >
        GitHub
      </Button>
      <Button
        variant="secondary"
        onClick={() => start("google")}
        loading={pending === "google"}
        disabled={pending !== null}
        icon={<img src={googleLogo} alt="" className="oauth-logo" width={18} height={18} />}
      >
        Google
      </Button>
    </div>
  );
};

export default OAuthButtons;
