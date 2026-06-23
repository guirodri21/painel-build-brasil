-- ============================================================
-- Build Brasil — MIGRATION: Motor de Quadros (estilo Goalfy)
--   Quadros (funis) configuráveis com:
--   • colunas/fases editáveis        (quadro_fases)
--   • campos personalizados          (quadro_campos)
--   • cards com valores dinâmicos    (quadro_cards.valores jsonb)
--   • automações                     (quadro_automacoes)
--   • formulários públicos de entrada(quadro_formularios)
-- Convive com o módulo Chamados (não altera nada existente).
-- ============================================================

-- 1. QUADROS ---------------------------------------------------
CREATE TABLE IF NOT EXISTS quadros (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome        text NOT NULL,
  descricao   text,
  icone       text DEFAULT 'KanbanSquare',  -- nome do ícone lucide
  cor         text DEFAULT 'blue',
  ordem       int  NOT NULL DEFAULT 0,
  ativo       boolean NOT NULL DEFAULT true,
  filial      text DEFAULT 'Matriz' REFERENCES filiais(nome),
  created_by  uuid REFERENCES auth.users(id),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz
);

-- 2. FASES (colunas) ------------------------------------------
CREATE TABLE IF NOT EXISTS quadro_fases (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quadro_id  uuid NOT NULL REFERENCES quadros(id) ON DELETE CASCADE,
  nome       text NOT NULL,
  ordem      int  NOT NULL DEFAULT 0,
  cor        text DEFAULT 'gray',
  final      boolean NOT NULL DEFAULT false
);
CREATE INDEX IF NOT EXISTS idx_quadro_fases_quadro ON quadro_fases (quadro_id);

-- 3. CAMPOS PERSONALIZADOS ------------------------------------
-- tipo: texto | texto_longo | numero | moeda | data | selecao | usuario | checkbox
CREATE TABLE IF NOT EXISTS quadro_campos (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quadro_id       uuid NOT NULL REFERENCES quadros(id) ON DELETE CASCADE,
  chave           text NOT NULL,
  label           text NOT NULL,
  tipo            text NOT NULL DEFAULT 'texto',
  opcoes          jsonb NOT NULL DEFAULT '[]'::jsonb,
  obrigatorio     boolean NOT NULL DEFAULT false,
  mostrar_no_card boolean NOT NULL DEFAULT false,
  ordem           int NOT NULL DEFAULT 0,
  UNIQUE (quadro_id, chave)
);
CREATE INDEX IF NOT EXISTS idx_quadro_campos_quadro ON quadro_campos (quadro_id);

-- 4. CARDS -----------------------------------------------------
CREATE TABLE IF NOT EXISTS quadro_cards (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quadro_id    uuid NOT NULL REFERENCES quadros(id) ON DELETE CASCADE,
  titulo       text,
  fase         text NOT NULL,
  valores      jsonb NOT NULL DEFAULT '{}'::jsonb,
  responsavel  text,
  valor        numeric NOT NULL DEFAULT 0,
  prioridade   text,
  prazo        date,
  ordem_coluna int NOT NULL DEFAULT 0,
  fase_desde   timestamptz NOT NULL DEFAULT now(),
  origem       text DEFAULT 'manual',  -- manual | formulario | goalfy
  filial       text DEFAULT 'Matriz' REFERENCES filiais(nome),
  created_by   uuid REFERENCES auth.users(id),
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz
);
CREATE INDEX IF NOT EXISTS idx_quadro_cards_quadro ON quadro_cards (quadro_id);
CREATE INDEX IF NOT EXISTS idx_quadro_cards_fase   ON quadro_cards (quadro_id, fase);

-- Atualiza fase_desde quando o card muda de fase (aging por coluna)
CREATE OR REPLACE FUNCTION quadro_card_fase_desde()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF (TG_OP = 'UPDATE' AND NEW.fase IS DISTINCT FROM OLD.fase) THEN
    NEW.fase_desde := now();
  END IF;
  RETURN NEW;
END; $$;

-- 5. AUTOMAÇÕES ------------------------------------------------
-- gatilho: card_criado | card_movido | prazo_vencido
-- config jsonb: { "fase": "<p/ card_movido>", "condicoes": [...], "acoes": [ {tipo, ...} ] }
CREATE TABLE IF NOT EXISTS quadro_automacoes (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quadro_id  uuid NOT NULL REFERENCES quadros(id) ON DELETE CASCADE,
  nome       text NOT NULL,
  ativo      boolean NOT NULL DEFAULT true,
  gatilho    text NOT NULL DEFAULT 'card_movido',
  config     jsonb NOT NULL DEFAULT '{}'::jsonb,
  ordem      int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_quadro_automacoes_quadro ON quadro_automacoes (quadro_id);

-- 6. FORMULÁRIOS PÚBLICOS DE ENTRADA --------------------------
CREATE TABLE IF NOT EXISTS quadro_formularios (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quadro_id    uuid NOT NULL REFERENCES quadros(id) ON DELETE CASCADE,
  slug         text NOT NULL UNIQUE,
  titulo       text NOT NULL,
  descricao    text,
  fase_destino text,
  campos       jsonb NOT NULL DEFAULT '[]'::jsonb,  -- ["chave1","titulo",...] campos exibidos
  ativo        boolean NOT NULL DEFAULT true,
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- TRIGGERS de auditoria/aging
-- ============================================================
DROP TRIGGER IF EXISTS trg_set_updated_at ON quadros;
CREATE TRIGGER trg_set_updated_at BEFORE UPDATE ON quadros
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_set_updated_at ON quadro_cards;
CREATE TRIGGER trg_set_updated_at BEFORE UPDATE ON quadro_cards
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_fase_desde ON quadro_cards;
CREATE TRIGGER trg_fase_desde BEFORE UPDATE ON quadro_cards
  FOR EACH ROW EXECUTE FUNCTION quadro_card_fase_desde();

-- ============================================================
-- RLS
--  • Config (quadros/fases/campos/automacoes/formularios): leitura p/ autenticados, escrita só admin.
--  • Cards: leitura/criação/edição p/ autenticados; exclusão p/ dono ou admin.
-- ============================================================
ALTER TABLE quadros            ENABLE ROW LEVEL SECURITY;
ALTER TABLE quadro_fases       ENABLE ROW LEVEL SECURITY;
ALTER TABLE quadro_campos      ENABLE ROW LEVEL SECURITY;
ALTER TABLE quadro_cards       ENABLE ROW LEVEL SECURITY;
ALTER TABLE quadro_automacoes  ENABLE ROW LEVEL SECURITY;
ALTER TABLE quadro_formularios ENABLE ROW LEVEL SECURITY;

-- Tabelas de configuração: select autenticado, ALL para admin
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['quadros','quadro_fases','quadro_campos','quadro_automacoes','quadro_formularios'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS "%1$s_select" ON %1$s', t);
    EXECUTE format('CREATE POLICY "%1$s_select" ON %1$s FOR SELECT USING ((select auth.role()) = ''authenticated'')', t);
    EXECUTE format('DROP POLICY IF EXISTS "%1$s_admin" ON %1$s', t);
    EXECUTE format('CREATE POLICY "%1$s_admin" ON %1$s FOR ALL USING ((select public.is_admin())) WITH CHECK ((select public.is_admin()))', t);
  END LOOP;
END $$;

-- Cards: CRUD para autenticados, delete dono/admin
DROP POLICY IF EXISTS "quadro_cards_select" ON quadro_cards;
CREATE POLICY "quadro_cards_select" ON quadro_cards FOR SELECT USING ((select auth.role()) = 'authenticated');
DROP POLICY IF EXISTS "quadro_cards_insert" ON quadro_cards;
CREATE POLICY "quadro_cards_insert" ON quadro_cards FOR INSERT WITH CHECK ((select auth.role()) = 'authenticated');
DROP POLICY IF EXISTS "quadro_cards_update" ON quadro_cards;
CREATE POLICY "quadro_cards_update" ON quadro_cards FOR UPDATE USING ((select auth.role()) = 'authenticated');
DROP POLICY IF EXISTS "quadro_cards_delete" ON quadro_cards;
CREATE POLICY "quadro_cards_delete" ON quadro_cards FOR DELETE USING ((select auth.uid()) = created_by OR (select public.is_admin()));
