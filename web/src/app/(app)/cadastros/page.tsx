"use client";

import * as React from "react";
import { createClient } from "@/lib/supabase/client";
import { useData } from "@/components/data-provider";
import { useToast } from "@/components/ui/toast";
import { PageHeader } from "@/components/page-header";
import { Card, CardHeader, CardTitle, CardBody } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LookupManager } from "@/components/lookup-manager";
import { FuncionariosManager } from "@/components/funcionarios-manager";
import { ChecklistManager } from "@/components/checklist-manager";
import { ComissaoManager } from "@/components/comissao-manager";
import { DespesaModal } from "@/components/despesa-modal";
import { ConfirmDialog } from "@/components/ui/confirm";
import { formatCurrency, formatDate, cn } from "@/lib/utils";
import { CATEGORIA_LABELS } from "@/lib/types";
import { Plus, Pencil, Trash2 } from "lucide-react";
import type { DespesaGeral } from "@/lib/types";

export default function CadastrosPage() {
  const { equipes, regioes, linhas, filiais, despesas, userId, isAdmin, loading, refresh } = useData();
  const toast = useToast();
  const [despOpen, setDespOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<DespesaGeral | null>(null);
  const [delId, setDelId] = React.useState<string | null>(null);

  async function handleDelete() {
    if (!delId) return;
    const { error } = await createClient().from("despesas_gerais").delete().eq("id", delId);
    setDelId(null);
    if (error) { toast("Erro: " + error.message, "error"); return; }
    await refresh();
    toast("Despesa excluída.");
  }

  if (loading)
    return (
      <>
        <PageHeader title="Cadastros" />
        <div className="grid gap-5 lg:grid-cols-3">
          <Skeleton className="h-72" /><Skeleton className="h-72" /><Skeleton className="h-72" />
        </div>
      </>
    );

  return (
    <>
      <PageHeader title="Cadastros" subtitle="Gestão de equipes, regiões, linhas de serviço e despesas gerais" />

      <div className="grid gap-5 lg:grid-cols-3 mb-5">
        <LookupManager title="Equipes" table="equipes" items={equipes} />
        <LookupManager title="Regiões" table="regioes" items={regioes} />
        <LookupManager title="Linhas de Serviço" table="linhas_servico" items={linhas} />
        {isAdmin && <LookupManager title="Filiais" table="filiais" items={filiais} />}
      </div>

      <div className="mb-5">
        <FuncionariosManager />
      </div>

      {isAdmin && (
        <div className="grid gap-5 lg:grid-cols-2 mb-5">
          <ChecklistManager />
          <ComissaoManager />
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Despesas Gerais</CardTitle>
          <Button size="sm" onClick={() => { setEditing(null); setDespOpen(true); }}>
            <Plus size={15} /> Nova Despesa
          </Button>
        </CardHeader>
        <CardBody className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left">
                  <Th>Data</Th>
                  <Th>Categoria</Th>
                  <Th>Descrição</Th>
                  <Th className="text-right">Valor</Th>
                  <Th className="text-right">Ações</Th>
                </tr>
              </thead>
              <tbody>
                {despesas.length ? despesas.map((dsp) => {
                  const own = userId && dsp.created_by === userId;
                  return (
                    <tr key={dsp.id} className="border-b border-border last:border-0 hover:bg-surface-2 transition-colors">
                      <Td>{formatDate(dsp.data)}</Td>
                      <Td><Badge tone="gray">{CATEGORIA_LABELS[dsp.categoria]}</Badge></Td>
                      <Td>{dsp.descricao || "—"}</Td>
                      <Td className="text-right font-medium">{formatCurrency(dsp.valor)}</Td>
                      <Td className="text-right">
                        {own ? (
                          <div className="flex justify-end gap-1">
                            <button onClick={() => { setEditing(dsp); setDespOpen(true); }}
                              className="p-1.5 rounded-md text-muted hover:text-primary hover:bg-primary-soft cursor-pointer" title="Editar">
                              <Pencil size={14} />
                            </button>
                            <button onClick={() => setDelId(dsp.id)}
                              className="p-1.5 rounded-md text-muted hover:text-red hover:bg-red-soft cursor-pointer" title="Excluir">
                              <Trash2 size={14} />
                            </button>
                          </div>
                        ) : <span className="text-muted text-xs">—</span>}
                      </Td>
                    </tr>
                  );
                }) : (
                  <tr><td colSpan={5} className="text-center py-12 text-muted text-sm">Nenhuma despesa registrada.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </CardBody>
      </Card>

      {despOpen && <DespesaModal open={despOpen} despesa={editing} onClose={() => { setDespOpen(false); setEditing(null); }} />}
      <ConfirmDialog
        open={!!delId}
        message="Excluir esta despesa permanentemente?"
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
function Td({ children, className }: { children: React.ReactNode; className?: string }) {
  return <td className={cn("px-4 py-3", className)}>{children}</td>;
}
