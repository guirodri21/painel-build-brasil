"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useData } from "@/components/data-provider";
import { Search, KanbanSquare, Contact, Wrench, Package, CornerDownLeft } from "lucide-react";

type Item = { tipo: string; label: string; sub: string; href: string; icon: React.ComponentType<{ size?: number; className?: string }> };

export function CommandPalette() {
  const router = useRouter();
  const { chamados, clientesReg, ordens, produtos } = useData();
  const [open, setOpen] = React.useState(false);
  const [q, setQ] = React.useState("");
  const [idx, setIdx] = React.useState(0);
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      } else if (e.key === "Escape") setOpen(false);
    }
    const onOpen = () => setOpen(true);
    window.addEventListener("keydown", onKey);
    window.addEventListener("open-palette", onOpen);
    return () => { window.removeEventListener("keydown", onKey); window.removeEventListener("open-palette", onOpen); };
  }, []);

  React.useEffect(() => {
    if (open) { setQ(""); setIdx(0); setTimeout(() => inputRef.current?.focus(), 30); }
  }, [open]);

  const results = React.useMemo<Item[]>(() => {
    const s = q.trim().toLowerCase();
    if (!s) return [];
    const m = (t: string | null | undefined) => (t ?? "").toLowerCase().includes(s);
    const out: Item[] = [];
    for (const c of chamados) {
      if (m(c.titulo) || m(c.cliente) || m(c.ticket_ref) || m(c.regiao) || m(c.descricao)) {
        out.push({ tipo: "Chamado", label: c.cliente || c.titulo || "Chamado", sub: `${c.ticket_ref ? "#" + c.ticket_ref + " · " : ""}${c.fase}`, href: "/chamados", icon: KanbanSquare });
        if (out.length > 40) break;
      }
    }
    for (const c of clientesReg) if (m(c.nome) || m(c.telefone) || m(c.documento)) out.push({ tipo: "Cliente", label: c.nome, sub: c.telefone || c.email || "—", href: "/clientes", icon: Contact });
    for (const o of ordens) if (m(o.cliente) || m(o.linha_servico) || m(o.equipe) || m(o.resumo)) out.push({ tipo: "Ordem", label: o.cliente || o.linha_servico, sub: `${o.equipe} · ${o.data}`, href: "/operacoes/pipeline", icon: Wrench });
    for (const p of produtos) if (m(p.nome) || m(p.sku)) out.push({ tipo: "Produto", label: p.nome, sub: p.sku || "—", href: "/estoque", icon: Package });
    return out.slice(0, 30);
  }, [q, chamados, clientesReg, ordens, produtos]);

  function go(item: Item) { setOpen(false); router.push(item.href); }

  function onInputKey(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") { e.preventDefault(); setIdx((i) => Math.min(i + 1, results.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setIdx((i) => Math.max(i - 1, 0)); }
    else if (e.key === "Enter" && results[idx]) { e.preventDefault(); go(results[idx]); }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[120] flex items-start justify-center pt-[12vh] bg-black/40 backdrop-blur-sm" onMouseDown={() => setOpen(false)}>
      <div className="w-full max-w-xl rounded-xl border border-border bg-surface shadow-lg overflow-hidden animate-in" onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 px-4 border-b border-border">
          <Search size={16} className="text-muted shrink-0" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => { setQ(e.target.value); setIdx(0); }}
            onKeyDown={onInputKey}
            placeholder="Buscar chamados, clientes, ordens, produtos..."
            className="flex-1 h-12 bg-transparent text-sm outline-none placeholder:text-muted"
          />
          <kbd className="text-[10px] text-muted border border-border rounded px-1.5 py-0.5">ESC</kbd>
        </div>
        <div className="max-h-[50vh] overflow-y-auto py-1">
          {q && results.length === 0 && <p className="px-4 py-6 text-center text-sm text-muted">Nada encontrado.</p>}
          {!q && <p className="px-4 py-6 text-center text-sm text-muted">Digite para buscar em todo o painel.</p>}
          {results.map((r, i) => {
            const Icon = r.icon;
            return (
              <button key={i} onMouseEnter={() => setIdx(i)} onClick={() => go(r)}
                className={`w-full flex items-center gap-3 px-4 py-2.5 text-left cursor-pointer ${i === idx ? "bg-surface-2" : ""}`}>
                <Icon size={16} className="text-muted shrink-0" />
                <span className="flex-1 min-w-0">
                  <span className="text-sm font-medium block truncate">{r.label}</span>
                  <span className="text-xs text-muted block truncate">{r.sub}</span>
                </span>
                <span className="text-[10px] text-muted shrink-0">{r.tipo}</span>
                {i === idx && <CornerDownLeft size={13} className="text-muted shrink-0" />}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
