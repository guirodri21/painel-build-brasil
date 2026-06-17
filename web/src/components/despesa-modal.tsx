"use client";

import * as React from "react";
import { createClient } from "@/lib/supabase/client";
import { useData } from "@/components/data-provider";
import { useToast } from "@/components/ui/toast";
import { Modal, ModalBody, ModalFooter } from "@/components/ui/modal";
import { Input, Select, Label } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { todayISO } from "@/lib/utils";
import type { DespesaGeral } from "@/lib/types";

export function DespesaModal({
  open,
  onClose,
  despesa,
}: {
  open: boolean;
  onClose: () => void;
  despesa?: DespesaGeral | null;
}) {
  const { userId, refresh } = useData();
  const toast = useToast();
  const [saving, setSaving] = React.useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    const fd = new FormData(e.currentTarget);
    const rec = {
      data: fd.get("data") as string,
      categoria: fd.get("categoria") as string,
      descricao: (fd.get("descricao") as string) || null,
      valor: parseFloat(fd.get("valor") as string) || 0,
    };
    const supabase = createClient();
    const { error } = despesa
      ? await supabase.from("despesas_gerais").update(rec).eq("id", despesa.id)
      : await supabase.from("despesas_gerais").insert([{ ...rec, created_by: userId }]);

    setSaving(false);
    if (error) {
      toast("Erro: " + error.message, "error");
      return;
    }
    await refresh();
    toast(despesa ? "Despesa atualizada." : "Despesa criada.");
    onClose();
  }

  return (
    <Modal open={open} onClose={onClose} title={despesa ? "Editar Despesa" : "Nova Despesa Geral"} className="max-w-md">
      <form onSubmit={handleSubmit}>
        <ModalBody>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Data *</Label>
              <Input type="date" name="data" required defaultValue={despesa?.data ?? todayISO()} />
            </div>
            <div>
              <Label>Categoria *</Label>
              <Select name="categoria" required defaultValue={despesa?.categoria ?? ""}>
                <option value="">Selecione</option>
                <option value="suprimentos">Suprimentos</option>
                <option value="contas">Contas</option>
                <option value="outros">Outros</option>
              </Select>
            </div>
          </div>
          <div>
            <Label>Descrição</Label>
            <Input type="text" name="descricao" placeholder="Ex.: Compra de EPIs" defaultValue={despesa?.descricao ?? ""} />
          </div>
          <div>
            <Label>Valor (R$) *</Label>
            <Input type="number" name="valor" step="0.01" min="0" required defaultValue={despesa?.valor ?? ""} />
          </div>
        </ModalBody>
        <ModalFooter>
          <Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button type="submit" disabled={saving}>{saving ? "Salvando..." : "Salvar"}</Button>
        </ModalFooter>
      </form>
    </Modal>
  );
}
