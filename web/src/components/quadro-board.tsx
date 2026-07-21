"use client";

import * as React from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useData } from "@/components/data-provider";
import { useToast } from "@/components/ui/toast";
import { PageHeader } from "@/components/page-header";
import { KpiCard } from "@/components/kpi-card";
import { KpiSkeletonRow, Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input, Select } from "@/components/ui/field";
import { QuadroCardModal } from "@/components/quadro-card-modal";
import { QuadroConfig } from "@/components/quadro-config";
import { ConfirmDialog } from "@/components/ui/confirm";
import { DOT, runAutomacoes, validarBloqueio, formatCampoValor, codigoCard, NOME_PIPELINE_OPERACIONAL } from "@/lib/quadros";
import { sum } from "@/lib/analytics";
import { formatCurrency, formatNumber, todayISO, cn } from "@/lib/utils";
import type { Quadro, QuadroFase, QuadroCampo, QuadroCard, QuadroAutomacao, QuadroFormulario } from "@/lib/types";
import { Plus, Search, Layers, DollarSign, AlertTriangle, Clock, ArrowLeft, Settings, CheckSquare, Square, Trash2, X } from "lucide-react";

type Aba = "board" | "config";

function prioTone(p: string | null | undefined): "red" | "yellow" | "gray" {
  const v = (p ?? "").toLowerCase();
  if (v.startsWith("alta")) return "red";
  if (v.startsWith("méd") || v.startsWith("med")) return "yellow";
  return "gray";
}
function diasDesde(iso?: string | null): number | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  return Math.floor((Date.now() - d.getTime()) / 86400000);
}
function agingTone(d: number): "red" | "orange" | "yellow" | "gray" {
  if (d >= 14) return "red";
  if (d >= 7) return "orange";
  if (d >= 3) return "yellow";
  return "gray";
}

/**
 * Board configurável (estilo Goalfy) de um quadro. Reutilizado pela rota
 * genérica /quadros/[id] e pela tela Pipeline Operacional (/operacoes/pipeline).
 */
export function QuadroBoard({
  quadroId,
  backHref,
  backLabel = "Voltar",
  subtituloFallback = "Quadro configurável",
}: {
  quadroId: string;
  backHref?: string;
  backLabel?: string;
  subtituloFallback?: string;
}) {
  const { isAdmin } = useData();
  const toast = useToast();

  const [quadro, setQuadro] = React.useState<Quadro | null>(null);
  const [fases, setFases] = React.useState<QuadroFase[]>([]);
  const [campos, setCampos] = React.useState<QuadroCampo[]>([]);
  const [automacoes, setAutomacoes] = React.useState<QuadroAutomacao[]>([]);
  const [formularios, setFormularios] = React.useState<QuadroFormulario[]>([]);
  const [cards, setCards] = React.useState<QuadroCard[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [naoExiste, setNaoExiste] = React.useState(false);

  const [aba, setAba] = React.useState<Aba>("board");
  const [busca, setBusca] = React.useState("");
  const [fResp, setFResp] = React.useState("");
  const [fPrio, setFPrio] = React.useState("");
  const [dragId, setDragId] = React.useState<string | null>(null);
  const [overFase, setOverFase] = React.useState<string | null>(null);
  const [modal, setModal] = React.useState(false);
  const [edit, setEdit] = React.useState<QuadroCard | null>(null);
  const [faseNova, setFaseNova] = React.useState<string | undefined>();

  // Modo de seleção (admin): escolher cards para mover/excluir em massa.
  const [selMode, setSelMode] = React.useState(false);
  const [sel, setSel] = React.useState<Set<string>>(new Set());
  const [confirmDel, setConfirmDel] = React.useState(false);
  const [excluindo, setExcluindo] = React.useState(false);
  const [moverPara, setMoverPara] = React.useState("");
  const [movendo, setMovendo] = React.useState(false);

  // Callbacks estáveis (useCallback) para permitir memoizar os cards do board.
  const toggleSel = React.useCallback((id: string) => {
    setSel((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  }, []);
  const onDragStartCard = React.useCallback((id: string) => setDragId(id), []);
  const onDragEndCard = React.useCallback(() => { setDragId(null); setOverFase(null); }, []);
  // Marca/desmarca de uma vez todos os cards de uma coluna (fase).
  function toggleColuna(ids: string[]) {
    setSel((prev) => {
      const n = new Set(prev);
      const todos = ids.length > 0 && ids.every((id) => n.has(id));
      if (todos) ids.forEach((id) => n.delete(id));
      else ids.forEach((id) => n.add(id));
      return n;
    });
  }
  function sairSelecao() { setSelMode(false); setSel(new Set()); setMoverPara(""); }

  const carregar = React.useCallback(async () => {
    const supabase = createClient();
    const [q, f, c, a, fm, cd] = await Promise.all([
      supabase.from("quadros").select("*").eq("id", quadroId).single(),
      supabase.from("quadro_fases").select("*").eq("quadro_id", quadroId).order("ordem"),
      supabase.from("quadro_campos").select("*").eq("quadro_id", quadroId).order("ordem"),
      supabase.from("quadro_automacoes").select("*").eq("quadro_id", quadroId).order("ordem"),
      supabase.from("quadro_formularios").select("*").eq("quadro_id", quadroId).order("created_at"),
      supabase.from("quadro_cards").select("*").eq("quadro_id", quadroId).order("ordem_coluna").order("created_at"),
    ]);
    if (q.error || !q.data) { setNaoExiste(true); setLoading(false); return; }
    setQuadro(q.data as Quadro);
    setFases((f.data as QuadroFase[]) ?? []);
    setCampos((c.data as QuadroCampo[]) ?? []);
    setAutomacoes((a.data as QuadroAutomacao[]) ?? []);
    setFormularios((fm.data as QuadroFormulario[]) ?? []);
    setCards((cd.data as QuadroCard[]) ?? []);
    setLoading(false);
  }, [quadroId]);

  // carregar() só faz setState após await (carga assíncrona), não sincronamente.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  React.useEffect(() => { carregar(); }, [carregar]);

  // Realtime: recarrega ao detectar mudança nos cards deste quadro
  React.useEffect(() => {
    const supabase = createClient();
    let timer: ReturnType<typeof setTimeout>;
    const ch = supabase
      .channel(`quadro-${quadroId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "quadro_cards", filter: `quadro_id=eq.${quadroId}` },
        () => { clearTimeout(timer); timer = setTimeout(carregar, 500); })
      .subscribe();
    return () => { clearTimeout(timer); supabase.removeChannel(ch); };
  }, [quadroId, carregar]);

  const camposCard = React.useMemo(() => campos.filter((c) => c.mostrar_no_card), [campos]);
  const fasesFinais = React.useMemo(() => new Set(fases.filter((f) => f.final).map((f) => f.nome)), [fases]);
  const responsaveis = React.useMemo(() => Array.from(new Set(cards.map((c) => c.responsavel).filter(Boolean))).sort() as string[], [cards]);
  const prioridades = React.useMemo(() => Array.from(new Set(cards.map((c) => c.prioridade).filter(Boolean))).sort() as string[], [cards]);

  const filtrados = React.useMemo(() => {
    const ql = busca.trim().toLowerCase();
    return cards.filter((c) => {
      if (fResp && c.responsavel !== fResp) return false;
      if (fPrio && c.prioridade !== fPrio) return false;
      if (!ql) return true;
      const extra = Object.values(c.valores ?? {}).filter((v) => typeof v === "string").join(" ");
      return [c.titulo, c.responsavel, extra].filter(Boolean).join(" ").toLowerCase().includes(ql);
    });
  }, [cards, busca, fResp, fPrio]);

  const colunas = React.useMemo(() => {
    const nomes = fases.map((f) => f.nome);
    const extras = Array.from(new Set(filtrados.map((c) => c.fase).filter((f) => !nomes.includes(f))));
    return [...fases.map((f) => ({ nome: f.nome, cor: f.cor ?? "gray" })),
            ...extras.map((n) => ({ nome: n, cor: "gray" }))];
  }, [fases, filtrados]);

  const porFase = React.useMemo(() => {
    const m = new Map<string, QuadroCard[]>();
    for (const c of filtrados) { const arr = m.get(c.fase) ?? []; arr.push(c); m.set(c.fase, arr); }
    return m;
  }, [filtrados]);

  const emAberto = filtrados.filter((c) => !fasesFinais.has(c.fase));
  const valorTotal = sum(emAberto, (c) => c.valor);
  const hoje = todayISO();
  const atrasado = (c: QuadroCard) => !!c.prazo && c.prazo < hoje && !fasesFinais.has(c.fase);
  const atrasados = emAberto.filter(atrasado).length;

  async function moverFase(fase: string) {
    const id = dragId;
    setDragId(null); setOverFase(null);
    if (!id || !quadro) return;
    const atual = cards.find((c) => c.id === id);
    if (!atual || atual.fase === fase) return;
    // Gate de fase: bloqueia o avanço se as condições não forem atendidas.
    const bloqueio = validarBloqueio(automacoes, fase, atual.valores, atual.valor);
    if (bloqueio) { toast(bloqueio, "error"); return; }
    const { error } = await createClient().from("quadro_cards").update({ fase }).eq("id", id);
    if (error) { toast("Erro ao mover: " + error.message, "error"); return; }
    const feitos = await runAutomacoes(quadro.id, quadro.nome, automacoes, { ...atual, fase }, "card_movido");
    await carregar();
    toast(feitos.length ? `Movido. Automações: ${feitos.join(", ")}` : `Movido para "${fase}".`);
  }

  function abrir(c: QuadroCard | null, fase?: string) { setEdit(c); setFaseNova(fase); setModal(true); }
  const abrirCard = React.useCallback((c: QuadroCard) => { setEdit(c); setFaseNova(undefined); setModal(true); }, []);

  // Seleção efetiva = só o que está visível (respeita filtros): mover/excluir
  // nunca atinge cards fora da tela e o contador reflete o real.
  const idsVisiveis = React.useMemo(() => new Set(filtrados.map((c) => c.id)), [filtrados]);
  const selVisivel = React.useMemo(() => {
    const s = new Set<string>();
    for (const id of sel) if (idsVisiveis.has(id)) s.add(id);
    return s;
  }, [sel, idsVisiveis]);

  function selecionarTodos() { setSel(new Set(filtrados.map((c) => c.id))); }
  function limparSel() { setSel(new Set()); }

  async function excluirSelecionados() {
    setConfirmDel(false);
    const ids = Array.from(selVisivel);
    if (!ids.length) return;
    setExcluindo(true);
    const supabase = createClient();
    let ok = 0; let err: string | null = null;
    for (let i = 0; i < ids.length; i += 100) {
      const lote = ids.slice(i, i + 100);
      const { data, error } = await supabase.from("quadro_cards").delete().in("id", lote).select("id");
      if (error) { err = error.message; break; }
      ok += data?.length ?? 0;
    }
    setExcluindo(false);
    if (err) { toast("Erro ao excluir: " + err, "error"); return; }
    await carregar();
    setSel(new Set());
    setSelMode(false);
    // Sem admin, a RLS só apaga os cards do próprio usuário — avisa o que ficou.
    const faltou = ids.length - ok;
    toast(faltou > 0
      ? `${ok} excluído(s); ${faltou} sem permissão (só o autor ou admin apaga).`
      : `${ok} card(s) excluído(s).`);
  }

  // Move em massa os selecionados para uma fase existente (movimento direto de admin,
  // sem gates de bloqueio nem automações — estas seguem no arraste individual).
  async function moverSelecionados() {
    const ids = Array.from(selVisivel);
    if (!ids.length || !moverPara) return;
    setMovendo(true);
    const supabase = createClient();
    let ok = 0; let err: string | null = null;
    for (let i = 0; i < ids.length; i += 100) {
      const lote = ids.slice(i, i + 100);
      const { data, error } = await supabase.from("quadro_cards").update({ fase: moverPara }).in("id", lote).select("id");
      if (error) { err = error.message; break; }
      ok += data?.length ?? 0;
    }
    setMovendo(false);
    if (err) { toast("Erro ao mover: " + err, "error"); return; }
    await carregar();
    setSel(new Set());
    setMoverPara("");
    toast(`${ok} card(s) movido(s) para "${moverPara}".`);
  }

  // No Pipeline Operacional os cards nascem só a partir do Comercial — sem criação manual.
  const bloqueiaCriacao = quadro?.nome === NOME_PIPELINE_OPERACIONAL;

  if (loading)
    return (<><PageHeader title="Quadro" /><KpiSkeletonRow count={3} /><Skeleton className="h-96" /></>);

  if (naoExiste)
    return (
      <div className="rounded-xl border border-border bg-surface p-10 text-center">
        <p className="text-sm text-muted">Quadro não encontrado.</p>
        {backHref && <Link href={backHref} className="text-primary text-sm font-medium mt-2 inline-block">← {backLabel}</Link>}
      </div>
    );

  return (
    <>
      <PageHeader title={quadro!.nome} subtitle={quadro!.descricao ?? subtituloFallback}>
        {backHref && <Link href={backHref}><Button variant="ghost"><ArrowLeft size={16} /> {backLabel}</Button></Link>}
        {aba === "board" && fases.length > 0 && (
          <Button variant={selMode ? "primary" : "secondary"} onClick={() => (selMode ? sairSelecao() : setSelMode(true))}>
            <CheckSquare size={16} /> {selMode ? "Cancelar seleção" : "Selecionar"}
          </Button>
        )}
        {aba === "board" && !bloqueiaCriacao && <Button onClick={() => abrir(null)}><Plus size={16} /> Novo card</Button>}
      </PageHeader>

      <div className="flex flex-wrap items-center gap-2 mb-4">
        {aba === "board" && (
          <>
            <div className="relative">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" />
              <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar..." className="pl-8 w-48" />
            </div>
            {responsaveis.length > 0 && (
              <Select value={fResp} onChange={(e) => setFResp(e.target.value)} className="w-44">
                <option value="">Todos responsáveis</option>{responsaveis.map((r) => <option key={r} value={r}>{r}</option>)}
              </Select>
            )}
            {prioridades.length > 0 && (
              <Select value={fPrio} onChange={(e) => setFPrio(e.target.value)} className="w-36">
                <option value="">Toda prioridade</option>{prioridades.map((p) => <option key={p} value={p}>{p}</option>)}
              </Select>
            )}
          </>
        )}
        <div className="flex-1" />
        <div className="flex gap-1 border border-border rounded-lg p-0.5">
          <TabBtn active={aba === "board"} onClick={() => setAba("board")}>Board</TabBtn>
          {isAdmin && <TabBtn active={aba === "config"} onClick={() => setAba("config")}><Settings size={13} className="inline mr-1 -mt-0.5" />Configurar</TabBtn>}
        </div>
      </div>

      {aba === "config" && isAdmin ? (
        <QuadroConfig
          quadro={quadro!} fases={fases} campos={campos} automacoes={automacoes} formularios={formularios}
          onChange={carregar}
        />
      ) : (
        <>
          {selMode && (
            <div className="flex flex-wrap items-center gap-2 mb-3 rounded-lg border border-primary/40 bg-primary-soft/20 px-3 py-2">
              <span className="text-sm font-medium">{selVisivel.size} selecionado(s)</span>
              <Button variant="secondary" size="sm" onClick={selecionarTodos}>Selecionar todos ({filtrados.length})</Button>
              <Button variant="secondary" size="sm" onClick={limparSel} disabled={!selVisivel.size}>Limpar</Button>
              <div className="flex-1" />
              <div className="flex items-center gap-1.5">
                <Select value={moverPara} onChange={(e) => setMoverPara(e.target.value)} className="h-8 w-44 text-xs" disabled={!selVisivel.size || movendo}>
                  <option value="">Mover para…</option>
                  {fases.map((f) => <option key={f.id} value={f.nome}>{f.nome}</option>)}
                </Select>
                <Button variant="secondary" size="sm" onClick={moverSelecionados} disabled={!selVisivel.size || !moverPara || movendo}>
                  {movendo ? "Movendo..." : "Mover"}
                </Button>
              </div>
              <Button variant="danger" size="sm" onClick={() => setConfirmDel(true)} disabled={!selVisivel.size || excluindo}>
                <Trash2 size={14} /> {excluindo ? "Excluindo..." : "Excluir selecionados"}
              </Button>
              <Button variant="secondary" size="sm" onClick={sairSelecao}><X size={14} /> Sair</Button>
            </div>
          )}

          <div className="stagger grid gap-3 mb-4 grid-cols-2 lg:grid-cols-3">
            <KpiCard label="Em aberto" value={emAberto.length} format={(n) => formatNumber(n)} tone="teal" icon={Layers} />
            <KpiCard label="Atrasados" value={atrasados} format={(n) => formatNumber(n)} tone={atrasados > 0 ? "red" : "default"} icon={AlertTriangle} />
            <KpiCard label="Pipeline (valor)" value={valorTotal} format={(n) => formatCurrency(n)} tone="green" icon={DollarSign} />
          </div>

          {fases.length === 0 ? (
            <div className="rounded-xl border border-border bg-surface p-10 text-center">
              <p className="text-sm text-muted">Este quadro ainda não tem fases. {isAdmin ? "Adicione fases na aba Configurar." : "Peça a um administrador para configurar."}</p>
            </div>
          ) : (
            <div className="overflow-x-auto pb-3">
              <div className="flex gap-3 min-w-max">
                {colunas.map((col) => {
                  const items = porFase.get(col.nome) ?? [];
                  const total = sum(items, (c) => c.valor);
                  return (
                    <div key={col.nome}
                      onDragOver={(e) => { e.preventDefault(); setOverFase(col.nome); }}
                      onDragLeave={() => setOverFase((f) => (f === col.nome ? null : f))}
                      onDrop={() => moverFase(col.nome)}
                      className={cn("w-72 shrink-0 rounded-xl border bg-surface-2/40 flex flex-col transition-colors",
                        overFase === col.nome ? "border-primary bg-primary-soft/30" : "border-border")}>
                      <div className="flex items-center justify-between gap-2 px-3 py-2.5 border-b border-border">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className={cn("h-2.5 w-2.5 rounded-full shrink-0", DOT[col.cor] ?? "bg-muted")} />
                          <span className="text-sm font-semibold truncate">{col.nome}</span>
                          <span className="text-xs text-muted tabular-nums">{items.length}</span>
                        </div>
                        {selMode ? (
                          items.length > 0 && (
                            <button type="button" onClick={() => toggleColuna(items.map((c) => c.id))}
                              className="shrink-0 text-muted hover:text-foreground cursor-pointer" title="Selecionar/limpar esta fase">
                              {items.every((c) => sel.has(c.id)) ? <CheckSquare size={15} className="text-primary" /> : <Square size={15} />}
                            </button>
                          )
                        ) : (
                          !bloqueiaCriacao && <button onClick={() => abrir(null, col.nome)} className="text-muted hover:text-primary cursor-pointer" title="Novo card aqui"><Plus size={14} /></button>
                        )}
                      </div>
                      <div className="p-2 space-y-2 flex-1 max-h-[64vh] overflow-y-auto">
                        {items.map((c) => (
                          <CardQuadro key={c.id} c={c}
                            selMode={selMode}
                            selected={sel.has(c.id)}
                            atrasado={atrasado(c)}
                            dias={fasesFinais.has(c.fase) ? null : diasDesde(c.fase_desde ?? c.created_at)}
                            dragging={dragId === c.id}
                            prefixo={quadro?.prefixo}
                            camposCard={camposCard}
                            onOpen={abrirCard}
                            onToggle={toggleSel}
                            onDragStart={onDragStartCard}
                            onDragEnd={onDragEndCard} />
                        ))}
                        {items.length === 0 && <div className="text-center py-6 text-[11px] text-muted">—</div>}
                      </div>
                      {total > 0 && (
                        <div className="px-3 py-2 border-t border-border text-[11px] text-muted flex justify-between">
                          <span>Total</span><span className="font-medium text-foreground tabular-nums">{formatCurrency(total)}</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}

      {modal && quadro && (
        <QuadroCardModal
          open={modal} onClose={() => { setModal(false); setEdit(null); setFaseNova(undefined); }}
          quadro={quadro} fases={fases} campos={campos} automacoes={automacoes}
          card={edit} faseInicial={faseNova} onSaved={carregar}
        />
      )}

      <ConfirmDialog
        open={confirmDel}
        title="Excluir cards selecionados"
        message={`Excluir ${selVisivel.size} card(s) selecionado(s)? Não dá para desfazer.`}
        confirmLabel="Excluir"
        onConfirm={excluirSelecionados}
        onCancel={() => setConfirmDel(false)}
      />
    </>
  );
}

/**
 * Card do board, memoizado: só re-renderiza quando muda algo dele (seleção,
 * atraso, arraste). Evita re-render de todos os cards a cada clique de seleção.
 */
const CardQuadro = React.memo(function CardQuadro({
  c, selMode, selected, atrasado, dias, dragging, prefixo, camposCard, onOpen, onToggle, onDragStart, onDragEnd,
}: {
  c: QuadroCard;
  selMode: boolean;
  selected: boolean;
  atrasado: boolean;
  dias: number | null;
  dragging: boolean;
  prefixo: string | null | undefined;
  camposCard: QuadroCampo[];
  onOpen: (c: QuadroCard) => void;
  onToggle: (id: string) => void;
  onDragStart: (id: string) => void;
  onDragEnd: () => void;
}) {
  const t = dias != null ? agingTone(dias) : null;
  const cod = codigoCard(prefixo, c.numero);
  const com = c.valores?.origem_com;
  return (
    <button onClick={() => (selMode ? onToggle(c.id) : onOpen(c))}
      draggable={!selMode}
      onDragStart={() => { if (!selMode) onDragStart(c.id); }}
      onDragEnd={onDragEnd}
      className={cn("w-full text-left rounded-lg border bg-surface p-2.5 transition-all",
        selMode ? "cursor-pointer" : "hover:border-border-strong cursor-grab active:cursor-grabbing",
        dragging && "opacity-40",
        selMode && selected ? "border-primary ring-2 ring-primary bg-primary-soft/20"
          : atrasado ? "border-l-4 border-l-red border-border" : "border-border")}>
      <div className="flex items-center justify-between gap-2 mb-1">
        <span className="flex items-center gap-1.5 min-w-0">
          {selMode && (selected
            ? <CheckSquare size={14} className="text-primary shrink-0" />
            : <Square size={14} className="text-muted shrink-0" />)}
          <span className="text-sm font-medium truncate">{c.titulo || "Card"}</span>
        </span>
        {c.prioridade && <Badge tone={prioTone(c.prioridade)}>{c.prioridade}</Badge>}
      </div>
      {(cod || com) ? (
        <p className="text-[10px] text-muted font-mono mb-0.5">
          {cod}{com ? <span className="text-muted/70"> · ← {String(com)}</span> : null}
        </p>
      ) : null}
      {c.responsavel && <p className="text-[11px] text-muted">{c.responsavel}</p>}
      {camposCard.map((campo) => {
        const v = c.valores?.[campo.chave];
        if (v == null || v === "" || v === false) return null;
        return <p key={campo.id} className="text-[11px] text-muted truncate"><span className="font-medium text-foreground">{campo.label}:</span> {formatCampoValor(campo.tipo, v)}</p>;
      })}
      <div className="flex items-center justify-between mt-1.5 text-[11px] text-muted">
        {dias != null && t ? (
          <span className={cn("flex items-center gap-0.5", t === "red" && "text-red", t === "orange" && "text-orange", t === "yellow" && "text-yellow")}>
            <Clock size={10} /> {dias}d
          </span>
        ) : <span />}
        {c.valor > 0 && <span className="font-medium text-foreground">{formatCurrency(c.valor)}</span>}
      </div>
    </button>
  );
});

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className={cn("px-3 py-1 text-sm font-medium rounded-md transition-colors cursor-pointer", active ? "bg-primary text-primary-fg" : "text-muted hover:text-foreground")}>
      {children}
    </button>
  );
}
