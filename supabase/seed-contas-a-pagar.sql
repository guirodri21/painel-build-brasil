-- ============================================================
-- Build Brasil — SEED: Contas a Pagar (reaproveita "Financeiro (Solicitacoes)")
--   Transforma o board de solicitacoes financeiras num board de Contas a Pagar:
--     • Renomeia "Financeiro (Solicitacoes)" -> "Contas a Pagar"
--     • Redefine as fases para o fluxo de aprovacao de pagamento (9 status)
--     • Adiciona os campos do formulario (Centro de Custo, Solicitante, Cliente,
--       Fornecedor/Prestador, Forma de pagamento, Datas, Documento, Descricao)
--     • Repoint dos botoes antigos da Operacao para a nova fase de entrada
--     • Novo botao no card OP: "Gerar Conta a Pagar"
--
--   IDs resolvidos por nome (nada hardcoded). Idempotente: pode rodar 2x.
--   Aplicar via Supabase SQL Editor ou MCP (apply_migration/execute_sql).
-- ============================================================
DO $$
DECLARE
  v_fin uuid;
  v_op  uuid;
  v_fases text[] := ARRAY[
    'Nova Solicitacao','Aguardando Complemento','Aguardando Aprovacao',
    'Validacao Financeira','Aprovado para Pagamento','Agendado',
    'Atrasado','Pago','Negado / Cancelado'
  ];
BEGIN
  -- Resolve o board (ja renomeado ou ainda com o nome antigo).
  SELECT id INTO v_fin FROM quadros
   WHERE nome IN ('Contas a Pagar','Financeiro (Solicitacoes)')
   ORDER BY (nome = 'Contas a Pagar') DESC LIMIT 1;
  SELECT id INTO v_op FROM quadros WHERE nome = 'Pipeline Operacional' LIMIT 1;

  IF v_fin IS NULL THEN
    RAISE NOTICE 'Board financeiro ausente; rode seed-pipeline-operacional.sql antes.';
    RETURN;
  END IF;

  -- ---- Meta do board --------------------------------------------------------
  UPDATE quadros
     SET nome = 'Contas a Pagar',
         descricao = 'Solicitacoes de pagamento a fornecedores/prestadores (contas a pagar)',
         icone = 'Banknote',
         cor = 'green'
   WHERE id = v_fin;

  -- ---- Fases (fluxo de aprovacao de pagamento) ------------------------------
  DELETE FROM quadro_fases WHERE quadro_id = v_fin;
  INSERT INTO quadro_fases (quadro_id, nome, ordem, cor, final) VALUES
    (v_fin,'Nova Solicitacao',        0,'gray',  false),
    (v_fin,'Aguardando Complemento',  1,'yellow',false),
    (v_fin,'Aguardando Aprovacao',    2,'orange',false),
    (v_fin,'Validacao Financeira',    3,'blue',  false),
    (v_fin,'Aprovado para Pagamento', 4,'teal',  false),
    (v_fin,'Agendado',                5,'blue',  false),
    (v_fin,'Atrasado',                6,'red',   false),
    (v_fin,'Pago',                    7,'green', true),
    (v_fin,'Negado / Cancelado',      8,'red',   true);

  -- Cards que estavam em fases antigas voltam para a entrada (nao ficam orfaos).
  UPDATE quadro_cards
     SET fase = 'Nova Solicitacao'
   WHERE quadro_id = v_fin AND NOT (fase = ANY (v_fases));

  -- ---- Campos do formulario (idempotente por chave) -------------------------
  INSERT INTO quadro_campos (quadro_id, chave, label, tipo, obrigatorio, mostrar_no_card, ordem, opcoes)
  SELECT v_fin, x.chave, x.label, x.tipo, x.obrig, x.card, x.ordem, x.opcoes
  FROM (VALUES
    ('centro_custo',      'Centro de Custo (CC)',           'texto',       false, true,  0, '[]'::jsonb),
    ('solicitante',       'Solicitante',                    'texto',       false, true,  1, '[]'::jsonb),
    ('cliente_final',     'Cliente',                        'texto',       false, true,  2, '[]'::jsonb),
    ('fornecedor',        'Fornecedor / Prestador',         'texto',       true,  true,  3, '[]'::jsonb),
    ('forma_pagamento',   'Forma de pagamento',             'selecao',     true,  false, 4,
        '["Pix","Boleto","Transferencia (TED/DOC)","Cartao","Dinheiro"]'::jsonb),
    ('data_vencimento',   'Data de Vencimento',             'data',        true,  true,  5, '[]'::jsonb),
    ('data_conclusao',    'Data de conclusao de servico',   'data',        false, false, 6, '[]'::jsonb),
    ('documento_anexo',   'Documento Anexo (link)',         'texto',       false, false, 7, '[]'::jsonb),
    ('descricao_despesa', 'Descricao da Despesa',           'texto_longo', true,  false, 8, '[]'::jsonb)
  ) AS x(chave,label,tipo,obrig,card,ordem,opcoes)
  WHERE NOT EXISTS (
    SELECT 1 FROM quadro_campos qc WHERE qc.quadro_id = v_fin AND qc.chave = x.chave
  );

  -- ---- Botoes na Operacao ---------------------------------------------------
  IF v_op IS NOT NULL THEN
    -- Novo botao "Gerar Conta a Pagar" no card OP.
    IF NOT EXISTS (SELECT 1 FROM quadro_automacoes WHERE quadro_id = v_op AND nome = 'Gerar Conta a Pagar') THEN
      INSERT INTO quadro_automacoes (quadro_id, nome, gatilho, ordem, config) VALUES
        (v_op,'Gerar Conta a Pagar','botao',6, jsonb_build_object(
           'label','Gerar Conta a Pagar','cor','green',
           'acoes', jsonb_build_array(
             jsonb_build_object('tipo','criar_card','quadro_destino',v_fin::text,'fase_destino','Nova Solicitacao','copiar_valor',true),
             jsonb_build_object('tipo','definir_campo','campo','situacao','valor','Aguardando Pagamento')
           )));
    END IF;

    -- Botoes antigos que apontavam para fases removidas -> nova fase de entrada.
    UPDATE quadro_automacoes
       SET config = jsonb_set(config, '{acoes,0,fase_destino}', '"Nova Solicitacao"', true)
     WHERE quadro_id = v_op
       AND nome IN ('Solicitar Pagamento Antecipado','Solicitar Pagamento Pos-Servico','Solicitar Faturamento')
       AND config->'acoes'->0->>'quadro_destino' = v_fin::text;
  END IF;

  RAISE NOTICE 'Seed Contas a Pagar aplicado.';
END $$;
