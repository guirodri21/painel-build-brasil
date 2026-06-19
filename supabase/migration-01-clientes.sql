-- ============================================================
-- Build Brasil — MIGRATION 01: Clientes (CRM-lite)
-- ============================================================
CREATE TABLE IF NOT EXISTS clientes (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  filial     text DEFAULT 'Matriz' REFERENCES filiais(nome),
  nome       text NOT NULL,
  telefone   text,
  email      text,
  documento  text,
  endereco   text,
  contato    text,
  obs        text,
  ativo      boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz,
  UNIQUE (filial, nome)
);
CREATE INDEX IF NOT EXISTS idx_clientes_nome ON clientes (nome);

ALTER TABLE clientes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "clientes_select" ON clientes;
CREATE POLICY "clientes_select" ON clientes FOR SELECT USING (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "clientes_insert" ON clientes;
CREATE POLICY "clientes_insert" ON clientes FOR INSERT WITH CHECK (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "clientes_update" ON clientes;
CREATE POLICY "clientes_update" ON clientes FOR UPDATE
  USING (auth.uid() = created_by OR public.is_admin());
DROP POLICY IF EXISTS "clientes_delete" ON clientes;
CREATE POLICY "clientes_delete" ON clientes FOR DELETE
  USING (auth.uid() = created_by OR public.is_admin());

DROP TRIGGER IF EXISTS trg_set_updated_at ON clientes;
CREATE TRIGGER trg_set_updated_at BEFORE UPDATE ON clientes
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Seed a partir dos clientes já citados nas ordens
INSERT INTO clientes (nome, filial)
  SELECT DISTINCT trim(cliente), COALESCE(filial, 'Matriz')
  FROM ordens
  WHERE cliente IS NOT NULL AND trim(cliente) <> ''
  ON CONFLICT (filial, nome) DO NOTHING;
