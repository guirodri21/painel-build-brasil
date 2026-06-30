export type OrdemStatus = "em_andamento" | "execucao_parcial" | "concluido";
export type DespesaCategoria = "suprimentos" | "contas" | "outros";

export interface Ordem {
  id: string;
  data: string;
  regiao: string;
  equipe: string;
  linha_servico: string;
  cliente: string | null;
  valor_venda: number;
  despesa_direta: number;
  status: OrdemStatus;
  tempo_execucao_h: number | null;
  qualidade: number | null;
  resumo: string | null;
  filial?: string | null;
  data_agendada?: string | null;
  hora_agendada?: string | null;
  created_by: string | null;
  created_at: string;
  updated_at?: string | null;
}

export interface DespesaGeral {
  id: string;
  data: string;
  categoria: DespesaCategoria;
  descricao: string | null;
  valor: number;
  filial?: string | null;
  created_by: string | null;
  created_at: string;
}

export interface Lookup {
  id: string;
  nome: string;
}

export interface Cliente {
  id: string;
  filial: string | null;
  nome: string;
  telefone: string | null;
  email: string | null;
  documento: string | null;
  endereco: string | null;
  contato: string | null;
  obs: string | null;
  ativo: boolean;
  created_by: string | null;
  created_at: string;
  updated_at?: string | null;
}

export interface Meta {
  id: string;
  equipe: string;
  funcionario_id?: string | null;
  mes: string; // YYYY-MM-01
  meta_receita: number;
  meta_qualidade: number | null;
  filial?: string | null;
  created_by: string | null;
  created_at: string;
}

export type IntegracaoTipo = "saida" | "entrada" | "importacao" | "whatsapp";

export type WhatsappProvider = "zapi" | "meta";

/** Estrutura esperada em Integracao.config quando tipo === "whatsapp". */
export interface WhatsappConfig {
  provider: WhatsappProvider;
  /** Credenciais Z-API */
  zapi?: { instanceId?: string; token?: string; clientToken?: string };
  /** Credenciais WhatsApp Cloud API (Meta) */
  meta?: { phoneNumberId?: string; accessToken?: string };
  /** Números avulsos que sempre recebem (E.164 sem '+'), ex: 5511999999999 */
  destinatarios?: string[];
  /** Também notificar os funcionários da equipe da ordem */
  notificar_equipe?: boolean;
}

export type MovimentoTipo = "entrada" | "saida" | "ajuste";

export interface Produto {
  id: string;
  sku: string | null;
  nome: string;
  categoria: string | null;
  unidade: string;
  estoque_atual: number;
  estoque_minimo: number;
  custo_unitario: number;
  localizacao: string | null;
  ativo: boolean;
  filial?: string | null;
  created_by: string | null;
  created_at: string;
}

export interface EstoqueMovimento {
  id: string;
  produto_id: string;
  tipo: MovimentoTipo;
  quantidade: number;
  custo_unitario: number | null;
  motivo: string | null;
  referencia: string | null;
  saldo_apos: number;
  created_by: string | null;
  created_at: string;
}

export interface ChamadoFase {
  id: string;
  nome: string;
  ordem: number;
  cor: string | null;
  final: boolean;
}

export interface Chamado {
  id: string;
  /** Número sequencial → compõe o ID automático VEN-000001. */
  numero?: number | null;
  filial: string | null;
  goalfy_card_id: string | null;
  titulo: string | null;
  cliente: string | null;
  regiao: string | null;
  descricao: string | null;
  prioridade: string | null;
  ticket_ref: string | null;
  fase: string;
  valor: number;
  responsavel: string | null;
  aberto_em: string | null;
  equipe?: string | null;
  tipo_demanda?: string | null;
  /** Sub-status quando o card está na fase "Em Orçamento/Em Andamento". */
  status_andamento?: string | null;
  /** Campos da fase "Proposta Enviada". */
  proposta_anexo?: string | null;
  data_envio_proposta?: string | null;
  responsavel_negociacao?: string | null;
  contato_cliente?: string | null;
  follow_up_em?: string | null;
  previsao_decisao?: string | null;
  status_proposta?: string | null;
  custo_real?: number | null;
  margem?: number | null;
  prazo?: string | null;
  centro_custo?: string | null;
  origem_oportunidade?: string | null;
  faixa_potencial?: string | null;
  status_faturamento?: string | null;
  nota_fiscal?: string | null;
  motivo_perda?: string | null;
  concluido_em?: string | null;
  local_demanda?: string | null;
  telefone?: string | null;
  tempos_fase?: Record<string, string> | null;
  fase_desde?: string | null;
  created_by: string | null;
  created_at: string;
  updated_at?: string | null;
}

/** Regiões operacionais do Pipeline Comercial (predefinidas no seletor; 1ª é o padrão). */
export const REGIOES_PIPELINE = ["Centro Oeste", "Nordeste", "Norte", "Sudeste/SP", "Sul PR+SC"] as const;

/** Equipes do Pipeline Comercial (predefinidas no seletor; 1ª é o padrão). */
export const EQUIPES_PIPELINE = ["Comercial", "Operacional", "Financeiro", "Estoque"] as const;

/** Fase inicial de todo card novo do Pipeline Comercial. */
export const FASE_OPORTUNIDADE = "Oportunidade / Demanda";
/** Fase de orçamento — libera os campos avançados do card e estende o prazo (+3 dias). */
export const FASE_ORCAMENTO = "Em Orçamento/Em Andamento";
/** Fase de proposta enviada — exige valor, anexo e data de envio; gera follow-up automático. */
export const FASE_PROPOSTA = "Proposta Enviada";

/** Sub-status do card na fase "Em Orçamento/Em Andamento" (1º é o padrão). */
export const STATUS_ANDAMENTO = [
  "Em análise", "Em cotação", "Análise técnica", "Enviada para operação",
] as const;

/** Tipos de demanda enviados à operação (popup "Enviar para operação"). */
export const TIPOS_DEMANDA = [
  "Chamados sem venda", "Visita técnica", "Atendimento emergencial",
] as const;

/** Status da proposta na fase "Proposta Enviada" (1º é o padrão). */
export const STATUS_PROPOSTA = [
  "Proposta enviada", "Aguardando retorno", "Em negociação", "Cliente solicitou desconto",
  "Cliente solicitou revisão técnica", "Cliente solicitou revisão comercial",
  "Aguardando documentação", "Aguardando aprovação interna", "Aguardando contrato/PO",
  "Aguardando aprovação financeira", "Negociação pausada",
] as const;

/** Prioridades da oportunidade comercial (doc v2.0). */
export const PRIORIDADES_OPORTUNIDADE = ["Crítica", "Alta", "Média", "Baixa"] as const;

/** Origens da oportunidade comercial. */
export const ORIGENS_OPORTUNIDADE = [
  "Marketing", "Indicação", "Comercial Ativo", "Demanda de Contrato",
] as const;

/** Faixas de potencial (valor) — rótulo exibido e tier armazenado (doc v2.0). */
export const FAIXAS_POTENCIAL: { tier: string; label: string }[] = [
  { tier: "Baixo", label: "Baixo (até R$ 1.000)" },
  { tier: "Médio", label: "Médio (R$ 1.001 a R$ 5.000)" },
  { tier: "Alto Impacto", label: "Alto Impacto (R$ 5.001 a R$ 30.000)" },
  { tier: "Estratégico", label: "Estratégico (acima de R$ 30.000)" },
];

/** ID automático de um chamado/oportunidade (ex.: "VEN-000001"). */
export function codigoChamado(numero: number | null | undefined): string | null {
  return numero == null ? null : `VEN-${String(numero).padStart(6, "0")}`;
}

export interface Notificacao {
  id: string;
  user_id: string;
  titulo: string;
  mensagem: string | null;
  link: string | null;
  lida: boolean;
  created_at: string;
}

export interface ComissaoRegra {
  id: string;
  filial: string | null;
  equipe: string;
  base: "receita" | "margem";
  percentual: number;
  created_at: string;
}

export type OrcamentoStatus = "rascunho" | "enviado" | "aprovado" | "recusado";

export interface Orcamento {
  id: string;
  filial: string | null;
  cliente: string | null;
  validade: string | null;
  status: OrcamentoStatus;
  observacoes: string | null;
  valor_total: number;
  ordem_id: string | null;
  created_by: string | null;
  created_at: string;
}

export interface OrcamentoItem {
  id: string;
  orcamento_id: string;
  descricao: string;
  quantidade: number;
  valor_unitario: number;
  ordem_exibicao: number;
}

export const ORCAMENTO_STATUS_LABELS: Record<OrcamentoStatus, string> = {
  rascunho: "Rascunho",
  enviado: "Enviado",
  aprovado: "Aprovado",
  recusado: "Recusado",
};

export type ContaTipo = "pagar" | "receber";

export interface Conta {
  id: string;
  filial: string | null;
  tipo: ContaTipo;
  descricao: string;
  categoria: string | null;
  valor: number;
  vencimento: string;
  pago: boolean;
  pago_em: string | null;
  cliente: string | null;
  ordem_id: string | null;
  created_by: string | null;
  created_at: string;
}

export interface ChecklistTemplate {
  id: string;
  linha_servico: string;
  item: string;
  ordem_exibicao: number;
  created_at: string;
}

export interface OrdemChecklistItem {
  id: string;
  ordem_id: string;
  item: string;
  feito: boolean;
  obs: string | null;
  created_at: string;
}

export type AnexoTipo = "foto" | "antes" | "depois" | "assinatura" | "doc";

export interface OrdemAnexo {
  id: string;
  ordem_id: string;
  path: string;
  tipo: AnexoTipo;
  legenda: string | null;
  filial: string | null;
  created_by: string | null;
  created_at: string;
}

export const ANEXO_TIPO_LABELS: Record<AnexoTipo, string> = {
  foto: "Foto",
  antes: "Antes",
  depois: "Depois",
  assinatura: "Assinatura",
  doc: "Documento",
};

export interface OrdemMaterial {
  id: string;
  ordem_id: string;
  produto_id: string;
  quantidade: number;
  custo_unitario_snapshot: number | null;
  filial: string | null;
  created_by: string | null;
  created_at: string;
}

export const MOVIMENTO_LABELS: Record<MovimentoTipo, string> = {
  entrada: "Entrada",
  saida: "Saída",
  ajuste: "Ajuste",
};

/** Unidades de medida sugeridas no cadastro de produtos. */
export const UNIDADES = ["un", "cx", "pç", "kg", "g", "m", "m²", "L", "ml", "par", "rolo", "saco"];

export interface Funcionario {
  id: string;
  nome: string;
  telefone: string;
  equipe: string | null;
  cargo: string | null;
  ativo: boolean;
  created_by: string | null;
  created_at: string;
}

export interface Integracao {
  id: string;
  tipo: IntegracaoTipo;
  nome: string;
  ativo: boolean;
  url: string | null;
  secret: string | null;
  eventos: string[];
  config: Record<string, unknown>;
  created_by: string | null;
  created_at: string;
}

export interface IntegracaoLog {
  id: string;
  integracao_id: string | null;
  direcao: string | null;
  evento: string | null;
  status: number | null;
  sucesso: boolean;
  mensagem: string | null;
  payload: Record<string, unknown> | null;
  created_at: string;
}

export const INTEGRACAO_TIPO_LABELS: Record<IntegracaoTipo, string> = {
  saida: "Webhook de saída",
  entrada: "API de entrada",
  importacao: "Importação externa",
  whatsapp: "Bot de WhatsApp",
};

// ============================================================
// Motor de Quadros (estilo Goalfy)
// ============================================================
export type CampoTipo =
  | "texto" | "texto_longo" | "numero" | "moeda" | "data" | "selecao" | "usuario" | "checkbox";

export interface Quadro {
  id: string;
  nome: string;
  descricao: string | null;
  icone: string | null;
  cor: string | null;
  ordem: number;
  ativo: boolean;
  /** Prefixo do código dos cards (ex.: "OP", "COM", "SUP"). */
  prefixo: string | null;
  filial: string | null;
  created_by: string | null;
  created_at: string;
  updated_at?: string | null;
}

export interface QuadroFase {
  id: string;
  quadro_id: string;
  nome: string;
  ordem: number;
  cor: string | null;
  final: boolean;
}

export interface QuadroCampo {
  id: string;
  quadro_id: string;
  chave: string;
  label: string;
  tipo: CampoTipo;
  opcoes: string[];
  obrigatorio: boolean;
  mostrar_no_card: boolean;
  ordem: number;
}

export interface QuadroCard {
  id: string;
  quadro_id: string;
  /** Número sequencial por quadro (compõe o código OP-000456). */
  numero: number | null;
  titulo: string | null;
  fase: string;
  valores: Record<string, unknown>;
  responsavel: string | null;
  valor: number;
  prioridade: string | null;
  prazo: string | null;
  ordem_coluna: number;
  fase_desde: string | null;
  origem: string | null;
  filial: string | null;
  created_by: string | null;
  created_at: string;
  updated_at?: string | null;
}

export type AutomacaoGatilho = "card_criado" | "card_movido" | "prazo_vencido" | "botao" | "campo_alterado" | "bloqueio_fase";

/** Operadores numéricos para guardas condicionais de gate. */
export type GuardaOp = ">" | ">=" | "<" | "<=" | "==";

/** Condição de um gate de fase: o campo deve satisfazer o valor exigido. */
export interface CondicaoCampo {
  /** Chave do campo, ou o token especial "valor" para o R$ do card. */
  campo: string;
  /** "true"/"false" = checkbox; "vazio"/"preenchido"; ">=500" etc. = numérico; outro = igualdade exata. */
  valor: string;
  /**
   * Guarda opcional: a condição só é exigida quando esta comparação numérica
   * é satisfeita. Ex.: exigir aprovação da diretoria apenas quando valor > 500.
   */
  quando?: { campo: string; op: GuardaOp; valor: number };
}
export type AcaoTipo = "notificar" | "mover_fase" | "definir_campo" | "webhook" | "criar_card";

export interface AutomacaoAcao {
  tipo: AcaoTipo;
  /** mover_fase */
  fase?: string;
  /** definir_campo */
  campo?: string;
  valor?: string;
  /** notificar */
  mensagem?: string;
  /** criar_card: id do quadro de destino (ex.: Suprimentos, Financeiro) */
  quadro_destino?: string;
  /** criar_card: fase de destino no quadro alvo */
  fase_destino?: string;
  /** criar_card: copia o valor (R$) do card de origem para o novo card */
  copiar_valor?: boolean;
  /** criar_card: origem gravada no novo card (default "vinculo"; ex.: "retrabalho") */
  origem?: string;
}

export interface AutomacaoConfig {
  /** para gatilho card_movido: a fase que dispara */
  fase?: string;
  /** para gatilho botao: rótulo exibido no botão */
  label?: string;
  /** para gatilho botao: cor do botão (chave do mapa DOT) */
  cor?: string;
  /** para gatilho campo_alterado: chave do campo observado */
  campo?: string;
  /**
   * para gatilho campo_alterado: condição sobre o novo valor.
   * "" / ausente = dispara quando o campo fica preenchido (não vazio);
   * "true"/"false" = compara checkbox Sim/Não; outro texto = igualdade exata.
   */
  valor?: string;
  /** para gatilho bloqueio_fase: condições que precisam ser satisfeitas p/ avançar */
  condicoes?: CondicaoCampo[];
  /** para gatilho bloqueio_fase: mensagem exibida quando o avanço é bloqueado */
  mensagem?: string;
  acoes: AutomacaoAcao[];
}

export interface QuadroAutomacao {
  id: string;
  quadro_id: string;
  nome: string;
  ativo: boolean;
  gatilho: AutomacaoGatilho;
  config: AutomacaoConfig;
  ordem: number;
  created_at: string;
}

export interface QuadroFormulario {
  id: string;
  quadro_id: string;
  slug: string;
  titulo: string;
  descricao: string | null;
  fase_destino: string | null;
  campos: string[];
  ativo: boolean;
  created_at: string;
}

export const CAMPO_TIPO_LABELS: Record<CampoTipo, string> = {
  texto: "Texto",
  texto_longo: "Texto longo",
  numero: "Número",
  moeda: "Moeda (R$)",
  data: "Data",
  selecao: "Seleção",
  usuario: "Responsável/Pessoa",
  checkbox: "Sim/Não",
};

export const GATILHO_LABELS: Record<AutomacaoGatilho, string> = {
  card_criado: "Quando um card é criado",
  card_movido: "Quando um card move para uma fase",
  prazo_vencido: "Quando o prazo vence",
  botao: "Botão no card (manual)",
  campo_alterado: "Quando um campo muda (checklist)",
  bloqueio_fase: "Bloquear avanço para uma fase",
};

export const ACAO_LABELS: Record<AcaoTipo, string> = {
  notificar: "Notificar administradores",
  mover_fase: "Mover para a fase",
  definir_campo: "Definir um campo",
  webhook: "Disparar webhook (Goalfy/externo)",
  criar_card: "Criar card em outro quadro",
};

export const STATUS_LABELS: Record<OrdemStatus, string> = {
  em_andamento: "Em andamento",
  execucao_parcial: "Execução parcial",
  concluido: "Concluído",
};

export const CATEGORIA_LABELS: Record<DespesaCategoria, string> = {
  suprimentos: "Suprimentos",
  contas: "Contas",
  outros: "Outros",
};
