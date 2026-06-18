import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

const STATUS_VALIDOS = ["em_andamento", "execucao_parcial", "concluido"];

function mapOrdem(raw: unknown) {
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
}

// ============================================================
// WhatsApp — camada provider-agnostic (Z-API e Meta Cloud API)
// ============================================================
type WaConfig = {
  provider?: "zapi" | "meta";
  zapi?: { instanceId?: string; token?: string; clientToken?: string };
  meta?: { phoneNumberId?: string; accessToken?: string };
  destinatarios?: string[];
  notificar_equipe?: boolean;
};

/** Normaliza para E.164 só com dígitos (ex: 5511999999999). */
function normalizarTelefone(tel: string): string {
  return String(tel ?? "").replace(/\D/g, "");
}

/** Envia uma mensagem de texto pelo provedor configurado. Lança em falha. */
async function enviarWhatsapp(cfg: WaConfig, to: string, texto: string): Promise<{ status: number }> {
  const fone = normalizarTelefone(to);
  if (!fone) throw new Error("Telefone inválido.");

  if (cfg.provider === "meta") {
    const { phoneNumberId, accessToken } = cfg.meta ?? {};
    if (!phoneNumberId || !accessToken) throw new Error("Credenciais Meta ausentes.");
    const resp = await fetch(`https://graph.facebook.com/v21.0/${phoneNumberId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: fone,
        type: "text",
        text: { body: texto },
      }),
    });
    if (!resp.ok) throw new Error(`Meta HTTP ${resp.status}: ${await resp.text()}`);
    return { status: resp.status };
  }

  // default: Z-API
  const { instanceId, token, clientToken } = cfg.zapi ?? {};
  if (!instanceId || !token) throw new Error("Credenciais Z-API ausentes.");
  const resp = await fetch(`https://api.z-api.io/instances/${instanceId}/token/${token}/send-text`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(clientToken ? { "Client-Token": clientToken } : {}),
    },
    body: JSON.stringify({ phone: fone, message: texto }),
  });
  if (!resp.ok) throw new Error(`Z-API HTTP ${resp.status}: ${await resp.text()}`);
  return { status: resp.status };
}

/** Monta o texto da notificação a partir do evento + dados. */
function montarMensagem(evento: string, dados: Record<string, unknown>): string {
  const o = dados ?? {};
  const moeda = (v: unknown) =>
    Number(v ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  switch (evento) {
    case "ordem.criada":
      return `🆕 *Nova ordem* — ${o.cliente ?? "Cliente"}\nEquipe: ${o.equipe ?? "—"}\nServiço: ${o.linha_servico ?? "—"}\nRegião: ${o.regiao ?? "—"}\nValor: ${moeda(o.valor_venda)}`;
    case "ordem.atualizada":
      return `✏️ *Ordem atualizada* — ${o.cliente ?? "Cliente"}\nEquipe: ${o.equipe ?? "—"}\nStatus: ${o.status ?? "—"}`;
    case "meta.criada":
      return `🎯 *Nova meta* — Equipe ${o.equipe ?? "—"}\nReceita alvo: ${moeda(o.meta_receita)}`;
    case "meta.atualizada":
      return `🎯 *Meta atualizada* — Equipe ${o.equipe ?? "—"}\nReceita alvo: ${moeda(o.meta_receita)}`;
    default:
      return `📣 Painel Build — evento: ${evento}`;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  const url = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const authHeader = req.headers.get("Authorization") ?? "";

  const caller = createClient(url, anonKey, { global: { headers: { Authorization: authHeader } } });
  const { data: userData, error: userErr } = await caller.auth.getUser();
  if (userErr || !userData.user) return json({ error: "Não autenticado." }, 401);

  const admin = createClient(url, serviceKey);
  const { data: prof } = await admin.from("profiles").select("role").eq("id", userData.user.id).single();
  const isAdmin = prof?.role === "admin";

  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    return json({ error: "Corpo inválido." }, 400);
  }
  const action = String(body.action ?? "");

  try {
    // dispatch: qualquer usuário autenticado pode disparar ao salvar dados
    if (action === "dispatch") {
      const evento = String(body.evento ?? "");
      const payload = (body.payload ?? {}) as Record<string, unknown>;

      // -- Webhooks de saída --
      const { data: list } = await admin
        .from("integracoes")
        .select("*")
        .eq("tipo", "saida")
        .eq("ativo", true);
      const targets = (list ?? []).filter(
        (i) => !Array.isArray(i.eventos) || i.eventos.length === 0 || i.eventos.includes(evento),
      );
      const results = [];
      for (const t of targets) {
        if (!t.url) continue;
        try {
          const resp = await fetch(t.url, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              ...(t.secret ? { "X-Webhook-Secret": t.secret } : {}),
            },
            body: JSON.stringify({ evento, enviado_em: new Date().toISOString(), dados: payload }),
          });
          await admin.from("integracao_logs").insert({
            integracao_id: t.id, direcao: "saida", evento, status: resp.status,
            sucesso: resp.ok, mensagem: resp.ok ? "Enviado" : `HTTP ${resp.status}`, payload,
          });
          results.push({ id: t.id, status: resp.status, ok: resp.ok });
        } catch (e) {
          await admin.from("integracao_logs").insert({
            integracao_id: t.id, direcao: "saida", evento, status: 0,
            sucesso: false, mensagem: e instanceof Error ? e.message : "Falha de rede", payload,
          });
          results.push({ id: t.id, ok: false });
        }
      }

      // -- Notificações de WhatsApp --
      await dispararWhatsapp(admin, evento, payload, results);

      return json({ ok: true, disparados: results.length, results });
    }

    // ações administrativas
    if (!isAdmin) return json({ error: "Apenas administradores." }, 403);

    if (action === "test") {
      const id = String(body.id ?? "");
      const { data: integ } = await admin.from("integracoes").select("*").eq("id", id).single();
      if (!integ) return json({ error: "Integração não encontrada." }, 404);

      // Teste de WhatsApp: envia mensagem para o primeiro destinatário configurado
      if (integ.tipo === "whatsapp") {
        const cfg = (integ.config ?? {}) as WaConfig;
        const dest = (cfg.destinatarios ?? [])[0];
        if (!dest) return json({ error: "Cadastre ao menos um destinatário para testar." }, 400);
        try {
          const r = await enviarWhatsapp(cfg, dest, "✅ Teste do Painel Build — bot de WhatsApp conectado!");
          await admin.from("integracao_logs").insert({
            integracao_id: integ.id, direcao: "whatsapp", evento: "teste", status: r.status,
            sucesso: true, mensagem: `Teste enviado para ${dest}`,
          });
          return json({ ok: true, status: r.status });
        } catch (e) {
          const msg = e instanceof Error ? e.message : "Falha ao enviar";
          await admin.from("integracao_logs").insert({
            integracao_id: integ.id, direcao: "whatsapp", evento: "teste", status: 0, sucesso: false, mensagem: msg,
          });
          return json({ ok: false, error: msg }, 502);
        }
      }

      if (!integ.url) return json({ error: "Integração sem URL." }, 400);
      const sample = { evento: "teste", enviado_em: new Date().toISOString(), dados: { mensagem: "Webhook de teste do Painel Build." } };
      try {
        const resp = await fetch(integ.url, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...(integ.secret ? { "X-Webhook-Secret": integ.secret } : {}) },
          body: JSON.stringify(sample),
        });
        await admin.from("integracao_logs").insert({
          integracao_id: integ.id, direcao: "saida", evento: "teste", status: resp.status,
          sucesso: resp.ok, mensagem: resp.ok ? "Teste enviado" : `HTTP ${resp.status}`, payload: sample,
        });
        return json({ ok: resp.ok, status: resp.status });
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Falha de rede";
        await admin.from("integracao_logs").insert({
          integracao_id: integ.id, direcao: "saida", evento: "teste", status: 0, sucesso: false, mensagem: msg, payload: sample,
        });
        return json({ ok: false, error: msg }, 502);
      }
    }

    if (action === "sync") {
      const id = String(body.id ?? "");
      const { data: integ } = await admin.from("integracoes").select("*").eq("id", id).single();
      if (!integ || !integ.url) return json({ error: "Integração sem URL de origem." }, 400);
      let externo: unknown;
      try {
        const resp = await fetch(integ.url, {
          headers: integ.secret ? { Authorization: `Bearer ${integ.secret}` } : {},
        });
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        externo = await resp.json();
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Falha ao buscar origem";
        await admin.from("integracao_logs").insert({
          integracao_id: integ.id, direcao: "importacao", evento: "sync", status: 0, sucesso: false, mensagem: msg,
        });
        return json({ ok: false, error: msg }, 502);
      }
      const arr = Array.isArray(externo)
        ? externo
        : Array.isArray((externo as Record<string, unknown>)?.ordens)
        ? ((externo as Record<string, unknown>).ordens as unknown[])
        : [];
      const rows = arr.map(mapOrdem).filter((r) => r.data && r.regiao && r.equipe && r.linha_servico);
      if (!rows.length) {
        await admin.from("integracao_logs").insert({
          integracao_id: integ.id, direcao: "importacao", evento: "sync", status: 422, sucesso: false,
          mensagem: "Nenhum registro válido encontrado na origem.",
        });
        return json({ ok: false, error: "Nenhum registro válido na origem." }, 422);
      }
      const { data: inserted, error } = await admin.from("ordens").insert(rows).select("id");
      await admin.from("integracao_logs").insert({
        integracao_id: integ.id, direcao: "importacao", evento: "sync", status: error ? 422 : 201,
        sucesso: !error, mensagem: error ? error.message : `${inserted?.length ?? 0} ordem(ns) importada(s)`,
      });
      if (error) return json({ ok: false, error: error.message }, 422);
      return json({ ok: true, importadas: inserted?.length ?? 0 });
    }

    return json({ error: "Ação desconhecida." }, 400);
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Erro interno." }, 500);
  }
});

/** Dispara notificações de WhatsApp para todas as integrações ativas inscritas no evento. */
async function dispararWhatsapp(
  // deno-lint-ignore no-explicit-any
  admin: any,
  evento: string,
  payload: Record<string, unknown>,
  results: unknown[],
) {
  const { data: was } = await admin
    .from("integracoes")
    .select("*")
    .eq("tipo", "whatsapp")
    .eq("ativo", true);
  const ativos = (was ?? []).filter(
    (i: { eventos?: string[] }) =>
      !Array.isArray(i.eventos) || i.eventos.length === 0 || i.eventos.includes(evento),
  );
  if (!ativos.length) return;

  const texto = montarMensagem(evento, payload);

  for (const wa of ativos) {
    const cfg = (wa.config ?? {}) as WaConfig;

    // Monta a lista de destinatários: números avulsos + funcionários da equipe
    const destinos = new Set<string>((cfg.destinatarios ?? []).map(normalizarTelefone).filter(Boolean));
    if (cfg.notificar_equipe && payload.equipe) {
      const { data: funcs } = await admin
        .from("funcionarios")
        .select("telefone")
        .eq("equipe", payload.equipe)
        .eq("ativo", true);
      for (const f of funcs ?? []) {
        const t = normalizarTelefone(f.telefone);
        if (t) destinos.add(t);
      }
    }

    for (const fone of destinos) {
      try {
        const r = await enviarWhatsapp(cfg, fone, texto);
        await admin.from("integracao_logs").insert({
          integracao_id: wa.id, direcao: "whatsapp", evento, status: r.status,
          sucesso: true, mensagem: `Enviado para ${fone}`, payload,
        });
        results.push({ id: wa.id, fone, ok: true });
      } catch (e) {
        await admin.from("integracao_logs").insert({
          integracao_id: wa.id, direcao: "whatsapp", evento, status: 0,
          sucesso: false, mensagem: e instanceof Error ? e.message : "Falha ao enviar", payload,
        });
        results.push({ id: wa.id, fone, ok: false });
      }
    }
  }
}
