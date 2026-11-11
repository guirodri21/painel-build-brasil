"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useData } from "@/components/data-provider";
import { Search, KanbanSquare, Contact, Wrench, Package, CornerDownLeft, ArrowRight } from "lucide-react";
import { HOME, gruposVisiveis, type NavIcon } from "@/lib/nav";
import { cn } from "@/lib/utils";

type Item = { tipo: string; label: string; sub: string; href: string; icon: NavIcon };
type Secao = { titulo: string; itens: Item[] };

/** Minúsculo e sem acento: "Orçamentos" casa com "orcam". */
const norm = (t: string | null | undefined) =>
  (t ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export function CommandPalette() {
  const router = useRouter();
  const { chamados, clientesReg, ordens, produtos, isAdmin, podeComercial, podeOperacional, podeEstoque, podeFinanceiro } = useData();
  const [open, setOpen] = React.useState(false);
  const [q, setQ] = React.useState("");
  const [idx, setIdx] = React.useState(0);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const listRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const abrir = () => { setQ(""); setIdx(0); setOpen(true); };
    function onKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => {
          if (!o) { setQ(""); setIdx(0); }
          return !o;
        });
      }
    }
    const onOpen = abrir;
    window.addEventListener("keydown", onKey);
    window.addEventListener("open-palette", onOpen);
    return () => { window.removeEventListener("keydown", onKey); window.removeEventListener("open-palette", onOpen); };
  }, []);

  React.useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => inputRef.current?.focus(), 20);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { clearTimeout(t); document.body.style.overflow = prev; };
  }, [open]);

  const paginas = React.useMemo<Item[]>(() => {
    const grupos = gruposVisiveis({ isAdmin, podeComercial, podeOperacional, podeEstoque, podeFinanceiro });
    return [
      { tipo: "Página", label: HOME.label, sub: "Início", href: HOME.href, icon: HOME.icon, kw: HOME.keywords },
      ...grupos.flatMap((g) => g.items.map((it) => ({ tipo: "Página", label: it.label, sub: g.label, href: it.href, icon: it.icon, kw: it.keywords }))),
    ].map(({ kw, ...it }) => Object.assign(it, { _busca: norm(`${it.label} ${it.sub} ${kw ?? ""}`) }));
  }, [isAdmin, podeComercial, podeOperacional, podeEstoque, podeFinanceiro]);

  const secoes = React.useMemo<Secao[]>(() => {
    const s = norm(q.trim());
    if (!s) return [{ titulo: "Ir para", itens: paginas }];

    const m = (...ts: (string | null | undefined)[]) => ts.some((t) => norm(t).includes(s));
    const pags = paginas.filter((p) => (p as Item & { _busca: string })._busca.includes(s)).slice(0, 6);

    const dados: Item[] = [];
    const LIM = 24;
    if (podeComercial) {
      for (const c of chamados) {
        if (dados.length >= LIM) break;
        if (m(c.titulo, c.cliente, c.ticket_ref, c.regiao, c.descricao))
          dados.push({ tipo: "Chamado", label: c.cliente || c.titulo || "Chamado", sub: `${c.ticket_ref ? "#" + c.ticket_ref + " · " : ""}${c.fase}`, href: "/chamados", icon: KanbanSquare });
      }
      for (const c of clientesReg) {
        if (dados.length >= LIM) break;
        if (m(c.nome, c.telefone, c.documento))
          dados.push({ tipo: "Cliente", label: c.nome, sub: c.telefone || c.email || "—", href: "/clientes", icon: Contact });
      }
    }
    if (podeOperacional) {
      for (const o of ordens) {
        if (dados.length >= LIM) break;
        if (m(o.cliente, o.linha_servico, o.equipe, o.resumo))
          dados.push({ tipo: "Ordem", label: o.cliente || o.linha_servico, sub: `${o.equipe} · ${o.data}`, href: "/operacoes/pipeline", icon: Wrench });
      }
    }
    if (podeEstoque) {
      for (const p of produtos) {
        if (dados.length >= LIM) break;
        if (m(p.nome, p.sku))
          dados.push({ tipo: "Produto", label: p.nome, sub: p.sku || "—", href: "/estoque", icon: Package });
      }
    }
    return [
      { titulo: "Páginas", itens: pags },
      { titulo: "Registros", itens: dados },
    ].filter((x) => x.itens.length);
  }, [q, paginas, chamados, clientesReg, ordens, produtos, podeComercial, podeOperacional, podeEstoque]);

  const flat = React.useMemo(() => secoes.flatMap((x) => x.itens), [secoes]);

  // Mantém o item selecionado visível ao navegar com as setas.
  React.useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-idx="${idx}"]`)?.scrollIntoView({ block: "nearest" });
  }, [idx]);

  function go(item: Item) { setOpen(false); router.push(item.href); }

  function onInputKey(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") { e.preventDefault(); setIdx((i) => Math.min(i + 1, flat.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setIdx((i) => Math.max(i - 1, 0)); }
    else if (e.key === "Enter" && flat[idx]) { e.preventDefault(); go(flat[idx]); }
    else if (e.key === "Escape") { e.preventDefault(); setOpen(false); }
  }

  if (!open) return null;

  let n = -1;
  return (
    <div
      className="fixed inset-0 z-[120] flex items-start justify-center px-3 pt-[10vh] bg-black/40 backdrop-blur-sm"
      onMouseDown={() => setOpen(false)}
    >
      <div
        role="dialog"
        aria-label="Busca"
        className="w-full max-w-xl rounded-xl border border-border bg-surface shadow-lg overflow-hidden animate-in"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 px-4 border-b border-border">
          <Search size={16} className="text-muted shrink-0" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => { setQ(e.target.value); setIdx(0); }}
            onKeyDown={onInputKey}
            placeholder="Ir para uma página ou buscar chamados, clientes, ordens…"
            className="flex-1 h-12 bg-transparent text-sm outline-none placeholder:text-muted"
          />
          <kbd className="hidden sm:inline text-[10px] text-muted border border-border rounded px-1.5 py-0.5">ESC</kbd>
        </div>
        <div ref={listRef} className="max-h-[60vh] overflow-y-auto overscroll-contain p-1.5">
          {q && flat.length === 0 && <p className="px-4 py-8 text-center text-sm text-muted">Nada encontrado para “{q}”.</p>}
          {secoes.map((sec) => (
            <div key={sec.titulo} className="mb-1 last:mb-0">
              <p className="px-2.5 pt-2 pb-1 text-[11px] font-semibold uppercase tracking-wider text-muted">{sec.titulo}</p>
              {sec.itens.map((r) => {
                n++;
                const i = n;
                const Icon = r.icon;
                const sel = i === idx;
                return (
                  <button
                    key={`${r.tipo}-${r.href}-${r.label}-${i}`}
                    data-idx={i}
                    onMouseMove={() => idx !== i && setIdx(i)}
                    onClick={() => go(r)}
                    className={cn(
                      "w-full flex items-center gap-3 rounded-lg px-2.5 py-2 text-left cursor-pointer transition-colors",
                      sel ? "bg-primary-soft" : "hover:bg-surface-2",
                    )}
                  >
                    <span className={cn("grid h-7 w-7 shrink-0 place-items-center rounded-md border border-border", sel ? "text-primary bg-surface" : "text-muted")}>
                      <Icon size={15} />
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="text-sm font-medium block truncate">{r.label}</span>
                      <span className="text-xs text-muted block truncate">{r.sub}</span>
                    </span>
                    {r.tipo !== "Página" && <span className="text-[10px] text-muted shrink-0">{r.tipo}</span>}
                    {sel ? <CornerDownLeft size={13} className="text-muted shrink-0" /> : r.tipo === "Página" && <ArrowRight size={13} className="text-muted/50 shrink-0" />}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
        <div className="hidden sm:flex items-center gap-4 border-t border-border px-4 py-2 text-[11px] text-muted">
          <span><kbd className="border border-border rounded px-1">↑</kbd> <kbd className="border border-border rounded px-1">↓</kbd> navegar</span>
          <span><kbd className="border border-border rounded px-1">Enter</kbd> abrir</span>
          <span><kbd className="border border-border rounded px-1">[</kbd> recolher menu</span>
        </div>
      </div>
    </div>
  );
}
