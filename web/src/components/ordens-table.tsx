"use client";

import * as React from "react";
import { createClient } from "@/lib/supabase/client";
import { useData } from "@/components/data-provider";
import { useToast } from "@/components/ui/toast";
import { StatusBadge } from "@/components/ui/badge";
import { QualityBar } from "@/components/quality-bar";
import { OrdemModal } from "@/components/ordem-modal";
import { ConfirmDialog } from "@/components/ui/confirm";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatDate, cn } from "@/lib/utils";
import { Pencil, Trash2, ChevronLeft, ChevronRight, ArrowUpDown } from "lucide-react";
import type { Ordem } from "@/lib/types";

const PER_PAGE = 12;
type SortCol = "data" | "equipe" | "regiao" | "valor_venda" | "status";

export function OrdensTable({ ordens }: { ordens: Ordem[] }) {
  const { userId } = useData();
  const toast = useToast();
  const { refresh } = useData();
  const [page, setPage] = React.useState(1);
  const [sort, setSort] = React.useState<{ col: SortCol; asc: boolean }>({ col: "data", asc: false });
  const [editing, setEditing] = React.useState<Ordem | null>(null);
  const [editOpen, setEditOpen] = React.useState(false);
  const [delId, setDelId] = React.useState<string | null>(null);

  const sorted = React.useMemo(() => {
    const arr = [...ordens];
    arr.sort((a, b) => {
      const va = a[sort.col] ?? "";
      const vb = b[sort.col] ?? "";
      if (typeof va === "number" && typeof vb === "number")
        return sort.asc ? va - vb : vb - va;
      return sort.asc
        ? String(va).localeCompare(String(vb))
        : String(vb).localeCompare(String(va));
    });
    return arr;
  }, [ordens, sort]);

  const pages = Math.max(1, Math.ceil(sorted.length / PER_PAGE));
  const current = Math.min(page, pages);
  const slice = sorted.slice((current - 1) * PER_PAGE, current * PER_PAGE);

  function toggleSort(col: SortCol) {
    setSort((s) => (s.col === col ? { col, asc: !s.asc } : { col, asc: true }));
  }

  async function handleDelete() {
    if (!delId) return;
    const { error } = await createClient().from("ordens").delete().eq("id", delId);
    setDelId(null);
    if (error) {
      toast("Erro: " + error.message, "error");
      return;
    }
    await refresh();
    toast("Ordem excluída.");
  }

  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left">
              <SortableTh label="Data" col="data" sort={sort} onSort={toggleSort} />
              <SortableTh label="Equipe" col="equipe" sort={sort} onSort={toggleSort} />
              <SortableTh label="Região" col="regiao" sort={sort} onSort={toggleSort} />
              <Th>Cliente</Th>
              <SortableTh label="Valor" col="valor_venda" sort={sort} onSort={toggleSort} className="text-right" />
              <SortableTh label="Status" col="status" sort={sort} onSort={toggleSort} />
              <Th>Qualid.</Th>
              <Th>Resumo</Th>
              <Th className="text-right">Ações</Th>
            </tr>
          </thead>
          <tbody>
            {slice.length ? (
              slice.map((o) => {
                const own = userId && o.created_by === userId;
                return (
                  <tr key={o.id} className="border-b border-border last:border-0 hover:bg-surface-2 transition-colors">
                    <Td>{formatDate(o.data)}</Td>
                    <Td>{o.equipe}</Td>
                    <Td>{o.regiao}</Td>
                    <Td>{o.cliente || "—"}</Td>
                    <Td className="text-right">{formatCurrency(o.valor_venda)}</Td>
                    <Td><StatusBadge status={o.status} /></Td>
                    <Td>{o.qualidade != null ? <QualityBar value={o.qualidade} /> : "—"}</Td>
                    <Td className="max-w-[180px] truncate" title={o.resumo ?? ""}>{o.resumo || "—"}</Td>
                    <Td className="text-right">
                      {own ? (
                        <div className="flex justify-end gap-1">
                          <button
                            onClick={() => { setEditing(o); setEditOpen(true); }}
                            className="p-1.5 rounded-md text-muted hover:text-primary hover:bg-primary-soft transition-colors cursor-pointer"
                            title="Editar"
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            onClick={() => setDelId(o.id)}
                            className="p-1.5 rounded-md text-muted hover:text-red hover:bg-red-soft transition-colors cursor-pointer"
                            title="Excluir"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      ) : (
                        <span className="text-muted text-xs">—</span>
                      )}
                    </Td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={9} className="text-center py-12 text-muted text-sm">
                  Nenhuma ordem encontrada.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {pages > 1 && (
        <div className="flex items-center justify-center gap-3 mt-4 text-sm">
          <Button variant="secondary" size="sm" disabled={current <= 1} onClick={() => setPage(current - 1)}>
            <ChevronLeft size={14} />
          </Button>
          <span className="text-muted tabular-nums">{current} / {pages}</span>
          <Button variant="secondary" size="sm" disabled={current >= pages} onClick={() => setPage(current + 1)}>
            <ChevronRight size={14} />
          </Button>
        </div>
      )}

      {editOpen && (
        <OrdemModal open={editOpen} ordem={editing} onClose={() => { setEditOpen(false); setEditing(null); }} />
      )}
      <ConfirmDialog
        open={!!delId}
        message="Excluir esta ordem permanentemente?"
        confirmLabel="Excluir"
        onConfirm={handleDelete}
        onCancel={() => setDelId(null)}
      />
    </>
  );
}

function Th({ children, className }: { children: React.ReactNode; className?: string }) {
  return <th className={cn("px-4 py-3 text-xs font-semibold text-muted uppercase tracking-wide whitespace-nowrap", className)}>{children}</th>;
}
function Td({ children, className, title }: { children: React.ReactNode; className?: string; title?: string }) {
  return <td className={cn("px-4 py-3", className)} title={title}>{children}</td>;
}
function SortableTh({ label, col, sort, onSort, className }: {
  label: string; col: SortCol; sort: { col: SortCol; asc: boolean };
  onSort: (c: SortCol) => void; className?: string;
}) {
  const active = sort.col === col;
  return (
    <th className={cn("px-4 py-3 text-xs font-semibold text-muted uppercase tracking-wide whitespace-nowrap", className)}>
      <button onClick={() => onSort(col)} className={cn("inline-flex items-center gap-1 hover:text-foreground cursor-pointer", active && "text-primary")}>
        {label}
        <ArrowUpDown size={12} className={active ? "opacity-100" : "opacity-40"} />
      </button>
    </th>
  );
}
