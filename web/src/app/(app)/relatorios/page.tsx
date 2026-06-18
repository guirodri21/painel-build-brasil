"use client";

import * as React from "react";
import { useData } from "@/components/data-provider";
import { useFiltros } from "@/components/filters-provider";
import { useToast } from "@/components/ui/toast";
import { PageHeader } from "@/components/page-header";
import { FilterBar } from "@/components/filter-bar";
import { Card, CardHeader, CardTitle, CardBody } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Select, Label } from "@/components/ui/field";
import { HBarChart, BalancoChart, ValueBarChart, CHART_COLORS } from "@/components/charts";
import {
  applyFiltros, groupBy, sum, balancoMensal,
  qualidadeMediaPorEquipe, tempoMedioPorEquipe,
} from "@/lib/analytics";
import { exportOrdensCSV, exportRelatorioPDF } from "@/lib/export";
import { formatCurrency, formatPercent, monthLabel, cn } from "@/lib/utils";
import { FileSpreadsheet, FileText, TrendingUp, TrendingDown, Minus } from "lucide-react";
import type { Ordem } from "@/lib/types";

type Tipo = "receita_equipe" | "receita_regiao" | "receita_linha" | "evolucao" | "qual_tempo";

const TIPOS: { id: Tipo; label: string }[] = [
  { id: "receita_equipe", label: "Receita por equipe" },
  { id: "receita_regiao", label: "Receita por região" },
  { id: "receita_linha", label: "Receita por linha de serviço" },
  { id: "evolucao", label: "Evolução mensal (balanço)" },
  { id: "qual_tempo", label: "Qualidade & tempo por equipe" },
];

const DIM_KEY: Record<string, (o: Ordem) => string> = {
  receita_equipe: (o) => o.equipe,
  receita_regiao: (o) => o.regiao,
  receita_linha: (o) => o.linha_servico,
};
const DIM_LABEL: Record<string, string> = {
  receita_equipe: "Equipe",
  receita_regiao: "Região",
  receita_linha: "Linha de Serviço",
};

export default function RelatoriosPage() {
  const { ordens, despesas, loading } = useData();
  const { filtros } = useFiltros();
  const toast = useToast();

  const [tipo, setTipo] = React.useState<Tipo>("receita_equipe");
  const [mesA, setMesA] = React.useState("");
  const [mesB, setMesB] = React.useState("");

  const d = React.useMemo(() => applyFiltros(ordens, filtros), [ordens, filtros]);

  const meses = React.useMemo(() => {
    const set = new Set(d.map((o) => o.data.substring(0, 7)));
    return Array.from(set).sort().reverse();
  }, [d]);

  React.useEffect(() => {
    if (meses.length) {
      if (!mesA || !meses.includes(mesA)) setMesA(meses[0]);
      if (!mesB || !meses.includes(mesB)) setMesB(meses[1] ?? meses[0]);
    }
  }, [meses, mesA, mesB]);

  const isComparativo = tipo === "receita_equipe" || tipo === "receita_regiao" || tipo === "receita_linha";

  // ---- Comparativo por dimensão (receita) ----
  const dimAgg = React.useCallback(
    (mes: string) => {
      const key = DIM_KEY[tipo];
      const items = d.filter((o) => o.data.substring(0, 7) === mes);
      const by = groupBy(items, key);
      const out: Record<string, number> = {};
      for (const [k, arr] of Object.entries(by)) out[k] = sum(arr, (o) => o.valor_venda);
      return out;
    },
    [d, tipo],
  );

  const compA = isComparativo ? dimAgg(mesA) : {};
  const compB = isComparativo ? dimAgg(mesB) : {};
  const chaves = Array.from(new Set([...Object.keys(compA), ...Object.keys(compB)])).sort();
  const totalA = Object.values(compA).reduce((s, v) => s + v, 0);
  const totalB = Object.values(compB).reduce((s, v) => s + v, 0);
  const chartA = chaves.map((k) => ({ name: k, value: compA[k] ?? 0 })).sort((a, b) => b.value - a.value);

  // ---- Evolução mensal ----
  const balanco = React.useMemo(
    () => balancoMensal(d, despesas).map((b) => ({ ...b, mes: monthLabel(b.mes) })),
    [d, despesas],
  );

  // ---- Qualidade & tempo (mês A) ----
  const mesItems = React.useMemo(() => d.filter((o) => o.data.substring(0, 7) === mesA), [d, mesA]);
  const qualEq = Object.entries(qualidadeMediaPorEquipe(mesItems)).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  const tempoEq = Object.entries(tempoMedioPorEquipe(mesItems)).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  const qtEquipes = Array.from(new Set([...qualEq.map((x) => x.name), ...tempoEq.map((x) => x.name)])).sort();

  function handleCSV() {
    if (!d.length) { toast("Sem dados para exportar.", "error"); return; }
    exportOrdensCSV(d);
    toast("CSV exportado.");
  }

  function handlePDF() {
    if (!d.length) { toast("Sem dados para exportar.", "error"); return; }
    const tipoLabel = TIPOS.find((t) => t.id === tipo)!.label;

    if (isComparativo) {
      exportRelatorioPDF({
        titulo: tipoLabel,
        subtitulo: `${monthLabel(mesA)} vs ${monthLabel(mesB)}`,
        colunas: [DIM_LABEL[tipo], monthLabel(mesA), monthLabel(mesB), "Variação"],
        linhas: [
          ...chaves.map((k) => {
            const a = compA[k] ?? 0, b = compB[k] ?? 0;
            const delta = b > 0 ? ((a - b) / b) * 100 : a > 0 ? 100 : 0;
            return [k, formatCurrency(a), formatCurrency(b), formatPercent(delta, 0)];
          }),
          ["TOTAL", formatCurrency(totalA), formatCurrency(totalB), formatPercent(totalB > 0 ? ((totalA - totalB) / totalB) * 100 : 0, 0)],
        ],
      });
    } else if (tipo === "evolucao") {
      exportRelatorioPDF({
        titulo: tipoLabel,
        colunas: ["Mês", "Receita", "Despesa", "Saldo"],
        linhas: balanco.map((b) => [b.mes, formatCurrency(b.receita), formatCurrency(b.despesa), formatCurrency(b.saldo)]),
      });
    } else {
      exportRelatorioPDF({
        titulo: tipoLabel,
        subtitulo: monthLabel(mesA),
        colunas: ["Equipe", "Qualidade média", "Tempo médio (h)"],
        linhas: qtEquipes.map((eq) => {
          const q = qualEq.find((x) => x.name === eq)?.value;
          const t = tempoEq.find((x) => x.name === eq)?.value;
          return [eq, q != null ? q.toFixed(0) : "—", t != null ? t.toFixed(1) : "—"];
        }),
      });
    }
    toast("PDF gerado.");
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
      <PageHeader title="Relatórios" subtitle="Análises configuráveis e exportação de dados">
        <Button variant="secondary" onClick={handleCSV}>
          <FileSpreadsheet size={16} /> Exportar CSV
        </Button>
        <Button variant="secondary" onClick={handlePDF}>
          <FileText size={16} /> Exportar PDF
        </Button>
      </PageHeader>

      <FilterBar />

      <Card>
        <CardHeader><CardTitle>Configuração do Relatório</CardTitle></CardHeader>
        <CardBody>
          <div className="flex flex-wrap gap-4 mb-5">
            <div>
              <Label>Tipo de relatório</Label>
              <Select value={tipo} onChange={(e) => setTipo(e.target.value as Tipo)} className="min-w-[230px]">
                {TIPOS.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
              </Select>
            </div>
            {(isComparativo || tipo === "qual_tempo") && meses.length > 0 && (
              <div>
                <Label>{isComparativo ? "Período A" : "Mês"}</Label>
                <Select value={mesA} onChange={(e) => setMesA(e.target.value)} className="min-w-[150px]">
                  {meses.map((m) => <option key={m} value={m}>{monthLabel(m)}</option>)}
                </Select>
              </div>
            )}
            {isComparativo && meses.length > 0 && (
              <div>
                <Label>Período B (comparar)</Label>
                <Select value={mesB} onChange={(e) => setMesB(e.target.value)} className="min-w-[150px]">
                  {meses.map((m) => <option key={m} value={m}>{monthLabel(m)}</option>)}
                </Select>
              </div>
            )}
          </div>

          {!d.length ? (
            <p className="text-sm text-muted py-8 text-center">Sem dados para gerar relatórios.</p>
          ) : isComparativo ? (
            <ComparativoView
              dimLabel={DIM_LABEL[tipo]}
              chaves={chaves} compA={compA} compB={compB}
              mesA={mesA} mesB={mesB} totalA={totalA} totalB={totalB} chartA={chartA}
            />
          ) : tipo === "evolucao" ? (
            <div>
              <BalancoChart data={balanco} height={360} />
              <div className="overflow-x-auto mt-4">
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-border text-left">
                    <Th>Mês</Th><Th className="text-right">Receita</Th><Th className="text-right">Despesa</Th><Th className="text-right">Saldo</Th>
                  </tr></thead>
                  <tbody>
                    {balanco.map((b) => (
                      <tr key={b.mes} className="border-b border-border last:border-0 hover:bg-surface-2">
                        <Td className="font-medium">{b.mes}</Td>
                        <Td className="text-right">{formatCurrency(b.receita)}</Td>
                        <Td className="text-right text-orange">{formatCurrency(b.despesa)}</Td>
                        <Td className={cn("text-right font-semibold", b.saldo >= 0 ? "text-green" : "text-red")}>{formatCurrency(b.saldo)}</Td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div>
              <div className="grid gap-5 lg:grid-cols-2 mb-4">
                <Card><CardHeader><CardTitle>Qualidade por Equipe</CardTitle></CardHeader><CardBody><ValueBarChart data={qualEq} color={CHART_COLORS[2]} /></CardBody></Card>
                <Card><CardHeader><CardTitle>Tempo Médio por Equipe (h)</CardTitle></CardHeader><CardBody><ValueBarChart data={tempoEq} suffix="h" color={CHART_COLORS[1]} /></CardBody></Card>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-border text-left">
                    <Th>Equipe</Th><Th className="text-right">Qualidade média</Th><Th className="text-right">Tempo médio (h)</Th>
                  </tr></thead>
                  <tbody>
                    {qtEquipes.map((eq) => {
                      const q = qualEq.find((x) => x.name === eq)?.value;
                      const t = tempoEq.find((x) => x.name === eq)?.value;
                      return (
                        <tr key={eq} className="border-b border-border last:border-0 hover:bg-surface-2">
                          <Td className="font-semibold">{eq}</Td>
                          <Td className="text-right">{q != null ? q.toFixed(0) : "—"}</Td>
                          <Td className="text-right">{t != null ? t.toFixed(1).replace(".", ",") : "—"}</Td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </CardBody>
      </Card>
    </>
  );
}

function ComparativoView({ dimLabel, chaves, compA, compB, mesA, mesB, totalA, totalB, chartA }: {
  dimLabel: string; chaves: string[]; compA: Record<string, number>; compB: Record<string, number>;
  mesA: string; mesB: string; totalA: number; totalB: number; chartA: { name: string; value: number }[];
}) {
  return (
    <>
      <div className="mb-5"><HBarChart data={chartA} height={Math.max(200, chartA.length * 42)} /></div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left">
              <Th>{dimLabel}</Th>
              <Th className="text-right">{monthLabel(mesA)}</Th>
              <Th className="text-right">{monthLabel(mesB)}</Th>
              <Th className="text-right">Variação</Th>
            </tr>
          </thead>
          <tbody>
            {chaves.map((k) => {
              const a = compA[k] ?? 0;
              const b = compB[k] ?? 0;
              const delta = b > 0 ? ((a - b) / b) * 100 : a > 0 ? 100 : 0;
              return (
                <tr key={k} className="border-b border-border last:border-0 hover:bg-surface-2 transition-colors">
                  <Td className="font-semibold">{k}</Td>
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
              <Td className="text-right"><Delta value={totalB > 0 ? ((totalA - totalB) / totalB) * 100 : 0} /></Td>
            </tr>
          </tbody>
        </table>
      </div>
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
