"use client";

import * as React from "react";
import { useData } from "@/components/data-provider";
import { useFiltros } from "@/components/filters-provider";
import { FilterBar } from "@/components/filter-bar";
import { PageHeader } from "@/components/page-header";
import { KpiCard } from "@/components/kpi-card";
import { KpiSkeletonRow, Skeleton } from "@/components/ui/skeleton";
import { Card, CardHeader, CardTitle, CardBody } from "@/components/ui/card";
import { QualityBar } from "@/components/quality-bar";
import {
  applyFiltros,
  calcVendas,
  calcOps,
  calcRateio,
  previousPeriod,
  calcDelta,
  sum,
} from "@/lib/analytics";
import { formatCurrency } from "@/lib/utils";
import { DollarSign, Wallet, ClipboardList, Star, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

export default function VisaoGeralPage() {
  const { ordens, despesas, equipes, loading } = useData();
  const { filtros } = useFiltros();

  const d = React.useMemo(() => applyFiltros(ordens, filtros), [ordens, filtros]);
  const v = calcVendas(d);
  const op = calcOps(d);
  const { res, recTotal, despTotal } = calcRateio(d, despesas, equipes);
  const saldo = recTotal - sum(d, (o) => o.despesa_direta) - despTotal;

  // Tendências vs período anterior (só quando há período explícito selecionado)
  const trends = React.useMemo(() => {
    if (!filtros.de || !filtros.ate) return null;
    const prev = previousPeriod(filtros);
    const dp = applyFiltros(ordens, { ...filtros, de: prev.de, ate: prev.ate });
    const rp = calcRateio(dp, despesas, equipes);
    const saldoP = rp.recTotal - sum(dp, (o) => o.despesa_direta) - rp.despTotal;
    const mk = (val: number | null) => (val == null ? undefined : { value: val, label: "vs ant." });
    return {
      receita: mk(calcDelta(recTotal, rp.recTotal)),
      saldo: mk(calcDelta(saldo, saldoP)),
      ordens: mk(calcDelta(d.length, dp.length)),
    };
  }, [ordens, despesas, equipes, filtros, recTotal, saldo, d.length]);

  const alerts = React.useMemo(() => {
    const out: { tone: string; text: string }[] = [];
    const entries = Object.entries(res).filter(([, x]) => x.n > 0);
    if (entries.length) {
      const lider = [...entries].sort((a, b) => b[1].saldo - a[1].saldo)[0];
      out.push({ tone: "green", text: `Equipe líder: ${lider[0]} (${formatCurrency(lider[1].saldo)})` });
      entries.forEach(([eq, x]) => {
        if (x.saldo < 0)
          out.push({ tone: "red", text: `${eq}: saldo negativo (${formatCurrency(x.saldo)})` });
      });
    }
    if (op.qualMedia > 0 && op.qualMedia < 80)
      out.push({ tone: "yellow", text: `Qualidade geral abaixo de 80 (${op.qualMedia.toFixed(0)})` });
    if (op.andamento > 3)
      out.push({ tone: "yellow", text: `${op.andamento} ordens em aberto` });
    return out;
  }, [res, op]);

  if (loading) return <LoadingState />;

  return (
    <>
      <PageHeader title="Visão Geral" subtitle="Resumo consolidado dos resultados" />
      <FilterBar />

      {ordens.length === 0 && (
        <Card className="mb-5">
          <CardBody>
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <ClipboardList size={36} className="text-muted mb-3" />
              <p className="font-semibold mb-1">Tudo pronto para começar</p>
              <p className="text-sm text-muted max-w-md">
                Ainda não há ordens registradas. Cadastre a primeira em <strong>Operações</strong> —
                os indicadores e gráficos serão preenchidos automaticamente.
              </p>
            </div>
          </CardBody>
        </Card>
      )}

      <div className="stagger grid gap-3 mb-5 grid-cols-2 lg:grid-cols-5">
        <KpiCard label="Receita Total" value={recTotal} format={(n) => formatCurrency(n)} icon={DollarSign} trend={trends?.receita} />
        <KpiCard label="Saldo Geral" value={saldo} format={(n) => formatCurrency(n)} tone={saldo >= 0 ? "green" : "red"} icon={Wallet} trend={trends?.saldo} />
        <KpiCard label="Ordens" value={v.n} format={(n) => Math.round(n).toString()} tone="teal" icon={ClipboardList} trend={trends?.ordens} />
        <KpiCard label="Qualidade Média" value={op.qualMedia} format={(n) => n.toFixed(0)} tone={op.qualMedia < 80 ? "orange" : "teal"} icon={Star} />
        <KpiCard label="Em Andamento" value={op.andamento} format={(n) => Math.round(n).toString()} tone={op.andamento > 0 ? "orange" : "default"} icon={Clock} />
      </div>

      <Card className="mb-5">
        <CardHeader><CardTitle>Resumo Executivo</CardTitle></CardHeader>
        <CardBody>
          {alerts.length ? (
            <div className="flex flex-wrap gap-2">
              {alerts.map((a, i) => (
                <span
                  key={i}
                  className={cn(
                    "rounded-lg px-3 py-1.5 text-xs font-medium",
                    a.tone === "green" && "bg-green-soft text-green",
                    a.tone === "yellow" && "bg-yellow-soft text-yellow",
                    a.tone === "red" && "bg-red-soft text-red",
                  )}
                >
                  {a.text}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted">Nenhum alerta no período.</p>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader><CardTitle>Resultado por Equipe</CardTitle></CardHeader>
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
                  <Th className="text-right">Ordens</Th>
                  <Th>Qualidade</Th>
                </tr>
              </thead>
              <tbody>
                {equipes.length === 0 && (
                  <tr><td colSpan={7} className="text-center py-12 text-muted text-sm">
                    Nenhuma equipe cadastrada. Adicione equipes em <strong>Cadastros</strong> para começar.
                  </td></tr>
                )}
                {equipes.map((eq) => {
                  const x = res[eq];
                  const qmItems = d.filter((o) => o.equipe === eq && o.qualidade != null);
                  const qm = qmItems.length
                    ? sum(qmItems, (o) => o.qualidade!) / qmItems.length
                    : null;
                  return (
                    <tr key={eq} className="border-b border-border last:border-0 hover:bg-surface-2 transition-colors">
                      <Td className="font-semibold">{eq}</Td>
                      <Td className="text-right">{formatCurrency(x.rec)}</Td>
                      <Td className="text-right">{formatCurrency(x.dd)}</Td>
                      <Td className="text-right">{formatCurrency(x.dr)}</Td>
                      <Td className={cn("text-right font-semibold", x.saldo >= 0 ? "text-green" : "text-red")}>
                        {formatCurrency(x.saldo)}
                      </Td>
                      <Td className="text-right">{x.n}</Td>
                      <Td>{qm != null ? <QualityBar value={qm} /> : "—"}</Td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardBody>
      </Card>
    </>
  );
}

function Th({ children, className }: { children: React.ReactNode; className?: string }) {
  return <th className={cn("px-4 py-3 text-xs font-semibold text-muted uppercase tracking-wide", className)}>{children}</th>;
}
function Td({ children, className }: { children: React.ReactNode; className?: string }) {
  return <td className={cn("px-4 py-3", className)}>{children}</td>;
}

function LoadingState() {
  return (
    <>
      <PageHeader title="Visão Geral" subtitle="Resumo consolidado dos resultados" />
      <Skeleton className="h-16 mb-5" />
      <KpiSkeletonRow count={5} />
      <Skeleton className="h-32 mb-5" />
      <Skeleton className="h-64" />
    </>
  );
}
