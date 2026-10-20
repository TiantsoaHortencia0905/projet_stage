import { useMemo } from "react";
import { pushToast, type ToastTone } from "../slices/toastSlice";
import { useAppDispatch } from "../store";

/** Notifications éphémères : `toast.success("Espace créé")`, `toast.error("Échec", message)`. */
export const useToast = () => {
  const dispatch = useAppDispatch();

  return useMemo(() => {
    const show = (tone: ToastTone) => (title: string, description?: string) =>
      dispatch(pushToast({ tone, title, description }));
    return {
      success: show("success"),
      error: show("error"),
      warning: show("warning"),
      info: show("info"),
    };
  }, [dispatch]);
};
