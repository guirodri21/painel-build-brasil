"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useData } from "@/components/data-provider";
import { BrandMark } from "@/components/brand";
import { DonutChart, HBarChart, BalancoChart, ValueBarChart, CHART_COLORS } from "@/components/charts";
import {
  calcVendas,
  calcOps,
  calcRateio,
  balancoMensal,
  groupBy,
  sum,
  qualidadeMediaPorEquipe,
  tempoMedioPorEquipe,
} from "@/lib/analytics";
import { formatCurrency, monthLabel, cn } from "@/lib/utils";
import { Maximize, Minimize, X, Settings } from "lucide-react";

const SCENES = ["Visão Geral", "Vendas", "Operações", "Financeiro"];

interface TvConfig {
  enabled: boolean[];
  intervalSec: number;
}
const DEFAULT_CONFIG: TvConfig = { enabled: [true, true, true, true], intervalSec: 15 };

function loadConfig(): TvConfig {
  if (typeof window === "undefined") return DEFAULT_CONFIG;
  try {
    const raw = localStorage.getItem("bb-tv-config");
    if (raw) {
      const c = JSON.parse(raw);
      return {
        enabled: Array.isArray(c.enabled) && c.enabled.length === 4 ? c.enabled : DEFAULT_CONFIG.enabled,
        intervalSec: typeof c.intervalSec === "number" ? c.intervalSec : DEFAULT_CONFIG.intervalSec,
      };
    }
  } catch {}
  return DEFAULT_CONFIG;
}

export default function TvPage() {
  const router = useRouter();
  const { ordens, despesas, equipes, loading } = useData();
  const [config, setConfig] = React.useState<TvConfig>(DEFAULT_CONFIG);
  const [pointer, setPointer] = React.useState(0);
  const [now, setNow] = React.useState(() => new Date());
  const [fs, setFs] = React.useState(false);
  const [showCfg, setShowCfg] = React.useState(false);

  React.useEffect(() => setConfig(loadConfig()), []);

  const active = config.enabled
    .map((on, i) => (on ? i : -1))
    .filter((i) => i >= 0);
  const activeScenes = active.length ? active : [0, 1, 2, 3];
  const scene = activeScenes[pointer % activeScenes.length];

  // Força tema escuro
  React.useEffect(() => {
    const prev = document.documentElement.getAttribute("data-theme");
    document.documentElement.setAttribute("data-theme", "dark");
    return () => { if (prev) document.documentElement.setAttribute("data-theme", prev); };
  }, []);

  // Rotação automática (respeita intervalo e cenas ativas)
  React.useEffect(() => {
    const ms = Math.max(5, config.intervalSec) * 1000;
    const id = setInterval(() => setPointer((p) => p + 1), ms);
    return () => clearInterval(id);
  }, [config.intervalSec, activeScenes.length]);

  // Relógio
  React.useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  React.useEffect(() => {
    const onFs = () => setFs(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);

  function toggleFullscreen() {
    if (document.fullscreenElement) document.exitFullscreen();
    else document.documentElement.requestFullscreen().catch(() => {});
  }

  function updateConfig(next: TvConfig) {
    setConfig(next);
    setPointer(0);
    try { localStorage.setItem("bb-tv-config", JSON.stringify(next)); } catch {}
  }

  const v = calcVendas(ordens);
  const op = calcOps(ordens);
  const { res, recTotal, despTotal } = calcRateio(ordens, despesas, equipes);
  const ddTotal = sum(ordens, (o) => o.despesa_direta);
  const saldo = recTotal - ddTotal - despTotal;
  const margem = recTotal > 0 ? (saldo / recTotal) * 100 : 0;

  const clock = now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  const dateStr = now.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" });

  return (
    <div className="fixed inset-0 bg-background text-foreground flex flex-col overflow-hidden">
      <header className="flex items-center justify-between px-8 py-4 border-b border-border shrink-0">
        <div className="flex items-center gap-3">
          <BrandMark size={40} />
          <div>
            <div className="text-lg font-bold leading-tight">Build Brasil</div>
            <div className="text-xs text-muted">Painel de Resultados</div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className="flex items-center gap-2 rounded-full bg-red-soft px-3 py-1">
            <span className="h-2 w-2 rounded-full bg-red animate-pulse" />
            <span className="text-xs font-semibold text-red tracking-wide">AO VIVO</span>
          </span>
          <div className="text-right">
            <div className="text-2xl font-bold tabular-nums leading-none">{clock}</div>
            <div className="text-xs text-muted capitalize">{dateStr}</div>
          </div>
          <div className="relative">
            <button onClick={() => setShowCfg((s) => !s)} className="ml-2 p-2 rounded-lg border border-border text-muted hover:text-foreground cursor-pointer" title="Configurar">
              <Settings size={18} />
            </button>
            {showCfg && (
              <ConfigPanel config={config} onChange={updateConfig} onClose={() => setShowCfg(false)} />
            )}
          </div>
          <button onClick={toggleFullscreen} className="p-2 rounded-lg border border-border text-muted hover:text-foreground cursor-pointer" title="Tela cheia">
            {fs ? <Minimize size={18} /> : <Maximize size={18} />}
          </button>
          <button onClick={() => router.push("/")} className="p-2 rounded-lg border border-border text-muted hover:text-foreground cursor-pointer" title="Sair do modo TV">
            <X size={18} />
          </button>
        </div>
      </header>

      <div className="flex items-center justify-between px-8 pt-5 shrink-0">
        <h1 className="text-3xl font-bold tracking-tight">{SCENES[scene]}</h1>
        <div className="flex gap-2">
          {activeScenes.map((s, i) => (
            <span key={s} className={cn("h-2 rounded-full transition-all duration-500", i === pointer % activeScenes.length ? "w-10 bg-primary" : "w-2 bg-border")} />
          ))}
        </div>
      </div>

      <main key={scene} className="flex-1 px-8 py-5 overflow-hidden animate-in">
        {loading ? (
          <div className="h-full flex items-center justify-center text-muted text-lg">Carregando dados…</div>
        ) : scene === 0 ? (
          <SceneGeral recTotal={recTotal} saldo={saldo} ordens={v.n} qualidade={op.qualMedia} andamento={op.andamento} res={res} />
        ) : scene === 1 ? (
          <SceneVendas ordens={ordens} total={v.total} ticket={v.ticket} />
        ) : scene === 2 ? (
          <SceneOps ordens={ordens} op={op} />
        ) : (
          <SceneFin ordens={ordens} despesas={despesas} recTotal={recTotal} despTotal={despTotal + ddTotal} saldo={saldo} margem={margem} />
        )}
      </main>
    </div>
  );
}

/* ===== Painel de configuração ===== */
function ConfigPanel({ config, onChange, onClose }: { config: TvConfig; onChange: (c: TvConfig) => void; onClose: () => void }) {
  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div className="absolute right-0 top-12 z-50 w-72 rounded-xl border border-border bg-surface shadow-lg p-4">
        <div className="text-sm font-semibold mb-3">Configurar Modo TV</div>
        <div className="space-y-2 mb-4">
          <div className="text-xs text-muted mb-1">Telas no ciclo</div>
          {SCENES.map((s, i) => (
            <label key={s} className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={config.enabled[i]}
                onChange={(e) => {
                  const enabled = [...config.enabled];
                  enabled[i] = e.target.checked;
                  if (enabled.some(Boolean)) onChange({ ...config, enabled });
                }}
                className="accent-[var(--primary)]"
              />
              {s}
            </label>
          ))}
        </div>
        <div>
          <div className="text-xs text-muted mb-1">Tempo por tela (segundos)</div>
          <input
            type="number"
            min={5}
            max={120}
            value={config.intervalSec}
            onChange={(e) => onChange({ ...config, intervalSec: Math.max(5, Math.min(120, Number(e.target.value) || 15)) })}
            className="w-full h-9 rounded-lg border border-border bg-surface px-3 text-sm"
          />
        </div>
      </div>
    </>
  );
}

/* ===== KPI grande ===== */
function BigKpi({ label, value, tone = "default" }: { label: string; value: string | number; tone?: string }) {
  const color =
    tone === "green" ? "text-green" : tone === "red" ? "text-red" :
    tone === "orange" ? "text-orange" : tone === "teal" ? "text-teal" : "text-primary";
  return (
    <div className="rounded-2xl border border-border bg-surface px-6 py-5 flex flex-col justify-center">
      <span className="text-sm font-medium text-muted">{label}</span>
      <span className={cn("mt-2 text-[2.75rem] leading-none font-bold tracking-tight tabular-nums", color)}>{value}</span>
    </div>
  );
}

/* ===== Cena: Visão Geral ===== */
function SceneGeral({ recTotal, saldo, ordens, qualidade, andamento, res }: {
  recTotal: number; saldo: number; ordens: number; qualidade: number; andamento: number;
  res: Record<string, { saldo: number; n: number }>;
}) {
  const alerts: { tone: string; text: string }[] = [];
  const entries = Object.entries(res).filter(([, x]) => x.n > 0);
  if (entries.length) {
    const lider = [...entries].sort((a, b) => b[1].saldo - a[1].saldo)[0];
    alerts.push({ tone: "green", text: `Equipe líder: ${lider[0]} (${formatCurrency(lider[1].saldo)})` });
    entries.forEach(([eq, x]) => { if (x.saldo < 0) alerts.push({ tone: "red", text: `${eq}: saldo negativo` }); });
  }
  if (qualidade > 0 && qualidade < 80) alerts.push({ tone: "yellow", text: `Qualidade média ${qualidade.toFixed(0)}` });
  if (andamento > 3) alerts.push({ tone: "yellow", text: `${andamento} ordens em aberto` });

  return (
    <div className="h-full flex flex-col gap-5">
      <div className="grid grid-cols-5 gap-4 flex-1">
        <BigKpi label="Receita Total" value={formatCurrency(recTotal)} />
        <BigKpi label="Saldo Geral" value={formatCurrency(saldo)} tone={saldo >= 0 ? "green" : "red"} />
        <BigKpi label="Ordens" value={ordens} tone="teal" />
        <BigKpi label="Qualidade Média" value={qualidade.toFixed(0)} tone={qualidade < 80 ? "orange" : "teal"} />
        <BigKpi label="Em Andamento" value={andamento} tone={andamento > 0 ? "orange" : "default"} />
      </div>
      <div className="flex flex-wrap gap-3">
        {alerts.length ? alerts.map((a, i) => (
          <span key={i} className={cn(
            "rounded-xl px-4 py-2.5 text-base font-medium",
            a.tone === "green" && "bg-green-soft text-green",
            a.tone === "yellow" && "bg-yellow-soft text-yellow",
            a.tone === "red" && "bg-red-soft text-red",
          )}>{a.text}</span>
        )) : <span className="text-muted text-base">Sem alertas no período.</span>}
      </div>
    </div>
  );
}

/* ===== Cena: Vendas ===== */
function SceneVendas({ ordens, total, ticket }: { ordens: Parameters<typeof calcVendas>[0]; total: number; ticket: number }) {
  const byField = (f: (o: typeof ordens[number]) => string) =>
    Object.entries(groupBy(ordens, f))
      .map(([name, items]) => ({ name, value: sum(items, (o) => o.valor_venda) }))
      .sort((a, b) => b.value - a.value);
  const porRegiao = byField((o) => o.regiao);
  const porEquipe = byField((o) => o.equipe);

  return (
    <div className="h-full grid grid-cols-3 gap-5">
      <div className="flex flex-col gap-4">
        <BigKpi label="Total de Vendas" value={formatCurrency(total)} />
        <BigKpi label="Ticket Médio" value={formatCurrency(ticket)} tone="teal" />
      </div>
      <Panel title="Vendas por Região"><DonutChart data={porRegiao} height={420} /></Panel>
      <Panel title="Vendas por Equipe"><HBarChart data={porEquipe} color={CHART_COLORS[1]} height={420} /></Panel>
    </div>
  );
}

/* ===== Cena: Operações ===== */
function SceneOps({ ordens, op }: { ordens: Parameters<typeof calcOps>[0]; op: ReturnType<typeof calcOps> }) {
  const qualidade = Object.entries(qualidadeMediaPorEquipe(ordens)).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  const tempo = Object.entries(tempoMedioPorEquipe(ordens)).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  return (
    <div className="h-full flex flex-col gap-5">
      <div className="grid grid-cols-4 gap-4">
        <BigKpi label="Tempo Médio" value={op.tempoMedio.toFixed(1) + "h"} />
        <BigKpi label="Qualidade Média" value={op.qualMedia.toFixed(0)} tone="teal" />
        <BigKpi label="Taxa Conclusão" value={op.taxaConc.toFixed(0) + "%"} tone="green" />
        <BigKpi label="Em Andamento" value={op.andamento} tone={op.andamento > 0 ? "orange" : "default"} />
      </div>
      <div className="grid grid-cols-2 gap-5 flex-1">
        <Panel title="Qualidade por Equipe"><ValueBarChart data={qualidade} color={CHART_COLORS[2]} height={300} /></Panel>
        <Panel title="Tempo Médio por Equipe (h)"><ValueBarChart data={tempo} suffix="h" color={CHART_COLORS[1]} height={300} /></Panel>
      </div>
    </div>
  );
}

/* ===== Cena: Financeiro ===== */
function SceneFin({ ordens, despesas, recTotal, despTotal, saldo, margem }: {
  ordens: Parameters<typeof balancoMensal>[0]; despesas: Parameters<typeof balancoMensal>[1];
  recTotal: number; despTotal: number; saldo: number; margem: number;
}) {
  const balanco = balancoMensal(ordens, despesas).map((b) => ({ ...b, mes: monthLabel(b.mes) }));
  return (
    <div className="h-full grid grid-cols-3 gap-5">
      <div className="flex flex-col gap-4">
        <BigKpi label="Receita" value={formatCurrency(recTotal)} />
        <BigKpi label="Despesas" value={formatCurrency(despTotal)} tone="orange" />
        <BigKpi label="Saldo" value={formatCurrency(saldo)} tone={saldo >= 0 ? "green" : "red"} />
        <BigKpi label="Margem" value={margem.toFixed(1).replace(".", ",") + "%"} tone={margem >= 0 ? "green" : "red"} />
      </div>
      <div className="col-span-2">
        <Panel title="Balanço Mensal"><BalancoChart data={balanco} height={440} /></Panel>
      </div>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border bg-surface p-5 flex flex-col h-full">
      <h3 className="text-base font-semibold mb-3">{title}</h3>
      <div className="flex-1">{children}</div>
    </div>
  );
}
