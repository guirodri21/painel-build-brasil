"use client";

import * as React from "react";
import { createClient } from "@/lib/supabase/client";
import { KpiCard } from "@/components/kpi-card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatNumber, formatCurrency, todayISO } from "@/lib/utils";
import { sum } from "@/lib/analytics";
import type { QuadroFase, QuadroCard, FrotaVeiculo } from "@/lib/types";
import {
  CalendarClock, CalendarCheck2, ShoppingCart, Truck, HardHat,
  Clock, RotateCcw, Ban, AlertTriangle, CheckCheck, Wrench, FileWarning,
  PackageCheck, Users, Percent, MapPin, DollarSign, Car, ShieldAlert,
  Star, ThumbsDown,
} from "lucide-react";

/**
 * Painel de Indicadores Operacionais (Seção 1 do Módulo Operação).
 *
 * Blocos 2 a 6 da spec — cada bloco é a camada de LEITURA de um quadro-fonte,
 * sem lançamento manual duplicado. O Bloco 1 (Operação Geral) é renderizado
 * pelo componente `OperacaoPipelineKpis`, que traz também o funil por fase.
 *
 * Métricas que ainda não têm campo/fonte definidos (ex.: custo/km, nota média)
 * são declaradas como "aguardando fonte" — nunca preenchidas com número falso.
 */

const Q_OP = "Pipeline Operacional";
const Q_PREV = "Preventivas";
const Q_SUP = "Suprimentos";
const Q_FROTA = "Frota e Logistica";
const NOMES = [Q_OP, Q_PREV, Q_SUP, Q_FROTA];

type QuadroData = { fases: QuadroFase[]; cards: QuadroCard[] };
const VAZIO: QuadroData = { fases: [], cards: [] };

function situacao(c: QuadroCard): string {
  return String(c.valores?.situacao ?? "");
}

/** Cards que não estão em nenhuma fase final (demandas ainda abertas). */
function abertos(d: QuadroData): QuadroCard[] {
  const finais = new Set(d.fases.filter((f) => f.final).map((f) => f.nome));
  return d.cards.filter((c) => !finais.has(c.fase));
}

/** Quantos cards estão exatamente na fase informada. */
function naFase(d: QuadroData, nome: string): number {
  return d.cards.filter((c) => c.fase === nome).length;
}

/** Dias corridos desde a entrada na fase atual (ou criação). */
function diasAberto(c: QuadroCard): number {
  const iso = c.fase_desde ?? c.created_at;
  const t = new Date(iso).getTime();
  return isNaN(t) ? 0 : Math.max(0, Math.floor((Date.now() - t) / 86400000));
}

export function IndicadoresOperacionais() {
  const [dados, setDados] = React.useState<Record<string, QuadroData>>({});
  const [veiculos, setVeiculos] = React.useState<FrotaVeiculo[]>([]);
  const [tecnicos, setTecnicos] = React.useState<{ disponibilidade: string }[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let ativo = true;
    (async () => {
      const supabase = createClient();
      const { data: qs } = await supabase
        .from("quadros").select("id,nome").in("nome", NOMES).eq("ativo", true);
      const quadros = (qs as { id: string; nome: string }[]) ?? [];
      const ids = quadros.map((q) => q.id);

      const [f, c, v, t] = await Promise.all([
        ids.length ? supabase.from("quadro_fases").select("*").in("quadro_id", ids).order("ordem") : { data: [] },
        ids.length ? supabase.from("quadro_cards").select("*").in("quadro_id", ids) : { data: [] },
        supabase.from("frota_veiculos").select("*").eq("ativo", true),
        supabase.from("tecnicos").select("disponibilidade").eq("ativo", true),
      ]);
      if (!ativo) return;

      const fases = (f.data as QuadroFase[]) ?? [];
      const cards = (c.data as QuadroCard[]) ?? [];
      const byNome: Record<string, QuadroData> = {};
      for (const q of quadros) {
        byNome[q.nome] = {
          fases: fases.filter((x) => x.quadro_id === q.id),
          cards: cards.filter((x) => x.quadro_id === q.id),
        };
      }
      setDados(byNome);
      setVeiculos((v.data as FrotaVeiculo[]) ?? []);
      setTecnicos((t.data as { disponibilidade: string }[]) ?? []);
      setLoading(false);
    })();
    return () => { ativo = false; };
  }, []);

  const kpis = React.useMemo(() => {
    const g = (nome: string): QuadroData => dados[nome] ?? VAZIO;
    const hoje = todayISO();
    const op = g(Q_OP);
    const prev = g(Q_PREV);
    const sup = g(Q_SUP);
    const frota = g(Q_FROTA);

    // Bloco 2 — Agenda e Execução (fases 3 a 5 do Pipeline Operacional).
    const agenda = {
      agendadas: naFase(op, "Agendamento"),
      emCampo: naFase(op, "Em Execucao / Fechamento"),
      aguardandoFat: naFase(op, "Solicitacao de Faturamento"),
      executadas: naFase(op, "Resolvido / Concluido"),
      reagendadas: op.cards.filter((c) => /reagend/i.test(situacao(c))).length,
      naoRealizadas: op.cards.filter((c) => /improdutiv|n[aã]o realiz/i.test(situacao(c))).length,
    };

    // Bloco 3 — Preventivas (fases mapeiam 1:1 com a spec).
    const realizadas = naFase(prev, "Realizada");
    const vencidas = naFase(prev, "Vencida");
    const baseCumpr = realizadas + vencidas;
    const preventivas = {
      previstas: naFase(prev, "Prevista"),
      agendadas: naFase(prev, "Agendada"),
      reagendadas: naFase(prev, "Reagendada"),
      vencidas,
      realizadas,
      cumprimento: baseCumpr ? (realizadas / baseCumpr) * 100 : 0,
    };

    // Bloco 4 — Suprimentos (+ Estoque para "estoque baixo", ainda sem fonte).
    const supAbertos = abertos(sup);
    const suprimentos = {
      abertas: supAbertos.length,
      cotacao: naFase(sup, "Cotacao"),
      aprovacao: naFase(sup, "Aprovacao"),
      pedido: naFase(sup, "Pedido Realizado") + naFase(sup, "Recebido"),
      atrasadas: supAbertos.filter((c) => c.prazo && c.prazo < hoje).length,
      tempoMedio: supAbertos.length
        ? supAbertos.reduce((a, c) => a + diasAberto(c), 0) / supAbertos.length
        : 0,
    };

    // Bloco 5 — Frota e Logística. Disponibilidade e custo vêm do Inventário de
    // Frota (veículos); multas (R$) vêm dos cards do quadro de demandas.
    const multasCards = frota.cards.filter((c) => c.fase === "Multa / Sinistro");
    const custoTotal = sum(veiculos, (v) => v.custo_mensal);
    const docVencido = (v: FrotaVeiculo) =>
      [v.venc_documento, v.venc_seguro, v.venc_ipva].some((d) => d && d < hoje);
    const frotaKpi = {
      veiculos: veiculos.length,
      disponiveis: veiculos.filter((v) => v.status === "Disponível").length,
      parados: veiculos.filter((v) => v.status === "Parado" || v.status === "Manutenção").length,
      custoPorVeiculo: veiculos.length ? custoTotal / veiculos.length : 0,
      multasValor: sum(multasCards, (c) => c.valor),
      docsVencidos: veiculos.filter(docVencido).length,
    };

    // Bloco 6 — Equipe / Qualidade (Banco de Técnicos + avaliação nos cards OP).
    const truthy = (x: unknown) => x === true || x === "true";
    const finaisOp = new Set(op.fases.filter((f) => f.final).map((f) => f.nome));
    let notaSoma = 0, notaN = 0;
    for (const c of op.cards) {
      const raw = c.valores?.nota;
      if (raw != null && raw !== "") {
        const nn = Number(raw);
        if (Number.isFinite(nn)) { notaSoma += nn; notaN++; }
      }
    }
    const equipe = {
      tecnicosAtivos: tecnicos.length,
      notaMedia: notaN ? notaSoma / notaN : 0,
      reclamacoes: op.cards.filter((c) => truthy(c.valores?.reclamacao)).length,
      relIncompletos: op.cards.filter((c) => finaisOp.has(c.fase) && !truthy(c.valores?.relatorio_completo)).length,
      retrabalhos: op.cards.filter((c) => c.origem === "retrabalho" || c.origem === "vinculo").length,
      improdutivas: op.cards.filter((c) => /improdutiv/i.test(situacao(c))).length,
    };

    return { agenda, preventivas, suprimentos, frota: frotaKpi, equipe };
  }, [dados, veiculos, tecnicos]);

  if (loading)
    return (
      <div className="space-y-6 mb-6">
        {[0, 1, 2].map((i) => (
          <div key={i}>
            <Skeleton className="h-5 w-48 mb-2" />
            <Skeleton className="h-24" />
          </div>
        ))}
      </div>
    );

  const { agenda, preventivas, suprimentos, frota, equipe } = kpis;
  const n = (v: number) => formatNumber(v);

  return (
    <div className="space-y-6 mb-6">
      {/* Bloco 2 — Agenda e Execução */}
      <Bloco
        num={2}
        title="Agenda e Execução"
        icon={CalendarClock}
        fonte="Pipeline Operacional (fases 3–5)"
        pendente="reagendamentos detalhados vêm da subárea Reagendamentos (Seção 3)"
      >
        <KpiCard label="Agendadas" value={agenda.agendadas} format={n} tone="teal" icon={CalendarClock} />
        <KpiCard label="Técnicos em campo" value={agenda.emCampo} format={n} tone={agenda.emCampo > 0 ? "orange" : "default"} icon={HardHat} />
        <KpiCard label="Aguardando faturamento" value={agenda.aguardandoFat} format={n} icon={Clock} />
        <KpiCard label="Executadas" value={agenda.executadas} format={n} tone="green" icon={CheckCheck} />
        <KpiCard label="Reagendadas" value={agenda.reagendadas} format={n} tone={agenda.reagendadas > 0 ? "orange" : "default"} icon={RotateCcw} />
        <KpiCard label="Não realizadas" value={agenda.naoRealizadas} format={n} tone={agenda.naoRealizadas > 0 ? "red" : "default"} icon={Ban} />
      </Bloco>

      {/* Bloco 3 — Preventivas */}
      <Bloco num={3} title="Preventivas" icon={CalendarCheck2} fonte="Quadro Preventivas">
        <KpiCard label="Previstas" value={preventivas.previstas} format={n} icon={CalendarCheck2} />
        <KpiCard label="Agendadas" value={preventivas.agendadas} format={n} tone="teal" icon={CalendarClock} />
        <KpiCard label="Reagendadas" value={preventivas.reagendadas} format={n} tone={preventivas.reagendadas > 0 ? "orange" : "default"} icon={RotateCcw} />
        <KpiCard label="Vencidas" value={preventivas.vencidas} format={n} tone={preventivas.vencidas > 0 ? "red" : "default"} icon={AlertTriangle} />
        <KpiCard label="Realizadas" value={preventivas.realizadas} format={n} tone="green" icon={CheckCheck} />
        <KpiCard label="% Cumprimento" value={preventivas.cumprimento} format={(v) => v.toFixed(0) + "%"} tone="green" icon={Percent} />
      </Bloco>

      {/* Bloco 4 — Suprimentos */}
      <Bloco
        num={4}
        title="Suprimentos"
        icon={ShoppingCart}
        fonte="Quadro Suprimentos + Estoque"
        pendente="estoque baixo depende da integração com o módulo Estoque"
      >
        <KpiCard label="Solicitações abertas" value={suprimentos.abertas} format={n} tone="teal" icon={ShoppingCart} />
        <KpiCard label="Em cotação" value={suprimentos.cotacao} format={n} icon={Clock} />
        <KpiCard label="Aguardando aprovação" value={suprimentos.aprovacao} format={n} tone={suprimentos.aprovacao > 0 ? "orange" : "default"} icon={FileWarning} />
        <KpiCard label="Pedido / recebido" value={suprimentos.pedido} format={n} tone="green" icon={PackageCheck} />
        <KpiCard label="Atrasadas" value={suprimentos.atrasadas} format={n} tone={suprimentos.atrasadas > 0 ? "red" : "default"} icon={AlertTriangle} />
        <KpiCard label="Tempo médio (dias)" value={suprimentos.tempoMedio} format={(v) => v.toFixed(1) + "d"} icon={Clock} />
      </Bloco>

      {/* Bloco 5 — Frota e Logística */}
      <Bloco
        num={5}
        title="Frota e Logística"
        icon={Truck}
        fonte="Inventário de Frota + Quadro Frota e Logistica"
        pendente="custo/km e consumo de combustível dependem do registro de abastecimentos"
      >
        <KpiCard label="Veículos ativos" value={frota.veiculos} format={n} tone="teal" icon={Car} />
        <KpiCard label="Disponíveis" value={frota.disponiveis} format={n} tone="green" icon={CheckCheck} />
        <KpiCard label="Parados / manut." value={frota.parados} format={n} tone={frota.parados > 0 ? "orange" : "default"} icon={Wrench} />
        <KpiCard label="Custo / veículo (mês)" value={frota.custoPorVeiculo} format={formatCurrency} icon={DollarSign} />
        <KpiCard label="Multas / sinistros (R$)" value={frota.multasValor} format={formatCurrency} tone={frota.multasValor > 0 ? "red" : "default"} icon={AlertTriangle} />
        <KpiCard label="Docs vencidos" value={frota.docsVencidos} format={n} tone={frota.docsVencidos > 0 ? "red" : "default"} icon={ShieldAlert} />
      </Bloco>

      {/* Bloco 6 — Equipe / Qualidade */}
      <Bloco
        num={6}
        title="Equipe / Qualidade"
        icon={Users}
        fonte="Banco de Técnicos + avaliação no Pipeline"
      >
        <KpiCard label="Técnicos ativos" value={equipe.tecnicosAtivos} format={n} tone="teal" icon={Users} />
        <KpiCard label="Nota média" value={equipe.notaMedia} format={(v) => v.toFixed(1)} tone={equipe.notaMedia >= 8 ? "green" : equipe.notaMedia >= 6 ? "orange" : equipe.notaMedia > 0 ? "red" : "default"} icon={Star} />
        <KpiCard label="Reclamações" value={equipe.reclamacoes} format={n} tone={equipe.reclamacoes > 0 ? "red" : "default"} icon={ThumbsDown} />
        <KpiCard label="Rel. incompletos" value={equipe.relIncompletos} format={n} tone={equipe.relIncompletos > 0 ? "orange" : "default"} icon={FileWarning} />
        <KpiCard label="Retrabalhos" value={equipe.retrabalhos} format={n} tone={equipe.retrabalhos > 0 ? "orange" : "default"} icon={RotateCcw} />
        <KpiCard label="Improdutivas" value={equipe.improdutivas} format={n} tone={equipe.improdutivas > 0 ? "red" : "default"} icon={Ban} />
      </Bloco>
    </div>
  );
}

function Bloco({
  num,
  title,
  icon: Icon,
  fonte,
  pendente,
  children,
}: {
  num: number;
  title: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  fonte: string;
  pendente?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 mb-2">
        <Icon size={15} className="text-muted shrink-0" />
        <h3 className="text-sm font-semibold">
          <span className="text-muted font-normal">{num} ·</span> {title}
        </h3>
        <span className="text-[11px] text-muted">— {fonte}</span>
      </div>
      <div className="stagger grid gap-3 grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
        {children}
      </div>
      {pendente && (
        <p className="mt-1.5 flex items-center gap-1 text-[11px] text-muted italic">
          <MapPin size={11} className="shrink-0" /> Aguardando fonte: {pendente}
        </p>
      )}
    </div>
  );
}
