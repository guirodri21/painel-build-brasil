-- ============================================================
-- Build Brasil — Rate limit por IP (janela fixa em Postgres)
--   Usado pelas Edge Functions públicas para conter spam/flood:
--     • formulario-submit (/f/)  — 8 envios/min por IP
--     • assinar (/assinar)        — 4 tentativas/min por IP
--     • ingest (webhook)          — 120 req/min por IP
--
--   As functions chamam admin.rpc('rate_limit_hit', {...}) com service role.
--   Fail-open no cliente: se o limitador falhar, não bloqueia.
--   Aplicado via MCP (migration rate_limit_infra) em 2026-07.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.rate_limits (
  bucket       text        NOT NULL,
  identifier   text        NOT NULL,
  window_start timestamptz NOT NULL,
  hits         int         NOT NULL DEFAULT 0,
  PRIMARY KEY (bucket, identifier, window_start)
);
CREATE INDEX IF NOT EXISTS idx_rate_limits_window ON public.rate_limits (window_start);

ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;
-- Sem policies: só a função SECURITY DEFINER acessa.

CREATE OR REPLACE FUNCTION public.rate_limit_hit(
  p_bucket text, p_identifier text, p_max int, p_window_seconds int
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_window timestamptz := to_timestamp(floor(extract(epoch FROM now()) / p_window_seconds) * p_window_seconds);
  v_hits int;
BEGIN
  IF random() < 0.01 THEN
    DELETE FROM public.rate_limits WHERE window_start < now() - interval '1 hour';
  END IF;

  INSERT INTO public.rate_limits AS rl (bucket, identifier, window_start, hits)
    VALUES (p_bucket, COALESCE(NULLIF(p_identifier, ''), 'desconhecido'), v_window, 1)
  ON CONFLICT (bucket, identifier, window_start)
    DO UPDATE SET hits = rl.hits + 1
  RETURNING rl.hits INTO v_hits;

  RETURN v_hits <= p_max;  -- true = permitido
END;
$$;

REVOKE ALL ON FUNCTION public.rate_limit_hit(text, text, int, int) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rate_limit_hit(text, text, int, int) TO service_role;
