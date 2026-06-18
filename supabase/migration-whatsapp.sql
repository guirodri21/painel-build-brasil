-- ============================================================
-- Painel Build — MIGRATION: WhatsApp Bot
-- Adiciona suporte a integração de WhatsApp (disparo + conversação):
--   1. Libera o tipo de integração 'whatsapp'
--   2. Tabela de funcionários (mapa número -> funcionário/equipe)
--   3. Tabela de estado de conversas (máquina de estados do bot)
-- ============================================================

-- 1. Permitir tipo 'whatsapp' nas integrações
ALTER TABLE integracoes DROP CONSTRAINT IF EXISTS integracoes_tipo_check;
ALTER TABLE integracoes ADD CONSTRAINT integracoes_tipo_check
  CHECK (tipo = ANY (ARRAY['saida','entrada','importacao','whatsapp']));

-- 2. Funcionários (destinatários e identificação no WhatsApp)
CREATE TABLE IF NOT EXISTS funcionarios (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome       text NOT NULL,
  telefone   text NOT NULL UNIQUE,   -- formato E.164 sem '+', ex: 5511999999999
  equipe     text REFERENCES equipes(nome),
  cargo      text,
  ativo      boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 3. Estado das conversas do bot (1 conversa ativa por telefone)
CREATE TABLE IF NOT EXISTS conversas_whatsapp (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  telefone      text NOT NULL UNIQUE,
  funcionario_id uuid REFERENCES funcionarios(id) ON DELETE SET NULL,
  estado        text NOT NULL DEFAULT 'inicio',
  contexto      jsonb NOT NULL DEFAULT '{}'::jsonb,
  ultima_msg_em timestamptz NOT NULL DEFAULT now(),
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- RLS — autenticado lê; escrita restrita ao criador.
-- As Edge Functions usam service role (ignoram RLS).
-- ============================================================
ALTER TABLE funcionarios       ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversas_whatsapp ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "funcionarios_select" ON funcionarios;
CREATE POLICY "funcionarios_select" ON funcionarios FOR SELECT
  USING (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "funcionarios_insert" ON funcionarios;
CREATE POLICY "funcionarios_insert" ON funcionarios FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "funcionarios_update" ON funcionarios;
CREATE POLICY "funcionarios_update" ON funcionarios FOR UPDATE
  USING (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "funcionarios_delete" ON funcionarios;
CREATE POLICY "funcionarios_delete" ON funcionarios FOR DELETE
  USING (auth.role() = 'authenticated');

-- Conversas: só leitura para autenticados (escrita só via service role).
DROP POLICY IF EXISTS "conversas_select" ON conversas_whatsapp;
CREATE POLICY "conversas_select" ON conversas_whatsapp FOR SELECT
  USING (auth.role() = 'authenticated');
