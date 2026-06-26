"use client";

import * as React from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { QuadroBoard } from "@/components/quadro-board";
import { PageHeader } from "@/components/page-header";
import { KpiSkeletonRow, Skeleton } from "@/components/ui/skeleton";

const NOME_QUADRO = "Pipeline Operacional";

export default function PipelineOperacionalPage() {
  const [quadroId, setQuadroId] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    createClient()
      .from("quadros")
      .select("id")
      .eq("nome", NOME_QUADRO)
      .eq("ativo", true)
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        setQuadroId((data as { id: string } | null)?.id ?? null);
        setLoading(false);
      });
  }, []);

  if (loading)
    return (
      <>
        <PageHeader title="Pipeline Operacional" />
        <KpiSkeletonRow count={3} />
        <Skeleton className="h-96" />
      </>
    );

  if (!quadroId)
    return (
      <>
        <PageHeader title="Pipeline Operacional" subtitle="Fluxo de execução das demandas da Operação" />
        <div className="rounded-xl border border-border bg-surface p-10 text-center">
          <p className="text-sm text-muted">
            O quadro <strong>{NOME_QUADRO}</strong> ainda não foi criado neste ambiente.
          </p>
          <Link href="/quadros" className="text-primary text-sm font-medium mt-2 inline-block">
            Ir para Quadros →
          </Link>
        </div>
      </>
    );

  return <QuadroBoard quadroId={quadroId} subtituloFallback="Fluxo de execução das demandas da Operação" />;
}
