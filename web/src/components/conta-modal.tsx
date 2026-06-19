"use client";

import * as React from "react";
import { createClient } from "@/lib/supabase/client";
import { useData } from "@/components/data-provider";
import { useToast } from "@/components/ui/toast";
import { Modal, ModalBody, ModalFooter } from "@/components/ui/modal";
import { Input, Select, Label } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { todayISO } from "@/lib/utils";
import type { Conta, ContaTipo } from "@/lib/types";

export function ContaModal({
  open,
  onClose,
  conta,
  tipoInicial = "pagar",
}: {
  open: boolean;
  onClose: () => void;
  conta?: Conta | null;
  tipoInicial?: ContaTipo;
}) {
  const { userId, filial, clientes, refresh } = useData();
  const toast = useToast();
  const [saving, setSaving] = React.useState(false);
  const [pago, setPago] = React.useState(conta?.pago ?? false);
  const editando = !!conta;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    const fd = new FormData(e.currentTarget);
    const estaPago = fd.get("pago") === "on";
    const rec = {
      tipo: fd.get("tipo") as string,
      descricao: (fd.get("descricao") as string).trim(),
      categoria: (fd.get("categoria") as string)?.trim() || null,
      valor: parseFloat(fd.get("valor") as string) || 0,
      vencimento: fd.get("vencimento") as string,
      cliente: (fd.get("cliente") as string)?.trim() || null,
      pago: estaPago,
      pago_em: estaPago ? ((fd.get("pago_em") as string) || todayISO()) : null,
    };
    const supabase = createClient();
    const { error } = editando
      ? await supabase.from("contas").update(rec).eq("id", conta!.id)
      : await supabase.from("contas").insert([{ ...rec, filial: filial || "Matriz", created_by: userId }]);

    setSaving(false);
    if (error) { toast("Erro: " + error.message, "error"); return; }
    await refresh();
    toast(editando ? "Conta atualizada." : "Conta criada.");
    onClose();
  }

  return (
    <Modal open={open} onClose={onClose} title={editando ? "Editar Conta" : "Nova Conta"} className="max-w-lg">
      <form onSubmit={handleSubmit}>
        <ModalBody>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Tipo *</Label>
              <Select name="tipo" required defaultValue={conta?.tipo ?? tipoInicial}>
                <option value="pagar">A pagar</option>
                <option value="receber">A receber</option>
              </Select>
            </div>
            <div>
              <Label>Vencimento *</Label>
              <Input type="date" name="vencimento" required defaultValue={conta?.vencimento ?? todayISO()} />
            </div>
            <div className="col-span-2">
              <Label>Descrição *</Label>
              <Input name="descricao" required placeholder="Ex.: Fornecedor X / NF 123" defaultValue={conta?.descricao ?? ""} />
            </div>
            <div>
              <Label>Categoria</Label>
              <Input name="categoria" placeholder="Ex.: Material, Aluguel..." defaultValue={conta?.categoria ?? ""} />
            </div>
            <div>
              <Label>Valor (R$) *</Label>
              <Input type="number" name="valor" step="0.01" min="0" required defaultValue={conta?.valor ?? ""} />
            </div>
            <div className="col-span-2">
              <Label>Cliente / Fornecedor</Label>
              <Input name="cliente" list="contas-clientes" defaultValue={conta?.cliente ?? ""} />
              <datalist id="contas-clientes">
                {clientes.map((c) => <option key={c} value={c} />)}
              </datalist>
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
            <input type="checkbox" name="pago" checked={pago} onChange={(e) => setPago(e.target.checked)}
              className="h-4 w-4 rounded border-border accent-[var(--primary)]" />
            Já {/* */}pago / recebido
          </label>
          {pago && (
            <div className="w-1/2">
              <Label>Data do pagamento</Label>
              <Input type="date" name="pago_em" defaultValue={conta?.pago_em ?? todayISO()} />
            </div>
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
