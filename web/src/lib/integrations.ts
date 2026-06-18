import { createClient } from "@/lib/supabase/client";

/** Eventos que podem disparar webhooks de saída. */
export const EVENTOS = [
  { id: "ordem.criada", label: "Ordem criada" },
  { id: "ordem.atualizada", label: "Ordem atualizada" },
  { id: "meta.criada", label: "Meta criada" },
  { id: "meta.atualizada", label: "Meta atualizada" },
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
