"use client";

import * as React from "react";
import { createClient } from "@/lib/supabase/client";
import { useData } from "@/components/data-provider";
import { useToast } from "@/components/ui/toast";
import { ConfirmDialog } from "@/components/ui/confirm";
import { Modal, ModalBody, ModalFooter } from "@/components/ui/modal";
import { Input, Select, Textarea, Label } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { runAutomacoes, runBotao, botoesDeAcao, validarObrigatorios } from "@/lib/quadros";
import { cn } from "@/lib/utils";
import { Trash2, Zap } from "lucide-react";
import type { Quadro, QuadroFase, QuadroCampo, QuadroCard, QuadroAutomacao } from "@/lib/types";

/** Renderiza o input certo para um campo personalizado. */
function CampoInput({ campo, value, onChange }: { campo: QuadroCampo; value: unknown; onChange: (v: unknown) => void }) {
  switch (campo.tipo) {
    case "texto_longo":
      return <Textarea value={(value as string) ?? ""} onChange={(e) => onChange(e.target.value)} />;
    case "numero":
    case "moeda":
      return <Input type="number" step={campo.tipo === "moeda" ? "0.01" : "1"} value={(value as number) ?? ""} onChange={(e) => onChange(e.target.value === "" ? "" : Number(e.target.value))} />;
    case "data":
      return <Input type="date" value={(value as string) ?? ""} onChange={(e) => onChange(e.target.value)} />;
    case "checkbox":
      return (
        <label className="inline-flex items-center gap-2 text-sm cursor-pointer">
          <input type="checkbox" checked={!!value} onChange={(e) => onChange(e.target.checked)} className="h-4 w-4 rounded border-border" />
          <span className="text-muted">{value ? "Sim" : "Não"}</span>
        </label>
      );
    case "selecao":
      return (
        <Select value={(value as string) ?? ""} onChange={(e) => onChange(e.target.value)}>
          <option value="">—</option>
          {campo.opcoes.map((o) => <option key={o} value={o}>{o}</option>)}
        </Select>
      );
    default:
      return <Input value={(value as string) ?? ""} onChange={(e) => onChange(e.target.value)} />;
  }
}

export function QuadroCardModal({
  open, onClose, quadro, fases, campos, automacoes, card, faseInicial, onSaved,
}: {
  open: boolean;
  onClose: () => void;
  quadro: Quadro;
  fases: QuadroFase[];
  campos: QuadroCampo[];
  automacoes: QuadroAutomacao[];
  card?: QuadroCard | null;
  faseInicial?: string;
  onSaved: () => void | Promise<void>;
}) {
  const { userId, filial, clientes } = useData();
  const toast = useToast();
  const editando = !!card;
  const [confirmDel, setConfirmDel] = React.useState(false);

  const [titulo, setTitulo] = React.useState(card?.titulo ?? "");
  const [fase, setFase] = React.useState(card?.fase ?? faseInicial ?? fases[0]?.nome ?? "");
  const [responsavel, setResponsavel] = React.useState(card?.responsavel ?? "");
  const [valor, setValor] = React.useState<string>(card?.valor ? String(card.valor) : "");
  const [prioridade, setPrioridade] = React.useState(card?.prioridade ?? "");
  const [prazo, setPrazo] = React.useState(card?.prazo ?? "");
  const [valores, setValores] = React.useState<Record<string, unknown>>(card?.valores ?? {});
  const [saving, setSaving] = React.useState(false);

  function setCampo(chave: string, v: unknown) {
    setValores((prev) => ({ ...prev, [chave]: v }));
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    const erro = validarObrigatorios(campos, valores, titulo);
    if (erro) { toast(erro, "error"); return; }
    setSaving(true);

    const rec = {
      titulo: titulo.trim() || null,
      fase,
      responsavel: responsavel.trim() || null,
      valor: parseFloat(valor) || 0,
      prioridade: prioridade || null,
      prazo: prazo || null,
      valores,
    };
    const supabase = createClient();
    let savedCard: QuadroCard | null = null;

    if (editando) {
      const { error } = await supabase.from("quadro_cards").update(rec).eq("id", card!.id);
      if (error) { setSaving(false); toast("Erro: " + error.message, "error"); return; }
      savedCard = { ...card!, ...rec } as QuadroCard;
    } else {
      const { data, error } = await supabase.from("quadro_cards")
        .insert([{ ...rec, quadro_id: quadro.id, filial: filial || "Matriz", origem: "manual", created_by: userId }])
        .select("*").single();
      if (error || !data) { setSaving(false); toast("Erro: " + (error?.message ?? ""), "error"); return; }
      savedCard = data as QuadroCard;
    }

    // Dispara automações: na criação (card_criado) ou quando a fase mudou (card_movido).
    const gatilho = !editando ? "card_criado" : card!.fase !== fase ? "card_movido" : null;
    const feitos = savedCard && gatilho
      ? await runAutomacoes(quadro.id, quadro.nome, automacoes, savedCard, gatilho)
      : [];
    setSaving(false);
    await onSaved();
    toast(feitos.length ? `Salvo. Automações: ${feitos.join(", ")}` : editando ? "Card atualizado." : "Card criado.");
    onClose();
  }

  const botoes = React.useMemo(() => botoesDeAcao(automacoes), [automacoes]);

  async function clicarBotao(a: QuadroAutomacao) {
    if (!card) return;
    setSaving(true);
    const feitos = await runBotao(quadro.id, quadro.nome, a, card);
    setSaving(false);
    await onSaved();
    toast(feitos.length ? `Feito: ${feitos.join(", ")}` : "Ação executada.");
    onClose();
  }

  async function excluir() {
    if (!card) return;
    setConfirmDel(false);
    const { error } = await createClient().from("quadro_cards").delete().eq("id", card.id);
    if (error) { toast("Erro: " + error.message, "error"); return; }
    await onSaved();
    toast("Card excluído.");
    onClose();
  }

  return (
    <>
    <Modal open={open} onClose={onClose} title={editando ? "Editar card" : "Novo card"} className="max-w-xl">
      <form onSubmit={salvar}>
        <ModalBody>
          <div>
            <Label>Título *</Label>
            <Input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Título do card" autoFocus />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Fase *</Label>
              <Select value={fase} onChange={(e) => setFase(e.target.value)} required>
                {fases.map((f) => <option key={f.id} value={f.nome}>{f.nome}</option>)}
              </Select>
            </div>
            <div>
              <Label>Prioridade</Label>
              <Select value={prioridade} onChange={(e) => setPrioridade(e.target.value)}>
                <option value="">—</option>
                <option value="Alta">Alta</option>
                <option value="Média">Média</option>
                <option value="Baixa">Baixa</option>
              </Select>
            </div>
            <div>
              <Label>Responsável</Label>
              <Input value={responsavel} onChange={(e) => setResponsavel(e.target.value)} list="quadro-clientes" />
              <datalist id="quadro-clientes">{clientes.map((c) => <option key={c} value={c} />)}</datalist>
            </div>
            <div>
              <Label>Valor (R$)</Label>
              <Input type="number" step="0.01" min="0" value={valor} onChange={(e) => setValor(e.target.value)} />
            </div>
            <div>
              <Label>Prazo</Label>
              <Input type="date" value={prazo} onChange={(e) => setPrazo(e.target.value)} />
            </div>
          </div>

          {campos.length > 0 && (
            <div className="border-t border-border pt-4 space-y-4">
              {campos.map((campo) => (
                <div key={campo.id}>
                  <Label>{campo.label}{campo.obrigatorio && " *"}</Label>
                  <CampoInput campo={campo} value={valores[campo.chave]} onChange={(v) => setCampo(campo.chave, v)} />
                </div>
              ))}
            </div>
          )}
          {/* Vínculo de origem (card criado por botão de outro quadro) */}
          {typeof card?.valores?.card_origem === "string" && (
            <p className="text-[11px] text-muted border-t border-border pt-3">
              Vinculado a: <span className="font-medium text-foreground">{card.valores.card_origem as string}</span>
            </p>
          )}

          {/* Botões de ação (gatilho manual) */}
          {editando && botoes.length > 0 && (
            <div className="border-t border-border pt-4">
              <Label>Ações</Label>
              <div className="flex flex-wrap gap-2">
                {botoes.map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    disabled={saving}
                    onClick={() => clicarBotao(a)}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer disabled:opacity-50",
                      "border-border text-foreground hover:border-primary hover:text-primary hover:bg-primary-soft",
                    )}
                    title={a.nome}
                  >
                    <Zap size={13} />
                    {a.config.label ?? a.nome}
                  </button>
                ))}
              </div>
            </div>
          )}

          {card?.origem === "formulario" && <p className="text-[11px] text-muted">Criado via formulário público.</p>}
        </ModalBody>
        <ModalFooter>
          {editando && (
            <Button type="button" variant="ghost" onClick={() => setConfirmDel(true)} className="mr-auto text-red hover:text-red">
              <Trash2 size={15} /> Excluir
            </Button>
          )}
          <Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button type="submit" disabled={saving}>{saving ? "Salvando..." : "Salvar"}</Button>
        </ModalFooter>
      </form>
    </Modal>
    <ConfirmDialog
      open={confirmDel}
      title="Excluir card?"
      message="Esta ação não pode ser desfeita."
      confirmLabel="Excluir"
      onConfirm={excluir}
      onCancel={() => setConfirmDel(false)}
    />
    </>
  );
}
