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

export type IntegracaoTipo = "saida" | "entrada" | "importacao";

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
