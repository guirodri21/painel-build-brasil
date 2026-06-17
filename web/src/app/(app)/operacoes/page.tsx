"use client";

import * as React from "react";
import { useData } from "@/components/data-provider";
import { useFiltros } from "@/components/filters-provider";
import { FilterBar } from "@/components/filter-bar";
import { PageHeader } from "@/components/page-header";
import { KpiCard } from "@/components/kpi-card";
import { KpiSkeletonRow, Skeleton } from "@/components/ui/skeleton";
import { Card, CardHeader, CardTitle, CardBody } from "@/components/ui/card";
import { ValueBarChart, CHART_COLORS } from "@/components/charts";
import { OrdensTable } from "@/components/ordens-table";
import { OrdemModal } from "@/components/ordem-modal";
import { Button } from "@/components/ui/button";
import {
  applyFiltros,
  calcOps,
  tempoMedioPorEquipe,
  qualidadeMediaPorEquipe,
} from "@/lib/analytics";
import { Plus, Clock, Star, CheckCircle2, Loader } from "lucide-react";

export default function OperacoesPage() {
  const { ordens, loading } = useData();
  const { filtros } = useFiltros();
  const [novaOpen, setNovaOpen] = React.useState(false);

  const d = React.useMemo(() => applyFiltros(ordens, filtros), [ordens, filtros]);
  const op = calcOps(d);

  const tempo = Object.entries(tempoMedioPorEquipe(d))
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);
  const qualidade = Object.entries(qualidadeMediaPorEquipe(d))
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);

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
        <Button onClick={() => setNovaOpen(true)}>
          <Plus size={16} /> Nova Ordem
        </Button>
      </PageHeader>
      <FilterBar />

      <div className="grid gap-3 mb-5 grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Tempo Médio" value={op.tempoMedio.toFixed(1) + "h"} icon={Clock} />
        <KpiCard label="Qualidade Média" value={op.qualMedia.toFixed(0)} tone="teal" icon={Star} />
        <KpiCard label="Taxa Conclusão" value={op.taxaConc.toFixed(0) + "%"} tone="green" icon={CheckCircle2} />
        <KpiCard label="Em Andamento" value={op.andamento} tone={op.andamento > 0 ? "orange" : "default"} icon={Loader} />
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
      </div>

      <Card>
        <CardHeader><CardTitle>Registro de Ordens</CardTitle></CardHeader>
        <CardBody className="p-0">
          <OrdensTable ordens={d} />
        </CardBody>
      </Card>
      <p className="text-xs text-muted italic mt-2">
        Nota: obras grandes seguem cronograma próprio — tempos são estimativas registradas.
      </p>

      {novaOpen && <OrdemModal open={novaOpen} onClose={() => setNovaOpen(false)} />}
    </>
  );
}
