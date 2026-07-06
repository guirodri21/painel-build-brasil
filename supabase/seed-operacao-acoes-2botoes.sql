-- ============================================================
-- Build Brasil — SEED: Acoes do card OP reduzidas a 2 botoes
--   Pedido do usuario: em "Acoes" do card do Pipeline Operacional deixar SO:
--     • Solicitar Suprimentos  -> board Suprimentos      (situacao "Solicitacao de Material")
--     • Solicitar Pagamento     -> board Contas a Pagar   (situacao "Solicitacao de Pagamento")
--   Remove os demais (Solicitar Compra/Faturamento/Apoio/Retrabalho/Pos-Servico/
--   Gerar Conta a Pagar). Ambos criam em OUTRO board -> abrem o formulario inline
--   (quadro-card-modal → AcaoCriarCardModal) e nascem na 1a etapa do destino.
--
--   IDs por nome (nada hardcoded). Idempotente: apaga todos os botoes e recria os 2.
--   Aplicado via MCP (apply_migration operacao_acoes_2botoes) em 2026-07-06.
-- ============================================================
DO $$
DECLARE
  v_op  uuid;
  v_sup uuid;
  v_fin uuid;
BEGIN
  SELECT id INTO v_op  FROM quadros WHERE nome = 'Pipeline Operacional' LIMIT 1;
  SELECT id INTO v_sup FROM quadros WHERE nome = 'Suprimentos' LIMIT 1;
  SELECT id INTO v_fin FROM quadros WHERE nome = 'Contas a Pagar' LIMIT 1;
  IF v_op IS NULL THEN RAISE NOTICE 'Pipeline Operacional ausente.'; RETURN; END IF;

  DELETE FROM quadro_automacoes WHERE quadro_id = v_op AND gatilho = 'botao';

  IF v_sup IS NOT NULL THEN
    INSERT INTO quadro_automacoes (quadro_id, nome, gatilho, ordem, config) VALUES
    (v_op,'Solicitar Suprimentos','botao',0, jsonb_build_object(
       'label','Solicitar Suprimentos','cor','orange',
       'acoes', jsonb_build_array(
         jsonb_build_object('tipo','criar_card','quadro_destino',v_sup::text,'fase_destino','Solicitação','copiar_valor',true),
         jsonb_build_object('tipo','definir_campo','campo','situacao','valor','Solicitacao de Material')
       )));
  END IF;

  IF v_fin IS NOT NULL THEN
    INSERT INTO quadro_automacoes (quadro_id, nome, gatilho, ordem, config) VALUES
    (v_op,'Solicitar Pagamento','botao',1, jsonb_build_object(
       'label','Solicitar Pagamento','cor','green',
       'acoes', jsonb_build_array(
         jsonb_build_object('tipo','criar_card','quadro_destino',v_fin::text,'fase_destino','Nova Solicitacao','copiar_valor',true),
         jsonb_build_object('tipo','definir_campo','campo','situacao','valor','Solicitacao de Pagamento')
       )));
  END IF;
END $$;
