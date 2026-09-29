import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import { CheckCircle2, AlertCircle, Info, Undo2, X } from 'lucide-react';

export interface ToastOptions {
  id?: string;
  type?: 'success' | 'error' | 'info';
  message: string;
  duration?: number; // ms, default 4000 (or 7000 if undo is present)
  onUndo?: () => void;
  undoLabel?: string;
}

interface ToastContextType {
  showToast: (options: ToastOptions) => void;
  hideToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<(ToastOptions & { id: string; createdAt: number })[]>([]);
  const timers = useRef<Record<string, NodeJS.Timeout>>({});

  const hideToast = useCallback((id: string) => {
    if (timers.current[id]) {
      clearTimeout(timers.current[id]);
      delete timers.current[id];
    }
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const showToast = useCallback(
    ({ message, type = 'success', duration, onUndo, undoLabel = 'Undo' }: ToastOptions) => {
      const id = Math.random().toString(36).substring(2, 9);
      const effectiveDuration = duration || (onUndo ? 7000 : 4000);

      setToasts(prev => [...prev, { id, message, type, duration: effectiveDuration, onUndo, undoLabel, createdAt: Date.now() }]);

      timers.current[id] = setTimeout(() => {
        hideToast(id);
      }, effectiveDuration);
    },
    [hideToast]
  );

  return (
    <ToastContext.Provider value={{ showToast, hideToast }}>
      {children}
      <div className="fixed bottom-20 md:bottom-6 right-4 z-50 flex flex-col gap-2 max-w-md w-full pointer-events-none px-4 md:px-0">
        {toasts.map(toast => {
          const isError = toast.type === 'error';
          const isInfo = toast.type === 'info';
          return (
            <div
              key={toast.id}
              className={`pointer-events-auto flex items-center justify-between gap-3 p-4 rounded-xl shadow-xl border backdrop-blur-md transition-all duration-300 transform translate-y-0 ${
                isError
                  ? 'bg-rose-950/90 text-rose-100 border-rose-800'
                  : isInfo
                  ? 'bg-sky-950/90 text-sky-100 border-sky-800'
                  : 'bg-emerald-950/90 text-emerald-100 border-emerald-800'
              }`}
            >
              <div className="flex items-center gap-3">
                {isError ? (
                  <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
                ) : isInfo ? (
                  <Info className="w-5 h-5 text-sky-400 shrink-0" />
                ) : (
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                )}
                <span className="text-sm font-medium">{toast.message}</span>
              </div>

              <div className="flex items-center gap-2">
                {toast.onUndo && (
                  <button
                    onClick={() => {
                      toast.onUndo?.();
                      hideToast(toast.id);
                    }}
                    className="flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-lg bg-white/20 hover:bg-white/30 text-white transition-colors"
                  >
                    <Undo2 className="w-3.5 h-3.5" />
                    {toast.undoLabel}
                  </button>
                )}
                <button
                  onClick={() => hideToast(toast.id)}
                  className="p-1 rounded-lg hover:bg-white/10 text-white/70 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used within ToastProvider');
  return context;
}
