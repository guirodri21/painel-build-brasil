"use client";

import * as React from "react";
import { createClient } from "@/lib/supabase/client";
import type { Ordem, DespesaGeral, Meta } from "@/lib/types";

interface DataState {
  ordens: Ordem[];
  despesas: DespesaGeral[];
  metas: Meta[];
  equipes: string[];
  regioes: string[];
  linhas: string[];
  userId: string | null;
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
    equipes: [],
    regioes: [],
    linhas: [],
    userId: null,
    loading: true,
    error: null,
  });

  const load = React.useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const [
        { data: userData },
        eq,
        rg,
        ls,
        ord,
        desp,
        met,
      ] = await Promise.all([
        supabase.auth.getUser(),
        supabase.from("equipes").select("nome").order("nome"),
        supabase.from("regioes").select("nome").order("nome"),
        supabase.from("linhas_servico").select("nome").order("nome"),
        supabase.from("ordens").select("*").order("data", { ascending: false }),
        supabase.from("despesas_gerais").select("*").order("data", { ascending: false }),
        supabase.from("metas").select("*").order("mes", { ascending: false }),
      ]);

      const err = eq.error || rg.error || ls.error || ord.error || desp.error || met.error;
      if (err) throw err;

      setState({
        ordens: (ord.data as Ordem[]) || [],
        despesas: (desp.data as DespesaGeral[]) || [],
        metas: (met.data as Meta[]) || [],
        equipes: (eq.data || []).map((r) => r.nome),
        regioes: (rg.data || []).map((r) => r.nome),
        linhas: (ls.data || []).map((r) => r.nome),
        userId: userData.user?.id ?? null,
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
