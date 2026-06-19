import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-api-key",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
}

function mapCard(raw: unknown) {
  const it = (raw ?? {}) as Record<string, unknown>;
  const str = (v: unknown) => (v == null || v === "" ? null : String(v));
  return {
    goalfy_card_id: str(it.card_id ?? it.id ?? it.goalfy_card_id),
    titulo: str(it.titulo ?? it.title),
    cliente: str(it.cliente ?? it.solicitante),
    regiao: str(it.regiao ?? it.regiao_nome ?? it.region),
    descricao: str(it.descricao ?? it.description),
    prioridade: str(it.prioridade ?? it.priority),
    ticket_ref: str(it.ticket_ref ?? it.ticket ?? it.ticket_trilogo),
    fase: str(it.fase ?? it.etapa ?? it.fase_nome) ?? "Triagem",
    valor: it.valor != null ? Number(it.valor) : 0,
    responsavel: str(it.responsavel ?? it.responsible),
    aberto_em: str(it.aberto_em ?? it.data ?? it.created),
    filial: str(it.filial) ?? "Matriz",
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "Use POST." }, 405);

  const url = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(url, serviceKey);

  const auth = req.headers.get("Authorization") ?? "";
  const apiKey = req.headers.get("x-api-key") ?? (auth.startsWith("Bearer ") ? auth.slice(7) : "");
  if (!apiKey) return json({ error: "Token ausente (use o header x-api-key)." }, 401);

  const { data: integ } = await admin
    .from("integracoes").select("*")
    .eq("tipo", "entrada").eq("ativo", true).eq("secret", apiKey).maybeSingle();
  if (!integ) return json({ error: "Token inválido ou integração inativa." }, 403);

  // Aceita JSON (Raw) ou key/value (form-urlencoded / multipart) do Goalfy
  let body: unknown;
  const ct = req.headers.get("content-type") ?? "";
  try {
    if (ct.includes("application/json")) {
      body = await req.json();
    } else if (ct.includes("multipart/form-data") || ct.includes("application/x-www-form-urlencoded")) {
      const fd = await req.formData();
      body = Object.fromEntries(Array.from(fd.entries()).map(([k, v]) => [k, String(v)]));
    } else {
      const txt = await req.text();
      try { body = JSON.parse(txt); }
      catch { body = Object.fromEntries(new URLSearchParams(txt)); }
    }
  } catch {
    return json({ error: "Corpo inválido." }, 400);
  }

  const arr = Array.isArray(body)
    ? body
    : Array.isArray((body as Record<string, unknown>)?.cards)
    ? ((body as Record<string, unknown>).cards as unknown[])
    : [body];

  const rows = arr.map(mapCard).filter((r) => r.titulo || r.cliente || r.descricao || r.goalfy_card_id);
  if (!rows.length) return json({ error: "Nenhum card válido no corpo." }, 422);

  // Upsert pelos que têm goalfy_card_id; insert simples para os demais.
  const comId = rows.filter((r) => r.goalfy_card_id);
  const semId = rows.filter((r) => !r.goalfy_card_id);
  let afetados = 0;
  let erroMsg: string | null = null;

  if (comId.length) {
    const { data, error } = await admin.from("chamados")
      .upsert(comId, { onConflict: "goalfy_card_id" }).select("id");
    if (error) erroMsg = error.message; else afetados += data?.length ?? 0;
  }
  if (!erroMsg && semId.length) {
    const { data, error } = await admin.from("chamados").insert(semId).select("id");
    if (error) erroMsg = error.message; else afetados += data?.length ?? 0;
  }

  await admin.from("integracao_logs").insert({
    integracao_id: integ.id, direcao: "entrada", evento: "ingest.chamados",
    status: erroMsg ? 422 : 201, sucesso: !erroMsg,
    mensagem: erroMsg ?? `${afetados} chamado(s) sincronizado(s)`, payload: body as Record<string, unknown>,
  });

  if (erroMsg) return json({ error: erroMsg }, 422);
  return json({ ok: true, sincronizados: afetados }, 201);
});
