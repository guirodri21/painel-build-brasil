"use client";

import * as React from "react";
import { useData } from "@/components/data-provider";
import { useFiltros } from "@/components/filters-provider";
import { FilterBar } from "@/components/filter-bar";
import { PageHeader } from "@/components/page-header";
import { KpiCard } from "@/components/kpi-card";
import { KpiSkeletonRow, Skeleton } from "@/components/ui/skeleton";
import { Card, CardHeader, CardTitle, CardBody } from "@/components/ui/card";
import { BalancoChart } from "@/components/charts";
import { DespesaModal } from "@/components/despesa-modal";
import { Button } from "@/components/ui/button";
import {
  applyFiltros,
  calcRateio,
  balancoMensal,
  sum,
} from "@/lib/analytics";
import { formatCurrency, formatPercent, monthLabel, cn } from "@/lib/utils";
import { Plus, DollarSign, TrendingDown, Wallet, Percent } from "lucide-react";

export default function FinanceiroPage() {
  const { ordens, despesas, equipes, loading } = useData();
  const { filtros } = useFiltros();
  const [despOpen, setDespOpen] = React.useState(false);

  const d = React.useMemo(() => applyFiltros(ordens, filtros), [ordens, filtros]);
  const { res, recTotal, despTotal } = calcRateio(d, despesas, equipes);
  const ddTotal = sum(d, (o) => o.despesa_direta);
  const saldo = recTotal - ddTotal - despTotal;
  const margem = recTotal > 0 ? (saldo / recTotal) * 100 : 0;

  const balanco = balancoMensal(d, despesas).map((b) => ({
    ...b,
    mes: monthLabel(b.mes),
  }));

  if (loading)
    return (
      <>
        <PageHeader title="Financeiro" />
        <Skeleton className="h-16 mb-5" />
        <KpiSkeletonRow count={5} />
        <Skeleton className="h-80" />
      </>
    );

  return (
    <>
      <PageHeader title="Financeiro" subtitle="Balanço, rateio e margem por equipe">
        <Button variant="secondary" onClick={() => setDespOpen(true)}>
          <Plus size={16} /> Nova Despesa
        </Button>
      </PageHeader>
      <FilterBar />

      <div className="stagger grid gap-3 mb-5 grid-cols-2 lg:grid-cols-5">
        <KpiCard label="Receita" value={recTotal} format={(n) => formatCurrency(n)} icon={DollarSign} />
        <KpiCard label="Despesas Totais" value={ddTotal + despTotal} format={(n) => formatCurrency(n)} tone="orange" icon={TrendingDown} />
        <KpiCard label="Saldo" value={saldo} format={(n) => formatCurrency(n)} tone={saldo >= 0 ? "green" : "red"} icon={Wallet} />
        <KpiCard label="Margem" value={margem} format={(n) => formatPercent(n)} tone={margem >= 0 ? "green" : "red"} icon={Percent} />
        <KpiCard label="Desp. Gerais" value={despTotal} format={(n) => formatCurrency(n)} tone="teal" icon={TrendingDown} />
      </div>

      <Card className="mb-5">
        <CardHeader><CardTitle>Balanço Mensal</CardTitle></CardHeader>
        <CardBody><BalancoChart data={balanco} /></CardBody>
      </Card>

      <Card>
        <CardHeader><CardTitle>Resultado por Equipe (Rateio)</CardTitle></CardHeader>
        <CardBody className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left">
                  <Th>Equipe</Th>
                  <Th className="text-right">Receita</Th>
                  <Th className="text-right">Desp. Direta</Th>
                  <Th className="text-right">Desp. Rateada</Th>
                  <Th className="text-right">Saldo</Th>
                  <Th className="text-right">Margem</Th>
                </tr>
              </thead>
              <tbody>
                {equipes.map((eq) => {
                  const x = res[eq];
                  return (
                    <tr key={eq} className="border-b border-border last:border-0 hover:bg-surface-2 transition-colors">
                      <Td className="font-semibold">{eq}</Td>
                      <Td className="text-right">{formatCurrency(x.rec)}</Td>
                      <Td className="text-right">{formatCurrency(x.dd)}</Td>
                      <Td className="text-right">{formatCurrency(x.dr)}</Td>
                      <Td className={cn("text-right font-semibold", x.saldo >= 0 ? "text-green" : "text-red")}>
                        {formatCurrency(x.saldo)}
                      </Td>
                      <Td className={cn("text-right", x.margem >= 0 ? "text-green" : "text-red")}>
                        {x.rec > 0 ? formatPercent(x.margem) : "—"}
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardBody>
      </Card>
      <p className="text-xs text-muted italic mt-2">
        Rateio: despesas diretas por equipe; despesas gerais proporcionais à receita. Validar com financeiro.
      </p>

      {despOpen && <DespesaModal open={despOpen} onClose={() => setDespOpen(false)} />}
    </>
  );
}

function Th({ children, className }: { children: React.ReactNode; className?: string }) {
  return <th className={cn("px-4 py-3 text-xs font-semibold text-muted uppercase tracking-wide whitespace-nowrap", className)}>{children}</th>;
}
function Td({ children, className }: { children: React.ReactNode; className?: string }) {
  return <td className={cn("px-4 py-3", className)}>{children}</td>;
}
