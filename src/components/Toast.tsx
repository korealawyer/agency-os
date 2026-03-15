"use client";

import { createContext, useContext, useState, useCallback, useEffect } from "react";
import { CheckCircle2, AlertTriangle, XCircle, Info, X } from "lucide-react";

type ToastType = "success" | "error" | "warning" | "info";

interface Toast {
  id: number;
  type: ToastType;
  title: string;
  message?: string;
}

interface ToastContextType {
  addToast: (type: ToastType, title: string, message?: string) => void;
}

const ToastContext = createContext<ToastContextType>({ addToast: () => {} });

export function useToast() {
  return useContext(ToastContext);
}

let toastId = 0;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((type: ToastType, title: string, message?: string) => {
    const id = ++toastId;
    setToasts((prev) => [...prev, { id, type, title, message }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3500);
  }, []);

  const removeToast = (id: number) => setToasts((prev) => prev.filter((t) => t.id !== id));

  const iconMap = {
    success: <CheckCircle2 size={18} />,
    error: <XCircle size={18} />,
    warning: <AlertTriangle size={18} />,
    info: <Info size={18} />,
  };

  const colorMap = {
    success: { bg: "#ECFDF5", border: "#6EE7B7", color: "#065F46" },
    error: { bg: "#FEF2F2", border: "#FCA5A5", color: "#991B1B" },
    warning: { bg: "#FFFBEB", border: "#FCD34D", color: "#92400E" },
    info: { bg: "#EFF6FF", border: "#93C5FD", color: "#1E40AF" },
  };

  return (
    <ToastContext.Provider value={{ addToast }}>
      {children}
      <div style={{
        position: "fixed", bottom: 24, right: 24, zIndex: 9999,
        display: "flex", flexDirection: "column", gap: 8, pointerEvents: "none",
      }}>
        {toasts.map((toast) => {
          const c = colorMap[toast.type];
          return (
            <div
              key={toast.id}
              style={{
                pointerEvents: "auto",
                display: "flex", alignItems: "flex-start", gap: 10,
                padding: "12px 16px", borderRadius: 12,
                background: c.bg, border: `1px solid ${c.border}`, color: c.color,
                boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
                minWidth: 300, maxWidth: 420,
                animation: "toastSlideIn 0.3s ease",
              }}
            >
              <div style={{ flexShrink: 0, marginTop: 1 }}>{iconMap[toast.type]}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: "0.857rem" }}>{toast.title}</div>
                {toast.message && (
                  <div style={{ fontSize: "0.786rem", marginTop: 2, opacity: 0.85 }}>{toast.message}</div>
                )}
              </div>
              <button
                onClick={() => removeToast(toast.id)}
                style={{ background: "none", border: "none", cursor: "pointer", color: c.color, opacity: 0.6, padding: 0 }}
              >
                <X size={14} />
              </button>
            </div>
          );
        })}
      </div>
      <style>{`
        @keyframes toastSlideIn {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
      `}</style>
    </ToastContext.Provider>
  );
}
