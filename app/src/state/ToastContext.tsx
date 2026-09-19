import { createContext, useContext, useState, useRef, ReactNode } from 'react';

type Toast = {
  message: string;
  type: 'success' | 'error' | 'info';
};

type ToastState = {
  toast: Toast | null;
  showToast: (message: string, type?: Toast['type']) => void;
  hideToast: () => void;
};

const ToastContext = createContext<ToastState | undefined>(undefined);

type ToastProviderProps = { children: ReactNode };

export function ToastProvider({ children }: ToastProviderProps) {
  const [toast, setToast] = useState<Toast | null>(null);
  // A ref, not state — changing it should never trigger a re-render, it's
  // just a handle so a later call can cancel a timer an earlier call left
  // running.
  const dismissTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function showToast(message: string, type: Toast['type'] = 'info') {
    if (dismissTimer.current) clearTimeout(dismissTimer.current);
    setToast({ message, type });
    dismissTimer.current = setTimeout(() => setToast(null), 3000);
  }

  function hideToast() {
    if (dismissTimer.current) clearTimeout(dismissTimer.current);
    setToast(null);
  }

  const value: ToastState = { toast, showToast, hideToast };

  return <ToastContext.Provider value={value}>{children}</ToastContext.Provider>;
}

export function useToast() {
  const context = useContext(ToastContext);
  if (context === undefined) {
    throw new Error('useToast must be used inside a ToastProvider');
  }
  return context;
}
