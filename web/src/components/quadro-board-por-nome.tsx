"use client";

import * as React from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { QuadroBoard } from "@/components/quadro-board";
import { PageHeader } from "@/components/page-header";
import { KpiSkeletonRow, Skeleton } from "@/components/ui/skeleton";

/**
 * Resolve um quadro pelo nome e renderiza seu board. Usado pelas telas fixas da
 * área Operacional (Pipeline, Frota, Preventivas, Patrimônio) que apontam para
 * um board configurável criado por seed.
 */
export function QuadroBoardPorNome({ nome, subtitulo }: { nome: string; subtitulo: string }) {
  const [quadroId, setQuadroId] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    createClient()
      .from("quadros")
      .select("id")
      .eq("nome", nome)
      .eq("ativo", true)
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        setQuadroId((data as { id: string } | null)?.id ?? null);
        setLoading(false);
      });
  }, [nome]);

  if (loading)
    return (
      <>
        <PageHeader title={nome} />
        <KpiSkeletonRow count={3} />
        <Skeleton className="h-96" />
      </>
    );

  if (!quadroId)
    return (
      <>
        <PageHeader title={nome} subtitle={subtitulo} />
        <div className="rounded-xl border border-border bg-surface p-10 text-center">
          <p className="text-sm text-muted">
            O quadro <strong>{nome}</strong> ainda não foi criado neste ambiente.
          </p>
          <Link href="/quadros" className="text-primary text-sm font-medium mt-2 inline-block">
            Ir para Quadros →
          </Link>
        </div>
      </>
    );

  return <QuadroBoard quadroId={quadroId} subtituloFallback={subtitulo} />;
}
