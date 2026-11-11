"use client";

import * as React from "react";
import { createClient } from "@/lib/supabase/client";
import { usePersisted } from "@/lib/use-persisted";
import type { Ordem, DespesaGeral, Meta, Produto, EstoqueMovimento, Cliente, Conta, Chamado, ChamadoFase } from "@/lib/types";

const FILIAL_KEY = "painel.filial";
const CACHE_PREFIX = "bb-cache-v1:";

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

interface Perfil {
  role: "admin" | "membro";
  podeFinanceiro: boolean;
  podeComercial: boolean;
  podeOperacional: boolean;
  podeEstoque: boolean;
}

interface DataState extends RawData {
  /** Nomes de clientes (registro + citados em ordens) para autocompletar/filtrar. */
  clientes: string[];
  /** Filial selecionada ("" = todas). */
  filial: string;
  setFilial: (f: string) => void;
  userId: string | null;
  email: string;
  role: "admin" | "membro" | null;
  isAdmin: boolean;
  podeFinanceiro: boolean;
  podeComercial: boolean;
  podeOperacional: boolean;
  podeEstoque: boolean;
  /** true só enquanto ainda não há nenhum dado para mostrar (primeira carga, sem cache). */
  loading: boolean;
  /** true enquanto busca dados novos em segundo plano (a tela continua usável). */
  refreshing: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

const Ctx = React.createContext<DataState | null>(null);

export function useData() {
  const ctx = React.useContext(Ctx);
  if (!ctx) throw new Error("useData deve ser usado dentro de DataProvider");
  return ctx;
}

/** Apaga a cópia local dos dados (usar no logout). */
export function clearDataCache() {
  try {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (k?.startsWith(CACHE_PREFIX)) localStorage.removeItem(k);
    }
  } catch {}
}

const EMPTY_RAW: RawData = {
  ordens: [], despesas: [], metas: [], produtos: [], movimentos: [], clientesReg: [], contas: [],
  chamados: [], chamadoFases: [],
  equipes: [], regioes: [], linhas: [], filiais: [],
};

type Supa = ReturnType<typeof createClient>;
type Result = { data: unknown; error: unknown };

/** Uma consulta por fatia de dados. Permite recarregar só a tabela que mudou. */
const FONTES: Record<keyof RawData, { label: string; nomes?: boolean; query: (s: Supa) => PromiseLike<Result> }> = {
  equipes: { label: "equipes", nomes: true, query: (s) => s.from("equipes").select("nome").order("nome") },
  regioes: { label: "regiões", nomes: true, query: (s) => s.from("regioes").select("nome").order("nome") },
  linhas: { label: "linhas de serviço", nomes: true, query: (s) => s.from("linhas_servico").select("nome").order("nome") },
  filiais: { label: "filiais", nomes: true, query: (s) => s.from("filiais").select("nome").eq("ativo", true).order("nome") },
  ordens: { label: "ordens", query: (s) => s.from("ordens").select("*").order("data", { ascending: false }) },
  despesas: { label: "despesas", query: (s) => s.from("despesas_gerais").select("*").order("data", { ascending: false }) },
  metas: { label: "metas", query: (s) => s.from("metas").select("*").order("mes", { ascending: false }) },
  produtos: { label: "produtos", query: (s) => s.from("produtos").select("*").order("nome") },
  movimentos: { label: "movimentações", query: (s) => s.from("estoque_movimentos").select("*").order("created_at", { ascending: false }).limit(500) },
  clientesReg: { label: "clientes", query: (s) => s.from("clientes").select("*").order("nome") },
  contas: { label: "contas", query: (s) => s.from("contas").select("*").order("vencimento") },
  chamados: { label: "chamados", query: (s) => s.from("chamados").select("*").order("created_at", { ascending: false }) },
  chamadoFases: { label: "fases", query: (s) => s.from("chamado_fases").select("*").order("ordem") },
};

/** Tabela do banco → fatia do estado (para o realtime). */
const TABELA_PARA_CHAVE: Record<string, keyof RawData> = {
  ordens: "ordens",
  despesas_gerais: "despesas",
  metas: "metas",
  produtos: "produtos",
  estoque_movimentos: "movimentos",
  contas: "contas",
  clientes: "clientesReg",
  chamados: "chamados",
  chamado_fases: "chamadoFases",
};

async function buscar(supabase: Supa, key: keyof RawData): Promise<{ ok: true; value: unknown } | { ok: false; label: string }> {
  const fonte = FONTES[key];
  try {
    const { data, error } = await fonte.query(supabase);
    if (error) return { ok: false, label: fonte.label };
    const arr = (data as unknown[] | null) ?? [];
    return { ok: true, value: fonte.nomes ? (arr as { nome: string }[]).map((x) => x.nome) : arr };
  } catch {
    return { ok: false, label: fonte.label };
  }
}

export function DataProvider({ children }: { children: React.ReactNode }) {
  const supabase = React.useMemo(() => createClient(), []);
  const [raw, setRaw] = React.useState<RawData>(EMPTY_RAW);
  const [hasData, setHasData] = React.useState(false);
  const [refreshing, setRefreshing] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [user, setUser] = React.useState<{ id: string | null; email: string }>({ id: null, email: "" });
  const [perfil, setPerfil] = React.useState<Perfil | null>(null);
  const [filial, setFilial] = usePersisted(FILIAL_KEY, "");
  const userIdRef = React.useRef<string | null>(null);

  // Grava a cópia local logo depois que os dados assentam (fora do caminho crítico).
  const saveTimer = React.useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const salvarCache = React.useCallback((data: RawData, p: Perfil | null) => {
    const uid = userIdRef.current;
    if (!uid) return;
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      try {
        localStorage.setItem(CACHE_PREFIX + uid, JSON.stringify({ raw: data, perfil: p }));
      } catch {
        // Cota do navegador estourada: segue sem cache.
        try { localStorage.removeItem(CACHE_PREFIX + uid); } catch {}
      }
    }, 800);
  }, []);

  const perfilRef = React.useRef(perfil);
  React.useEffect(() => {
    perfilRef.current = perfil;
  }, [perfil]);

  /** Carrega tudo em paralelo. Com cache na tela, roda em segundo plano. */
  const load = React.useCallback(async () => {
    setRefreshing(true);
    setError(null);

    // getSession lê a sessão local (sem ida ao servidor); o proxy já valida o token.
    const { data: sess } = await supabase.auth.getSession();
    const uid = sess.session?.user.id ?? null;
    const email = sess.session?.user.email ?? "";
    userIdRef.current = uid;
    setUser({ id: uid, email });

    const keys = Object.keys(FONTES) as (keyof RawData)[];
    const [resultados, prof] = await Promise.all([
      Promise.all(keys.map((k) => buscar(supabase, k))),
      uid
        ? supabase.from("profiles").select("role, pode_financeiro, pode_comercial, pode_operacional, pode_estoque").eq("id", uid).maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

    const failures: string[] = [];
    const novos: Partial<Record<keyof RawData, unknown>> = {};
    resultados.forEach((r, i) => {
      if (r.ok) novos[keys[i]] = r.value;
      else failures.push(r.label);
    });

    const pd = (prof as { data: { role?: string; pode_financeiro?: boolean; pode_comercial?: boolean; pode_operacional?: boolean; pode_estoque?: boolean } | null }).data;
    const novoPerfil: Perfil = {
      role: pd?.role === "admin" ? "admin" : "membro",
      podeFinanceiro: pd?.pode_financeiro !== false,
      podeComercial: pd?.pode_comercial !== false,
      podeOperacional: pd?.pode_operacional !== false,
      podeEstoque: pd?.pode_estoque !== false,
    };

    // Mescla: o que falhou mantém o valor anterior (cache), em vez de zerar a tela.
    setRaw((prev) => {
      const next = { ...prev, ...novos } as RawData;
      salvarCache(next, novoPerfil);
      return next;
    });
    setPerfil(novoPerfil);
    setHasData(true);
    setRefreshing(false);
    setError(failures.length ? `Falha ao carregar: ${failures.join(", ")}.` : null);
  }, [supabase, salvarCache]);

  /** Recarrega só uma fatia (usado pelo realtime). */
  const loadOne = React.useCallback(async (key: keyof RawData) => {
    const r = await buscar(supabase, key);
    if (!r.ok) return;
    setRaw((prev) => {
      const next = { ...prev, [key]: r.value } as RawData;
      salvarCache(next, perfilRef.current);
      return next;
    });
  }, [supabase, salvarCache]);

  // 1) Mostra o que está salvo no aparelho na hora; 2) busca o atual em seguida.
  React.useEffect(() => {
    let vivo = true;
    (async () => {
      const { data: sess } = await supabase.auth.getSession();
      const uid = sess.session?.user.id;
      if (uid && vivo) {
        try {
          const saved = localStorage.getItem(CACHE_PREFIX + uid);
          if (saved) {
            const parsed = JSON.parse(saved) as { raw: RawData; perfil: Perfil | null };
            setRaw({ ...EMPTY_RAW, ...parsed.raw });
            if (parsed.perfil) setPerfil(parsed.perfil);
            setUser({ id: uid, email: sess.session?.user.email ?? "" });
            setHasData(true);
          }
        } catch {}
      }
      if (vivo) load();
    })();
    return () => { vivo = false; };
  }, [supabase, load]);

  // Realtime: recarrega apenas a tabela alterada (com pequeno debounce por tabela).
  React.useEffect(() => {
    const timers: Partial<Record<keyof RawData, ReturnType<typeof setTimeout>>> = {};
    const onChange = (payload: { table: string }) => {
      const key = TABELA_PARA_CHAVE[payload.table];
      if (!key) return;
      clearTimeout(timers[key]);
      timers[key] = setTimeout(() => loadOne(key), 400);
    };
    let channel = supabase.channel("painel-changes");
    for (const table of Object.keys(TABELA_PARA_CHAVE)) {
      channel = channel.on("postgres_changes", { event: "*", schema: "public", table }, onChange);
    }
    channel.subscribe();
    return () => {
      Object.values(timers).forEach((t) => clearTimeout(t));
      supabase.removeChannel(channel);
    };
  }, [supabase, loadOne]);

  // Ao voltar para a aba depois de um tempo, atualiza em segundo plano.
  React.useEffect(() => {
    let hiddenAt = 0;
    const onVis = () => {
      if (document.hidden) hiddenAt = Date.now();
      else if (hiddenAt && Date.now() - hiddenAt > 5 * 60_000) load();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [load]);

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

    const isAdmin = perfil?.role === "admin";
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
      userId: user.id,
      email: user.email,
      role: perfil?.role ?? null,
      isAdmin,
      // Enquanto o perfil não chega, não mostra áreas restritas (evita "piscar" itens no menu).
      podeFinanceiro: isAdmin || (perfil?.podeFinanceiro ?? false),
      podeComercial: isAdmin || (perfil?.podeComercial ?? false),
      podeOperacional: isAdmin || (perfil?.podeOperacional ?? false),
      podeEstoque: isAdmin || (perfil?.podeEstoque ?? false),
      loading: !hasData,
      refreshing,
      error,
      refresh: load,
    };
  }, [raw, filial, setFilial, user, perfil, hasData, refreshing, error, load]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
