"use client";

import * as React from "react";
import { createClient } from "@/lib/supabase/client";
import { useData } from "@/components/data-provider";
import { useToast } from "@/components/ui/toast";
import { Modal, ModalBody, ModalFooter } from "@/components/ui/modal";
import { Input, Select, Textarea, Label } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { formatNumber } from "@/lib/utils";
import type { Produto, MovimentoTipo } from "@/lib/types";

export function MovimentoModal({
  open,
  onClose,
  produto,
}: {
  open: boolean;
  onClose: () => void;
  /** Produto pré-selecionado. Se ausente, o usuário escolhe na lista. */
  produto?: Produto | null;
}) {
  const { userId, produtos, refresh } = useData();
  const toast = useToast();
  const [saving, setSaving] = React.useState(false);
  const [tipo, setTipo] = React.useState<MovimentoTipo>("entrada");
  const [produtoId, setProdutoId] = React.useState(produto?.id ?? "");

  React.useEffect(() => {
    if (open) {
      setTipo("entrada");
      setProdutoId(produto?.id ?? "");
    }
  }, [open, produto]);

  const ativos = React.useMemo(
    () => produtos.filter((p) => p.ativo || p.id === produto?.id),
    [produtos, produto],
  );
  const selecionado = produtos.find((p) => p.id === produtoId) ?? null;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!produtoId) return toast("Selecione um produto.", "error");
    const fd = new FormData(e.currentTarget);
    const quantidade = parseFloat(fd.get("quantidade") as string);
    if (isNaN(quantidade) || quantidade < 0) return toast("Quantidade inválida.", "error");

    setSaving(true);
    const custo = fd.get("custo_unitario") as string;
    const rec = {
      produto_id: produtoId,
      tipo,
      quantidade,
      custo_unitario: tipo === "entrada" && custo ? parseFloat(custo) : null,
      motivo: (fd.get("motivo") as string)?.trim() || null,
      referencia: (fd.get("referencia") as string)?.trim() || null,
      created_by: userId,
    };

    const { error } = await createClient().from("estoque_movimentos").insert([rec]);
    setSaving(false);
    if (error) {
      // A trigger devolve "Estoque insuficiente..." quando a saída excede o saldo
      return toast("Erro: " + error.message, "error");
    }
    await refresh();
    toast("Movimentação registrada.");
    onClose();
  }

  const labelQtd =
    tipo === "ajuste" ? "Saldo correto (contagem) *" : "Quantidade *";

  return (
    <Modal open={open} onClose={onClose} title="Movimentar Estoque" className="max-w-lg">
      <form onSubmit={handleSubmit}>
        <ModalBody>
          <div>
            <Label>Produto *</Label>
            <Select
              name="produto_id"
              required
              value={produtoId}
              onChange={(e) => setProdutoId(e.target.value)}
              disabled={!!produto}
            >
              <option value="">Selecione</option>
              {ativos.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.sku ? `${p.sku} · ` : ""}
                  {p.nome}
                </option>
              ))}
            </Select>
            {selecionado && (
              <p className="text-[11px] text-muted mt-1">
                Saldo atual:{" "}
                <span className="font-semibold text-foreground">
                  {formatNumber(selecionado.estoque_atual)} {selecionado.unidade}
                </span>
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Tipo *</Label>
              <Select
                name="tipo"
                required
                value={tipo}
                onChange={(e) => setTipo(e.target.value as MovimentoTipo)}
              >
                <option value="entrada">Entrada</option>
                <option value="saida">Saída</option>
                <option value="ajuste">Ajuste (contagem)</option>
              </Select>
            </div>
            <div>
              <Label>{labelQtd}</Label>
              <Input type="number" name="quantidade" step="0.01" min="0" required autoFocus />
            </div>
          </div>

          {tipo === "entrada" && (
            <div>
              <Label>Custo unitário (R$)</Label>
              <Input
                type="number"
                name="custo_unitario"
                step="0.01"
                min="0"
                defaultValue={selecionado?.custo_unitario || ""}
                placeholder="Atualiza o custo médio"
              />
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Referência</Label>
              <Input name="referencia" placeholder="NF, ordem, etc." />
            </div>
          </div>

          <div>
            <Label>Motivo / observação</Label>
            <Textarea name="motivo" placeholder="Ex.: Compra fornecedor X, baixa para obra Y..." />
          </div>

          {tipo === "ajuste" && (
            <p className="text-[11px] text-muted">
              O ajuste define o saldo absoluto do produto (use após contagem física).
            </p>
          )}
        </ModalBody>
        <ModalFooter>
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? "Salvando..." : "Registrar"}
          </Button>
        </ModalFooter>
      </form>
    </Modal>
  );
}
