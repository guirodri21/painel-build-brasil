"use client";

import * as React from "react";
import { createClient } from "@/lib/supabase/client";
import { KpiCard } from "@/components/kpi-card";
import { Card, CardHeader, CardTitle, CardBody } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { DOT, NOME_PIPELINE_OPERACIONAL } from "@/lib/quadros";
import { sum } from "@/lib/analytics";
import { formatCurrency, formatNumber, todayISO, cn } from "@/lib/utils";
import type { QuadroFase, QuadroCard } from "@/lib/types";
import { Layers, Wrench, AlertTriangle, CheckCheck, DollarSign, Clock } from "lucide-react";

function diasDesde(iso?: string | null): number {
  if (!iso) return 0;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return 0;
  return Math.max(0, Math.floor((Date.now() - d.getTime()) / 86400000));
}

/**
 * KPIs executivos do Pipeline Operacional (lê os cards do quadro homônimo).
 * Renderiza nada se o quadro ainda não existir neste ambiente.
 */
export function OperacaoPipelineKpis() {
  const [fases, setFases] = React.useState<QuadroFase[]>([]);
  const [cards, setCards] = React.useState<QuadroCard[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [semPipeline, setSemPipeline] = React.useState(false);

  React.useEffect(() => {
    let ativo = true;
    (async () => {
      const supabase = createClient();
      const { data: q } = await supabase
        .from("quadros").select("id")
        .eq("nome", NOME_PIPELINE_OPERACIONAL).eq("ativo", true).limit(1).maybeSingle();
      const quadroId = (q as { id: string } | null)?.id;
      if (!quadroId) { if (ativo) { setSemPipeline(true); setLoading(false); } return; }
      const [f, c] = await Promise.all([
        supabase.from("quadro_fases").select("*").eq("quadro_id", quadroId).order("ordem"),
        supabase.from("quadro_cards").select("*").eq("quadro_id", quadroId),
      ]);
      if (!ativo) return;
      setFases((f.data as QuadroFase[]) ?? []);
      setCards((c.data as QuadroCard[]) ?? []);
      setLoading(false);
    })();
    return () => { ativo = false; };
  }, []);

  const kpis = React.useMemo(() => {
    const finais = new Set(fases.filter((f) => f.final).map((f) => f.nome));
    const hoje = todayISO();
    const abertos = cards.filter((c) => !finais.has(c.fase));
    const emExecucao = abertos.filter((c) => /execu/i.test(c.fase));
    const atrasados = abertos.filter((c) => c.prazo && c.prazo < hoje);
    const concluidos = cards.filter((c) => finais.has(c.fase));
    const pipelineValor = sum(abertos, (c) => c.valor);
    const tempoMedio = abertos.length
      ? abertos.reduce((acc, c) => acc + diasDesde(c.fase_desde ?? c.created_at), 0) / abertos.length
      : 0;
    return { abertos: abertos.length, emExecucao: emExecucao.length, atrasados: atrasados.length, concluidos: concluidos.length, pipelineValor, tempoMedio };
  }, [cards, fases]);

  const funil = React.useMemo(() => {
    const m = new Map<string, { n: number; valor: number; cor: string }>();
    for (const f of fases) m.set(f.nome, { n: 0, valor: 0, cor: f.cor ?? "gray" });
    for (const c of cards) {
      const cur = m.get(c.fase) ?? { n: 0, valor: 0, cor: "gray" };
      cur.n++; cur.valor += c.valor; m.set(c.fase, cur);
    }
    return fases.map((f) => ({ nome: f.nome, ...(m.get(f.nome) ?? { n: 0, valor: 0, cor: "gray" }) }));
  }, [cards, fases]);

  if (semPipeline) return null;

  if (loading)
    return (
      <div className="mb-6">
        <h2 className="text-sm font-semibold text-muted mb-2">Operação (Pipeline)</h2>
        <Skeleton className="h-24 mb-3" />
        <Skeleton className="h-40" />
      </div>
    );

  const maxFunil = Math.max(1, ...funil.map((x) => x.n));

  return (
    <div className="mb-6">
      <h2 className="text-sm font-semibold text-muted mb-2">Operação (Pipeline)</h2>

      <div className="stagger grid gap-3 mb-4 grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <KpiCard label="Abertas" value={kpis.abertos} format={(n) => formatNumber(n)} tone="teal" icon={Layers} />
        <KpiCard label="Em Execução" value={kpis.emExecucao} format={(n) => formatNumber(n)} tone={kpis.emExecucao > 0 ? "orange" : "default"} icon={Wrench} />
        <KpiCard label="Atrasadas" value={kpis.atrasados} format={(n) => formatNumber(n)} tone={kpis.atrasados > 0 ? "red" : "default"} icon={AlertTriangle} />
        <KpiCard label="Concluídas" value={kpis.concluidos} format={(n) => formatNumber(n)} tone="green" icon={CheckCheck} />
        <KpiCard label="Pipeline (valor)" value={kpis.pipelineValor} format={(n) => formatCurrency(n)} tone="green" icon={DollarSign} />
        <KpiCard label="Tempo médio aberto" value={kpis.tempoMedio} format={(n) => n.toFixed(1) + "d"} icon={Clock} />
      </div>

      <Card>
        <CardHeader><CardTitle>Funil por fase</CardTitle></CardHeader>
        <CardBody className="space-y-2">
          {funil.every((x) => x.n === 0) ? (
            <p className="text-sm text-muted">Nenhuma demanda no Pipeline Operacional ainda.</p>
          ) : (
            funil.map((x) => (
              <div key={x.nome}>
                <div className="flex items-center justify-between text-xs mb-0.5">
                  <span className="truncate pr-2">{x.nome}</span>
                  <span className="text-muted tabular-nums shrink-0">{x.n}{x.valor > 0 ? ` · ${formatCurrency(x.valor)}` : ""}</span>
                </div>
                <div className="h-2 rounded-full bg-surface-2 overflow-hidden">
                  <div className={cn("h-full rounded-full", DOT[x.cor] ?? "bg-primary")} style={{ width: `${Math.max(2, (x.n / maxFunil) * 100)}%` }} />
                </div>
              </div>
            ))
          )}
        </CardBody>
      </Card>
    </div>
  );
}
