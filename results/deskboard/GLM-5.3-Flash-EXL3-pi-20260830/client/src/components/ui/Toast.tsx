/**
 * Toast — success/error notifications with auto-dismiss and an aria-live
 * region. Use `useToast()` for imperative `showToast({ kind, message })`.
 */
import { createContext, useCallback, useContext, useRef, useState } from 'react';

export interface ToastMessage {
  id: number;
  kind: 'success' | 'error';
  message: string;
}

interface ToastContextValue {
  showToast: (kind: ToastMessage['kind'], message: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const AUTO_DISMISS_MS = 4000;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const nextId = useRef(1);

  const showToast = useCallback((kind: ToastMessage['kind'], message: string) => {
    const id = nextId.current++;
    setToasts((prev) => [...prev, { id, kind, message }]);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, AUTO_DISMISS_MS);
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="toast-region" aria-live="polite" aria-atomic="false">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast--${t.kind}`} role="status">
            <span aria-hidden="true">{t.kind === 'success' ? '✓' : '⚠'}</span>
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = (): ToastContextValue => {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
};
