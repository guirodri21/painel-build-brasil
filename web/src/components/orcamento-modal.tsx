"use client";

import * as React from "react";
import { createClient } from "@/lib/supabase/client";
import { useData } from "@/components/data-provider";
import { useToast } from "@/components/ui/toast";
import { Modal, ModalBody, ModalFooter } from "@/components/ui/modal";
import { Input, Select, Textarea, Label } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/utils";
import type { Orcamento, OrcamentoItem } from "@/lib/types";
import { Plus, Trash2 } from "lucide-react";

type ItemDraft = { descricao: string; quantidade: number; valor_unitario: number };

export function OrcamentoModal({
  open,
  onClose,
  orcamento,
}: {
  open: boolean;
  onClose: () => void;
  orcamento?: Orcamento | null;
}) {
  const { userId, filial, clientes, refresh } = useData();
  const toast = useToast();
  const supabase = React.useMemo(() => createClient(), []);
  const [saving, setSaving] = React.useState(false);
  const [itens, setItens] = React.useState<ItemDraft[]>([{ descricao: "", quantidade: 1, valor_unitario: 0 }]);
  const editando = !!orcamento;

  React.useEffect(() => {
    if (orcamento) {
      supabase.from("orcamento_itens").select("*").eq("orcamento_id", orcamento.id).order("ordem_exibicao")
        .then(({ data }) => {
          const rows = (data as OrcamentoItem[]) ?? [];
          setItens(rows.length ? rows.map((r) => ({ descricao: r.descricao, quantidade: r.quantidade, valor_unitario: r.valor_unitario })) : [{ descricao: "", quantidade: 1, valor_unitario: 0 }]);
        });
    }
  }, [orcamento, supabase]);

  const total = itens.reduce((s, i) => s + i.quantidade * i.valor_unitario, 0);

  function setItem(idx: number, patch: Partial<ItemDraft>) {
    setItens((arr) => arr.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  }
  function addItem() { setItens((a) => [...a, { descricao: "", quantidade: 1, valor_unitario: 0 }]); }
  function delItem(idx: number) { setItens((a) => a.filter((_, i) => i !== idx)); }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const validos = itens.filter((i) => i.descricao.trim());
    if (!validos.length) { toast("Adicione ao menos um item.", "error"); return; }
    setSaving(true);
    const fd = new FormData(e.currentTarget);
    const rec = {
      cliente: (fd.get("cliente") as string)?.trim() || null,
      validade: (fd.get("validade") as string) || null,
      status: fd.get("status") as string,
      observacoes: (fd.get("observacoes") as string)?.trim() || null,
      valor_total: total,
    };

    let orcId = orcamento?.id;
    if (editando) {
      const { error } = await supabase.from("orcamentos").update(rec).eq("id", orcId!);
      if (error) { setSaving(false); toast("Erro: " + error.message, "error"); return; }
      await supabase.from("orcamento_itens").delete().eq("orcamento_id", orcId!);
    } else {
      const { data, error } = await supabase.from("orcamentos")
        .insert([{ ...rec, filial: filial || "Matriz", created_by: userId }]).select("id").single();
      if (error || !data) { setSaving(false); toast("Erro: " + (error?.message ?? ""), "error"); return; }
      orcId = data.id;
    }

    const itensRows = validos.map((it, i) => ({
      orcamento_id: orcId, descricao: it.descricao.trim(), quantidade: it.quantidade, valor_unitario: it.valor_unitario, ordem_exibicao: i,
    }));
    const { error: ie } = await supabase.from("orcamento_itens").insert(itensRows);
    setSaving(false);
    if (ie) { toast("Erro nos itens: " + ie.message, "error"); return; }
    await refresh();
    toast(editando ? "Orçamento atualizado." : "Orçamento criado.");
    onClose();
  }

  return (
    <Modal open={open} onClose={onClose} title={editando ? "Editar Orçamento" : "Novo Orçamento"} className="max-w-2xl">
      <form onSubmit={handleSubmit}>
        <ModalBody>
          <div className="grid grid-cols-3 gap-4">
            <div className="col-span-2">
              <Label>Cliente</Label>
              <Input name="cliente" list="orc-clientes" defaultValue={orcamento?.cliente ?? ""} />
              <datalist id="orc-clientes">{clientes.map((c) => <option key={c} value={c} />)}</datalist>
            </div>
            <div>
              <Label>Validade</Label>
              <Input type="date" name="validade" defaultValue={orcamento?.validade ?? ""} />
            </div>
            <div>
              <Label>Status</Label>
              <Select name="status" defaultValue={orcamento?.status ?? "rascunho"}>
                <option value="rascunho">Rascunho</option>
                <option value="enviado">Enviado</option>
                <option value="aprovado">Aprovado</option>
                <option value="recusado">Recusado</option>
              </Select>
            </div>
          </div>

          <div>
            <Label>Itens</Label>
            <div className="space-y-2">
              {itens.map((it, idx) => (
                <div key={idx} className="grid grid-cols-[1fr_70px_100px_auto] gap-2 items-center">
                  <Input placeholder="Descrição" value={it.descricao} onChange={(e) => setItem(idx, { descricao: e.target.value })} />
                  <Input type="number" min="0" step="0.01" placeholder="Qtd" value={it.quantidade} onChange={(e) => setItem(idx, { quantidade: parseFloat(e.target.value) || 0 })} />
                  <Input type="number" min="0" step="0.01" placeholder="Valor un." value={it.valor_unitario} onChange={(e) => setItem(idx, { valor_unitario: parseFloat(e.target.value) || 0 })} />
                  <button type="button" onClick={() => delItem(idx)} className="p-1.5 rounded text-muted hover:text-red hover:bg-red-soft cursor-pointer"><Trash2 size={14} /></button>
                </div>
              ))}
            </div>
            <Button type="button" variant="ghost" size="sm" onClick={addItem} className="mt-2"><Plus size={14} /> Adicionar item</Button>
          </div>

          <div>
            <Label>Observações</Label>
            <Textarea name="observacoes" defaultValue={orcamento?.observacoes ?? ""} />
          </div>

          <div className="text-right text-sm">
            Total: <span className="font-bold text-lg">{formatCurrency(total)}</span>
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
