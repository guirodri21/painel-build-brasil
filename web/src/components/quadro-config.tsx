"use client";

import * as React from "react";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/ui/toast";
import { Card, CardHeader, CardTitle, CardBody } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea, Label } from "@/components/ui/field";
import { Badge } from "@/components/ui/badge";
import { CORES, chaveDeLabel } from "@/lib/quadros";
import { cn } from "@/lib/utils";
import {
  CAMPO_TIPO_LABELS, GATILHO_LABELS, ACAO_LABELS,
  type Quadro, type QuadroFase, type QuadroCampo, type QuadroAutomacao, type QuadroFormulario,
  type CampoTipo, type AutomacaoGatilho, type AutomacaoAcao, type AcaoTipo, type CondicaoCampo,
} from "@/lib/types";
import { Plus, Trash2, ChevronUp, ChevronDown, Copy, ExternalLink, Save } from "lucide-react";

const TIPOS = Object.keys(CAMPO_TIPO_LABELS) as CampoTipo[];

export function QuadroConfig({
  quadro, fases, campos, automacoes, formularios, onChange,
}: {
  quadro: Quadro;
  fases: QuadroFase[];
  campos: QuadroCampo[];
  automacoes: QuadroAutomacao[];
  formularios: QuadroFormulario[];
  onChange: () => void | Promise<void>;
}) {
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <FasesConfig quadroId={quadro.id} fases={fases} onChange={onChange} />
      <CamposConfig quadroId={quadro.id} campos={campos} onChange={onChange} />
      <AutomacoesConfig quadroId={quadro.id} fases={fases} campos={campos} automacoes={automacoes} onChange={onChange} />
      <FormulariosConfig quadro={quadro} fases={fases} campos={campos} formularios={formularios} onChange={onChange} />
    </div>
  );
}

/* ----------------------------- FASES ----------------------------- */
function FasesConfig({ quadroId, fases, onChange }: { quadroId: string; fases: QuadroFase[]; onChange: () => void | Promise<void> }) {
  const toast = useToast();
  const [novo, setNovo] = React.useState("");

  async function add() {
    if (!novo.trim()) return;
    const ordem = (fases.at(-1)?.ordem ?? 0) + 1;
    const { error } = await createClient().from("quadro_fases").insert([{ quadro_id: quadroId, nome: novo.trim(), ordem, cor: "gray" }]);
    if (error) return toast("Erro: " + error.message, "error");
    setNovo(""); await onChange();
  }
  async function patch(id: string, p: Partial<QuadroFase>) {
    const { error } = await createClient().from("quadro_fases").update(p).eq("id", id);
    if (error) return toast("Erro: " + error.message, "error");
    await onChange();
  }
  async function remover(id: string) {
    const { error } = await createClient().from("quadro_fases").delete().eq("id", id);
    if (error) return toast("Erro: " + error.message, "error");
    await onChange();
  }
  async function mover(i: number, dir: -1 | 1) {
    const j = i + dir;
    if (j < 0 || j >= fases.length) return;
    const a = fases[i], b = fases[j];
    const supabase = createClient();
    await supabase.from("quadro_fases").update({ ordem: b.ordem }).eq("id", a.id);
    await supabase.from("quadro_fases").update({ ordem: a.ordem }).eq("id", b.id);
    await onChange();
  }

  return (
    <Card>
      <CardHeader><CardTitle>Fases (colunas)</CardTitle></CardHeader>
      <CardBody className="space-y-2">
        {fases.map((f, i) => (
          <div key={f.id} className="flex items-center gap-2">
            <div className="flex flex-col">
              <button onClick={() => mover(i, -1)} disabled={i === 0} className="text-muted hover:text-foreground disabled:opacity-30"><ChevronUp size={12} /></button>
              <button onClick={() => mover(i, 1)} disabled={i === fases.length - 1} className="text-muted hover:text-foreground disabled:opacity-30"><ChevronDown size={12} /></button>
            </div>
            <Input defaultValue={f.nome} onBlur={(e) => e.target.value.trim() && e.target.value !== f.nome && patch(f.id, { nome: e.target.value.trim() })} className="flex-1" />
            <Select value={f.cor ?? "gray"} onChange={(e) => patch(f.id, { cor: e.target.value })} className="w-24">
              {CORES.map((c) => <option key={c} value={c}>{c}</option>)}
            </Select>
            <label className="flex items-center gap-1 text-[11px] text-muted whitespace-nowrap cursor-pointer" title="Fase final (conclui o card)">
              <input type="checkbox" checked={f.final} onChange={(e) => patch(f.id, { final: e.target.checked })} className="h-3.5 w-3.5" /> final
            </label>
            <button onClick={() => remover(f.id)} className="text-muted hover:text-red"><Trash2 size={14} /></button>
          </div>
        ))}
        <div className="flex items-center gap-2 pt-1">
          <Input value={novo} onChange={(e) => setNovo(e.target.value)} placeholder="Nova fase..." onKeyDown={(e) => e.key === "Enter" && add()} className="flex-1" />
          <Button size="sm" onClick={add}><Plus size={14} /> Add</Button>
        </div>
      </CardBody>
    </Card>
  );
}

/* ----------------------------- CAMPOS ----------------------------- */
function CamposConfig({ quadroId, campos, onChange }: { quadroId: string; campos: QuadroCampo[]; onChange: () => void | Promise<void> }) {
  const toast = useToast();
  const [label, setLabel] = React.useState("");
  const [tipo, setTipo] = React.useState<CampoTipo>("texto");

  async function add() {
    if (!label.trim()) return;
    let chave = chaveDeLabel(label);
    if (campos.some((c) => c.chave === chave)) chave = `${chave}_${Date.now().toString(36).slice(-3)}`;
    const ordem = (campos.at(-1)?.ordem ?? 0) + 1;
    const { error } = await createClient().from("quadro_campos").insert([{ quadro_id: quadroId, chave, label: label.trim(), tipo, ordem }]);
    if (error) return toast("Erro: " + error.message, "error");
    setLabel(""); setTipo("texto"); await onChange();
  }
  async function patch(id: string, p: Partial<QuadroCampo>) {
    const { error } = await createClient().from("quadro_campos").update(p).eq("id", id);
    if (error) return toast("Erro: " + error.message, "error");
    await onChange();
  }
  async function remover(id: string) {
    const { error } = await createClient().from("quadro_campos").delete().eq("id", id);
    if (error) return toast("Erro: " + error.message, "error");
    await onChange();
  }

  return (
    <Card>
      <CardHeader><CardTitle>Campos personalizados</CardTitle></CardHeader>
      <CardBody className="space-y-3">
        {campos.length === 0 && <p className="text-xs text-muted">Nenhum campo ainda. Adicione abaixo.</p>}
        {campos.map((c) => (
          <div key={c.id} className="rounded-lg border border-border p-2.5 space-y-2">
            <div className="flex items-center gap-2">
              <Input defaultValue={c.label} onBlur={(e) => e.target.value.trim() && e.target.value !== c.label && patch(c.id, { label: e.target.value.trim() })} className="flex-1" />
              <Select value={c.tipo} onChange={(e) => patch(c.id, { tipo: e.target.value as CampoTipo })} className="w-36">
                {TIPOS.map((t) => <option key={t} value={t}>{CAMPO_TIPO_LABELS[t]}</option>)}
              </Select>
              <button onClick={() => remover(c.id)} className="text-muted hover:text-red"><Trash2 size={14} /></button>
            </div>
            {c.tipo === "selecao" && (
              <Input defaultValue={c.opcoes.join(", ")} placeholder="Opções separadas por vírgula"
                onBlur={(e) => patch(c.id, { opcoes: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })} />
            )}
            <div className="flex items-center gap-4 text-[11px] text-muted">
              <label className="flex items-center gap-1 cursor-pointer"><input type="checkbox" checked={c.obrigatorio} onChange={(e) => patch(c.id, { obrigatorio: e.target.checked })} className="h-3.5 w-3.5" /> obrigatório</label>
              <label className="flex items-center gap-1 cursor-pointer"><input type="checkbox" checked={c.mostrar_no_card} onChange={(e) => patch(c.id, { mostrar_no_card: e.target.checked })} className="h-3.5 w-3.5" /> mostrar no card</label>
              <span className="ml-auto font-mono opacity-60">{c.chave}</span>
            </div>
          </div>
        ))}
        <div className="flex items-center gap-2 pt-1 border-t border-border">
          <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Nome do campo..." className="flex-1" onKeyDown={(e) => e.key === "Enter" && add()} />
          <Select value={tipo} onChange={(e) => setTipo(e.target.value as CampoTipo)} className="w-36">
            {TIPOS.map((t) => <option key={t} value={t}>{CAMPO_TIPO_LABELS[t]}</option>)}
          </Select>
          <Button size="sm" onClick={add}><Plus size={14} /> Add</Button>
        </div>
      </CardBody>
    </Card>
  );
}

/* ----------------------------- AUTOMAÇÕES ----------------------------- */
const GATILHOS = Object.keys(GATILHO_LABELS) as AutomacaoGatilho[];
const ACOES = Object.keys(ACAO_LABELS) as AcaoTipo[];

function AutomacoesConfig({ quadroId, fases, campos, automacoes, onChange }: {
  quadroId: string; fases: QuadroFase[]; campos: QuadroCampo[]; automacoes: QuadroAutomacao[]; onChange: () => void | Promise<void>;
}) {
  const [editando, setEditando] = React.useState<QuadroAutomacao | null>(null);
  const [criando, setCriando] = React.useState(false);
  // Lista de quadros (alvos possíveis da ação "criar card em outro quadro").
  const [quadros, setQuadros] = React.useState<{ id: string; nome: string }[]>([]);
  React.useEffect(() => {
    createClient().from("quadros").select("id, nome").eq("ativo", true).order("nome")
      .then(({ data }) => setQuadros((data as { id: string; nome: string }[]) ?? []));
  }, []);

  async function toggle(a: QuadroAutomacao) {
    await createClient().from("quadro_automacoes").update({ ativo: !a.ativo }).eq("id", a.id);
    await onChange();
  }
  async function remover(id: string) {
    await createClient().from("quadro_automacoes").delete().eq("id", id);
    await onChange();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Automações</CardTitle>
        <Button size="sm" variant="secondary" onClick={() => { setEditando(null); setCriando(true); }}><Plus size={14} /> Nova</Button>
      </CardHeader>
      <CardBody className="space-y-2">
        {automacoes.length === 0 && !criando && <p className="text-xs text-muted">Nenhuma automação. Ex.: ao mover para &quot;Concluído&quot;, notificar e disparar webhook.</p>}
        {automacoes.map((a) => (
          <div key={a.id} className="rounded-lg border border-border p-2.5">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium truncate">{a.nome}</span>
                  {!a.ativo && <Badge tone="gray">pausada</Badge>}
                </div>
                <p className="text-[11px] text-muted">{GATILHO_LABELS[a.gatilho]}{a.config.fase ? ` "${a.config.fase}"` : ""} → {(a.config.acoes ?? []).map((ac) => ACAO_LABELS[ac.tipo]).join(", ") || "—"}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <label className="flex items-center gap-1 text-[11px] text-muted cursor-pointer"><input type="checkbox" checked={a.ativo} onChange={() => toggle(a)} className="h-3.5 w-3.5" /> ativa</label>
                <button onClick={() => { setCriando(false); setEditando(a); }} className="text-xs text-primary font-medium">editar</button>
                <button onClick={() => remover(a.id)} className="text-muted hover:text-red"><Trash2 size={14} /></button>
              </div>
            </div>
          </div>
        ))}
        {(criando || editando) && (
          <AutomacaoEditor
            quadroId={quadroId} fases={fases} campos={campos} quadros={quadros} automacao={editando}
            onClose={() => { setCriando(false); setEditando(null); }}
            onSaved={async () => { setCriando(false); setEditando(null); await onChange(); }}
          />
        )}
      </CardBody>
    </Card>
  );
}

function AutomacaoEditor({ quadroId, fases, campos, quadros, automacao, onClose, onSaved }: {
  quadroId: string; fases: QuadroFase[]; campos: QuadroCampo[]; quadros: { id: string; nome: string }[];
  automacao: QuadroAutomacao | null; onClose: () => void; onSaved: () => void | Promise<void>;
}) {
  const toast = useToast();
  const [nome, setNome] = React.useState(automacao?.nome ?? "");
  const [gatilho, setGatilho] = React.useState<AutomacaoGatilho>(automacao?.gatilho ?? "card_movido");
  const [fase, setFase] = React.useState(automacao?.config.fase ?? fases[0]?.nome ?? "");
  const [label, setLabel] = React.useState(automacao?.config.label ?? "");
  const [cor, setCor] = React.useState(automacao?.config.cor ?? "blue");
  const [campoObs, setCampoObs] = React.useState(automacao?.config.campo ?? campos[0]?.chave ?? "");
  const [valorCond, setValorCond] = React.useState(automacao?.config.valor ?? "");
  const [condicoes, setCondicoes] = React.useState<CondicaoCampo[]>(automacao?.config.condicoes ?? []);
  const [mensagemBloq, setMensagemBloq] = React.useState(automacao?.config.mensagem ?? "");
  const [acoes, setAcoes] = React.useState<AutomacaoAcao[]>(automacao?.config.acoes ?? [{ tipo: "notificar", mensagem: "" }]);
  const [saving, setSaving] = React.useState(false);

  function setAcao(i: number, p: Partial<AutomacaoAcao>) {
    setAcoes((prev) => prev.map((a, idx) => (idx === i ? { ...a, ...p } : a)));
  }

  async function salvar() {
    if (!nome.trim()) return toast("Dê um nome à automação.", "error");
    if (gatilho === "botao" && !label.trim()) return toast("Defina o rótulo do botão.", "error");
    setSaving(true);
    if (gatilho === "campo_alterado" && !campoObs) return toast("Escolha o campo observado.", "error");
    const config = {
      ...(gatilho === "card_movido" || gatilho === "bloqueio_fase" ? { fase } : {}),
      ...(gatilho === "botao" ? { label: label.trim(), cor } : {}),
      ...(gatilho === "campo_alterado" ? { campo: campoObs, valor: valorCond } : {}),
      ...(gatilho === "bloqueio_fase" ? { condicoes: condicoes.filter((c) => c.campo), mensagem: mensagemBloq.trim() } : {}),
      acoes,
    };
    const rec = { quadro_id: quadroId, nome: nome.trim(), gatilho, config };
    const supabase = createClient();
    const { error } = automacao
      ? await supabase.from("quadro_automacoes").update(rec).eq("id", automacao.id)
      : await supabase.from("quadro_automacoes").insert([rec]);
    setSaving(false);
    if (error) return toast("Erro: " + error.message, "error");
    await onSaved();
  }

  return (
    <div className="rounded-lg border border-primary/40 bg-primary-soft/20 p-3 space-y-3">
      <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nome da automação" />
      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label>Quando</Label>
          <Select value={gatilho} onChange={(e) => setGatilho(e.target.value as AutomacaoGatilho)}>
            {GATILHOS.map((g) => <option key={g} value={g}>{GATILHO_LABELS[g]}</option>)}
          </Select>
        </div>
        {(gatilho === "card_movido" || gatilho === "bloqueio_fase") && (
          <div>
            <Label>{gatilho === "bloqueio_fase" ? "Fase protegida" : "Fase"}</Label>
            <Select value={fase} onChange={(e) => setFase(e.target.value)}>
              {fases.map((f) => <option key={f.id} value={f.nome}>{f.nome}</option>)}
            </Select>
          </div>
        )}
      </div>

      {gatilho === "botao" && (
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label>Rótulo do botão</Label>
            <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Ex.: Solicitar Compra" />
          </div>
          <div>
            <Label>Cor</Label>
            <Select value={cor} onChange={(e) => setCor(e.target.value)}>
              {CORES.map((c) => <option key={c} value={c}>{c}</option>)}
            </Select>
          </div>
        </div>
      )}

      {gatilho === "campo_alterado" && (
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label>Campo observado</Label>
            <Select value={campoObs} onChange={(e) => setCampoObs(e.target.value)}>
              <option value="">Escolha o campo</option>
              {campos.map((c) => <option key={c.id} value={c.chave}>{c.label}</option>)}
            </Select>
          </div>
          <div>
            <Label>Quando o valor for</Label>
            <Input value={valorCond} onChange={(e) => setValorCond(e.target.value)} placeholder="vazio = preenchido · true/false = Sim/Não" />
          </div>
        </div>
      )}

      {gatilho === "bloqueio_fase" && (
        <div className="space-y-2">
          <Label>Condições para liberar o avanço</Label>
          {condicoes.map((c, i) => (
            <div key={i} className="flex items-center gap-2">
              <Select value={c.campo} onChange={(e) => setCondicoes((prev) => prev.map((x, idx) => idx === i ? { ...x, campo: e.target.value } : x))} className="flex-1">
                <option value="">Campo</option>
                {campos.map((cp) => <option key={cp.id} value={cp.chave}>{cp.label}</option>)}
              </Select>
              <Input value={c.valor} onChange={(e) => setCondicoes((prev) => prev.map((x, idx) => idx === i ? { ...x, valor: e.target.value } : x))} placeholder="true / false / vazio / preenchido" className="flex-1" />
              <button type="button" onClick={() => setCondicoes((prev) => prev.filter((_, idx) => idx !== i))} className="text-muted hover:text-red"><Trash2 size={14} /></button>
            </div>
          ))}
          <Button size="sm" variant="ghost" onClick={() => setCondicoes((prev) => [...prev, { campo: "", valor: "true" }])}><Plus size={13} /> Adicionar condição</Button>
          <Input value={mensagemBloq} onChange={(e) => setMensagemBloq(e.target.value)} placeholder="Mensagem de bloqueio (opcional)" />
        </div>
      )}

      {gatilho !== "bloqueio_fase" && (
      <div className="space-y-2">
        <Label>Faz</Label>
        {acoes.map((a, i) => (
          <div key={i} className="flex items-start gap-2">
            <Select value={a.tipo} onChange={(e) => setAcao(i, { tipo: e.target.value as AcaoTipo })} className="w-44">
              {ACOES.map((t) => <option key={t} value={t}>{ACAO_LABELS[t]}</option>)}
            </Select>
            <div className="flex-1">
              {a.tipo === "mover_fase" && (
                <Select value={a.fase ?? ""} onChange={(e) => setAcao(i, { fase: e.target.value })}>
                  <option value="">Escolha a fase</option>
                  {fases.map((f) => <option key={f.id} value={f.nome}>{f.nome}</option>)}
                </Select>
              )}
              {a.tipo === "notificar" && (
                <Input value={a.mensagem ?? ""} onChange={(e) => setAcao(i, { mensagem: e.target.value })} placeholder="Mensagem (opcional)" />
              )}
              {a.tipo === "definir_campo" && (
                <div className="flex gap-2">
                  <Select value={a.campo ?? ""} onChange={(e) => setAcao(i, { campo: e.target.value })} className="w-1/2">
                    <option value="">Campo</option>
                    {campos.map((c) => <option key={c.id} value={c.chave}>{c.label}</option>)}
                  </Select>
                  <Input value={a.valor ?? ""} onChange={(e) => setAcao(i, { valor: e.target.value })} placeholder="Valor" className="w-1/2" />
                </div>
              )}
              {a.tipo === "criar_card" && (
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <Select value={a.quadro_destino ?? ""} onChange={(e) => setAcao(i, { quadro_destino: e.target.value })} className="w-1/2">
                      <option value="">Quadro destino</option>
                      {quadros.map((q) => <option key={q.id} value={q.id}>{q.nome}</option>)}
                    </Select>
                    <Input value={a.fase_destino ?? ""} onChange={(e) => setAcao(i, { fase_destino: e.target.value })} placeholder="Fase de destino (ex.: Solicitação)" className="w-1/2" />
                  </div>
                  <label className="flex items-center gap-1.5 text-[11px] text-muted cursor-pointer">
                    <input type="checkbox" checked={!!a.copiar_valor} onChange={(e) => setAcao(i, { copiar_valor: e.target.checked })} className="h-3.5 w-3.5" />
                    copiar o valor (R$) do card de origem
                  </label>
                </div>
              )}
              {a.tipo === "webhook" && <p className="text-[11px] text-muted pt-2">Dispara o evento <code>quadro.automacao</code> nos webhooks de saída (ex.: Goalfy).</p>}
            </div>
            <button onClick={() => setAcoes((prev) => prev.filter((_, idx) => idx !== i))} className="text-muted hover:text-red pt-2"><Trash2 size={14} /></button>
          </div>
        ))}
        <Button size="sm" variant="ghost" onClick={() => setAcoes((prev) => [...prev, { tipo: "notificar", mensagem: "" }])}><Plus size={13} /> Adicionar ação</Button>
      </div>
      )}

      <div className="flex justify-end gap-2">
        <Button size="sm" variant="secondary" onClick={onClose}>Cancelar</Button>
        <Button size="sm" onClick={salvar} disabled={saving}><Save size={14} /> {saving ? "Salvando..." : "Salvar"}</Button>
      </div>
    </div>
  );
}

/* ----------------------------- FORMULÁRIOS ----------------------------- */
function FormulariosConfig({ quadro, fases, campos, formularios, onChange }: {
  quadro: Quadro; fases: QuadroFase[]; campos: QuadroCampo[]; formularios: QuadroFormulario[]; onChange: () => void | Promise<void>;
}) {
  const toast = useToast();
  const [criando, setCriando] = React.useState(false);
  const origin = typeof window !== "undefined" ? window.location.origin : "";

  async function remover(id: string) {
    await createClient().from("quadro_formularios").delete().eq("id", id);
    await onChange();
  }
  async function toggle(f: QuadroFormulario) {
    await createClient().from("quadro_formularios").update({ ativo: !f.ativo }).eq("id", f.id);
    await onChange();
  }
  function copiar(slug: string) {
    navigator.clipboard?.writeText(`${origin}/f/${slug}`);
    toast("Link copiado.");
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Formulários de entrada</CardTitle>
        <Button size="sm" variant="secondary" onClick={() => setCriando(true)}><Plus size={14} /> Novo</Button>
      </CardHeader>
      <CardBody className="space-y-2">
        {formularios.length === 0 && !criando && <p className="text-xs text-muted">Crie um formulário público para captar demandas/leads que viram cards automaticamente.</p>}
        {formularios.map((f) => (
          <div key={f.id} className="rounded-lg border border-border p-2.5">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="flex items-center gap-2"><span className="text-sm font-medium truncate">{f.titulo}</span>{!f.ativo && <Badge tone="gray">inativo</Badge>}</div>
                <p className="text-[11px] text-muted truncate">/f/{f.slug} → {f.fase_destino ?? fases[0]?.nome}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button onClick={() => copiar(f.slug)} className="text-muted hover:text-primary" title="Copiar link"><Copy size={14} /></button>
                <a href={`/f/${f.slug}`} target="_blank" rel="noopener noreferrer" className="text-muted hover:text-primary" title="Abrir"><ExternalLink size={14} /></a>
                <label className="flex items-center gap-1 text-[11px] text-muted cursor-pointer"><input type="checkbox" checked={f.ativo} onChange={() => toggle(f)} className="h-3.5 w-3.5" /> ativo</label>
                <button onClick={() => remover(f.id)} className="text-muted hover:text-red"><Trash2 size={14} /></button>
              </div>
            </div>
          </div>
        ))}
        {criando && (
          <FormularioEditor quadro={quadro} fases={fases} campos={campos}
            onClose={() => setCriando(false)}
            onSaved={async () => { setCriando(false); await onChange(); }} />
        )}
      </CardBody>
    </Card>
  );
}

function FormularioEditor({ quadro, fases, campos, onClose, onSaved }: {
  quadro: Quadro; fases: QuadroFase[]; campos: QuadroCampo[]; onClose: () => void; onSaved: () => void | Promise<void>;
}) {
  const toast = useToast();
  const [titulo, setTitulo] = React.useState("");
  const [descricao, setDescricao] = React.useState("");
  const [faseDestino, setFaseDestino] = React.useState(fases[0]?.nome ?? "");
  const [sel, setSel] = React.useState<string[]>(campos.map((c) => c.chave));
  const [saving, setSaving] = React.useState(false);

  function toggleCampo(chave: string) {
    setSel((prev) => (prev.includes(chave) ? prev.filter((c) => c !== chave) : [...prev, chave]));
  }

  async function salvar() {
    if (!titulo.trim()) return toast("Dê um título ao formulário.", "error");
    setSaving(true);
    const slug = `${chaveDeLabel(titulo).replace(/_/g, "-")}-${Math.random().toString(36).slice(2, 6)}`;
    const { error } = await createClient().from("quadro_formularios").insert([{
      quadro_id: quadro.id, slug, titulo: titulo.trim(), descricao: descricao.trim() || null,
      fase_destino: faseDestino, campos: sel,
    }]);
    setSaving(false);
    if (error) return toast("Erro: " + error.message, "error");
    await onSaved();
  }

  return (
    <div className="rounded-lg border border-primary/40 bg-primary-soft/20 p-3 space-y-3">
      <Input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Título do formulário (ex.: Solicitar atendimento)" />
      <Textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Descrição / instruções (opcional)" />
      <div>
        <Label>Fase de destino dos cards</Label>
        <Select value={faseDestino} onChange={(e) => setFaseDestino(e.target.value)}>
          {fases.map((f) => <option key={f.id} value={f.nome}>{f.nome}</option>)}
        </Select>
      </div>
      <div>
        <Label>Campos no formulário</Label>
        <div className="flex flex-wrap gap-2">
          {campos.length === 0 && <p className="text-[11px] text-muted">O formulário pedirá só o título. Adicione campos personalizados para captar mais dados.</p>}
          {campos.map((c) => (
            <button key={c.id} onClick={() => toggleCampo(c.chave)}
              className={cn("text-xs px-2.5 py-1 rounded-md border transition-colors", sel.includes(c.chave) ? "border-primary bg-primary-soft text-primary" : "border-border text-muted")}>
              {c.label}
            </button>
          ))}
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <Button size="sm" variant="secondary" onClick={onClose}>Cancelar</Button>
        <Button size="sm" onClick={salvar} disabled={saving}><Save size={14} /> {saving ? "Criando..." : "Criar formulário"}</Button>
      </div>
    </div>
  );
}
