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
