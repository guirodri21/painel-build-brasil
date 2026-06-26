-- ============================================================
-- Build Brasil — SEED: Pipeline Operacional v2.1 (aderência ao doc v2.0)
--   ADITIVO e idempotente sobre o board já criado por
--   seed-pipeline-operacional.sql. Resolve ids por nome e só insere o que falta.
--
--   Acrescenta, fiel ao "Módulo Operação v2.0":
--     • Board "Apoio Interno" (alvo de "Solicitar Apoio Interno")
--     • Botão  "Solicitar Apoio Interno" (Fase 2 — Em Preparação)
--     • Renomeia "Solicitar Pagamento" → "Solicitar Pagamento Antecipado"
--     • Botão  "Solicitar Pagamento Pós-Serviço" (Fase 4 — Execução/Fechamento)
--     • Campo  liberado_agendamento (checklist final da Fase 2) + soma ao gate
--     • Converte campo situacao em 'selecao' com os status do doc (por fase)
--     • Ajusta "Marcar Retrabalho" para gravar origem = 'retrabalho'
--
--   Cada bloco é guardado por NOT EXISTS / checagem de coluna, então rodar 2x
--   não duplica nada. Aplicar via MCP Supabase (apply_migration/execute_sql).
-- ============================================================
DO $$
DECLARE
  v_op   uuid;
  v_fin  uuid;
  v_apoio uuid;
BEGIN
  SELECT id INTO v_op  FROM quadros WHERE nome = 'Pipeline Operacional' LIMIT 1;
  SELECT id INTO v_fin FROM quadros WHERE nome = 'Financeiro (Solicitacoes)' LIMIT 1;
  IF v_op IS NULL THEN
    RAISE NOTICE 'Pipeline Operacional ausente; rode seed-pipeline-operacional.sql antes.';
    RETURN;
  END IF;

  -- ---- Board "Apoio Interno" (idempotente) ----------------------------------
  SELECT id INTO v_apoio FROM quadros WHERE nome = 'Apoio Interno' LIMIT 1;
  IF v_apoio IS NULL THEN
    INSERT INTO quadros (nome, descricao, icone, cor, ordem)
      VALUES ('Apoio Interno', 'Demandas internas vinculadas a um card OP', 'LifeBuoy', 'teal', 12)
      RETURNING id INTO v_apoio;
    INSERT INTO quadro_fases (quadro_id, nome, ordem, cor, final) VALUES
      (v_apoio,'Solicitacao',0,'gray',false),
      (v_apoio,'Em Andamento',1,'yellow',false),
      (v_apoio,'Concluido',2,'green',true);
  END IF;

  -- ---- Campo "Liberado para agendamento?" (Fase 2, marcação final) -----------
  IF NOT EXISTS (SELECT 1 FROM quadro_campos WHERE quadro_id = v_op AND chave = 'liberado_agendamento') THEN
    INSERT INTO quadro_campos (quadro_id, chave, label, tipo, obrigatorio, mostrar_no_card, ordem)
      VALUES (v_op,'liberado_agendamento','Liberado para agendamento?','checkbox',false,false,9);
  END IF;

  -- ---- Converte "situacao" em seleção com os status do doc -------------------
  UPDATE quadro_campos
     SET tipo = 'selecao',
         opcoes = to_jsonb(ARRAY[
           'Novo','Recebido','Dados Incompletos','Pronto para Preparacao',
           'Em Preparacao','Com Impedimento','Aguardando Compra','Aguardando Pagamento',
           'Aguardando Material','Material OK','Pronto para Agendamento',
           'Agendamento Solicitado','Confirmado','Reagendado','Pronto para Execucao',
           'Tecnico em Deslocamento','No Local','Em Execucao','Executado','Parcial',
           'Improdutivo','Pendente Relatorio/Fotos','Aprovado para Faturamento',
           'Faturamento solicitado','Aguardando Pagamento Pos-Servico',
           'Liberado','Faturado','Nao Faturavel',
           'Concluido','Resolvido sem Faturamento','Resolvido com Faturamento',
           'Cancelado','Encerrado Administrativamente'
         ])
   WHERE quadro_id = v_op AND chave = 'situacao';

  -- ---- Renomeia o pagamento atual para "Antecipado" -------------------------
  UPDATE quadro_automacoes
     SET nome   = 'Solicitar Pagamento Antecipado',
         config = jsonb_set(config, '{label}', '"Solicitar Pagamento Antecipado"', true)
   WHERE quadro_id = v_op AND nome = 'Solicitar Pagamento';

  -- ---- Botão "Solicitar Apoio Interno" (Fase 2) -----------------------------
  IF NOT EXISTS (SELECT 1 FROM quadro_automacoes WHERE quadro_id = v_op AND nome = 'Solicitar Apoio Interno') THEN
    INSERT INTO quadro_automacoes (quadro_id, nome, gatilho, ordem, config) VALUES
      (v_op,'Solicitar Apoio Interno','botao',4, jsonb_build_object(
         'label','Solicitar Apoio Interno','cor','teal',
         'acoes', jsonb_build_array(
           jsonb_build_object('tipo','criar_card','quadro_destino',v_apoio::text,'fase_destino','Solicitacao','copiar_valor',false),
           jsonb_build_object('tipo','definir_campo','campo','situacao','valor','Em Preparacao')
         )));
  END IF;

  -- ---- Botão "Solicitar Pagamento Pós-Serviço" (Fase 4) ---------------------
  IF NOT EXISTS (SELECT 1 FROM quadro_automacoes WHERE quadro_id = v_op AND nome = 'Solicitar Pagamento Pos-Servico') THEN
    INSERT INTO quadro_automacoes (quadro_id, nome, gatilho, ordem, config) VALUES
      (v_op,'Solicitar Pagamento Pos-Servico','botao',5, jsonb_build_object(
         'label','Solicitar Pagamento Pos-Servico','cor','yellow',
         'acoes', jsonb_build_array(
           jsonb_build_object('tipo','criar_card','quadro_destino',v_fin::text,'fase_destino','Solicitacao','copiar_valor',true),
           jsonb_build_object('tipo','definir_campo','campo','situacao','valor','Aguardando Pagamento Pos-Servico')
         )));
  END IF;

  -- ---- "Marcar Retrabalho" grava origem = 'retrabalho' ----------------------
  UPDATE quadro_automacoes
     SET config = jsonb_set(
           config,
           '{acoes,0,origem}',
           '"retrabalho"',
           true)
   WHERE quadro_id = v_op AND nome = 'Marcar Retrabalho';

  -- ---- Gate de Agendamento passa a exigir "Liberado para agendamento" --------
  UPDATE quadro_automacoes
     SET config = jsonb_set(
           config,
           '{condicoes}',
           (config->'condicoes') || jsonb_build_array(
             jsonb_build_object('campo','liberado_agendamento','valor','true')),
           true)
   WHERE quadro_id = v_op
     AND gatilho = 'bloqueio_fase'
     AND config->>'fase' = 'Agendamento'
     AND NOT (config->'condicoes' @> jsonb_build_array(
               jsonb_build_object('campo','liberado_agendamento','valor','true')));

  RAISE NOTICE 'Seed Pipeline Operacional v2.1 aplicado.';
END $$;
