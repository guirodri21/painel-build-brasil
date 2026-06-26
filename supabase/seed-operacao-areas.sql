-- ============================================================
-- Build Brasil — Áreas operacionais via motor de Quadros (doc v2.0)
--   Cria três boards configuráveis (renderizados por /quadros/[id] e pelas
--   páginas finas /operacoes/frota, /operacoes/preventivas, /operacoes/patrimonio):
--     • Frota e Logistica   — pipeline de demandas da frota, vínculo ao card OP
--     • Preventivas         — controle de preventivas (previstas→realizadas)
--     • Patrimonio          — equipamentos/ferramentas (NUNCA misturar c/ consumo)
--   Idempotente por nome. Aplicar via MCP Supabase.
-- ============================================================
DO $$
DECLARE
  v_fro uuid;
  v_pre uuid;
  v_pat uuid;
BEGIN
  -- ---- Frota e Logistica ----------------------------------------------------
  IF NOT EXISTS (SELECT 1 FROM quadros WHERE nome = 'Frota e Logistica') THEN
    INSERT INTO quadros (nome, descricao, icone, cor, ordem, prefixo)
      VALUES ('Frota e Logistica','Demandas de veiculos, deslocamentos e manutencao','Truck','blue',20,'FRO')
      RETURNING id INTO v_fro;
    INSERT INTO quadro_fases (quadro_id, nome, ordem, cor, final) VALUES
      (v_fro,'Solicitacao',0,'gray',false),
      (v_fro,'Manutencao',1,'yellow',false),
      (v_fro,'Locacao',2,'orange',false),
      (v_fro,'Abastecimento',3,'teal',false),
      (v_fro,'Multa / Sinistro',4,'red',false),
      (v_fro,'Documentacao',5,'blue',false),
      (v_fro,'Encerrado',6,'green',true);
    INSERT INTO quadro_campos (quadro_id, chave, label, tipo, obrigatorio, mostrar_no_card, ordem, opcoes) VALUES
      (v_fro,'placa','Placa','texto',false,true,0,'[]'::jsonb),
      (v_fro,'veiculo','Veiculo (modelo)','texto',false,true,1,'[]'::jsonb),
      (v_fro,'tipo_demanda','Tipo','selecao',false,true,2,
        '["Manutencao Preventiva","Manutencao Corretiva","Locacao","Abastecimento","Multa","Sinistro","Documentacao"]'::jsonb),
      (v_fro,'km_atual','KM atual','numero',false,false,3,'[]'::jsonb),
      (v_fro,'card_op','Card OP vinculado','texto',false,true,4,'[]'::jsonb);
  END IF;

  -- ---- Preventivas ----------------------------------------------------------
  IF NOT EXISTS (SELECT 1 FROM quadros WHERE nome = 'Preventivas') THEN
    INSERT INTO quadros (nome, descricao, icone, cor, ordem, prefixo)
      VALUES ('Preventivas','Manutencoes preventivas: previstas, realizadas e vencidas','CalendarCheck','teal',21,'PRE')
      RETURNING id INTO v_pre;
    INSERT INTO quadro_fases (quadro_id, nome, ordem, cor, final) VALUES
      (v_pre,'Prevista',0,'gray',false),
      (v_pre,'Agendada',1,'orange',false),
      (v_pre,'Reagendada',2,'yellow',false),
      (v_pre,'Vencida',3,'red',false),
      (v_pre,'Realizada',4,'green',true);
    INSERT INTO quadro_campos (quadro_id, chave, label, tipo, obrigatorio, mostrar_no_card, ordem, opcoes) VALUES
      (v_pre,'ativo_cliente','Cliente / Ativo','texto',false,true,0,'[]'::jsonb),
      (v_pre,'data_prevista','Data prevista','data',false,true,1,'[]'::jsonb),
      (v_pre,'data_realizada','Data realizada','data',false,false,2,'[]'::jsonb),
      (v_pre,'card_op','Card OP vinculado','texto',false,false,3,'[]'::jsonb);
  END IF;

  -- ---- Patrimonio (Equipamentos e Ferramentas) ------------------------------
  IF NOT EXISTS (SELECT 1 FROM quadros WHERE nome = 'Patrimonio') THEN
    INSERT INTO quadros (nome, descricao, icone, cor, ordem, prefixo)
      VALUES ('Patrimonio','Equipamentos e ferramentas (patrimonio - nao misturar com consumo)','Hammer','orange',22,'PAT')
      RETURNING id INTO v_pat;
    INSERT INTO quadro_fases (quadro_id, nome, ordem, cor, final) VALUES
      (v_pat,'Disponivel',0,'green',false),
      (v_pat,'Com Tecnico',1,'blue',false),
      (v_pat,'Em Manutencao',2,'yellow',false),
      (v_pat,'Baixado',3,'gray',true);
    INSERT INTO quadro_campos (quadro_id, chave, label, tipo, obrigatorio, mostrar_no_card, ordem, opcoes) VALUES
      (v_pat,'tipo_item','Tipo','selecao',false,true,0,'["Equipamento","Ferramenta"]'::jsonb),
      (v_pat,'patrimonio','N. patrimonio','texto',false,true,1,'[]'::jsonb),
      (v_pat,'tecnico','Tecnico responsavel','texto',false,true,2,'[]'::jsonb),
      (v_pat,'card_op','Card OP vinculado','texto',false,false,3,'[]'::jsonb);
  END IF;

  RAISE NOTICE 'Areas operacionais (Frota, Preventivas, Patrimonio) aplicadas.';
END $$;
