import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown } from "lucide-react";
import { AnimatedNumber } from "@/components/animated-number";

type Tone = "default" | "green" | "teal" | "orange" | "red";

const toneClass: Record<Tone, string> = {
  default: "text-primary",
  green: "text-green",
  teal: "text-teal",
  orange: "text-orange",
  red: "text-red",
};

export function KpiCard({
  label,
  value,
  format,
  tone = "default",
  trend,
  icon: Icon,
}: {
  label: string;
  /** Número (animado com count-up se `format` for passado) ou texto pronto. */
  value: string | number;
  format?: (n: number) => string;
  tone?: Tone;
  trend?: { value: number; label?: string };
  icon?: React.ComponentType<{ size?: number; className?: string }>;
}) {
  return (
    <div className="rounded-xl border border-border bg-surface p-4 shadow-sm transition-all duration-200 hover:shadow-md hover:-translate-y-0.5">
      <div className="flex items-start justify-between">
        <span className="text-xs font-medium text-muted">{label}</span>
        {Icon && <Icon size={16} className="text-muted" />}
      </div>
      <div className={cn("mt-2 text-2xl font-bold tracking-tight tabular-nums", toneClass[tone])}>
        {typeof value === "number" && format ? (
          <AnimatedNumber value={value} format={format} />
        ) : (
          value
        )}
      </div>
      {trend && (
        <div
          className={cn(
            "mt-1 flex items-center gap-1 text-xs font-medium",
            trend.value >= 0 ? "text-green" : "text-red",
          )}
        >
          {trend.value >= 0 ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
          {Math.abs(trend.value).toFixed(1).replace(".", ",")}%
          {trend.label && <span className="text-muted font-normal">{trend.label}</span>}
        </div>
      )}
    </div>
  );
}
