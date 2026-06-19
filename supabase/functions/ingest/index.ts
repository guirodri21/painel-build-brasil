import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-api-key",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

const STATUS_VALIDOS = ["em_andamento", "execucao_parcial", "concluido"];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "Use POST." }, 405);

  const url = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(url, serviceKey);

  // Token de entrada: header x-api-key ou Authorization: Bearer <token>
  const auth = req.headers.get("Authorization") ?? "";
  const apiKey = req.headers.get("x-api-key") ?? (auth.startsWith("Bearer ") ? auth.slice(7) : "");
  if (!apiKey) return json({ error: "Token ausente (use o header x-api-key)." }, 401);

  const { data: integ } = await admin
    .from("integracoes")
    .select("*")
    .eq("tipo", "entrada")
    .eq("ativo", true)
    .eq("secret", apiKey)
    .maybeSingle();
  if (!integ) return json({ error: "Token inválido ou integração inativa." }, 403);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json({ error: "JSON inválido." }, 400);
  }

  const arr = Array.isArray(body)
    ? body
    : Array.isArray((body as Record<string, unknown>)?.ordens)
    ? ((body as Record<string, unknown>).ordens as unknown[])
    : [body];

  const rows = arr.map((raw) => {
    const it = (raw ?? {}) as Record<string, unknown>;
    const status = String(it.status ?? "em_andamento");
    return {
      data: it.data,
      regiao: it.regiao,
      equipe: it.equipe,
      linha_servico: it.linha_servico ?? it.linha,
      cliente: it.cliente ?? null,
      valor_venda: Number(it.valor_venda ?? 0),
      despesa_direta: Number(it.despesa_direta ?? 0),
      status: STATUS_VALIDOS.includes(status) ? status : "em_andamento",
      tempo_execucao_h: it.tempo_execucao_h != null ? Number(it.tempo_execucao_h) : null,
      qualidade: it.qualidade != null ? Number(it.qualidade) : null,
      resumo: it.resumo ?? null,
    };
  });

  const faltando = rows.find((r) => !r.data || !r.regiao || !r.equipe || !r.linha_servico);
  if (faltando)
    return json({ error: "Campos obrigatórios: data, regiao, equipe, linha_servico." }, 422);

  const { data: inserted, error } = await admin.from("ordens").insert(rows).select("id");

  await admin.from("integracao_logs").insert({
    integracao_id: integ.id,
    direcao: "entrada",
    evento: "ingest.ordens",
    status: error ? 422 : 201,
    sucesso: !error,
    mensagem: error ? error.message : `${inserted?.length ?? 0} ordem(ns) criada(s)`,
    payload: body as Record<string, unknown>,
  });

  if (error) return json({ error: error.message }, 422);
  return json({ ok: true, criadas: inserted?.length ?? 0, ids: (inserted ?? []).map((r) => r.id) }, 201);
});
