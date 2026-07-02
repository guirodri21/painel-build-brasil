"use client";

import * as React from "react";
import { useData } from "@/components/data-provider";
import { useFiltros } from "@/components/filters-provider";
import { KpiCard } from "@/components/kpi-card";
import { Select } from "@/components/ui/field";
import { FASE_PROPOSTA, FASE_APROVADA, FASE_RECUSADA, FASE_CONCLUIDO } from "@/lib/types";
import type { Chamado } from "@/lib/types";
import { formatCurrency, formatNumber } from "@/lib/utils";
import { sum } from "@/lib/analytics";
import { Send, BadgeCheck, XCircle, Layers, Clock } from "lucide-react";

function diasDesde(iso?: string | null): number {
  if (!iso) return 0;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return 0;
  return Math.max(0, Math.floor((Date.now() - d.getTime()) / 86400000));
}

/**
 * KPIs de propostas e demandas do Pipeline Comercial (Chamados):
 * valores das propostas enviadas/aprovadas/recusadas e tempo médio das
 * demandas em aberto, respeitando os filtros globais + filtro local de
 * responsável.
 */
export function VendasPropostasKpis() {
  const { chamados, chamadoFases } = useData();
  const { filtros } = useFiltros();
  const [responsavel, setResponsavel] = React.useState("");

  const responsaveis = React.useMemo(
    () =>
      Array.from(new Set(chamados.map((c) => (c.responsavel ?? "").trim()).filter(Boolean)))
        .sort((a, b) => a.localeCompare(b)),
    [chamados],
  );

  const kpis = React.useMemo(() => {
    const q = filtros.busca.toLowerCase();
    const dataDe = (c: Chamado) => (c.aberto_em ?? c.created_at ?? "").slice(0, 10);
    const d = chamados.filter((c) => {
      if (responsavel && (c.responsavel ?? "").trim() !== responsavel) return false;
      if (filtros.regiao && c.regiao !== filtros.regiao) return false;
      if (filtros.equipe && (c.equipe ?? "") !== filtros.equipe) return false;
      if (filtros.cliente && c.cliente !== filtros.cliente) return false;
      if (filtros.de && dataDe(c) < filtros.de) return false;
      if (filtros.ate && dataDe(c) > filtros.ate) return false;
      if (q) {
        const hay = [c.titulo, c.cliente, c.regiao, c.descricao, c.ticket_ref, c.responsavel]
          .filter(Boolean).join(" ").toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    const finais = new Set(chamadoFases.filter((f) => f.final).map((f) => f.nome));
    finais.add(FASE_CONCLUIDO);

    const recusada = (c: Chamado) => c.fase === FASE_RECUSADA || !!(c.motivo_perda ?? "").trim();
    // Aprovada: na fase de aprovação, ou concluída após envio de proposta sem registro de recusa
    // (ao salvar em "Proposta Aprovada"/"Proposta Recusada" o card vai para "Concluido").
    const aprovada = (c: Chamado) =>
      !recusada(c) && (c.fase === FASE_APROVADA || (finais.has(c.fase) && !!c.data_envio_proposta));

    const enviadas = d.filter((c) => c.fase === FASE_PROPOSTA);
    const aprovadas = d.filter(aprovada);
    const recusadas = d.filter(recusada);
    const abertas = d.filter((c) => !finais.has(c.fase));
    const tempoMedio = abertas.length
      ? abertas.reduce((acc, c) => acc + diasDesde(c.aberto_em ?? c.created_at), 0) / abertas.length
      : 0;

    return {
      enviadas: { n: enviadas.length, valor: sum(enviadas, (c) => c.valor) },
      // Valor aprovado líquido: desconto concedido na aprovação é abatido.
      aprovadas: { n: aprovadas.length, valor: sum(aprovadas, (c) => c.valor - (c.valor_desconto ?? 0)) },
      recusadas: { n: recusadas.length, valor: sum(recusadas, (c) => c.valor) },
      abertas: abertas.length,
      tempoMedio,
    };
  }, [chamados, chamadoFases, filtros, responsavel]);

  if (!chamados.length) return null;

  return (
    <div className="mb-5">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
        <h2 className="text-sm font-semibold text-muted">Propostas & Demandas (Pipeline Comercial)</h2>
        <label className="flex items-center gap-2 text-[11px] font-medium text-muted">
          Responsável
          <Select value={responsavel} onChange={(e) => setResponsavel(e.target.value)} className="min-w-[160px]">
            <option value="">Todos</option>
            {responsaveis.map((r) => <option key={r} value={r}>{r}</option>)}
          </Select>
        </label>
      </div>
      <div className="stagger grid gap-3 grid-cols-2 lg:grid-cols-5">
        <KpiCard
          label={`Propostas Enviadas (${formatNumber(kpis.enviadas.n)})`}
          value={kpis.enviadas.valor}
          format={(n) => formatCurrency(n)}
          tone="teal"
          icon={Send}
        />
        <KpiCard
          label={`Propostas Aprovadas (${formatNumber(kpis.aprovadas.n)})`}
          value={kpis.aprovadas.valor}
          format={(n) => formatCurrency(n)}
          tone="green"
          icon={BadgeCheck}
        />
        <KpiCard
          label={`Propostas Recusadas (${formatNumber(kpis.recusadas.n)})`}
          value={kpis.recusadas.valor}
          format={(n) => formatCurrency(n)}
          tone="red"
          icon={XCircle}
        />
        <KpiCard
          label="Demandas em aberto"
          value={kpis.abertas}
          format={(n) => formatNumber(n)}
          icon={Layers}
        />
        <KpiCard
          label="Tempo médio em aberto"
          value={kpis.tempoMedio}
          format={(n) => n.toFixed(1).replace(".", ",") + "d"}
          tone={kpis.tempoMedio > 15 ? "orange" : "default"}
          icon={Clock}
        />
      </div>
    </div>
  );
}
