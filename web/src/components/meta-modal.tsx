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
  const { equipes, userId, refresh } = useData();
  const toast = useToast();
  const [saving, setSaving] = React.useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    const fd = new FormData(e.currentTarget);
    const mesInput = fd.get("mes") as string; // YYYY-MM
    const rec = {
      equipe: fd.get("equipe") as string,
      mes: mesInput + "-01",
      meta_receita: parseFloat(fd.get("meta_receita") as string) || 0,
      meta_qualidade: fd.get("meta_qualidade")
        ? parseInt(fd.get("meta_qualidade") as string, 10)
        : null,
    };
    const supabase = createClient();
    const { error } = meta
      ? await supabase.from("metas").update(rec).eq("id", meta.id)
      : await supabase.from("metas").insert([{ ...rec, created_by: userId }]);

    setSaving(false);
    if (error) {
      toast(
        error.code === "23505"
          ? "Já existe meta para essa equipe neste mês."
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
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Equipe *</Label>
              <Select name="equipe" required defaultValue={meta?.equipe ?? ""}>
                <option value="">Selecione</option>
                {equipes.map((r) => <option key={r} value={r}>{r}</option>)}
              </Select>
            </div>
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
