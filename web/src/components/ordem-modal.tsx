"use client";

import * as React from "react";
import { createClient } from "@/lib/supabase/client";
import { useData } from "@/components/data-provider";
import { useToast } from "@/components/ui/toast";
import { Modal, ModalBody, ModalFooter, AtalhoSalvar } from "@/components/ui/modal";
import { Input, Select, Textarea, Label } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { cn, formatCurrency, todayISO } from "@/lib/utils";
import { fireEvent } from "@/lib/integrations";
import { OrdemMateriais } from "@/components/ordem-materiais";
import { OrdemAnexos } from "@/components/ordem-anexos";
import { OrdemChecklist } from "@/components/ordem-checklist";
import type { Ordem } from "@/lib/types";

/** Última região/equipe usadas numa ordem nova (poupa cliques na próxima). */
const ULTIMA_KEY = "bb-ordem-ultima";

const STATUS: { value: string; label: string; tone: string }[] = [
  { value: "em_andamento", label: "Em andamento", tone: "border-primary text-primary bg-primary-soft" },
  { value: "execucao_parcial", label: "Parcial", tone: "border-yellow text-yellow bg-yellow-soft" },
  { value: "concluido", label: "Concluído", tone: "border-green text-green bg-green-soft" },
];

type Aba = "dados" | "checklist" | "materiais" | "anexos";

export function OrdemModal({
  open,
  onClose,
  ordem,
}: {
  open: boolean;
  onClose: () => void;
  ordem?: Ordem | null;
}) {
  return (
    <Modal open={open} onClose={onClose} title={ordem ? "Editar ordem" : "Nova ordem"} className={ordem ? "sm:max-w-2xl" : "sm:max-w-xl"}>
      <OrdemForm ordem={ordem ?? null} onClose={onClose} />
    </Modal>
  );
}

function lerUltima(): { regiao?: string; equipe?: string } {
  try {
    return JSON.parse(localStorage.getItem(ULTIMA_KEY) || "{}");
  } catch {
    return {};
  }
}

function OrdemForm({ ordem, onClose }: { ordem: Ordem | null; onClose: () => void }) {
  const { regioes, equipes, linhas, clientes, userId, filial, refresh } = useData();
  const toast = useToast();
  const [saving, setSaving] = React.useState(false);
  const [aba, setAba] = React.useState<Aba>("dados");
  // Só existe com o modal aberto (cliente), então dá pra ler o navegador direto.
  const [ultima] = React.useState(() => (ordem ? {} : lerUltima()));
  const [status, setStatus] = React.useState(ordem?.status ?? "em_andamento");
  const [valor, setValor] = React.useState(ordem?.valor_venda != null ? String(ordem.valor_venda) : "");
  const [despesa, setDespesa] = React.useState(ordem?.despesa_direta != null ? String(ordem.despesa_direta) : "");

  const v = parseFloat(valor) || 0;
  const dsp = parseFloat(despesa) || 0;
  const margem = v - dsp;
  const margemPct = v > 0 ? (margem / v) * 100 : null;
  const concluida = status === "concluido";

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setSaving(true);
    const rec = {
      data: fd.get("data") as string,
      regiao: fd.get("regiao") as string,
      equipe: fd.get("equipe") as string,
      linha_servico: fd.get("linha_servico") as string,
      cliente: ((fd.get("cliente") as string) || "").trim() || null,
      valor_venda: v,
      despesa_direta: dsp,
      status,
      tempo_execucao_h: fd.get("tempo_execucao_h") ? parseFloat(fd.get("tempo_execucao_h") as string) : null,
      qualidade: fd.get("qualidade") ? parseInt(fd.get("qualidade") as string, 10) : null,
      resumo: ((fd.get("resumo") as string) || "").trim() || null,
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
    if (!ordem) {
      try { localStorage.setItem(ULTIMA_KEY, JSON.stringify({ regiao: rec.regiao, equipe: rec.equipe })); } catch {}
    }
    fireEvent(ordem ? "ordem.atualizada" : "ordem.criada", { ...rec, id: ordem?.id });
    toast(ordem ? "Ordem atualizada." : "Ordem criada.");
    onClose();
    // Atualiza em segundo plano: o modal já fechou, a lista se ajusta sozinha.
    void refresh();
  }

  // Campo inválido: leva o usuário até a aba "Dados" para ver o erro.
  function onInvalid() {
    if (aba !== "dados") setAba("dados");
  }

  const abas: { id: Aba; label: string }[] = [
    { id: "dados", label: "Dados" },
    { id: "checklist", label: "Checklist" },
    { id: "materiais", label: "Materiais" },
    { id: "anexos", label: "Fotos e anexos" },
  ];

  return (
    <form onSubmit={handleSubmit} onInvalidCapture={onInvalid}>
      {ordem && (
        <div className="sticky top-[57px] z-[5] flex gap-1 overflow-x-auto border-b border-border bg-surface px-3" role="tablist">
          {abas.map((a) => (
            <button
              key={a.id}
              type="button"
              role="tab"
              aria-selected={aba === a.id}
              onClick={() => setAba(a.id)}
              className={cn(
                "relative shrink-0 px-3 py-2.5 text-sm font-medium transition-colors cursor-pointer",
                aba === a.id ? "text-primary" : "text-muted hover:text-foreground",
              )}
            >
              {a.label}
              {aba === a.id && <span className="absolute inset-x-2 -bottom-px h-0.5 rounded bg-primary" />}
            </button>
          ))}
        </div>
      )}

      {/* "Dados" fica montado (só escondido) para não perder o que foi digitado ao trocar de aba. */}
      <ModalBody className={cn("space-y-5", aba !== "dados" && "hidden")}>
        <Secao titulo="Serviço">
          <div className="sm:col-span-2">
            <Label>Situação *</Label>
            <div className="grid grid-cols-3 gap-1.5" role="radiogroup" aria-label="Situação">
              {STATUS.map((s) => (
                <button
                  key={s.value}
                  type="button"
                  role="radio"
                  aria-checked={status === s.value}
                  onClick={() => setStatus(s.value as Ordem["status"])}
                  className={cn(
                    "h-9 rounded-lg border text-sm font-medium transition-colors cursor-pointer",
                    status === s.value ? s.tone : "border-border text-muted hover:text-foreground hover:bg-surface-2",
                  )}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <Label htmlFor="o-data">Data *</Label>
            <Input id="o-data" type="date" name="data" required defaultValue={ordem?.data ?? todayISO()} />
          </div>
          <div>
            <Label htmlFor="o-linha">Linha de serviço *</Label>
            <Select id="o-linha" name="linha_servico" required defaultValue={ordem?.linha_servico ?? (linhas.length === 1 ? linhas[0] : "")}>
              <option value="">Selecione</option>
              {linhas.map((r) => <option key={r} value={r}>{r}</option>)}
            </Select>
          </div>
          <div>
            <Label htmlFor="o-regiao">Região *</Label>
            <Select id="o-regiao" name="regiao" required defaultValue={ordem?.regiao ?? (ultima.regiao && regioes.includes(ultima.regiao) ? ultima.regiao : regioes.length === 1 ? regioes[0] : "")}>
              <option value="">Selecione</option>
              {regioes.map((r) => <option key={r} value={r}>{r}</option>)}
            </Select>
          </div>
          <div>
            <Label htmlFor="o-equipe">Equipe *</Label>
            <Select id="o-equipe" name="equipe" required defaultValue={ordem?.equipe ?? (ultima.equipe && equipes.includes(ultima.equipe) ? ultima.equipe : equipes.length === 1 ? equipes[0] : "")}>
              <option value="">Selecione</option>
              {equipes.map((r) => <option key={r} value={r}>{r}</option>)}
            </Select>
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="o-cliente">Cliente</Label>
            <Input id="o-cliente" type="text" name="cliente" list="clientes-list" placeholder="Opcional — comece a digitar para sugerir" defaultValue={ordem?.cliente ?? ""} autoComplete="off" />
            <datalist id="clientes-list">
              {clientes.map((c) => <option key={c} value={c} />)}
            </datalist>
          </div>
        </Secao>

        <Secao titulo="Valores">
          <div>
            <Label htmlFor="o-valor">Valor da venda (R$) *</Label>
            <Input id="o-valor" type="number" inputMode="decimal" step="0.01" min="0" required value={valor} onChange={(e) => setValor(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="o-despesa">Despesa direta (R$) *</Label>
            <Input id="o-despesa" type="number" inputMode="decimal" step="0.01" min="0" required value={despesa} onChange={(e) => setDespesa(e.target.value)} />
          </div>
          <div className="sm:col-span-2 flex items-center justify-between rounded-lg bg-surface-2 px-3 py-2 text-sm">
            <span className="text-muted">Margem da ordem</span>
            <span className={cn("font-mono font-semibold", margem < 0 ? "text-red" : margem > 0 ? "text-green" : "text-muted")}>
              {formatCurrency(margem)}
              {margemPct != null && <span className="ml-1.5 text-xs font-medium opacity-80">({margemPct.toFixed(0)}%)</span>}
            </span>
          </div>
        </Secao>

        <Secao titulo="Execução" dica={concluida ? undefined : "Preencha ao concluir"}>
          <div>
            <Label htmlFor="o-tempo">Tempo de execução (h)</Label>
            <Input id="o-tempo" type="number" inputMode="decimal" name="tempo_execucao_h" step="0.5" min="0" defaultValue={ordem?.tempo_execucao_h ?? ""} />
          </div>
          <div>
            <Label htmlFor="o-qual">Qualidade (0–100)</Label>
            <Input id="o-qual" type="number" inputMode="numeric" name="qualidade" min="0" max="100" defaultValue={ordem?.qualidade ?? ""} />
          </div>
          <div>
            <Label htmlFor="o-dag">Data agendada</Label>
            <Input id="o-dag" type="date" name="data_agendada" defaultValue={ordem?.data_agendada ?? ""} />
          </div>
          <div>
            <Label htmlFor="o-hag">Hora agendada</Label>
            <Input id="o-hag" type="time" name="hora_agendada" defaultValue={ordem?.hora_agendada?.slice(0, 5) ?? ""} />
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="o-resumo">Resumo</Label>
            <Textarea id="o-resumo" name="resumo" placeholder="O que foi feito / observações" defaultValue={ordem?.resumo ?? ""} />
          </div>
        </Secao>

        {!ordem && (
          <p className="text-xs text-muted">
            Depois de salvar, abra a ordem para lançar checklist, materiais e fotos.
          </p>
        )}
      </ModalBody>

      {ordem && aba !== "dados" && (
        <ModalBody>
          {aba === "checklist" && <OrdemChecklist ordemId={ordem.id} linhaServico={ordem.linha_servico} filial={ordem.filial ?? null} />}
          {aba === "materiais" && <OrdemMateriais ordemId={ordem.id} filial={ordem.filial ?? null} />}
          {aba === "anexos" && <OrdemAnexos ordemId={ordem.id} filial={ordem.filial ?? null} />}
        </ModalBody>
      )}

      <ModalFooter>
        <AtalhoSalvar />
        <Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
        <Button type="submit" disabled={saving}>{saving ? "Salvando..." : ordem ? "Salvar alterações" : "Criar ordem"}</Button>
      </ModalFooter>
    </form>
  );
}

function Secao({ titulo, dica, children }: { titulo: string; dica?: string; children: React.ReactNode }) {
  return (
    <fieldset>
      <legend className="mb-2.5 flex w-full items-baseline gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted">{titulo}</span>
        {dica && <span className="text-[11px] text-muted/80">· {dica}</span>}
      </legend>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">{children}</div>
    </fieldset>
  );
}
