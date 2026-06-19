-- ============================================================
-- Build Brasil — Módulo de Estoque
-- Execute este arquivo inteiro no SQL Editor do Supabase.
--
-- Modelo: `produtos` guarda o cadastro + saldo atual; toda
-- alteração de saldo passa por `estoque_movimentos` (ledger
-- imutável). Um trigger mantém `produtos.estoque_atual`,
-- registra `saldo_apos` e recalcula o custo médio ponderado.
-- ============================================================

-- 1. Cadastro de produtos / insumos
CREATE TABLE IF NOT EXISTS produtos (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sku             text UNIQUE,
  nome            text NOT NULL,
  categoria       text,
  unidade         text NOT NULL DEFAULT 'un',
  estoque_atual   numeric NOT NULL DEFAULT 0,
  estoque_minimo  numeric NOT NULL DEFAULT 0 CHECK (estoque_minimo >= 0),
  custo_unitario  numeric NOT NULL DEFAULT 0 CHECK (custo_unitario >= 0),
  localizacao     text,
  ativo           boolean NOT NULL DEFAULT true,
  created_by      uuid REFERENCES auth.users(id),
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- 2. Ledger de movimentações (append-only)
CREATE TABLE IF NOT EXISTS estoque_movimentos (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  produto_id      uuid NOT NULL REFERENCES produtos(id) ON DELETE CASCADE,
  tipo            text NOT NULL CHECK (tipo IN ('entrada','saida','ajuste')),
  quantidade      numeric NOT NULL CHECK (quantidade >= 0),
  custo_unitario  numeric CHECK (custo_unitario >= 0),
  motivo          text,
  referencia      text,
  saldo_apos      numeric NOT NULL DEFAULT 0,
  created_by      uuid REFERENCES auth.users(id),
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mov_produto ON estoque_movimentos (produto_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_mov_created ON estoque_movimentos (created_at DESC);

-- 3. Trigger: aplica o movimento ao saldo do produto
--    SECURITY DEFINER para poder atualizar `produtos` independente
--    de quem fez o movimento (estoque é recurso compartilhado).
CREATE OR REPLACE FUNCTION aplicar_movimento_estoque()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_atual numeric;
  v_custo numeric;
  v_novo  numeric;
BEGIN
  SELECT estoque_atual, custo_unitario
    INTO v_atual, v_custo
    FROM produtos
   WHERE id = NEW.produto_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Produto inexistente.';
  END IF;

  IF NEW.tipo = 'entrada' THEN
    v_novo := v_atual + NEW.quantidade;
    -- custo médio ponderado
    IF NEW.custo_unitario IS NOT NULL AND v_novo > 0 THEN
      v_custo := round(((v_atual * v_custo) + (NEW.quantidade * NEW.custo_unitario)) / v_novo, 4);
    END IF;
  ELSIF NEW.tipo = 'saida' THEN
    v_novo := v_atual - NEW.quantidade;
    IF v_novo < 0 THEN
      RAISE EXCEPTION 'Estoque insuficiente (saldo %, saída %).', v_atual, NEW.quantidade;
    END IF;
  ELSE -- ajuste: define o saldo absoluto (contagem física)
    v_novo := NEW.quantidade;
  END IF;

  NEW.saldo_apos := v_novo;

  UPDATE produtos
     SET estoque_atual  = v_novo,
         custo_unitario = v_custo
   WHERE id = NEW.produto_id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_aplicar_movimento ON estoque_movimentos;
CREATE TRIGGER trg_aplicar_movimento
  BEFORE INSERT ON estoque_movimentos
  FOR EACH ROW EXECUTE FUNCTION aplicar_movimento_estoque();

-- A trigger não deve ser exposta via RPC (PostgREST)
REVOKE EXECUTE ON FUNCTION aplicar_movimento_estoque() FROM public, anon, authenticated;

-- ============================================================
-- 4. RLS
-- produtos: autenticado lê/insere/edita; exclui só o próprio.
-- movimentos: autenticado lê/insere; sem update/delete (ledger).
-- ============================================================
ALTER TABLE produtos           ENABLE ROW LEVEL SECURITY;
ALTER TABLE estoque_movimentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "produtos_select" ON produtos FOR SELECT
  USING (auth.role() = 'authenticated');
CREATE POLICY "produtos_insert" ON produtos FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "produtos_update" ON produtos FOR UPDATE
  USING (auth.role() = 'authenticated');
CREATE POLICY "produtos_delete" ON produtos FOR DELETE
  USING (auth.uid() = created_by);

CREATE POLICY "mov_select" ON estoque_movimentos FOR SELECT
  USING (auth.role() = 'authenticated');
CREATE POLICY "mov_insert" ON estoque_movimentos FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');
