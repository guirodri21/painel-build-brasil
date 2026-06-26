import { createClient } from "@/lib/supabase/client";
import { notificarAdmins } from "@/lib/notifications";
import { formatCurrency, formatDate } from "@/lib/utils";
import type {
  QuadroCampo, QuadroCard, QuadroAutomacao, AutomacaoGatilho, CampoTipo, Chamado,
} from "@/lib/types";

/** Nome do quadro que serve de Pipeline Operacional (destino do vínculo COM→OP). */
export const NOME_PIPELINE_OPERACIONAL = "Pipeline Operacional";
/** Fase inicial do Pipeline Operacional onde a demanda comercial aterrissa. */
export const FASE_ENTRADA_OPERACAO = "Entrada da Operacao";
/**
 * Fases do Pipeline Comercial (Chamados) que indicam demanda aprovada/validada:
 * ao entrar numa delas, deve existir um card no Pipeline Operacional.
 */
export const FASES_COMERCIAL_APROVADO = ["Planejamento", "Em Execução"];

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

/**
 * Código de exibição de um card (ex.: "OP-000456"). Usa o prefixo do quadro e
 * o número sequencial do card; devolve null se ainda não houver número.
 */
export function codigoCard(prefixo: string | null | undefined, numero: number | null | undefined): string | null {
  if (numero == null) return null;
  return `${(prefixo || "CARD").toUpperCase()}-${String(numero).padStart(6, "0")}`;
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
 * Aplica, em ordem, as ações das automações informadas a um card.
 * Núcleo compartilhado por `runAutomacoes` (gatilhos automáticos) e
 * `runBotao` (gatilho manual via botão). Devolve mensagens para o toast.
 */
async function aplicarAutomacoes(
  quadroId: string,
  quadroNome: string,
  aplicaveis: QuadroAutomacao[],
  card: QuadroCard,
): Promise<string[]> {
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
        case "criar_card": {
          if (acao.quadro_destino && acao.fase_destino) {
            const novo = {
              quadro_id: acao.quadro_destino,
              titulo: card.titulo ?? "Solicitação",
              fase: acao.fase_destino,
              valor: acao.copiar_valor ? card.valor : 0,
              responsavel: card.responsavel,
              prioridade: card.prioridade,
              prazo: card.prazo,
              origem: acao.origem ?? "vinculo",
              filial: card.filial ?? "Matriz",
              valores: {
                card_origem: `${quadroNome} · ${card.titulo ?? card.id.slice(0, 8)}`,
                card_origem_id: card.id,
                card_origem_quadro: quadroId,
              },
              created_by: card.created_by,
            };
            const { error } = await supabase.from("quadro_cards").insert([novo]);
            if (!error) feitos.push(`Criou card vinculado (${a.config.label ?? a.nome})`);
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

/**
 * Executa as automações automáticas de um quadro para um card, no gatilho
 * informado (card_criado | card_movido | prazo_vencido). Botões manuais
 * (gatilho "botao") são ignorados aqui — use `runBotao`.
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
  return aplicarAutomacoes(quadroId, quadroNome, aplicaveis, card);
}

/**
 * Avalia se o novo valor de um campo satisfaz a condição de um gatilho
 * "campo_alterado". `cond` é `config.valor`:
 *   • vazio/ausente → dispara quando o campo fica preenchido (não vazio/false);
 *   • "true"/"false" → compara checkbox Sim/Não;
 *   • outro texto → igualdade exata (string).
 */
function condicaoCampoOk(cond: string | undefined, novo: unknown): boolean {
  if (cond === undefined || cond === "") return novo != null && novo !== "" && novo !== false;
  if (cond === "true") return novo === true;
  if (cond === "false") return novo === false;
  return String(novo) === cond;
}

/**
 * Dispara as automações de checklist (gatilho "campo_alterado") cujos campos
 * observados mudaram e cujas condições foram satisfeitas. Usado ao salvar o card.
 */
export async function runCamposAlterados(
  quadroId: string,
  quadroNome: string,
  automacoes: QuadroAutomacao[],
  card: QuadroCard,
  chavesAlteradas: string[],
): Promise<string[]> {
  const aplicaveis = automacoes.filter((a) => {
    if (!a.ativo || a.gatilho !== "campo_alterado") return false;
    const campo = a.config.campo;
    if (!campo || !chavesAlteradas.includes(campo)) return false;
    return condicaoCampoOk(a.config.valor, card.valores?.[campo]);
  });
  return aplicarAutomacoes(quadroId, quadroNome, aplicaveis, card);
}

/**
 * Executa um único botão de ação (automação com gatilho "botao") sobre um card.
 * Usado pelos botões "Solicitar Compra/Pagamento/Faturamento", "Retrabalho" etc.
 */
export async function runBotao(
  quadroId: string,
  quadroNome: string,
  automacao: QuadroAutomacao,
  card: QuadroCard,
): Promise<string[]> {
  return aplicarAutomacoes(quadroId, quadroNome, [automacao], card);
}

/** Filtra os botões de ação ativos de um quadro (gatilho "botao"). */
export function botoesDeAcao(automacoes: QuadroAutomacao[]): QuadroAutomacao[] {
  return automacoes.filter((a) => a.ativo && a.gatilho === "botao");
}

/** Compara dois números por um operador textual (guardas condicionais de gate). */
function compararNum(op: string, a: number, b: number): boolean {
  switch (op) {
    case ">": return a > b;
    case ">=": return a >= b;
    case "<": return a < b;
    case "<=": return a <= b;
    case "==": return a === b;
    default: return false;
  }
}

/** Avalia se um valor atual satisfaz a condição exigida por um gate de fase. */
function condicaoSatisfeita(exigido: string, atual: unknown): boolean {
  if (exigido === "true") return atual === true;
  if (exigido === "false") return atual === false || atual == null || atual === "";
  if (exigido === "vazio") return atual == null || atual === "" || atual === false;
  if (exigido === "preenchido") return atual != null && atual !== "" && atual !== false;
  // Comparação numérica: exigido no formato ">=500", "<100", etc.
  const m = exigido.match(/^(>=|<=|>|<|==)\s*(-?\d+(?:\.\d+)?)$/);
  if (m) return compararNum(m[1], Number(atual) || 0, Number(m[2]));
  return String(atual ?? "") === exigido;
}

/**
 * Bloqueio de avanço de fase: verifica os gates (gatilho "bloqueio_fase") que
 * protegem a fase de destino. Devolve a mensagem de bloqueio se alguma condição
 * não for satisfeita, ou null se o avanço é permitido.
 *
 * `valorCard` é o R$ do card, acessível nas condições pelo campo especial "valor"
 * (usado por guardas de alçada). Condições com `quando` só são exigidas quando a
 * guarda numérica é satisfeita.
 */
export function validarBloqueio(
  automacoes: QuadroAutomacao[],
  faseDestino: string,
  valores: Record<string, unknown> | null | undefined,
  valorCard?: number,
): string | null {
  const resolver = (campo: string): unknown => (campo === "valor" ? valorCard ?? 0 : valores?.[campo]);
  const gates = automacoes.filter(
    (a) => a.ativo && a.gatilho === "bloqueio_fase" && a.config.fase === faseDestino,
  );
  for (const g of gates) {
    for (const cond of g.config.condicoes ?? []) {
      // Guarda condicional: pula a condição quando a comparação não se aplica.
      if (cond.quando && !compararNum(cond.quando.op, Number(resolver(cond.quando.campo)) || 0, cond.quando.valor)) {
        continue;
      }
      if (!condicaoSatisfeita(cond.valor, resolver(cond.campo))) {
        return g.config.mensagem || `Não é possível avançar para "${faseDestino}": condição não atendida.`;
      }
    }
  }
  return null;
}

/**
 * Vínculo COM→OP: garante (idempotente) que exista um card no Pipeline
 * Operacional vinculado a um chamado comercial aprovado. Não duplica — se já
 * houver um card OP para o chamado, não cria outro.
 *
 * @returns "criado" se gerou um novo card OP, "existente" se já havia, ou
 *          "sem-pipeline" se o quadro Pipeline Operacional não existe.
 */
export async function garantirOperacaoDeChamado(
  chamado: Chamado,
): Promise<"criado" | "existente" | "sem-pipeline"> {
  const supabase = createClient();

  const { data: q } = await supabase
    .from("quadros").select("id")
    .eq("nome", NOME_PIPELINE_OPERACIONAL).eq("ativo", true).limit(1).maybeSingle();
  const quadroId = (q as { id: string } | null)?.id;
  if (!quadroId) return "sem-pipeline";

  const { data: existente } = await supabase
    .from("quadro_cards").select("id")
    .eq("quadro_id", quadroId).eq("valores->>card_origem_id", chamado.id).limit(1).maybeSingle();
  if (existente) return "existente";

  const ref = chamado.ticket_ref ? `#${chamado.ticket_ref}` : chamado.id.slice(0, 8);
  const { error } = await supabase.from("quadro_cards").insert([{
    quadro_id: quadroId,
    titulo: chamado.titulo || chamado.cliente || "Operação",
    fase: FASE_ENTRADA_OPERACAO,
    valor: chamado.valor || 0,
    responsavel: chamado.responsavel ?? null,
    prioridade: chamado.prioridade ?? null,
    prazo: chamado.prazo ?? null,
    origem: "comercial",
    filial: chamado.filial ?? "Matriz",
    valores: {
      origem_com: ref,
      card_origem: `Chamado ${ref} · ${chamado.cliente ?? chamado.titulo ?? ""}`.trim(),
      card_origem_id: chamado.id,
    },
  }]);
  return error ? "existente" : "criado";
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
