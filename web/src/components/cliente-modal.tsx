"use client";

import * as React from "react";
import { createClient } from "@/lib/supabase/client";
import { useData } from "@/components/data-provider";
import { useToast } from "@/components/ui/toast";
import { Modal, ModalBody, ModalFooter } from "@/components/ui/modal";
import { Input, Textarea, Label } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import type { Cliente } from "@/lib/types";

export function ClienteModal({
  open,
  onClose,
  cliente,
}: {
  open: boolean;
  onClose: () => void;
  cliente?: Cliente | null;
}) {
  const { userId, filial, refresh } = useData();
  const toast = useToast();
  const [saving, setSaving] = React.useState(false);
  const editando = !!cliente;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    const fd = new FormData(e.currentTarget);
    const rec = {
      nome: (fd.get("nome") as string).trim(),
      telefone: (fd.get("telefone") as string)?.trim() || null,
      email: (fd.get("email") as string)?.trim() || null,
      documento: (fd.get("documento") as string)?.trim() || null,
      endereco: (fd.get("endereco") as string)?.trim() || null,
      contato: (fd.get("contato") as string)?.trim() || null,
      obs: (fd.get("obs") as string)?.trim() || null,
      ativo: fd.get("ativo") === "on",
    };
    const supabase = createClient();
    const { error } = editando
      ? await supabase.from("clientes").update(rec).eq("id", cliente!.id)
      : await supabase.from("clientes").insert([{ ...rec, filial: filial || "Matriz", created_by: userId }]);

    setSaving(false);
    if (error) {
      toast(error.code === "23505" ? "Já existe um cliente com esse nome nesta filial." : "Erro: " + error.message, "error");
      return;
    }
    await refresh();
    toast(editando ? "Cliente atualizado." : "Cliente cadastrado.");
    onClose();
  }

  return (
    <Modal open={open} onClose={onClose} title={editando ? "Editar Cliente" : "Novo Cliente"} className="max-w-xl">
      <form onSubmit={handleSubmit}>
        <ModalBody>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <Label>Nome *</Label>
              <Input name="nome" required defaultValue={cliente?.nome ?? ""} />
            </div>
            <div>
              <Label>Telefone</Label>
              <Input name="telefone" placeholder="(00) 00000-0000" defaultValue={cliente?.telefone ?? ""} />
            </div>
            <div>
              <Label>E-mail</Label>
              <Input type="email" name="email" defaultValue={cliente?.email ?? ""} />
            </div>
            <div>
              <Label>Documento (CPF/CNPJ)</Label>
              <Input name="documento" defaultValue={cliente?.documento ?? ""} />
            </div>
            <div>
              <Label>Contato (pessoa)</Label>
              <Input name="contato" defaultValue={cliente?.contato ?? ""} />
            </div>
            <div className="col-span-2">
              <Label>Endereço</Label>
              <Input name="endereco" defaultValue={cliente?.endereco ?? ""} />
            </div>
            <div className="col-span-2">
              <Label>Observações</Label>
              <Textarea name="obs" defaultValue={cliente?.obs ?? ""} />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
            <input type="checkbox" name="ativo" defaultChecked={cliente ? cliente.ativo : true}
              className="h-4 w-4 rounded border-border accent-[var(--primary)]" />
            Cliente ativo
          </label>
        </ModalBody>
        <ModalFooter>
          <Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button type="submit" disabled={saving}>{saving ? "Salvando..." : "Salvar"}</Button>
        </ModalFooter>
      </form>
    </Modal>
  );
}
