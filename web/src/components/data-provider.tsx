"use client";

import * as React from "react";
import { createClient } from "@/lib/supabase/client";
import type { Ordem, DespesaGeral, Meta, Produto, EstoqueMovimento, Cliente, Conta, Chamado, ChamadoFase } from "@/lib/types";

const FILIAL_KEY = "painel.filial";

interface RawData {
  ordens: Ordem[];
  despesas: DespesaGeral[];
  metas: Meta[];
  produtos: Produto[];
  movimentos: EstoqueMovimento[];
  clientesReg: Cliente[];
  contas: Conta[];
  chamados: Chamado[];
  chamadoFases: ChamadoFase[];
  equipes: string[];
  regioes: string[];
  linhas: string[];
  filiais: string[];
}

interface DataState extends RawData {
  /** Nomes de clientes (registro + citados em ordens) para autocompletar/filtrar. */
  clientes: string[];
  /** Filial selecionada ("" = todas). */
  filial: string;
  setFilial: (f: string) => void;
  userId: string | null;
  role: "admin" | "membro" | null;
  isAdmin: boolean;
  podeFinanceiro: boolean;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

const Ctx = React.createContext<DataState | null>(null);

export function useData() {
  const ctx = React.useContext(Ctx);
  if (!ctx) throw new Error("useData deve ser usado dentro de DataProvider");
  return ctx;
}

const EMPTY_RAW: RawData = {
  ordens: [], despesas: [], metas: [], produtos: [], movimentos: [], clientesReg: [], contas: [],
  chamados: [], chamadoFases: [],
  equipes: [], regioes: [], linhas: [], filiais: [],
};

export function DataProvider({ children }: { children: React.ReactNode }) {
  const supabase = React.useMemo(() => createClient(), []);
  const [raw, setRaw] = React.useState<RawData>(EMPTY_RAW);
  const [meta, setMeta] = React.useState<{
    userId: string | null;
    role: "admin" | "membro" | null;
    podeFinanceiro: boolean;
    loading: boolean;
    error: string | null;
  }>({ userId: null, role: null, podeFinanceiro: true, loading: true, error: null });
  const [filial, setFilialState] = React.useState<string>("");

  // Restaura a filial salva
  React.useEffect(() => {
    const saved = typeof window !== "undefined" ? localStorage.getItem(FILIAL_KEY) : null;
    if (saved) setFilialState(saved);
  }, []);

  const setFilial = React.useCallback((f: string) => {
    setFilialState(f);
    if (typeof window !== "undefined") localStorage.setItem(FILIAL_KEY, f);
  }, []);

  const load = React.useCallback(async () => {
    setMeta((m) => ({ ...m, loading: true, error: null }));
    const { data: userData } = await supabase.auth.getUser();
    const uid = userData.user?.id ?? null;

    const [eq, rg, ls, fl, ord, desp, met, prod, mov, cli, con, cha, fas, prof] = await Promise.allSettled([
      supabase.from("equipes").select("nome").order("nome"),
      supabase.from("regioes").select("nome").order("nome"),
      supabase.from("linhas_servico").select("nome").order("nome"),
      supabase.from("filiais").select("nome").eq("ativo", true).order("nome"),
      supabase.from("ordens").select("*").order("data", { ascending: false }),
      supabase.from("despesas_gerais").select("*").order("data", { ascending: false }),
      supabase.from("metas").select("*").order("mes", { ascending: false }),
      supabase.from("produtos").select("*").order("nome"),
      supabase.from("estoque_movimentos").select("*").order("created_at", { ascending: false }).limit(500),
      supabase.from("clientes").select("*").order("nome"),
      supabase.from("contas").select("*").order("vencimento"),
      supabase.from("chamados").select("*").order("created_at", { ascending: false }),
      supabase.from("chamado_fases").select("*").order("ordem"),
      uid ? supabase.from("profiles").select("role, pode_financeiro").eq("id", uid).single() : Promise.resolve({ data: null }),
    ]);

    // Extrai dados de cada resultado sem deixar uma falha derrubar o resto.
    const failures: string[] = [];
    const pick = <T,>(r: PromiseSettledResult<{ data: T | null; error?: unknown } | { data: T | null }>, label: string, fallback: T): T => {
      if (r.status === "fulfilled") {
        const e = (r.value as { error?: unknown }).error;
        if (e) { failures.push(label); return fallback; }
        return (r.value.data as T) ?? fallback;
      }
      failures.push(label);
      return fallback;
    };

    const names = (r: PromiseSettledResult<{ data: { nome: string }[] | null; error?: unknown }>, label: string) =>
      pick(r, label, [] as { nome: string }[]).map((x) => x.nome);

    setRaw({
      equipes: names(eq as never, "equipes"),
      regioes: names(rg as never, "regiões"),
      linhas: names(ls as never, "linhas de serviço"),
      filiais: names(fl as never, "filiais"),
      ordens: pick(ord as never, "ordens", [] as Ordem[]),
      despesas: pick(desp as never, "despesas", [] as DespesaGeral[]),
      metas: pick(met as never, "metas", [] as Meta[]),
      produtos: pick(prod as never, "produtos", [] as Produto[]),
      movimentos: pick(mov as never, "movimentações", [] as EstoqueMovimento[]),
      clientesReg: pick(cli as never, "clientes", [] as Cliente[]),
      contas: pick(con as never, "contas", [] as Conta[]),
      chamados: pick(cha as never, "chamados", [] as Chamado[]),
      chamadoFases: pick(fas as never, "fases", [] as ChamadoFase[]),
    });

    const profData = prof.status === "fulfilled"
      ? (prof.value as { data: { role?: string; pode_financeiro?: boolean } | null }).data
      : null;
    const role = (profData?.role as "admin" | "membro" | undefined) ?? "membro";
    const podeFinanceiro = profData?.pode_financeiro !== false;

    setMeta({
      userId: uid,
      role,
      podeFinanceiro,
      loading: false,
      error: failures.length ? `Falha ao carregar: ${failures.join(", ")}.` : null,
    });
  }, [supabase]);

  React.useEffect(() => { load(); }, [load]);

  // Realtime: recarrega ao detectar mudanças
  React.useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const debounced = () => {
      clearTimeout(timer);
      timer = setTimeout(load, 600);
    };
    const channel = supabase
      .channel("painel-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "ordens" }, debounced)
      .on("postgres_changes", { event: "*", schema: "public", table: "despesas_gerais" }, debounced)
      .on("postgres_changes", { event: "*", schema: "public", table: "metas" }, debounced)
      .on("postgres_changes", { event: "*", schema: "public", table: "produtos" }, debounced)
      .on("postgres_changes", { event: "*", schema: "public", table: "estoque_movimentos" }, debounced)
      .on("postgres_changes", { event: "*", schema: "public", table: "contas" }, debounced)
      .on("postgres_changes", { event: "*", schema: "public", table: "clientes" }, debounced)
      .on("postgres_changes", { event: "*", schema: "public", table: "chamados" }, debounced)
      .subscribe();
    return () => {
      clearTimeout(timer);
      supabase.removeChannel(channel);
    };
  }, [supabase, load]);

  // Aplica o filtro de filial centralmente (vazio = todas)
  const value = React.useMemo<DataState>(() => {
    const f = filial;
    const byFilial = <T extends { filial?: string | null }>(arr: T[]) =>
      f ? arr.filter((x) => (x.filial ?? "Matriz") === f) : arr;

    const ordens = byFilial(raw.ordens);
    const produtos = byFilial(raw.produtos);
    const produtoIds = new Set(produtos.map((p) => p.id));
    const movimentos = f ? raw.movimentos.filter((m) => produtoIds.has(m.produto_id)) : raw.movimentos;

    const clientesReg = byFilial(raw.clientesReg);
    const clientes = Array.from(
      new Set([
        ...clientesReg.map((c) => c.nome),
        ...ordens.map((o) => o.cliente).filter((c): c is string => !!c),
      ]),
    ).sort((a, b) => a.localeCompare(b));

    return {
      ...raw,
      ordens,
      despesas: byFilial(raw.despesas),
      metas: byFilial(raw.metas),
      produtos,
      movimentos,
      contas: byFilial(raw.contas),
      chamados: byFilial(raw.chamados),
      clientesReg,
      clientes,
      filial,
      setFilial,
      userId: meta.userId,
      role: meta.role,
      isAdmin: meta.role === "admin",
      podeFinanceiro: meta.role === "admin" || meta.podeFinanceiro,
      loading: meta.loading,
      error: meta.error,
      refresh: load,
    };
  }, [raw, filial, setFilial, meta, load]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
