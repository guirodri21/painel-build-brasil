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
  created_by: string | null;
  created_at: string;
}

export interface DespesaGeral {
  id: string;
  data: string;
  categoria: DespesaCategoria;
  descricao: string | null;
  valor: number;
  created_by: string | null;
  created_at: string;
}

export interface Lookup {
  id: string;
  nome: string;
}

export interface Meta {
  id: string;
  equipe: string;
  mes: string; // YYYY-MM-01
  meta_receita: number;
  meta_qualidade: number | null;
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
