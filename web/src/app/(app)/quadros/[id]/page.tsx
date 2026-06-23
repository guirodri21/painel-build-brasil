"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
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
import { DOT, runAutomacoes, formatCampoValor } from "@/lib/quadros";
import { sum } from "@/lib/analytics";
import { formatCurrency, formatNumber, todayISO, cn } from "@/lib/utils";
import type { Quadro, QuadroFase, QuadroCampo, QuadroCard, QuadroAutomacao, QuadroFormulario } from "@/lib/types";
import { Plus, Search, Layers, DollarSign, AlertTriangle, Clock, ArrowLeft, Settings } from "lucide-react";

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

export default function QuadroBoardPage() {
  const params = useParams<{ id: string }>();
  const quadroId = params.id;
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
    const { error } = await createClient().from("quadro_cards").update({ fase }).eq("id", id);
    if (error) { toast("Erro ao mover: " + error.message, "error"); return; }
    const feitos = await runAutomacoes(quadro.id, quadro.nome, automacoes, { ...atual, fase }, "card_movido");
    await carregar();
    toast(feitos.length ? `Movido. Automações: ${feitos.join(", ")}` : `Movido para "${fase}".`);
  }

  function abrir(c: QuadroCard | null, fase?: string) { setEdit(c); setFaseNova(fase); setModal(true); }

  if (loading)
    return (<><PageHeader title="Quadro" /><KpiSkeletonRow count={3} /><Skeleton className="h-96" /></>);

  if (naoExiste)
    return (
      <div className="rounded-xl border border-border bg-surface p-10 text-center">
        <p className="text-sm text-muted">Quadro não encontrado.</p>
        <Link href="/quadros" className="text-primary text-sm font-medium mt-2 inline-block">← Voltar aos quadros</Link>
      </div>
    );

  return (
    <>
      <PageHeader title={quadro!.nome} subtitle={quadro!.descricao ?? "Quadro configurável"}>
        <Link href="/quadros"><Button variant="ghost"><ArrowLeft size={16} /> Quadros</Button></Link>
        {aba === "board" && <Button onClick={() => abrir(null)}><Plus size={16} /> Novo card</Button>}
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
                        <button onClick={() => abrir(null, col.nome)} className="text-muted hover:text-primary cursor-pointer" title="Novo card aqui"><Plus size={14} /></button>
                      </div>
                      <div className="p-2 space-y-2 flex-1 max-h-[64vh] overflow-y-auto">
                        {items.map((c) => (
                          <button key={c.id} onClick={() => abrir(c)}
                            draggable
                            onDragStart={() => setDragId(c.id)}
                            onDragEnd={() => { setDragId(null); setOverFase(null); }}
                            className={cn("w-full text-left rounded-lg border bg-surface hover:border-border-strong p-2.5 transition-all cursor-grab active:cursor-grabbing",
                              dragId === c.id && "opacity-40",
                              atrasado(c) ? "border-l-4 border-l-red border-border" : "border-border")}>
                            <div className="flex items-center justify-between gap-2 mb-1">
                              <span className="text-sm font-medium truncate">{c.titulo || "Card"}</span>
                              {c.prioridade && <Badge tone={prioTone(c.prioridade)}>{c.prioridade}</Badge>}
                            </div>
                            {c.responsavel && <p className="text-[11px] text-muted">{c.responsavel}</p>}
                            {camposCard.map((campo) => {
                              const v = c.valores?.[campo.chave];
                              if (v == null || v === "" || v === false) return null;
                              return <p key={campo.id} className="text-[11px] text-muted truncate"><span className="font-medium text-foreground">{campo.label}:</span> {formatCampoValor(campo.tipo, v)}</p>;
                            })}
                            <div className="flex items-center justify-between mt-1.5 text-[11px] text-muted">
                              {(() => {
                                const d = diasDesde(c.fase_desde ?? c.created_at);
                                if (d == null || fasesFinais.has(c.fase)) return <span />;
                                const t = agingTone(d);
                                return <span className={cn("flex items-center gap-0.5", t === "red" && "text-red", t === "orange" && "text-orange", t === "yellow" && "text-yellow")}><Clock size={10} /> {d}d</span>;
                              })()}
                              {c.valor > 0 && <span className="font-medium text-foreground">{formatCurrency(c.valor)}</span>}
                            </div>
                          </button>
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
    </>
  );
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className={cn("px-3 py-1 text-sm font-medium rounded-md transition-colors cursor-pointer", active ? "bg-primary text-primary-fg" : "text-muted hover:text-foreground")}>
      {children}
    </button>
  );
}
