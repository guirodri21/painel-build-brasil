"use client";

import * as React from "react";

/**
 * Número que anima (count-up) do valor anterior até o novo valor.
 * `format` recebe o valor intermediário (float) durante a animação.
 * Respeita prefers-reduced-motion (pula direto para o valor final).
 */
export function AnimatedNumber({
  value,
  format,
  duration = 900,
  className,
}: {
  value: number;
  format?: (n: number) => string;
  duration?: number;
  className?: string;
}) {
  // Inicia do zero para sempre "subir" ao montar (carga da página / troca de cena no TV).
  const [display, setDisplay] = React.useState(0);
  const currentRef = React.useRef(0);

  React.useEffect(() => {
    const from = currentRef.current;
    const to = Number.isFinite(value) ? value : 0;
    if (from === to) {
      currentRef.current = to;
      setDisplay(to);
      return;
    }

    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      currentRef.current = to;
      setDisplay(to);
      return;
    }

    let raf = 0;
    let start = 0;
    const tick = (t: number) => {
      if (!start) start = t;
      const p = Math.min((t - start) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3); // easeOutCubic
      const v = from + (to - from) * eased;
      currentRef.current = v;
      setDisplay(v);
      if (p < 1) raf = requestAnimationFrame(tick);
      else {
        currentRef.current = to;
        setDisplay(to);
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);

  return <span className={className}>{format ? format(display) : Math.round(display).toString()}</span>;
}
