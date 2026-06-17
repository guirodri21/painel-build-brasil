"use client";

import * as React from "react";
import { useData } from "@/components/data-provider";
import { useToast } from "@/components/ui/toast";
import { PageHeader } from "@/components/page-header";
import { Card, CardHeader, CardTitle, CardBody } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Select, Label } from "@/components/ui/field";
import { groupBy, sum } from "@/lib/analytics";
import { exportOrdensCSV } from "@/lib/export";
import { formatCurrency, formatPercent, monthLabel, cn } from "@/lib/utils";
import { FileSpreadsheet, Printer, TrendingUp, TrendingDown, Minus } from "lucide-react";

export default function RelatoriosPage() {
  const { ordens, loading } = useData();
  const toast = useToast();

  const meses = React.useMemo(() => {
    const set = new Set(ordens.map((o) => o.data.substring(0, 7)));
    return Array.from(set).sort().reverse();
  }, [ordens]);

  const [mesA, setMesA] = React.useState("");
  const [mesB, setMesB] = React.useState("");

  React.useEffect(() => {
    if (meses.length && !mesA) {
      setMesA(meses[0]);
      setMesB(meses[1] ?? meses[0]);
    }
  }, [meses, mesA]);

  const receitaPorEquipe = React.useCallback(
    (mes: string) => {
      const items = ordens.filter((o) => o.data.substring(0, 7) === mes);
      const by = groupBy(items, (o) => o.equipe);
      const out: Record<string, number> = {};
      for (const [eq, arr] of Object.entries(by)) out[eq] = sum(arr, (o) => o.valor_venda);
      return out;
    },
    [ordens],
  );

  const compA = receitaPorEquipe(mesA);
  const compB = receitaPorEquipe(mesB);
  const equipesComp = Array.from(new Set([...Object.keys(compA), ...Object.keys(compB)])).sort();

  const totalA = Object.values(compA).reduce((s, v) => s + v, 0);
  const totalB = Object.values(compB).reduce((s, v) => s + v, 0);

  function handlePrint() {
    window.print();
  }

  function handleCSV() {
    if (!ordens.length) { toast("Sem dados para exportar.", "error"); return; }
    exportOrdensCSV(ordens);
    toast("CSV exportado.");
  }

  if (loading)
    return (
      <>
        <PageHeader title="Relatórios" />
        <Skeleton className="h-96" />
      </>
    );

  return (
    <>
      <PageHeader title="Relatórios" subtitle="Comparativo de períodos e exportação de dados">
        <Button variant="secondary" onClick={handleCSV}>
          <FileSpreadsheet size={16} /> Exportar CSV
        </Button>
        <Button variant="secondary" onClick={handlePrint}>
          <Printer size={16} /> Imprimir / PDF
        </Button>
      </PageHeader>

      <Card>
        <CardHeader><CardTitle>Comparativo de Receita por Equipe</CardTitle></CardHeader>
        <CardBody>
          {meses.length ? (
            <>
              <div className="flex flex-wrap gap-4 mb-5">
                <div>
                  <Label>Período A</Label>
                  <Select value={mesA} onChange={(e) => setMesA(e.target.value)} className="min-w-[150px]">
                    {meses.map((m) => <option key={m} value={m}>{monthLabel(m)}</option>)}
                  </Select>
                </div>
                <div>
                  <Label>Período B (comparar)</Label>
                  <Select value={mesB} onChange={(e) => setMesB(e.target.value)} className="min-w-[150px]">
                    {meses.map((m) => <option key={m} value={m}>{monthLabel(m)}</option>)}
                  </Select>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left">
                      <Th>Equipe</Th>
                      <Th className="text-right">{monthLabel(mesA)}</Th>
                      <Th className="text-right">{monthLabel(mesB)}</Th>
                      <Th className="text-right">Variação</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {equipesComp.map((eq) => {
                      const a = compA[eq] ?? 0;
                      const b = compB[eq] ?? 0;
                      const delta = b > 0 ? ((a - b) / b) * 100 : a > 0 ? 100 : 0;
                      return (
                        <tr key={eq} className="border-b border-border last:border-0 hover:bg-surface-2 transition-colors">
                          <Td className="font-semibold">{eq}</Td>
                          <Td className="text-right">{formatCurrency(a)}</Td>
                          <Td className="text-right text-muted">{formatCurrency(b)}</Td>
                          <Td className="text-right"><Delta value={delta} /></Td>
                        </tr>
                      );
                    })}
                    <tr className="border-t-2 border-border font-semibold">
                      <Td>Total</Td>
                      <Td className="text-right">{formatCurrency(totalA)}</Td>
                      <Td className="text-right text-muted">{formatCurrency(totalB)}</Td>
                      <Td className="text-right">
                        <Delta value={totalB > 0 ? ((totalA - totalB) / totalB) * 100 : 0} />
                      </Td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <p className="text-sm text-muted py-8 text-center">Sem dados para gerar relatórios.</p>
          )}
        </CardBody>
      </Card>
    </>
  );
}

function Delta({ value }: { value: number }) {
  const neutral = Math.abs(value) < 0.05;
  return (
    <span className={cn(
      "inline-flex items-center gap-1 font-medium tabular-nums",
      neutral ? "text-muted" : value > 0 ? "text-green" : "text-red",
    )}>
      {neutral ? <Minus size={13} /> : value > 0 ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
      {formatPercent(Math.abs(value), 0)}
    </span>
  );
}

function Th({ children, className }: { children: React.ReactNode; className?: string }) {
  return <th className={cn("px-4 py-3 text-xs font-semibold text-muted uppercase tracking-wide whitespace-nowrap", className)}>{children}</th>;
}
function Td({ children, className }: { children: React.ReactNode; className?: string }) {
  return <td className={cn("px-4 py-3", className)}>{children}</td>;
}
