-- ============================================================
-- Build Brasil — MIGRATION 00: Fundações
--   1. Multi-filial (tabela filiais + coluna filial nas tabelas)
--   2. Override de admin nas políticas RLS de update/delete
--   3. Auditoria: updated_at + trigger
-- ============================================================

-- 1. FILIAIS ---------------------------------------------------
CREATE TABLE IF NOT EXISTS filiais (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome       text NOT NULL UNIQUE,
  ativo      boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO filiais (nome) VALUES ('Matriz')
  ON CONFLICT (nome) DO NOTHING;

ALTER TABLE filiais ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "filiais_select" ON filiais;
CREATE POLICY "filiais_select" ON filiais FOR SELECT USING (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "filiais_admin" ON filiais;
CREATE POLICY "filiais_admin" ON filiais FOR ALL
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Coluna filial nas tabelas transacionais + backfill p/ 'Matriz'
ALTER TABLE ordens          ADD COLUMN IF NOT EXISTS filial text;
ALTER TABLE despesas_gerais ADD COLUMN IF NOT EXISTS filial text;
ALTER TABLE metas           ADD COLUMN IF NOT EXISTS filial text;
ALTER TABLE produtos        ADD COLUMN IF NOT EXISTS filial text;
ALTER TABLE funcionarios    ADD COLUMN IF NOT EXISTS filial text;

UPDATE ordens          SET filial = 'Matriz' WHERE filial IS NULL;
UPDATE despesas_gerais SET filial = 'Matriz' WHERE filial IS NULL;
UPDATE metas           SET filial = 'Matriz' WHERE filial IS NULL;
UPDATE produtos        SET filial = 'Matriz' WHERE filial IS NULL;
UPDATE funcionarios    SET filial = 'Matriz' WHERE filial IS NULL;

ALTER TABLE ordens          ALTER COLUMN filial SET DEFAULT 'Matriz';
ALTER TABLE despesas_gerais ALTER COLUMN filial SET DEFAULT 'Matriz';
ALTER TABLE metas           ALTER COLUMN filial SET DEFAULT 'Matriz';
ALTER TABLE produtos        ALTER COLUMN filial SET DEFAULT 'Matriz';
ALTER TABLE funcionarios    ALTER COLUMN filial SET DEFAULT 'Matriz';

DO $$ BEGIN
  ALTER TABLE ordens          ADD CONSTRAINT ordens_filial_fkey          FOREIGN KEY (filial) REFERENCES filiais(nome);
  EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE despesas_gerais ADD CONSTRAINT despesas_gerais_filial_fkey FOREIGN KEY (filial) REFERENCES filiais(nome);
  EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE metas           ADD CONSTRAINT metas_filial_fkey           FOREIGN KEY (filial) REFERENCES filiais(nome);
  EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE produtos        ADD CONSTRAINT produtos_filial_fkey        FOREIGN KEY (filial) REFERENCES filiais(nome);
  EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE funcionarios    ADD CONSTRAINT funcionarios_filial_fkey    FOREIGN KEY (filial) REFERENCES filiais(nome);
  EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2. OVERRIDE DE ADMIN nas políticas de update/delete -----------
DROP POLICY IF EXISTS "ordens_update" ON ordens;
CREATE POLICY "ordens_update" ON ordens FOR UPDATE
  USING (auth.uid() = created_by OR public.is_admin());
DROP POLICY IF EXISTS "ordens_delete" ON ordens;
CREATE POLICY "ordens_delete" ON ordens FOR DELETE
  USING (auth.uid() = created_by OR public.is_admin());

DROP POLICY IF EXISTS "despesas_update" ON despesas_gerais;
CREATE POLICY "despesas_update" ON despesas_gerais FOR UPDATE
  USING (auth.uid() = created_by OR public.is_admin());
DROP POLICY IF EXISTS "despesas_delete" ON despesas_gerais;
CREATE POLICY "despesas_delete" ON despesas_gerais FOR DELETE
  USING (auth.uid() = created_by OR public.is_admin());

DROP POLICY IF EXISTS "produtos_delete" ON produtos;
CREATE POLICY "produtos_delete" ON produtos FOR DELETE
  USING (auth.uid() = created_by OR public.is_admin());

-- metas pode não ter políticas update/delete; cria de forma idempotente
DROP POLICY IF EXISTS "metas_update" ON metas;
CREATE POLICY "metas_update" ON metas FOR UPDATE
  USING (auth.uid() = created_by OR public.is_admin());
DROP POLICY IF EXISTS "metas_delete" ON metas;
CREATE POLICY "metas_delete" ON metas FOR DELETE
  USING (auth.uid() = created_by OR public.is_admin());

-- 3. AUDITORIA: updated_at + trigger ----------------------------
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END; $$;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['ordens','despesas_gerais','metas','produtos','funcionarios'] LOOP
    EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS updated_at timestamptz', t);
    EXECUTE format('DROP TRIGGER IF EXISTS trg_set_updated_at ON %I', t);
    EXECUTE format('CREATE TRIGGER trg_set_updated_at BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION set_updated_at()', t);
  END LOOP;
END $$;
