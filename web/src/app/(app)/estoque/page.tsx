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
import { Input, Select } from "@/components/ui/field";
import { ConfirmDialog } from "@/components/ui/confirm";
import { ProdutoModal } from "@/components/produto-modal";
import { MovimentoModal } from "@/components/movimento-modal";
import { formatCurrency, formatMoney, formatNumber, formatDate, cn } from "@/lib/utils";
import { MOVIMENTO_LABELS } from "@/lib/types";
import type { Produto } from "@/lib/types";
import {
  Plus,
  ArrowDownUp,
  Package,
  Wallet,
  AlertTriangle,
  XCircle,
  Pencil,
  Trash2,
  Search,
} from "lucide-react";

type Aba = "produtos" | "movimentos";

type StatusEstoque = "ok" | "baixo" | "zerado";
function statusDe(p: Produto): StatusEstoque {
  if (p.estoque_atual <= 0) return "zerado";
  if (p.estoque_atual <= p.estoque_minimo) return "baixo";
  return "ok";
}

export default function EstoquePage() {
  const { produtos, movimentos, refresh, loading } = useData();
  const toast = useToast();

  const [aba, setAba] = React.useState<Aba>("produtos");
  const [busca, setBusca] = React.useState("");
  const [catFiltro, setCatFiltro] = React.useState("");
  const [statusFiltro, setStatusFiltro] = React.useState<"" | StatusEstoque>("");

  const [prodModal, setProdModal] = React.useState(false);
  const [editProd, setEditProd] = React.useState<Produto | null>(null);
  const [movModal, setMovModal] = React.useState(false);
  const [movProd, setMovProd] = React.useState<Produto | null>(null);
  const [delProd, setDelProd] = React.useState<Produto | null>(null);

  const categorias = React.useMemo(
    () =>
      Array.from(new Set(produtos.map((p) => p.categoria).filter((c): c is string => !!c))).sort(
        (a, b) => a.localeCompare(b),
      ),
    [produtos],
  );

  // KPIs (sobre produtos ativos)
  const ativos = produtos.filter((p) => p.ativo);
  const valorTotal = ativos.reduce((s, p) => s + p.estoque_atual * p.custo_unitario, 0);
  const abaixoMin = ativos.filter((p) => statusDe(p) === "baixo").length;
  const zerados = ativos.filter((p) => statusDe(p) === "zerado").length;

  const produtosFiltrados = React.useMemo(() => {
    const q = busca.trim().toLowerCase();
    return produtos.filter((p) => {
      if (catFiltro && p.categoria !== catFiltro) return false;
      if (statusFiltro && statusDe(p) !== statusFiltro) return false;
      if (!q) return true;
      return (
        p.nome.toLowerCase().includes(q) ||
        (p.sku ?? "").toLowerCase().includes(q) ||
        (p.categoria ?? "").toLowerCase().includes(q)
      );
    });
  }, [produtos, busca, catFiltro, statusFiltro]);

  const prodPorId = React.useMemo(
    () => new Map(produtos.map((p) => [p.id, p])),
    [produtos],
  );

  async function excluir() {
    if (!delProd) return;
    const { error } = await createClient().from("produtos").delete().eq("id", delProd.id);
    setDelProd(null);
    if (error) {
      toast(
        error.code === "42501"
          ? "Só quem cadastrou o produto pode excluí-lo."
          : "Erro: " + error.message,
        "error",
      );
      return;
    }
    await refresh();
    toast("Produto excluído.");
  }

  function abrirNovo() {
    setEditProd(null);
    setProdModal(true);
  }
  function abrirEdicao(p: Produto) {
    setEditProd(p);
    setProdModal(true);
  }
  function abrirMovimento(p: Produto | null) {
    setMovProd(p);
    setMovModal(true);
  }

  if (loading)
    return (
      <>
        <PageHeader title="Estoque" />
        <KpiSkeletonRow count={4} />
        <Skeleton className="h-96" />
      </>
    );

  return (
    <>
      <PageHeader title="Estoque" subtitle="Controle de produtos, insumos e movimentações">
        <Button variant="secondary" onClick={() => abrirMovimento(null)}>
          <ArrowDownUp size={16} /> Movimentar
        </Button>
        <Button onClick={abrirNovo}>
          <Plus size={16} /> Novo Produto
        </Button>
      </PageHeader>

      <div className="stagger grid gap-3 mb-5 grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Itens ativos" value={ativos.length} format={(n) => formatNumber(n)} icon={Package} />
        <KpiCard label="Valor em estoque" value={valorTotal} format={(n) => formatCurrency(n)} tone="teal" icon={Wallet} />
        <KpiCard label="Abaixo do mínimo" value={abaixoMin} format={(n) => formatNumber(n)} tone={abaixoMin > 0 ? "orange" : "default"} icon={AlertTriangle} />
        <KpiCard label="Zerados" value={zerados} format={(n) => formatNumber(n)} tone={zerados > 0 ? "red" : "default"} icon={XCircle} />
      </div>

      {/* Abas */}
      <div className="flex gap-1 mb-4 border-b border-border">
        <TabBtn active={aba === "produtos"} onClick={() => setAba("produtos")}>
          Produtos
        </TabBtn>
        <TabBtn active={aba === "movimentos"} onClick={() => setAba("movimentos")}>
          Movimentações
        </TabBtn>
      </div>

      {aba === "produtos" ? (
        <Card>
          <CardHeader className="flex-wrap gap-2">
            <CardTitle>Produtos ({produtosFiltrados.length})</CardTitle>
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" />
                <Input
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  placeholder="Buscar nome, SKU..."
                  className="pl-8 w-48"
                />
              </div>
              <Select value={catFiltro} onChange={(e) => setCatFiltro(e.target.value)} className="w-40">
                <option value="">Todas categorias</option>
                {categorias.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </Select>
              <Select
                value={statusFiltro}
                onChange={(e) => setStatusFiltro(e.target.value as "" | StatusEstoque)}
                className="w-36"
              >
                <option value="">Todos status</option>
                <option value="ok">Em dia</option>
                <option value="baixo">Abaixo do mínimo</option>
                <option value="zerado">Zerado</option>
              </Select>
            </div>
          </CardHeader>
          <CardBody className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left">
                    <Th>SKU</Th>
                    <Th>Produto</Th>
                    <Th>Categoria</Th>
                    <Th className="text-right">Saldo</Th>
                    <Th className="text-right">Mínimo</Th>
                    <Th className="text-right">Custo un.</Th>
                    <Th className="text-right">Valor total</Th>
                    <Th>Status</Th>
                    <Th className="text-right">Ações</Th>
                  </tr>
                </thead>
                <tbody>
                  {produtosFiltrados.length ? (
                    produtosFiltrados.map((p) => {
                      const st = statusDe(p);
                      return (
                        <tr
                          key={p.id}
                          className={cn(
                            "border-b border-border last:border-0 hover:bg-surface-2 transition-colors",
                            !p.ativo && "opacity-50",
                          )}
                        >
                          <Td className="text-muted">{p.sku ?? "—"}</Td>
                          <Td className="font-medium">
                            {p.nome}
                            {p.localizacao && (
                              <span className="block text-[11px] text-muted">{p.localizacao}</span>
                            )}
                          </Td>
                          <Td className="text-muted">{p.categoria ?? "—"}</Td>
                          <Td className="text-right font-semibold tabular-nums">
                            {formatNumber(p.estoque_atual)} <span className="text-muted font-normal">{p.unidade}</span>
                          </Td>
                          <Td className="text-right text-muted tabular-nums">{formatNumber(p.estoque_minimo)}</Td>
                          <Td className="text-right tabular-nums">{formatMoney(p.custo_unitario)}</Td>
                          <Td className="text-right tabular-nums">{formatCurrency(p.estoque_atual * p.custo_unitario)}</Td>
                          <Td>
                            <StatusEstoqueBadge status={st} />
                          </Td>
                          <Td>
                            <div className="flex items-center justify-end gap-1">
                              <IconBtn title="Movimentar" onClick={() => abrirMovimento(p)}>
                                <ArrowDownUp size={14} />
                              </IconBtn>
                              <IconBtn title="Editar" onClick={() => abrirEdicao(p)}>
                                <Pencil size={14} />
                              </IconBtn>
                              <IconBtn title="Excluir" danger onClick={() => setDelProd(p)}>
                                <Trash2 size={14} />
                              </IconBtn>
                            </div>
                          </Td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={9} className="py-10 text-center text-sm text-muted">
                        {produtos.length
                          ? "Nenhum produto encontrado com esses filtros."
                          : "Nenhum produto cadastrado ainda."}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardBody>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Últimas movimentações ({movimentos.length})</CardTitle>
          </CardHeader>
          <CardBody className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left">
                    <Th>Data</Th>
                    <Th>Produto</Th>
                    <Th>Tipo</Th>
                    <Th className="text-right">Qtd</Th>
                    <Th className="text-right">Saldo após</Th>
                    <Th>Referência</Th>
                    <Th>Motivo</Th>
                  </tr>
                </thead>
                <tbody>
                  {movimentos.length ? (
                    movimentos.map((m) => {
                      const p = prodPorId.get(m.produto_id);
                      const sinal = m.tipo === "saida" ? "−" : m.tipo === "entrada" ? "+" : "=";
                      return (
                        <tr key={m.id} className="border-b border-border last:border-0 hover:bg-surface-2 transition-colors">
                          <Td className="whitespace-nowrap text-muted">
                            {formatDate(m.created_at.split("T")[0])}
                          </Td>
                          <Td className="font-medium">{p?.nome ?? "—"}</Td>
                          <Td>
                            <MovimentoBadge tipo={m.tipo} />
                          </Td>
                          <Td className="text-right tabular-nums">
                            {sinal} {formatNumber(m.quantidade)} {p ? <span className="text-muted">{p.unidade}</span> : ""}
                          </Td>
                          <Td className="text-right font-semibold tabular-nums">{formatNumber(m.saldo_apos)}</Td>
                          <Td className="text-muted">{m.referencia ?? "—"}</Td>
                          <Td className="text-muted max-w-[280px] truncate">{m.motivo ?? "—"}</Td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={7} className="py-10 text-center text-sm text-muted">
                        Nenhuma movimentação registrada.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardBody>
        </Card>
      )}

      {prodModal && (
        <ProdutoModal open={prodModal} onClose={() => setProdModal(false)} produto={editProd} />
      )}
      {movModal && (
        <MovimentoModal open={movModal} onClose={() => setMovModal(false)} produto={movProd} />
      )}
      <ConfirmDialog
        open={!!delProd}
        title="Excluir produto"
        message={`Excluir "${delProd?.nome}"? Todo o histórico de movimentações dele também será removido.`}
        confirmLabel="Excluir"
        onConfirm={excluir}
        onCancel={() => setDelProd(null)}
      />
    </>
  );
}

function TabBtn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors cursor-pointer",
        active
          ? "border-primary text-primary"
          : "border-transparent text-muted hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

function StatusEstoqueBadge({ status }: { status: StatusEstoque }) {
  if (status === "zerado") return <Badge tone="red">Zerado</Badge>;
  if (status === "baixo") return <Badge tone="orange">Abaixo do mín.</Badge>;
  return <Badge tone="green">Em dia</Badge>;
}

function MovimentoBadge({ tipo }: { tipo: "entrada" | "saida" | "ajuste" }) {
  const tone = tipo === "entrada" ? "green" : tipo === "saida" ? "red" : "gray";
  return <Badge tone={tone}>{MOVIMENTO_LABELS[tipo]}</Badge>;
}

function IconBtn({
  children,
  title,
  danger,
  onClick,
}: {
  children: React.ReactNode;
  title: string;
  danger?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={cn(
        "p-1.5 rounded-md text-muted cursor-pointer transition-colors",
        danger ? "hover:text-red hover:bg-red-soft" : "hover:text-foreground hover:bg-surface-2",
      )}
    >
      {children}
    </button>
  );
}

function Th({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <th className={cn("px-4 py-3 text-xs font-semibold text-muted uppercase tracking-wide whitespace-nowrap", className)}>
      {children}
    </th>
  );
}
function Td({ children, className }: { children: React.ReactNode; className?: string }) {
  return <td className={cn("px-4 py-3", className)}>{children}</td>;
}
