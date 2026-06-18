-- ============================================================
-- Build Brasil — Schema do Painel de Resultados
-- Execute este arquivo inteiro no SQL Editor do Supabase.
-- ============================================================

-- 1. Tabelas de apoio (listas suspensas)
-- Ajuste os nomes conforme a realidade da empresa.

CREATE TABLE equipes (
  id   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL UNIQUE
);

CREATE TABLE regioes (
  id   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL UNIQUE
);

CREATE TABLE linhas_servico (
  id   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL UNIQUE
);

-- 2. Tabela principal: ordens (vendas + tickets de operação)

CREATE TABLE ordens (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  data             date NOT NULL,
  regiao           text NOT NULL REFERENCES regioes(nome),
  equipe           text NOT NULL REFERENCES equipes(nome),
  linha_servico    text NOT NULL REFERENCES linhas_servico(nome),
  cliente          text,
  valor_venda      numeric NOT NULL DEFAULT 0,
  despesa_direta   numeric NOT NULL DEFAULT 0,
  status           text NOT NULL CHECK (status IN ('concluido','execucao_parcial','em_andamento')),
  tempo_execucao_h numeric CHECK (tempo_execucao_h >= 0),
  qualidade        int CHECK (qualidade >= 0 AND qualidade <= 100),
  resumo           text,
  created_by       uuid REFERENCES auth.users(id),
  created_at       timestamptz NOT NULL DEFAULT now()
);

-- 3. Despesas gerais (não vinculadas a uma ordem)

CREATE TABLE despesas_gerais (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  data        date NOT NULL,
  categoria   text NOT NULL CHECK (categoria IN ('suprimentos','contas','outros')),
  descricao   text,
  valor       numeric NOT NULL DEFAULT 0,
  created_by  uuid REFERENCES auth.users(id),
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- 4. RLS (Row Level Security)
-- Política: autenticado lê tudo, insere, edita/exclui só o próprio.
-- ============================================================

ALTER TABLE equipes         ENABLE ROW LEVEL SECURITY;
ALTER TABLE regioes         ENABLE ROW LEVEL SECURITY;
ALTER TABLE linhas_servico  ENABLE ROW LEVEL SECURITY;
ALTER TABLE ordens          ENABLE ROW LEVEL SECURITY;
ALTER TABLE despesas_gerais ENABLE ROW LEVEL SECURITY;

-- Tabelas de apoio: qualquer autenticado lê
CREATE POLICY "equipes_select"        ON equipes         FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "regioes_select"        ON regioes         FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "linhas_servico_select" ON linhas_servico  FOR SELECT USING (auth.role() = 'authenticated');

-- Ordens: ler tudo, inserir, editar/excluir só o próprio
CREATE POLICY "ordens_select" ON ordens FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "ordens_insert" ON ordens FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "ordens_update" ON ordens FOR UPDATE
  USING (auth.uid() = created_by);

CREATE POLICY "ordens_delete" ON ordens FOR DELETE
  USING (auth.uid() = created_by);

-- Despesas gerais: mesma lógica
CREATE POLICY "despesas_select" ON despesas_gerais FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "despesas_insert" ON despesas_gerais FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "despesas_update" ON despesas_gerais FOR UPDATE
  USING (auth.uid() = created_by);

CREATE POLICY "despesas_delete" ON despesas_gerais FOR DELETE
  USING (auth.uid() = created_by);

-- ============================================================
-- 5. Dados (seed / reset)
-- Este schema cria apenas a ESTRUTURA. Nenhum dado fictício é
-- inserido aqui, para que produção nunca suba dado falso por engano.
--
-- Para popular dados de demonstração: rode  seed-demo.sql
-- Para deixar limpo p/ produção (mantém cadastros): reset-limpo.sql
-- Para zerar tudo (inclui cadastros base):          reset-total.sql
-- ============================================================
