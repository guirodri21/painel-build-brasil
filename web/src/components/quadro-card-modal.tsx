"use client";

import * as React from "react";
import { createClient } from "@/lib/supabase/client";
import { useData } from "@/components/data-provider";
import { useToast } from "@/components/ui/toast";
import { ConfirmDialog } from "@/components/ui/confirm";
import { Modal, ModalBody, ModalFooter } from "@/components/ui/modal";
import { Input, Select, Textarea, Label } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { runAutomacoes, runBotao, runCamposAlterados, validarBloqueio, botoesDeAcao, validarObrigatorios, codigoCard, NOME_PIPELINE_OPERACIONAL } from "@/lib/quadros";
import { cn, formatCurrency, formatDate } from "@/lib/utils";
import { Trash2, Zap, History, Lock } from "lucide-react";
import type { Quadro, QuadroFase, QuadroCampo, QuadroCard, QuadroAutomacao } from "@/lib/types";

/** No Pipeline Operacional o card é enxuto: só estes campos (até "Técnico responsável"). */
const CAMPOS_OPERACAO = ["origem_com", "situacao", "tecnico"];
/** Situação padrão (fases sem lista própria). */
const SITUACOES_OPERACAO = ["Em Preparacao", "Analise Tecnica", "Solicitacao de Material", "Solicitacao de Pagamento"];
/** Situações específicas por fase do Pipeline Operacional (chave = nome da fase). */
const SITUACOES_POR_FASE: Record<string, string[]> = {
  "Entrada da Operacao": [
    "Novo", "Recebido", "Dados Incompletos", "Pronto para Preparação",
  ],
  "Em Preparacao": [
    "Em Preparação", "Com Impedimento", "Pronto para Agendamento",
  ],
  "Agendamento": [
    "Agendamento Solicitado", "Aguardando Cliente/Técnico", "Confirmado",
    "Pronto para Execução", "Reagendado",
  ],
  "Solicitacao de Faturamento": [
    "Ticket analisado", "Relatório enviado no e-mail",
  ],
  "Resolvido / Concluido": [
    "Concluído", "Resolvido sem Faturamento", "Resolvido com Faturamento",
    "Cancelado", "Encerrado Administrativamente",
  ],
};
/** Campos extras liberados por fase (além de origem_com/situacao/tecnico). */
const CAMPOS_EXTRA_POR_FASE: Record<string, string[]> = {
  "Agendamento": ["ticket_trilogo"],
  "Em Execucao / Fechamento": ["status_execucao", "status_avaliacao", "avaliacao_execucao"],
};

/** Renderiza o input certo para um campo personalizado. */
export function CampoInput({ campo, value, onChange }: { campo: QuadroCampo; value: unknown; onChange: (v: unknown) => void }) {
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

type PedidoVinculado = { id: string; titulo: string | null; fase: string; valor: number; created_at: string; quadro: string };

/**
 * Histórico de pedidos gerados a partir de um card (Solicitar Compra → Suprimentos,
 * Gerar Conta a Pagar / Solicitar Pagamento → Financeiro etc.). Lê os cards-filho
 * pelo vínculo valores->>card_origem_id. Não renderiza nada se não houver pedidos.
 */
function PedidosVinculados({ cardId }: { cardId: string }) {
  const [itens, setItens] = React.useState<PedidoVinculado[] | null>(null);

  React.useEffect(() => {
    let ativo = true;
    createClient()
      .from("quadro_cards")
      .select("id, titulo, fase, valor, created_at, quadros(nome)")
      .eq("valores->>card_origem_id", cardId)
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        if (!ativo) return;
        const rows: PedidoVinculado[] = ((data ?? []) as unknown[]).map((r) => {
          const row = r as { id: string; titulo: string | null; fase: string; valor: number; created_at: string; quadros: { nome: string } | { nome: string }[] | null };
          const q = Array.isArray(row.quadros) ? row.quadros[0] : row.quadros;
          return { id: row.id, titulo: row.titulo, fase: row.fase, valor: row.valor, created_at: row.created_at, quadro: q?.nome ?? "—" };
        });
        setItens(rows);
      });
    return () => { ativo = false; };
  }, [cardId]);

  if (!itens || itens.length === 0) return null;

  return (
    <div className="border-t border-border pt-4">
      <Label className="flex items-center gap-1.5"><History size={13} /> Histórico de pedidos</Label>
      <ul className="space-y-1.5">
        {itens.map((it) => (
          <li key={it.id} className="flex items-center justify-between gap-2 rounded-lg border border-border px-2.5 py-1.5 text-xs">
            <span className="min-w-0 truncate">
              <span className="font-medium">{it.quadro}</span>
              {it.titulo ? <span className="text-muted"> · {it.titulo}</span> : null}
              <span className="text-muted"> · {formatDate(it.created_at)}</span>
            </span>
            <span className="flex items-center gap-2 shrink-0">
              {it.valor > 0 && <span className="tabular-nums text-muted">{formatCurrency(it.valor)}</span>}
              <span className="rounded-full bg-surface-2 px-2 py-0.5">{it.fase}</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
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
  const [acaoForm, setAcaoForm] = React.useState<QuadroAutomacao | null>(null);

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

  // No Pipeline Operacional o card é enxuto: só campos até "Técnico responsável"
  // e a Situação restrita aos 4 status do fluxo novo.
  const isOperacao = quadro.nome === NOME_PIPELINE_OPERACIONAL;
  const camposVisiveis = React.useMemo<QuadroCampo[]>(() => {
    if (!isOperacao) return campos;
    // Cada fase pode liberar campos extras (ticket na Agendamento; status na Execução).
    const permitidos = [...CAMPOS_OPERACAO, ...(CAMPOS_EXTRA_POR_FASE[fase] ?? [])];
    return campos
      .filter((c) => permitidos.includes(c.chave))
      .map((c) => (c.chave === "situacao"
        ? { ...c, tipo: "selecao", opcoes: SITUACOES_POR_FASE[fase] ?? SITUACOES_OPERACAO }
        : c));
  }, [campos, isOperacao, fase]);

  // Snapshot congelado dos dados da venda (só leitura), gravado ao criar o card OP.
  const venda = React.useMemo(() => {
    const v = card?.valores?.venda;
    return isOperacao && v && typeof v === "object" ? (v as Record<string, unknown>) : null;
  }, [card, isOperacao]);

  // Ticket (Trílogo) já preenchido: fora do Agendamento aparece só leitura.
  const ticketReadonly = React.useMemo(() => {
    if (!isOperacao || fase === "Agendamento") return null;
    const v = valores["ticket_trilogo"];
    return typeof v === "string" && v.trim() ? v : null;
  }, [isOperacao, fase, valores]);

  // Depois que o card sai da 1ª fase do board, os dados principais congelam.
  const primeiraFase = fases[0]?.nome;
  const congelarPrincipais = editando && !!primeiraFase && card!.fase !== primeiraFase;

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    const erro = validarObrigatorios(camposVisiveis, valores, titulo);
    if (erro) { toast(erro, "error"); return; }
    // Gate de fase: ao mudar para uma fase protegida, valida as condições.
    if (fase !== card?.fase) {
      const bloqueio = validarBloqueio(automacoes, fase, valores, parseFloat(valor) || 0);
      if (bloqueio) { toast(bloqueio, "error"); return; }
    }
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

    // Gatilho de checklist: campos personalizados que mudaram de valor.
    const valoresAntigos = card?.valores ?? {};
    const chavesAlteradas = campos
      .map((c) => c.chave)
      .filter((k) => JSON.stringify(valoresAntigos[k] ?? null) !== JSON.stringify(valores[k] ?? null));
    if (savedCard && chavesAlteradas.length) {
      const fc = await runCamposAlterados(quadro.id, quadro.nome, automacoes, savedCard, chavesAlteradas);
      feitos.push(...fc);
    }
    setSaving(false);
    await onSaved();
    toast(feitos.length ? `Salvo. Automações: ${feitos.join(", ")}` : editando ? "Card atualizado." : "Card criado.");
    onClose();
  }

  // Botões de ação; se a automação tiver config.fase, só aparece nessa fase.
  const botoes = React.useMemo(
    () => botoesDeAcao(automacoes).filter((a) => !a.config.fase || a.config.fase === fase),
    [automacoes, fase],
  );

  async function clicarBotao(a: QuadroAutomacao) {
    if (!card) return;
    // Se o botão aponta para uma URL externa (ex.: formulário do Goalfy), abre o
    // link e roda apenas as ações que não criam card (ex.: marcar a Situação).
    if (a.config.url) {
      window.open(a.config.url, "_blank", "noopener,noreferrer");
      const semCriar = {
        ...a,
        config: { ...a.config, acoes: a.config.acoes.filter((ac) => ac.tipo !== "criar_card") },
      };
      if (semCriar.config.acoes.length) {
        await runBotao(quadro.id, quadro.nome, semCriar, card);
        await onSaved();
      }
      onClose();
      return;
    }
    // Se a ação cria um card em OUTRO board, abre o formulário inline para a
    // pessoa preencher os dados na hora (em vez de ir até a outra seção fazer).
    const criaEmOutroBoard = a.config.acoes?.some(
      (ac) => ac.tipo === "criar_card" && ac.quadro_destino && ac.quadro_destino !== quadro.id,
    );
    if (criaEmOutroBoard) { setAcaoForm(a); return; }
    // Caso contrário (ex.: retrabalho no próprio board), executa direto.
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
    <Modal open={open} onClose={onClose} title={editando ? (codigoCard(quadro.prefixo, card?.numero ?? null) ?? "Editar card") : "Novo card"} className="max-w-xl">
      <form onSubmit={salvar}>
        <ModalBody>
          {congelarPrincipais && (
            <p className="text-[11px] text-muted flex items-center gap-1.5">
              <Lock size={12} /> Dados principais congelados (definidos na entrada do card).
            </p>
          )}
          <div>
            <Label>Título *</Label>
            <Input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Título do card" autoFocus disabled={congelarPrincipais} />
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
              <Select value={prioridade} onChange={(e) => setPrioridade(e.target.value)} disabled={congelarPrincipais}>
                <option value="">—</option>
                <option value="Alta">Alta</option>
                <option value="Média">Média</option>
                <option value="Baixa">Baixa</option>
              </Select>
            </div>
            <div>
              <Label>Responsável</Label>
              <Input value={responsavel} onChange={(e) => setResponsavel(e.target.value)} list="quadro-clientes" disabled={congelarPrincipais} />
              <datalist id="quadro-clientes">{clientes.map((c) => <option key={c} value={c} />)}</datalist>
            </div>
            <div>
              <Label>Valor (R$)</Label>
              <Input type="number" step="0.01" min="0" value={valor} onChange={(e) => setValor(e.target.value)} disabled={congelarPrincipais} />
            </div>
            <div>
              <Label>Prazo{isOperacao && " (D+3)"}</Label>
              <Input type="date" value={prazo} onChange={(e) => setPrazo(e.target.value)} disabled={congelarPrincipais} />
              {isOperacao && !congelarPrincipais && <p className="text-[11px] text-muted mt-1">Padrão: 3 dias após a criação do card.</p>}
            </div>
          </div>

          {/* Dados da venda (congelado, só leitura) — vindos do card comercial */}
          {venda && (
            <div className="rounded-lg border border-border bg-surface-2/40 p-3">
              <p className="text-xs font-semibold text-muted flex items-center gap-1.5 mb-2">
                <Lock size={12} /> Dados da venda <span className="font-normal">(congelado)</span>
              </p>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-[13px]">
                {([
                  ["Cliente", venda.cliente],
                  ["Vendedor", venda.vendedor],
                  ["Valor", venda.valor != null ? formatCurrency(Number(venda.valor) || 0) : null],
                  ["Região", venda.regiao],
                  ["Contato", venda.contato],
                  ["Ticket", venda.ticket],
                ] as [string, unknown][])
                  .filter(([, v]) => v != null && v !== "")
                  .map(([label, v]) => (
                    <div key={label} className="min-w-0">
                      <dt className="text-muted text-[11px]">{label}</dt>
                      <dd className="truncate">{String(v)}</dd>
                    </div>
                  ))}
                {typeof venda.descricao === "string" && venda.descricao.trim() && (
                  <div className="col-span-2">
                    <dt className="text-muted text-[11px]">Descrição</dt>
                    <dd className="whitespace-pre-wrap">{venda.descricao}</dd>
                  </div>
                )}
              </dl>
            </div>
          )}

          {camposVisiveis.length > 0 && (
            <div className="border-t border-border pt-4 space-y-4">
              {camposVisiveis.map((campo) => (
                <div key={campo.id}>
                  <Label>{campo.label}{campo.obrigatorio && " *"}</Label>
                  <CampoInput campo={campo} value={valores[campo.chave]} onChange={(v) => setCampo(campo.chave, v)} />
                </div>
              ))}
            </div>
          )}
          {/* Ticket (Trílogo) já preenchido — só leitura fora do Agendamento */}
          {ticketReadonly && (
            <div className="rounded-lg border border-border bg-surface-2/40 p-3">
              <span className="text-[11px] text-muted block">Ticket (Trílogo)</span>
              <span className="text-[13px] font-medium">{ticketReadonly}</span>
            </div>
          )}
          {/* Histórico de pedidos gerados a partir deste card (material + pagamento) */}
          {editando && <PedidosVinculados cardId={card!.id} />}
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
    {acaoForm && card && (
      <AcaoCriarCardModal
        open={!!acaoForm}
        onClose={() => setAcaoForm(null)}
        automacao={acaoForm}
        quadroOrigem={quadro}
        cardOrigem={card}
        onDone={async () => {
          setAcaoForm(null);
          await onSaved();
          toast("Solicitação enviada.");
          onClose();
        }}
      />
    )}
    </>
  );
}

/**
 * Formulário inline para uma ação "criar_card" que aponta para OUTRO board.
 * Em vez de criar um card vazio e mandar a pessoa até a outra seção preencher,
 * carrega os campos do board de destino e cria o card já preenchido, na 1ª etapa.
 * As demais ações da automação (definir_campo/mover_fase/etc.) rodam no card de origem.
 */
function AcaoCriarCardModal({
  open, onClose, automacao, quadroOrigem, cardOrigem, onDone,
}: {
  open: boolean;
  onClose: () => void;
  automacao: QuadroAutomacao;
  quadroOrigem: Quadro;
  cardOrigem: QuadroCard;
  onDone: () => void | Promise<void>;
}) {
  const { userId, filial } = useData();
  const toast = useToast();

  const acaoCriar = React.useMemo(
    () => automacao.config.acoes.find((a) => a.tipo === "criar_card" && a.quadro_destino),
    [automacao],
  );

  const [loading, setLoading] = React.useState(true);
  const [destNome, setDestNome] = React.useState("");
  const [destCampos, setDestCampos] = React.useState<QuadroCampo[]>([]);
  const [primeiraFase, setPrimeiraFase] = React.useState("");

  const [titulo, setTitulo] = React.useState(cardOrigem.titulo ?? "");
  const [valor, setValor] = React.useState<string>(
    acaoCriar?.copiar_valor && cardOrigem.valor ? String(cardOrigem.valor) : "",
  );
  const [prioridade, setPrioridade] = React.useState(cardOrigem.prioridade ?? "");
  const [prazo, setPrazo] = React.useState(cardOrigem.prazo ?? "");
  const [valores, setValores] = React.useState<Record<string, unknown>>({});
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    const destino = acaoCriar?.quadro_destino;
    if (!destino) return;
    let ativo = true;
    (async () => {
      const supabase = createClient();
      const [q, c, f] = await Promise.all([
        supabase.from("quadros").select("nome").eq("id", destino).maybeSingle(),
        supabase.from("quadro_campos").select("*").eq("quadro_id", destino).order("ordem"),
        supabase.from("quadro_fases").select("nome").eq("quadro_id", destino).order("ordem").limit(1).maybeSingle(),
      ]);
      if (!ativo) return;
      setDestNome((q.data as { nome: string } | null)?.nome ?? "");
      setDestCampos((c.data as QuadroCampo[]) ?? []);
      setPrimeiraFase((f.data as { nome: string } | null)?.nome ?? "");
      setLoading(false);
    })();
    return () => { ativo = false; };
  }, [acaoCriar]);

  function setCampo(chave: string, v: unknown) {
    setValores((prev) => ({ ...prev, [chave]: v }));
  }

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (!acaoCriar?.quadro_destino) return;
    const erro = validarObrigatorios(destCampos, valores, titulo);
    if (erro) { toast(erro, "error"); return; }
    if (!primeiraFase) { toast("O board de destino não tem fases configuradas.", "error"); return; }
    setSaving(true);
    const supabase = createClient();

    // 1) cria o card já preenchido na 1ª etapa do board de destino
    const { error } = await supabase.from("quadro_cards").insert([{
      quadro_id: acaoCriar.quadro_destino,
      titulo: titulo.trim() || cardOrigem.titulo || "Solicitação",
      fase: primeiraFase,
      valor: parseFloat(valor) || 0,
      responsavel: cardOrigem.responsavel,
      prioridade: prioridade || null,
      prazo: prazo || null,
      origem: acaoCriar.origem ?? "vinculo",
      filial: cardOrigem.filial ?? filial ?? "Matriz",
      valores: {
        ...valores,
        card_origem: `${quadroOrigem.nome} · ${cardOrigem.titulo ?? cardOrigem.id.slice(0, 8)}`,
        card_origem_id: cardOrigem.id,
        card_origem_quadro: quadroOrigem.id,
      },
      created_by: userId,
    }]);
    if (error) { setSaving(false); toast("Erro: " + error.message, "error"); return; }

    // 2) roda as demais ações (definir_campo/mover_fase/notificar) no card de origem
    const restante = {
      ...automacao,
      config: { ...automacao.config, acoes: automacao.config.acoes.filter((a) => a.tipo !== "criar_card") },
    };
    if (restante.config.acoes.length) {
      await runBotao(quadroOrigem.id, quadroOrigem.nome, restante, cardOrigem);
    }

    setSaving(false);
    await onDone();
  }

  return (
    <Modal open={open} onClose={onClose} title={automacao.config.label ?? automacao.nome} className="max-w-xl">
      <form onSubmit={enviar}>
        <ModalBody>
          {loading ? (
            <p className="text-sm text-muted">Carregando formulário…</p>
          ) : (
            <>
              <p className="text-[13px] text-muted">
                Preencha e o card será criado direto em{" "}
                <span className="font-medium text-foreground">{destNome || "destino"}</span>
                {primeiraFase && <> (etapa <span className="font-medium text-foreground">{primeiraFase}</span>)</>}.
              </p>
              <div>
                <Label>Título *</Label>
                <Input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Título" autoFocus />
              </div>
              <div className="grid grid-cols-2 gap-4">
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
                  <Label>Valor (R$)</Label>
                  <Input type="number" step="0.01" min="0" value={valor} onChange={(e) => setValor(e.target.value)} />
                </div>
                <div>
                  <Label>Prazo</Label>
                  <Input type="date" value={prazo} onChange={(e) => setPrazo(e.target.value)} />
                </div>
              </div>
              {destCampos.length > 0 && (
                <div className="border-t border-border pt-4 space-y-4">
                  {destCampos.map((campo) => (
                    <div key={campo.id}>
                      <Label>{campo.label}{campo.obrigatorio && " *"}</Label>
                      <CampoInput campo={campo} value={valores[campo.chave]} onChange={(v) => setCampo(campo.chave, v)} />
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </ModalBody>
        <ModalFooter>
          <Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button type="submit" disabled={saving || loading}>{saving ? "Enviando..." : "Criar e enviar"}</Button>
        </ModalFooter>
      </form>
    </Modal>
  );
}
