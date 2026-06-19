"use client";

import * as React from "react";
import { createClient } from "@/lib/supabase/client";
import { useData } from "@/components/data-provider";
import { useFiltros } from "@/components/filters-provider";
import { FilterBar } from "@/components/filter-bar";
import { PageHeader } from "@/components/page-header";
import { KpiCard } from "@/components/kpi-card";
import { KpiSkeletonRow, Skeleton } from "@/components/ui/skeleton";
import { Card, CardBody } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { applyFiltros, calcRateio } from "@/lib/analytics";
import { formatCurrency, cn } from "@/lib/utils";
import type { ComissaoRegra } from "@/lib/types";
import { Percent, Wallet } from "lucide-react";

export default function ComissoesPage() {
  const { ordens, despesas, equipes, loading } = useData();
  const { filtros } = useFiltros();
  const supabase = React.useMemo(() => createClient(), []);
  const [regras, setRegras] = React.useState<ComissaoRegra[]>([]);

  React.useEffect(() => {
    supabase.from("comissao_regras").select("*").then(({ data }) => setRegras((data as ComissaoRegra[]) ?? []));
  }, [supabase]);

  const d = React.useMemo(() => applyFiltros(ordens, filtros), [ordens, filtros]);
  const { res } = calcRateio(d, despesas, equipes);
  const regraDe = React.useMemo(() => new Map(regras.map((r) => [r.equipe, r])), [regras]);

  const linhas = equipes.map((eq) => {
    const r = regraDe.get(eq);
    const x = res[eq];
    const base = r?.base === "margem" ? x.saldo : x.rec;
    const comissao = r ? (base * r.percentual) / 100 : 0;
    return { eq, regra: r, baseValor: base, comissao, rec: x.rec, saldo: x.saldo };
  });

  const totalComissao = linhas.reduce((s, l) => s + l.comissao, 0);
  const totalBase = linhas.reduce((s, l) => s + (l.regra ? l.baseValor : 0), 0);

  if (loading)
    return (<><PageHeader title="Comissões" /><KpiSkeletonRow count={2} /><Skeleton className="h-80" /></>);

  return (
    <>
      <PageHeader title="Comissões" subtitle="Cálculo por equipe (configure as regras em Cadastros)" />
      <FilterBar />

      <div className="stagger grid gap-3 mb-5 grid-cols-2">
        <KpiCard label="Base de cálculo" value={totalBase} format={formatCurrency} tone="teal" icon={Wallet} />
        <KpiCard label="Comissão total" value={totalComissao} format={formatCurrency} tone="green" icon={Percent} />
      </div>

      <Card>
        <CardBody className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left">
                  <Th>Equipe</Th><Th>Regra</Th><Th className="text-right">Receita</Th><Th className="text-right">Margem</Th><Th className="text-right">Base</Th><Th className="text-right">Comissão</Th>
                </tr>
              </thead>
              <tbody>
                {linhas.map((l) => (
                  <tr key={l.eq} className="border-b border-border last:border-0 hover:bg-surface-2 transition-colors">
                    <Td className="font-semibold">{l.eq}</Td>
                    <Td>{l.regra ? <Badge tone="blue">{l.regra.percentual}% / {l.regra.base}</Badge> : <span className="text-muted text-xs">sem regra</span>}</Td>
                    <Td className="text-right tabular-nums">{formatCurrency(l.rec)}</Td>
                    <Td className={cn("text-right tabular-nums", l.saldo >= 0 ? "text-green" : "text-red")}>{formatCurrency(l.saldo)}</Td>
                    <Td className="text-right tabular-nums text-muted">{l.regra ? formatCurrency(l.baseValor) : "—"}</Td>
                    <Td className="text-right tabular-nums font-semibold text-green">{l.regra ? formatCurrency(l.comissao) : "—"}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardBody>
      </Card>
      <p className="text-xs text-muted italic mt-2">
        Margem usa o rateio de despesas (mesma lógica do Financeiro). Ajuste as regras em Cadastros · Regras de Comissão.
      </p>
    </>
  );
}

function Th({ children, className }: { children: React.ReactNode; className?: string }) {
  return <th className={cn("px-4 py-3 text-xs font-semibold text-muted uppercase tracking-wide whitespace-nowrap", className)}>{children}</th>;
}
function Td({ children, className }: { children: React.ReactNode; className?: string }) {
  return <td className={cn("px-4 py-3", className)}>{children}</td>;
}
