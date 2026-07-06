-- ============================================================
-- Build Brasil — SEED: Suprimentos 2.0 (form + fases)  [mesma logica de Contas a Pagar]
--   Sobre o board "Suprimentos" ja existente:
--     • Redefine as fases para o fluxo pedido pelo usuario (11 status)
--     • Adiciona os campos do formulario "Suprimentos - 2.0 | Build"
--     • Migra cards existentes para a fase de entrada
--     • Repoint do gate de alcada (fase antiga "Pedido Realizado" -> "Portal a Vista")
--
--   O botao "Solicitar Compra" no card OP ja cria card aqui na fase "Solicitacao"
--   (seed-pipeline-operacional.sql) e continua valido — nao precisa mexer.
--
--   IDs resolvidos por nome (nada hardcoded). Idempotente: pode rodar 2x.
--   Aplicar via Supabase SQL Editor ou MCP (apply_migration/execute_sql).
-- ============================================================
DO $$
DECLARE
  v_sup uuid;
  v_op  uuid;
  v_fases text[] := ARRAY[
    'Solicitação','Dúvidas / Pedido Incompleto','Cotação enviada - Análise',
    'LOGISTICA','ESCRITORIO - TRABALHANDO','Aprovação / Dados','PORTAL - A VISTA',
    'CONCLUIDO | PEND. NF','PORTAL - NOTA','FINAL'
  ];
BEGIN
  SELECT id INTO v_sup FROM quadros WHERE nome = 'Suprimentos' LIMIT 1;
  SELECT id INTO v_op  FROM quadros WHERE nome = 'Pipeline Operacional' LIMIT 1;
  IF v_sup IS NULL THEN
    RAISE NOTICE 'Board Suprimentos ausente; rode seed-pipeline-operacional.sql antes.';
    RETURN;
  END IF;

  -- ---- Migra cards dos nomes antigos -> novos (fase é texto). Merge Cotacao+Analise.
  UPDATE quadro_cards SET fase = CASE
    WHEN fase = 'Solicitacao'                 THEN 'Solicitação'
    WHEN fase = 'Duvidas / Pedido Incompleto' THEN 'Dúvidas / Pedido Incompleto'
    WHEN fase = 'Cotacao Enviada'             THEN 'Cotação enviada - Análise'
    WHEN fase = 'Analise'                     THEN 'Cotação enviada - Análise'
    WHEN fase = 'Logistica'                   THEN 'LOGISTICA'
    WHEN fase = 'Escritorio Trabalhando'      THEN 'ESCRITORIO - TRABALHANDO'
    WHEN fase = 'Aprovacao / Dados'           THEN 'Aprovação / Dados'
    WHEN fase = 'Portal a Vista'              THEN 'PORTAL - A VISTA'
    WHEN fase = 'Concluido - Pendente NF'     THEN 'CONCLUIDO | PEND. NF'
    WHEN fase = 'Portal Nota'                 THEN 'PORTAL - NOTA'
    WHEN fase = 'Finalizado'                  THEN 'FINAL'
    WHEN fase = ANY (v_fases)                 THEN fase   -- já está num nome novo: mantem
    ELSE 'Solicitação'
  END
  WHERE quadro_id = v_sup;

  -- ---- Fases (exatamente como o print: 10 colunas) --------------------------
  DELETE FROM quadro_fases WHERE quadro_id = v_sup;
  INSERT INTO quadro_fases (quadro_id, nome, ordem, cor, final) VALUES
    (v_sup,'Solicitação',                 0,'gray',  false),
    (v_sup,'Dúvidas / Pedido Incompleto', 1,'yellow',false),
    (v_sup,'Cotação enviada - Análise',   2,'orange',false),
    (v_sup,'LOGISTICA',                   3,'blue',  false),
    (v_sup,'ESCRITORIO - TRABALHANDO',    4,'teal',  false),
    (v_sup,'Aprovação / Dados',           5,'orange',false),
    (v_sup,'PORTAL - A VISTA',            6,'teal',  false),
    (v_sup,'CONCLUIDO | PEND. NF',        7,'yellow',false),
    (v_sup,'PORTAL - NOTA',               8,'blue',  false),
    (v_sup,'FINAL',                       9,'green', true);

  -- Botao "Solicitar Compra" (card OP) cria na fase de entrada nova.
  IF v_op IS NOT NULL THEN
    UPDATE quadro_automacoes
       SET config = jsonb_set(config, '{acoes,0,fase_destino}', '"Solicitação"', true)
     WHERE quadro_id = v_op AND nome = 'Solicitar Compra'
       AND config->'acoes'->0->>'tipo' = 'criar_card';
  END IF;

  -- ---- Campos do formulario (idempotente por chave) -------------------------
  INSERT INTO quadro_campos (quadro_id, chave, label, tipo, obrigatorio, mostrar_no_card, ordem, opcoes)
  SELECT v_sup, x.chave, x.label, x.tipo, x.obrig, x.card, x.ordem, x.opcoes
  FROM (VALUES
    ('tipo_solicitacao',        'Tipo de solicitacao',                                  'selecao',     true,  true,  0,
        '["Material","Servico","Equipamento","Ferramenta","EPI","Outros"]'::jsonb),
    ('regiao',                  'Regiao',                                               'selecao',     true,  true,  1,
        '["Norte","Nordeste","Centro-Oeste","Sudeste","Sul"]'::jsonb),
    ('prioridade_solic',        'Prioridade da solicitacao',                            'selecao',     true,  true,  2,
        '["Urgente","Importante","Normal"]'::jsonb),
    ('centro_custo',            'Centro de custo',                                      'texto',       true,  true,  3, '[]'::jsonb),
    ('info_cotacao',            'Informacoes da cotacao',                               'selecao',     true,  false, 4,
        '["Preciso de cotacao","Cotacao anexada","Compra direta / fornecedor definido"]'::jsonb),
    ('descricao_detalhada',     'Descricao detalhada (Item / Qnt / Descricao / Link)',  'texto_longo', false, false, 5, '[]'::jsonb),
    ('prazo_cotacao',           'Prazo - Data limite para receber a cotacao',           'data',        false, false, 6, '[]'::jsonb),
    ('prazo_entrega',           'Prazo - Data prevista de execucao ou entrega',         'data',        false, false, 7, '[]'::jsonb),
    ('anexo_ref',               'Anexo (Foto, referencia e outros) - link',             'texto',       false, false, 8, '[]'::jsonb),
    ('local_entrega',           'Local de Utilizacao / Entrega',                        'texto_longo', true,  true,  9, '[]'::jsonb),
    ('responsavel_recebimento', 'Responsavel pelo recebimento',                         'texto',       true,  true, 10, '[]'::jsonb),
    ('telefone_responsavel',    'Telefone responsavel',                                 'texto',       false, false,11, '[]'::jsonb)
  ) AS x(chave,label,tipo,obrig,card,ordem,opcoes)
  WHERE NOT EXISTS (
    SELECT 1 FROM quadro_campos qc WHERE qc.quadro_id = v_sup AND qc.chave = x.chave
  );

  -- ---- Gate de alcada: protege a colocacao do pedido no portal ("PORTAL - A VISTA").
  UPDATE quadro_automacoes
     SET config = jsonb_set(config, '{fase}', '"PORTAL - A VISTA"', true)
   WHERE quadro_id = v_sup
     AND gatilho = 'bloqueio_fase'
     AND config->>'fase' IN ('Pedido Realizado','Portal a Vista');

  RAISE NOTICE 'Seed Suprimentos 2.0 aplicado.';
END $$;
