"use client";

import * as React from "react";
import { useData } from "@/components/data-provider";
import { PageHeader } from "@/components/page-header";
import { KpiCard } from "@/components/kpi-card";
import { KpiSkeletonRow, Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/field";
import { ChamadoModal } from "@/components/chamado-modal";
import { sum } from "@/lib/analytics";
import { formatCurrency, formatNumber, cn } from "@/lib/utils";
import type { Chamado } from "@/lib/types";
import { Plus, Search, Ticket, AlertTriangle, DollarSign, Layers } from "lucide-react";

type Tone = "green" | "yellow" | "blue" | "red" | "orange" | "gray";

// Classes literais (Tailwind não gera classes montadas dinamicamente)
const DOT: Record<string, string> = {
  blue: "bg-primary", gray: "bg-muted", teal: "bg-teal",
  yellow: "bg-yellow", orange: "bg-orange", green: "bg-green", red: "bg-red",
};

function prioTone(p: string | null): Tone {
  const v = (p ?? "").toLowerCase();
  if (v.startsWith("alta")) return "red";
  if (v.startsWith("méd") || v.startsWith("med")) return "yellow";
  if (v.startsWith("baix")) return "gray";
  return "gray";
}

export default function ChamadosPage() {
  const { chamados, chamadoFases, loading } = useData();
  const [busca, setBusca] = React.useState("");
  const [modal, setModal] = React.useState(false);
  const [edit, setEdit] = React.useState<Chamado | null>(null);
  const [faseNova, setFaseNova] = React.useState<string | undefined>();

  const filtrados = React.useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return chamados;
    return chamados.filter((c) =>
      [c.titulo, c.cliente, c.regiao, c.descricao, c.ticket_ref, c.responsavel]
        .filter(Boolean).join(" ").toLowerCase().includes(q),
    );
  }, [chamados, busca]);

  // Colunas: fases cadastradas + qualquer fase órfã que apareça nos cards
  const colunas = React.useMemo(() => {
    const nomes = chamadoFases.map((f) => f.nome);
    const extras = Array.from(new Set(filtrados.map((c) => c.fase).filter((f) => !nomes.includes(f))));
    return [...chamadoFases.map((f) => ({ nome: f.nome, cor: f.cor ?? "gray" })),
            ...extras.map((n) => ({ nome: n, cor: "gray" }))];
  }, [chamadoFases, filtrados]);

  const porFase = React.useMemo(() => {
    const m = new Map<string, Chamado[]>();
    for (const c of filtrados) {
      const arr = m.get(c.fase) ?? [];
      arr.push(c);
      m.set(c.fase, arr);
    }
    return m;
  }, [filtrados]);

  const fasesFinais = new Set(chamadoFases.filter((f) => f.final).map((f) => f.nome));
  const emAberto = chamados.filter((c) => !fasesFinais.has(c.fase)).length;
  const altas = chamados.filter((c) => (c.prioridade ?? "").toLowerCase().startsWith("alta") && !fasesFinais.has(c.fase)).length;
  const valorTotal = sum(chamados.filter((c) => !fasesFinais.has(c.fase)), (c) => c.valor);

  function abrir(c: Chamado | null, fase?: string) { setEdit(c); setFaseNova(fase); setModal(true); }

  if (loading)
    return (<><PageHeader title="Chamados" /><KpiSkeletonRow count={4} /><Skeleton className="h-96" /></>);

  return (
    <>
      <PageHeader title="Chamados" subtitle="Board de chamados — espelho do Goalfy">
        <div className="relative">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" />
          <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar..." className="pl-8 w-52" />
        </div>
        <Button onClick={() => abrir(null)}><Plus size={16} /> Novo Card</Button>
      </PageHeader>

      <div className="stagger grid gap-3 mb-5 grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Total de chamados" value={chamados.length} format={(n) => formatNumber(n)} icon={Ticket} />
        <KpiCard label="Em aberto" value={emAberto} format={(n) => formatNumber(n)} tone="teal" icon={Layers} />
        <KpiCard label="Prioridade alta" value={altas} format={(n) => formatNumber(n)} tone={altas > 0 ? "red" : "default"} icon={AlertTriangle} />
        <KpiCard label="Valor em aberto" value={valorTotal} format={(n) => formatCurrency(n)} tone="green" icon={DollarSign} />
      </div>

      {chamados.length === 0 ? (
        <div className="rounded-xl border border-border bg-surface p-10 text-center">
          <Ticket size={36} className="text-muted mx-auto mb-3" />
          <p className="text-sm text-muted">Nenhum chamado ainda. Eles aparecem aqui automaticamente quando o Goalfy sincronizar — ou crie um manualmente.</p>
        </div>
      ) : (
        <div className="overflow-x-auto pb-3">
          <div className="flex gap-3 min-w-max">
            {colunas.map((col) => {
              const items = porFase.get(col.nome) ?? [];
              const total = sum(items, (c) => c.valor);
              return (
                <div key={col.nome} className="w-72 shrink-0 rounded-xl border border-border bg-surface-2/40 flex flex-col">
                  <div className="flex items-center justify-between gap-2 px-3 py-2.5 border-b border-border">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={cn("h-2.5 w-2.5 rounded-full shrink-0", DOT[col.cor] ?? "bg-muted")} />
                      <span className="text-sm font-semibold truncate">{col.nome}</span>
                      <span className="text-xs text-muted tabular-nums">{items.length}</span>
                    </div>
                    <button onClick={() => abrir(null, col.nome)} className="text-muted hover:text-primary cursor-pointer" title="Novo card aqui"><Plus size={14} /></button>
                  </div>
                  <div className="p-2 space-y-2 flex-1 max-h-[68vh] overflow-y-auto">
                    {items.map((c) => (
                      <button key={c.id} onClick={() => abrir(c)}
                        className="w-full text-left rounded-lg border border-border bg-surface hover:border-border-strong p-2.5 transition-colors cursor-pointer">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <span className="text-sm font-medium truncate">{c.titulo || "Chamado"}</span>
                          {c.prioridade && <Badge tone={prioTone(c.prioridade)}>{c.prioridade}</Badge>}
                        </div>
                        {c.cliente && <p className="text-xs font-medium text-foreground truncate">{c.cliente}</p>}
                        {c.regiao && <p className="text-[11px] text-muted">{c.regiao}</p>}
                        {c.descricao && <p className="text-[11px] text-muted mt-1 line-clamp-2">{c.descricao}</p>}
                        <div className="flex items-center justify-between mt-1.5 text-[11px] text-muted">
                          {c.ticket_ref ? <span># {c.ticket_ref}</span> : <span />}
                          {c.valor > 0 && <span className="font-medium text-foreground">{formatCurrency(c.valor)}</span>}
                        </div>
                      </button>
                    ))}
                    {items.length === 0 && <div className="text-center py-6 text-[11px] text-muted">—</div>}
                  </div>
                  {total > 0 && (
                    <div className="px-3 py-2 border-t border-border text-[11px] text-muted flex justify-between">
                      <span>Total</span><span className="font-medium text-foreground tabular-nums">{formatCurrency(total)}</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {modal && <ChamadoModal open={modal} onClose={() => { setModal(false); setEdit(null); setFaseNova(undefined); }} chamado={edit} faseInicial={faseNova} />}
    </>
  );
}
