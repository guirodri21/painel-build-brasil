// ============================================================
// Painel Build — WhatsApp INBOUND (conversação com funcionários)
// Webhook chamado pelo provedor (Z-API ou Meta) quando o
// funcionário envia uma mensagem. Implementa uma máquina de
// estados simples persistida em conversas_whatsapp.
//
// verify_jwt = false (é um webhook público chamado pelo provedor).
// Segurança: Meta valida via verify token; Z-API por URL secreta.
// ============================================================
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type WaConfig = {
  provider?: "zapi" | "meta";
  zapi?: { instanceId?: string; token?: string; clientToken?: string };
  meta?: { phoneNumberId?: string; accessToken?: string };
};

function normalizarTelefone(tel: string): string {
  return String(tel ?? "").replace(/\D/g, "");
}

async function enviarWhatsapp(cfg: WaConfig, to: string, texto: string): Promise<void> {
  const fone = normalizarTelefone(to);
  if (!fone) return;
  if (cfg.provider === "meta") {
    const { phoneNumberId, accessToken } = cfg.meta ?? {};
    if (!phoneNumberId || !accessToken) return;
    await fetch(`https://graph.facebook.com/v21.0/${phoneNumberId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ messaging_product: "whatsapp", to: fone, type: "text", text: { body: texto } }),
    });
    return;
  }
  const { instanceId, token, clientToken } = cfg.zapi ?? {};
  if (!instanceId || !token) return;
  await fetch(`https://api.z-api.io/instances/${instanceId}/token/${token}/send-text`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(clientToken ? { "Client-Token": clientToken } : {}) },
    body: JSON.stringify({ phone: fone, message: texto }),
  });
}

/** Extrai { from, text } das diferentes formas de payload (Z-API e Meta). */
function parseInbound(body: Record<string, unknown>): { from: string; text: string; fromMe: boolean } | null {
  // Meta Cloud API
  const entry = (body.entry as unknown[] | undefined)?.[0] as Record<string, unknown> | undefined;
  if (entry) {
    const change = (entry.changes as unknown[] | undefined)?.[0] as Record<string, unknown> | undefined;
    const value = change?.value as Record<string, unknown> | undefined;
    const msg = (value?.messages as unknown[] | undefined)?.[0] as Record<string, unknown> | undefined;
    if (msg) {
      const text = (msg.text as Record<string, unknown> | undefined)?.body as string | undefined;
      return { from: String(msg.from ?? ""), text: String(text ?? ""), fromMe: false };
    }
  }
  // Z-API on-message-received
  if (body.phone) {
    const text =
      (body.text as Record<string, unknown> | undefined)?.message ??
      (body as Record<string, unknown>).message ??
      "";
    return { from: String(body.phone), text: String(text ?? ""), fromMe: Boolean(body.fromMe) };
  }
  return null;
}

const STATUS_ABERTOS = ["em_andamento", "execucao_parcial"];

function menu(nome: string): string {
  return `Olá, ${nome}! 👷 *Painel Build*\n\n1️⃣ Minhas ordens em aberto\n2️⃣ Marcar ordem como concluída\n3️⃣ Falar com o gestor\n\nResponda com o número da opção.`;
}

Deno.serve(async (req) => {
  const url = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const verifyToken = Deno.env.get("WHATSAPP_VERIFY_TOKEN") ?? "";
  const admin = createClient(url, serviceKey);

  // 1. Verificação de webhook da Meta (GET com hub.challenge)
  if (req.method === "GET") {
    const u = new URL(req.url);
    const mode = u.searchParams.get("hub.mode");
    const token = u.searchParams.get("hub.verify_token");
    const challenge = u.searchParams.get("hub.challenge");
    if (mode === "subscribe" && token && token === verifyToken) {
      return new Response(challenge ?? "", { status: 200 });
    }
    return new Response("forbidden", { status: 403 });
  }

  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    return new Response("ok", { status: 200 });
  }

  const msg = parseInbound(body);
  // Sempre 200 para o provedor não reenviar; ignoramos mensagens próprias/sem texto.
  if (!msg || msg.fromMe || !msg.text.trim()) return new Response("ok", { status: 200 });

  const fone = normalizarTelefone(msg.from);
  const texto = msg.text.trim();

  // Provedor para responder: primeira integração de WhatsApp ativa
  const { data: integ } = await admin
    .from("integracoes").select("config").eq("tipo", "whatsapp").eq("ativo", true).limit(1).single();
  const cfg = (integ?.config ?? {}) as WaConfig;
  const responder = (t: string) => enviarWhatsapp(cfg, fone, t);

  // Identifica o funcionário
  const { data: func } = await admin
    .from("funcionarios").select("*").eq("telefone", fone).eq("ativo", true).maybeSingle();
  if (!func) {
    await responder("Seu número não está cadastrado no Painel Build. Procure o gestor para liberar o acesso.");
    return new Response("ok", { status: 200 });
  }

  // Carrega/abre a conversa
  const { data: convExist } = await admin
    .from("conversas_whatsapp").select("*").eq("telefone", fone).maybeSingle();
  let estado = convExist?.estado ?? "menu";
  let contexto = (convExist?.contexto ?? {}) as Record<string, unknown>;

  const lower = texto.toLowerCase();
  const escolha = parseInt(texto.replace(/\D/g, ""), 10);

  async function salvar(novoEstado: string, novoContexto: Record<string, unknown>) {
    await admin.from("conversas_whatsapp").upsert(
      { telefone: fone, funcionario_id: func.id, estado: novoEstado, contexto: novoContexto, ultima_msg_em: new Date().toISOString() },
      { onConflict: "telefone" },
    );
  }

  async function listarOrdens(): Promise<{ texto: string; ids: string[] }> {
    const { data: ordens } = await admin
      .from("ordens").select("id, cliente, linha_servico, status")
      .eq("equipe", func.equipe ?? "__none__")
      .in("status", STATUS_ABERTOS)
      .order("data", { ascending: false }).limit(10);
    if (!ordens || !ordens.length) return { texto: "Nenhuma ordem em aberto para a sua equipe. 🎉", ids: [] };
    const linhas = ordens.map((o, i) =>
      `${i + 1}. ${o.cliente ?? "Cliente"} — ${o.linha_servico} (${o.status === "em_andamento" ? "em andamento" : "parcial"})`);
    return { texto: linhas.join("\n"), ids: ordens.map((o) => o.id) };
  }

  // Comandos globais
  if (["menu", "0", "oi", "olá", "ola"].includes(lower)) {
    await salvar("menu", {});
    await responder(menu(func.nome));
    return new Response("ok", { status: 200 });
  }

  if (estado === "aguardando_conclusao") {
    const ids = (contexto.ordens as string[] | undefined) ?? [];
    if (!escolha || escolha < 1 || escolha > ids.length) {
      await responder("Número inválido. Responda com o número da ordem da lista, ou digite *menu*.");
      return new Response("ok", { status: 200 });
    }
    const id = ids[escolha - 1];
    const { error } = await admin.from("ordens").update({ status: "concluido" }).eq("id", id);
    await salvar("menu", {});
    await responder(error
      ? "Não consegui atualizar a ordem. Tente novamente ou fale com o gestor."
      : "✅ Ordem marcada como *concluída*! Obrigado. Digite *menu* para voltar.");
    return new Response("ok", { status: 200 });
  }

  // Estado padrão: menu
  if (escolha === 1) {
    const { texto: lista } = await listarOrdens();
    await salvar("menu", {});
    await responder(`📋 *Suas ordens em aberto:*\n\n${lista}\n\nDigite *menu* para voltar.`);
    return new Response("ok", { status: 200 });
  }
  if (escolha === 2) {
    const { texto: lista, ids } = await listarOrdens();
    if (!ids.length) {
      await salvar("menu", {});
      await responder(lista);
      return new Response("ok", { status: 200 });
    }
    await salvar("aguardando_conclusao", { ordens: ids });
    await responder(`Qual ordem foi concluída?\n\n${lista}\n\nResponda com o número.`);
    return new Response("ok", { status: 200 });
  }
  if (escolha === 3) {
    await admin.from("integracao_logs").insert({
      direcao: "whatsapp", evento: "solicitacao_gestor", status: 200, sucesso: true,
      mensagem: `${func.nome} (${func.equipe ?? "sem equipe"}) pediu para falar com o gestor.`,
    });
    await salvar("menu", {});
    await responder("👍 Avisei o gestor. Em breve entram em contato. Digite *menu* para voltar.");
    return new Response("ok", { status: 200 });
  }

  // Não reconhecido → mostra o menu
  await salvar("menu", {});
  await responder(menu(func.nome));
  return new Response("ok", { status: 200 });
});
