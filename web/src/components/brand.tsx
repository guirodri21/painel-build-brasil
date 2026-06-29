import { cn } from "@/lib/utils";

/** Marca Build Brasil — skyline/barras (engenharia + resultados). */
export function BrandMark({ size = 40, className }: { size?: number; className?: string }) {
  return (
    <div
      className={cn("rounded-xl bg-primary flex items-center justify-center shrink-0", className)}
      style={{ width: size, height: size }}
    >
      <svg
        width={size * 0.6}
        height={size * 0.6}
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden="true"
      >
        <rect x="3" y="11" width="4" height="10" rx="1" fill="#fff" />
        <rect x="10" y="6" width="4" height="15" rx="1" fill="#fff" />
        <rect x="17" y="3" width="4" height="18" rx="1" fill="#fff" opacity="0.85" />
      </svg>
    </div>
  );
}

export function BrandLogo({ subtitle = "Painel de Resultados" }: { subtitle?: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <BrandMark size={36} />
      <div className="leading-tight">
        <div className="text-sm font-bold">Build Brasil</div>
        <div className="text-[11px] text-muted">{subtitle}</div>
      </div>
    </div>
  );
}
