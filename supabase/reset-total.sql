-- ============================================================
-- Painel Build — RESET TOTAL (ZERAR TUDO)
-- Apaga lançamentos E cadastros base, deixando o banco
-- completamente vazio para o cliente cadastrar tudo do zero.
--
-- NÃO apaga: usuários (auth) nem profiles.
-- Opcional: descomente o bloco de integrações para zerá-las também.
--
-- Para repopular a demo, rode: seed-demo.sql
-- ============================================================

-- Lançamentos
DELETE FROM notificacoes;
DELETE FROM integracao_logs;
DELETE FROM alertas_log;
DELETE FROM orcamento_itens;
DELETE FROM orcamentos;
DELETE FROM contas;
DELETE FROM ordem_checklist;
DELETE FROM ordem_anexos;
DELETE FROM ordem_materiais;
DELETE FROM metas;
DELETE FROM despesas_gerais;
DELETE FROM ordens;
DELETE FROM estoque_movimentos;
DELETE FROM produtos;
DELETE FROM clientes;

-- Cadastros base (lookups)
DELETE FROM comissao_regras;
DELETE FROM checklist_templates;
DELETE FROM linhas_servico;
DELETE FROM equipes;
DELETE FROM regioes;
-- filiais: mantém ao menos 'Matriz' (FK das demais tabelas)

-- Integrações configuradas — descomente se quiser zerar também
-- DELETE FROM integracoes;
