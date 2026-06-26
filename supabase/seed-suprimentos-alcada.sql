-- ============================================================
-- Build Brasil — Alçada de aprovação de compras (board Suprimentos)
--   Regra do doc v2.0: até R$ 500 aprova o gestor operacional; acima de
--   R$ 500 exige aprovação da diretoria antes de realizar o pedido.
--
--   Implementado como gate (bloqueio_fase) na fase "Pedido Realizado", usando
--   a guarda condicional `quando` (ver validarBloqueio em web/src/lib/quadros.ts):
--   a condição aprovacao_diretoria=true só é exigida quando o valor do card > 500.
--   Idempotente. Aplicar via MCP Supabase.
-- ============================================================
DO $$
DECLARE v_sup uuid;
BEGIN
  SELECT id INTO v_sup FROM quadros WHERE nome = 'Suprimentos' LIMIT 1;
  IF v_sup IS NULL THEN
    RAISE NOTICE 'Suprimentos ausente.';
    RETURN;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM quadro_campos WHERE quadro_id = v_sup AND chave = 'aprovacao_diretoria') THEN
    INSERT INTO quadro_campos (quadro_id, chave, label, tipo, obrigatorio, mostrar_no_card, ordem)
      VALUES (v_sup,'aprovacao_diretoria','Aprovacao da diretoria (compras > R$ 500)','checkbox',false,true,0);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM quadro_automacoes WHERE quadro_id = v_sup AND nome = 'Gate: Alcada de compra') THEN
    INSERT INTO quadro_automacoes (quadro_id, nome, gatilho, ordem, config) VALUES
      (v_sup,'Gate: Alcada de compra','bloqueio_fase',20, jsonb_build_object(
         'fase','Pedido Realizado',
         'mensagem','Compras acima de R$ 500 exigem aprovacao da diretoria antes do pedido.',
         'condicoes', jsonb_build_array(
           jsonb_build_object(
             'campo','aprovacao_diretoria','valor','true',
             'quando', jsonb_build_object('campo','valor','op','>','valor',500))),
         'acoes', jsonb_build_array()
      ));
  END IF;
  RAISE NOTICE 'Alcada de compra aplicada ao board Suprimentos.';
END $$;
