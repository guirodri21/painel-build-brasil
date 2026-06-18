"use client";

import * as React from "react";

/** Duração padrão (ms) do count-up; pode ser sobrescrita por contexto (ex: Modo TV). */
const SpeedCtx = React.createContext<number>(900);

export function AnimationSpeed({ value, children }: { value: number; children: React.ReactNode }) {
  return <SpeedCtx.Provider value={value}>{children}</SpeedCtx.Provider>;
}

/**
 * Número que anima (count-up) do valor anterior até o novo valor.
 * `format` recebe o valor intermediário (float) durante a animação.
 * `duration` sobrescreve o ritmo do contexto. Respeita prefers-reduced-motion.
 */
export function AnimatedNumber({
  value,
  format,
  duration,
  className,
}: {
  value: number;
  format?: (n: number) => string;
  duration?: number;
  className?: string;
}) {
  const ctxDuration = React.useContext(SpeedCtx);
  const dur = duration ?? ctxDuration;
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
      const p = Math.min((t - start) / dur, 1);
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
  }, [value, dur]);

  return <span className={className}>{format ? format(display) : Math.round(display).toString()}</span>;
}
