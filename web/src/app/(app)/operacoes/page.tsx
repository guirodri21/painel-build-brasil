"use client";

import * as React from "react";
import { useData } from "@/components/data-provider";
import { useFiltros } from "@/components/filters-provider";
import { useToast } from "@/components/ui/toast";
import { FilterBar } from "@/components/filter-bar";
import { PageHeader } from "@/components/page-header";
import { KpiCard } from "@/components/kpi-card";
import { KpiSkeletonRow, Skeleton } from "@/components/ui/skeleton";
import { Card, CardHeader, CardTitle, CardBody } from "@/components/ui/card";
import { ValueBarChart, DonutChart, CHART_COLORS } from "@/components/charts";
import { OrdensTable } from "@/components/ordens-table";
import { OrdensCards } from "@/components/ordens-cards";
import { OrdensKanban } from "@/components/ordens-kanban";
import { OrdemModal } from "@/components/ordem-modal";
import { Button } from "@/components/ui/button";
import { exportOrdensCSV } from "@/lib/export";
import {
  applyFiltros,
  calcOps,
  calcVendas,
  tempoMedioPorEquipe,
  qualidadeMediaPorEquipe,
  taxaConclusaoPorEquipe,
  statusDistribution,
} from "@/lib/analytics";
import { cn } from "@/lib/utils";
import {
  Plus, Clock, Star, CheckCircle2, Loader, Receipt, CheckCheck,
  CalendarDays, FileSpreadsheet, Table2, LayoutGrid, Columns3,
} from "lucide-react";

type View = "tabela" | "cards" | "kanban";

const VIEWS: { id: View; label: string; icon: React.ComponentType<{ size?: number }> }[] = [
  { id: "tabela", label: "Tabela", icon: Table2 },
  { id: "cards", label: "Cards", icon: LayoutGrid },
  { id: "kanban", label: "Kanban", icon: Columns3 },
];

export default function OperacoesPage() {
  const { ordens, loading } = useData();
  const { filtros } = useFiltros();
  const toast = useToast();
  const [novaOpen, setNovaOpen] = React.useState(false);
  const [view, setView] = React.useState<View>("tabela");

  const d = React.useMemo(() => applyFiltros(ordens, filtros), [ordens, filtros]);
  const op = calcOps(d);
  const vendas = calcVendas(d);

  const diasDistintos = new Set(d.map((o) => o.data)).size;
  const ordensPorDia = diasDistintos ? d.length / diasDistintos : 0;
  const pctParcial = d.length
    ? (d.filter((o) => o.status === "execucao_parcial").length / d.length) * 100
    : 0;

  const tempo = Object.entries(tempoMedioPorEquipe(d))
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);
  const qualidade = Object.entries(qualidadeMediaPorEquipe(d))
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);
  const taxaConc = Object.entries(taxaConclusaoPorEquipe(d))
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);
  const porStatus = statusDistribution(d);

  function handleCSV() {
    if (!d.length) { toast("Sem dados para exportar.", "error"); return; }
    exportOrdensCSV(d);
    toast("CSV exportado.");
  }

  if (loading)
    return (
      <>
        <PageHeader title="Operações" />
        <Skeleton className="h-16 mb-5" />
        <KpiSkeletonRow />
        <Skeleton className="h-96" />
      </>
    );

  return (
    <>
      <PageHeader title="Operações" subtitle="Execução, qualidade e registro de ordens">
        <Button variant="secondary" onClick={handleCSV}>
          <FileSpreadsheet size={16} /> Exportar CSV
        </Button>
        <Button onClick={() => setNovaOpen(true)}>
          <Plus size={16} /> Nova Ordem
        </Button>
      </PageHeader>
      <FilterBar />

      <div className="grid gap-3 mb-5 grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
        <KpiCard label="Tempo Médio" value={op.tempoMedio.toFixed(1) + "h"} icon={Clock} />
        <KpiCard label="Qualidade Média" value={op.qualMedia.toFixed(0)} tone="teal" icon={Star} />
        <KpiCard label="Taxa Conclusão" value={op.taxaConc.toFixed(0) + "%"} tone="green" icon={CheckCircle2} />
        <KpiCard label="Em Andamento" value={op.andamento} tone={op.andamento > 0 ? "orange" : "default"} icon={Loader} />
        <KpiCard label="Concluídas" value={op.concluidas} tone="green" icon={CheckCheck} />
        <KpiCard label="Ticket Médio" value={vendas.ticket.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 })} icon={Receipt} />
        <KpiCard label="Ordens/dia" value={ordensPorDia.toFixed(1).replace(".", ",")} tone="teal" icon={CalendarDays} />
      </div>

      <div className="grid gap-5 lg:grid-cols-2 mb-5">
        <Card>
          <CardHeader><CardTitle>Tempo Médio de Execução por Equipe (h)</CardTitle></CardHeader>
          <CardBody><ValueBarChart data={tempo} suffix="h" color={CHART_COLORS[1]} /></CardBody>
        </Card>
        <Card>
          <CardHeader><CardTitle>Qualidade Técnica por Equipe (0–100)</CardTitle></CardHeader>
          <CardBody><ValueBarChart data={qualidade} color={CHART_COLORS[2]} /></CardBody>
        </Card>
        <Card>
          <CardHeader><CardTitle>Taxa de Conclusão por Equipe (%)</CardTitle></CardHeader>
          <CardBody><ValueBarChart data={taxaConc} suffix="%" color={CHART_COLORS[0]} /></CardBody>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Distribuição por Status</CardTitle>
            <span className="text-xs text-muted">Exec. parcial: {pctParcial.toFixed(0)}%</span>
          </CardHeader>
          <CardBody><DonutChart data={porStatus} /></CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Registro de Ordens</CardTitle>
          <div className="flex gap-1 rounded-lg border border-border p-0.5">
            {VIEWS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setView(id)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer",
                  view === id ? "bg-primary-soft text-primary" : "text-muted hover:text-foreground",
                )}
                title={label}
              >
                <Icon size={14} /> {label}
              </button>
            ))}
          </div>
        </CardHeader>
        <CardBody className={view === "tabela" ? "p-0" : undefined}>
          {view === "tabela" && <OrdensTable ordens={d} />}
          {view === "cards" && <OrdensCards ordens={d} />}
          {view === "kanban" && <OrdensKanban ordens={d} />}
        </CardBody>
      </Card>
      <p className="text-xs text-muted italic mt-2">
        Nota: obras grandes seguem cronograma próprio — tempos são estimativas registradas.
      </p>

      {novaOpen && <OrdemModal open={novaOpen} onClose={() => setNovaOpen(false)} />}
    </>
  );
}
