"use client";

import * as React from "react";
import { useData } from "@/components/data-provider";
import { useFiltros } from "@/components/filters-provider";
import { useToast } from "@/components/ui/toast";
import { FilterBar } from "@/components/filter-bar";
import { PageHeader } from "@/components/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardHeader, CardTitle, CardBody } from "@/components/ui/card";
import { OrdensTable } from "@/components/ordens-table";
import { OrdensCards } from "@/components/ordens-cards";
import { OrdensKanban } from "@/components/ordens-kanban";
import { OrdemModal } from "@/components/ordem-modal";
import { Button } from "@/components/ui/button";
import { exportOrdensCSV } from "@/lib/export";
import { applyFiltros } from "@/lib/analytics";
import { cn } from "@/lib/utils";
import { Plus, FileSpreadsheet, Table2, LayoutGrid, Columns3 } from "lucide-react";

type View = "tabela" | "cards" | "kanban";

const VIEWS: { id: View; label: string; icon: React.ComponentType<{ size?: number }> }[] = [
  { id: "tabela", label: "Tabela", icon: Table2 },
  { id: "cards", label: "Cards", icon: LayoutGrid },
  { id: "kanban", label: "Kanban", icon: Columns3 },
];

export default function PipelineOperacionalPage() {
  const { ordens, loading } = useData();
  const { filtros } = useFiltros();
  const toast = useToast();
  const [novaOpen, setNovaOpen] = React.useState(false);
  const [view, setView] = React.useState<View>("kanban");

  const d = React.useMemo(() => applyFiltros(ordens, filtros), [ordens, filtros]);

  function handleCSV() {
    if (!d.length) { toast("Sem dados para exportar.", "error"); return; }
    exportOrdensCSV(d);
    toast("CSV exportado.");
  }

  if (loading)
    return (
      <>
        <PageHeader title="Pipeline Operacional" />
        <Skeleton className="h-16 mb-5" />
        <Skeleton className="h-96" />
      </>
    );

  return (
    <>
      <PageHeader title="Pipeline Operacional" subtitle="Fluxo de execução das ordens — registro e board">
        <Button variant="secondary" onClick={handleCSV}>
          <FileSpreadsheet size={16} /> Exportar CSV
        </Button>
        <Button onClick={() => setNovaOpen(true)}>
          <Plus size={16} /> Nova Ordem
        </Button>
      </PageHeader>
      <FilterBar />

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

      {novaOpen && <OrdemModal open={novaOpen} onClose={() => setNovaOpen(false)} />}
    </>
  );
}
