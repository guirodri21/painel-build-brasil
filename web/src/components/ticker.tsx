"use client";

import * as React from "react";

/**
 * Letreiro horizontal (marquee) que rola continuamente os destaques.
 * O conteúdo é duplicado para criar um loop contínuo sem emendas.
 * Pausa ao passar o mouse. `speed` controla a duração (s); menor = mais rápido.
 */
export function Ticker({
  items,
  speed = 40,
  className,
}: {
  items: string[];
  speed?: number;
  className?: string;
}) {
  if (!items.length) return null;
  const sep = "•";
  const row = (
    <span className="inline-flex items-center">
      {items.map((it, i) => (
        <span key={i} className="inline-flex items-center">
          <span className="px-6 text-base font-medium">{it}</span>
          <span className="text-primary/60">{sep}</span>
        </span>
      ))}
    </span>
  );

  return (
    <div
      className={`marquee-viewport overflow-hidden ${className ?? ""}`}
      style={{ "--marquee-duration": `${speed}s` } as React.CSSProperties}
    >
      <div className="marquee-track">
        {row}
        {row}
      </div>
    </div>
  );
}
