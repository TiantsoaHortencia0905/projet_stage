import { useEffect, useRef, useState } from "react";
import { LuCircleAlert, LuCircleCheck, LuInfo, LuTriangleAlert, LuX } from "react-icons/lu";
import { dismissToast, type Toast } from "../../redux/slices/toastSlice";
import { useAppDispatch, useAppSelector } from "../../redux/store";
import Button from "./Button";

const ICONS = {
  success: <LuCircleCheck size={18} />,
  error: <LuCircleAlert size={18} />,
  warning: <LuTriangleAlert size={18} />,
  info: <LuInfo size={18} />,
};

const DURATION = { success: 4000, info: 5000, warning: 7000, error: 8000 };

const ToastItem = ({ toast }: { toast: Toast }) => {
  const dispatch = useAppDispatch();
  const [paused, setPaused] = useState(false);
  const remaining = useRef(DURATION[toast.tone]);

  useEffect(() => {
    if (paused) return;
    const start = Date.now();
    const timer = setTimeout(() => dispatch(dismissToast(toast.id)), remaining.current);
    return () => {
      clearTimeout(timer);
      remaining.current -= Date.now() - start;
    };
  }, [paused, dispatch, toast.id]);

  return (
    <div
      className={`toast toast-${toast.tone}`}
      role={toast.tone === "error" ? "alert" : "status"}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <span className="toast-icon">{ICONS[toast.tone]}</span>
      <div className="toast-content">
        <p className="toast-title">{toast.title}</p>
        {toast.description && <p className="toast-description">{toast.description}</p>}
      </div>
      <Button
        variant="ghost"
        size="sm"
        iconOnly
        className="toast-close"
        aria-label="Fermer la notification"
        onClick={() => dispatch(dismissToast(toast.id))}
        icon={<LuX size={14} />}
      />
    </div>
  );
};

const Toaster = () => {
  const toasts = useAppSelector((state) => state.toasts);
  return (
    <div className="toaster" aria-live="polite">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} />
      ))}
    </div>
  );
};

export default Toaster;
