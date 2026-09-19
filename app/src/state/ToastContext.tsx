import { createContext, useContext, useState, ReactNode } from 'react';

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

  function showToast(message: string, type: Toast['type'] = 'info') {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  }

  function hideToast() {
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
