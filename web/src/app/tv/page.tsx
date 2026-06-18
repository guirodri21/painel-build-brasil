"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useData } from "@/components/data-provider";
import { createClient } from "@/lib/supabase/client";
import { BrandMark } from "@/components/brand";
import { AnimatedNumber, AnimationSpeed } from "@/components/animated-number";
import { Ticker } from "@/components/ticker";
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
import type { Meta, Ordem } from "@/lib/types";
import {
  Maximize, Minimize, X, Settings, ChevronLeft, ChevronRight,
  Pause, Play, Sun, Moon,
} from "lucide-react";

const SCENES = ["Visão Geral", "Vendas", "Operações", "Financeiro", "Metas", "Ranking"];
const N_SCENES = SCENES.length;

type Layout = "rotacao" | "grade";
type Theme = "dark" | "light";

interface TvConfig {
  enabled: boolean[];
  intervalSec: number;
  theme: Theme;
  fontScale: number;
  layout: Layout;
  ticker: boolean;
  tickerSpeed: number; // duração da volta (s); menor = mais rápido
  animMs: number; // ritmo do count-up (ms)
}
const DEFAULT_CONFIG: TvConfig = {
  enabled: [true, true, true, true, true, true],
  intervalSec: 15,
  theme: "dark",
  fontScale: 1,
  layout: "rotacao",
  ticker: true,
  tickerSpeed: 40,
  animMs: 900,
};

function loadConfig(): TvConfig {
  if (typeof window === "undefined") return DEFAULT_CONFIG;
  try {
    const raw = localStorage.getItem("bb-tv-config");
    if (raw) {
      const c = JSON.parse(raw);
      // migra configs antigas (4 cenas) preenchendo as novas como ativas
      let enabled = DEFAULT_CONFIG.enabled;
      if (Array.isArray(c.enabled)) {
        enabled = Array.from({ length: N_SCENES }, (_, i) =>
          typeof c.enabled[i] === "boolean" ? c.enabled[i] : true,
        );
      }
      return {
        enabled,
        intervalSec: typeof c.intervalSec === "number" ? c.intervalSec : DEFAULT_CONFIG.intervalSec,
        theme: c.theme === "light" ? "light" : "dark",
        fontScale: typeof c.fontScale === "number" ? Math.max(0.8, Math.min(1.4, c.fontScale)) : 1,
        layout: c.layout === "grade" ? "grade" : "rotacao",
        ticker: typeof c.ticker === "boolean" ? c.ticker : DEFAULT_CONFIG.ticker,
        tickerSpeed: typeof c.tickerSpeed === "number" ? Math.max(15, Math.min(90, c.tickerSpeed)) : DEFAULT_CONFIG.tickerSpeed,
        animMs: typeof c.animMs === "number" ? Math.max(300, Math.min(2000, c.animMs)) : DEFAULT_CONFIG.animMs,
      };
    }
  } catch {}
  return DEFAULT_CONFIG;
}

export default function TvPage() {
  const router = useRouter();
  const { ordens, despesas, metas, equipes, loading } = useData();
  const [config, setConfig] = React.useState<TvConfig>(DEFAULT_CONFIG);
  const [pointer, setPointer] = React.useState(0);
  const [paused, setPaused] = React.useState(false);
  const [now, setNow] = React.useState(() => new Date());
  const [fs, setFs] = React.useState(false);
  const [showCfg, setShowCfg] = React.useState(false);

  React.useEffect(() => setConfig(loadConfig()), []);

  const active = config.enabled
    .map((on, i) => (on ? i : -1))
    .filter((i) => i >= 0);
  const activeScenes = active.length ? active : [0, 1, 2, 3, 4, 5];
  const scene = activeScenes[pointer % activeScenes.length];
  const isGrid = config.layout === "grade";

  // Aplica tema configurado (restaura ao sair)
  React.useEffect(() => {
    const prev = document.documentElement.getAttribute("data-theme");
    document.documentElement.setAttribute("data-theme", config.theme);
    return () => { if (prev) document.documentElement.setAttribute("data-theme", prev); };
  }, [config.theme]);

  // Rotação automática (só no modo rotação e quando não pausado)
  React.useEffect(() => {
    if (isGrid || paused) return;
    const ms = Math.max(5, config.intervalSec) * 1000;
    const id = setInterval(() => setPointer((p) => p + 1), ms);
    return () => clearInterval(id);
  }, [config.intervalSec, activeScenes.length, isGrid, paused]);

  // Relógio
  React.useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  // TV ligada 24/7: revalida a sessão a cada 30 min para manter o token vivo
  React.useEffect(() => {
    const supabase = createClient();
    const id = setInterval(() => {
      supabase.auth.getSession();
    }, 30 * 60 * 1000);
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

  // Realizado (receita) por equipe+mês — para a cena de metas
  const realizado = React.useMemo(() => {
    const map: Record<string, number> = {};
    const byKey = groupBy(ordens, (o) => `${o.equipe}|${o.data.substring(0, 7)}`);
    for (const [key, items] of Object.entries(byKey)) map[key] = sum(items, (o) => o.valor_venda);
    return map;
  }, [ordens]);

  // Destaques do letreiro (ticker)
  const tickerItems = React.useMemo(() => {
    const items: string[] = [];
    items.push(`💰 Receita total: ${formatCurrency(recTotal)}`);
    items.push(`${saldo >= 0 ? "📈" : "📉"} Saldo geral: ${formatCurrency(saldo)}`);
    items.push(`📊 Margem: ${margem.toFixed(1).replace(".", ",")}%`);
    if (op.qualMedia > 0) items.push(`⭐ Qualidade média: ${op.qualMedia.toFixed(0)}`);
    items.push(`📋 ${v.n} ordens · ${op.andamento} em aberto`);

    const entries = Object.entries(res).filter(([, x]) => x.n > 0);
    if (entries.length) {
      const lider = [...entries].sort((a, b) => b[1].saldo - a[1].saldo)[0];
      items.push(`🏆 Líder: ${lider[0]} (${formatCurrency(lider[1].saldo)})`);
      entries
        .filter(([, x]) => x.saldo < 0)
        .forEach(([eq]) => items.push(`⚠️ ${eq}: saldo negativo`));
    }

    const porRegiao = Object.entries(groupBy(ordens, (o) => o.regiao))
      .map(([name, arr]) => ({ name, total: sum(arr, (o) => o.valor_venda) }))
      .sort((a, b) => b.total - a.total);
    if (porRegiao.length) items.push(`📍 Região destaque: ${porRegiao[0].name} (${formatCurrency(porRegiao[0].total)})`);

    return items;
  }, [recTotal, saldo, margem, op, v.n, res, ordens]);

  const clock = now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  const dateStr = now.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" });

  function renderScene(s: number) {
    switch (s) {
      case 0: return <SceneGeral recTotal={recTotal} saldo={saldo} ordens={v.n} qualidade={op.qualMedia} andamento={op.andamento} res={res} />;
      case 1: return <SceneVendas ordens={ordens} total={v.total} ticket={v.ticket} />;
      case 2: return <SceneOps ordens={ordens} op={op} />;
      case 3: return <SceneFin ordens={ordens} despesas={despesas} recTotal={recTotal} despTotal={despTotal + ddTotal} saldo={saldo} margem={margem} />;
      case 4: return <SceneMetas metas={metas} realizado={realizado} />;
      default: return <SceneRanking res={res} />;
    }
  }

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
          <span className="live-pulse flex items-center gap-2 rounded-full bg-red-soft px-3 py-1">
            <span className="h-2 w-2 rounded-full bg-red animate-pulse" />
            <span className="text-xs font-semibold text-red tracking-wide">AO VIVO</span>
          </span>
          <div className="text-right">
            <div className="text-2xl font-bold tabular-nums leading-none">{clock}</div>
            <div className="text-xs text-muted capitalize">{dateStr}</div>
          </div>

          {!isGrid && (
            <div className="flex items-center gap-1 ml-2">
              <CtrlBtn onClick={() => setPointer((p) => p - 1)} title="Anterior"><ChevronLeft size={18} /></CtrlBtn>
              <CtrlBtn onClick={() => setPaused((p) => !p)} title={paused ? "Retomar" : "Pausar"}>
                {paused ? <Play size={18} /> : <Pause size={18} />}
              </CtrlBtn>
              <CtrlBtn onClick={() => setPointer((p) => p + 1)} title="Próxima"><ChevronRight size={18} /></CtrlBtn>
            </div>
          )}

          <div className="relative">
            <CtrlBtn onClick={() => setShowCfg((s) => !s)} title="Configurar"><Settings size={18} /></CtrlBtn>
            {showCfg && (
              <ConfigPanel config={config} onChange={updateConfig} onClose={() => setShowCfg(false)} />
            )}
          </div>
          <CtrlBtn onClick={toggleFullscreen} title="Tela cheia">
            {fs ? <Minimize size={18} /> : <Maximize size={18} />}
          </CtrlBtn>
          <CtrlBtn onClick={() => router.push("/")} title="Sair do modo TV"><X size={18} /></CtrlBtn>
        </div>
      </header>

      {!isGrid && (
        <div className="flex items-center justify-between px-8 pt-5 shrink-0">
          <h1 className="text-3xl font-bold tracking-tight">
            {SCENES[scene]}{paused && <span className="ml-3 text-base font-medium text-muted">⏸ pausado</span>}
          </h1>
          <div className="flex gap-2">
            {activeScenes.map((s, i) => (
              <span key={s} className={cn("h-2 rounded-full transition-all duration-500", i === pointer % activeScenes.length ? "w-10 bg-primary" : "w-2 bg-border")} />
            ))}
          </div>
        </div>
      )}

      <main
        key={isGrid ? "grid" : scene}
        className={cn("flex-1 px-8 py-5 animate-in", isGrid ? "overflow-y-auto" : "overflow-hidden")}
        style={{ zoom: config.fontScale }}
      >
        <AnimationSpeed value={config.animMs}>
        {loading ? (
          <div className="h-full flex items-center justify-center text-muted text-lg">Carregando dados…</div>
        ) : isGrid ? (
          <div className={cn("stagger grid gap-5", activeScenes.length <= 1 ? "grid-cols-1" : activeScenes.length <= 4 ? "grid-cols-2" : "grid-cols-2 xl:grid-cols-3")}>
            {activeScenes.map((s) => (
              <div key={s} className="rounded-2xl border border-border bg-surface/40 p-4">
                <h2 className="text-lg font-bold mb-3">{SCENES[s]}</h2>
                <div className="min-h-[340px]">{renderScene(s)}</div>
              </div>
            ))}
          </div>
        ) : (
          renderScene(scene)
        )}
        </AnimationSpeed>
      </main>

      {!loading && config.ticker && tickerItems.length > 0 && (
        <footer className="shrink-0 border-t border-border bg-surface/60 py-2.5">
          <Ticker items={tickerItems} speed={config.tickerSpeed} />
        </footer>
      )}
    </div>
  );
}

function CtrlBtn({ onClick, title, children }: { onClick: () => void; title: string; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className="p-2 rounded-lg border border-border text-muted hover:text-foreground cursor-pointer" title={title}>
      {children}
    </button>
  );
}

/* ===== Painel de configuração ===== */
function ConfigPanel({ config, onChange, onClose }: { config: TvConfig; onChange: (c: TvConfig) => void; onClose: () => void }) {
  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div className="absolute right-0 top-12 z-50 w-80 rounded-xl border border-border bg-surface shadow-lg p-4 max-h-[80vh] overflow-y-auto">
        <div className="text-sm font-semibold mb-3">Configurar Modo TV</div>

        <div className="mb-4">
          <div className="text-xs text-muted mb-1.5">Visualização</div>
          <div className="grid grid-cols-2 gap-1.5">
            {(["rotacao", "grade"] as Layout[]).map((l) => (
              <button
                key={l}
                onClick={() => onChange({ ...config, layout: l })}
                className={cn(
                  "rounded-lg border px-2 py-1.5 text-xs font-medium cursor-pointer transition-colors",
                  config.layout === l ? "border-primary text-primary bg-primary-soft" : "border-border text-muted hover:text-foreground",
                )}
              >
                {l === "rotacao" ? "Rotação" : "Grade"}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2 mb-4">
          <div className="text-xs text-muted mb-1">Telas exibidas</div>
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

        {config.layout === "rotacao" && (
          <div className="mb-4">
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
        )}

        <div className="mb-4">
          <div className="text-xs text-muted mb-1.5">Tema</div>
          <div className="grid grid-cols-2 gap-1.5">
            {(["dark", "light"] as Theme[]).map((t) => (
              <button
                key={t}
                onClick={() => onChange({ ...config, theme: t })}
                className={cn(
                  "inline-flex items-center justify-center gap-1.5 rounded-lg border px-2 py-1.5 text-xs font-medium cursor-pointer transition-colors",
                  config.theme === t ? "border-primary text-primary bg-primary-soft" : "border-border text-muted hover:text-foreground",
                )}
              >
                {t === "dark" ? <Moon size={13} /> : <Sun size={13} />}
                {t === "dark" ? "Escuro" : "Claro"}
              </button>
            ))}
          </div>
        </div>

        <div className="mb-4">
          <div className="text-xs text-muted mb-1">Escala da fonte ({config.fontScale.toFixed(2)}×)</div>
          <input
            type="range"
            min={0.8}
            max={1.4}
            step={0.05}
            value={config.fontScale}
            onChange={(e) => onChange({ ...config, fontScale: Number(e.target.value) })}
            className="w-full accent-[var(--primary)] cursor-pointer"
          />
        </div>

        <div className="mb-4">
          <div className="text-xs text-muted mb-1.5">Ritmo das animações</div>
          <div className="grid grid-cols-3 gap-1.5">
            {([["Rápido", 500], ["Normal", 900], ["Lento", 1500]] as [string, number][]).map(([lbl, ms]) => (
              <button
                key={ms}
                onClick={() => onChange({ ...config, animMs: ms })}
                className={cn(
                  "rounded-lg border px-2 py-1.5 text-xs font-medium cursor-pointer transition-colors",
                  config.animMs === ms ? "border-primary text-primary bg-primary-soft" : "border-border text-muted hover:text-foreground",
                )}
              >
                {lbl}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="flex items-center gap-2 text-sm cursor-pointer mb-2">
            <input
              type="checkbox"
              checked={config.ticker}
              onChange={(e) => onChange({ ...config, ticker: e.target.checked })}
              className="accent-[var(--primary)]"
            />
            Letreiro de destaques (rodapé)
          </label>
          {config.ticker && (
            <div className="grid grid-cols-3 gap-1.5">
              {([["Rápido", 25], ["Médio", 40], ["Lento", 60]] as [string, number][]).map(([lbl, s]) => (
                <button
                  key={s}
                  onClick={() => onChange({ ...config, tickerSpeed: s })}
                  className={cn(
                    "rounded-lg border px-2 py-1.5 text-xs font-medium cursor-pointer transition-colors",
                    config.tickerSpeed === s ? "border-primary text-primary bg-primary-soft" : "border-border text-muted hover:text-foreground",
                  )}
                >
                  {lbl}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

/* ===== KPI grande ===== */
function BigKpi({ label, value, format, tone = "default" }: {
  label: string; value: string | number; format?: (n: number) => string; tone?: string;
}) {
  const color =
    tone === "green" ? "text-green" : tone === "red" ? "text-red" :
    tone === "orange" ? "text-orange" : tone === "teal" ? "text-teal" : "text-primary";
  return (
    <div className="rounded-2xl border border-border bg-surface px-6 py-5 flex flex-col justify-center transition-transform hover:scale-[1.02]">
      <span className="text-sm font-medium text-muted">{label}</span>
      <span className={cn("mt-2 text-[2.75rem] leading-none font-bold tracking-tight tabular-nums", color)}>
        {typeof value === "number" && format ? <AnimatedNumber value={value} format={format} /> : value}
      </span>
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
      <div className="stagger grid grid-cols-5 gap-4 flex-1">
        <BigKpi label="Receita Total" value={recTotal} format={(n) => formatCurrency(n)} />
        <BigKpi label="Saldo Geral" value={saldo} format={(n) => formatCurrency(n)} tone={saldo >= 0 ? "green" : "red"} />
        <BigKpi label="Ordens" value={ordens} format={(n) => Math.round(n).toString()} tone="teal" />
        <BigKpi label="Qualidade Média" value={qualidade} format={(n) => n.toFixed(0)} tone={qualidade < 80 ? "orange" : "teal"} />
        <BigKpi label="Em Andamento" value={andamento} format={(n) => Math.round(n).toString()} tone={andamento > 0 ? "orange" : "default"} />
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
function SceneVendas({ ordens, total, ticket }: { ordens: Ordem[]; total: number; ticket: number }) {
  const byField = (f: (o: Ordem) => string) =>
    Object.entries(groupBy(ordens, f))
      .map(([name, items]) => ({ name, value: sum(items, (o) => o.valor_venda) }))
      .sort((a, b) => b.value - a.value);
  const porRegiao = byField((o) => o.regiao);
  const porEquipe = byField((o) => o.equipe);

  return (
    <div className="h-full grid grid-cols-3 gap-5">
      <div className="stagger flex flex-col gap-4">
        <BigKpi label="Total de Vendas" value={total} format={(n) => formatCurrency(n)} />
        <BigKpi label="Ticket Médio" value={ticket} format={(n) => formatCurrency(n)} tone="teal" />
      </div>
      <Panel title="Vendas por Região"><DonutChart data={porRegiao} height={420} /></Panel>
      <Panel title="Vendas por Equipe"><HBarChart data={porEquipe} color={CHART_COLORS[1]} height={420} /></Panel>
    </div>
  );
}

/* ===== Cena: Operações ===== */
function SceneOps({ ordens, op }: { ordens: Ordem[]; op: ReturnType<typeof calcOps> }) {
  const qualidade = Object.entries(qualidadeMediaPorEquipe(ordens)).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  const tempo = Object.entries(tempoMedioPorEquipe(ordens)).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  return (
    <div className="h-full flex flex-col gap-5">
      <div className="stagger grid grid-cols-4 gap-4">
        <BigKpi label="Tempo Médio" value={op.tempoMedio} format={(n) => n.toFixed(1) + "h"} />
        <BigKpi label="Qualidade Média" value={op.qualMedia} format={(n) => n.toFixed(0)} tone="teal" />
        <BigKpi label="Taxa Conclusão" value={op.taxaConc} format={(n) => n.toFixed(0) + "%"} tone="green" />
        <BigKpi label="Em Andamento" value={op.andamento} format={(n) => Math.round(n).toString()} tone={op.andamento > 0 ? "orange" : "default"} />
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
  ordens: Ordem[]; despesas: Parameters<typeof balancoMensal>[1];
  recTotal: number; despTotal: number; saldo: number; margem: number;
}) {
  const balanco = balancoMensal(ordens, despesas).map((b) => ({ ...b, mes: monthLabel(b.mes) }));
  return (
    <div className="h-full grid grid-cols-3 gap-5">
      <div className="stagger flex flex-col gap-4">
        <BigKpi label="Receita" value={recTotal} format={(n) => formatCurrency(n)} />
        <BigKpi label="Despesas" value={despTotal} format={(n) => formatCurrency(n)} tone="orange" />
        <BigKpi label="Saldo" value={saldo} format={(n) => formatCurrency(n)} tone={saldo >= 0 ? "green" : "red"} />
        <BigKpi label="Margem" value={margem} format={(n) => n.toFixed(1).replace(".", ",") + "%"} tone={margem >= 0 ? "green" : "red"} />
      </div>
      <div className="col-span-2">
        <Panel title="Balanço Mensal"><BalancoChart data={balanco} height={440} /></Panel>
      </div>
    </div>
  );
}

/* ===== Cena: Metas ===== */
function SceneMetas({ metas, realizado }: { metas: Meta[]; realizado: Record<string, number> }) {
  const linhas = [...metas]
    .sort((a, b) => b.mes.localeCompare(a.mes))
    .slice(0, 6)
    .map((m) => {
      const real = realizado[`${m.equipe}|${m.mes.substring(0, 7)}`] ?? 0;
      const pct = m.meta_receita > 0 ? (real / m.meta_receita) * 100 : 0;
      return { m, real, pct };
    });

  if (!linhas.length)
    return <div className="h-full flex items-center justify-center text-muted text-lg">Nenhuma meta definida.</div>;

  return (
    <div className="stagger h-full flex flex-col gap-4 justify-center">
      {linhas.map(({ m, real, pct }) => (
        <div key={m.id} className="rounded-2xl border border-border bg-surface px-5 py-4">
          <div className="flex items-center justify-between mb-2">
            <div className="text-lg font-semibold">{m.equipe} <span className="text-muted text-sm font-normal">· {monthLabel(m.mes.substring(0, 7))}</span></div>
            <div className="text-base tabular-nums">
              {formatCurrency(real)} <span className="text-muted">/ {formatCurrency(m.meta_receita)}</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="h-3 flex-1 rounded-full bg-surface-2 overflow-hidden">
              <span
                className={cn("animate-bar block h-full rounded-full transition-all duration-700", pct >= 100 ? "bg-green" : pct >= 70 ? "bg-yellow" : "bg-red")}
                style={{ width: `${Math.min(pct, 100)}%` }}
              />
            </span>
            <span className={cn("text-xl font-bold tabular-nums w-20 text-right", pct >= 100 ? "text-green" : pct >= 70 ? "text-yellow" : "text-red")}>
              <AnimatedNumber value={pct} format={(n) => n.toFixed(0) + "%"} />
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ===== Cena: Ranking ===== */
function SceneRanking({ res }: { res: Record<string, { rec: number; saldo: number; n: number }> }) {
  const linhas = Object.entries(res)
    .filter(([, x]) => x.n > 0)
    .sort((a, b) => b[1].saldo - a[1].saldo);

  if (!linhas.length)
    return <div className="h-full flex items-center justify-center text-muted text-lg">Sem dados para o ranking.</div>;

  const medals = ["🥇", "🥈", "🥉"];
  return (
    <div className="stagger h-full flex flex-col gap-3 justify-center">
      {linhas.map(([eq, x], i) => (
        <div key={eq} className={cn(
          "flex items-center gap-4 rounded-2xl border px-5 py-4",
          i === 0 ? "border-green bg-green-soft" : "border-border bg-surface",
        )}>
          <span className="text-2xl font-bold w-12 text-center tabular-nums">{medals[i] ?? `${i + 1}º`}</span>
          <span className="flex-1 text-xl font-semibold">{eq}</span>
          <span className="text-base text-muted tabular-nums">{x.n} ordens</span>
          <span className="text-base text-muted tabular-nums">{formatCurrency(x.rec)}</span>
          <span className={cn("text-2xl font-bold tabular-nums w-40 text-right", x.saldo >= 0 ? "text-green" : "text-red")}>
            {formatCurrency(x.saldo)}
          </span>
        </div>
      ))}
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
