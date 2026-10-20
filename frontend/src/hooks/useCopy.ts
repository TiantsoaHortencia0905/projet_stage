import { useEffect, useState } from "react";
import { useToast } from "../redux/hooks/useToast";

/** Copie dans le presse-papiers avec un état « copié » temporaire. */
export const useCopy = () => {
  const toast = useToast();
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 1600);
    return () => clearTimeout(t);
  }, [copied]);

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch {
      toast.error("Copie impossible", "Votre navigateur a bloqué l'accès au presse-papiers.");
    }
  };

  return { copied, copy };
};
