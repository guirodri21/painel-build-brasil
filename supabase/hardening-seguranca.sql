-- ============================================================
-- Build Brasil — Hardening de segurança (aplicado via MCP em 2026-07)
--   1) search_path fixo em 3 funções-gatilho (advisor 0011)
--   2) RLS de "contas" restrita a admin OU pode_financeiro
--
--   (Pendente e manual: ativar "Leaked Password Protection" no
--    Supabase → Authentication → Password. Não há API no MCP.)
-- ============================================================

-- 1) search_path fixo -----------------------------------------
ALTER FUNCTION public.quadro_cards_set_numero() SET search_path = public;
ALTER FUNCTION public.chamados_set_numero()     SET search_path = public;
ALTER FUNCTION public.chamados_marca_concluido() SET search_path = public;

-- 2) "contas" só para admin ou quem tem pode_financeiro -------
DROP POLICY IF EXISTS contas_select ON public.contas;
CREATE POLICY contas_select ON public.contas FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p
    WHERE p.id = (SELECT auth.uid()) AND (p.role = 'admin' OR p.pode_financeiro)));

DROP POLICY IF EXISTS contas_insert ON public.contas;
CREATE POLICY contas_insert ON public.contas FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p
    WHERE p.id = (SELECT auth.uid()) AND (p.role = 'admin' OR p.pode_financeiro)));

DROP POLICY IF EXISTS contas_update ON public.contas;
CREATE POLICY contas_update ON public.contas FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p
    WHERE p.id = (SELECT auth.uid()) AND (p.role = 'admin' OR p.pode_financeiro)));

DROP POLICY IF EXISTS contas_delete ON public.contas;
CREATE POLICY contas_delete ON public.contas FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p
    WHERE p.id = (SELECT auth.uid()) AND (p.role = 'admin' OR p.pode_financeiro)));

-- 3) "despesas_gerais" só para admin ou quem tem pode_financeiro ----
DROP POLICY IF EXISTS despesas_select ON public.despesas_gerais;
CREATE POLICY despesas_select ON public.despesas_gerais FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p
    WHERE p.id = (SELECT auth.uid()) AND (p.role = 'admin' OR p.pode_financeiro)));

DROP POLICY IF EXISTS despesas_insert ON public.despesas_gerais;
CREATE POLICY despesas_insert ON public.despesas_gerais FOR INSERT TO authenticated
  WITH CHECK (((SELECT auth.uid()) = created_by) AND EXISTS (SELECT 1 FROM public.profiles p
    WHERE p.id = (SELECT auth.uid()) AND (p.role = 'admin' OR p.pode_financeiro)));

DROP POLICY IF EXISTS despesas_update ON public.despesas_gerais;
CREATE POLICY despesas_update ON public.despesas_gerais FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p
    WHERE p.id = (SELECT auth.uid()) AND (p.role = 'admin' OR p.pode_financeiro)));

DROP POLICY IF EXISTS despesas_delete ON public.despesas_gerais;
CREATE POLICY despesas_delete ON public.despesas_gerais FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p
    WHERE p.id = (SELECT auth.uid()) AND (p.role = 'admin' OR p.pode_financeiro)));

-- Front: a Home e o Modo TV escondem Saldo/despesas para quem não é financeiro
-- (ver web/src/app/(app)/page.tsx e web/src/app/tv/page.tsx).
