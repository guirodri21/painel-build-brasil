-- ============================================================
-- Build Brasil — MIGRATION: Módulo Chamados (espelho do Goalfy)
-- Board Kanban com as mesmas fases do board "Gestão" do Goalfy.
-- Os cards entram via Edge Function chamados-ingest (upsert pelo
-- id do card do Goalfy), mantendo o painel sincronizado 1:1.
-- ============================================================

-- Fases do board (colunas) — espelham o Goalfy, mas editáveis
CREATE TABLE IF NOT EXISTS chamado_fases (
  id     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome   text NOT NULL UNIQUE,
  ordem  int NOT NULL DEFAULT 0,
  cor    text,
  final  boolean NOT NULL DEFAULT false
);

INSERT INTO chamado_fases (nome, ordem, cor, final) VALUES
  ('Triagem',              1, 'blue',   false),
  ('Em Orçamento',         2, 'gray',   false),
  ('Proposta Enviada',     3, 'teal',   false),
  ('Planejamento',         4, 'yellow', false),
  ('Em Execução',          5, 'orange', false),
  ('Resolvido / Análise',  6, 'orange', false),
  ('Fechamento Financeiro',7, 'teal',   false),
  ('A Faturar',            8, 'blue',   false),
  ('Concluído',            9, 'green',  true)
ON CONFLICT (nome) DO NOTHING;

-- Cards (chamados). regiao/cliente/fase são texto livre (espelho do Goalfy,
-- sem FK, pra nunca rejeitar um valor que veio de lá).
CREATE TABLE IF NOT EXISTS chamados (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  filial         text DEFAULT 'Matriz' REFERENCES filiais(nome),
  goalfy_card_id text UNIQUE,
  titulo         text,
  cliente        text,
  regiao         text,
  descricao      text,
  prioridade     text,
  ticket_ref     text,
  fase           text NOT NULL DEFAULT 'Triagem',
  valor          numeric DEFAULT 0,
  responsavel    text,
  aberto_em      date,
  created_by     uuid REFERENCES auth.users(id),
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz
);
CREATE INDEX IF NOT EXISTS idx_chamados_fase   ON chamados (fase);
CREATE INDEX IF NOT EXISTS idx_chamados_filial ON chamados (filial);

ALTER TABLE chamado_fases ENABLE ROW LEVEL SECURITY;
ALTER TABLE chamados      ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "chamado_fases_select" ON chamado_fases;
CREATE POLICY "chamado_fases_select" ON chamado_fases FOR SELECT USING ((select auth.role()) = 'authenticated');
DROP POLICY IF EXISTS "chamado_fases_admin" ON chamado_fases;
CREATE POLICY "chamado_fases_admin_ins" ON chamado_fases FOR INSERT WITH CHECK ((select is_admin()));
CREATE POLICY "chamado_fases_admin_upd" ON chamado_fases FOR UPDATE USING ((select is_admin()));
CREATE POLICY "chamado_fases_admin_del" ON chamado_fases FOR DELETE USING ((select is_admin()));

DROP POLICY IF EXISTS "chamados_select" ON chamados;
CREATE POLICY "chamados_select" ON chamados FOR SELECT USING ((select auth.role()) = 'authenticated');
DROP POLICY IF EXISTS "chamados_insert" ON chamados;
CREATE POLICY "chamados_insert" ON chamados FOR INSERT WITH CHECK ((select auth.role()) = 'authenticated');
DROP POLICY IF EXISTS "chamados_update" ON chamados;
CREATE POLICY "chamados_update" ON chamados FOR UPDATE USING ((select auth.role()) = 'authenticated');
DROP POLICY IF EXISTS "chamados_delete" ON chamados;
CREATE POLICY "chamados_delete" ON chamados FOR DELETE USING ((select auth.uid()) = created_by OR (select is_admin()));

DROP TRIGGER IF EXISTS trg_set_updated_at ON chamados;
CREATE TRIGGER trg_set_updated_at BEFORE UPDATE ON chamados
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
