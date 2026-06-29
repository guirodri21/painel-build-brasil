import { cn } from "@/lib/utils";

/**
 * Marca Build Brasil — emblema (globo + Brasil).
 * Renderiza /logo.svg. Para usar a logo real, salve o arquivo em
 * web/public/logo.png e troque o `src` abaixo para "/logo.png".
 */
export function BrandMark({ size = 40, className }: { size?: number; className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/logo.svg"
      alt="Build Brasil"
      width={size}
      height={size}
      className={cn("shrink-0 rounded-xl object-contain", className)}
      style={{ width: size, height: size }}
    />
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
