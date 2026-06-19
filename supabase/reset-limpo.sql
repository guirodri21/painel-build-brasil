-- ============================================================
-- Painel Build — RESET PARA PRODUÇÃO LIMPA
-- Apaga TODOS os lançamentos (ordens, despesas, metas e logs),
-- mas MANTÉM os cadastros base (regiões, equipes, linhas de serviço),
-- as integrações configuradas e os usuários.
--
-- Use antes de entregar/apresentar para o cliente: o sistema fica
-- pronto para uso, sem nenhum dado fictício.
--
-- Para repopular a demo, rode: seed-demo.sql
-- ============================================================

DELETE FROM integracao_logs;
DELETE FROM alertas_log;
DELETE FROM metas;
DELETE FROM despesas_gerais;
DELETE FROM ordens;
DELETE FROM estoque_movimentos;
DELETE FROM produtos;
