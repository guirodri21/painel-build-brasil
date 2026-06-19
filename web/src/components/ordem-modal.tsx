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
import { OrdemMateriais } from "@/components/ordem-materiais";
import { OrdemAnexos } from "@/components/ordem-anexos";
import { OrdemChecklist } from "@/components/ordem-checklist";
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
  const { regioes, equipes, linhas, clientes, userId, filial, refresh } = useData();
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
      data_agendada: (fd.get("data_agendada") as string) || null,
      hora_agendada: (fd.get("hora_agendada") as string) || null,
    };

    const supabase = createClient();
    const { error } = ordem
      ? await supabase.from("ordens").update(rec).eq("id", ordem.id)
      : await supabase.from("ordens").insert([{ ...rec, filial: filial || "Matriz", created_by: userId }]);

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
            <Input type="text" name="cliente" list="clientes-list" placeholder="(opcional)" defaultValue={ordem?.cliente ?? ""} />
            <datalist id="clientes-list">
              {clientes.map((c) => <option key={c} value={c} />)}
            </datalist>
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
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Data agendada</Label>
              <Input type="date" name="data_agendada" defaultValue={ordem?.data_agendada ?? ""} />
            </div>
            <div>
              <Label>Hora agendada</Label>
              <Input type="time" name="hora_agendada" defaultValue={ordem?.hora_agendada?.slice(0, 5) ?? ""} />
            </div>
          </div>
          <div>
            <Label>Resumo</Label>
            <Textarea name="resumo" placeholder="Descrição breve" defaultValue={ordem?.resumo ?? ""} />
          </div>

          {ordem ? (
            <>
              <OrdemChecklist ordemId={ordem.id} linhaServico={ordem.linha_servico} filial={ordem.filial ?? null} />
              <OrdemMateriais ordemId={ordem.id} filial={ordem.filial ?? null} />
              <OrdemAnexos ordemId={ordem.id} filial={ordem.filial ?? null} />
            </>
          ) : (
            <p className="text-xs text-muted italic">
              Salve a ordem para lançar materiais consumidos e anexar fotos.
            </p>
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
