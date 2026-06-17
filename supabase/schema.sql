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
-- 5. Dados iniciais das listas de apoio
-- ============================================================

INSERT INTO regioes (nome) VALUES
  ('São Paulo - Capital'),
  ('São Paulo - Interior'),
  ('Rio de Janeiro'),
  ('Minas Gerais'),
  ('Sul');

INSERT INTO equipes (nome) VALUES
  ('Alfa'),
  ('Bravo'),
  ('Charlie'),
  ('Delta');

INSERT INTO linhas_servico (nome) VALUES
  ('Manutenção Predial'),
  ('Reforma Comercial'),
  ('Instalações Elétricas'),
  ('Construção Civil'),
  ('Pintura e Acabamento');

-- ============================================================
-- 6. Dados de exemplo (ordens e despesas)
-- created_by fica NULL nos exemplos; em produção o app preenche.
-- ============================================================

INSERT INTO ordens (data, regiao, equipe, linha_servico, cliente, valor_venda, despesa_direta, status, tempo_execucao_h, qualidade, resumo) VALUES
  ('2026-06-01','São Paulo - Capital','Alfa','Manutenção Predial','Edifício Aurora',18500,6200,'concluido',32,92,'Manutenção preventiva — elétrica e hidráulica'),
  ('2026-06-03','Rio de Janeiro','Bravo','Reforma Comercial','Loja Center Norte',42000,18500,'concluido',120,85,'Reforma completa do piso térreo'),
  ('2026-06-05','Minas Gerais','Charlie','Instalações Elétricas','Galpão MG-040',27800,9400,'concluido',64,78,'Instalação de novo quadro de distribuição'),
  ('2026-06-06','São Paulo - Interior','Delta','Construção Civil','Condomínio Parque das Águas',135000,62000,'em_andamento',NULL,NULL,'Construção de 4 unidades — fase de fundação'),
  ('2026-06-07','Sul','Alfa','Pintura e Acabamento','Hospital Regional Sul',22000,7800,'concluido',48,95,'Pintura externa — 3 blocos'),
  ('2026-06-08','São Paulo - Capital','Bravo','Manutenção Predial','Sede Banco Central',15200,5100,'execucao_parcial',18,NULL,'Manutenção do sistema de ar-condicionado — aguardando peça'),
  ('2026-06-10','Rio de Janeiro','Charlie','Reforma Comercial','Shopping Tijuca',55000,22000,'em_andamento',NULL,NULL,'Reforma de 12 lojas — fase de demolição'),
  ('2026-06-12','Minas Gerais','Delta','Instalações Elétricas','Fábrica Itabirito',31500,11200,'concluido',80,88,'Adequação NR-10 completa'),
  ('2026-06-13','São Paulo - Capital','Alfa','Construção Civil','Residência Alto de Pinheiros',89000,38000,'execucao_parcial',96,82,'Ampliação — estrutura pronta, acabamento pendente'),
  ('2026-06-15','Sul','Bravo','Pintura e Acabamento','Escola Municipal Canoas',12800,4200,'concluido',24,90,'Pintura interna — 8 salas de aula');

INSERT INTO despesas_gerais (data, categoria, descricao, valor) VALUES
  ('2026-06-01','suprimentos','Compra mensal de EPIs',3200),
  ('2026-06-01','contas','Aluguel do galpão de materiais',4500),
  ('2026-06-05','suprimentos','Ferramentas elétricas — reposição',1800),
  ('2026-06-10','contas','Conta de energia do escritório',950),
  ('2026-06-12','outros','Licença de software de projeto',600),
  ('2026-06-15','suprimentos','Tintas e solventes — estoque',2700);
