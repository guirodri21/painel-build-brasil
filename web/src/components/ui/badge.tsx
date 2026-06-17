import { cn } from "@/lib/utils";
import type { OrdemStatus } from "@/lib/types";
import { STATUS_LABELS } from "@/lib/types";

type Tone = "green" | "yellow" | "blue" | "red" | "orange" | "gray";

const tones: Record<Tone, string> = {
  green: "bg-green-soft text-green",
  yellow: "bg-yellow-soft text-yellow",
  blue: "bg-primary-soft text-primary",
  red: "bg-red-soft text-red",
  orange: "bg-orange-soft text-orange",
  gray: "bg-surface-2 text-muted",
};

export function Badge({
  tone = "gray",
  className,
  children,
}: {
  tone?: Tone;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

const statusTone: Record<OrdemStatus, Tone> = {
  concluido: "green",
  execucao_parcial: "yellow",
  em_andamento: "blue",
};

export function StatusBadge({ status }: { status: OrdemStatus }) {
  return <Badge tone={statusTone[status]}>{STATUS_LABELS[status]}</Badge>;
}
