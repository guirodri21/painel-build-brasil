-- ============================================================
-- Build Brasil — MIGRATION 06: Checklist por linha de serviço
-- ============================================================
CREATE TABLE IF NOT EXISTS checklist_templates (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  linha_servico  text NOT NULL REFERENCES linhas_servico(nome) ON DELETE CASCADE,
  item           text NOT NULL,
  ordem_exibicao int NOT NULL DEFAULT 0,
  created_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (linha_servico, item)
);

CREATE TABLE IF NOT EXISTS ordem_checklist (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ordem_id   uuid NOT NULL REFERENCES ordens(id) ON DELETE CASCADE,
  item       text NOT NULL,
  feito      boolean NOT NULL DEFAULT false,
  obs        text,
  filial     text DEFAULT 'Matriz' REFERENCES filiais(nome),
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (ordem_id, item)
);
CREATE INDEX IF NOT EXISTS idx_ordem_checklist_ordem ON ordem_checklist (ordem_id);

ALTER TABLE checklist_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE ordem_checklist     ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "checklist_templates_select" ON checklist_templates;
CREATE POLICY "checklist_templates_select" ON checklist_templates FOR SELECT USING (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "checklist_templates_admin" ON checklist_templates;
CREATE POLICY "checklist_templates_admin" ON checklist_templates FOR ALL
  USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "ordem_checklist_select" ON ordem_checklist;
CREATE POLICY "ordem_checklist_select" ON ordem_checklist FOR SELECT USING (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "ordem_checklist_insert" ON ordem_checklist;
CREATE POLICY "ordem_checklist_insert" ON ordem_checklist FOR INSERT WITH CHECK (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "ordem_checklist_update" ON ordem_checklist;
CREATE POLICY "ordem_checklist_update" ON ordem_checklist FOR UPDATE USING (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "ordem_checklist_delete" ON ordem_checklist;
CREATE POLICY "ordem_checklist_delete" ON ordem_checklist FOR DELETE
  USING (auth.uid() = created_by OR public.is_admin());
