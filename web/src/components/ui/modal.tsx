"use client";

import * as React from "react";
import { X, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

/** Pilha de modais abertos: só o do topo reage ao Esc (modal dentro de modal). */
const pilha: symbol[] = [];

export function Modal({
  open,
  ...rest
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  // O conteúdo só existe aberto: cada abertura começa limpa (sem aviso pendente).
  if (!open) return null;
  return <ModalAberto {...rest} />;
}

function ModalAberto({
  onClose,
  title,
  children,
  className,
}: {
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  const boxRef = React.useRef<HTMLDivElement>(null);
  const idRef = React.useRef<symbol>(Symbol("modal"));
  // Alterou algum campo? Então fechar pelo fundo/Esc pede confirmação.
  const [sujo, setSujo] = React.useState(false);
  const [avisar, setAvisar] = React.useState(false);

  const tentarFechar = React.useCallback(() => {
    if (sujo && !avisar) {
      setAvisar(true);
      return;
    }
    onClose();
  }, [sujo, avisar, onClose]);

  React.useEffect(() => {
    const id = idRef.current;
    pilha.push(id);
    return () => {
      const i = pilha.lastIndexOf(id);
      if (i >= 0) pilha.splice(i, 1);
    };
  }, []);

  React.useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (pilha[pilha.length - 1] !== idRef.current) return;
      if (e.key === "Escape") {
        e.preventDefault();
        tentarFechar();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [tentarFechar]);

  // Trava a rolagem da página atrás do modal.
  React.useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  // Foco no primeiro campo (só com mouse/teclado: no celular não abre o teclado sozinho).
  React.useEffect(() => {
    if (!window.matchMedia?.("(pointer: fine)").matches) return;
    const el = boxRef.current?.querySelector<HTMLElement>(
      "input:not([type=hidden]):not([type=file]):not([disabled]):not([readonly]), select:not([disabled]), textarea:not([disabled])",
    );
    el?.focus({ preventScroll: true });
  }, []);

  // Ctrl/⌘ + Enter salva o formulário do modal.
  function onKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      const form = (e.target as HTMLElement).closest("form") ?? boxRef.current?.querySelector("form");
      if (form) {
        e.preventDefault();
        form.requestSubmit();
      }
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/40 backdrop-blur-sm animate-fade"
      onMouseDown={tentarFechar}
    >
      <div
        ref={boxRef}
        className={cn(
          "w-full max-w-lg border border-border bg-surface shadow-lg animate-in",
          "rounded-t-2xl sm:rounded-xl max-h-[92dvh] sm:max-h-[90vh] overflow-y-auto overscroll-contain",
          className,
        )}
        onMouseDown={(e) => e.stopPropagation()}
        onInput={() => !sujo && setSujo(true)}
        onKeyDown={onKeyDown}
      >
        <div className="sticky top-0 z-10 bg-surface border-b border-border">
          <div className="flex items-center justify-between gap-3 px-5 py-3.5">
            <h2 className="text-base font-semibold truncate">{title}</h2>
            <button
              type="button"
              onClick={onClose}
              className="-mr-1.5 p-1.5 rounded-md text-muted hover:text-foreground hover:bg-surface-2 transition-colors cursor-pointer"
              aria-label="Fechar"
            >
              <X size={18} />
            </button>
          </div>
          {avisar && (
            <div className="flex flex-wrap items-center gap-2 px-5 py-2 text-xs bg-yellow-soft text-yellow border-t border-border animate-fade">
              <AlertTriangle size={14} className="shrink-0" />
              <span className="flex-1">Há alterações não salvas.</span>
              <button type="button" onClick={() => setAvisar(false)} className="font-semibold underline-offset-2 hover:underline cursor-pointer">
                Continuar editando
              </button>
              <button type="button" onClick={onClose} className="font-semibold underline-offset-2 hover:underline cursor-pointer">
                Descartar
              </button>
            </div>
          )}
        </div>
        {children}
      </div>
    </div>
  );
}

export function ModalBody({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("p-5 space-y-4", className)} {...props} />;
}

export function ModalFooter({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "flex flex-col gap-2 px-5 py-3.5 border-t border-border sticky bottom-0 bg-surface",
        "sm:flex-row sm:flex-wrap sm:items-center sm:justify-end [&>button]:w-full sm:[&>button]:w-auto",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

/** Dica de atalho para o rodapé dos formulários. */
export function AtalhoSalvar() {
  return (
    <span className="hidden sm:inline mr-auto text-[11px] text-muted">
      <kbd className="border border-border rounded px-1">Ctrl</kbd> + <kbd className="border border-border rounded px-1">Enter</kbd> salva
    </span>
  );
}
