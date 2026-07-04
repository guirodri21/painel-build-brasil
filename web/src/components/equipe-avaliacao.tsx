"use client";

import * as React from "react";
import { createClient } from "@/lib/supabase/client";
import { Card, CardHeader, CardTitle, CardBody } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { NOME_PIPELINE_OPERACIONAL } from "@/lib/quadros";
import type { QuadroFase, QuadroCard } from "@/lib/types";

type Row = {
  tecnico: string;
  servicos: number;
  concluidos: number;
  nota: number | null;
  reclamacoes: number;
  relIncompletos: number;
  improdutivas: number;
};

function truthy(v: unknown): boolean {
  return v === true || v === "true";
}

function numOrNull(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/** Nota média (0–10): verde ≥8, amarelo ≥6, vermelho <6. */
function notaTone(n: number): "green" | "yellow" | "red" {
  return n >= 8 ? "green" : n >= 6 ? "yellow" : "red";
}

/**
 * Avaliação por Técnico (Seção 6): consolida a qualidade de execução a partir
 * dos cards do Pipeline Operacional, agrupados por técnico responsável.
 */
export function EquipeAvaliacao() {
  const [fases, setFases] = React.useState<QuadroFase[]>([]);
  const [cards, setCards] = React.useState<QuadroCard[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [semPipeline, setSemPipeline] = React.useState(false);

  React.useEffect(() => {
    let ativo = true;
    (async () => {
      const supabase = createClient();
      const { data: q } = await supabase
        .from("quadros").select("id")
        .eq("nome", NOME_PIPELINE_OPERACIONAL).eq("ativo", true).limit(1).maybeSingle();
      const quadroId = (q as { id: string } | null)?.id;
      if (!quadroId) { if (ativo) { setSemPipeline(true); setLoading(false); } return; }
      const [f, c] = await Promise.all([
        supabase.from("quadro_fases").select("*").eq("quadro_id", quadroId).order("ordem"),
        supabase.from("quadro_cards").select("*").eq("quadro_id", quadroId),
      ]);
      if (!ativo) return;
      setFases((f.data as QuadroFase[]) ?? []);
      setCards((c.data as QuadroCard[]) ?? []);
      setLoading(false);
    })();
    return () => { ativo = false; };
  }, []);

  const rows = React.useMemo<Row[]>(() => {
    const finais = new Set(fases.filter((f) => f.final).map((f) => f.nome));
    const mapa = new Map<string, { r: Row; notaSoma: number; notaN: number }>();

    for (const c of cards) {
      const nome = String(c.valores?.tecnico ?? c.responsavel ?? "").trim();
      if (!nome) continue;
      let ent = mapa.get(nome);
      if (!ent) {
        ent = { r: { tecnico: nome, servicos: 0, concluidos: 0, nota: null, reclamacoes: 0, relIncompletos: 0, improdutivas: 0 }, notaSoma: 0, notaN: 0 };
        mapa.set(nome, ent);
      }
      const concluido = finais.has(c.fase);
      ent.r.servicos++;
      if (concluido) ent.r.concluidos++;
      const nota = numOrNull(c.valores?.nota);
      if (nota != null) { ent.notaSoma += nota; ent.notaN++; }
      if (truthy(c.valores?.reclamacao)) ent.r.reclamacoes++;
      // Relatório incompleto só conta em serviço concluído sem "relatório completo".
      if (concluido && !truthy(c.valores?.relatorio_completo)) ent.r.relIncompletos++;
      if (/improdutiv/i.test(String(c.valores?.situacao ?? ""))) ent.r.improdutivas++;
    }

    return [...mapa.values()]
      .map(({ r, notaSoma, notaN }) => ({ ...r, nota: notaN ? notaSoma / notaN : null }))
      .sort((a, b) => b.servicos - a.servicos);
  }, [cards, fases]);

  if (semPipeline) return null;

  if (loading)
    return (
      <Card>
        <CardHeader><CardTitle>Avaliação por Técnico</CardTitle></CardHeader>
        <CardBody><Skeleton className="h-40" /></CardBody>
      </Card>
    );

  return (
    <Card>
      <CardHeader><CardTitle>Avaliação por Técnico</CardTitle></CardHeader>
      <CardBody className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left">
                <Th>Técnico</Th>
                <Th className="text-right">Serviços</Th>
                <Th className="text-right">Concluídos</Th>
                <Th className="text-center">Nota média</Th>
                <Th className="text-right">Reclamações</Th>
                <Th className="text-right">Rel. incompletos</Th>
                <Th className="text-right">Improdutivas</Th>
              </tr>
            </thead>
            <tbody>
              {rows.length ? rows.map((r) => (
                <tr key={r.tecnico} className="border-b border-border last:border-0 hover:bg-surface-2 transition-colors">
                  <Td className="font-medium">{r.tecnico}</Td>
                  <Td className="text-right tabular-nums">{r.servicos}</Td>
                  <Td className="text-right tabular-nums">{r.concluidos}</Td>
                  <Td className="text-center">
                    {r.nota != null ? <Badge tone={notaTone(r.nota)}>{r.nota.toFixed(1)}</Badge> : <span className="text-muted">—</span>}
                  </Td>
                  <Td className={cn("text-right tabular-nums", r.reclamacoes > 0 && "text-red font-medium")}>{r.reclamacoes}</Td>
                  <Td className={cn("text-right tabular-nums", r.relIncompletos > 0 && "text-orange font-medium")}>{r.relIncompletos}</Td>
                  <Td className={cn("text-right tabular-nums", r.improdutivas > 0 && "text-orange font-medium")}>{r.improdutivas}</Td>
                </tr>
              )) : (
                <tr><td colSpan={7} className="text-center py-10 text-muted text-sm">Sem serviços registrados por técnico ainda.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </CardBody>
    </Card>
  );
}

function Th({ children, className }: { children: React.ReactNode; className?: string }) {
  return <th className={cn("px-4 py-3 text-xs font-semibold text-muted uppercase tracking-wide whitespace-nowrap", className)}>{children}</th>;
}
function Td({ children, className }: { children: React.ReactNode; className?: string }) {
  return <td className={cn("px-4 py-3 whitespace-nowrap", className)}>{children}</td>;
}
