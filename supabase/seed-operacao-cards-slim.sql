-- ============================================================
-- Build Brasil — SEED: Operacao 2.1 (enxuga os cards do Pipeline Operacional)
--   Pedido do usuario:
--     • Card OP fica so com os campos ate "Tecnico responsavel"
--       (origem_com, situacao, tecnico) — remove todo o resto (checklist,
--       fotos, nota, cidade/UF, reagendamento, regiao, etc.)
--     • Prazo = data de criacao do card + 3 dias
--     • Campo "Situacao" passa a ter SO 4 opcoes:
--         Em Preparacao | Analise Tecnica | Solicitacao de Material | Solicitacao de Pagamento
--       ("Material" liga com Suprimentos; "Pagamento" liga com o Financeiro)
--     • Botoes de acao passam a gravar a situacao correspondente
--     • Remove as automacoes que dependiam dos campos apagados (checklist + gate)
--
--   IDs por nome (nada hardcoded). Idempotente: pode rodar 2x.
--   Aplicar via Supabase SQL Editor ou MCP (apply_migration/execute_sql).
-- ============================================================
DO $$
DECLARE
  v_op uuid;
BEGIN
  SELECT id INTO v_op FROM quadros WHERE nome = 'Pipeline Operacional' LIMIT 1;
  IF v_op IS NULL THEN
    RAISE NOTICE 'Pipeline Operacional ausente.';
    RETURN;
  END IF;

  -- ---- Campos: base (ate Tecnico) + extras por fase (ticket / status execucao) --
  DELETE FROM quadro_campos
   WHERE quadro_id = v_op
     AND chave NOT IN ('origem_com','situacao','tecnico','ticket_trilogo',
                       'status_execucao','status_avaliacao','avaliacao_execucao');

  -- Campos extras liberados por fase no front (Agendamento / Em Execucao):
  INSERT INTO quadro_campos (quadro_id, chave, label, tipo, obrigatorio, mostrar_no_card, ordem, opcoes)
  SELECT v_op, x.chave, x.label, x.tipo, x.obrig, x.card, x.ordem, x.opcoes
  FROM (VALUES
    ('ticket_trilogo',    'Ticket (Trilogo)',               'texto',   false, true,  3, '[]'::jsonb),
    ('status_execucao',   'Status da execução',             'selecao', false, false, 4,
        '["Técnico em Deslocamento","Em Execução","Executado Total","Executado Parcial"]'::jsonb),
    ('status_avaliacao',  'Status da avaliação do serviço', 'selecao', false, false, 5,
        '["Pendente Relatório/Fotos","Aprovado para Faturamento"]'::jsonb),
    ('avaliacao_execucao','Avaliação de execução',          'selecao', false, false, 6,
        '["Excelente","Boa","Regular","Requer Retrabalho"]'::jsonb)
  ) AS x(chave,label,tipo,obrig,card,ordem,opcoes)
  WHERE NOT EXISTS (
    SELECT 1 FROM quadro_campos qc WHERE qc.quadro_id = v_op AND qc.chave = x.chave
  );

  -- ---- Situacao: reduz para as 4 opcoes do fluxo novo -----------------------
  UPDATE quadro_campos
     SET tipo = 'selecao',
         mostrar_no_card = true,
         opcoes = to_jsonb(ARRAY[
           'Em Preparacao','Analise Tecnica',
           'Solicitacao de Material','Solicitacao de Pagamento'
         ])
   WHERE quadro_id = v_op AND chave = 'situacao';

  -- Situacoes antigas fora da nova lista viram 'Em Preparacao'.
  UPDATE quadro_cards
     SET valores = jsonb_set(valores, '{situacao}', '"Em Preparacao"', true)
   WHERE quadro_id = v_op
     AND (valores->>'situacao') IS NOT NULL
     AND (valores->>'situacao') NOT IN
         ('Em Preparacao','Analise Tecnica','Solicitacao de Material','Solicitacao de Pagamento');

  -- ---- Prazo = data de criacao + 3 dias (backfill dos cards existentes) ------
  UPDATE quadro_cards
     SET prazo = (created_at::date + 3)
   WHERE quadro_id = v_op;

  -- ---- Botoes: gravam a situacao correspondente -----------------------------
  -- Solicitar Compra -> situacao 'Solicitacao de Material' (liga com Suprimentos)
  UPDATE quadro_automacoes
     SET config = jsonb_set(config, '{acoes,1,valor}', '"Solicitacao de Material"', true)
   WHERE quadro_id = v_op AND nome = 'Solicitar Compra'
     AND config->'acoes'->1->>'tipo' = 'definir_campo';

  -- Botoes de pagamento -> situacao 'Solicitacao de Pagamento'
  UPDATE quadro_automacoes
     SET config = jsonb_set(config, '{acoes,1,valor}', '"Solicitacao de Pagamento"', true)
   WHERE quadro_id = v_op
     AND nome IN ('Solicitar Pagamento Antecipado','Solicitar Pagamento Pos-Servico','Gerar Conta a Pagar')
     AND config->'acoes'->1->>'tipo' = 'definir_campo';

  -- Faturamento (a receber): deixa de gravar situacao invalida.
  UPDATE quadro_automacoes
     SET config = jsonb_set(config, '{acoes}',
           (config->'acoes') - 2, true)
   WHERE quadro_id = v_op AND nome = 'Solicitar Faturamento'
     AND jsonb_array_length(config->'acoes') = 3;

  -- ---- Remove automacoes que dependiam dos campos apagados -------------------
  DELETE FROM quadro_automacoes
   WHERE quadro_id = v_op
     AND nome IN ('Impedimento detectado','Material pendente','Material disponivel','Gate: Agendamento');

  RAISE NOTICE 'Seed Operacao 2.1 (cards enxutos) aplicado.';
END $$;
