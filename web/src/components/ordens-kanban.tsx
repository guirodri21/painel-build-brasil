"use client";

import { OrdemCard, useOrdemActions } from "@/components/ordens-cards";
import { formatCurrency, cn } from "@/lib/utils";
import { STATUS_LABELS } from "@/lib/types";
import type { Ordem, OrdemStatus } from "@/lib/types";
import { sum } from "@/lib/analytics";

const COLUMNS: { status: OrdemStatus; accent: string }[] = [
  { status: "em_andamento", accent: "bg-primary" },
  { status: "execucao_parcial", accent: "bg-yellow" },
  { status: "concluido", accent: "bg-green" },
];

export function OrdensKanban({ ordens }: { ordens: Ordem[] }) {
  const { openEdit, requestDelete, isOwn, nodes } = useOrdemActions();

  return (
    <>
      <div className="grid gap-4 md:grid-cols-3">
        {COLUMNS.map(({ status, accent }) => {
          const items = ordens.filter((o) => o.status === status);
          const total = sum(items, (o) => o.valor_venda);
          return (
            <div key={status} className="rounded-xl border border-border bg-surface-2/40 p-3">
              <div className="flex items-center justify-between mb-3 px-1">
                <div className="flex items-center gap-2">
                  <span className={cn("h-2.5 w-2.5 rounded-full", accent)} />
                  <span className="text-sm font-semibold">{STATUS_LABELS[status]}</span>
                  <span className="text-xs text-muted tabular-nums">({items.length})</span>
                </div>
                <span className="text-xs font-medium text-muted">{formatCurrency(total)}</span>
              </div>
              <div className="flex flex-col gap-3">
                {items.length ? (
                  items.map((o) => (
                    <OrdemCard
                      key={o.id}
                      ordem={o}
                      own={isOwn(o)}
                      onEdit={() => openEdit(o)}
                      onDelete={() => requestDelete(o.id)}
                    />
                  ))
                ) : (
                  <div className="text-center py-8 text-xs text-muted">Nenhuma ordem</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
      {nodes}
    </>
  );
}
