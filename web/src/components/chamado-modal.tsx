"use client";

import * as React from "react";
import { createClient } from "@/lib/supabase/client";
import { useData } from "@/components/data-provider";
import { useToast } from "@/components/ui/toast";
import { Modal, ModalBody, ModalFooter } from "@/components/ui/modal";
import { Input, Select, Textarea, Label } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { todayISO, formatDate, formatCurrency } from "@/lib/utils";
import { ChamadoAtividade } from "@/components/chamado-atividade";
import { alertarChamadoCritico, fireEvent } from "@/lib/integrations";
import { garantirOperacaoDeChamado, FASES_COMERCIAL_APROVADO } from "@/lib/quadros";
import { Receipt, Wrench, Send, Upload, FileText, Trash2 } from "lucide-react";
import {
  PRIORIDADES_OPORTUNIDADE, ORIGENS_OPORTUNIDADE, FAIXAS_POTENCIAL,
  REGIOES_PIPELINE, EQUIPES_PIPELINE, STATUS_ANDAMENTO, TIPOS_DEMANDA, STATUS_PROPOSTA, MOTIVOS_RECUSA,
  FASE_OPORTUNIDADE, FASE_ORCAMENTO, FASE_PROPOSTA, FASE_APROVADA, FASE_RECUSADA, FASE_CONCLUIDO, codigoChamado,
} from "@/lib/types";
import type { Chamado } from "@/lib/types";

export function ChamadoModal({
  open,
  onClose,
  chamado,
}: {
  open: boolean;
  onClose: () => void;
  chamado?: Chamado | null;
  /** Mantido por compatibilidade; cards novos sempre nascem em "Oportunidade / Demanda". */
  faseInicial?: string;
}) {
  const { userId, filial, chamadoFases, clientes, refresh } = useData();
  const toast = useToast();
  const [saving, setSaving] = React.useState(false);
  const [gerando, setGerando] = React.useState(false);
  const [gerandoOp, setGerandoOp] = React.useState(false);
  const editando = !!chamado;

  // Todo card novo nasce como Oportunidade / Demanda. A fase é controlada para
  // liberar progressivamente os campos avançados (só a partir do orçamento).
  const [fase, setFase] = React.useState(chamado?.fase ?? FASE_OPORTUNIDADE);
  const avancado = fase !== FASE_OPORTUNIDADE;
  const emAndamento = fase === FASE_ORCAMENTO;
  const emProposta = fase === FASE_PROPOSTA;
  const emAprovada = fase === FASE_APROVADA;
  const emRecusada = fase === FASE_RECUSADA;

  // Desconto (fase Proposta Aprovada): se houver desconto, o motivo é obrigatório.
  const [valorDesconto, setValorDesconto] = React.useState<string>(chamado?.valor_desconto != null ? String(chamado.valor_desconto) : "");
  const temDesconto = (parseFloat(valorDesconto) || 0) > 0;

  // Anexo da proposta (fase Proposta Enviada). Persistido direto no card pelo uploader.
  const [propostaAnexo, setPropostaAnexo] = React.useState<string | null>(chamado?.proposta_anexo ?? null);

  // Datas automáticas da fase Proposta Enviada: data de envio = data da movimentação
  // (hoje), follow-up = +3 dias. Pré-preenchidas para o fluxo de mover pelo modal.
  const hojeISO = todayISO();
  const followUpISO = React.useMemo(() => {
    const d = new Date(); d.setDate(d.getDate() + 3); return d.toISOString().slice(0, 10);
  }, []);

  // Popup "Enviar para operação" (fase Em Andamento): escolhe o tipo de demanda.
  const [popOp, setPopOp] = React.useState(false);
  const [tipoDemanda, setTipoDemanda] = React.useState(chamado?.tipo_demanda ?? TIPOS_DEMANDA[0]);
  const [enviando, setEnviando] = React.useState(false);

  async function enviarParaOperacao() {
    if (!chamado) return;
    setEnviando(true);
    const supabase = createClient();
    const { error } = await supabase.from("chamados")
      .update({ tipo_demanda: tipoDemanda, status_andamento: "Enviada para operação" })
      .eq("id", chamado.id);
    if (error) { setEnviando(false); toast("Erro: " + error.message, "error"); return; }
    const r = await garantirOperacaoDeChamado({ ...chamado, tipo_demanda: tipoDemanda });
    setEnviando(false);
    setPopOp(false);
    await refresh();
    if (r === "sem-pipeline") { toast("Status salvo, mas o quadro 'Pipeline Operacional' não foi encontrado.", "error"); return; }
    toast(r === "criado" ? "Enviado para operação. Card criado no Pipeline Operacional." : "Enviado. Operação já existente.");
    onClose();
  }

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
    const fd = new FormData(e.currentTarget);
    // Obrigatórios da fase "Proposta Enviada": valor, anexo e data de envio.
    if (emProposta) {
      if ((parseFloat(fd.get("valor") as string) || 0) <= 0) { toast("Informe o Valor da proposta.", "error"); return; }
      if (!fd.get("data_envio_proposta")) { toast("Informe a Data de envio da proposta.", "error"); return; }
      if (!propostaAnexo) { toast("Anexe a proposta antes de salvar.", "error"); return; }
    }
    // Fase "Proposta Aprovada": motivo do desconto é obrigatório quando há desconto.
    if (emAprovada && temDesconto && !((fd.get("motivo_desconto") as string)?.trim())) {
      toast("Informe o Motivo do desconto.", "error"); return;
    }
    // Fase "Proposta Recusada": motivo da recusa é obrigatório.
    if (emRecusada && !((fd.get("motivo_perda") as string)?.trim())) {
      toast("Informe o Motivo da recusa.", "error"); return;
    }
    setSaving(true);
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
      // Em "Proposta Aprovada"/"Proposta Recusada" o card é concluído ao salvar os campos.
      fase: (emAprovada || emRecusada) ? FASE_CONCLUIDO : (fd.get("fase") as string),
      valor: parseFloat(fd.get("valor") as string) || 0,
      responsavel: (fd.get("responsavel") as string)?.trim() || null,
      equipe: (fd.get("equipe") as string)?.trim() || null,
      prazo: (fd.get("prazo") as string) || null,
      custo_real: fd.get("custo_real") ? parseFloat(fd.get("custo_real") as string) : null,
      // Status só é editável (e salvo) na fase Em Andamento; fora dela, preserva o valor atual.
      status_andamento: emAndamento ? ((fd.get("status_andamento") as string)?.trim() || null) : (chamado?.status_andamento ?? null),
      // Campos da fase Proposta Enviada — só editáveis nela; fora dela, preserva o atual.
      data_envio_proposta: emProposta ? ((fd.get("data_envio_proposta") as string) || null) : (chamado?.data_envio_proposta ?? null),
      responsavel_negociacao: emProposta ? ((fd.get("responsavel_negociacao") as string)?.trim() || null) : (chamado?.responsavel_negociacao ?? null),
      contato_cliente: emProposta ? ((fd.get("contato_cliente") as string)?.trim() || null) : (chamado?.contato_cliente ?? null),
      follow_up_em: emProposta ? ((fd.get("follow_up_em") as string) || null) : (chamado?.follow_up_em ?? null),
      previsao_decisao: emProposta ? ((fd.get("previsao_decisao") as string) || null) : (chamado?.previsao_decisao ?? null),
      status_proposta: emProposta ? ((fd.get("status_proposta") as string)?.trim() || null) : (chamado?.status_proposta ?? null),
      // Campos da fase Proposta Aprovada — só editáveis nela; fora dela, preserva o atual.
      valor_desconto: emAprovada ? (temDesconto ? (parseFloat(valorDesconto) || 0) : null) : (chamado?.valor_desconto ?? null),
      motivo_desconto: emAprovada ? (temDesconto ? ((fd.get("motivo_desconto") as string)?.trim() || null) : null) : (chamado?.motivo_desconto ?? null),
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
    toast(emAprovada ? "Proposta aprovada. Card concluído."
      : emRecusada ? "Proposta recusada. Card concluído."
      : ((editando ? "Chamado atualizado." : "Chamado criado.") + opMsg));
    onClose();
  }

  return (
    <>
    <Modal open={open} onClose={onClose} title={editando ? (codigoChamado(chamado?.numero) ?? "Editar Chamado") : "Nova Oportunidade / Demanda"} className="max-w-xl">
      <form onSubmit={handleSubmit}>
        <ModalBody>
          {editando && codigoChamado(chamado?.numero) && (
            <p className="text-[11px] text-muted font-mono mb-1">ID {codigoChamado(chamado?.numero)}</p>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
              <Select name="regiao" required defaultValue={chamado?.regiao ?? REGIOES_PIPELINE[0]}>
                {chamado?.regiao && !REGIOES_PIPELINE.includes(chamado.regiao as (typeof REGIOES_PIPELINE)[number]) && (
                  <option value={chamado.regiao}>{chamado.regiao}</option>
                )}
                {REGIOES_PIPELINE.map((r) => <option key={r} value={r}>{r}</option>)}
              </Select>
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
              <Select name="fase" required value={fase} onChange={(e) => setFase(e.target.value)}>
                {chamadoFases.map((f) => <option key={f.id} value={f.nome}>{f.nome}</option>)}
              </Select>
            </div>
            <div>
              <Label>Ticket (ref.)</Label>
              <Input name="ticket_ref" defaultValue={chamado?.ticket_ref ?? ""} />
            </div>

            {/* Fase "Em Andamento": sub-status do trabalho + envio à operação.
                O prazo de entrega (+3 dias) é definido automaticamente ao entrar nesta fase. */}
            {emAndamento && (
              <div className="col-span-2 rounded-lg border border-border bg-surface-2/40 p-3 space-y-3">
                <div>
                  <Label>Status (Em Andamento)</Label>
                  <Select name="status_andamento" defaultValue={chamado?.status_andamento ?? STATUS_ANDAMENTO[0]}>
                    {STATUS_ANDAMENTO.map((s) => <option key={s} value={s}>{s}</option>)}
                  </Select>
                </div>
                {editando ? (
                  <Button type="button" variant="outline" onClick={() => setPopOp(true)} className="w-full sm:w-auto">
                    <Send size={15} /> Enviar para operação
                  </Button>
                ) : (
                  <p className="text-[11px] text-muted">Salve o card para habilitar o envio à operação.</p>
                )}
              </div>
            )}

            {/* Fase "Proposta Enviada": dados da negociação. Valor (campo abaixo),
                anexo e data de envio são obrigatórios; follow-up (+3 dias) automático. */}
            {emProposta && (
              <div className="col-span-2 rounded-lg border border-border bg-surface-2/40 p-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="sm:col-span-2 text-xs font-semibold text-muted">Proposta Enviada</div>
                {editando && chamado?.fase_desde && (
                  <p className="sm:col-span-2 text-[11px] text-muted">
                    Movido para esta fase em <strong>{formatDate(chamado.fase_desde)}</strong> (registrado automaticamente).
                  </p>
                )}
                {editando ? (
                  <div className="sm:col-span-2">
                    <Label>Anexo da proposta *</Label>
                    <PropostaAnexo chamadoId={chamado!.id} value={propostaAnexo} onChange={setPropostaAnexo} />
                  </div>
                ) : (
                  <p className="sm:col-span-2 text-[11px] text-muted">Salve o card para anexar a proposta.</p>
                )}
                <div>
                  <Label>Data de envio *</Label>
                  <Input type="date" name="data_envio_proposta" defaultValue={chamado?.data_envio_proposta ?? hojeISO} />
                </div>
                <div>
                  <Label>Data de follow-up</Label>
                  <Input type="date" name="follow_up_em" defaultValue={chamado?.follow_up_em ?? followUpISO} />
                </div>
                <div>
                  <Label>Responsável pela negociação</Label>
                  <Input name="responsavel_negociacao" list="cha-clientes" defaultValue={chamado?.responsavel_negociacao ?? ""} />
                </div>
                <div>
                  <Label>Contato do cliente</Label>
                  <Input name="contato_cliente" placeholder="Telefone / e-mail (opcional)" defaultValue={chamado?.contato_cliente ?? ""} />
                </div>
                <div>
                  <Label>Previsão de decisão do cliente</Label>
                  <Input type="date" name="previsao_decisao" defaultValue={chamado?.previsao_decisao ?? ""} />
                </div>
                <div>
                  <Label>Status da proposta</Label>
                  <Select name="status_proposta" defaultValue={chamado?.status_proposta ?? STATUS_PROPOSTA[0]}>
                    {STATUS_PROPOSTA.map((s) => <option key={s} value={s}>{s}</option>)}
                  </Select>
                </div>
                <p className="sm:col-span-2 text-[11px] text-muted">
                  O <strong>Valor da proposta</strong> (campo abaixo) é obrigatório nesta fase. Data de envio e follow-up são preenchidos automaticamente ao entrar na fase.
                </p>
              </div>
            )}

            {/* Fase "Proposta Aprovada": valor automático + desconto opcional.
                Ao salvar, o card é concluído. */}
            {emAprovada && (
              <div className="col-span-2 rounded-lg border border-border bg-surface-2/40 p-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="sm:col-span-2 text-xs font-semibold text-muted">Proposta Aprovada</div>
                <div className="sm:col-span-2 flex items-center justify-between rounded-lg border border-border bg-surface px-3 py-2">
                  <span className="text-sm text-muted">Valor da proposta (automático)</span>
                  <span className="text-sm font-semibold tabular-nums">{formatCurrency(chamado?.valor ?? 0)}</span>
                </div>
                <div>
                  <Label>Valor do desconto (R$)</Label>
                  <Input type="number" step="0.01" min="0" value={valorDesconto} onChange={(e) => setValorDesconto(e.target.value)} placeholder="0,00 (se houver)" />
                </div>
                {temDesconto && (
                  <div>
                    <Label>Motivo do desconto *</Label>
                    <Input name="motivo_desconto" defaultValue={chamado?.motivo_desconto ?? ""} placeholder="Obrigatório quando há desconto" />
                  </div>
                )}
                <p className="sm:col-span-2 text-[11px] text-muted">
                  Ao <strong>Salvar</strong>, o card é concluído automaticamente (vai para “Concluido”).
                </p>
              </div>
            )}

            {/* Fase "Proposta Recusada": valor replicado + motivo da recusa obrigatório.
                Ao salvar, o card é concluído. */}
            {emRecusada && (
              <div className="col-span-2 rounded-lg border border-border bg-surface-2/40 p-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="sm:col-span-2 text-xs font-semibold text-muted">Proposta Recusada</div>
                <div className="sm:col-span-2 flex items-center justify-between rounded-lg border border-border bg-surface px-3 py-2">
                  <span className="text-sm text-muted">Valor da proposta (automático)</span>
                  <span className="text-sm font-semibold tabular-nums">{formatCurrency(chamado?.valor ?? 0)}</span>
                </div>
                <div className="sm:col-span-2">
                  <Label>Motivo da recusa *</Label>
                  <Select name="motivo_perda" defaultValue={chamado?.motivo_perda ?? ""}>
                    <option value="">—</option>
                    {MOTIVOS_RECUSA.map((m) => <option key={m} value={m}>{m}</option>)}
                  </Select>
                </div>
                <p className="sm:col-span-2 text-[11px] text-muted">
                  Ao <strong>Salvar</strong>, o card é concluído automaticamente (vai para “Concluido”).
                </p>
              </div>
            )}

            {/* Campos avançados: só liberam a partir do orçamento. Ficam montados
                (display:none) enquanto bloqueados para não perder valores ao salvar. */}
            {!avancado && (
              <p className="col-span-2 text-[11px] text-muted rounded-lg border border-dashed border-border bg-surface-2/40 p-2.5">
                Os campos de orçamento (valor, custo, equipe, prazo, faturamento…) são liberados ao mover o card para <strong>“Em Orçamento/Em Andamento”</strong>.
              </p>
            )}
            <div className={avancado ? "contents" : "hidden"}>
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
                <Select name="equipe" defaultValue={chamado?.equipe ?? EQUIPES_PIPELINE[0]}>
                  {chamado?.equipe && !EQUIPES_PIPELINE.includes(chamado.equipe as (typeof EQUIPES_PIPELINE)[number]) && (
                    <option value={chamado.equipe}>{chamado.equipe}</option>
                  )}
                  {EQUIPES_PIPELINE.map((eq) => <option key={eq} value={eq}>{eq}</option>)}
                </Select>
              </div>
              <div>
                <Label>Prazo / vencimento</Label>
                <Input type="date" name="prazo" defaultValue={chamado?.prazo ?? ""} />
              </div>
              <div>
                <Label>Status faturamento</Label>
                <Input name="status_faturamento" defaultValue={chamado?.status_faturamento ?? ""} />
              </div>
              {!emRecusada && (
                <div className="col-span-2">
                  <Label>Motivo da perda (se recusado)</Label>
                  <Input name="motivo_perda" defaultValue={chamado?.motivo_perda ?? ""} />
                </div>
              )}
              <div className="col-span-2">
                <Label>Descrição</Label>
                <Textarea name="descricao" defaultValue={chamado?.descricao ?? ""} />
              </div>
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

    {/* Popup "Enviar para operação": escolhe o Tipo de demanda e dispara o envio. */}
    <Modal open={popOp} onClose={() => setPopOp(false)} title="Enviar para operação" className="max-w-sm">
      <ModalBody>
        <Label>Tipo de demanda</Label>
        <Select value={tipoDemanda} onChange={(e) => setTipoDemanda(e.target.value)}>
          {TIPOS_DEMANDA.map((t) => <option key={t} value={t}>{t}</option>)}
        </Select>
        <p className="text-[11px] text-muted mt-2">
          Cria/garante o card no <strong>Pipeline Operacional</strong> e marca o status como “Enviada para operação”.
        </p>
      </ModalBody>
      <ModalFooter>
        <Button type="button" variant="secondary" onClick={() => setPopOp(false)}>Cancelar</Button>
        <Button type="button" onClick={enviarParaOperacao} disabled={enviando}>{enviando ? "Enviando..." : "ENVIAR"}</Button>
      </ModalFooter>
    </Modal>
    </>
  );
}

/** Upload/visualização do anexo obrigatório da proposta (bucket ordens-anexos). */
const BUCKET_ANEXOS = "ordens-anexos";
function PropostaAnexo({ chamadoId, value, onChange }: { chamadoId: string; value: string | null; onChange: (p: string | null) => void }) {
  const toast = useToast();
  const supabase = React.useMemo(() => createClient(), []);
  const [busy, setBusy] = React.useState(false);
  const [url, setUrl] = React.useState<string | null>(null);

  React.useEffect(() => {
    let active = true;
    if (!value) { setUrl(null); return; }
    supabase.storage.from(BUCKET_ANEXOS).createSignedUrl(value, 3600).then(({ data }) => { if (active) setUrl(data?.signedUrl ?? null); });
    return () => { active = false; };
  }, [value, supabase]);

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setBusy(true);
    const ext = file.name.split(".").pop() || "bin";
    const path = `chamados/${chamadoId}/proposta-${crypto.randomUUID()}.${ext}`;
    const up = await supabase.storage.from(BUCKET_ANEXOS).upload(path, file, { upsert: false });
    if (up.error) { setBusy(false); toast("Erro no upload: " + up.error.message, "error"); return; }
    const { error } = await supabase.from("chamados").update({ proposta_anexo: path }).eq("id", chamadoId);
    setBusy(false);
    if (error) { toast("Erro: " + error.message, "error"); return; }
    onChange(path);
    toast("Proposta anexada.");
  }

  async function remover() {
    if (!value) return;
    await supabase.storage.from(BUCKET_ANEXOS).remove([value]);
    await supabase.from("chamados").update({ proposta_anexo: null }).eq("id", chamadoId);
    onChange(null);
    toast("Anexo removido.");
  }

  if (value) {
    return (
      <div className="flex items-center gap-2">
        <a href={url ?? "#"} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm text-primary font-medium">
          <FileText size={15} /> Ver proposta anexada
        </a>
        <button type="button" onClick={remover} className="text-muted hover:text-red cursor-pointer" title="Remover"><Trash2 size={14} /></button>
      </div>
    );
  }
  return (
    <label className="inline-flex items-center gap-2 h-9 px-3 rounded-lg border border-border text-sm cursor-pointer hover:bg-surface-2 transition-colors">
      <Upload size={15} /> {busy ? "Enviando..." : "Anexar proposta"}
      <input type="file" accept="image/*,application/pdf" className="hidden" onChange={onPick} disabled={busy} />
    </label>
  );
}
