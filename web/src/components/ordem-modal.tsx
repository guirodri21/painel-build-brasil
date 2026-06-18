"use client";

import * as React from "react";
import { createClient } from "@/lib/supabase/client";
import { useData } from "@/components/data-provider";
import { useToast } from "@/components/ui/toast";
import { Modal, ModalBody, ModalFooter } from "@/components/ui/modal";
import { Input, Select, Textarea, Label } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { todayISO } from "@/lib/utils";
import { fireEvent } from "@/lib/integrations";
import type { Ordem } from "@/lib/types";

export function OrdemModal({
  open,
  onClose,
  ordem,
}: {
  open: boolean;
  onClose: () => void;
  ordem?: Ordem | null;
}) {
  const { regioes, equipes, linhas, userId, refresh } = useData();
  const toast = useToast();
  const [saving, setSaving] = React.useState(false);
  const formRef = React.useRef<HTMLFormElement>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    const fd = new FormData(e.currentTarget);
    const rec = {
      data: fd.get("data") as string,
      regiao: fd.get("regiao") as string,
      equipe: fd.get("equipe") as string,
      linha_servico: fd.get("linha_servico") as string,
      cliente: (fd.get("cliente") as string) || null,
      valor_venda: parseFloat(fd.get("valor_venda") as string) || 0,
      despesa_direta: parseFloat(fd.get("despesa_direta") as string) || 0,
      status: fd.get("status") as string,
      tempo_execucao_h: fd.get("tempo_execucao_h")
        ? parseFloat(fd.get("tempo_execucao_h") as string)
        : null,
      qualidade: fd.get("qualidade")
        ? parseInt(fd.get("qualidade") as string, 10)
        : null,
      resumo: (fd.get("resumo") as string) || null,
    };

    const supabase = createClient();
    const { error } = ordem
      ? await supabase.from("ordens").update(rec).eq("id", ordem.id)
      : await supabase.from("ordens").insert([{ ...rec, created_by: userId }]);

    setSaving(false);
    if (error) {
      toast("Erro: " + error.message, "error");
      return;
    }
    fireEvent(ordem ? "ordem.atualizada" : "ordem.criada", { ...rec, id: ordem?.id });
    await refresh();
    toast(ordem ? "Ordem atualizada." : "Ordem criada.");
    onClose();
  }

  return (
    <Modal open={open} onClose={onClose} title={ordem ? "Editar Ordem" : "Nova Ordem"}>
      <form ref={formRef} onSubmit={handleSubmit}>
        <ModalBody>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Data *</Label>
              <Input type="date" name="data" required defaultValue={ordem?.data ?? todayISO()} />
            </div>
            <div>
              <Label>Status *</Label>
              <Select name="status" required defaultValue={ordem?.status ?? ""}>
                <option value="">Selecione</option>
                <option value="em_andamento">Em andamento</option>
                <option value="execucao_parcial">Execução parcial</option>
                <option value="concluido">Concluído</option>
              </Select>
            </div>
            <div>
              <Label>Região *</Label>
              <Select name="regiao" required defaultValue={ordem?.regiao ?? ""}>
                <option value="">Selecione</option>
                {regioes.map((r) => <option key={r} value={r}>{r}</option>)}
              </Select>
            </div>
            <div>
              <Label>Equipe *</Label>
              <Select name="equipe" required defaultValue={ordem?.equipe ?? ""}>
                <option value="">Selecione</option>
                {equipes.map((r) => <option key={r} value={r}>{r}</option>)}
              </Select>
            </div>
          </div>
          <div>
            <Label>Linha de Serviço *</Label>
            <Select name="linha_servico" required defaultValue={ordem?.linha_servico ?? ""}>
              <option value="">Selecione</option>
              {linhas.map((r) => <option key={r} value={r}>{r}</option>)}
            </Select>
          </div>
          <div>
            <Label>Cliente</Label>
            <Input type="text" name="cliente" placeholder="(opcional)" defaultValue={ordem?.cliente ?? ""} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Valor Venda (R$) *</Label>
              <Input type="number" name="valor_venda" step="0.01" min="0" required defaultValue={ordem?.valor_venda ?? ""} />
            </div>
            <div>
              <Label>Despesa Direta (R$) *</Label>
              <Input type="number" name="despesa_direta" step="0.01" min="0" required defaultValue={ordem?.despesa_direta ?? ""} />
            </div>
            <div>
              <Label>Tempo Exec. (h)</Label>
              <Input type="number" name="tempo_execucao_h" step="0.5" min="0" placeholder="se concluído" defaultValue={ordem?.tempo_execucao_h ?? ""} />
            </div>
            <div>
              <Label>Qualidade (0–100)</Label>
              <Input type="number" name="qualidade" min="0" max="100" placeholder="se avaliado" defaultValue={ordem?.qualidade ?? ""} />
            </div>
          </div>
          <div>
            <Label>Resumo</Label>
            <Textarea name="resumo" placeholder="Descrição breve" defaultValue={ordem?.resumo ?? ""} />
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
