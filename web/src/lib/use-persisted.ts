"use client";

import * as React from "react";

const EVT = "bb-persisted";

function subscribe(cb: () => void) {
  window.addEventListener("storage", cb);
  window.addEventListener(EVT, cb);
  return () => {
    window.removeEventListener("storage", cb);
    window.removeEventListener(EVT, cb);
  };
}

function ler(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

/**
 * Texto salvo no localStorage, sincronizado entre componentes e abas.
 * No servidor (e no primeiro render) devolve `fallback`, sem erro de hidratação.
 */
export function usePersisted(key: string, fallback: string): [string, (v: string) => void] {
  const value = React.useSyncExternalStore(
    subscribe,
    () => ler(key) ?? fallback,
    () => fallback,
  );
  const set = React.useCallback(
    (v: string) => {
      try {
        localStorage.setItem(key, v);
      } catch {}
      window.dispatchEvent(new Event(EVT));
    },
    [key],
  );
  return [value, set];
}

/** Tema atual (atributo data-theme do <html>), reativo. */
export function useTheme(): ["light" | "dark", (t: "light" | "dark") => void] {
  const theme = React.useSyncExternalStore(
    (cb) => {
      const mo = new MutationObserver(cb);
      mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
      return () => mo.disconnect();
    },
    () => (document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light"),
    () => "light" as const,
  );
  const set = React.useCallback((t: "light" | "dark") => {
    document.documentElement.setAttribute("data-theme", t);
    try {
      localStorage.setItem("bb-theme", t);
    } catch {}
  }, []);
  return [theme, set];
}
