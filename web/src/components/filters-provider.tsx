"use client";

import * as React from "react";
import { EMPTY_FILTROS, type Filtros } from "@/lib/analytics";

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

export function FiltersProvider({ children }: { children: React.ReactNode }) {
  const [filtros, setFiltros] = React.useState<Filtros>(EMPTY_FILTROS);

  React.useEffect(() => {
    try {
      const saved = localStorage.getItem("bb-filtros");
      if (saved) setFiltros({ ...EMPTY_FILTROS, ...JSON.parse(saved) });
    } catch {}
  }, []);

  const persist = React.useCallback((next: Filtros) => {
    setFiltros(next);
    try {
      localStorage.setItem("bb-filtros", JSON.stringify(next));
    } catch {}
  }, []);

  const setFiltro = React.useCallback(
    (key: keyof Filtros, value: string) =>
      persist({ ...filtrosRef.current, [key]: value }),
    [persist],
  );

  const setMany = React.useCallback(
    (partial: Partial<Filtros>) => persist({ ...filtrosRef.current, ...partial }),
    [persist],
  );

  // ref para evitar stale closure
  const filtrosRef = React.useRef(filtros);
  filtrosRef.current = filtros;

  const clear = React.useCallback(() => persist(EMPTY_FILTROS), [persist]);

  return (
    <Ctx.Provider value={{ filtros, setFiltro, setMany, clear }}>
      {children}
    </Ctx.Provider>
  );
}
