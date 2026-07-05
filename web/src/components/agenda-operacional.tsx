"use client";

import * as React from "react";
import { createClient } from "@/lib/supabase/client";
import { Card, CardHeader, CardTitle, CardBody } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn, formatDate, todayISO } from "@/lib/utils";
import { NOME_PIPELINE_OPERACIONAL } from "@/lib/quadros";
import { TECNICO_DISPONIBILIDADE } from "@/lib/types";
import type { QuadroCard } from "@/lib/types";
import { CalendarClock, UsersRound, MapPin, RotateCcw, Clock } from "lucide-react";

/** Fases do Pipeline Operacional consideradas "programação" (agendado/em campo). */
const FASES_AGENDA = ["Agendamento", "Em Execucao / Fechamento"];

type Tone = "green" | "gray" | "orange" | "red" | "blue" | "yellow";

const DISPO_TONE: Record<string, Tone> = {
  "Disponível": "green",
  "Ocupado": "blue",
  "Em viagem": "yellow",
  "Folga": "gray",
  "Indisponível": "red",
};

const FASE_TONE: Record<string, Tone> = {
  "Agendamento": "orange",
  "Em Execucao / Fechamento": "blue",
};

type Tecnico = { nome: string; disponibilidade: string };

const val = (c: QuadroCard, k: string): string => String(c.valores?.[k] ?? "").trim();

/**
 * Programação Operacional integrada ao Pipeline (Seção 3): disponibilidade da
 * equipe (Banco de Técnicos), operações agendadas por técnico, atendimentos por
 * região (cidade/UF) e reagendamentos (motivo + de/para) — tudo lido dos cards
 * do Pipeline Operacional, sem lançamento duplicado.
 */
export function AgendaOperacional() {
  const [tecnicos, setTecnicos] = React.useState<Tecnico[]>([]);
  const [cards, setCards] = React.useState<QuadroCard[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let ativo = true;
    (async () => {
      const supabase = createClient();
      const { data: q } = await supabase
        .from("quadros").select("id")
        .eq("nome", NOME_PIPELINE_OPERACIONAL).eq("ativo", true).limit(1).maybeSingle();
      const quadroId = (q as { id: string } | null)?.id;

      const [t, c] = await Promise.all([
        supabase.from("tecnicos").select("nome,disponibilidade").eq("ativo", true).order("nome"),
        quadroId
          ? supabase.from("quadro_cards").select("*").eq("quadro_id", quadroId)
          : Promise.resolve({ data: [] }),
      ]);
      if (!ativo) return;
      setTecnicos((t.data as Tecnico[]) ?? []);
      setCards((c.data as QuadroCard[]) ?? []);
      setLoading(false);
    })();
    return () => { ativo = false; };
  }, []);

  const agendaCards = React.useMemo(
    () => cards.filter((c) => FASES_AGENDA.includes(c.fase)),
    [cards],
  );

  // Técnicos agrupados por disponibilidade (ordem fixa do enum).
  const porDisponibilidade = React.useMemo(() => {
    const m = new Map<string, string[]>();
    for (const d of TECNICO_DISPONIBILIDADE) m.set(d, []);
    for (const t of tecnicos) {
      const arr = m.get(t.disponibilidade);
      if (arr) arr.push(t.nome);
      else m.set(t.disponibilidade, [t.nome]);
    }
    return [...m.entries()];
  }, [tecnicos]);

  // Operações agendadas agrupadas por técnico (Sem técnico por último).
  const porTecnico = React.useMemo(() => {
    const m = new Map<string, QuadroCard[]>();
    for (const c of agendaCards) {
      const nome = val(c, "tecnico") || (c.responsavel ?? "").trim() || "— Sem técnico —";
      const arr = m.get(nome) ?? [];
      arr.push(c);
      m.set(nome, arr);
    }
    for (const arr of m.values())
      arr.sort((a, b) => (a.prazo ?? "9999").localeCompare(b.prazo ?? "9999"));
    return [...m.entries()].sort((a, b) => {
      if (a[0].startsWith("—")) return 1;
      if (b[0].startsWith("—")) return -1;
      return a[0].localeCompare(b[0]);
    });
  }, [agendaCards]);

  // Atendimentos por região (5 regiões do Brasil) — só dos cards em programação.
  const porRegiao = React.useMemo(() => {
    const m = new Map<string, number>();
    for (const c of agendaCards) {
      const chave = val(c, "regiao") || "— Sem região —";
      m.set(chave, (m.get(chave) ?? 0) + 1);
    }
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [agendaCards]);

  // Reagendamentos — cards com trilha de reagendamento preenchida.
  const reagendamentos = React.useMemo(
    () => cards.filter((c) => val(c, "reagend_motivo") || val(c, "reagend_de") || val(c, "reagend_para")),
    [cards],
  );

  if (loading)
    return (
      <div className="grid gap-3 md:grid-cols-2">
        <Skeleton className="h-48" /><Skeleton className="h-48" />
        <Skeleton className="h-48" /><Skeleton className="h-48" />
      </div>
    );

  const hoje = todayISO();

  return (
    <div className="grid gap-3 md:grid-cols-2">
      {/* Disponibilidade da Equipe */}
      <Card>
        <CardHeader>
          <CardTitle><span className="inline-flex items-center gap-1.5"><UsersRound size={15} /> Disponibilidade da Equipe</span></CardTitle>
        </CardHeader>
        <CardBody className="space-y-2.5">
          {tecnicos.length === 0 ? (
            <p className="text-sm text-muted">Nenhum técnico no Banco de Técnicos ainda.</p>
          ) : (
            porDisponibilidade.map(([disp, nomes]) => (
              <div key={disp} className="flex items-start gap-2">
                <Badge tone={DISPO_TONE[disp] ?? "gray"} className="shrink-0 min-w-[92px] justify-center">{disp}</Badge>
                <span className="text-xs text-muted tabular-nums pt-0.5 shrink-0">{nomes.length}</span>
                <span className="text-xs pt-0.5">{nomes.length ? nomes.join(", ") : "—"}</span>
              </div>
            ))
          )}
        </CardBody>
      </Card>

      {/* Operações Agendadas por Técnico */}
      <Card>
        <CardHeader>
          <CardTitle><span className="inline-flex items-center gap-1.5"><CalendarClock size={15} /> Operações Agendadas por Técnico</span></CardTitle>
        </CardHeader>
        <CardBody className="space-y-3">
          {porTecnico.length === 0 ? (
            <p className="text-sm text-muted">Nenhuma operação em Agendamento ou Execução no Pipeline.</p>
          ) : (
            porTecnico.map(([tec, lista]) => (
              <div key={tec}>
                <div className="flex items-center justify-between text-xs font-semibold mb-1">
                  <span className="truncate pr-2">{tec}</span>
                  <span className="text-muted tabular-nums shrink-0">{lista.length}</span>
                </div>
                <div className="space-y-1">
                  {lista.map((c) => {
                    const hora = val(c, "hora");
                    return (
                      <div key={c.id} className="flex items-center gap-2 rounded-lg border border-border bg-surface-2 px-2 py-1.5">
                        {hora && <span className="inline-flex items-center gap-0.5 text-[11px] text-muted shrink-0"><Clock size={10} />{hora}</span>}
                        <span className="text-xs font-medium truncate flex-1">{c.titulo ?? "Operação"}</span>
                        {c.prazo && (
                          <span className={cn("text-[11px] tabular-nums shrink-0", c.prazo < hoje ? "text-red font-medium" : "text-muted")}>
                            {formatDate(c.prazo)}
                          </span>
                        )}
                        <Badge tone={FASE_TONE[c.fase] ?? "gray"} className="shrink-0">
                          {c.fase === "Em Execucao / Fechamento" ? "Em campo" : "Agendado"}
                        </Badge>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </CardBody>
      </Card>

      {/* Atendimentos por Região */}
      <Card>
        <CardHeader>
          <CardTitle><span className="inline-flex items-center gap-1.5"><MapPin size={15} /> Atendimentos por Região</span></CardTitle>
        </CardHeader>
        <CardBody>
          {porRegiao.length === 0 ? (
            <p className="text-sm text-muted">Sem operações em programação. Defina a Região nos cards do Pipeline.</p>
          ) : (
            <div className="space-y-2">
              {porRegiao.map(([nome, n]) => {
                const max = Math.max(1, ...porRegiao.map(([, x]) => x));
                return (
                  <div key={nome}>
                    <div className="flex items-center justify-between text-xs mb-0.5">
                      <span className="truncate pr-2">{nome}</span>
                      <span className="text-muted tabular-nums shrink-0">{n}</span>
                    </div>
                    <div className="h-2 rounded-full bg-surface-2 overflow-hidden">
                      <div className="h-full rounded-full bg-primary" style={{ width: `${Math.max(4, (n / max) * 100)}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardBody>
      </Card>

      {/* Reagendamentos */}
      <Card>
        <CardHeader>
          <CardTitle><span className="inline-flex items-center gap-1.5"><RotateCcw size={15} /> Reagendamentos</span></CardTitle>
        </CardHeader>
        <CardBody className="space-y-2">
          {reagendamentos.length === 0 ? (
            <p className="text-sm text-muted">Nenhum reagendamento registrado.</p>
          ) : (
            reagendamentos.map((c) => {
              const de = val(c, "reagend_de");
              const para = val(c, "reagend_para");
              const motivo = val(c, "reagend_motivo");
              return (
                <div key={c.id} className="rounded-lg border border-border bg-surface-2 px-2.5 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-medium truncate">{c.titulo ?? "Operação"}</span>
                    {(de || para) && (
                      <span className="text-[11px] text-muted tabular-nums shrink-0">
                        {de ? formatDate(de) : "—"} → {para ? formatDate(para) : "—"}
                      </span>
                    )}
                  </div>
                  {motivo && <p className="text-[11px] text-muted mt-0.5">{motivo}</p>}
                </div>
              );
            })
          )}
        </CardBody>
      </Card>
    </div>
  );
}
