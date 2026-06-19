"use client";

import * as React from "react";
import { useData } from "@/components/data-provider";
import { PageHeader } from "@/components/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/badge";
import { OrdemModal } from "@/components/ordem-modal";
import { cn } from "@/lib/utils";
import type { Ordem } from "@/lib/types";
import { ChevronLeft, ChevronRight, Plus, Clock } from "lucide-react";

const DIAS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

function inicioSemana(d: Date): Date {
  const x = new Date(d);
  const dow = (x.getDay() + 6) % 7; // 0 = segunda
  x.setDate(x.getDate() - dow);
  x.setHours(0, 0, 0, 0);
  return x;
}
function iso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function AgendaPage() {
  const { ordens, loading } = useData();
  const [ref, setRef] = React.useState(() => inicioSemana(new Date()));
  const [sel, setSel] = React.useState<Ordem | null>(null);
  const [novo, setNovo] = React.useState(false);

  const dias = React.useMemo(
    () => Array.from({ length: 7 }, (_, i) => {
      const d = new Date(ref);
      d.setDate(d.getDate() + i);
      return d;
    }),
    [ref],
  );

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

  const hojeIso = iso(new Date());
  const semanaLabel = `${dias[0].toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })} – ${dias[6].toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}`;
  const totalSemana = dias.reduce((s, d) => s + (porDia.get(iso(d))?.length ?? 0), 0);

  function mover(semanas: number) {
    const d = new Date(ref);
    d.setDate(d.getDate() + semanas * 7);
    setRef(d);
  }

  if (loading)
    return (<><PageHeader title="Agenda" /><Skeleton className="h-96" /></>);

  return (
    <>
      <PageHeader title="Agenda" subtitle="Ordens agendadas por dia">
        <Button onClick={() => setNovo(true)}><Plus size={16} /> Nova Ordem</Button>
      </PageHeader>

      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="icon" onClick={() => mover(-1)} aria-label="Semana anterior"><ChevronLeft size={16} /></Button>
          <Button variant="secondary" size="sm" onClick={() => setRef(inicioSemana(new Date()))}>Hoje</Button>
          <Button variant="secondary" size="icon" onClick={() => mover(1)} aria-label="Próxima semana"><ChevronRight size={16} /></Button>
          <span className="text-sm font-medium ml-2">{semanaLabel}</span>
        </div>
        <span className="text-xs text-muted">{totalSemana} agendamento(s)</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-2">
        {dias.map((d, i) => {
          const di = iso(d);
          const lista = porDia.get(di) ?? [];
          const isHoje = di === hojeIso;
          return (
            <div key={di} className={cn("rounded-xl border bg-surface min-h-[140px] flex flex-col", isHoje ? "border-primary" : "border-border")}>
              <div className={cn("px-3 py-2 border-b text-xs font-semibold flex items-center justify-between", isHoje ? "border-primary text-primary" : "border-border text-muted")}>
                <span>{DIAS[i]} {d.getDate()}</span>
                {lista.length > 0 && <span className="tabular-nums">{lista.length}</span>}
              </div>
              <div className="p-2 space-y-1.5 flex-1">
                {lista.map((o) => (
                  <button key={o.id} onClick={() => setSel(o)}
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
        })}
      </div>

      {sel && <OrdemModal open={!!sel} ordem={sel} onClose={() => setSel(null)} />}
      {novo && <OrdemModal open={novo} onClose={() => setNovo(false)} />}
    </>
  );
}
