"use client";

import * as React from "react";

/**
 * Roda `carregar` ao montar e sempre que ele mudar (busca de dados).
 * A chamada sai do corpo do efeito (microtarefa), então o estado só é
 * atualizado depois da resposta — sem renderizações em cascata.
 */
export function useCarregar(carregar: () => unknown, ativo = true) {
  React.useEffect(() => {
    if (!ativo) return;
    let vivo = true;
    queueMicrotask(() => {
      if (vivo) void carregar();
    });
    return () => {
      vivo = false;
    };
  }, [carregar, ativo]);
}
