import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { CircleCheck, CircleX, Info, TriangleAlert, X } from 'lucide-react';

export type ToastTone = 'success' | 'error' | 'warning' | 'info';

export type ToastInput = {
  tone?: ToastTone;
  title?: string;
  message: string;
  /** Milliseconds before auto-dismiss. Errors stay longer by default. */
  duration?: number;
};

type Toast = Required<Pick<ToastInput, 'tone' | 'message'>> & {
  id: number;
  title?: string;
};

type ToastApi = {
  showToast: (toast: ToastInput) => void;
  success: (message: string, title?: string) => void;
  error: (message: string, title?: string) => void;
};

const ToastContext = createContext<ToastApi | null>(null);

const ICONS: Record<ToastTone, typeof Info> = {
  success: CircleCheck,
  error: CircleX,
  warning: TriangleAlert,
  info: Info,
};

const DEFAULT_DURATION: Record<ToastTone, number> = {
  success: 4000,
  info: 4000,
  warning: 6000,
  error: 8000,
};

export const ToastProvider = ({ children }: { children: ReactNode }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const idRef = useRef(0);
  const timersRef = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  const dismiss = useCallback((id: number) => {
    const timer = timersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timersRef.current.delete(id);
    }
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const showToast = useCallback(
    ({ tone = 'info', title, message, duration }: ToastInput) => {
      idRef.current += 1;
      const id = idRef.current;
      setToasts((current) => [...current, { id, tone, title, message }]);
      timersRef.current.set(
        id,
        setTimeout(() => dismiss(id), duration ?? DEFAULT_DURATION[tone]),
      );
    },
    [dismiss],
  );

  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      timers.forEach(clearTimeout);
      timers.clear();
    };
  }, []);

  const api = useMemo<ToastApi>(
    () => ({
      showToast,
      success: (message, title) => showToast({ tone: 'success', message, title }),
      error: (message, title) => showToast({ tone: 'error', message, title }),
    }),
    [showToast],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="ui-toast-region" role="region" aria-label="Notificações">
        {toasts.map((toast) => {
          const Icon = ICONS[toast.tone];
          return (
            <div
              key={toast.id}
              className={`ui-toast ui-toast--${toast.tone}`}
              role={toast.tone === 'error' ? 'alert' : 'status'}
              aria-live={toast.tone === 'error' ? 'assertive' : 'polite'}
            >
              <Icon className="ui-toast__icon" size={18} strokeWidth={1.9} aria-hidden="true" />
              <div className="ui-toast__content">
                {toast.title && <strong className="ui-toast__title">{toast.title}</strong>}
                {toast.message}
              </div>
              <button
                type="button"
                className="ui-toast__close"
                onClick={() => dismiss(toast.id)}
                aria-label="Dispensar notificação"
              >
                <X size={14} strokeWidth={2} aria-hidden="true" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = (): ToastApi => {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast precisa estar dentro de <ToastProvider>.');
  return context;
};
