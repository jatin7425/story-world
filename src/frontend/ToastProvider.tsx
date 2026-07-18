import { useEffect, useState } from "react";
import { subscribeToast, type ToastEvent } from "./toastBus";

const AUTO_DISMISS_MS = 6000;

export default function ToastProvider() {
  const [toasts, setToasts] = useState<ToastEvent[]>([]);

  useEffect(() => {
    return subscribeToast((toast) => {
      setToasts((cur) => [...cur, toast]);
      setTimeout(() => {
        setToasts((cur) => cur.filter((t) => t.id !== toast.id));
      }, AUTO_DISMISS_MS);
    });
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div className="toast-stack" role="region" aria-label="Notifications">
      {toasts.map((t) => (
        <div key={t.id} className={`toast toast-${t.variant}`} role="alert">
          <span>{t.message}</span>
          <button
            type="button"
            className="toast-close"
            aria-label="Dismiss"
            onClick={() => setToasts((cur) => cur.filter((x) => x.id !== t.id))}
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}
