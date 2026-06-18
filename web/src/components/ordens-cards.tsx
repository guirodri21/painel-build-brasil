"use client";

import * as React from "react";
import { createClient } from "@/lib/supabase/client";
import { useData } from "@/components/data-provider";
import { useToast } from "@/components/ui/toast";
import { StatusBadge } from "@/components/ui/badge";
import { QualityBar } from "@/components/quality-bar";
import { OrdemModal } from "@/components/ordem-modal";
import { ConfirmDialog } from "@/components/ui/confirm";
import { formatCurrency, formatDate, cn } from "@/lib/utils";
import { Pencil, Trash2, Clock, MapPin, Layers } from "lucide-react";
import type { Ordem } from "@/lib/types";

/** Hook compartilhado entre Cards e Kanban: estado e ações de edição/exclusão. */
export function useOrdemActions() {
  const { userId, refresh } = useData();
  const toast = useToast();
  const [editing, setEditing] = React.useState<Ordem | null>(null);
  const [editOpen, setEditOpen] = React.useState(false);
  const [delId, setDelId] = React.useState<string | null>(null);

  const openEdit = (o: Ordem) => { setEditing(o); setEditOpen(true); };
  const requestDelete = (id: string) => setDelId(id);

  async function handleDelete() {
    if (!delId) return;
    const { error } = await createClient().from("ordens").delete().eq("id", delId);
    setDelId(null);
    if (error) { toast("Erro: " + error.message, "error"); return; }
    await refresh();
    toast("Ordem excluída.");
  }

  const isOwn = (o: Ordem) => !!userId && o.created_by === userId;

  const nodes = (
    <>
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

  return { openEdit, requestDelete, isOwn, nodes };
}

export function OrdemCard({
  ordem,
  own,
  onEdit,
  onDelete,
  className,
}: {
  ordem: Ordem;
  own: boolean;
  onEdit: () => void;
  onDelete: () => void;
  className?: string;
}) {
  const o = ordem;
  return (
    <div className={cn("rounded-xl border border-border bg-surface p-4 shadow-sm transition-shadow hover:shadow-md", className)}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="font-semibold truncate">{o.cliente || "Sem cliente"}</div>
          <div className="text-xs text-muted">{formatDate(o.data)}</div>
        </div>
        <StatusBadge status={o.status} />
      </div>

      <div className="mt-3 text-xl font-bold tracking-tight text-primary">
        {formatCurrency(o.valor_venda)}
      </div>

      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
        <span className="inline-flex items-center gap-1"><Layers size={12} /> {o.equipe}</span>
        <span className="inline-flex items-center gap-1"><MapPin size={12} /> {o.regiao}</span>
        {o.tempo_execucao_h != null && (
          <span className="inline-flex items-center gap-1"><Clock size={12} /> {o.tempo_execucao_h}h</span>
        )}
      </div>

      <div className="mt-2 text-xs text-muted">{o.linha_servico}</div>

      {o.resumo && (
        <p className="mt-2 text-xs text-foreground/80 line-clamp-2" title={o.resumo}>{o.resumo}</p>
      )}

      <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
        {o.qualidade != null ? <QualityBar value={o.qualidade} /> : <span className="text-xs text-muted">Sem qualidade</span>}
        {own ? (
          <div className="flex gap-1">
            <button onClick={onEdit} className="p-1.5 rounded-md text-muted hover:text-primary hover:bg-primary-soft transition-colors cursor-pointer" title="Editar">
              <Pencil size={14} />
            </button>
            <button onClick={onDelete} className="p-1.5 rounded-md text-muted hover:text-red hover:bg-red-soft transition-colors cursor-pointer" title="Excluir">
              <Trash2 size={14} />
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function OrdensCards({ ordens }: { ordens: Ordem[] }) {
  const { openEdit, requestDelete, isOwn, nodes } = useOrdemActions();

  if (!ordens.length)
    return <div className="text-center py-12 text-muted text-sm">Nenhuma ordem encontrada.</div>;

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {ordens.map((o) => (
          <OrdemCard
            key={o.id}
            ordem={o}
            own={isOwn(o)}
            onEdit={() => openEdit(o)}
            onDelete={() => requestDelete(o.id)}
          />
        ))}
      </div>
      {nodes}
    </>
  );
}
