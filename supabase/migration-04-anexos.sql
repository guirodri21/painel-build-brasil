-- ============================================================
-- Build Brasil — MIGRATION 04: Anexos nas ordens (Storage)
-- ============================================================
INSERT INTO storage.buckets (id, name, public)
  VALUES ('ordens-anexos', 'ordens-anexos', false)
  ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "ordens_anexos_select" ON storage.objects;
CREATE POLICY "ordens_anexos_select" ON storage.objects FOR SELECT
  USING (bucket_id = 'ordens-anexos' AND auth.role() = 'authenticated');
DROP POLICY IF EXISTS "ordens_anexos_insert" ON storage.objects;
CREATE POLICY "ordens_anexos_insert" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'ordens-anexos' AND auth.role() = 'authenticated');
DROP POLICY IF EXISTS "ordens_anexos_delete" ON storage.objects;
CREATE POLICY "ordens_anexos_delete" ON storage.objects FOR DELETE
  USING (bucket_id = 'ordens-anexos' AND auth.role() = 'authenticated');

CREATE TABLE IF NOT EXISTS ordem_anexos (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ordem_id   uuid NOT NULL REFERENCES ordens(id) ON DELETE CASCADE,
  path       text NOT NULL,
  tipo       text NOT NULL DEFAULT 'foto' CHECK (tipo IN ('foto','antes','depois','assinatura','doc')),
  legenda    text,
  filial     text DEFAULT 'Matriz' REFERENCES filiais(nome),
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ordem_anexos_ordem ON ordem_anexos (ordem_id);

ALTER TABLE ordem_anexos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ordem_anexos_select" ON ordem_anexos;
CREATE POLICY "ordem_anexos_select" ON ordem_anexos FOR SELECT USING (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "ordem_anexos_insert" ON ordem_anexos;
CREATE POLICY "ordem_anexos_insert" ON ordem_anexos FOR INSERT WITH CHECK (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "ordem_anexos_delete" ON ordem_anexos;
CREATE POLICY "ordem_anexos_delete" ON ordem_anexos FOR DELETE
  USING (auth.uid() = created_by OR public.is_admin());
