import { createContext, ReactNode, useCallback, useContext, useRef, useState } from 'react';

export type ToastVariant = 'success' | 'error';

interface ToastItem {
  id: number;
  message: string;
  variant: ToastVariant;
}

type ShowToast = (message: string, variant?: ToastVariant) => void;

const ToastContext = createContext<ShowToast>(() => undefined);

const AUTO_DISMISS_MS = 4000;

/** Global toast feedback with an aria-live region and auto-dismiss. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(0);

  const show = useCallback<ShowToast>((message, variant = 'success') => {
    const id = ++nextId.current;
    setToasts((current) => [...current, { id, message, variant }]);
    setTimeout(() => {
      setToasts((current) => current.filter((toast) => toast.id !== id));
    }, AUTO_DISMISS_MS);
  }, []);

  const icon = (variant: ToastVariant) => (variant === 'success' ? '✓' : '⚠');

  return (
    <ToastContext.Provider value={show}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {toasts.map((toast) => (
          <div key={toast.id} className={`toast toast-${toast.variant}`}>
            <span className="toast-icon" aria-hidden="true">
              {icon(toast.variant)}
            </span>
            <span className="toast-message">{toast.message}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

/** Show a toast: `showToast('Booking created')` or `showToast(msg, 'error')`. */
export function useToast(): ShowToast {
  return useContext(ToastContext);
}
