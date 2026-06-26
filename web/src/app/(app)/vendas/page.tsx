"use client";

import * as React from "react";
import { useData } from "@/components/data-provider";
import { useFiltros } from "@/components/filters-provider";
import { FilterBar } from "@/components/filter-bar";
import { PageHeader } from "@/components/page-header";
import { KpiCard } from "@/components/kpi-card";
import { KpiSkeletonRow, Skeleton } from "@/components/ui/skeleton";
import { Card, CardHeader, CardTitle, CardBody } from "@/components/ui/card";
import { HBarChart, DonutChart, CHART_COLORS } from "@/components/charts";
import { applyFiltros, calcVendas, groupBy, sum } from "@/lib/analytics";
import { formatCurrency } from "@/lib/utils";
import { DollarSign, Receipt, ClipboardList } from "lucide-react";

export default function VendasPage() {
  const { ordens, loading } = useData();
  const { filtros } = useFiltros();
  const d = React.useMemo(() => applyFiltros(ordens, filtros), [ordens, filtros]);
  const v = calcVendas(d);

  const byField = (field: (o: typeof d[number]) => string) =>
    Object.entries(groupBy(d, field))
      .map(([name, items]) => ({ name, value: sum(items, (o) => o.valor_venda) }))
      .sort((a, b) => b.value - a.value);

  const porRegiao = byField((o) => o.regiao);
  const porEquipe = byField((o) => o.equipe);
  const porLinha = byField((o) => o.linha_servico);

  if (loading)
    return (
      <>
        <PageHeader title="Performance Comercial" />
        <Skeleton className="h-16 mb-5" />
        <KpiSkeletonRow count={3} />
        <Skeleton className="h-80" />
      </>
    );

  return (
    <>
      <PageHeader title="Performance Comercial" subtitle="Indicadores de desempenho comercial por dimensão" />
      <FilterBar />

      <div className="stagger grid gap-3 mb-5 grid-cols-2 lg:grid-cols-3">
        <KpiCard label="Total de Vendas" value={v.total} format={(n) => formatCurrency(n)} icon={DollarSign} />
        <KpiCard label="Ticket Médio" value={v.ticket} format={(n) => formatCurrency(n)} tone="teal" icon={Receipt} />
        <KpiCard label="Nº de Ordens" value={v.n} format={(n) => Math.round(n).toString()} icon={ClipboardList} />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Vendas por Região</CardTitle></CardHeader>
          <CardBody><DonutChart data={porRegiao} /></CardBody>
        </Card>
        <Card>
          <CardHeader><CardTitle>Vendas por Equipe</CardTitle></CardHeader>
          <CardBody><HBarChart data={porEquipe} color={CHART_COLORS[1]} /></CardBody>
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>Vendas por Linha de Serviço</CardTitle></CardHeader>
          <CardBody><HBarChart data={porLinha} color={CHART_COLORS[2]} /></CardBody>
        </Card>
      </div>
    </>
  );
}
