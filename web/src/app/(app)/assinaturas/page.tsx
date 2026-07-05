"use client";

import * as React from "react";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/ui/toast";
import { PageHeader } from "@/components/page-header";
import { KpiCard } from "@/components/kpi-card";
import { KpiSkeletonRow, Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn, formatDate } from "@/lib/utils";
import type { Assinatura } from "@/lib/types";
import { Users, DollarSign, Clock, CheckCircle2, ExternalLink, Copy, Link2 } from "lucide-react";

type Tone = "green" | "gray" | "orange" | "red" | "blue";

const STATUS: Record<string, { label: string; tone: Tone }> = {
  ativa: { label: "Ativa", tone: "green" },
  aguardando_pagamento: { label: "Aguardando pagamento", tone: "orange" },
  cancelada: { label: "Cancelada", tone: "red" },
};

const EMAIL_TONE: Record<string, Tone> = { enviado: "green", simulado: "blue", erro: "red" };

export default function AssinaturasPage() {
  const toast = useToast();
  const supabase = React.useMemo(() => createClient(), []);
  const [lista, setLista] = React.useState<Assinatura[] | null>(null);

  React.useEffect(() => {
    let ativo = true;
    (async () => {
      const { data } = await supabase.from("assinaturas").select("*").order("created_at", { ascending: false });
      if (ativo) setLista((data as Assinatura[]) ?? []);
    })();
    return () => { ativo = false; };
  }, [supabase]);

  const kpis = React.useMemo(() => {
    const l = lista ?? [];
    const ativas = l.filter((a) => a.status === "ativa");
    const aguardando = l.filter((a) => a.status === "aguardando_pagamento");
    const mrrAtivo = ativas.reduce((s, a) => s + Number(a.valor_usd || 0), 0);
    const mrrPotencial = l.filter((a) => a.status !== "cancelada").reduce((s, a) => s + Number(a.valor_usd || 0), 0);
    return { total: l.length, ativas: ativas.length, aguardando: aguardando.length, mrrAtivo, mrrPotencial };
  }, [lista]);

  const linkPublico = typeof window !== "undefined" ? `${window.location.origin}/assinar` : "/assinar";

  function copiarLink() {
    navigator.clipboard?.writeText(linkPublico).then(
      () => toast("Link copiado."),
      () => toast("Não foi possível copiar.", "error"),
    );
  }

  const usd = (n: number) => "US$ " + n.toLocaleString("pt-BR");

  if (lista === null)
    return (
      <>
        <PageHeader title="Assinaturas" subtitle="Cobrança recorrente mensal dos clientes" />
        <KpiSkeletonRow />
        <Skeleton className="h-80 mt-5" />
      </>
    );

  return (
    <>
      <PageHeader title="Assinaturas" subtitle="Cobrança recorrente mensal dos clientes (US$ 150/mês)">
        <Button variant="secondary" onClick={copiarLink}><Copy size={15} /> Copiar link</Button>
        <a href="/assinar" target="_blank" rel="noopener noreferrer">
          <Button><Link2 size={15} /> Abrir página de assinatura</Button>
        </a>
      </PageHeader>

      <div className="stagger grid gap-3 mb-5 grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Assinantes" value={kpis.total} format={(n) => Math.round(n).toString()} tone="teal" icon={Users} />
        <KpiCard label="Ativas" value={kpis.ativas} format={(n) => Math.round(n).toString()} tone="green" icon={CheckCircle2} />
        <KpiCard label="Aguardando pagamento" value={kpis.aguardando} format={(n) => Math.round(n).toString()} tone={kpis.aguardando > 0 ? "orange" : "default"} icon={Clock} />
        <KpiCard label="MRR ativo" value={kpis.mrrAtivo} format={usd} tone="green" icon={DollarSign} />
      </div>

      {kpis.mrrPotencial > kpis.mrrAtivo && (
        <p className="text-xs text-muted mb-4 -mt-2">MRR potencial (incl. aguardando): <strong className="text-foreground">{usd(kpis.mrrPotencial)}</strong>/mês</p>
      )}

      {lista.length === 0 ? (
        <div className="rounded-xl border border-border bg-surface p-10 text-center">
          <p className="text-sm text-muted">Nenhuma assinatura ainda. Compartilhe o <a href="/assinar" target="_blank" rel="noopener noreferrer" className="text-primary font-medium">link de assinatura</a> com seus clientes.</p>
        </div>
      ) : (
        <>
          {/* Desktop: tabela */}
          <div className="hidden md:block overflow-x-auto rounded-xl border border-border bg-surface">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left">
                  <Th>Empresa</Th><Th>Contato</Th><Th>Valor</Th><Th>Status</Th><Th>E-mail</Th><Th>Data</Th><Th className="text-right">Pagamento</Th>
                </tr>
              </thead>
              <tbody>
                {lista.map((a) => {
                  const st = STATUS[a.status] ?? { label: a.status, tone: "gray" as Tone };
                  return (
                    <tr key={a.id} className="border-b border-border last:border-0 hover:bg-surface-2 transition-colors">
                      <Td className="font-medium">{a.empresa}{a.simulado && <Badge tone="blue" className="ml-2">simulado</Badge>}</Td>
                      <Td>
                        <div>{a.responsavel ?? "—"}</div>
                        <div className="text-xs text-muted">{a.email}</div>
                      </Td>
                      <Td className="tabular-nums">US$ {Number(a.valor_usd).toLocaleString("pt-BR")}/mês</Td>
                      <Td><Badge tone={st.tone}>{st.label}</Badge></Td>
                      <Td><Badge tone={EMAIL_TONE[a.email_confirmacao ?? ""] ?? "gray"}>{a.email_confirmacao ?? "—"}</Badge></Td>
                      <Td className="text-muted whitespace-nowrap">{formatDate(a.created_at)}</Td>
                      <Td className="text-right">
                        {a.checkout_url
                          ? <a href={a.checkout_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary text-xs font-medium"><ExternalLink size={13} /> Abrir</a>
                          : <span className="text-muted text-xs">—</span>}
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile: cards */}
          <div className="md:hidden space-y-2">
            {lista.map((a) => {
              const st = STATUS[a.status] ?? { label: a.status, tone: "gray" as Tone };
              return (
                <div key={a.id} className="rounded-lg border border-border bg-surface p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium truncate">{a.empresa}</span>
                    <Badge tone={st.tone}>{st.label}</Badge>
                  </div>
                  <div className="mt-1.5 text-xs text-muted">{a.responsavel ? a.responsavel + " · " : ""}{a.email}</div>
                  <div className="mt-2 flex items-center justify-between text-xs">
                    <span className="tabular-nums font-medium text-foreground">US$ {Number(a.valor_usd).toLocaleString("pt-BR")}/mês</span>
                    <span className="text-muted">{formatDate(a.created_at)}</span>
                  </div>
                  {a.checkout_url && (
                    <a href={a.checkout_url} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex items-center gap-1 text-primary text-xs font-medium"><ExternalLink size={13} /> Abrir pagamento</a>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </>
  );
}

function Th({ children, className }: { children: React.ReactNode; className?: string }) {
  return <th className={cn("px-4 py-3 text-xs font-semibold text-muted uppercase tracking-wide whitespace-nowrap", className)}>{children}</th>;
}
function Td({ children, className }: { children: React.ReactNode; className?: string }) {
  return <td className={cn("px-4 py-3", className)}>{children}</td>;
}
