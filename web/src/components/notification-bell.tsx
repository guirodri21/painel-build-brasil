"use client";

import * as React from "react";
import { createClient } from "@/lib/supabase/client";
import { useData } from "@/components/data-provider";
import { cn, formatDate } from "@/lib/utils";
import type { Notificacao } from "@/lib/types";
import { Bell, Check, CheckCheck } from "lucide-react";
import Link from "next/link";

export function NotificationBell() {
  const { userId } = useData();
  const supabase = React.useMemo(() => createClient(), []);
  const [itens, setItens] = React.useState<Notificacao[]>([]);
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);

  const carregar = React.useCallback(async () => {
    if (!userId) return;
    const { data } = await supabase.from("notificacoes").select("*")
      .order("created_at", { ascending: false }).limit(30);
    setItens((data as Notificacao[]) ?? []);
  }, [supabase, userId]);

  React.useEffect(() => { carregar(); }, [carregar]);

  // Realtime das notificações do usuário
  React.useEffect(() => {
    if (!userId) return;
    const ch = supabase.channel("notif-" + userId)
      .on("postgres_changes", { event: "*", schema: "public", table: "notificacoes", filter: `user_id=eq.${userId}` }, carregar)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [supabase, userId, carregar]);

  // Fecha ao clicar fora
  React.useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const naoLidas = itens.filter((n) => !n.lida).length;

  async function marcarTodas() {
    await supabase.from("notificacoes").update({ lida: true }).eq("lida", false);
    carregar();
  }
  async function marcar(id: string) {
    await supabase.from("notificacoes").update({ lida: true }).eq("id", id);
    carregar();
  }

  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen((o) => !o)} title="Notificações"
        className="relative inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border text-muted hover:text-foreground hover:bg-surface-2 transition-colors cursor-pointer">
        <Bell size={16} />
        {naoLidas > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-red text-white text-[10px] font-bold flex items-center justify-center">
            {naoLidas > 9 ? "9+" : naoLidas}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 max-h-[420px] overflow-y-auto rounded-xl border border-border bg-surface shadow-lg z-50 animate-in">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-border sticky top-0 bg-surface">
            <span className="text-sm font-semibold">Notificações</span>
            {naoLidas > 0 && (
              <button onClick={marcarTodas} className="text-xs text-primary hover:underline flex items-center gap-1 cursor-pointer">
                <CheckCheck size={13} /> Marcar todas
              </button>
            )}
          </div>
          {itens.length ? (
            <ul className="divide-y divide-border">
              {itens.map((n) => {
                const Inner = (
                  <div className={cn("px-4 py-3 hover:bg-surface-2 transition-colors", !n.lida && "bg-primary-soft/40")}>
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-medium">{n.titulo}</p>
                      {!n.lida && (
                        <button onClick={(e) => { e.preventDefault(); marcar(n.id); }} title="Marcar lida" className="text-muted hover:text-primary cursor-pointer shrink-0"><Check size={13} /></button>
                      )}
                    </div>
                    {n.mensagem && <p className="text-xs text-muted mt-0.5">{n.mensagem}</p>}
                    <p className="text-[10px] text-muted mt-1">{formatDate(n.created_at.split("T")[0])}</p>
                  </div>
                );
                return (
                  <li key={n.id}>
                    {n.link ? <Link href={n.link} onClick={() => { marcar(n.id); setOpen(false); }}>{Inner}</Link> : Inner}
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="px-4 py-8 text-center text-sm text-muted">Nenhuma notificação.</p>
          )}
        </div>
      )}
    </div>
  );
}
