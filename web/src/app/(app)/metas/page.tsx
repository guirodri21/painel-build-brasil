"use client";

import * as React from "react";
import { createClient } from "@/lib/supabase/client";
import { useData } from "@/components/data-provider";
import { useToast } from "@/components/ui/toast";
import { PageHeader } from "@/components/page-header";
import { Card, CardHeader, CardTitle, CardBody } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { MetaModal } from "@/components/meta-modal";
import { ConfirmDialog } from "@/components/ui/confirm";
import { groupBy, sum } from "@/lib/analytics";
import { formatCurrency, monthLabel, cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2, Target } from "lucide-react";
import type { Meta } from "@/lib/types";

export default function MetasPage() {
  const { ordens, metas, userId, loading, refresh } = useData();
  const toast = useToast();
  const [open, setOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Meta | null>(null);
  const [delId, setDelId] = React.useState<string | null>(null);
  const [funcMap, setFuncMap] = React.useState<Record<string, string>>({});

  React.useEffect(() => {
    createClient().from("funcionarios").select("id,nome").then(({ data }) => {
      const m: Record<string, string> = {};
      for (const f of data ?? []) m[f.id] = f.nome;
      setFuncMap(m);
    });
  }, []);

  // realizado por equipe+mês
  const realizado = React.useMemo(() => {
    const map: Record<string, { receita: number; qualidade: number | null }> = {};
    const byKey = groupBy(ordens, (o) => `${o.equipe}|${o.data.substring(0, 7)}`);
    for (const [key, items] of Object.entries(byKey)) {
      const cq = items.filter((o) => o.qualidade != null);
      map[key] = {
        receita: sum(items, (o) => o.valor_venda),
        qualidade: cq.length ? sum(cq, (o) => o.qualidade!) / cq.length : null,
      };
    }
    return map;
  }, [ordens]);

  async function handleDelete() {
    if (!delId) return;
    const { error } = await createClient().from("metas").delete().eq("id", delId);
    setDelId(null);
    if (error) { toast("Erro: " + error.message, "error"); return; }
    await refresh();
    toast("Meta excluída.");
  }

  if (loading)
    return (
      <>
        <PageHeader title="Metas e Indicadores" />
        <Skeleton className="h-96" />
      </>
    );

  return (
    <>
      <PageHeader title="Metas e Indicadores" subtitle="Defina metas mensais por equipe e acompanhe o atingimento">
        <Button onClick={() => { setEditing(null); setOpen(true); }}>
          <Plus size={16} /> Nova Meta
        </Button>
      </PageHeader>

      <Card>
        <CardHeader><CardTitle>Acompanhamento de Metas</CardTitle></CardHeader>
        <CardBody className="p-0">
          {metas.length ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left">
                    <Th>Mês</Th>
                    <Th>Equipe</Th>
                    <Th className="text-right">Meta Receita</Th>
                    <Th className="text-right">Realizado</Th>
                    <Th className="w-[200px]">Atingimento</Th>
                    <Th className="text-right">Qual. Meta / Real</Th>
                    <Th className="text-right">Ações</Th>
                  </tr>
                </thead>
                <tbody>
                  {metas.map((m) => {
                    const individual = !!m.funcionario_id;
                    const key = `${m.equipe}|${m.mes.substring(0, 7)}`;
                    const real = individual ? undefined : realizado[key];
                    const receitaReal = real?.receita ?? 0;
                    const pct = !individual && m.meta_receita > 0 ? (receitaReal / m.meta_receita) * 100 : 0;
                    const own = userId && m.created_by === userId;
                    const qualReal = real?.qualidade;
                    return (
                      <tr key={m.id} className="border-b border-border last:border-0 hover:bg-surface-2 transition-colors">
                        <Td className="font-medium">{monthLabel(m.mes.substring(0, 7))}</Td>
                        <Td className="font-semibold">
                          {individual ? (
                            <span className="flex items-center gap-2">
                              {funcMap[m.funcionario_id!] ?? "Funcionário"}
                              <Badge tone="blue">individual</Badge>
                            </span>
                          ) : m.equipe}
                        </Td>
                        <Td className="text-right">{formatCurrency(m.meta_receita)}</Td>
                        <Td className="text-right">{individual ? "—" : formatCurrency(receitaReal)}</Td>
                        <Td>
                          {individual ? (
                            <span className="text-xs text-muted">acompanhamento manual</span>
                          ) : (
                          <div className="flex items-center gap-2">
                            <span className="h-2 flex-1 rounded-full bg-surface-2 overflow-hidden min-w-[80px]">
                              <span
                                className={cn(
                                  "block h-full rounded-full transition-all",
                                  pct >= 100 ? "bg-green" : pct >= 70 ? "bg-yellow" : "bg-red",
                                )}
                                style={{ width: `${Math.min(pct, 100)}%` }}
                              />
                            </span>
                            <span className={cn("text-xs font-semibold tabular-nums w-12 text-right",
                              pct >= 100 ? "text-green" : pct >= 70 ? "text-yellow" : "text-red")}>
                              {pct.toFixed(0)}%
                            </span>
                          </div>
                          )}
                        </Td>
                        <Td className="text-right text-xs">
                          {m.meta_qualidade ?? "—"} / {qualReal != null ? qualReal.toFixed(0) : "—"}
                        </Td>
                        <Td className="text-right">
                          {own ? (
                            <div className="flex justify-end gap-1">
                              <button onClick={() => { setEditing(m); setOpen(true); }}
                                className="p-1.5 rounded-md text-muted hover:text-primary hover:bg-primary-soft cursor-pointer" title="Editar">
                                <Pencil size={14} />
                              </button>
                              <button onClick={() => setDelId(m.id)}
                                className="p-1.5 rounded-md text-muted hover:text-red hover:bg-red-soft cursor-pointer" title="Excluir">
                                <Trash2 size={14} />
                              </button>
                            </div>
                          ) : <span className="text-muted text-xs">—</span>}
                        </Td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Target size={36} className="text-muted mb-3" />
              <p className="text-sm text-muted">Nenhuma meta definida ainda.</p>
              <Button className="mt-4" onClick={() => { setEditing(null); setOpen(true); }}>
                <Plus size={16} /> Criar primeira meta
              </Button>
            </div>
          )}
        </CardBody>
      </Card>

      {open && <MetaModal open={open} meta={editing} onClose={() => { setOpen(false); setEditing(null); }} />}
      <ConfirmDialog
        open={!!delId}
        message="Excluir esta meta permanentemente?"
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
