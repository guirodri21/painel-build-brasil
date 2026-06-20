"use client";

import * as React from "react";
import { createClient } from "@/lib/supabase/client";
import { useData } from "@/components/data-provider";
import { useToast } from "@/components/ui/toast";
import { PageHeader } from "@/components/page-header";
import { KpiCard } from "@/components/kpi-card";
import { KpiSkeletonRow, Skeleton } from "@/components/ui/skeleton";
import { Card, CardHeader, CardTitle, CardBody } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input, Select } from "@/components/ui/field";
import { ChamadoModal } from "@/components/chamado-modal";
import { ChamadosImport } from "@/components/chamados-import";
import { sum } from "@/lib/analytics";
import { formatCurrency, formatNumber, formatDate, todayISO, cn } from "@/lib/utils";
import type { Chamado } from "@/lib/types";
import { Plus, Search, Ticket, AlertTriangle, DollarSign, Layers, Upload, Clock } from "lucide-react";

type Tone = "green" | "yellow" | "blue" | "red" | "orange" | "gray" | "teal";
type Aba = "board" | "dashboard";

const DOT: Record<string, string> = {
  blue: "bg-primary", gray: "bg-muted", teal: "bg-teal",
  yellow: "bg-yellow", orange: "bg-orange", green: "bg-green", red: "bg-red",
};

function prioTone(p: string | null | undefined): "red" | "yellow" | "gray" {
  const v = (p ?? "").toLowerCase();
  if (v.startsWith("alta")) return "red";
  if (v.startsWith("méd") || v.startsWith("med")) return "yellow";
  return "gray";
}
const horas = (s: string | undefined) => (s ? parseFloat(String(s).replace(",", ".")) || 0 : 0);

function diasDesde(iso?: string | null): number | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  return Math.floor((Date.now() - d.getTime()) / 86400000);
}
function agingTone(d: number): Tone {
  if (d >= 14) return "red";
  if (d >= 7) return "orange";
  if (d >= 3) return "yellow";
  return "gray";
}

export default function ChamadosPage() {
  const { chamados, chamadoFases, refresh, loading } = useData();
  const toast = useToast();
  const [aba, setAba] = React.useState<Aba>("board");
  const [dragId, setDragId] = React.useState<string | null>(null);
  const [overFase, setOverFase] = React.useState<string | null>(null);

  async function moverFase(fase: string) {
    const id = dragId;
    setDragId(null); setOverFase(null);
    if (!id) return;
    const atual = chamados.find((c) => c.id === id);
    if (!atual || atual.fase === fase) return;
    const { error } = await createClient().from("chamados").update({ fase }).eq("id", id);
    if (error) { toast("Erro ao mover: " + error.message, "error"); return; }
    await refresh();
    toast(`Movido para "${fase}".`);
  }
  const [busca, setBusca] = React.useState("");
  const [fRegiao, setFRegiao] = React.useState("");
  const [fPrioridade, setFPrioridade] = React.useState("");
  const [fEquipe, setFEquipe] = React.useState("");
  const [modal, setModal] = React.useState(false);
  const [importar, setImportar] = React.useState(false);
  const [edit, setEdit] = React.useState<Chamado | null>(null);
  const [faseNova, setFaseNova] = React.useState<string | undefined>();

  const hoje = todayISO();
  const fasesFinais = React.useMemo(() => new Set(chamadoFases.filter((f) => f.final).map((f) => f.nome)), [chamadoFases]);

  const regioes = React.useMemo(() => Array.from(new Set(chamados.map((c) => c.regiao).filter(Boolean))).sort() as string[], [chamados]);
  const prioridades = React.useMemo(() => Array.from(new Set(chamados.map((c) => c.prioridade).filter(Boolean))).sort() as string[], [chamados]);
  const equipes = React.useMemo(() => Array.from(new Set(chamados.map((c) => c.equipe).filter(Boolean))).sort() as string[], [chamados]);

  const filtrados = React.useMemo(() => {
    const q = busca.trim().toLowerCase();
    return chamados.filter((c) => {
      if (fRegiao && c.regiao !== fRegiao) return false;
      if (fPrioridade && c.prioridade !== fPrioridade) return false;
      if (fEquipe && c.equipe !== fEquipe) return false;
      if (!q) return true;
      return [c.titulo, c.cliente, c.regiao, c.descricao, c.ticket_ref, c.responsavel]
        .filter(Boolean).join(" ").toLowerCase().includes(q);
    });
  }, [chamados, busca, fRegiao, fPrioridade, fEquipe]);

  const atrasado = (c: Chamado) => !!c.prazo && c.prazo < hoje && !fasesFinais.has(c.fase);

  const colunas = React.useMemo(() => {
    const nomes = chamadoFases.map((f) => f.nome);
    const extras = Array.from(new Set(filtrados.map((c) => c.fase).filter((f) => !nomes.includes(f))));
    return [...chamadoFases.map((f) => ({ nome: f.nome, cor: f.cor ?? "gray" })),
            ...extras.map((n) => ({ nome: n, cor: "gray" }))];
  }, [chamadoFases, filtrados]);

  const porFase = React.useMemo(() => {
    const m = new Map<string, Chamado[]>();
    for (const c of filtrados) { const a = m.get(c.fase) ?? []; a.push(c); m.set(c.fase, a); }
    return m;
  }, [filtrados]);

  const emAberto = filtrados.filter((c) => !fasesFinais.has(c.fase));
  const atrasados = emAberto.filter(atrasado).length;
  const valorTotal = sum(emAberto, (c) => c.valor);

  function abrir(c: Chamado | null, fase?: string) { setEdit(c); setFaseNova(fase); setModal(true); }

  if (loading)
    return (<><PageHeader title="Chamados" /><KpiSkeletonRow count={4} /><Skeleton className="h-96" /></>);

  return (
    <>
      <PageHeader title="Chamados" subtitle="Board de chamados — espelho do Goalfy">
        <Button variant="secondary" onClick={() => setImportar(true)}><Upload size={16} /> Importar CSV</Button>
        <Button onClick={() => abrir(null)}><Plus size={16} /> Novo Card</Button>
      </PageHeader>

      <div className="stagger grid gap-3 mb-4 grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Total" value={filtrados.length} format={(n) => formatNumber(n)} icon={Ticket} />
        <KpiCard label="Em aberto" value={emAberto.length} format={(n) => formatNumber(n)} tone="teal" icon={Layers} />
        <KpiCard label="Atrasados (SLA)" value={atrasados} format={(n) => formatNumber(n)} tone={atrasados > 0 ? "red" : "default"} icon={AlertTriangle} />
        <KpiCard label="Pipeline (valor)" value={valorTotal} format={(n) => formatCurrency(n)} tone="green" icon={DollarSign} />
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="relative">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" />
          <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar..." className="pl-8 w-48" />
        </div>
        <Select value={fRegiao} onChange={(e) => setFRegiao(e.target.value)} className="w-40"><option value="">Todas regiões</option>{regioes.map((r) => <option key={r} value={r}>{r}</option>)}</Select>
        <Select value={fPrioridade} onChange={(e) => setFPrioridade(e.target.value)} className="w-36"><option value="">Toda prioridade</option>{prioridades.map((p) => <option key={p} value={p}>{p}</option>)}</Select>
        {equipes.length > 0 && <Select value={fEquipe} onChange={(e) => setFEquipe(e.target.value)} className="w-40"><option value="">Todas equipes</option>{equipes.map((eq) => <option key={eq} value={eq}>{eq}</option>)}</Select>}
        <div className="flex-1" />
        <div className="flex gap-1 border border-border rounded-lg p-0.5">
          <TabBtn active={aba === "board"} onClick={() => setAba("board")}>Board</TabBtn>
          <TabBtn active={aba === "dashboard"} onClick={() => setAba("dashboard")}>Dashboard</TabBtn>
        </div>
      </div>

      {aba === "board" ? (
        filtrados.length === 0 ? (
          <div className="rounded-xl border border-border bg-surface p-10 text-center">
            <Ticket size={36} className="text-muted mx-auto mb-3" />
            <p className="text-sm text-muted">Nenhum chamado com esses filtros. Importe a planilha do Goalfy ou crie manualmente.</p>
          </div>
        ) : (
          <div className="overflow-x-auto pb-3">
            <div className="flex gap-3 min-w-max">
              {colunas.map((col) => {
                const items = porFase.get(col.nome) ?? [];
                const total = sum(items, (c) => c.valor);
                return (
                  <div key={col.nome}
                    onDragOver={(e) => { e.preventDefault(); setOverFase(col.nome); }}
                    onDragLeave={() => setOverFase((f) => (f === col.nome ? null : f))}
                    onDrop={() => moverFase(col.nome)}
                    className={cn("w-72 shrink-0 rounded-xl border bg-surface-2/40 flex flex-col transition-colors",
                      overFase === col.nome ? "border-primary bg-primary-soft/30" : "border-border")}>
                    <div className="flex items-center justify-between gap-2 px-3 py-2.5 border-b border-border">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className={cn("h-2.5 w-2.5 rounded-full shrink-0", DOT[col.cor] ?? "bg-muted")} />
                        <span className="text-sm font-semibold truncate">{col.nome}</span>
                        <span className="text-xs text-muted tabular-nums">{items.length}</span>
                      </div>
                      <button onClick={() => abrir(null, col.nome)} className="text-muted hover:text-primary cursor-pointer" title="Novo card aqui"><Plus size={14} /></button>
                    </div>
                    <div className="p-2 space-y-2 flex-1 max-h-[64vh] overflow-y-auto">
                      {items.map((c) => (
                        <button key={c.id} onClick={() => abrir(c)}
                          draggable
                          onDragStart={() => setDragId(c.id)}
                          onDragEnd={() => { setDragId(null); setOverFase(null); }}
                          className={cn("w-full text-left rounded-lg border bg-surface hover:border-border-strong p-2.5 transition-all cursor-grab active:cursor-grabbing",
                            dragId === c.id && "opacity-40",
                            atrasado(c) ? "border-l-4 border-l-red border-border" : "border-border")}>
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <span className="text-sm font-medium truncate">{c.titulo || "Chamado"}</span>
                            {c.prioridade && <Badge tone={prioTone(c.prioridade)}>{c.prioridade}</Badge>}
                          </div>
                          {c.cliente && <p className="text-xs font-medium text-foreground truncate">{c.cliente}</p>}
                          {c.regiao && <p className="text-[11px] text-muted">{c.regiao}</p>}
                          {c.descricao && <p className="text-[11px] text-muted mt-1 line-clamp-2">{c.descricao}</p>}
                          <div className="flex items-center justify-between mt-1.5 text-[11px] text-muted">
                            <span className="flex items-center gap-2">
                              {c.ticket_ref && <span># {c.ticket_ref}</span>}
                              {(() => {
                                const d = diasDesde(c.fase_desde ?? c.created_at);
                                if (d == null || fasesFinais.has(c.fase)) return null;
                                const t = agingTone(d);
                                return <span className={cn("flex items-center gap-0.5", t === "red" && "text-red", t === "orange" && "text-orange", t === "yellow" && "text-yellow")}><Clock size={10} /> {d}d</span>;
                              })()}
                            </span>
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
        )
      ) : (
        <ChamadosDashboard chamados={filtrados} fases={chamadoFases.map((f) => f.nome)} fasesFinais={fasesFinais} />
      )}

      {modal && <ChamadoModal open={modal} onClose={() => { setModal(false); setEdit(null); setFaseNova(undefined); }} chamado={edit} faseInicial={faseNova} />}
      {importar && <ChamadosImport open={importar} onClose={() => setImportar(false)} />}
    </>
  );
}

function ChamadosDashboard({ chamados, fases, fasesFinais }: { chamados: Chamado[]; fases: string[]; fasesFinais: Set<string> }) {
  const cont = (key: (c: Chamado) => string | null | undefined) => {
    const m = new Map<string, { n: number; valor: number }>();
    for (const c of chamados) {
      const k = key(c) || "—";
      const cur = m.get(k) ?? { n: 0, valor: 0 };
      cur.n++; cur.valor += c.valor; m.set(k, cur);
    }
    return Array.from(m.entries()).map(([k, v]) => ({ k, ...v })).sort((a, b) => b.n - a.n);
  };

  const porFase = fases.map((f) => {
    const items = chamados.filter((c) => c.fase === f);
    return { k: f, n: items.length, valor: sum(items, (c) => c.valor) };
  }).filter((x) => x.n > 0);
  const porRegiao = cont((c) => c.regiao).slice(0, 8);
  const porPrioridade = cont((c) => c.prioridade);
  const perdas = chamados.filter((c) => (c.motivo_perda || "").trim() || c.fase.toLowerCase().includes("recus"));
  const porMotivo = (() => {
    const m = new Map<string, number>();
    for (const c of perdas) { const k = (c.motivo_perda || "Sem motivo").trim() || "Sem motivo"; m.set(k, (m.get(k) ?? 0) + 1); }
    return Array.from(m.entries()).map(([k, n]) => ({ k, n })).sort((a, b) => b.n - a.n);
  })();

  // Gargalos: média de horas por fase (das colunas Tempo total na fase X)
  const gargalos = (() => {
    const acc = new Map<string, { soma: number; n: number }>();
    for (const c of chamados) {
      for (const [fase, val] of Object.entries(c.tempos_fase ?? {})) {
        const h = horas(val);
        if (h <= 0) continue;
        const cur = acc.get(fase) ?? { soma: 0, n: 0 };
        cur.soma += h; cur.n++; acc.set(fase, cur);
      }
    }
    return Array.from(acc.entries()).map(([k, v]) => ({ k, media: v.soma / v.n })).sort((a, b) => b.media - a.media).slice(0, 8);
  })();

  const maxFase = Math.max(1, ...porFase.map((x) => x.n));
  const maxGarg = Math.max(1, ...gargalos.map((x) => x.media));

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <Card>
        <CardHeader><CardTitle>Funil por fase</CardTitle></CardHeader>
        <CardBody className="space-y-2">
          {porFase.map((x) => (
            <BarRow key={x.k} label={x.k} value={x.n} pct={(x.n / maxFase) * 100} right={formatCurrency(x.valor)} />
          ))}
        </CardBody>
      </Card>

      <Card>
        <CardHeader><CardTitle>Pipeline financeiro (valor em aberto por fase)</CardTitle></CardHeader>
        <CardBody className="space-y-2">
          {porFase.filter((x) => !fasesFinais.has(x.k) && x.valor > 0).map((x) => {
            const maxV = Math.max(1, ...porFase.filter((y) => !fasesFinais.has(y.k)).map((y) => y.valor));
            return <BarRow key={x.k} label={x.k} value={x.n} pct={(x.valor / maxV) * 100} right={formatCurrency(x.valor)} tone="green" />;
          })}
        </CardBody>
      </Card>

      <Card>
        <CardHeader><CardTitle>Por região</CardTitle></CardHeader>
        <CardBody className="space-y-2">
          {porRegiao.map((x) => <BarRow key={x.k} label={x.k} value={x.n} pct={(x.n / porRegiao[0].n) * 100} right={formatCurrency(x.valor)} tone="teal" />)}
        </CardBody>
      </Card>

      <Card>
        <CardHeader><CardTitle>Por prioridade</CardTitle></CardHeader>
        <CardBody className="space-y-2">
          {porPrioridade.map((x) => <BarRow key={x.k} label={x.k} value={x.n} pct={(x.n / porPrioridade[0].n) * 100} tone={prioTone(x.k)} />)}
        </CardBody>
      </Card>

      {gargalos.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Gargalos — tempo médio por fase</CardTitle></CardHeader>
          <CardBody className="space-y-2">
            {gargalos.map((x) => <BarRow key={x.k} label={x.k} value={Math.round(x.media)} pct={(x.media / maxGarg) * 100} right={`${x.media.toFixed(1)} h`} tone="orange" />)}
          </CardBody>
          <p className="px-5 pb-3 text-[11px] text-muted italic">Baseado nas colunas &quot;Tempo total na fase&quot; da planilha (em horas).</p>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle>Análise de perdas ({perdas.length})</CardTitle></CardHeader>
        <CardBody className="space-y-2">
          {porMotivo.length ? porMotivo.map((x) => <BarRow key={x.k} label={x.k} value={x.n} pct={(x.n / porMotivo[0].n) * 100} tone="red" />)
            : <p className="text-sm text-muted">Nenhuma perda registrada.</p>}
        </CardBody>
      </Card>
    </div>
  );
}

function BarRow({ label, value, pct, right, tone = "blue" }: { label: string; value: number; pct: number; right?: string; tone?: Tone }) {
  return (
    <div>
      <div className="flex items-center justify-between text-xs mb-0.5">
        <span className="truncate pr-2">{label}</span>
        <span className="text-muted tabular-nums shrink-0">{value}{right ? ` · ${right}` : ""}</span>
      </div>
      <div className="h-2 rounded-full bg-surface-2 overflow-hidden">
        <div className={cn("h-full rounded-full", DOT[tone] ?? "bg-primary")} style={{ width: `${Math.max(2, Math.min(pct, 100))}%` }} />
      </div>
    </div>
  );
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className={cn("px-3 py-1 text-sm font-medium rounded-md transition-colors cursor-pointer", active ? "bg-primary text-primary-fg" : "text-muted hover:text-foreground")}>
      {children}
    </button>
  );
}
