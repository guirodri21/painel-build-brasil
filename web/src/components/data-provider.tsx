"use client";

import * as React from "react";
import { createClient } from "@/lib/supabase/client";
import type { Ordem, DespesaGeral, Meta, Produto, EstoqueMovimento } from "@/lib/types";

interface DataState {
  ordens: Ordem[];
  despesas: DespesaGeral[];
  metas: Meta[];
  produtos: Produto[];
  movimentos: EstoqueMovimento[];
  equipes: string[];
  regioes: string[];
  linhas: string[];
  clientes: string[];
  userId: string | null;
  role: "admin" | "membro" | null;
  isAdmin: boolean;
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

export function DataProvider({ children }: { children: React.ReactNode }) {
  const supabase = React.useMemo(() => createClient(), []);
  const [state, setState] = React.useState<
    Omit<DataState, "refresh">
  >({
    ordens: [],
    despesas: [],
    metas: [],
    produtos: [],
    movimentos: [],
    equipes: [],
    regioes: [],
    linhas: [],
    clientes: [],
    userId: null,
    role: null,
    isAdmin: false,
    loading: true,
    error: null,
  });

  const load = React.useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id ?? null;

      const [
        eq,
        rg,
        ls,
        ord,
        desp,
        met,
        prod,
        mov,
        prof,
      ] = await Promise.all([
        supabase.from("equipes").select("nome").order("nome"),
        supabase.from("regioes").select("nome").order("nome"),
        supabase.from("linhas_servico").select("nome").order("nome"),
        supabase.from("ordens").select("*").order("data", { ascending: false }),
        supabase.from("despesas_gerais").select("*").order("data", { ascending: false }),
        supabase.from("metas").select("*").order("mes", { ascending: false }),
        supabase.from("produtos").select("*").order("nome"),
        supabase.from("estoque_movimentos").select("*").order("created_at", { ascending: false }).limit(500),
        uid
          ? supabase.from("profiles").select("role").eq("id", uid).single()
          : Promise.resolve({ data: null, error: null }),
      ]);

      const err = eq.error || rg.error || ls.error || ord.error || desp.error || met.error || prod.error || mov.error;
      if (err) throw err;

      const role = (prof.data?.role as "admin" | "membro" | undefined) ?? "membro";

      const ordens = (ord.data as Ordem[]) || [];
      const clientes = Array.from(
        new Set(ordens.map((o) => o.cliente).filter((c): c is string => !!c)),
      ).sort((a, b) => a.localeCompare(b));

      setState({
        ordens,
        despesas: (desp.data as DespesaGeral[]) || [],
        metas: (met.data as Meta[]) || [],
        produtos: (prod.data as Produto[]) || [],
        movimentos: (mov.data as EstoqueMovimento[]) || [],
        equipes: (eq.data || []).map((r) => r.nome),
        regioes: (rg.data || []).map((r) => r.nome),
        linhas: (ls.data || []).map((r) => r.nome),
        clientes,
        userId: uid,
        role,
        isAdmin: role === "admin",
        loading: false,
        error: null,
      });
    } catch (e) {
      setState((s) => ({
        ...s,
        loading: false,
        error: e instanceof Error ? e.message : "Erro ao carregar dados.",
      }));
    }
  }, [supabase]);

  React.useEffect(() => {
    load();
  }, [load]);

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
      .subscribe();
    return () => {
      clearTimeout(timer);
      supabase.removeChannel(channel);
    };
  }, [supabase, load]);

  return (
    <Ctx.Provider value={{ ...state, refresh: load }}>{children}</Ctx.Provider>
  );
}
