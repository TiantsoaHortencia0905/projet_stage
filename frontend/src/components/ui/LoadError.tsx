import { LuRefreshCw } from "react-icons/lu";
import Button from "./Button";
import Callout from "./Callout";

/** Erreur de chargement avec bouton « Réessayer ». */
const LoadError = ({ message, onRetry, retrying }: { message: string; onRetry: () => void; retrying?: boolean }) => (
  <Callout
    tone="danger"
    title="Chargement impossible"
    action={
      <Button size="sm" variant="secondary" onClick={onRetry} loading={retrying} icon={<LuRefreshCw size={14} />}>
        Réessayer
      </Button>
    }
  >
    {message}
  </Callout>
);

export default LoadError;
