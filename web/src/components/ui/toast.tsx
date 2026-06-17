"use client";

import * as React from "react";
import { CheckCircle2, AlertCircle, X } from "lucide-react";
import { cn } from "@/lib/utils";

type Toast = { id: number; msg: string; type: "success" | "error" };

const ToastCtx = React.createContext<(msg: string, type?: "success" | "error") => void>(
  () => {},
);

export function useToast() {
  return React.useContext(ToastCtx);
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<Toast[]>([]);

  const push = React.useCallback(
    (msg: string, type: "success" | "error" = "success") => {
      const id = Date.now() + Math.random();
      setToasts((t) => [...t, { id, msg, type }]);
      setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3500);
    },
    [],
  );

  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="fixed bottom-5 right-5 z-[100] flex flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={cn(
              "flex items-center gap-2.5 rounded-lg border bg-surface px-4 py-3 shadow-lg animate-in min-w-[260px] max-w-sm",
              t.type === "error" ? "border-l-4 border-l-red" : "border-l-4 border-l-green",
            )}
          >
            {t.type === "error" ? (
              <AlertCircle size={18} className="text-red shrink-0" />
            ) : (
              <CheckCircle2 size={18} className="text-green shrink-0" />
            )}
            <span className="text-sm flex-1">{t.msg}</span>
            <button
              onClick={() => setToasts((x) => x.filter((y) => y.id !== t.id))}
              className="text-muted hover:text-foreground cursor-pointer"
            >
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}
