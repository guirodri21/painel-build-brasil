"use client";

import * as React from "react";
import { Download, X } from "lucide-react";

type BIPEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

export function PwaRegister() {
  const [prompt, setPrompt] = React.useState<BIPEvent | null>(null);
  const [hidden, setHidden] = React.useState(false);

  React.useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      setPrompt(e as BIPEvent);
    };
    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", () => setPrompt(null));
    return () => window.removeEventListener("beforeinstallprompt", onBeforeInstall);
  }, []);

  async function instalar() {
    if (!prompt) return;
    await prompt.prompt();
    await prompt.userChoice;
    setPrompt(null);
  }

  if (!prompt || hidden) return null;

  return (
    <div className="fixed bottom-4 left-4 z-[90] flex items-center gap-3 rounded-xl border border-border bg-surface shadow-lg px-4 py-3 animate-in max-w-[320px]">
      <Download size={18} className="text-primary shrink-0" />
      <div className="flex-1 text-sm">
        <p className="font-medium">Instalar o Painel Build</p>
        <p className="text-xs text-muted">Acesse como app, com leitura offline.</p>
      </div>
      <button onClick={instalar} className="text-xs font-semibold text-primary hover:underline cursor-pointer">Instalar</button>
      <button onClick={() => setHidden(true)} className="text-muted hover:text-foreground cursor-pointer" aria-label="Fechar"><X size={15} /></button>
    </div>
  );
}
