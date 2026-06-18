-- ============================================================
-- Painel Build — SEED DE DEMONSTRAÇÃO
-- Popula dados fictícios para demo/apresentação.
-- Seguro para rodar mais de uma vez: limpa os lançamentos antes
-- de reinserir (não mexe em usuários/profiles).
--
-- Para voltar ao estado limpo, rode: reset-limpo.sql
-- ============================================================

-- 0. Limpa lançamentos antes de popular (idempotente)
DELETE FROM integracao_logs;
DELETE FROM alertas_log;
DELETE FROM metas;
DELETE FROM despesas_gerais;
DELETE FROM ordens;

-- 1. Cadastros base (lookups) — só insere o que faltar
INSERT INTO regioes (nome) VALUES
  ('São Paulo - Capital'),
  ('São Paulo - Interior'),
  ('Rio de Janeiro'),
  ('Minas Gerais'),
  ('Sul')
ON CONFLICT (nome) DO NOTHING;

INSERT INTO equipes (nome) VALUES
  ('Alfa'),
  ('Bravo'),
  ('Charlie'),
  ('Delta')
ON CONFLICT (nome) DO NOTHING;

INSERT INTO linhas_servico (nome) VALUES
  ('Manutenção Predial'),
  ('Reforma Comercial'),
  ('Instalações Elétricas'),
  ('Construção Civil'),
  ('Pintura e Acabamento')
ON CONFLICT (nome) DO NOTHING;

-- 2. Ordens de exemplo (created_by NULL; em produção o app preenche)
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

-- 3. Despesas gerais de exemplo
INSERT INTO despesas_gerais (data, categoria, descricao, valor) VALUES
  ('2026-06-01','suprimentos','Compra mensal de EPIs',3200),
  ('2026-06-01','contas','Aluguel do galpão de materiais',4500),
  ('2026-06-05','suprimentos','Ferramentas elétricas — reposição',1800),
  ('2026-06-10','contas','Conta de energia do escritório',950),
  ('2026-06-12','outros','Licença de software de projeto',600),
  ('2026-06-15','suprimentos','Tintas e solventes — estoque',2700);

-- 4. Metas de exemplo (mês corrente da demo: junho/2026)
INSERT INTO metas (equipe, mes, meta_receita, meta_qualidade) VALUES
  ('Alfa','2026-06-01',120000,90),
  ('Bravo','2026-06-01',100000,85),
  ('Charlie','2026-06-01',90000,80),
  ('Delta','2026-06-01',150000,88);
