-- ============================================================
-- Build Brasil — SEED: Pipeline Operacional v2.0 (Fase 2)
--   Cria, sobre o motor de Quadros, três boards integrados:
--     • Pipeline Operacional  — 6 fases + campos (checklist) + 4 botões de ação
--     • Suprimentos           — alvo do botão "Solicitar Compra"
--     • Financeiro (Solicitações) — alvo de "Solicitar Pagamento/Faturamento"
--
--   Os "botões de ação" são automações com gatilho 'botao' e ação 'criar_card'
--   (ver web/src/lib/quadros.ts → runBotao). Ao clicar num card, o botão cria
--   um card vinculado no board de destino e atualiza a situação/fase de origem.
--
--   Idempotente: não faz nada se 'Pipeline Operacional' já existir.
--   Aplicado via MCP em 2026-06-26. IDs resolvidos por variáveis (nada hardcoded).
-- ============================================================
DO $$
DECLARE
  v_op  uuid;
  v_sup uuid;
  v_fin uuid;
BEGIN
  IF EXISTS (SELECT 1 FROM quadros WHERE nome = 'Pipeline Operacional') THEN
    RAISE NOTICE 'Pipeline Operacional ja existe; nada a fazer.';
    RETURN;
  END IF;

  INSERT INTO quadros (nome, descricao, icone, cor, ordem)
    VALUES ('Suprimentos', 'Compras, cotacoes e materiais (alvo de Solicitar Compra)', 'Package', 'orange', 10)
    RETURNING id INTO v_sup;
  INSERT INTO quadros (nome, descricao, icone, cor, ordem)
    VALUES ('Financeiro (Solicitacoes)', 'Pagamentos e faturamento solicitados pela Operacao', 'Wallet', 'green', 11)
    RETURNING id INTO v_fin;
  INSERT INTO quadros (nome, descricao, icone, cor, ordem)
    VALUES ('Pipeline Operacional', 'Fluxo de execucao das demandas da Operacao', 'Wrench', 'blue', 1)
    RETURNING id INTO v_op;

  INSERT INTO quadro_fases (quadro_id, nome, ordem, cor, final) VALUES
    (v_sup,'Solicitacao',0,'gray',false),
    (v_sup,'Cotacao',1,'yellow',false),
    (v_sup,'Aprovacao',2,'orange',false),
    (v_sup,'Pedido Realizado',3,'blue',false),
    (v_sup,'Recebido',4,'teal',false),
    (v_sup,'Entregue a Operacao',5,'green',true);

  INSERT INTO quadro_fases (quadro_id, nome, ordem, cor, final) VALUES
    (v_fin,'Solicitacao',0,'gray',false),
    (v_fin,'Em Analise',1,'yellow',false),
    (v_fin,'Aprovado',2,'blue',false),
    (v_fin,'Faturamento',3,'teal',false),
    (v_fin,'Pago / Faturado',4,'green',true);

  INSERT INTO quadro_fases (quadro_id, nome, ordem, cor, final) VALUES
    (v_op,'Entrada da Operacao',0,'gray',false),
    (v_op,'Em Preparacao',1,'yellow',false),
    (v_op,'Agendamento',2,'orange',false),
    (v_op,'Em Execucao / Fechamento',3,'blue',false),
    (v_op,'Solicitacao de Faturamento',4,'teal',false),
    (v_op,'Resolvido / Concluido',5,'green',true);

  INSERT INTO quadro_campos (quadro_id, chave, label, tipo, obrigatorio, mostrar_no_card, ordem) VALUES
    (v_op,'origem_com','Origem comercial (COM)','texto',false,true,0),
    (v_op,'situacao','Situacao','texto',false,true,1),
    (v_op,'tecnico','Tecnico responsavel','texto',false,true,2),
    (v_op,'compra_necessaria','Compra necessaria?','checkbox',false,false,3),
    (v_op,'pagamento_antecipado','Pagamento antecipado?','checkbox',false,false,4),
    (v_op,'material_disponivel','Material disponivel?','checkbox',false,false,5),
    (v_op,'equipe_definida','Equipe definida?','checkbox',false,false,6),
    (v_op,'impedimento','Impedimento','texto_longo',false,false,7),
    (v_op,'precisa_faturamento','Precisa faturamento?','checkbox',false,false,8);

  INSERT INTO quadro_automacoes (quadro_id, nome, gatilho, ordem, config) VALUES
    (v_op,'Solicitar Compra','botao',0, jsonb_build_object(
       'label','Solicitar Compra','cor','orange',
       'acoes', jsonb_build_array(
         jsonb_build_object('tipo','criar_card','quadro_destino',v_sup::text,'fase_destino','Solicitacao','copiar_valor',true),
         jsonb_build_object('tipo','definir_campo','campo','situacao','valor','Aguardando Compra')
       ))),
    (v_op,'Solicitar Pagamento','botao',1, jsonb_build_object(
       'label','Solicitar Pagamento','cor','yellow',
       'acoes', jsonb_build_array(
         jsonb_build_object('tipo','criar_card','quadro_destino',v_fin::text,'fase_destino','Solicitacao','copiar_valor',true),
         jsonb_build_object('tipo','definir_campo','campo','situacao','valor','Aguardando Pagamento')
       ))),
    (v_op,'Solicitar Faturamento','botao',2, jsonb_build_object(
       'label','Solicitar Faturamento','cor','teal',
       'acoes', jsonb_build_array(
         jsonb_build_object('tipo','criar_card','quadro_destino',v_fin::text,'fase_destino','Faturamento','copiar_valor',true),
         jsonb_build_object('tipo','mover_fase','fase','Solicitacao de Faturamento'),
         jsonb_build_object('tipo','definir_campo','campo','situacao','valor','Faturamento solicitado')
       ))),
    (v_op,'Marcar Retrabalho','botao',3, jsonb_build_object(
       'label','Marcar Retrabalho','cor','red',
       'acoes', jsonb_build_array(
         jsonb_build_object('tipo','criar_card','quadro_destino',v_op::text,'fase_destino','Entrada da Operacao','copiar_valor',false),
         jsonb_build_object('tipo','notificar','mensagem','Retrabalho gerado a partir de execucao')
       )));

  -- Checklist (gatilho campo_alterado): atualiza a Situacao automaticamente.
  INSERT INTO quadro_automacoes (quadro_id, nome, gatilho, ordem, config) VALUES
    (v_op,'Impedimento detectado','campo_alterado',10, jsonb_build_object(
       'campo','impedimento','valor','',
       'acoes', jsonb_build_array(
         jsonb_build_object('tipo','definir_campo','campo','situacao','valor','Com Impedimento'),
         jsonb_build_object('tipo','notificar','mensagem','Impedimento registrado na operacao')
       ))),
    (v_op,'Material pendente','campo_alterado',11, jsonb_build_object(
       'campo','material_disponivel','valor','false',
       'acoes', jsonb_build_array(
         jsonb_build_object('tipo','definir_campo','campo','situacao','valor','Aguardando Material')
       ))),
    (v_op,'Material disponivel','campo_alterado',12, jsonb_build_object(
       'campo','material_disponivel','valor','true',
       'acoes', jsonb_build_array(
         jsonb_build_object('tipo','definir_campo','campo','situacao','valor','Material OK')
       )));

  RAISE NOTICE 'Seed Pipeline Operacional aplicado.';
END $$;
