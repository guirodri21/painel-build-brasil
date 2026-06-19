"use client";

import * as React from "react";
import { createClient } from "@/lib/supabase/client";
import { useData } from "@/components/data-provider";
import { useToast } from "@/components/ui/toast";
import { PageHeader } from "@/components/page-header";
import { KpiCard } from "@/components/kpi-card";
import { KpiSkeletonRow, Skeleton } from "@/components/ui/skeleton";
import { Card, CardHeader, CardTitle, CardBody } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/field";
import { ConfirmDialog } from "@/components/ui/confirm";
import { ClienteModal } from "@/components/cliente-modal";
import { sum } from "@/lib/analytics";
import { formatCurrency, formatDate, formatNumber, cn } from "@/lib/utils";
import type { Cliente } from "@/lib/types";
import { Plus, Search, Pencil, Trash2, Users, DollarSign, Repeat, ChevronDown, Phone, Mail } from "lucide-react";

export default function ClientesPage() {
  const { clientesReg, ordens, refresh, loading } = useData();
  const toast = useToast();
  const [busca, setBusca] = React.useState("");
  const [modal, setModal] = React.useState(false);
  const [edit, setEdit] = React.useState<Cliente | null>(null);
  const [del, setDel] = React.useState<Cliente | null>(null);
  const [aberto, setAberto] = React.useState<string | null>(null);

  // Estatísticas por nome de cliente
  const stats = React.useMemo(() => {
    const m = new Map<string, { receita: number; n: number }>();
    for (const o of ordens) {
      if (!o.cliente) continue;
      const cur = m.get(o.cliente) ?? { receita: 0, n: 0 };
      cur.receita += o.valor_venda;
      cur.n += 1;
      m.set(o.cliente, cur);
    }
    return m;
  }, [ordens]);

  const filtrados = React.useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return clientesReg;
    return clientesReg.filter(
      (c) =>
        c.nome.toLowerCase().includes(q) ||
        (c.telefone ?? "").toLowerCase().includes(q) ||
        (c.documento ?? "").toLowerCase().includes(q),
    );
  }, [clientesReg, busca]);

  const faturamentoTotal = sum(ordens, (o) => o.valor_venda);
  const comServico = clientesReg.filter((c) => (stats.get(c.nome)?.n ?? 0) > 0).length;

  async function excluir() {
    if (!del) return;
    const { error } = await createClient().from("clientes").delete().eq("id", del.id);
    setDel(null);
    if (error) { toast("Erro: " + error.message, "error"); return; }
    await refresh();
    toast("Cliente excluído.");
  }

  if (loading)
    return (
      <>
        <PageHeader title="Clientes" />
        <KpiSkeletonRow count={3} />
        <Skeleton className="h-96" />
      </>
    );

  return (
    <>
      <PageHeader title="Clientes" subtitle="Cadastro e histórico de clientes">
        <Button onClick={() => { setEdit(null); setModal(true); }}>
          <Plus size={16} /> Novo Cliente
        </Button>
      </PageHeader>

      <div className="stagger grid gap-3 mb-5 grid-cols-2 lg:grid-cols-3">
        <KpiCard label="Clientes" value={clientesReg.length} format={(n) => formatNumber(n)} icon={Users} />
        <KpiCard label="Com serviço" value={comServico} format={(n) => formatNumber(n)} tone="teal" icon={Repeat} />
        <KpiCard label="Faturamento total" value={faturamentoTotal} format={(n) => formatCurrency(n)} tone="green" icon={DollarSign} />
      </div>

      <Card>
        <CardHeader className="flex-wrap gap-2">
          <CardTitle>Lista ({filtrados.length})</CardTitle>
          <div className="relative">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" />
            <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar nome, telefone, documento..." className="pl-8 w-64" />
          </div>
        </CardHeader>
        <CardBody className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left">
                  <Th>Cliente</Th>
                  <Th>Contato</Th>
                  <Th className="text-right">Serviços</Th>
                  <Th className="text-right">Faturamento</Th>
                  <Th>Status</Th>
                  <Th className="text-right">Ações</Th>
                </tr>
              </thead>
              <tbody>
                {filtrados.length ? filtrados.map((c) => {
                  const st = stats.get(c.nome) ?? { receita: 0, n: 0 };
                  const hist = ordens.filter((o) => o.cliente === c.nome);
                  const isOpen = aberto === c.id;
                  return (
                    <React.Fragment key={c.id}>
                      <tr className={cn("border-b border-border hover:bg-surface-2 transition-colors", !c.ativo && "opacity-50", isOpen && "bg-surface-2")}>
                        <Td className="font-medium">
                          <button onClick={() => setAberto(isOpen ? null : c.id)} className="flex items-center gap-1.5 cursor-pointer hover:text-primary">
                            <ChevronDown size={14} className={cn("transition-transform text-muted", isOpen && "rotate-180")} />
                            {c.nome}
                          </button>
                        </Td>
                        <Td className="text-muted">
                          <div className="flex flex-col gap-0.5 text-xs">
                            {c.telefone && <span className="flex items-center gap-1"><Phone size={11} />{c.telefone}</span>}
                            {c.email && <span className="flex items-center gap-1"><Mail size={11} />{c.email}</span>}
                            {!c.telefone && !c.email && "—"}
                          </div>
                        </Td>
                        <Td className="text-right tabular-nums">{st.n}</Td>
                        <Td className="text-right tabular-nums font-medium">{formatCurrency(st.receita)}</Td>
                        <Td>{c.ativo ? <Badge tone="green">Ativo</Badge> : <Badge tone="gray">Inativo</Badge>}</Td>
                        <Td>
                          <div className="flex items-center justify-end gap-1">
                            <button onClick={() => { setEdit(c); setModal(true); }} title="Editar" className="p-1.5 rounded-md text-muted hover:text-primary hover:bg-primary-soft cursor-pointer"><Pencil size={14} /></button>
                            <button onClick={() => setDel(c)} title="Excluir" className="p-1.5 rounded-md text-muted hover:text-red hover:bg-red-soft cursor-pointer"><Trash2 size={14} /></button>
                          </div>
                        </Td>
                      </tr>
                      {isOpen && (
                        <tr className="border-b border-border bg-surface-2/40">
                          <td colSpan={6} className="px-6 py-3">
                            {c.obs && <p className="text-xs text-muted mb-2">{c.obs}</p>}
                            {hist.length ? (
                              <div className="space-y-1">
                                <p className="text-xs font-semibold text-muted uppercase tracking-wide mb-1">Histórico de serviços</p>
                                {hist.slice(0, 8).map((o) => (
                                  <div key={o.id} className="flex items-center justify-between text-xs py-1 border-b border-border/50 last:border-0">
                                    <span className="text-muted">{formatDate(o.data)}</span>
                                    <span className="flex-1 px-3 truncate">{o.linha_servico} · {o.equipe}</span>
                                    <span className="font-medium tabular-nums">{formatCurrency(o.valor_venda)}</span>
                                  </div>
                                ))}
                                {hist.length > 8 && <p className="text-[11px] text-muted pt-1">+{hist.length - 8} serviço(s)…</p>}
                              </div>
                            ) : (
                              <p className="text-xs text-muted">Nenhum serviço registrado ainda.</p>
                            )}
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                }) : (
                  <tr><td colSpan={6} className="py-10 text-center text-sm text-muted">{clientesReg.length ? "Nenhum cliente encontrado." : "Nenhum cliente cadastrado."}</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </CardBody>
      </Card>

      {modal && <ClienteModal open={modal} onClose={() => { setModal(false); setEdit(null); }} cliente={edit} />}
      <ConfirmDialog
        open={!!del}
        title="Excluir cliente"
        message={`Excluir "${del?.nome}"? O histórico de ordens não é apagado (o nome continua nas ordens).`}
        confirmLabel="Excluir"
        onConfirm={excluir}
        onCancel={() => setDel(null)}
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
