import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight, LogIn, Sparkles, ShieldCheck, Database, Zap,
  Briefcase, HardHat, Wallet, Package, LayoutGrid, CalendarDays,
  FileText, Plug, MonitorPlay, BarChart3, TrendingUp, Check,
} from "lucide-react";
import { BrandLogo, BrandMark } from "@/components/brand";
import { ThemeToggle } from "@/components/theme-toggle";

export const metadata: Metadata = {
  title: "Build Brasil — Painel de Resultados",
  description:
    "O painel de gestão da Build Brasil Engenharia: comercial, operação, financeiro e suprimentos em um só lugar, em tempo real.",
};

/** As 4 áreas principais do painel (espelham a navegação interna). */
const AREAS = [
  {
    icon: Briefcase,
    titulo: "Comercial / Vendas",
    desc: "Performance comercial, pipeline de propostas, clientes e orçamentos — do primeiro contato ao fechamento.",
  },
  {
    icon: HardHat,
    titulo: "Operacional",
    desc: "Indicadores de operação, pipeline de obras, agenda, preventivas, frota e equipe técnica.",
  },
  {
    icon: Wallet,
    titulo: "Financeiro",
    desc: "Receitas, despesas e contas a pagar com visão consolidada do resultado do mês.",
  },
  {
    icon: Package,
    titulo: "Suprimentos / Estoque",
    desc: "Consumo de materiais, patrimônio e controle de equipamentos e ferramentas.",
  },
] as const;

/** Recursos transversais que acompanham as 4 áreas. */
const RECURSOS = [
  { icon: LayoutGrid, label: "Quadros e formulários" },
  { icon: CalendarDays, label: "Agenda operacional" },
  { icon: FileText, label: "Relatórios e exportação" },
  { icon: Plug, label: "Integrações" },
  { icon: MonitorPlay, label: "Modo TV para o time" },
  { icon: BarChart3, label: "Indicadores em tempo real" },
] as const;

export default function InicioPage() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      {/* Cabeçalho */}
      <header className="sticky top-0 z-40 border-b border-border bg-surface/80 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <BrandLogo />
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Link
              href="/assinar"
              className="hidden sm:inline-flex h-9 items-center rounded-lg px-3 text-sm font-medium text-muted hover:text-foreground hover:bg-surface-2 transition-colors"
            >
              Assinar
            </Link>
            <Link
              href="/login"
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-fg shadow-sm hover:bg-primary-hover transition-colors"
            >
              <LogIn size={15} /> Entrar
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-6xl px-4 sm:px-6 pt-16 pb-12 sm:pt-24 sm:pb-16">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <div className="animate-in">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1 text-xs font-medium text-muted">
              <Sparkles size={13} className="text-primary" />
              Build Brasil Engenharia · Gestão v5
            </span>

            <h1 className="mt-5 text-4xl sm:text-5xl font-bold tracking-tight leading-[1.08]">
              O painel de resultados da{" "}
              <span className="text-primary">Build Brasil</span>
            </h1>

            <p className="mt-5 max-w-xl text-lg text-muted leading-relaxed">
              Comercial, operação, financeiro e suprimentos reunidos em um só
              lugar — com indicadores em tempo real para tomar decisões com
              clareza e acompanhar cada obra do início ao fim.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link
                href="/login"
                className="inline-flex h-11 items-center gap-2 rounded-lg bg-primary px-6 text-sm font-semibold text-primary-fg shadow-sm hover:bg-primary-hover transition-colors"
              >
                <LogIn size={16} /> Entrar no painel
              </Link>
              <Link
                href="/assinar"
                className="inline-flex h-11 items-center gap-2 rounded-lg border border-border bg-surface px-6 text-sm font-semibold hover:bg-surface-2 hover:border-border-strong transition-colors"
              >
                Conhecer o plano <ArrowRight size={16} />
              </Link>
            </div>

            <p className="mt-4 text-xs text-muted">
              Acesso restrito por usuário · uso interno da equipe Build Brasil.
            </p>
          </div>

          {/* Mock do painel — decorativo */}
          <div className="animate-pop lg:justify-self-end w-full" aria-hidden="true">
            <DashboardMock />
          </div>
        </div>
      </section>

      {/* Áreas */}
      <section className="mx-auto max-w-6xl px-4 sm:px-6 py-12 sm:py-16">
        <div className="max-w-2xl">
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">
            Tudo que a operação precisa acompanhar
          </h2>
          <p className="mt-3 text-muted">
            Quatro áreas conectadas, cada uma com seus indicadores e seu fluxo
            de trabalho.
          </p>
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4 stagger">
          {AREAS.map(({ icon: Icon, titulo, desc }) => (
            <div
              key={titulo}
              className="rounded-2xl border border-border bg-surface p-6 shadow-sm hover:border-border-strong hover:shadow-md transition-all"
            >
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary-soft text-primary">
                <Icon size={22} />
              </div>
              <h3 className="mt-4 text-base font-semibold">{titulo}</h3>
              <p className="mt-1.5 text-sm text-muted leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>

        {/* Recursos transversais */}
        <div className="mt-6 grid gap-3 rounded-2xl border border-border bg-surface-2 p-6 sm:grid-cols-2 lg:grid-cols-3">
          {RECURSOS.map(({ icon: Icon, label }) => (
            <div key={label} className="flex items-center gap-3 text-sm">
              <Icon size={18} className="shrink-0 text-primary" />
              <span className="text-foreground">{label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Infra / segurança */}
      <section className="mx-auto max-w-6xl px-4 sm:px-6 py-12 sm:py-16">
        <div className="grid gap-4 sm:grid-cols-3">
          {[
            {
              icon: ShieldCheck,
              titulo: "Seguro por padrão",
              desc: "Proteção e autenticação de dados, com acesso controlado por usuário e por área.",
            },
            {
              icon: Database,
              titulo: "Dados dedicados",
              desc: "Banco de dados próprio na infraestrutura Supabase, com melhorias contínuas.",
            },
            {
              icon: Zap,
              titulo: "Tempo real",
              desc: "Hospedagem na Vercel — rápido, escalável e sempre atualizado para o time.",
            },
          ].map(({ icon: Icon, titulo, desc }) => (
            <div key={titulo} className="rounded-2xl border border-border bg-surface p-6 shadow-sm">
              <Icon size={22} className="text-primary" />
              <h3 className="mt-3 text-base font-semibold">{titulo}</h3>
              <p className="mt-1.5 text-sm text-muted leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA final */}
      <section className="mx-auto max-w-6xl px-4 sm:px-6 pb-16 sm:pb-24">
        <div className="rounded-3xl border border-border bg-surface p-8 sm:p-12 text-center shadow-sm">
          <BrandMark size={48} className="mx-auto shadow-md" />
          <h2 className="mt-5 text-2xl sm:text-3xl font-bold tracking-tight">
            Acesse o painel de resultados
          </h2>
          <p className="mx-auto mt-3 max-w-md text-muted">
            Entre com o seu usuário para acompanhar os indicadores da Build
            Brasil. Ainda não tem acesso? Conheça o plano.
          </p>
          <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/login"
              className="inline-flex h-11 items-center gap-2 rounded-lg bg-primary px-6 text-sm font-semibold text-primary-fg shadow-sm hover:bg-primary-hover transition-colors"
            >
              <LogIn size={16} /> Entrar no painel
            </Link>
            <Link
              href="/assinar"
              className="inline-flex h-11 items-center gap-2 rounded-lg border border-border bg-surface px-6 text-sm font-semibold hover:bg-surface-2 hover:border-border-strong transition-colors"
            >
              Ver plano Pro <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      </section>

      {/* Rodapé */}
      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 sm:px-6 py-8 sm:flex-row">
          <BrandLogo subtitle="Gestão Interna · v5" />
          <p className="text-xs text-muted">
            © {new Date().getFullYear()} Build Brasil Engenharia. Todos os
            direitos reservados.
          </p>
        </div>
      </footer>
    </main>
  );
}

/** Prévia estática do painel exibida no hero (puramente decorativa). */
function DashboardMock() {
  const kpis = [
    { label: "Faturamento", valor: "R$ 482 mil", trend: "+12%" },
    { label: "Obras ativas", valor: "27", trend: "+3" },
    { label: "Propostas", valor: "R$ 1,2 mi", trend: "+8%" },
  ];
  const barras = [42, 68, 55, 80, 63, 92, 74];

  return (
    <div className="rounded-2xl border border-border bg-surface shadow-lg overflow-hidden">
      {/* topbar fake */}
      <div className="flex items-center gap-2 border-b border-border px-4 h-11 bg-surface-2">
        <span className="h-2.5 w-2.5 rounded-full bg-red/70" />
        <span className="h-2.5 w-2.5 rounded-full bg-yellow/70" />
        <span className="h-2.5 w-2.5 rounded-full bg-green/70" />
        <span className="ml-3 text-xs font-medium text-muted">
          Visão Geral · Build Brasil
        </span>
      </div>

      <div className="p-4 sm:p-5 space-y-4">
        {/* KPIs */}
        <div className="grid grid-cols-3 gap-3">
          {kpis.map((k) => (
            <div key={k.label} className="rounded-xl border border-border bg-surface-2 p-3">
              <p className="text-[10px] uppercase tracking-wide text-muted">{k.label}</p>
              <p className="mt-1 text-sm sm:text-base font-bold tabular-nums">{k.valor}</p>
              <p className="mt-0.5 inline-flex items-center gap-0.5 text-[10px] font-medium text-green">
                <TrendingUp size={11} /> {k.trend}
              </p>
            </div>
          ))}
        </div>

        {/* Gráfico de barras fake */}
        <div className="rounded-xl border border-border p-4">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold">Resultado por semana</p>
            <span className="inline-flex items-center gap-1 rounded-full bg-green-soft px-2 py-0.5 text-[10px] font-medium text-green">
              <Check size={10} /> no ritmo
            </span>
          </div>
          <div className="mt-4 flex h-24 items-end gap-2">
            {barras.map((h, i) => (
              <div
                key={i}
                className="flex-1 rounded-t bg-primary/80"
                style={{ height: `${h}%` }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
