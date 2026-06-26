-- ============================================================
-- Build Brasil — Pipeline Comercial: 5 fases (reorganização)
--   Reorganiza as fases do board de Chamados para:
--     Oportunidade / Demanda · Em Orçamento · Em Andamento ·
--     Proposta Enviada · Proposta Recusada (final)
--   Migra os cards das fases removidas:
--     Triagem                         → Oportunidade / Demanda
--     Planejamento, Em Execução       → Em Andamento
--     Resolvido / Análise             → Proposta Enviada
--   (chamados.fase é texto, sem FK para chamado_fases.) Aplicado via MCP.
-- ============================================================
BEGIN;
UPDATE chamados SET fase='Oportunidade / Demanda' WHERE fase='Triagem';
UPDATE chamados SET fase='Em Andamento'     WHERE fase IN ('Planejamento','Em Execução');
UPDATE chamados SET fase='Proposta Enviada' WHERE fase='Resolvido / Análise';

DELETE FROM chamado_fases;
INSERT INTO chamado_fases (nome, ordem, cor, final) VALUES
  ('Oportunidade / Demanda', 1, 'blue',  false),
  ('Em Orçamento',           2, 'gray',  false),
  ('Em Andamento',           3, 'orange',false),
  ('Proposta Enviada',       4, 'teal',  false),
  ('Proposta Recusada',      5, 'red',   true);
COMMIT;
