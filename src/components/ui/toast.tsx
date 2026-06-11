import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

export type ToastType = "success" | "error" | "info" | "warning";

export interface ToastItem {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  duration?: number;
}

interface ToastContextValue {
  toasts: ToastItem[];
  addToast: (toast: Omit<ToastItem, "id">) => void;
  removeToast: (id: string) => void;
}

const ToastContext = React.createContext<ToastContextValue | undefined>(undefined);

export function useToast() {
  const context = React.useContext(ToastContext);
  if (!context) throw new Error("useToast must be used within ToastProvider");
  return context;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<ToastItem[]>([]);

  const addToast = React.useCallback((toast: Omit<ToastItem, "id">) => {
    const id = `${Date.now()}-${Math.random()}`;
    setToasts((prev) => [...prev, { ...toast, id }]);

    const duration = toast.duration ?? 4000;
    if (duration > 0) {
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, duration);
    }
  }, []);

  const removeToast = React.useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast }}>
      {children}
      <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 w-[360px] max-w-[calc(100vw-2rem)]">
        <AnimatePresence>
          {toasts.map((toast) => (
            <Toast key={toast.id} toast={toast} onClose={() => removeToast(toast.id)} />
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

const iconMap: Record<ToastType, React.ReactNode> = {
  success: <CheckCircle size={16} className="text-[var(--green)]" />,
  error: <AlertCircle size={16} className="text-[var(--red)]" />,
  info: <Info size={16} className="text-[var(--accent)]" />,
  warning: <AlertTriangle size={16} className="text-[var(--orange)]" />,
};

const borderClasses: Record<ToastType, string> = {
  success: "border-l-[3px] border-l-[var(--green)]",
  error: "border-l-[3px] border-l-[var(--red)]",
  info: "border-l-[3px] border-l-[var(--accent)]",
  warning: "border-l-[3px] border-l-[var(--orange)]",
};

function Toast({ toast, onClose }: { toast: ToastItem; onClose: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 40, scale: 0.96 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 20, scale: 0.96 }}
      transition={{ type: "spring", stiffness: 380, damping: 30 }}
      className={cn(
        "relative flex items-start gap-3 rounded-[var(--radius-card)] bg-[var(--surface-3)] p-4",
        "shadow-[inset_0_1px_0_var(--specular),inset_0_-1px_0_var(--pressed),0_8px_32px_rgba(0,0,0,0.30)]",
        "border border-[var(--hairline)]",
        borderClasses[toast.type]
      )}
    >
      <div className="mt-0.5 shrink-0">{iconMap[toast.type]}</div>
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-medium text-[var(--fg)]">{toast.title}</p>
        {toast.message && (
          <p className="text-[12px] text-[var(--fg-dim)] mt-0.5 leading-relaxed">{toast.message}</p>
        )}
      </div>
      <button
        type="button"
        onClick={onClose}
        className="shrink-0 inline-flex h-6 w-6 items-center justify-center rounded-[var(--radius-control)] text-[var(--fg-muted)]/50 hover:text-[var(--fg)] hover:bg-[var(--surface-2)] transition-colors"
        aria-label="Dismiss"
      >
        <X size={12} />
      </button>
    </motion.div>
  );
}
