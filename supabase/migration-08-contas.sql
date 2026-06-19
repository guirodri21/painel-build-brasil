-- ============================================================
-- Build Brasil — MIGRATION 08: Contas a pagar / receber
-- ============================================================
CREATE TABLE IF NOT EXISTS contas (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  filial     text DEFAULT 'Matriz' REFERENCES filiais(nome),
  tipo       text NOT NULL CHECK (tipo IN ('pagar','receber')),
  descricao  text NOT NULL,
  categoria  text,
  valor      numeric NOT NULL DEFAULT 0 CHECK (valor >= 0),
  vencimento date NOT NULL,
  pago       boolean NOT NULL DEFAULT false,
  pago_em    date,
  cliente    text,
  ordem_id   uuid REFERENCES ordens(id) ON DELETE SET NULL,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz
);
CREATE INDEX IF NOT EXISTS idx_contas_venc ON contas (vencimento);

ALTER TABLE contas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "contas_select" ON contas;
CREATE POLICY "contas_select" ON contas FOR SELECT USING (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "contas_insert" ON contas;
CREATE POLICY "contas_insert" ON contas FOR INSERT WITH CHECK (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "contas_update" ON contas;
CREATE POLICY "contas_update" ON contas FOR UPDATE USING (auth.uid() = created_by OR public.is_admin());
DROP POLICY IF EXISTS "contas_delete" ON contas;
CREATE POLICY "contas_delete" ON contas FOR DELETE USING (auth.uid() = created_by OR public.is_admin());

DROP TRIGGER IF EXISTS trg_set_updated_at ON contas;
CREATE TRIGGER trg_set_updated_at BEFORE UPDATE ON contas
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
