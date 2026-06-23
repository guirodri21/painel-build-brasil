import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
}

interface CampoDef {
  chave: string; label: string; tipo: string; opcoes: string[]; obrigatorio: boolean; ordem: number;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  const url = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(url, serviceKey);

  // -------- GET: schema do formulário público --------
  if (req.method === "GET") {
    const slug = new URL(req.url).searchParams.get("slug") ?? "";
    if (!slug) return json({ error: "slug ausente" }, 400);

    const { data: form } = await admin
      .from("quadro_formularios").select("*").eq("slug", slug).eq("ativo", true).maybeSingle();
    if (!form) return json({ error: "Formulário não encontrado ou inativo." }, 404);

    const { data: campos } = await admin
      .from("quadro_campos").select("chave,label,tipo,opcoes,obrigatorio,ordem")
      .eq("quadro_id", form.quadro_id).order("ordem");

    const selecionados: string[] = Array.isArray(form.campos) ? form.campos : [];
    const visiveis = ((campos as CampoDef[]) ?? [])
      .filter((c) => selecionados.length === 0 || selecionados.includes(c.chave));

    return json({
      titulo: form.titulo, descricao: form.descricao, campos: visiveis,
    });
  }

  // -------- POST: cria o card --------
  if (req.method !== "POST") return json({ error: "Use GET ou POST." }, 405);

  let body: { slug?: string; titulo?: string; valores?: Record<string, unknown> };
  try { body = await req.json(); } catch { return json({ error: "Corpo inválido." }, 400); }

  const slug = (body.slug ?? "").trim();
  if (!slug) return json({ error: "slug ausente" }, 400);

  const { data: form } = await admin
    .from("quadro_formularios").select("*").eq("slug", slug).eq("ativo", true).maybeSingle();
  if (!form) return json({ error: "Formulário não encontrado ou inativo." }, 404);

  const { data: quadro } = await admin
    .from("quadros").select("nome,filial").eq("id", form.quadro_id).maybeSingle();

  const { data: campos } = await admin
    .from("quadro_campos").select("chave,label,tipo,obrigatorio").eq("quadro_id", form.quadro_id);

  const selecionados: string[] = Array.isArray(form.campos) ? form.campos : [];
  const valores = (body.valores ?? {}) as Record<string, unknown>;

  // Valida obrigatórios (apenas os campos exibidos no formulário)
  for (const c of (campos as { chave: string; label: string; obrigatorio: boolean }[]) ?? []) {
    const exibido = selecionados.length === 0 || selecionados.includes(c.chave);
    if (exibido && c.obrigatorio) {
      const v = valores[c.chave];
      if (v == null || v === "") return json({ error: `O campo "${c.label}" é obrigatório.` }, 422);
    }
  }

  const titulo = (body.titulo ?? "").trim();
  if (!titulo) return json({ error: "O título é obrigatório." }, 422);

  const { error } = await admin.from("quadro_cards").insert([{
    quadro_id: form.quadro_id,
    titulo,
    fase: form.fase_destino ?? "Triagem",
    valores,
    origem: "formulario",
    filial: quadro?.filial ?? "Matriz",
  }]);

  if (error) return json({ error: error.message }, 422);
  return json({ ok: true, quadro: quadro?.nome }, 201);
});
