import { createClient } from "@/lib/supabase/client";
import { notificarAdmins } from "@/lib/notifications";
import { formatCurrency, formatDate } from "@/lib/utils";
import type {
  QuadroCampo, QuadroCard, QuadroAutomacao, AutomacaoGatilho, CampoTipo,
} from "@/lib/types";

/** Cores disponíveis para fases/quadros (chaves do mapa DOT no front). */
export const CORES = ["blue", "teal", "green", "yellow", "orange", "red", "gray"] as const;
export type Cor = (typeof CORES)[number];

export const DOT: Record<string, string> = {
  blue: "bg-primary", gray: "bg-muted", teal: "bg-teal",
  yellow: "bg-yellow", orange: "bg-orange", green: "bg-green", red: "bg-red",
};

/** Formata o valor de um campo personalizado para exibição. */
export function formatCampoValor(tipo: CampoTipo, valor: unknown): string {
  if (valor == null || valor === "") return "—";
  switch (tipo) {
    case "moeda": return formatCurrency(Number(valor) || 0);
    case "numero": return String(Number(valor) || 0);
    case "data": return formatDate(String(valor));
    case "checkbox": return valor ? "Sim" : "Não";
    default: return String(valor);
  }
}

/** Gera uma chave estável a partir de um label (slug snake_case). */
export function chaveDeLabel(label: string): string {
  return label
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase().trim()
    .replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "")
    .slice(0, 40) || "campo";
}

/**
 * Dispara um webhook genérico de automação pela Edge Function `integracoes`.
 * Fire-and-forget — falhas ficam só no log de integrações.
 */
function dispatchWebhook(evento: string, payload: Record<string, unknown>): void {
  try {
    createClient()
      .functions.invoke("integracoes", { body: { action: "dispatch", evento, payload } })
      .catch(() => {});
  } catch { /* ignora */ }
}

/**
 * Executa as automações de um quadro para um card, no gatilho informado.
 * Roda no cliente, logo após a mutação. Aplica ações em ordem e devolve
 * a lista de mensagens (para feedback via toast).
 */
export async function runAutomacoes(
  quadroId: string,
  quadroNome: string,
  automacoes: QuadroAutomacao[],
  card: QuadroCard,
  gatilho: AutomacaoGatilho,
): Promise<string[]> {
  const aplicaveis = automacoes.filter((a) => {
    if (!a.ativo || a.gatilho !== gatilho) return false;
    // card_movido pode ser restrito a uma fase específica
    if (gatilho === "card_movido" && a.config.fase) return a.config.fase === card.fase;
    return true;
  });
  if (!aplicaveis.length) return [];

  const supabase = createClient();
  const feitos: string[] = [];
  const patch: Record<string, unknown> = {};
  const valoresPatch: Record<string, unknown> = { ...card.valores };
  let mudouValores = false;

  for (const a of aplicaveis) {
    for (const acao of a.config.acoes ?? []) {
      switch (acao.tipo) {
        case "notificar": {
          const msg = acao.mensagem || `${card.titulo ?? "Card"} — fase "${card.fase}"`;
          await notificarAdmins(`Automação: ${a.nome}`, msg, `/quadros/${quadroId}`);
          feitos.push(`Notificou: ${a.nome}`);
          break;
        }
        case "mover_fase": {
          if (acao.fase && acao.fase !== card.fase) {
            patch.fase = acao.fase;
            feitos.push(`Moveu para "${acao.fase}"`);
          }
          break;
        }
        case "definir_campo": {
          if (acao.campo) {
            valoresPatch[acao.campo] = acao.valor ?? "";
            mudouValores = true;
            feitos.push(`Definiu "${acao.campo}"`);
          }
          break;
        }
        case "webhook": {
          dispatchWebhook("quadro.automacao", {
            quadro: quadroNome, automacao: a.nome,
            card: { id: card.id, titulo: card.titulo, fase: card.fase, valor: card.valor, responsavel: card.responsavel },
          });
          feitos.push(`Webhook: ${a.nome}`);
          break;
        }
      }
    }
  }

  if (mudouValores) patch.valores = valoresPatch;
  if (Object.keys(patch).length) {
    await supabase.from("quadro_cards").update(patch).eq("id", card.id);
  }
  return feitos;
}

/** Valida campos obrigatórios; devolve a primeira mensagem de erro, ou null. */
export function validarObrigatorios(
  campos: QuadroCampo[],
  valores: Record<string, unknown>,
  titulo: string,
): string | null {
  if (!titulo.trim()) return "O título é obrigatório.";
  for (const c of campos) {
    if (!c.obrigatorio) continue;
    const v = valores[c.chave];
    if (v == null || v === "" || (c.tipo === "checkbox" && v === false)) {
      return `O campo "${c.label}" é obrigatório.`;
    }
  }
  return null;
}
