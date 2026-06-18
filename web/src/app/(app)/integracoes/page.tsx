"use client";

import * as React from "react";
import { createClient } from "@/lib/supabase/client";
import { useData } from "@/components/data-provider";
import { useToast } from "@/components/ui/toast";
import { PageHeader } from "@/components/page-header";
import { Card, CardHeader, CardTitle, CardBody } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input, Select, Label } from "@/components/ui/field";
import { Modal, ModalBody, ModalFooter } from "@/components/ui/modal";
import { ConfirmDialog } from "@/components/ui/confirm";
import { EVENTOS, ingestUrl, whatsappInboundUrl } from "@/lib/integrations";
import { formatDate, cn } from "@/lib/utils";
import {
  INTEGRACAO_TIPO_LABELS, type Integracao, type IntegracaoLog, type IntegracaoTipo,
  type WhatsappConfig, type WhatsappProvider,
} from "@/lib/types";
import {
  Plus, Pencil, Trash2, Lock, Plug, Send, RefreshCw, Power, Copy, Webhook, Download, KeyRound, MessageCircle,
} from "lucide-react";

export default function IntegracoesPage() {
  const { isAdmin, loading } = useData();
  const toast = useToast();
  const supabase = React.useMemo(() => createClient(), []);

  const [integracoes, setIntegracoes] = React.useState<Integracao[] | null>(null);
  const [logs, setLogs] = React.useState<IntegracaoLog[]>([]);
  const [modalOpen, setModalOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Integracao | null>(null);
  const [delItem, setDelItem] = React.useState<Integracao | null>(null);
  const [busyId, setBusyId] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    const [{ data: ints }, { data: lg }] = await Promise.all([
      supabase.from("integracoes").select("*").order("created_at", { ascending: false }),
      supabase.from("integracao_logs").select("*").order("created_at", { ascending: false }).limit(30),
    ]);
    setIntegracoes((ints as Integracao[]) ?? []);
    setLogs((lg as IntegracaoLog[]) ?? []);
  }, [supabase]);

  React.useEffect(() => { if (isAdmin) load(); }, [isAdmin, load]);

  async function toggleAtivo(i: Integracao) {
    const { error } = await supabase.from("integracoes").update({ ativo: !i.ativo }).eq("id", i.id);
    if (error) { toast("Erro: " + error.message, "error"); return; }
    await load();
  }

  async function handleDelete() {
    if (!delItem) return;
    const { error } = await supabase.from("integracoes").delete().eq("id", delItem.id);
    setDelItem(null);
    if (error) { toast("Erro: " + error.message, "error"); return; }
    await load();
    toast("Integração excluída.");
  }

  async function runAction(i: Integracao, action: "test" | "sync") {
    setBusyId(i.id);
    try {
      const { data, error } = await supabase.functions.invoke("integracoes", { body: { action, id: i.id } });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      if (action === "test") toast(data?.ok ? "Teste enviado com sucesso." : `Falhou (HTTP ${data?.status}).`, data?.ok ? "success" : "error");
      else toast(`Importadas ${data?.importadas ?? 0} ordem(ns).`);
      await load();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Erro.", "error");
    } finally {
      setBusyId(null);
    }
  }

  if (loading) return <><PageHeader title="Integrações" /><Skeleton className="h-72" /></>;

  if (!isAdmin)
    return (
      <>
        <PageHeader title="Integrações" />
        <Card><CardBody>
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Lock size={36} className="text-muted mb-3" />
            <p className="text-sm text-muted">Acesso restrito a administradores.</p>
          </div>
        </CardBody></Card>
      </>
    );

  return (
    <>
      <PageHeader title="Integrações" subtitle="Conecte o painel a webhooks, APIs externas e importações">
        <Button onClick={() => { setEditing(null); setModalOpen(true); }}>
          <Plus size={16} /> Nova integração
        </Button>
      </PageHeader>

      <Card className="mb-5">
        <CardHeader><CardTitle>Integrações configuradas</CardTitle></CardHeader>
        <CardBody className="p-0">
          {integracoes === null ? (
            <div className="p-5 space-y-3"><Skeleton className="h-10" /><Skeleton className="h-10" /></div>
          ) : integracoes.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Plug size={36} className="text-muted mb-3" />
              <p className="text-sm text-muted">Nenhuma integração ainda.</p>
              <Button className="mt-4" onClick={() => { setEditing(null); setModalOpen(true); }}>
                <Plus size={16} /> Criar primeira
              </Button>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {integracoes.map((i) => (
                <IntegracaoRow
                  key={i.id} item={i} busy={busyId === i.id}
                  onToggle={() => toggleAtivo(i)}
                  onEdit={() => { setEditing(i); setModalOpen(true); }}
                  onDelete={() => setDelItem(i)}
                  onTest={() => runAction(i, "test")}
                  onSync={() => runAction(i, "sync")}
                />
              ))}
            </div>
          )}
        </CardBody>
      </Card>

      <Card className="mb-5">
        <CardHeader><CardTitle>API de entrada — como enviar dados</CardTitle></CardHeader>
        <CardBody>
          <p className="text-sm text-muted mb-3">
            Crie uma integração do tipo <strong>API de entrada</strong>, copie o token gerado e envie ordens via <code className="text-xs">POST</code> para a URL abaixo,
            usando o header <code className="text-xs">x-api-key</code>.
          </p>
          <CopyField label="Endpoint" value={ingestUrl()} />
          <pre className="mt-3 rounded-lg border border-border bg-surface-2 p-3 text-xs overflow-x-auto">{`curl -X POST "${ingestUrl()}" \\
  -H "x-api-key: SEU_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{"data":"2026-06-18","regiao":"Centro","equipe":"Equipe A","linha_servico":"Elétrica","valor_venda":1500,"despesa_direta":300,"status":"concluido"}'`}</pre>
          <p className="text-xs text-muted mt-2">
            Campos obrigatórios: <code>data</code>, <code>regiao</code>, <code>equipe</code>, <code>linha_servico</code> (devem existir em Cadastros). Aceita um objeto ou uma lista.
          </p>
        </CardBody>
      </Card>

      <Card className="mb-5">
        <CardHeader><CardTitle>Bot de WhatsApp — conversação</CardTitle></CardHeader>
        <CardBody>
          <p className="text-sm text-muted mb-3">
            Crie uma integração do tipo <strong>Bot de WhatsApp</strong> com as credenciais do provedor.
            Para o bot <strong>responder</strong> os funcionários, configure o webhook de mensagens recebidas
            do seu provedor (Z-API ou Meta) apontando para a URL abaixo.
          </p>
          <CopyField label="Webhook de recebimento (inbound)" value={whatsappInboundUrl()} />
          <ul className="mt-3 text-xs text-muted list-disc pl-5 space-y-1">
            <li><strong>Z-API:</strong> cole esta URL em &quot;Ao receber&quot; (on-message-received) no painel da Z-API.</li>
            <li><strong>Meta:</strong> use como Callback URL; o Verify Token deve bater com a variável <code>WHATSAPP_VERIFY_TOKEN</code> da função.</li>
            <li>Os funcionários precisam estar cadastrados em <strong>Cadastros → Funcionários</strong> com o telefone correto.</li>
          </ul>
        </CardBody>
      </Card>

      <Card>
        <CardHeader><CardTitle>Atividade recente</CardTitle></CardHeader>
        <CardBody className="p-0">
          {logs.length === 0 ? (
            <p className="text-sm text-muted py-8 text-center">Sem registros ainda.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-border text-left">
                  <Th>Quando</Th><Th>Direção</Th><Th>Evento</Th><Th>Status</Th><Th>Mensagem</Th>
                </tr></thead>
                <tbody>
                  {logs.map((l) => (
                    <tr key={l.id} className="border-b border-border last:border-0 hover:bg-surface-2">
                      <Td className="text-muted whitespace-nowrap">{new Date(l.created_at).toLocaleString("pt-BR")}</Td>
                      <Td>{l.direcao ?? "—"}</Td>
                      <Td className="font-mono text-xs">{l.evento ?? "—"}</Td>
                      <Td><Badge tone={l.sucesso ? "green" : "red"}>{l.sucesso ? "ok" : "falha"}{l.status ? ` ${l.status}` : ""}</Badge></Td>
                      <Td className="text-muted max-w-[280px] truncate" title={l.mensagem ?? ""}>{l.mensagem ?? "—"}</Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardBody>
      </Card>

      {modalOpen && (
        <IntegracaoModal
          integracao={editing}
          onClose={() => { setModalOpen(false); setEditing(null); }}
          onSaved={async () => { setModalOpen(false); setEditing(null); await load(); }}
        />
      )}
      <ConfirmDialog
        open={!!delItem}
        title="Excluir integração"
        message={`Excluir "${delItem?.nome}"? Esta ação é permanente.`}
        confirmLabel="Excluir"
        onConfirm={handleDelete}
        onCancel={() => setDelItem(null)}
      />
    </>
  );
}

const TIPO_ICON: Record<IntegracaoTipo, React.ComponentType<{ size?: number; className?: string }>> = {
  saida: Webhook, entrada: KeyRound, importacao: Download, whatsapp: MessageCircle,
};

function IntegracaoRow({ item: i, busy, onToggle, onEdit, onDelete, onTest, onSync }: {
  item: Integracao; busy: boolean;
  onToggle: () => void; onEdit: () => void; onDelete: () => void; onTest: () => void; onSync: () => void;
}) {
  const Icon = TIPO_ICON[i.tipo];
  return (
    <div className="flex items-center gap-4 px-5 py-4">
      <div className={cn("shrink-0 rounded-lg p-2", i.ativo ? "bg-primary-soft text-primary" : "bg-surface-2 text-muted")}>
        <Icon size={18} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="font-semibold truncate">{i.nome}</span>
          <Badge tone={i.ativo ? "green" : "gray"}>{i.ativo ? "Ativa" : "Inativa"}</Badge>
        </div>
        <div className="text-xs text-muted">
          {INTEGRACAO_TIPO_LABELS[i.tipo]}
          {i.url ? ` · ${i.url}` : ""}
          {i.tipo === "saida" && i.eventos.length ? ` · ${i.eventos.length} evento(s)` : ""}
        </div>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        {(i.tipo === "saida" || i.tipo === "whatsapp") && (
          <button disabled={busy} onClick={onTest} title={i.tipo === "whatsapp" ? "Enviar mensagem de teste" : "Testar webhook"}
            className="p-1.5 rounded-md text-muted hover:text-primary hover:bg-primary-soft disabled:opacity-40 cursor-pointer"><Send size={15} /></button>
        )}
        {i.tipo === "importacao" && (
          <button disabled={busy} onClick={onSync} title="Sincronizar agora"
            className="p-1.5 rounded-md text-muted hover:text-primary hover:bg-primary-soft disabled:opacity-40 cursor-pointer"><RefreshCw size={15} className={busy ? "animate-spin" : ""} /></button>
        )}
        <button onClick={onToggle} title={i.ativo ? "Desativar" : "Ativar"}
          className={cn("p-1.5 rounded-md hover:bg-surface-2 cursor-pointer", i.ativo ? "text-green" : "text-muted")}><Power size={15} /></button>
        <button onClick={onEdit} title="Editar"
          className="p-1.5 rounded-md text-muted hover:text-primary hover:bg-primary-soft cursor-pointer"><Pencil size={15} /></button>
        <button onClick={onDelete} title="Excluir"
          className="p-1.5 rounded-md text-muted hover:text-red hover:bg-red-soft cursor-pointer"><Trash2 size={15} /></button>
      </div>
    </div>
  );
}

function IntegracaoModal({ integracao, onClose, onSaved }: {
  integracao: Integracao | null; onClose: () => void; onSaved: () => void;
}) {
  const { userId } = useData();
  const toast = useToast();
  const supabase = React.useMemo(() => createClient(), []);
  const [saving, setSaving] = React.useState(false);
  const [tipo, setTipo] = React.useState<IntegracaoTipo>(integracao?.tipo ?? "saida");
  const [secret, setSecret] = React.useState(integracao?.secret ?? "");
  const [eventos, setEventos] = React.useState<string[]>(integracao?.eventos ?? EVENTOS.map((e) => e.id));

  // Config específica de WhatsApp
  const waCfg = (integracao?.config ?? {}) as unknown as WhatsappConfig;
  const [provider, setProvider] = React.useState<WhatsappProvider>(waCfg.provider ?? "zapi");
  const [zapi, setZapi] = React.useState({
    instanceId: waCfg.zapi?.instanceId ?? "",
    token: waCfg.zapi?.token ?? "",
    clientToken: waCfg.zapi?.clientToken ?? "",
  });
  const [meta, setMeta] = React.useState({
    phoneNumberId: waCfg.meta?.phoneNumberId ?? "",
    accessToken: waCfg.meta?.accessToken ?? "",
  });
  const [destinatarios, setDestinatarios] = React.useState((waCfg.destinatarios ?? []).join(", "));
  const [notificarEquipe, setNotificarEquipe] = React.useState(waCfg.notificar_equipe ?? false);

  function genToken() {
    const t = (crypto.randomUUID() + crypto.randomUUID()).replace(/-/g, "");
    setSecret(t);
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    const fd = new FormData(e.currentTarget);
    const precisaUrl = tipo === "saida" || tipo === "importacao";
    const config: Record<string, unknown> =
      tipo === "whatsapp"
        ? {
            provider,
            ...(provider === "zapi"
              ? { zapi }
              : { meta }),
            destinatarios: destinatarios
              .split(/[,\n;]/)
              .map((s) => s.replace(/\D/g, ""))
              .filter(Boolean),
            notificar_equipe: notificarEquipe,
          }
        : (integracao?.config ?? {});
    const rec = {
      tipo,
      nome: (fd.get("nome") as string).trim(),
      ativo: fd.get("ativo") === "on",
      url: precisaUrl ? ((fd.get("url") as string).trim() || null) : null,
      secret: secret || null,
      eventos: tipo === "saida" || tipo === "whatsapp" ? eventos : [],
      config,
    };
    if (!rec.nome) { setSaving(false); toast("Informe um nome.", "error"); return; }
    if (precisaUrl && !rec.url) { setSaving(false); toast("Informe a URL.", "error"); return; }
    if (tipo === "whatsapp") {
      if (provider === "zapi" && (!zapi.instanceId || !zapi.token)) {
        setSaving(false); toast("Informe Instance ID e Token da Z-API.", "error"); return;
      }
      if (provider === "meta" && (!meta.phoneNumberId || !meta.accessToken)) {
        setSaving(false); toast("Informe Phone Number ID e Access Token da Meta.", "error"); return;
      }
    }

    const { error } = integracao
      ? await supabase.from("integracoes").update(rec).eq("id", integracao.id)
      : await supabase.from("integracoes").insert([{ ...rec, created_by: userId }]);

    setSaving(false);
    if (error) { toast("Erro: " + error.message, "error"); return; }
    toast(integracao ? "Integração atualizada." : "Integração criada.");
    onSaved();
  }

  return (
    <Modal open onClose={onClose} title={integracao ? "Editar integração" : "Nova integração"} className="max-w-lg">
      <form onSubmit={handleSubmit}>
        <ModalBody>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Tipo *</Label>
              <Select value={tipo} onChange={(e) => setTipo(e.target.value as IntegracaoTipo)} disabled={!!integracao}>
                <option value="saida">Webhook de saída</option>
                <option value="entrada">API de entrada</option>
                <option value="importacao">Importação externa</option>
                <option value="whatsapp">Bot de WhatsApp</option>
              </Select>
            </div>
            <div>
              <Label>Nome *</Label>
              <Input name="nome" required placeholder="ex: Notificar WhatsApp" defaultValue={integracao?.nome ?? ""} />
            </div>
          </div>

          {(tipo === "saida" || tipo === "importacao") && (
            <div>
              <Label>{tipo === "saida" ? "URL de destino *" : "URL de origem (JSON) *"}</Label>
              <Input name="url" type="url" required placeholder="https://..." defaultValue={integracao?.url ?? ""} />
            </div>
          )}

          {tipo !== "whatsapp" && (
            <div>
              <Label>
                {tipo === "entrada" ? "Token de acesso (x-api-key) *" : "Segredo / token (opcional)"}
              </Label>
              <div className="flex gap-2">
                <Input
                  value={secret}
                  onChange={(e) => setSecret(e.target.value)}
                  placeholder={tipo === "entrada" ? "gere um token" : "enviado como X-Webhook-Secret / Bearer"}
                  className="font-mono text-xs"
                />
                {tipo === "entrada" && (
                  <Button type="button" variant="secondary" onClick={genToken}><KeyRound size={14} /> Gerar</Button>
                )}
              </div>
              {tipo === "entrada" && (
                <p className="text-xs text-muted mt-1">Quem enviar dados deve usar este token no header <code>x-api-key</code>.</p>
              )}
              {tipo === "importacao" && (
                <p className="text-xs text-muted mt-1">Se preenchido, é enviado como <code>Authorization: Bearer</code> ao buscar a origem.</p>
              )}
            </div>
          )}

          {tipo === "whatsapp" && (
            <WhatsappFields
              provider={provider} setProvider={setProvider}
              zapi={zapi} setZapi={setZapi}
              meta={meta} setMeta={setMeta}
              destinatarios={destinatarios} setDestinatarios={setDestinatarios}
              notificarEquipe={notificarEquipe} setNotificarEquipe={setNotificarEquipe}
            />
          )}

          {(tipo === "saida" || tipo === "whatsapp") && (
            <div>
              <Label>{tipo === "whatsapp" ? "Eventos que enviam mensagem" : "Eventos que disparam o webhook"}</Label>
              <div className="grid grid-cols-2 gap-2 mt-1">
                {EVENTOS.map((ev) => (
                  <label key={ev.id} className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={eventos.includes(ev.id)}
                      onChange={(e) => setEventos((prev) => e.target.checked ? [...prev, ev.id] : prev.filter((x) => x !== ev.id))}
                      className="accent-[var(--primary)]"
                    />
                    {ev.label}
                  </label>
                ))}
              </div>
            </div>
          )}

          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" name="ativo" defaultChecked={integracao?.ativo ?? true} className="accent-[var(--primary)]" />
            Integração ativa
          </label>
        </ModalBody>
        <ModalFooter>
          <Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button type="submit" disabled={saving}>{saving ? "Salvando..." : "Salvar"}</Button>
        </ModalFooter>
      </form>
    </Modal>
  );
}

function WhatsappFields({
  provider, setProvider, zapi, setZapi, meta, setMeta,
  destinatarios, setDestinatarios, notificarEquipe, setNotificarEquipe,
}: {
  provider: WhatsappProvider;
  setProvider: (p: WhatsappProvider) => void;
  zapi: { instanceId: string; token: string; clientToken: string };
  setZapi: React.Dispatch<React.SetStateAction<{ instanceId: string; token: string; clientToken: string }>>;
  meta: { phoneNumberId: string; accessToken: string };
  setMeta: React.Dispatch<React.SetStateAction<{ phoneNumberId: string; accessToken: string }>>;
  destinatarios: string;
  setDestinatarios: (s: string) => void;
  notificarEquipe: boolean;
  setNotificarEquipe: (b: boolean) => void;
}) {
  return (
    <div className="space-y-4 rounded-lg border border-border bg-surface-2 p-3">
      <div>
        <Label>Provedor *</Label>
        <Select value={provider} onChange={(e) => setProvider(e.target.value as WhatsappProvider)}>
          <option value="zapi">Z-API (rápido para MVP/demo)</option>
          <option value="meta">WhatsApp Cloud API (Meta — oficial)</option>
        </Select>
      </div>

      {provider === "zapi" ? (
        <div className="grid grid-cols-1 gap-3">
          <div>
            <Label>Instance ID *</Label>
            <Input value={zapi.instanceId} onChange={(e) => setZapi((s) => ({ ...s, instanceId: e.target.value }))} className="font-mono text-xs" />
          </div>
          <div>
            <Label>Token *</Label>
            <Input value={zapi.token} onChange={(e) => setZapi((s) => ({ ...s, token: e.target.value }))} className="font-mono text-xs" />
          </div>
          <div>
            <Label>Client-Token (segurança da conta)</Label>
            <Input value={zapi.clientToken} onChange={(e) => setZapi((s) => ({ ...s, clientToken: e.target.value }))} className="font-mono text-xs" />
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3">
          <div>
            <Label>Phone Number ID *</Label>
            <Input value={meta.phoneNumberId} onChange={(e) => setMeta((s) => ({ ...s, phoneNumberId: e.target.value }))} className="font-mono text-xs" />
          </div>
          <div>
            <Label>Access Token *</Label>
            <Input value={meta.accessToken} onChange={(e) => setMeta((s) => ({ ...s, accessToken: e.target.value }))} className="font-mono text-xs" />
          </div>
        </div>
      )}

      <div>
        <Label>Destinatários fixos (números com DDI+DDD)</Label>
        <Input
          value={destinatarios}
          onChange={(e) => setDestinatarios(e.target.value)}
          placeholder="ex: 5511999999999, 5521988888888"
          className="font-mono text-xs"
        />
        <p className="text-xs text-muted mt-1">Separe por vírgula. Recebem todas as notificações dos eventos marcados.</p>
      </div>

      <label className="flex items-center gap-2 text-sm cursor-pointer">
        <input type="checkbox" checked={notificarEquipe} onChange={(e) => setNotificarEquipe(e.target.checked)} className="accent-[var(--primary)]" />
        Também notificar os funcionários da equipe da ordem (cadastrados em Funcionários)
      </label>
    </div>
  );
}

function CopyField({ label, value }: { label: string; value: string }) {
  const toast = useToast();
  return (
    <div>
      <Label>{label}</Label>
      <div className="flex gap-2">
        <Input readOnly value={value} className="font-mono text-xs" onFocus={(e) => e.currentTarget.select()} />
        <Button type="button" variant="secondary" onClick={() => { navigator.clipboard?.writeText(value); toast("Copiado."); }}>
          <Copy size={14} /> Copiar
        </Button>
      </div>
    </div>
  );
}

function Th({ children, className }: { children: React.ReactNode; className?: string }) {
  return <th className={cn("px-4 py-3 text-xs font-semibold text-muted uppercase tracking-wide whitespace-nowrap", className)}>{children}</th>;
}
function Td({ children, className, title }: { children: React.ReactNode; className?: string; title?: string }) {
  return <td className={cn("px-4 py-3", className)} title={title}>{children}</td>;
}
