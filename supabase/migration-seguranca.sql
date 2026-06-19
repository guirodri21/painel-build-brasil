-- ============================================================
-- Build Brasil — MIGRATION: Endurecimento de segurança + cron
-- (espelha o que foi aplicado via MCP no projeto Supabase)
-- ============================================================

-- 1. Funções SECURITY DEFINER: remover execução pública desnecessária
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM public, anon, authenticated;
-- is_admin() é usada nas políticas RLS → 'authenticated' precisa executar; 'anon' não.
REVOKE EXECUTE ON FUNCTION public.is_admin() FROM public, anon;

-- 2. set_updated_at com search_path fixo (evita Function Search Path Mutable)
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END; $$;

-- 3. Índices em foreign keys (performance + RLS por created_by/filial)
CREATE INDEX IF NOT EXISTS idx_ordens_created_by        ON ordens (created_by);
CREATE INDEX IF NOT EXISTS idx_despesas_created_by      ON despesas_gerais (created_by);
CREATE INDEX IF NOT EXISTS idx_metas_created_by         ON metas (created_by);
CREATE INDEX IF NOT EXISTS idx_produtos_created_by      ON produtos (created_by);
CREATE INDEX IF NOT EXISTS idx_clientes_created_by      ON clientes (created_by);
CREATE INDEX IF NOT EXISTS idx_contas_created_by        ON contas (created_by);
CREATE INDEX IF NOT EXISTS idx_orcamentos_created_by    ON orcamentos (created_by);
CREATE INDEX IF NOT EXISTS idx_funcionarios_created_by  ON funcionarios (created_by);
CREATE INDEX IF NOT EXISTS idx_integracoes_created_by   ON integracoes (created_by);
CREATE INDEX IF NOT EXISTS idx_estmov_created_by        ON estoque_movimentos (created_by);
CREATE INDEX IF NOT EXISTS idx_ordmat_created_by        ON ordem_materiais (created_by);
CREATE INDEX IF NOT EXISTS idx_ordanexos_created_by     ON ordem_anexos (created_by);
CREATE INDEX IF NOT EXISTS idx_ordchk_created_by        ON ordem_checklist (created_by);
CREATE INDEX IF NOT EXISTS idx_metas_funcionario        ON metas (funcionario_id);
CREATE INDEX IF NOT EXISTS idx_contas_ordem             ON contas (ordem_id);
CREATE INDEX IF NOT EXISTS idx_orcamentos_ordem         ON orcamentos (ordem_id);
CREATE INDEX IF NOT EXISTS idx_comissao_equipe          ON comissao_regras (equipe);
CREATE INDEX IF NOT EXISTS idx_funcionarios_equipe      ON funcionarios (equipe);
CREATE INDEX IF NOT EXISTS idx_ordmat_produto           ON ordem_materiais (produto_id);
CREATE INDEX IF NOT EXISTS idx_conversas_funcionario    ON conversas_whatsapp (funcionario_id);
CREATE INDEX IF NOT EXISTS idx_ordens_filial            ON ordens (filial);
CREATE INDEX IF NOT EXISTS idx_produtos_filial          ON produtos (filial);
CREATE INDEX IF NOT EXISTS idx_contas_filial            ON contas (filial);

-- 4. Digest diário automático (pg_cron) — notifica admins
CREATE EXTENSION IF NOT EXISTS pg_cron;

CREATE OR REPLACE FUNCTION gerar_alertas_diarios()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_prox int; v_vencidas int; v_baixo int; v_admin record; v_msg text;
BEGIN
  SELECT count(*) INTO v_prox     FROM contas WHERE NOT pago AND vencimento BETWEEN current_date AND current_date + 3;
  SELECT count(*) INTO v_vencidas FROM contas WHERE NOT pago AND vencimento < current_date;
  SELECT count(*) INTO v_baixo    FROM produtos WHERE ativo AND estoque_atual <= estoque_minimo;
  IF v_prox = 0 AND v_vencidas = 0 AND v_baixo = 0 THEN RETURN; END IF;
  v_msg := concat_ws(' · ',
    CASE WHEN v_vencidas > 0 THEN v_vencidas || ' conta(s) vencida(s)' END,
    CASE WHEN v_prox > 0 THEN v_prox || ' vencendo em 3 dias' END,
    CASE WHEN v_baixo > 0 THEN v_baixo || ' produto(s) em estoque baixo' END);
  FOR v_admin IN SELECT id FROM profiles WHERE role = 'admin' LOOP
    IF NOT EXISTS (SELECT 1 FROM notificacoes WHERE user_id = v_admin.id AND titulo = 'Resumo diário' AND created_at::date = current_date) THEN
      INSERT INTO notificacoes (user_id, titulo, mensagem, link) VALUES (v_admin.id, 'Resumo diário', v_msg, '/contas');
    END IF;
  END LOOP;
END; $$;
REVOKE EXECUTE ON FUNCTION gerar_alertas_diarios() FROM public, anon, authenticated;

SELECT cron.schedule('alertas-diarios', '0 11 * * *', $$SELECT gerar_alertas_diarios()$$);
