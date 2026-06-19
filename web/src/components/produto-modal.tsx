"use client";

import * as React from "react";
import { createClient } from "@/lib/supabase/client";
import { useData } from "@/components/data-provider";
import { useToast } from "@/components/ui/toast";
import { Modal, ModalBody, ModalFooter } from "@/components/ui/modal";
import { Input, Select, Label } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { UNIDADES } from "@/lib/types";
import type { Produto } from "@/lib/types";

export function ProdutoModal({
  open,
  onClose,
  produto,
}: {
  open: boolean;
  onClose: () => void;
  produto?: Produto | null;
}) {
  const { userId, produtos, filial, refresh } = useData();
  const toast = useToast();
  const [saving, setSaving] = React.useState(false);

  const editando = !!produto;

  // Sugestões de categoria a partir dos produtos já cadastrados
  const categorias = React.useMemo(
    () =>
      Array.from(new Set(produtos.map((p) => p.categoria).filter((c): c is string => !!c))).sort(
        (a, b) => a.localeCompare(b),
      ),
    [produtos],
  );

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    const fd = new FormData(e.currentTarget);
    const rec = {
      sku: (fd.get("sku") as string)?.trim() || null,
      nome: (fd.get("nome") as string).trim(),
      categoria: (fd.get("categoria") as string)?.trim() || null,
      unidade: (fd.get("unidade") as string) || "un",
      estoque_minimo: parseFloat(fd.get("estoque_minimo") as string) || 0,
      custo_unitario: parseFloat(fd.get("custo_unitario") as string) || 0,
      localizacao: (fd.get("localizacao") as string)?.trim() || null,
      ativo: fd.get("ativo") === "on",
    };

    const supabase = createClient();

    if (editando) {
      const { error } = await supabase.from("produtos").update(rec).eq("id", produto!.id);
      setSaving(false);
      if (error) return toast(erroMsg(error), "error");
      await refresh();
      toast("Produto atualizado.");
      onClose();
      return;
    }

    // Criação: insere o produto e, se houver estoque inicial, lança a entrada
    const { data: novo, error } = await supabase
      .from("produtos")
      .insert([{ ...rec, filial: filial || "Matriz", created_by: userId }])
      .select("id")
      .single();

    if (error || !novo) {
      setSaving(false);
      return toast(erroMsg(error), "error");
    }

    const inicial = parseFloat(fd.get("estoque_inicial") as string) || 0;
    if (inicial > 0) {
      const { error: movErr } = await supabase.from("estoque_movimentos").insert([
        {
          produto_id: novo.id,
          tipo: "entrada",
          quantidade: inicial,
          custo_unitario: rec.custo_unitario || null,
          motivo: "Estoque inicial",
          created_by: userId,
        },
      ]);
      if (movErr) {
        setSaving(false);
        await refresh();
        return toast("Produto criado, mas falhou o estoque inicial: " + movErr.message, "error");
      }
    }

    setSaving(false);
    await refresh();
    toast("Produto cadastrado.");
    onClose();
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editando ? "Editar Produto" : "Novo Produto"}
      className="max-w-xl"
    >
      <form onSubmit={handleSubmit}>
        <ModalBody>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <Label>Nome *</Label>
              <Input name="nome" required placeholder="Ex.: Cabo flexível 2,5mm" defaultValue={produto?.nome ?? ""} />
            </div>
            <div>
              <Label>SKU / Código</Label>
              <Input name="sku" placeholder="Ex.: CB-25" defaultValue={produto?.sku ?? ""} />
            </div>
            <div>
              <Label>Categoria</Label>
              <Input name="categoria" list="categorias-list" placeholder="Ex.: Elétrica" defaultValue={produto?.categoria ?? ""} />
              <datalist id="categorias-list">
                {categorias.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </div>
            <div>
              <Label>Unidade *</Label>
              <Select name="unidade" required defaultValue={produto?.unidade ?? "un"}>
                {UNIDADES.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label>Estoque mínimo</Label>
              <Input type="number" name="estoque_minimo" step="0.01" min="0" defaultValue={produto?.estoque_minimo ?? 0} />
            </div>
            <div>
              <Label>Custo unitário (R$)</Label>
              <Input type="number" name="custo_unitario" step="0.01" min="0" defaultValue={produto?.custo_unitario ?? 0} />
            </div>
            <div>
              <Label>Localização</Label>
              <Input name="localizacao" placeholder="Ex.: Prateleira A3" defaultValue={produto?.localizacao ?? ""} />
            </div>
            {!editando && (
              <div className="col-span-2">
                <Label>Estoque inicial (opcional)</Label>
                <Input type="number" name="estoque_inicial" step="0.01" min="0" placeholder="0" />
                <p className="text-[11px] text-muted mt-1">
                  Se preenchido, registra uma entrada inicial no histórico.
                </p>
              </div>
            )}
          </div>
          <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
            <input
              type="checkbox"
              name="ativo"
              defaultChecked={produto ? produto.ativo : true}
              className="h-4 w-4 rounded border-border accent-[var(--primary)]"
            />
            Produto ativo
          </label>
        </ModalBody>
        <ModalFooter>
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? "Salvando..." : "Salvar"}
          </Button>
        </ModalFooter>
      </form>
    </Modal>
  );
}

function erroMsg(error: { code?: string; message?: string } | null): string {
  if (!error) return "Erro desconhecido.";
  if (error.code === "23505") return "Já existe um produto com esse SKU.";
  return "Erro: " + (error.message ?? "");
}
