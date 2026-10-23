import React from 'react';
import { AlertCircle, CheckCircle2, Info, TriangleAlert, X } from 'lucide-react';
import { useApp } from '../state/store';

const ICONS = {
  success: <CheckCircle2 size={15} />,
  error: <AlertCircle size={15} />,
  warning: <TriangleAlert size={15} />,
  info: <Info size={15} />,
};

export function Toasts(): React.ReactElement | null {
  const app = useApp();
  if (app.toasts.length === 0) return null;
  return (
    <div className="toasts" role="region" aria-label="Notifications" aria-live="polite">
      {app.toasts.map((toast) => (
        <div key={toast.id} className={`toast toast--${toast.kind}`} role="status">
          <span className="toast__icon">{ICONS[toast.kind]}</span>
          <span className="toast__message">{toast.message}</span>
          <button type="button" className="toast__close" aria-label="Dismiss notification" onClick={() => app.dismissToast(toast.id)}>
            <X size={12} />
          </button>
        </div>
      ))}
    </div>
  );
}
