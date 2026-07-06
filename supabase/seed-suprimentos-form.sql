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
  v_fases text[] := ARRAY[
    'Solicitacao','Duvidas / Pedido Incompleto','Cotacao Enviada','Analise',
    'Logistica','Escritorio Trabalhando','Aprovacao / Dados','Portal a Vista',
    'Concluido - Pendente NF','Portal Nota','Finalizado'
  ];
BEGIN
  SELECT id INTO v_sup FROM quadros WHERE nome = 'Suprimentos' LIMIT 1;
  IF v_sup IS NULL THEN
    RAISE NOTICE 'Board Suprimentos ausente; rode seed-pipeline-operacional.sql antes.';
    RETURN;
  END IF;

  -- ---- Fases (fluxo de compras 2.0) -----------------------------------------
  DELETE FROM quadro_fases WHERE quadro_id = v_sup;
  INSERT INTO quadro_fases (quadro_id, nome, ordem, cor, final) VALUES
    (v_sup,'Solicitacao',                0,'gray',  false),
    (v_sup,'Duvidas / Pedido Incompleto',1,'yellow',false),
    (v_sup,'Cotacao Enviada',            2,'orange',false),
    (v_sup,'Analise',                    3,'blue',  false),
    (v_sup,'Logistica',                  4,'teal',  false),
    (v_sup,'Escritorio Trabalhando',     5,'blue',  false),
    (v_sup,'Aprovacao / Dados',          6,'orange',false),
    (v_sup,'Portal a Vista',             7,'teal',  false),
    (v_sup,'Concluido - Pendente NF',    8,'yellow',false),
    (v_sup,'Portal Nota',                9,'blue',  false),
    (v_sup,'Finalizado',                10,'green', true);

  -- Cards em fases antigas voltam para a entrada (nao ficam orfaos).
  UPDATE quadro_cards
     SET fase = 'Solicitacao'
   WHERE quadro_id = v_sup AND NOT (fase = ANY (v_fases));

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

  -- ---- Gate de alcada: fase antiga "Pedido Realizado" nao existe mais --------
  -- Passa a proteger a colocacao do pedido no portal ("Portal a Vista").
  UPDATE quadro_automacoes
     SET config = jsonb_set(config, '{fase}', '"Portal a Vista"', true)
   WHERE quadro_id = v_sup
     AND gatilho = 'bloqueio_fase'
     AND config->>'fase' = 'Pedido Realizado';

  RAISE NOTICE 'Seed Suprimentos 2.0 aplicado.';
END $$;
