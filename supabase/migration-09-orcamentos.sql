-- ============================================================
-- Build Brasil — MIGRATION 09: Orçamentos
-- ============================================================
CREATE TABLE IF NOT EXISTS orcamentos (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  filial      text DEFAULT 'Matriz' REFERENCES filiais(nome),
  cliente     text,
  validade    date,
  status      text NOT NULL DEFAULT 'rascunho' CHECK (status IN ('rascunho','enviado','aprovado','recusado')),
  observacoes text,
  valor_total numeric NOT NULL DEFAULT 0,
  ordem_id    uuid REFERENCES ordens(id) ON DELETE SET NULL,
  created_by  uuid REFERENCES auth.users(id),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz
);

CREATE TABLE IF NOT EXISTS orcamento_itens (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  orcamento_id   uuid NOT NULL REFERENCES orcamentos(id) ON DELETE CASCADE,
  descricao      text NOT NULL,
  quantidade     numeric NOT NULL DEFAULT 1 CHECK (quantidade > 0),
  valor_unitario numeric NOT NULL DEFAULT 0 CHECK (valor_unitario >= 0),
  ordem_exibicao int NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_orcamento_itens ON orcamento_itens (orcamento_id);

ALTER TABLE orcamentos     ENABLE ROW LEVEL SECURITY;
ALTER TABLE orcamento_itens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "orcamentos_select" ON orcamentos;
CREATE POLICY "orcamentos_select" ON orcamentos FOR SELECT USING (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "orcamentos_insert" ON orcamentos;
CREATE POLICY "orcamentos_insert" ON orcamentos FOR INSERT WITH CHECK (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "orcamentos_update" ON orcamentos;
CREATE POLICY "orcamentos_update" ON orcamentos FOR UPDATE USING (auth.uid() = created_by OR public.is_admin());
DROP POLICY IF EXISTS "orcamentos_delete" ON orcamentos;
CREATE POLICY "orcamentos_delete" ON orcamentos FOR DELETE USING (auth.uid() = created_by OR public.is_admin());

DROP POLICY IF EXISTS "orcamento_itens_all" ON orcamento_itens;
CREATE POLICY "orcamento_itens_all" ON orcamento_itens FOR ALL
  USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

DROP TRIGGER IF EXISTS trg_set_updated_at ON orcamentos;
CREATE TRIGGER trg_set_updated_at BEFORE UPDATE ON orcamentos
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
