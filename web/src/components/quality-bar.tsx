import { cn } from "@/lib/utils";

export function QualityBar({ value }: { value: number }) {
  const v = Math.round(value);
  const color = v >= 85 ? "bg-green" : v >= 70 ? "bg-yellow" : "bg-red";
  return (
    <span className="inline-flex items-center gap-2">
      <span className="h-1.5 w-12 rounded-full bg-surface-2 overflow-hidden">
        <span className={cn("block h-full rounded-full", color)} style={{ width: `${v}%` }} />
      </span>
      <span className="text-xs tabular-nums">{v}</span>
    </span>
  );
}
