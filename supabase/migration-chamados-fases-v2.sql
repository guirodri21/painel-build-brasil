-- ============================================================
-- Build Brasil — Pipeline Comercial: 6 fases (reorganização)
--   Reduz/reorganiza as fases do board de Chamados para:
--     Triagem · Oportunidade / Demanda · Em Orçamento · Em Andamento ·
--     Proposta Enviada · Proposta Recusada (final)
--   Migra os cards das fases removidas:
--     Planejamento, Em Execução       → Em Andamento
--     Resolvido / Análise             → Proposta Enviada
--   (chamados.fase é texto, sem FK para chamado_fases.) Aplicado via MCP.
-- ============================================================
BEGIN;
UPDATE chamados SET fase='Em Andamento'     WHERE fase IN ('Planejamento','Em Execução');
UPDATE chamados SET fase='Proposta Enviada' WHERE fase='Resolvido / Análise';

DELETE FROM chamado_fases;
INSERT INTO chamado_fases (nome, ordem, cor, final) VALUES
  ('Triagem',                1, 'blue',  false),
  ('Oportunidade / Demanda', 2, 'teal',  false),
  ('Em Orçamento',           3, 'gray',  false),
  ('Em Andamento',           4, 'orange',false),
  ('Proposta Enviada',       5, 'teal',  false),
  ('Proposta Recusada',      6, 'red',   true);
COMMIT;
