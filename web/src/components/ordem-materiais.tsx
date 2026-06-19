"use client";

import * as React from "react";
import { createClient } from "@/lib/supabase/client";
import { useData } from "@/components/data-provider";
import { useToast } from "@/components/ui/toast";
import { Input, Select, Label } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { formatMoney, formatNumber } from "@/lib/utils";
import { alertarSeEstoqueBaixo } from "@/lib/integrations";
import type { OrdemMaterial } from "@/lib/types";
import { Plus, Trash2, Package } from "lucide-react";

/** Materiais consumidos numa ordem — baixa automática no estoque. */
export function OrdemMateriais({ ordemId, filial }: { ordemId: string; filial: string | null }) {
  const { produtos, userId, refresh } = useData();
  const toast = useToast();
  const [itens, setItens] = React.useState<OrdemMaterial[]>([]);
  const [produtoId, setProdutoId] = React.useState("");
  const [qtd, setQtd] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [loading, setLoading] = React.useState(true);

  const prodPorId = React.useMemo(() => new Map(produtos.map((p) => [p.id, p])), [produtos]);

  const carregar = React.useCallback(async () => {
    const { data } = await createClient()
      .from("ordem_materiais")
      .select("*")
      .eq("ordem_id", ordemId)
      .order("created_at");
    setItens((data as OrdemMaterial[]) ?? []);
    setLoading(false);
  }, [ordemId]);

  React.useEffect(() => { carregar(); }, [carregar]);

  async function adicionar() {
    const quantidade = parseFloat(qtd);
    if (!produtoId || isNaN(quantidade) || quantidade <= 0) {
      toast("Escolha o produto e a quantidade.", "error");
      return;
    }
    setBusy(true);
    const { error } = await createClient().from("ordem_materiais").insert([
      { ordem_id: ordemId, produto_id: produtoId, quantidade, filial: filial || "Matriz", created_by: userId },
    ]);
    setBusy(false);
    if (error) {
      toast("Erro: " + error.message, "error"); // ex.: "Estoque insuficiente..."
      return;
    }
    const p = prodPorId.get(produtoId);
    if (p) alertarSeEstoqueBaixo(p, p.estoque_atual - quantidade);
    setProdutoId("");
    setQtd("");
    await carregar();
    await refresh(); // atualiza saldo do estoque no app
    toast("Material lançado (baixa no estoque).");
  }

  async function remover(id: string) {
    const { error } = await createClient().from("ordem_materiais").delete().eq("id", id);
    if (error) { toast("Erro: " + error.message, "error"); return; }
    await carregar();
    await refresh();
    toast("Material estornado.");
  }

  const custoTotal = itens.reduce((s, it) => s + it.quantidade * (it.custo_unitario_snapshot ?? 0), 0);
  const ativos = produtos.filter((p) => p.ativo);

  return (
    <div className="rounded-lg border border-border bg-surface-2/40 p-3">
      <div className="flex items-center gap-2 mb-2 text-sm font-semibold">
        <Package size={15} className="text-muted" /> Materiais utilizados
      </div>

      {loading ? (
        <p className="text-xs text-muted">Carregando…</p>
      ) : itens.length ? (
        <ul className="divide-y divide-border mb-3">
          {itens.map((it) => {
            const p = prodPorId.get(it.produto_id);
            return (
              <li key={it.id} className="flex items-center justify-between py-1.5 text-sm">
                <span className="flex-1 truncate">{p?.nome ?? "Produto"}</span>
                <span className="tabular-nums text-muted px-2">
                  {formatNumber(it.quantidade)} {p?.unidade ?? ""} · {formatMoney(it.quantidade * (it.custo_unitario_snapshot ?? 0))}
                </span>
                <button type="button" onClick={() => remover(it.id)} title="Estornar"
                  className="p-1 rounded text-muted hover:text-red hover:bg-red-soft cursor-pointer">
                  <Trash2 size={13} />
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-xs text-muted mb-3">Nenhum material lançado.</p>
      )}

      <div className="grid grid-cols-[1fr_90px_auto] gap-2 items-end">
        <div>
          <Label>Produto</Label>
          <Select value={produtoId} onChange={(e) => setProdutoId(e.target.value)}>
            <option value="">Selecione</option>
            {ativos.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nome} ({formatNumber(p.estoque_atual)} {p.unidade})
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label>Qtd</Label>
          <Input type="number" step="0.01" min="0" value={qtd} onChange={(e) => setQtd(e.target.value)} />
        </div>
        <Button type="button" size="icon" onClick={adicionar} disabled={busy} aria-label="Adicionar material">
          <Plus size={16} />
        </Button>
      </div>

      {itens.length > 0 && (
        <p className="text-xs text-muted mt-2">
          Custo de material: <span className="font-semibold text-foreground">{formatMoney(custoTotal)}</span>
          <span className="italic"> · não entra na despesa direta (rastreado à parte).</span>
        </p>
      )}
    </div>
  );
}
