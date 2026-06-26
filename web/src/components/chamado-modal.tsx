"use client";

import * as React from "react";
import { createClient } from "@/lib/supabase/client";
import { useData } from "@/components/data-provider";
import { useToast } from "@/components/ui/toast";
import { Modal, ModalBody, ModalFooter } from "@/components/ui/modal";
import { Input, Select, Textarea, Label } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { todayISO } from "@/lib/utils";
import { ChamadoAtividade } from "@/components/chamado-atividade";
import { alertarChamadoCritico, fireEvent } from "@/lib/integrations";
import { garantirOperacaoDeChamado, FASES_COMERCIAL_APROVADO } from "@/lib/quadros";
import { Receipt, Wrench } from "lucide-react";
import {
  PRIORIDADES_OPORTUNIDADE, ORIGENS_OPORTUNIDADE, FAIXAS_POTENCIAL, codigoChamado,
} from "@/lib/types";
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
  const [gerando, setGerando] = React.useState(false);
  const [gerandoOp, setGerandoOp] = React.useState(false);
  const editando = !!chamado;

  async function gerarOperacao() {
    if (!chamado) return;
    setGerandoOp(true);
    const r = await garantirOperacaoDeChamado(chamado);
    setGerandoOp(false);
    if (r === "sem-pipeline") { toast("Quadro 'Pipeline Operacional' não encontrado.", "error"); return; }
    toast(r === "criado" ? "Operação gerada no Pipeline Operacional." : "Já existe uma Operação para este chamado.");
  }

  async function gerarConta() {
    if (!chamado) return;
    setGerando(true);
    const { error } = await createClient().from("contas").insert([{
      tipo: "receber",
      descricao: `Chamado ${chamado.ticket_ref ?? ""} — ${chamado.cliente ?? chamado.titulo ?? ""}`.trim(),
      categoria: "Chamado",
      valor: chamado.valor || 0,
      vencimento: chamado.prazo ?? todayISO(),
      cliente: chamado.cliente,
      filial: filial || "Matriz",
      created_by: userId,
    }]);
    setGerando(false);
    if (error) { toast("Erro: " + error.message, "error"); return; }
    await refresh();
    toast("Conta a receber gerada em Contas.");
  }

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
      centro_custo: (fd.get("centro_custo") as string)?.trim() || null,
      origem_oportunidade: (fd.get("origem_oportunidade") as string) || null,
      faixa_potencial: (fd.get("faixa_potencial") as string) || null,
      ticket_ref: (fd.get("ticket_ref") as string)?.trim() || null,
      fase: fd.get("fase") as string,
      valor: parseFloat(fd.get("valor") as string) || 0,
      responsavel: (fd.get("responsavel") as string)?.trim() || null,
      equipe: (fd.get("equipe") as string)?.trim() || null,
      prazo: (fd.get("prazo") as string) || null,
      custo_real: fd.get("custo_real") ? parseFloat(fd.get("custo_real") as string) : null,
      status_faturamento: (fd.get("status_faturamento") as string)?.trim() || null,
      motivo_perda: (fd.get("motivo_perda") as string)?.trim() || null,
    };
    const supabase = createClient();
    let salvo: Chamado | null = null;
    let error;
    if (editando) {
      ({ error } = await supabase.from("chamados").update(rec).eq("id", chamado!.id));
      salvo = { ...chamado!, ...rec } as Chamado;
    } else {
      const res = await supabase.from("chamados")
        .insert([{ ...rec, filial: filial || "Matriz", created_by: userId }])
        .select("*").single();
      error = res.error;
      salvo = (res.data as Chamado) ?? null;
    }

    setSaving(false);
    if (error) { toast("Erro: " + error.message, "error"); return; }
    alertarChamadoCritico({ ...rec, ticket_ref: rec.ticket_ref ?? null }, chamado?.fase);
    // Ponte para o Goalfy (webhooks de saída inscritos no evento)
    fireEvent(editando ? "chamado.atualizado" : "chamado.criado", { ...rec, id: chamado?.id, goalfy_card_id: chamado?.goalfy_card_id });

    // Vínculo COM→OP: ao salvar numa fase aprovada, garante o card de Operação.
    let opMsg = "";
    if (salvo && FASES_COMERCIAL_APROVADO.includes(rec.fase)) {
      const r = await garantirOperacaoDeChamado(salvo);
      if (r === "criado") opMsg = " Operação gerada.";
    }
    await refresh();
    toast((editando ? "Chamado atualizado." : "Chamado criado.") + opMsg);
    onClose();
  }

  return (
    <Modal open={open} onClose={onClose} title={editando ? (codigoChamado(chamado?.numero) ?? "Editar Chamado") : "Nova Oportunidade / Demanda"} className="max-w-xl">
      <form onSubmit={handleSubmit}>
        <ModalBody>
          {editando && codigoChamado(chamado?.numero) && (
            <p className="text-[11px] text-muted font-mono mb-1">ID {codigoChamado(chamado?.numero)}</p>
          )}
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <Label>Título / demanda</Label>
              <Input name="titulo" defaultValue={chamado?.titulo ?? ""} placeholder="Ex.: Chamado" />
            </div>
            <div>
              <Label>Cliente *</Label>
              <Input name="cliente" list="cha-clientes" required defaultValue={chamado?.cliente ?? ""} />
              <datalist id="cha-clientes">{clientes.map((c) => <option key={c} value={c} />)}</datalist>
            </div>
            <div>
              <Label>Região *</Label>
              <Input name="regiao" required defaultValue={chamado?.regiao ?? ""} />
            </div>
            <div>
              <Label>Centro de custo *</Label>
              <Input name="centro_custo" required defaultValue={chamado?.centro_custo ?? ""} />
            </div>
            <div>
              <Label>Responsável pela oportunidade *</Label>
              <Input name="responsavel" required defaultValue={chamado?.responsavel ?? ""} />
            </div>
            <div>
              <Label>Prioridade</Label>
              <Select name="prioridade" defaultValue={chamado?.prioridade ?? ""}>
                <option value="">—</option>
                {PRIORIDADES_OPORTUNIDADE.map((p) => <option key={p} value={p}>{p}</option>)}
              </Select>
            </div>
            <div>
              <Label>Origem da oportunidade</Label>
              <Select name="origem_oportunidade" defaultValue={chamado?.origem_oportunidade ?? ""}>
                <option value="">—</option>
                {ORIGENS_OPORTUNIDADE.map((o) => <option key={o} value={o}>{o}</option>)}
              </Select>
            </div>
            <div className="col-span-2">
              <Label>Faixa de potencial *</Label>
              <Select name="faixa_potencial" required defaultValue={chamado?.faixa_potencial ?? ""}>
                <option value="">—</option>
                {FAIXAS_POTENCIAL.map((f) => <option key={f.tier} value={f.tier}>{f.label}</option>)}
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
              <Label>Valor proposta (R$)</Label>
              <Input type="number" name="valor" step="0.01" min="0" defaultValue={chamado?.valor || ""} />
            </div>
            <div>
              <Label>Custo real (R$)</Label>
              <Input type="number" name="custo_real" step="0.01" min="0" defaultValue={chamado?.custo_real ?? ""} />
            </div>
            <div>
              <Label>Equipe</Label>
              <Input name="equipe" defaultValue={chamado?.equipe ?? ""} />
            </div>
            <div>
              <Label>Prazo / vencimento</Label>
              <Input type="date" name="prazo" defaultValue={chamado?.prazo ?? ""} />
            </div>
            <div>
              <Label>Status faturamento</Label>
              <Input name="status_faturamento" defaultValue={chamado?.status_faturamento ?? ""} />
            </div>
            <div className="col-span-2">
              <Label>Motivo da perda (se recusado)</Label>
              <Input name="motivo_perda" defaultValue={chamado?.motivo_perda ?? ""} />
            </div>
            <div className="col-span-2">
              <Label>Descrição</Label>
              <Textarea name="descricao" defaultValue={chamado?.descricao ?? ""} />
            </div>
          </div>
          {chamado?.goalfy_card_id && (
            <p className="text-[11px] text-muted">Sincronizado do Goalfy (card {chamado.goalfy_card_id}).</p>
          )}
          {editando && <ChamadoAtividade chamadoId={chamado!.id} />}
        </ModalBody>
        <ModalFooter>
          {editando && (
            <>
              <Button type="button" variant="outline" onClick={gerarConta} disabled={gerando} className="mr-auto">
                <Receipt size={15} /> {gerando ? "Gerando..." : "Gerar conta a receber"}
              </Button>
              <Button type="button" variant="outline" onClick={gerarOperacao} disabled={gerandoOp}>
                <Wrench size={15} /> {gerandoOp ? "Gerando..." : "Gerar Operação"}
              </Button>
            </>
          )}
          <Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button type="submit" disabled={saving}>{saving ? "Salvando..." : "Salvar"}</Button>
        </ModalFooter>
      </form>
    </Modal>
  );
}
