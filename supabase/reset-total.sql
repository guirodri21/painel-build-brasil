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
DELETE FROM integracao_logs;
DELETE FROM alertas_log;
DELETE FROM metas;
DELETE FROM despesas_gerais;
DELETE FROM ordens;

-- Cadastros base (lookups)
DELETE FROM linhas_servico;
DELETE FROM equipes;
DELETE FROM regioes;

-- Integrações configuradas — descomente se quiser zerar também
-- DELETE FROM integracoes;
