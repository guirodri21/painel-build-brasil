"use client";

import * as React from "react";
import { createClient } from "@/lib/supabase/client";
import { useData } from "@/components/data-provider";
import { useToast } from "@/components/ui/toast";
import { PageHeader } from "@/components/page-header";
import { KpiCard } from "@/components/kpi-card";
import { KpiSkeletonRow, Skeleton } from "@/components/ui/skeleton";
import { Card, CardBody } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/ui/confirm";
import { OrcamentoModal } from "@/components/orcamento-modal";
import { exportRelatorioPDF } from "@/lib/export";
import { sum } from "@/lib/analytics";
import { formatCurrency, formatDate, formatMoney, todayISO, cn } from "@/lib/utils";
import { ORCAMENTO_STATUS_LABELS } from "@/lib/types";
import type { Orcamento, OrcamentoItem, OrcamentoStatus } from "@/lib/types";
import { Plus, FileText, FileDown, ArrowRightCircle, Pencil, Trash2 } from "lucide-react";

const TONE: Record<OrcamentoStatus, "gray" | "blue" | "green" | "red"> = {
  rascunho: "gray", enviado: "blue", aprovado: "green", recusado: "red",
};

export default function OrcamentosPage() {
  const { filial, regioes, equipes, linhas, userId, refresh } = useData();
  const toast = useToast();
  const supabase = React.useMemo(() => createClient(), []);
  const [orcs, setOrcs] = React.useState<Orcamento[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [modal, setModal] = React.useState(false);
  const [edit, setEdit] = React.useState<Orcamento | null>(null);
  const [del, setDel] = React.useState<Orcamento | null>(null);

  const carregar = React.useCallback(async () => {
    let q = supabase.from("orcamentos").select("*").order("created_at", { ascending: false });
    if (filial) q = q.eq("filial", filial);
    const { data } = await q;
    setOrcs((data as Orcamento[]) ?? []);
    setLoading(false);
  }, [supabase, filial]);

  React.useEffect(() => { carregar(); }, [carregar]);

  const totalAberto = sum(orcs.filter((o) => o.status === "enviado"), (o) => o.valor_total);
  const aprovados = orcs.filter((o) => o.status === "aprovado");
  const taxa = orcs.length ? (aprovados.length / orcs.length) * 100 : 0;

  async function gerarPDF(o: Orcamento) {
    const { data } = await supabase.from("orcamento_itens").select("*").eq("orcamento_id", o.id).order("ordem_exibicao");
    const itens = (data as OrcamentoItem[]) ?? [];
    exportRelatorioPDF({
      titulo: `Orçamento — ${o.cliente ?? "Cliente"}`,
      subtitulo: `Validade: ${o.validade ? formatDate(o.validade) : "—"} · Total: ${formatCurrency(o.valor_total)}`,
      colunas: ["Descrição", "Qtd", "Valor un.", "Total"],
      linhas: itens.map((it) => [it.descricao, it.quantidade, formatMoney(it.valor_unitario), formatMoney(it.quantidade * it.valor_unitario)]),
    });
  }

  async function converter(o: Orcamento) {
    if (!regioes.length || !equipes.length || !linhas.length) {
      toast("Cadastre região, equipe e linha de serviço antes de converter.", "error");
      return;
    }
    const { data, error } = await supabase.from("ordens").insert([{
      data: todayISO(), regiao: regioes[0], equipe: equipes[0], linha_servico: linhas[0],
      cliente: o.cliente, valor_venda: o.valor_total, despesa_direta: 0, status: "em_andamento",
      resumo: o.observacoes ?? `Convertido do orçamento`, filial: o.filial || "Matriz", created_by: userId,
    }]).select("id").single();
    if (error || !data) { toast("Erro: " + (error?.message ?? ""), "error"); return; }
    await supabase.from("orcamentos").update({ status: "aprovado", ordem_id: data.id }).eq("id", o.id);
    await carregar();
    await refresh();
    toast("Ordem criada! Ajuste região/equipe/linha na ordem.");
  }

  async function excluir() {
    if (!del) return;
    const { error } = await supabase.from("orcamentos").delete().eq("id", del.id);
    setDel(null);
    if (error) { toast("Erro: " + error.message, "error"); return; }
    await carregar();
    toast("Orçamento excluído.");
  }

  if (loading)
    return (<><PageHeader title="Orçamentos" /><KpiSkeletonRow count={3} /><Skeleton className="h-80" /></>);

  return (
    <>
      <PageHeader title="Orçamentos" subtitle="Propostas e conversão em ordem">
        <Button onClick={() => { setEdit(null); setModal(true); }}><Plus size={16} /> Novo Orçamento</Button>
      </PageHeader>

      <div className="stagger grid gap-3 mb-5 grid-cols-2 lg:grid-cols-3">
        <KpiCard label="Orçamentos" value={orcs.length} format={(n) => String(n)} icon={FileText} />
        <KpiCard label="Em aberto (enviados)" value={totalAberto} format={formatCurrency} tone="teal" />
        <KpiCard label="Taxa de aprovação" value={taxa} format={(n) => n.toFixed(0) + "%"} tone="green" />
      </div>

      <Card>
        <CardBody className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left">
                  <Th>Data</Th><Th>Cliente</Th><Th>Validade</Th><Th className="text-right">Total</Th><Th>Status</Th><Th className="text-right">Ações</Th>
                </tr>
              </thead>
              <tbody>
                {orcs.length ? orcs.map((o) => (
                  <tr key={o.id} className="border-b border-border last:border-0 hover:bg-surface-2 transition-colors">
                    <Td className="whitespace-nowrap text-muted">{formatDate(o.created_at.split("T")[0])}</Td>
                    <Td className="font-medium">{o.cliente ?? "—"}</Td>
                    <Td className="text-muted">{o.validade ? formatDate(o.validade) : "—"}</Td>
                    <Td className="text-right tabular-nums font-medium">{formatCurrency(o.valor_total)}</Td>
                    <Td><Badge tone={TONE[o.status]}>{ORCAMENTO_STATUS_LABELS[o.status]}</Badge></Td>
                    <Td>
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => gerarPDF(o)} title="PDF" className="p-1.5 rounded-md text-muted hover:text-primary hover:bg-primary-soft cursor-pointer"><FileDown size={14} /></button>
                        {o.status !== "aprovado" && (
                          <button onClick={() => converter(o)} title="Converter em ordem" className="p-1.5 rounded-md text-muted hover:text-green hover:bg-green-soft cursor-pointer"><ArrowRightCircle size={14} /></button>
                        )}
                        <button onClick={() => { setEdit(o); setModal(true); }} title="Editar" className="p-1.5 rounded-md text-muted hover:text-primary hover:bg-primary-soft cursor-pointer"><Pencil size={14} /></button>
                        <button onClick={() => setDel(o)} title="Excluir" className="p-1.5 rounded-md text-muted hover:text-red hover:bg-red-soft cursor-pointer"><Trash2 size={14} /></button>
                      </div>
                    </Td>
                  </tr>
                )) : (
                  <tr><td colSpan={6} className="py-10 text-center text-sm text-muted">Nenhum orçamento.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </CardBody>
      </Card>

      {modal && <OrcamentoModal open={modal} onClose={() => { setModal(false); setEdit(null); carregar(); }} orcamento={edit} />}
      <ConfirmDialog open={!!del} title="Excluir orçamento" message={`Excluir o orçamento de "${del?.cliente ?? "—"}"?`} confirmLabel="Excluir" onConfirm={excluir} onCancel={() => setDel(null)} />
    </>
  );
}

function Th({ children, className }: { children: React.ReactNode; className?: string }) {
  return <th className={cn("px-4 py-3 text-xs font-semibold text-muted uppercase tracking-wide whitespace-nowrap", className)}>{children}</th>;
}
function Td({ children, className }: { children: React.ReactNode; className?: string }) {
  return <td className={cn("px-4 py-3", className)}>{children}</td>;
}
