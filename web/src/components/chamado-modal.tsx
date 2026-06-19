"use client";

import * as React from "react";
import { createClient } from "@/lib/supabase/client";
import { useData } from "@/components/data-provider";
import { useToast } from "@/components/ui/toast";
import { Modal, ModalBody, ModalFooter } from "@/components/ui/modal";
import { Input, Select, Textarea, Label } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import type { Chamado } from "@/lib/types";

export function ChamadoModal({
  open,
  onClose,
  chamado,
  faseInicial,
}: {
  open: boolean;
  onClose: () => void;
  chamado?: Chamado | null;
  faseInicial?: string;
}) {
  const { userId, filial, chamadoFases, clientes, refresh } = useData();
  const toast = useToast();
  const [saving, setSaving] = React.useState(false);
  const editando = !!chamado;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    const fd = new FormData(e.currentTarget);
    const rec = {
      titulo: (fd.get("titulo") as string)?.trim() || null,
      cliente: (fd.get("cliente") as string)?.trim() || null,
      regiao: (fd.get("regiao") as string)?.trim() || null,
      descricao: (fd.get("descricao") as string)?.trim() || null,
      prioridade: (fd.get("prioridade") as string) || null,
      ticket_ref: (fd.get("ticket_ref") as string)?.trim() || null,
      fase: fd.get("fase") as string,
      valor: parseFloat(fd.get("valor") as string) || 0,
      responsavel: (fd.get("responsavel") as string)?.trim() || null,
    };
    const supabase = createClient();
    const { error } = editando
      ? await supabase.from("chamados").update(rec).eq("id", chamado!.id)
      : await supabase.from("chamados").insert([{ ...rec, filial: filial || "Matriz", created_by: userId }]);

    setSaving(false);
    if (error) { toast("Erro: " + error.message, "error"); return; }
    await refresh();
    toast(editando ? "Chamado atualizado." : "Chamado criado.");
    onClose();
  }

  return (
    <Modal open={open} onClose={onClose} title={editando ? "Editar Chamado" : "Novo Chamado"} className="max-w-xl">
      <form onSubmit={handleSubmit}>
        <ModalBody>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <Label>Título / demanda</Label>
              <Input name="titulo" defaultValue={chamado?.titulo ?? ""} placeholder="Ex.: Chamado" />
            </div>
            <div>
              <Label>Cliente / solicitante</Label>
              <Input name="cliente" list="cha-clientes" defaultValue={chamado?.cliente ?? ""} />
              <datalist id="cha-clientes">{clientes.map((c) => <option key={c} value={c} />)}</datalist>
            </div>
            <div>
              <Label>Região</Label>
              <Input name="regiao" defaultValue={chamado?.regiao ?? ""} />
            </div>
            <div>
              <Label>Prioridade</Label>
              <Select name="prioridade" defaultValue={chamado?.prioridade ?? ""}>
                <option value="">—</option>
                <option value="Alta">Alta</option>
                <option value="Média">Média</option>
                <option value="Baixa">Baixa</option>
              </Select>
            </div>
            <div>
              <Label>Fase *</Label>
              <Select name="fase" required defaultValue={chamado?.fase ?? faseInicial ?? "Triagem"}>
                {chamadoFases.map((f) => <option key={f.id} value={f.nome}>{f.nome}</option>)}
              </Select>
            </div>
            <div>
              <Label>Ticket (ref.)</Label>
              <Input name="ticket_ref" defaultValue={chamado?.ticket_ref ?? ""} />
            </div>
            <div>
              <Label>Valor (R$)</Label>
              <Input type="number" name="valor" step="0.01" min="0" defaultValue={chamado?.valor || ""} />
            </div>
            <div className="col-span-2">
              <Label>Responsável</Label>
              <Input name="responsavel" defaultValue={chamado?.responsavel ?? ""} />
            </div>
            <div className="col-span-2">
              <Label>Descrição</Label>
              <Textarea name="descricao" defaultValue={chamado?.descricao ?? ""} />
            </div>
          </div>
          {chamado?.goalfy_card_id && (
            <p className="text-[11px] text-muted">Sincronizado do Goalfy (card {chamado.goalfy_card_id}).</p>
          )}
        </ModalBody>
        <ModalFooter>
          <Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button type="submit" disabled={saving}>{saving ? "Salvando..." : "Salvar"}</Button>
        </ModalFooter>
      </form>
    </Modal>
  );
}
