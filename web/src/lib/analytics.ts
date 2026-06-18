import type { Ordem, DespesaGeral, OrdemStatus } from "@/lib/types";
import { STATUS_LABELS } from "@/lib/types";

export function sum<T>(arr: T[], key: (item: T) => number): number {
  return arr.reduce((s, item) => s + (key(item) || 0), 0);
}

export function groupBy<T>(arr: T[], key: (item: T) => string): Record<string, T[]> {
  return arr.reduce<Record<string, T[]>>((acc, item) => {
    const k = key(item);
    (acc[k] = acc[k] || []).push(item);
    return acc;
  }, {});
}

export function calcVendas(ordens: Ordem[]) {
  const total = sum(ordens, (o) => o.valor_venda);
  const n = ordens.length;
  return { total, n, ticket: n ? total / n : 0 };
}

export function calcOps(ordens: Ordem[]) {
  const done = ordens.filter((o) => o.status === "concluido");
  const ct = done.filter((o) => o.tempo_execucao_h != null);
  const cq = ordens.filter((o) => o.qualidade != null);
  const andamento = ordens.filter((o) => o.status === "em_andamento").length;
  return {
    tempoMedio: ct.length ? sum(ct, (o) => o.tempo_execucao_h!) / ct.length : 0,
    qualMedia: cq.length ? sum(cq, (o) => o.qualidade!) / cq.length : 0,
    taxaConc: ordens.length ? (done.length / ordens.length) * 100 : 0,
    andamento,
    concluidas: done.length,
  };
}

export interface RateioEquipe {
  rec: number;
  dd: number;
  dr: number;
  saldo: number;
  margem: number;
  n: number;
}

export function calcRateio(
  ordens: Ordem[],
  despesas: DespesaGeral[],
  equipes: string[],
) {
  const recTotal = sum(ordens, (o) => o.valor_venda);
  const despTotal = sum(despesas, (d) => d.valor);
  const byEq = groupBy(ordens, (o) => o.equipe);
  const res: Record<string, RateioEquipe> = {};
  for (const eq of equipes) {
    const items = byEq[eq] || [];
    const rec = sum(items, (o) => o.valor_venda);
    const dd = sum(items, (o) => o.despesa_direta);
    const prop = recTotal > 0 ? rec / recTotal : 0;
    const dr = despTotal * prop;
    const saldo = rec - dd - dr;
    const margem = rec > 0 ? (saldo / rec) * 100 : 0;
    res[eq] = { rec, dd, dr, saldo, margem, n: items.length };
  }
  return { res, recTotal, despTotal };
}

export function qualidadeMediaPorEquipe(ordens: Ordem[]): Record<string, number> {
  const byEq = groupBy(
    ordens.filter((o) => o.qualidade != null),
    (o) => o.equipe,
  );
  const out: Record<string, number> = {};
  for (const [eq, items] of Object.entries(byEq)) {
    out[eq] = sum(items, (o) => o.qualidade!) / items.length;
  }
  return out;
}

export function tempoMedioPorEquipe(ordens: Ordem[]): Record<string, number> {
  const byEq = groupBy(
    ordens.filter((o) => o.status === "concluido" && o.tempo_execucao_h != null),
    (o) => o.equipe,
  );
  const out: Record<string, number> = {};
  for (const [eq, items] of Object.entries(byEq)) {
    out[eq] = sum(items, (o) => o.tempo_execucao_h!) / items.length;
  }
  return out;
}

export interface MonthBucket {
  mes: string;
  receita: number;
  despesa: number;
  saldo: number;
}

export function balancoMensal(
  ordens: Ordem[],
  despesas: DespesaGeral[],
): MonthBucket[] {
  const byM: Record<string, { r: number; dd: number; dg: number }> = {};
  for (const o of ordens) {
    const m = o.data.substring(0, 7);
    (byM[m] = byM[m] || { r: 0, dd: 0, dg: 0 }).r += o.valor_venda;
    byM[m].dd += o.despesa_direta;
  }
  for (const d of despesas) {
    const m = d.data.substring(0, 7);
    (byM[m] = byM[m] || { r: 0, dd: 0, dg: 0 }).dg += d.valor;
  }
  return Object.keys(byM)
    .sort()
    .map((m) => {
      const b = byM[m];
      const despesa = b.dd + b.dg;
      return { mes: m, receita: b.r, despesa, saldo: b.r - despesa };
    });
}

export interface Filtros {
  regiao: string;
  equipe: string;
  linha: string;
  de: string;
  ate: string;
  busca: string;
  status: string;
  cliente: string;
  valorMin: string;
  valorMax: string;
  qualMin: string;
  qualMax: string;
}

export const EMPTY_FILTROS: Filtros = {
  regiao: "",
  equipe: "",
  linha: "",
  de: "",
  ate: "",
  busca: "",
  status: "",
  cliente: "",
  valorMin: "",
  valorMax: "",
  qualMin: "",
  qualMax: "",
};

/** Janela do período anterior, do mesmo tamanho da janela atual.
 *  Sem de/ate definidos → compara mês corrente vs mês anterior. */
export function previousPeriod(f: Filtros): { de: string; ate: string } {
  const toISO = (d: Date) => d.toISOString().split("T")[0];
  if (f.de && f.ate) {
    const de = new Date(f.de + "T00:00:00");
    const ate = new Date(f.ate + "T00:00:00");
    const dias = Math.round((ate.getTime() - de.getTime()) / 86400000) + 1;
    const prevAte = new Date(de);
    prevAte.setDate(prevAte.getDate() - 1);
    const prevDe = new Date(prevAte);
    prevDe.setDate(prevDe.getDate() - (dias - 1));
    return { de: toISO(prevDe), ate: toISO(prevAte) };
  }
  // sem datas: mês anterior completo
  const now = new Date();
  const ini = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const fim = new Date(now.getFullYear(), now.getMonth(), 0);
  return { de: toISO(ini), ate: toISO(fim) };
}

/** Variação percentual entre atual e anterior. null se base = 0. */
export function calcDelta(atual: number, anterior: number): number | null {
  if (anterior === 0) return atual === 0 ? 0 : null;
  return ((atual - anterior) / Math.abs(anterior)) * 100;
}

export function applyFiltros(ordens: Ordem[], f: Filtros): Ordem[] {
  const q = f.busca.toLowerCase();
  const vMin = f.valorMin !== "" ? Number(f.valorMin) : null;
  const vMax = f.valorMax !== "" ? Number(f.valorMax) : null;
  const qMin = f.qualMin !== "" ? Number(f.qualMin) : null;
  const qMax = f.qualMax !== "" ? Number(f.qualMax) : null;
  return ordens.filter((o) => {
    if (f.regiao && o.regiao !== f.regiao) return false;
    if (f.equipe && o.equipe !== f.equipe) return false;
    if (f.linha && o.linha_servico !== f.linha) return false;
    if (f.status && o.status !== f.status) return false;
    if (f.cliente && o.cliente !== f.cliente) return false;
    if (f.de && o.data < f.de) return false;
    if (f.ate && o.data > f.ate) return false;
    if (vMin != null && o.valor_venda < vMin) return false;
    if (vMax != null && o.valor_venda > vMax) return false;
    if (qMin != null || qMax != null) {
      if (o.qualidade == null) return false;
      if (qMin != null && o.qualidade < qMin) return false;
      if (qMax != null && o.qualidade > qMax) return false;
    }
    if (q) {
      const hay = [o.cliente, o.resumo, o.equipe, o.regiao, o.linha_servico]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

/** Distribuição de ordens por status (para gráfico de rosca). */
export function statusDistribution(ordens: Ordem[]): { name: string; value: number }[] {
  const order: OrdemStatus[] = ["em_andamento", "execucao_parcial", "concluido"];
  return order
    .map((s) => ({
      name: STATUS_LABELS[s],
      value: ordens.filter((o) => o.status === s).length,
    }))
    .filter((x) => x.value > 0);
}

/** Taxa de conclusão (%) por equipe. */
export function taxaConclusaoPorEquipe(ordens: Ordem[]): Record<string, number> {
  const byEq = groupBy(ordens, (o) => o.equipe);
  const out: Record<string, number> = {};
  for (const [eq, items] of Object.entries(byEq)) {
    const done = items.filter((o) => o.status === "concluido").length;
    out[eq] = items.length ? (done / items.length) * 100 : 0;
  }
  return out;
}

/** Quantidade de ordens por mês (série temporal). */
export function ordensPorMes(ordens: Ordem[]): { name: string; value: number }[] {
  const byM = groupBy(ordens, (o) => o.data.substring(0, 7));
  return Object.keys(byM)
    .sort()
    .map((m) => ({ name: m, value: byM[m].length }));
}
