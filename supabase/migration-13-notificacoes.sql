-- ============================================================
-- Build Brasil — MIGRATION 13: Notificações in-app
-- ============================================================
CREATE TABLE IF NOT EXISTS notificacoes (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  titulo     text NOT NULL,
  mensagem   text,
  link       text,
  lida       boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_notificacoes_user ON notificacoes (user_id, created_at DESC);

ALTER TABLE notificacoes ENABLE ROW LEVEL SECURITY;
-- Cada um vê/edita/exclui só as suas; qualquer autenticado pode criar (notificar outros).
DROP POLICY IF EXISTS "notificacoes_select" ON notificacoes;
CREATE POLICY "notificacoes_select" ON notificacoes FOR SELECT USING (user_id = auth.uid());
DROP POLICY IF EXISTS "notificacoes_insert" ON notificacoes;
CREATE POLICY "notificacoes_insert" ON notificacoes FOR INSERT WITH CHECK (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "notificacoes_update" ON notificacoes;
CREATE POLICY "notificacoes_update" ON notificacoes FOR UPDATE USING (user_id = auth.uid());
DROP POLICY IF EXISTS "notificacoes_delete" ON notificacoes;
CREATE POLICY "notificacoes_delete" ON notificacoes FOR DELETE USING (user_id = auth.uid());
