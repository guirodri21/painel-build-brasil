"use client";

import * as React from "react";
import { EMPTY_FILTROS, type Filtros } from "@/lib/analytics";
import { usePersisted } from "@/lib/use-persisted";

interface FiltersCtx {
  filtros: Filtros;
  setFiltro: (key: keyof Filtros, value: string) => void;
  setMany: (partial: Partial<Filtros>) => void;
  clear: () => void;
}

const Ctx = React.createContext<FiltersCtx | null>(null);

export function useFiltros() {
  const ctx = React.useContext(Ctx);
  if (!ctx) throw new Error("useFiltros deve ser usado dentro de FiltersProvider");
  return ctx;
}

const KEY = "bb-filtros";

function parse(raw: string): Filtros {
  try {
    return raw ? { ...EMPTY_FILTROS, ...JSON.parse(raw) } : EMPTY_FILTROS;
  } catch {
    return EMPTY_FILTROS;
  }
}

export function FiltersProvider({ children }: { children: React.ReactNode }) {
  // Filtros salvos no navegador e compartilhados entre as telas.
  const [raw, setRaw] = usePersisted(KEY, "");
  const filtros = React.useMemo(() => parse(raw), [raw]);

  // Lê o valor salvo na hora da chamada: duas mudanças seguidas não se atropelam.
  const atual = React.useCallback(() => {
    try {
      return parse(localStorage.getItem(KEY) ?? "");
    } catch {
      return EMPTY_FILTROS;
    }
  }, []);

  const setFiltro = React.useCallback(
    (key: keyof Filtros, value: string) => setRaw(JSON.stringify({ ...atual(), [key]: value })),
    [atual, setRaw],
  );

  const setMany = React.useCallback(
    (partial: Partial<Filtros>) => setRaw(JSON.stringify({ ...atual(), ...partial })),
    [atual, setRaw],
  );

  const clear = React.useCallback(() => setRaw(JSON.stringify(EMPTY_FILTROS)), [setRaw]);

  const value = React.useMemo(() => ({ filtros, setFiltro, setMany, clear }), [filtros, setFiltro, setMany, clear]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
