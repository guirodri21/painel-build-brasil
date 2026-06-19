-- ============================================================
-- Build Brasil — MIGRATION 02: Consumo de material nas ordens
-- Liga ordens ao estoque: cada material lançado gera uma 'saida'
-- no ledger de estoque (reusa a trigger de saldo). Excluir o
-- material gera um estorno ('entrada').
-- ============================================================
CREATE TABLE IF NOT EXISTS ordem_materiais (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ordem_id               uuid NOT NULL REFERENCES ordens(id) ON DELETE CASCADE,
  produto_id             uuid NOT NULL REFERENCES produtos(id),
  quantidade             numeric NOT NULL CHECK (quantidade > 0),
  custo_unitario_snapshot numeric,
  filial                 text DEFAULT 'Matriz' REFERENCES filiais(nome),
  created_by             uuid REFERENCES auth.users(id),
  created_at             timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ordem_materiais_ordem ON ordem_materiais (ordem_id);

-- Trigger: aplica/estorna o movimento de estoque
CREATE OR REPLACE FUNCTION mov_material_ordem()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_custo numeric;
BEGIN
  IF TG_OP = 'INSERT' THEN
    SELECT custo_unitario INTO v_custo FROM produtos WHERE id = NEW.produto_id;
    NEW.custo_unitario_snapshot := COALESCE(NEW.custo_unitario_snapshot, v_custo, 0);
    INSERT INTO estoque_movimentos (produto_id, tipo, quantidade, motivo, referencia, created_by)
      VALUES (NEW.produto_id, 'saida', NEW.quantidade, 'Consumo em ordem', NEW.ordem_id::text, NEW.created_by);
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO estoque_movimentos (produto_id, tipo, quantidade, custo_unitario, motivo, referencia, created_by)
      VALUES (OLD.produto_id, 'entrada', OLD.quantidade, OLD.custo_unitario_snapshot, 'Estorno de material da ordem', OLD.ordem_id::text, OLD.created_by);
    RETURN OLD;
  END IF;
  RETURN NULL;
END; $$;
REVOKE EXECUTE ON FUNCTION mov_material_ordem() FROM public, anon, authenticated;

DROP TRIGGER IF EXISTS trg_material_ins ON ordem_materiais;
CREATE TRIGGER trg_material_ins BEFORE INSERT ON ordem_materiais
  FOR EACH ROW EXECUTE FUNCTION mov_material_ordem();
DROP TRIGGER IF EXISTS trg_material_del ON ordem_materiais;
CREATE TRIGGER trg_material_del AFTER DELETE ON ordem_materiais
  FOR EACH ROW EXECUTE FUNCTION mov_material_ordem();

-- RLS
ALTER TABLE ordem_materiais ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ordem_materiais_select" ON ordem_materiais;
CREATE POLICY "ordem_materiais_select" ON ordem_materiais FOR SELECT USING (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "ordem_materiais_insert" ON ordem_materiais;
CREATE POLICY "ordem_materiais_insert" ON ordem_materiais FOR INSERT WITH CHECK (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "ordem_materiais_delete" ON ordem_materiais;
CREATE POLICY "ordem_materiais_delete" ON ordem_materiais FOR DELETE
  USING (auth.uid() = created_by OR public.is_admin());
