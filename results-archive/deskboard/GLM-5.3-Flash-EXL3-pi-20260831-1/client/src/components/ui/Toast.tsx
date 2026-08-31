import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';

type ToastKind = 'success' | 'error';
interface ToastItem {
  id: number;
  message: string;
  kind: ToastKind;
}

interface ToastContextValue {
  push: (message: string, kind?: ToastKind) => void;
}

const ToastContext = createContext<ToastContextValue>({ push: () => undefined });

const TOAST_TTL_MS = 4000;

/**
 * Toast stack in an aria-live region (spec §7.4/§7.5): success + error kinds,
 * auto-dismiss after 4s, status paired with text — never color alone.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const counter = useRef(0);

  const push = useCallback((message: string, kind: ToastKind = 'success') => {
    const id = ++counter.current;
    setItems((prev) => [...prev, { id, message, kind }]);
    window.setTimeout(() => {
      setItems((prev) => prev.filter((t) => t.id !== id));
    }, TOAST_TTL_MS);
  }, []);

  return (
    <ToastContext.Provider value={{ push }}>
      {children}
      <div className="toasts" aria-live="polite">
        {items.map((t) => (
          <div key={t.id} className={`toast toast--${t.kind}`} data-testid="toast">
            <span aria-hidden="true">{t.kind === 'success' ? '✔' : '✖'}</span> {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

/** Push a toast from anywhere under <ToastProvider>. */
export function useToast(): ToastContextValue {
  return useContext(ToastContext);
}
