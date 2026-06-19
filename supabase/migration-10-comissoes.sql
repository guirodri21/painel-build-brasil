-- ============================================================
-- Build Brasil — MIGRATION 10: Regras de comissão (por equipe)
-- ============================================================
CREATE TABLE IF NOT EXISTS comissao_regras (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  filial     text DEFAULT 'Matriz' REFERENCES filiais(nome),
  equipe     text NOT NULL REFERENCES equipes(nome) ON DELETE CASCADE,
  base       text NOT NULL DEFAULT 'receita' CHECK (base IN ('receita','margem')),
  percentual numeric NOT NULL DEFAULT 0 CHECK (percentual >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (filial, equipe)
);

ALTER TABLE comissao_regras ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "comissao_regras_select" ON comissao_regras;
CREATE POLICY "comissao_regras_select" ON comissao_regras FOR SELECT USING (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "comissao_regras_admin" ON comissao_regras;
CREATE POLICY "comissao_regras_admin" ON comissao_regras FOR ALL
  USING (public.is_admin()) WITH CHECK (public.is_admin());
