-- ============================================================
-- Build Brasil — Numeração de cards (OP-000456 / COM-000123 ...)
--   Cada quadro ganha um 'prefixo'; cada card um 'numero' sequencial
--   POR QUADRO, atribuído por trigger no INSERT. Idempotente.
-- ============================================================
ALTER TABLE quadro_cards ADD COLUMN IF NOT EXISTS numero integer;
ALTER TABLE quadros      ADD COLUMN IF NOT EXISTS prefixo text;

-- Prefixos dos quadros conhecidos (só preenche se ainda nulo).
UPDATE quadros SET prefixo = 'OP'  WHERE nome = 'Pipeline Operacional'      AND prefixo IS NULL;
UPDATE quadros SET prefixo = 'SUP' WHERE nome = 'Suprimentos'               AND prefixo IS NULL;
UPDATE quadros SET prefixo = 'FIN' WHERE nome = 'Financeiro (Solicitacoes)' AND prefixo IS NULL;
UPDATE quadros SET prefixo = 'APO' WHERE nome = 'Apoio Interno'             AND prefixo IS NULL;

-- Backfill: numera os cards existentes por quadro, na ordem de criação.
WITH ranked AS (
  SELECT id, row_number() OVER (PARTITION BY quadro_id ORDER BY created_at, id) AS rn
  FROM quadro_cards
)
UPDATE quadro_cards c SET numero = r.rn FROM ranked r WHERE r.id = c.id AND c.numero IS NULL;

-- Trigger: ao inserir, atribui o próximo número do quadro.
CREATE OR REPLACE FUNCTION quadro_cards_set_numero() RETURNS trigger AS $$
BEGIN
  IF NEW.numero IS NULL THEN
    SELECT COALESCE(MAX(numero), 0) + 1 INTO NEW.numero
      FROM quadro_cards WHERE quadro_id = NEW.quadro_id;
  END IF;
  RETURN NEW;
END $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_quadro_cards_numero ON quadro_cards;
CREATE TRIGGER trg_quadro_cards_numero
  BEFORE INSERT ON quadro_cards
  FOR EACH ROW EXECUTE FUNCTION quadro_cards_set_numero();
