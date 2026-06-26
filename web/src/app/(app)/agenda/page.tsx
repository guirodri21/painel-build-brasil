"use client";

import * as React from "react";
import { useData } from "@/components/data-provider";
import { PageHeader } from "@/components/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardBody } from "@/components/ui/card";
import { OrdemModal } from "@/components/ordem-modal";
import { cn } from "@/lib/utils";
import type { Ordem } from "@/lib/types";
import { ChevronLeft, ChevronRight, Plus, Clock, MapPin, Users } from "lucide-react";

const DIAS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

function inicioSemana(d: Date): Date {
  const x = new Date(d);
  const dow = (x.getDay() + 6) % 7; // 0 = segunda
  x.setDate(x.getDate() - dow);
  x.setHours(0, 0, 0, 0);
  return x;
}
function inicioGradeMes(d: Date): Date {
  // Primeira segunda-feira da grade que contém o dia 1 do mês de `d`.
  const primeiro = new Date(d.getFullYear(), d.getMonth(), 1);
  return inicioSemana(primeiro);
}
function iso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

type Modo = "semana" | "mes";

export default function AgendaPage() {
  const { ordens, loading } = useData();
  const [modo, setModo] = React.useState<Modo>("semana");
  const [ref, setRef] = React.useState(() => inicioSemana(new Date()));
  const [sel, setSel] = React.useState<Ordem | null>(null);
  const [novo, setNovo] = React.useState(false);

  // Dias visíveis: 7 (semana) ou 42 (grade 6×7 do mês).
  const dias = React.useMemo(() => {
    const n = modo === "semana" ? 7 : 42;
    const base = modo === "semana" ? ref : inicioGradeMes(ref);
    return Array.from({ length: n }, (_, i) => {
      const d = new Date(base);
      d.setDate(d.getDate() + i);
      return d;
    });
  }, [modo, ref]);

  const porDia = React.useMemo(() => {
    const m = new Map<string, Ordem[]>();
    for (const o of ordens) {
      if (!o.data_agendada) continue;
      const arr = m.get(o.data_agendada) ?? [];
      arr.push(o);
      m.set(o.data_agendada, arr);
    }
    for (const arr of m.values())
      arr.sort((a, b) => (a.hora_agendada ?? "99").localeCompare(b.hora_agendada ?? "99"));
    return m;
  }, [ordens]);

  // Resumos do período visível: atendimentos por região e por equipe.
  const { porRegiao, porEquipe, totalPeriodo } = React.useMemo(() => {
    const visiveis = new Set(dias.map(iso));
    const reg = new Map<string, number>();
    const eq = new Map<string, number>();
    let total = 0;
    for (const o of ordens) {
      if (!o.data_agendada || !visiveis.has(o.data_agendada)) continue;
      total++;
      reg.set(o.regiao || "—", (reg.get(o.regiao || "—") ?? 0) + 1);
      eq.set(o.equipe || "—", (eq.get(o.equipe || "—") ?? 0) + 1);
    }
    const ord = (m: Map<string, number>) => Array.from(m.entries()).sort((a, b) => b[1] - a[1]);
    return { porRegiao: ord(reg), porEquipe: ord(eq), totalPeriodo: total };
  }, [ordens, dias]);

  const hojeIso = iso(new Date());
  const mesRef = modo === "mes" ? ref.getMonth() : -1;
  const periodoLabel =
    modo === "semana"
      ? `${dias[0].toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })} – ${dias[6].toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}`
      : ref.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });

  function mover(passo: number) {
    const d = new Date(ref);
    if (modo === "semana") d.setDate(d.getDate() + passo * 7);
    else d.setMonth(d.getMonth() + passo, 1);
    setRef(modo === "semana" ? inicioSemana(d) : d);
  }
  function irHoje() {
    const n = new Date();
    setRef(modo === "semana" ? inicioSemana(n) : new Date(n.getFullYear(), n.getMonth(), 1));
  }
  function trocarModo(m: Modo) {
    setModo(m);
    const n = ref;
    setRef(m === "semana" ? inicioSemana(n) : new Date(n.getFullYear(), n.getMonth(), 1));
  }

  if (loading)
    return (<><PageHeader title="Agenda" /><Skeleton className="h-96" /></>);

  return (
    <>
      <PageHeader title="Agenda" subtitle="Programação técnica — ordens agendadas">
        <Button onClick={() => setNovo(true)}><Plus size={16} /> Nova Ordem</Button>
      </PageHeader>

      <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="icon" onClick={() => mover(-1)} aria-label="Anterior"><ChevronLeft size={16} /></Button>
          <Button variant="secondary" size="sm" onClick={irHoje}>Hoje</Button>
          <Button variant="secondary" size="icon" onClick={() => mover(1)} aria-label="Próximo"><ChevronRight size={16} /></Button>
          <span className="text-sm font-medium ml-2 capitalize">{periodoLabel}</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted">{totalPeriodo} agendamento(s)</span>
          <div className="flex gap-1 border border-border rounded-lg p-0.5">
            <ModoBtn active={modo === "semana"} onClick={() => trocarModo("semana")}>Semana</ModoBtn>
            <ModoBtn active={modo === "mes"} onClick={() => trocarModo("mes")}>Mês</ModoBtn>
          </div>
        </div>
      </div>

      {modo === "semana" ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-2">
          {dias.map((d, i) => (
            <DiaSemana key={iso(d)} d={d} label={DIAS[i]} lista={porDia.get(iso(d)) ?? []} isHoje={iso(d) === hojeIso} onSel={setSel} />
          ))}
        </div>
      ) : (
        <div>
          <div className="hidden lg:grid grid-cols-7 gap-2 mb-1">
            {DIAS.map((d) => <div key={d} className="text-[11px] font-semibold text-muted text-center">{d}</div>)}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-2">
            {dias.map((d) => {
              const di = iso(d);
              const lista = porDia.get(di) ?? [];
              const foraMes = d.getMonth() !== mesRef;
              const isHoje = di === hojeIso;
              return (
                <div key={di} className={cn("rounded-lg border bg-surface min-h-[96px] flex flex-col", isHoje ? "border-primary" : "border-border", foraMes && "opacity-40")}>
                  <div className={cn("px-2 py-1 text-[11px] font-semibold flex items-center justify-between", isHoje ? "text-primary" : "text-muted")}>
                    <span>{d.getDate()}</span>
                    {lista.length > 0 && <span className="tabular-nums">{lista.length}</span>}
                  </div>
                  <div className="px-1.5 pb-1.5 space-y-1 flex-1">
                    {lista.slice(0, 3).map((o) => (
                      <button key={o.id} onClick={() => setSel(o)}
                        className="w-full text-left rounded border border-border bg-surface-2 hover:bg-surface px-1.5 py-1 transition-colors cursor-pointer">
                        <div className="text-[10px] font-medium truncate">{o.hora_agendada ? o.hora_agendada.slice(0, 5) + " " : ""}{o.cliente || o.linha_servico}</div>
                      </button>
                    ))}
                    {lista.length > 3 && <div className="text-[10px] text-muted pl-1">+{lista.length - 3}</div>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="grid gap-3 mt-6 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle><span className="inline-flex items-center gap-1.5"><MapPin size={15} /> Atendimentos por região</span></CardTitle></CardHeader>
          <CardBody>
            <ResumoLista itens={porRegiao} vazio="Nenhum atendimento no período." />
          </CardBody>
        </Card>
        <Card>
          <CardHeader><CardTitle><span className="inline-flex items-center gap-1.5"><Users size={15} /> Carga por equipe</span></CardTitle></CardHeader>
          <CardBody>
            <ResumoLista itens={porEquipe} vazio="Nenhuma equipe alocada no período." />
          </CardBody>
        </Card>
      </div>

      {sel && <OrdemModal open={!!sel} ordem={sel} onClose={() => setSel(null)} />}
      {novo && <OrdemModal open={novo} onClose={() => setNovo(false)} />}
    </>
  );
}

function ModoBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className={cn("px-3 py-1 text-sm font-medium rounded-md transition-colors cursor-pointer", active ? "bg-primary text-primary-fg" : "text-muted hover:text-foreground")}>
      {children}
    </button>
  );
}

function ResumoLista({ itens, vazio }: { itens: [string, number][]; vazio: string }) {
  if (itens.length === 0) return <p className="text-sm text-muted">{vazio}</p>;
  const max = Math.max(1, ...itens.map(([, n]) => n));
  return (
    <div className="space-y-2">
      {itens.map(([nome, n]) => (
        <div key={nome}>
          <div className="flex items-center justify-between text-xs mb-0.5">
            <span className="truncate pr-2">{nome}</span>
            <span className="text-muted tabular-nums shrink-0">{n}</span>
          </div>
          <div className="h-2 rounded-full bg-surface-2 overflow-hidden">
            <div className="h-full rounded-full bg-primary" style={{ width: `${Math.max(4, (n / max) * 100)}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function DiaSemana({ d, label, lista, isHoje, onSel }: { d: Date; label: string; lista: Ordem[]; isHoje: boolean; onSel: (o: Ordem) => void }) {
  return (
    <div className={cn("rounded-xl border bg-surface min-h-[140px] flex flex-col", isHoje ? "border-primary" : "border-border")}>
      <div className={cn("px-3 py-2 border-b text-xs font-semibold flex items-center justify-between", isHoje ? "border-primary text-primary" : "border-border text-muted")}>
        <span>{label} {d.getDate()}</span>
        {lista.length > 0 && <span className="tabular-nums">{lista.length}</span>}
      </div>
      <div className="p-2 space-y-1.5 flex-1">
        {lista.map((o) => (
          <button key={o.id} onClick={() => onSel(o)}
            className="w-full text-left rounded-lg border border-border bg-surface-2 hover:bg-surface px-2 py-1.5 transition-colors cursor-pointer">
            <div className="flex items-center gap-1 text-[11px] text-muted">
              {o.hora_agendada && (<><Clock size={10} /> {o.hora_agendada.slice(0, 5)}</>)}
            </div>
            <div className="text-xs font-medium truncate">{o.cliente || o.linha_servico}</div>
            <div className="text-[11px] text-muted truncate">{o.equipe}</div>
            <div className="mt-1"><StatusBadge status={o.status} /></div>
          </button>
        ))}
      </div>
    </div>
  );
}
