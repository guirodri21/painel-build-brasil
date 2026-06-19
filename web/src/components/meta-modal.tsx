"use client";

import * as React from "react";
import { createClient } from "@/lib/supabase/client";
import { useData } from "@/components/data-provider";
import { useToast } from "@/components/ui/toast";
import { Modal, ModalBody, ModalFooter } from "@/components/ui/modal";
import { Input, Select, Label } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { fireEvent } from "@/lib/integrations";
import type { Meta } from "@/lib/types";

export function MetaModal({
  open,
  onClose,
  meta,
}: {
  open: boolean;
  onClose: () => void;
  meta?: Meta | null;
}) {
  const { equipes, userId, filial, refresh } = useData();
  const toast = useToast();
  const [saving, setSaving] = React.useState(false);
  const [tipo, setTipo] = React.useState<"equipe" | "funcionario">(meta?.funcionario_id ? "funcionario" : "equipe");
  const [funcs, setFuncs] = React.useState<{ id: string; nome: string; equipe: string | null }[]>([]);

  React.useEffect(() => {
    if (open) {
      createClient().from("funcionarios").select("id,nome,equipe").eq("ativo", true).order("nome")
        .then(({ data }) => setFuncs(data ?? []));
    }
  }, [open]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    const fd = new FormData(e.currentTarget);
    const mesInput = fd.get("mes") as string; // YYYY-MM
    const funcionarioId = tipo === "funcionario" ? (fd.get("funcionario_id") as string) : "";
    const equipe = tipo === "funcionario"
      ? (funcs.find((f) => f.id === funcionarioId)?.equipe ?? equipes[0] ?? "")
      : (fd.get("equipe") as string);
    const rec = {
      equipe,
      funcionario_id: funcionarioId || null,
      mes: mesInput + "-01",
      meta_receita: parseFloat(fd.get("meta_receita") as string) || 0,
      meta_qualidade: fd.get("meta_qualidade")
        ? parseInt(fd.get("meta_qualidade") as string, 10)
        : null,
    };
    const supabase = createClient();
    const { error } = meta
      ? await supabase.from("metas").update(rec).eq("id", meta.id)
      : await supabase.from("metas").insert([{ ...rec, filial: filial || "Matriz", created_by: userId }]);

    setSaving(false);
    if (error) {
      toast(
        error.code === "23505"
          ? "Já existe meta para esse alvo neste mês."
          : "Erro: " + error.message,
        "error",
      );
      return;
    }
    fireEvent(meta ? "meta.atualizada" : "meta.criada", { ...rec, id: meta?.id });
    await refresh();
    toast(meta ? "Meta atualizada." : "Meta criada.");
    onClose();
  }

  return (
    <Modal open={open} onClose={onClose} title={meta ? "Editar Meta" : "Nova Meta"} className="max-w-md">
      <form onSubmit={handleSubmit}>
        <ModalBody>
          <div>
            <Label>Tipo de meta *</Label>
            <Select value={tipo} onChange={(e) => setTipo(e.target.value as "equipe" | "funcionario")}>
              <option value="equipe">Por equipe</option>
              <option value="funcionario">Por funcionário</option>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            {tipo === "equipe" ? (
              <div>
                <Label>Equipe *</Label>
                <Select name="equipe" required defaultValue={meta?.equipe ?? ""}>
                  <option value="">Selecione</option>
                  {equipes.map((r) => <option key={r} value={r}>{r}</option>)}
                </Select>
              </div>
            ) : (
              <div>
                <Label>Funcionário *</Label>
                <Select name="funcionario_id" required defaultValue={meta?.funcionario_id ?? ""}>
                  <option value="">Selecione</option>
                  {funcs.map((f) => <option key={f.id} value={f.id}>{f.nome}</option>)}
                </Select>
              </div>
            )}
            <div>
              <Label>Mês *</Label>
              <Input type="month" name="mes" required defaultValue={meta?.mes?.substring(0, 7) ?? ""} />
            </div>
          </div>
          <div>
            <Label>Meta de Receita (R$) *</Label>
            <Input type="number" name="meta_receita" step="0.01" min="0" required defaultValue={meta?.meta_receita ?? ""} />
          </div>
          <div>
            <Label>Meta de Qualidade (0–100)</Label>
            <Input type="number" name="meta_qualidade" min="0" max="100" placeholder="opcional" defaultValue={meta?.meta_qualidade ?? ""} />
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
