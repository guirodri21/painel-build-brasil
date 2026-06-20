import { createClient } from "@/lib/supabase/client";
import { notificarAdmins } from "@/lib/notifications";

/** Eventos que podem disparar webhooks de saída. */
export const EVENTOS = [
  { id: "ordem.criada", label: "Ordem criada" },
  { id: "ordem.atualizada", label: "Ordem atualizada" },
  { id: "meta.criada", label: "Meta criada" },
  { id: "meta.atualizada", label: "Meta atualizada" },
  { id: "estoque.baixo", label: "Estoque abaixo do mínimo" },
  { id: "chamado.critico", label: "Chamado crítico (alta prioridade / recusado)" },
  { id: "chamado.criado", label: "Chamado criado (envia ao Goalfy)" },
  { id: "chamado.atualizado", label: "Chamado atualizado (envia ao Goalfy)" },
] as const;

export type EventoId = (typeof EVENTOS)[number]["id"];

/** URL pública da API de entrada (Edge Function ingest). */
export function ingestUrl(): string {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  return `${base}/functions/v1/ingest`;
}

/** URL pública do webhook de WhatsApp (Edge Function whatsapp-inbound). */
export function whatsappInboundUrl(): string {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  return `${base}/functions/v1/whatsapp-inbound`;
}

/**
 * Dispara os webhooks de saída inscritos no evento. Fire-and-forget:
 * nunca interrompe o fluxo de salvar — falhas ficam só no log de integrações.
 */
export function fireEvent(evento: EventoId, payload: Record<string, unknown>): void {
  try {
    createClient()
      .functions.invoke("integracoes", { body: { action: "dispatch", evento, payload } })
      .catch(() => {});
  } catch {
    /* ignora */
  }
}

/** Dispara alerta (WhatsApp + in-app) quando um chamado é/vira crítico:
 *  prioridade Alta ou foi para uma fase de recusa. */
export function alertarChamadoCritico(
  c: { titulo?: string | null; cliente?: string | null; regiao?: string | null; prioridade?: string | null; ticket_ref?: string | null; fase?: string | null },
  faseAnterior?: string | null,
): void {
  const prioAlta = (c.prioridade ?? "").toLowerCase().startsWith("alta");
  const recusou = (c.fase ?? "").toLowerCase().includes("recus") && faseAnterior !== c.fase;
  if (!prioAlta && !recusou) return;
  const titulo = recusou ? "Chamado recusado" : "Chamado de alta prioridade";
  fireEvent("chamado.critico", {
    titulo, cliente: c.cliente, regiao: c.regiao, prioridade: c.prioridade, ticket_ref: c.ticket_ref, fase: c.fase,
  });
  notificarAdmins(titulo, `${c.cliente ?? c.titulo ?? "Chamado"} — ${c.regiao ?? ""} (${c.fase ?? ""})`.trim(), "/chamados");
}

/** Dispara alerta de estoque baixo se o saldo novo cruzar o mínimo. */
export function alertarSeEstoqueBaixo(
  produto: { nome: string; estoque_minimo: number; unidade: string },
  saldoNovo: number,
): void {
  if (saldoNovo <= produto.estoque_minimo) {
    fireEvent("estoque.baixo", {
      produto: produto.nome,
      saldo: saldoNovo,
      minimo: produto.estoque_minimo,
      unidade: produto.unidade,
    });
    notificarAdmins(
      "Estoque baixo",
      `${produto.nome}: saldo ${saldoNovo} ${produto.unidade} (mín. ${produto.estoque_minimo}).`,
      "/estoque",
    );
  }
}
