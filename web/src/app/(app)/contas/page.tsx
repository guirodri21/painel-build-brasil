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
import { ConfirmDialog } from "@/components/ui/confirm";
import { ContaModal } from "@/components/conta-modal";
import { BalancoChart } from "@/components/charts";
import { sum } from "@/lib/analytics";
import { formatCurrency, formatDate, monthLabel, todayISO, cn } from "@/lib/utils";
import type { Conta, ContaTipo } from "@/lib/types";
import { Plus, ArrowDownCircle, ArrowUpCircle, AlertTriangle, Wallet, Check, Pencil, Trash2 } from "lucide-react";

type Aba = "pagar" | "receber";

export default function ContasPage() {
  const { contas, refresh, loading } = useData();
  const toast = useToast();
  const [aba, setAba] = React.useState<Aba>("pagar");
  const [modal, setModal] = React.useState(false);
  const [edit, setEdit] = React.useState<Conta | null>(null);
  const [del, setDel] = React.useState<Conta | null>(null);

  const hoje = todayISO();
  const aPagar = contas.filter((c) => c.tipo === "pagar");
  const aReceber = contas.filter((c) => c.tipo === "receber");
  const vencidoPagar = sum(aPagar.filter((c) => !c.pago && c.vencimento < hoje), (c) => c.valor);
  const abertoPagar = sum(aPagar.filter((c) => !c.pago), (c) => c.valor);
  const abertoReceber = sum(aReceber.filter((c) => !c.pago), (c) => c.valor);
  const saldoProjetado = abertoReceber - abertoPagar;

  // Fluxo de caixa por mês (receber = entrada, pagar = saída)
  const fluxo = React.useMemo(() => {
    const m = new Map<string, { receita: number; despesa: number }>();
    for (const c of contas) {
      if (c.pago) continue;
      const mes = c.vencimento.substring(0, 7);
      const cur = m.get(mes) ?? { receita: 0, despesa: 0 };
      if (c.tipo === "receber") cur.receita += c.valor; else cur.despesa += c.valor;
      m.set(mes, cur);
    }
    return Array.from(m.keys()).sort().map((mes) => {
      const b = m.get(mes)!;
      return { mes: monthLabel(mes), receita: b.receita, despesa: b.despesa, saldo: b.receita - b.despesa };
    });
  }, [contas]);

  const lista = (aba === "pagar" ? aPagar : aReceber)
    .slice()
    .sort((a, b) => Number(a.pago) - Number(b.pago) || a.vencimento.localeCompare(b.vencimento));

  function statusDe(c: Conta): { label: string; tone: "green" | "red" | "yellow" | "gray" } {
    if (c.pago) return { label: c.tipo === "pagar" ? "Pago" : "Recebido", tone: "green" };
    if (c.vencimento < hoje) return { label: "Vencido", tone: "red" };
    return { label: "Em aberto", tone: "yellow" };
  }

  async function marcarPago(c: Conta) {
    const { error } = await createClient().from("contas").update({ pago: true, pago_em: hoje }).eq("id", c.id);
    if (error) { toast("Erro: " + error.message, "error"); return; }
    await refresh();
    toast(c.tipo === "pagar" ? "Marcado como pago." : "Marcado como recebido.");
  }

  async function excluir() {
    if (!del) return;
    const { error } = await createClient().from("contas").delete().eq("id", del.id);
    setDel(null);
    if (error) { toast("Erro: " + error.message, "error"); return; }
    await refresh();
    toast("Conta excluída.");
  }

  function abrirNova(t: ContaTipo) { setEdit(null); setAba(t); setModal(true); }

  if (loading)
    return (<><PageHeader title="Contas" /><KpiSkeletonRow count={4} /><Skeleton className="h-80" /></>);

  return (
    <>
      <PageHeader title="Contas" subtitle="A pagar, a receber e fluxo de caixa">
        <Button variant="secondary" onClick={() => abrirNova("receber")}><Plus size={16} /> A Receber</Button>
        <Button onClick={() => abrirNova("pagar")}><Plus size={16} /> A Pagar</Button>
      </PageHeader>

      <div className="stagger grid gap-3 mb-5 grid-cols-2 lg:grid-cols-4">
        <KpiCard label="A pagar (aberto)" value={abertoPagar} format={formatCurrency} tone="orange" icon={ArrowDownCircle} />
        <KpiCard label="A receber (aberto)" value={abertoReceber} format={formatCurrency} tone="teal" icon={ArrowUpCircle} />
        <KpiCard label="Vencido a pagar" value={vencidoPagar} format={formatCurrency} tone={vencidoPagar > 0 ? "red" : "default"} icon={AlertTriangle} />
        <KpiCard label="Saldo projetado" value={saldoProjetado} format={formatCurrency} tone={saldoProjetado >= 0 ? "green" : "red"} icon={Wallet} />
      </div>

      {fluxo.length > 0 && (
        <Card className="mb-5">
          <CardHeader><CardTitle>Fluxo de Caixa Projetado (em aberto)</CardTitle></CardHeader>
          <CardBody><BalancoChart data={fluxo} /></CardBody>
        </Card>
      )}

      <div className="flex gap-1 mb-4 border-b border-border">
        <TabBtn active={aba === "pagar"} onClick={() => setAba("pagar")}>A Pagar ({aPagar.length})</TabBtn>
        <TabBtn active={aba === "receber"} onClick={() => setAba("receber")}>A Receber ({aReceber.length})</TabBtn>
      </div>

      <Card>
        <CardBody className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left">
                  <Th>Vencimento</Th>
                  <Th>Descrição</Th>
                  <Th>Categoria</Th>
                  <Th>Cliente/Forn.</Th>
                  <Th className="text-right">Valor</Th>
                  <Th>Status</Th>
                  <Th className="text-right">Ações</Th>
                </tr>
              </thead>
              <tbody>
                {lista.length ? lista.map((c) => {
                  const st = statusDe(c);
                  return (
                    <tr key={c.id} className={cn("border-b border-border last:border-0 hover:bg-surface-2 transition-colors", c.pago && "opacity-60")}>
                      <Td className="whitespace-nowrap">{formatDate(c.vencimento)}</Td>
                      <Td className="font-medium">{c.descricao}</Td>
                      <Td className="text-muted">{c.categoria ?? "—"}</Td>
                      <Td className="text-muted">{c.cliente ?? "—"}</Td>
                      <Td className="text-right tabular-nums font-medium">{formatCurrency(c.valor)}</Td>
                      <Td><Badge tone={st.tone}>{st.label}</Badge></Td>
                      <Td>
                        <div className="flex items-center justify-end gap-1">
                          {!c.pago && (
                            <button onClick={() => marcarPago(c)} title="Marcar pago/recebido" className="p-1.5 rounded-md text-muted hover:text-green hover:bg-green-soft cursor-pointer"><Check size={14} /></button>
                          )}
                          <button onClick={() => { setEdit(c); setModal(true); }} title="Editar" className="p-1.5 rounded-md text-muted hover:text-primary hover:bg-primary-soft cursor-pointer"><Pencil size={14} /></button>
                          <button onClick={() => setDel(c)} title="Excluir" className="p-1.5 rounded-md text-muted hover:text-red hover:bg-red-soft cursor-pointer"><Trash2 size={14} /></button>
                        </div>
                      </Td>
                    </tr>
                  );
                }) : (
                  <tr><td colSpan={7} className="py-10 text-center text-sm text-muted">Nenhuma conta {aba === "pagar" ? "a pagar" : "a receber"}.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </CardBody>
      </Card>

      {modal && <ContaModal open={modal} onClose={() => { setModal(false); setEdit(null); }} conta={edit} tipoInicial={aba} />}
      <ConfirmDialog open={!!del} title="Excluir conta" message={`Excluir "${del?.descricao}"?`} confirmLabel="Excluir" onConfirm={excluir} onCancel={() => setDel(null)} />
    </>
  );
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className={cn("px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors cursor-pointer", active ? "border-primary text-primary" : "border-transparent text-muted hover:text-foreground")}>
      {children}
    </button>
  );
}
function Th({ children, className }: { children: React.ReactNode; className?: string }) {
  return <th className={cn("px-4 py-3 text-xs font-semibold text-muted uppercase tracking-wide whitespace-nowrap", className)}>{children}</th>;
}
function Td({ children, className }: { children: React.ReactNode; className?: string }) {
  return <td className={cn("px-4 py-3", className)}>{children}</td>;
}
