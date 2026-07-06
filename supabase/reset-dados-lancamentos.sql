-- ============================================================
-- Painel Build — RESET DE DADOS (lançamentos) — versão atual
--   Apaga TODOS os lançamentos, MANTENDO:
--     • Configuração do pipeline (quadros, quadro_fases, quadro_campos,
--       quadro_automacoes, quadro_formularios, chamado_fases)
--     • Usuários (auth/profiles, funcionarios, tecnicos)
--     • Cadastros base (filiais, regioes, equipes, linhas_servico, clientes,
--       produtos, checklist_templates, comissao_regras, frota_veiculos)
--     • Integrações configuradas (integracoes)
--
--   Substitui reset-limpo.sql / reset-total.sql (defasados: não cobriam
--   quadro_cards, chamados e tabelas novas).
--
--   Ordem: filhos antes dos pais (FK-safe). Rode como um bloco (atômico).
--   Aplicado em 2026-07-06 via MCP (migration reset_dados_producao_2026_07).
-- ============================================================
DELETE FROM chamado_comentarios;
DELETE FROM chamado_anexos;
DELETE FROM ordem_checklist;
DELETE FROM ordem_anexos;
DELETE FROM ordem_materiais;
DELETE FROM orcamento_itens;
DELETE FROM quadro_cards;
DELETE FROM contas;
DELETE FROM orcamentos;
DELETE FROM ordens;
DELETE FROM chamados;
DELETE FROM despesas_gerais;
DELETE FROM metas;
DELETE FROM estoque_movimentos;
DELETE FROM notificacoes;
DELETE FROM integracao_logs;
DELETE FROM alertas_log;
DELETE FROM conversas_whatsapp;
DELETE FROM mp_webhook_log;
DELETE FROM assinaturas;
