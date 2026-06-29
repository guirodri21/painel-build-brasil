"use client";

import * as React from "react";
import Link from "next/link";
import { useData } from "@/components/data-provider";
import { useFiltros } from "@/components/filters-provider";
import { FilterBar } from "@/components/filter-bar";
import { KpiCard } from "@/components/kpi-card";
import { KpiSkeletonRow, Skeleton } from "@/components/ui/skeleton";
import { Card, CardHeader, CardTitle, CardBody } from "@/components/ui/card";
import { QualityBar } from "@/components/quality-bar";
import { BrandMark } from "@/components/brand";
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
import {
  DollarSign,
  Wallet,
  ClipboardList,
  Star,
  Clock,
  ArrowRight,
  KanbanSquare,
  Wrench,
  Contact,
  CalendarDays,
  TrendingUp,
  LayoutGrid,
  Package,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

type Atalho = {
  href: string;
  label: string;
  desc: string;
  icon: LucideIcon;
  gate?: "financeiro" | "admin";
};

const ATALHOS: Atalho[] = [
  { href: "/chamados", label: "Pipeline Comercial", desc: "Funil de vendas e chamados", icon: KanbanSquare },
  { href: "/operacoes/pipeline", label: "Pipeline Operacional", desc: "Ordens em execução", icon: Wrench },
  { href: "/clientes", label: "Clientes", desc: "Carteira e cadastro", icon: Contact },
  { href: "/agenda", label: "Agenda", desc: "Compromissos e visitas", icon: CalendarDays },
  { href: "/financeiro", label: "Financeiro", desc: "Receitas e despesas", icon: TrendingUp, gate: "financeiro" },
  { href: "/estoque", label: "Estoque", desc: "Consumo de materiais", icon: Package },
  { href: "/quadros", label: "Quadros", desc: "Boards e automações", icon: LayoutGrid, gate: "admin" },
];

export default function HomePage() {
  const { ordens, despesas, equipes, loading, isAdmin, podeFinanceiro } = useData();
  const { filtros } = useFiltros();

  const atalhos = React.useMemo(
    () =>
      ATALHOS.filter((a) => {
        if (a.gate === "financeiro") return podeFinanceiro;
        if (a.gate === "admin") return isAdmin;
        return true;
      }),
    [isAdmin, podeFinanceiro],
  );

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

  return (
    <>
      <Hero />

      <div className="stagger grid gap-3 mb-6 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
        {atalhos.map((a) => {
          const Icon = a.icon;
          return (
            <Link
              key={a.href}
              href={a.href}
              className="group rounded-xl border border-border bg-surface p-4 shadow-sm transition-all hover:shadow-md hover:-translate-y-0.5 hover:border-primary/40"
            >
              <div className="flex items-center justify-between mb-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary-soft text-primary">
                  <Icon size={18} />
                </span>
                <ArrowRight
                  size={15}
                  className="text-muted opacity-0 -translate-x-1 transition-all group-hover:opacity-100 group-hover:translate-x-0"
                />
              </div>
              <p className="text-sm font-semibold leading-tight">{a.label}</p>
              <p className="text-[11px] text-muted mt-0.5 leading-snug">{a.desc}</p>
            </Link>
          );
        })}
      </div>

      {loading ? (
        <DashboardSkeleton />
      ) : (
        <>
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
      )}
    </>
  );
}

function Th({ children, className }: { children: React.ReactNode; className?: string }) {
  return <th className={cn("px-4 py-3 text-xs font-semibold text-muted uppercase tracking-wide", className)}>{children}</th>;
}
function Td({ children, className }: { children: React.ReactNode; className?: string }) {
  return <td className={cn("px-4 py-3", className)}>{children}</td>;
}

function Hero() {
  const hora = new Date().getHours();
  const saudacao = hora < 12 ? "Bom dia" : hora < 18 ? "Boa tarde" : "Boa noite";
  return (
    <div
      className="animate-pop relative mb-6 overflow-hidden rounded-2xl px-6 py-7 sm:px-8 sm:py-8 text-white shadow-lg"
      style={{
        background:
          "linear-gradient(135deg, #16317a 0%, #234fa8 45%, #1f7a3d 120%)",
      }}
    >
      {/* Globo decorativo ao fundo */}
      <BrandMark
        size={240}
        className="pointer-events-none absolute -right-10 -top-12 rounded-none opacity-15 blur-[1px] sm:opacity-20"
      />
      <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <BrandMark
            size={64}
            className="rounded-2xl bg-white/10 p-1.5 ring-1 ring-white/20 backdrop-blur-sm"
          />
          <div>
            <p className="text-xs font-medium uppercase tracking-widest text-white/70">
              {saudacao} · Painel de Gestão
            </p>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
              Build Brasil
            </h1>
            <p className="text-sm text-white/80">Engenharia e Serviços</p>
          </div>
        </div>
        <p className="max-w-xs text-sm leading-relaxed text-white/85">
          Acompanhe vendas, operações, finanças e estoque em um só lugar.
          Escolha um atalho abaixo ou veja o resumo consolidado.
        </p>
      </div>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <>
      <Skeleton className="h-16 mb-5" />
      <KpiSkeletonRow count={5} />
      <Skeleton className="h-32 mb-5" />
      <Skeleton className="h-64" />
    </>
  );
}
