/**
 * De-para de fases: encaixa o nome de fase que vem de fora (planilha do Goalfy,
 * importações, integrações) numa das fases JÁ CRIADAS no Pipeline Comercial,
 * em vez de deixar o board inventar uma coluna nova para cada variação de texto.
 *
 * O board (chamados/page.tsx) compara `chamados.fase` por igualdade exata com os
 * nomes de `chamado_fases`. Qualquer diferença — acento, maiúscula, um "|", um
 * "(Perda)" a mais — cria uma coluna "extra". Aqui normalizamos e casamos por
 * tokens + sinônimos para que "Faturado (Concluído)", "faturado", "FATURADO"
 * caiam todos na mesma fase configurada.
 */

const norm = (s: string) =>
  (s ?? "")
    .toString()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();

/** Palavras sem valor semântico para o casamento (ligações, artigos). */
const STOP = new Set([
  "de", "da", "do", "das", "dos", "a", "o", "as", "os", "e", "em", "na", "no",
  "para", "por", "com", "sem", "the", "of",
]);

/**
 * Sinônimos → conceito canônico. Serve para casar quando os textos não
 * compartilham a mesma palavra literal (ex.: "recusada" ↔ "perda"). Tanto o
 * nome da fase configurada quanto o texto de entrada passam por aqui.
 */
const SINONIMOS: Record<string, string> = {
  // Conclusão / entrega
  concluido: "concluido", concluida: "concluido", concluir: "concluido",
  finalizado: "concluido", finalizada: "concluido", finalizar: "concluido",
  fechado: "concluido", fechada: "concluido", encerrado: "concluido",
  entregue: "concluido", entrega: "concluido", ganho: "concluido", ganha: "concluido",
  // Faturamento
  faturado: "faturado", faturada: "faturado", faturamento: "faturado",
  faturar: "faturado", nf: "faturado", "nota-fiscal": "faturado",
  // Perda / recusa
  perda: "perda", perdido: "perda", perdida: "perda", perder: "perda",
  recusada: "perda", recusado: "perda", recusa: "perda", recusar: "perda",
  reprovado: "perda", reprovada: "perda", reprovar: "perda",
  cancelado: "perda", cancelada: "perda", cancelar: "perda",
  declinado: "perda", declinada: "perda",
  // Aprovação / agendamento
  aprovado: "aprovado", aprovada: "aprovado", aprovados: "aprovado",
  aprovadas: "aprovado", aprovacao: "aprovado", aprovar: "aprovado",
  agendamento: "agendado", agendado: "agendado", agendada: "agendado", agenda: "agendado",
  // Demanda / oportunidade / entrada
  demanda: "demanda", demandas: "demanda",
  oportunidade: "demanda", oportunidades: "demanda",
  lead: "demanda", leads: "demanda", entrada: "demanda", entrar: "demanda",
  novo: "demanda", nova: "demanda", novos: "demanda", novas: "demanda",
  backlog: "demanda", rascunho: "demanda", inicial: "demanda", inicio: "demanda",
  // Execução / andamento
  andamento: "andamento", execucao: "andamento", executando: "andamento",
  executar: "andamento", producao: "andamento", fazendo: "andamento",
  progresso: "andamento", andar: "andamento",
  // Proposta / orçamento
  proposta: "proposta", propostas: "proposta",
  orcamento: "proposta", orcamentos: "proposta", orcar: "proposta",
  cotacao: "proposta", cotacoes: "proposta",
  pr: "proposta", tc: "proposta", "pr-tc": "proposta", prtc: "proposta",
  // Negociação
  negociacao: "negociacao", negociando: "negociacao", negociar: "negociacao",
};

/** Quebra um nome de fase em tokens significativos (sem acento, sem pontuação, sem stopwords). */
function tokens(s: string): string[] {
  return norm(s)
    .replace(/[^a-z0-9]+/g, " ")
    .split(" ")
    .filter((t) => t.length > 1 && !STOP.has(t));
}

/** Converte tokens em conceitos canônicos (aplica sinônimos). */
function conceitos(ts: string[]): Set<string> {
  return new Set(ts.map((t) => SINONIMOS[t] ?? t));
}

type FaseIndex = {
  nome: string;
  normal: string;
  literais: Set<string>;
  conceitos: Set<string>;
};

/**
 * Índice de fases + pesos por raridade (estilo IDF): um token/conceito que
 * aparece em poucas fases é mais distintivo e vale mais. É isso que faz
 * "recusada/perda" vencer "proposta" quando o texto é "PR.TC | RECUSADA (Perda)"
 * — "proposta" se repete em várias fases, "perda" só na fase de perda.
 */
export type FasesIndex = {
  itens: FaseIndex[];
  pesoLit: Map<string, number>;
  pesoCon: Map<string, number>;
};

/** Pré-processa a lista de fases existentes uma única vez (evita recalcular por card). */
export function indexarFases(nomes: string[]): FasesIndex {
  const itens: FaseIndex[] = nomes.map((nome) => {
    const ts = tokens(nome);
    return { nome, normal: norm(nome), literais: new Set(ts), conceitos: conceitos(ts) };
  });
  // Frequência de cada token/conceito entre as fases → peso = 1 / frequência.
  const dfLit = new Map<string, number>();
  const dfCon = new Map<string, number>();
  for (const it of itens) {
    for (const t of it.literais) dfLit.set(t, (dfLit.get(t) ?? 0) + 1);
    for (const c of it.conceitos) dfCon.set(c, (dfCon.get(c) ?? 0) + 1);
  }
  const pesoLit = new Map<string, number>();
  const pesoCon = new Map<string, number>();
  for (const [t, df] of dfLit) pesoLit.set(t, 1 / df);
  for (const [c, df] of dfCon) pesoCon.set(c, 1 / df);
  return { itens, pesoLit, pesoCon };
}

/**
 * Dado o nome de fase que veio de fora, devolve a fase existente mais parecida
 * (ou null se nada casar minimamente). Prioridade:
 *   1. Igualdade exata normalizada  → casa direto.
 *   2. Maior soma de pesos dos tokens em comum: literais (peso 3× a raridade) +
 *      conceitos (peso 1× a raridade).
 * Retorna null quando não há nenhuma palavra/conceito em comum — aí o chamador
 * decide o destino (normalmente a fase de entrada).
 */
export function casarFase(raw: string, index: FasesIndex): string | null {
  const alvo = norm(raw);
  if (!alvo || !index.itens.length) return null;

  // 1) Casamento exato (ignorando acento/caixa/espaços) — o caso mais comum.
  const exato = index.itens.find((f) => f.normal === alvo);
  if (exato) return exato.nome;

  const ts = tokens(raw);
  if (!ts.length) return null;
  const lit = new Set(ts);
  const con = conceitos(ts);

  // 2) Melhor sobreposição ponderada pela raridade.
  let melhor: FaseIndex | null = null;
  let melhorScore = 0;
  for (const f of index.itens) {
    let score = 0;
    for (const t of lit) if (f.literais.has(t)) score += 3 * (index.pesoLit.get(t) ?? 0);
    for (const c of con) if (f.conceitos.has(c)) score += index.pesoCon.get(c) ?? 0;
    if (score > melhorScore) { melhorScore = score; melhor = f; }
  }
  return melhorScore > 0 && melhor ? melhor.nome : null;
}

/**
 * Resolve a fase de destino garantindo que SEMPRE caia numa fase existente:
 * tenta casar; se não casar, usa `fallback` (fase de entrada). Nunca inventa
 * coluna nova.
 */
export function resolverFaseDestino(raw: string | null | undefined, index: FasesIndex, fallback: string): string {
  return casarFase(raw ?? "", index) ?? fallback;
}
