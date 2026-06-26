-- ============================================================
-- Build Brasil — Pipeline Comercial: campos da Oportunidade (doc v2.0)
--   Acrescenta os campos do card da Fase "Oportunidade / Demanda":
--     • numero (sequencial) → compõe o ID automatico VEN-000001 (via trigger)
--     • origem_oportunidade
--     • faixa_potencial
--   (centro_custo, regiao, cliente, responsavel, prioridade ja existem.)
--   Idempotente. Aplicar via MCP Supabase.
-- ============================================================
ALTER TABLE chamados ADD COLUMN IF NOT EXISTS numero integer;
ALTER TABLE chamados ADD COLUMN IF NOT EXISTS origem_oportunidade text;
ALTER TABLE chamados ADD COLUMN IF NOT EXISTS faixa_potencial text;

-- Backfill: numera os chamados existentes na ordem de criação.
WITH ranked AS (
  SELECT id, row_number() OVER (ORDER BY created_at, id) AS rn FROM chamados
)
UPDATE chamados c SET numero = r.rn FROM ranked r WHERE r.id = c.id AND c.numero IS NULL;

-- Trigger: ao inserir, atribui o próximo número (ID VEN-000001).
CREATE OR REPLACE FUNCTION chamados_set_numero() RETURNS trigger AS $$
BEGIN
  IF NEW.numero IS NULL THEN
    SELECT COALESCE(MAX(numero), 0) + 1 INTO NEW.numero FROM chamados;
  END IF;
  RETURN NEW;
END $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_chamados_numero ON chamados;
CREATE TRIGGER trg_chamados_numero
  BEFORE INSERT ON chamados
  FOR EACH ROW EXECUTE FUNCTION chamados_set_numero();
