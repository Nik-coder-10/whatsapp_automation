"use client";

import { createContext, useCallback, useContext, useRef, useState } from "react";
import type { ReactNode } from "react";

type ToastTone = "info" | "success" | "error";

interface ToastItem {
  id: number;
  tone: ToastTone;
  message: string;
}

const ToastContext = createContext<{ notify: (message: string, tone?: ToastTone) => void }>({
  notify: () => {},
});

export const useToast = () => useContext(ToastContext);

const tones: Record<ToastTone, string> = {
  info: "border-brand-700 bg-brand-900",
  success: "border-green-700 bg-green-900",
  error: "border-red-700 bg-red-900",
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const idRef = useRef(0);

  const notify = useCallback((message: string, tone: ToastTone = "info") => {
    const id = ++idRef.current;
    setToasts((prev) => [...prev.slice(-2), { id, tone, message }]);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  return (
    <ToastContext.Provider value={{ notify }}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-4 z-[60] flex flex-col items-center gap-2 px-4"
      >
        {toasts.map((t) => (
          <p
            key={t.id}
            role="status"
            className={`pointer-events-auto max-w-md rounded-md border-l-4 px-4 py-2.5 text-sm font-medium text-white shadow-lg ${tones[t.tone]}`}
          >
            {t.message}
          </p>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
