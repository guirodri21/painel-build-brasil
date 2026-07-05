"use client";

import * as React from "react";
import { createClient } from "@/lib/supabase/client";
import { useData } from "@/components/data-provider";
import { useToast } from "@/components/ui/toast";
import { Card, CardHeader, CardTitle, CardBody } from "@/components/ui/card";
import { Input, Select, Label } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/ui/confirm";
import { cn, formatCurrency, formatDate, todayISO } from "@/lib/utils";
import { FROTA_STATUS } from "@/lib/types";
import type { FrotaVeiculo } from "@/lib/types";
import { Plus, Pencil, Trash2, Power, X } from "lucide-react";

type Tone = "green" | "gray" | "orange" | "red" | "blue";

const STATUS_TONE: Record<string, Tone> = {
  "Disponível": "green",
  "Em uso": "blue",
  "Parado": "gray",
  "Manutenção": "orange",
};

const FORM_VAZIO = {
  placa: "", modelo: "", ano: "", responsavel: "", status: "Disponível",
  km_atual: "", venc_documento: "", venc_seguro: "", venc_ipva: "",
  proxima_manutencao: "", custo_mensal: "",
};

/** Classifica um vencimento: vermelho se vencido, laranja se ≤30 dias. */
function toneVenc(iso: string | null): Tone | null {
  if (!iso) return null;
  const hoje = todayISO();
  if (iso < hoje) return "red";
  const em30 = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
  return iso <= em30 ? "orange" : "gray";
}

function VencCell({ iso }: { iso: string | null }) {
  if (!iso) return <span className="text-muted">—</span>;
  const tone = toneVenc(iso) ?? "gray";
  return <Badge tone={tone}>{formatDate(iso)}</Badge>;
}

export function FrotaInventarioManager() {
  const { userId } = useData();
  const toast = useToast();
  const supabase = React.useMemo(() => createClient(), []);

  const [lista, setLista] = React.useState<FrotaVeiculo[] | null>(null);
  const [editing, setEditing] = React.useState<FrotaVeiculo | null>(null);
  const [form, setForm] = React.useState({ ...FORM_VAZIO });
  const [saving, setSaving] = React.useState(false);
  const [delItem, setDelItem] = React.useState<FrotaVeiculo | null>(null);

  const load = React.useCallback(async () => {
    const { data } = await supabase.from("frota_veiculos").select("*").order("placa");
    setLista((data as FrotaVeiculo[]) ?? []);
  }, [supabase]);

  React.useEffect(() => {
    let ativo = true;
    (async () => {
      const { data } = await supabase.from("frota_veiculos").select("*").order("placa");
      if (ativo) setLista((data as FrotaVeiculo[]) ?? []);
    })();
    return () => { ativo = false; };
  }, [supabase]);

  function startEdit(v: FrotaVeiculo) {
    setEditing(v);
    setForm({
      placa: v.placa,
      modelo: v.modelo ?? "",
      ano: v.ano != null ? String(v.ano) : "",
      responsavel: v.responsavel ?? "",
      status: v.status,
      km_atual: v.km_atual != null ? String(v.km_atual) : "",
      venc_documento: v.venc_documento ?? "",
      venc_seguro: v.venc_seguro ?? "",
      venc_ipva: v.venc_ipva ?? "",
      proxima_manutencao: v.proxima_manutencao ?? "",
      custo_mensal: v.custo_mensal != null ? String(v.custo_mensal) : "",
    });
  }

  function resetForm() {
    setEditing(null);
    setForm({ ...FORM_VAZIO });
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const placa = form.placa.trim().toUpperCase();
    if (!placa) { toast("Informe a placa.", "error"); return; }
    setSaving(true);
    const rec = {
      placa,
      modelo: form.modelo.trim() || null,
      ano: form.ano ? Number(form.ano) : null,
      responsavel: form.responsavel.trim() || null,
      status: form.status,
      km_atual: form.km_atual ? Number(form.km_atual) : 0,
      venc_documento: form.venc_documento || null,
      venc_seguro: form.venc_seguro || null,
      venc_ipva: form.venc_ipva || null,
      proxima_manutencao: form.proxima_manutencao || null,
      custo_mensal: form.custo_mensal ? Number(form.custo_mensal) : 0,
      updated_at: new Date().toISOString(),
    };
    const { error } = editing
      ? await supabase.from("frota_veiculos").update(rec).eq("id", editing.id)
      : await supabase.from("frota_veiculos").insert([{ ...rec, created_by: userId }]);
    setSaving(false);
    if (error) {
      toast(error.code === "23505" ? "Já existe um veículo com essa placa." : "Erro: " + error.message, "error");
      return;
    }
    resetForm();
    await load();
    toast(editing ? "Veículo atualizado." : "Veículo adicionado.");
  }

  async function toggleAtivo(v: FrotaVeiculo) {
    const { error } = await supabase.from("frota_veiculos").update({ ativo: !v.ativo }).eq("id", v.id);
    if (error) { toast("Erro: " + error.message, "error"); return; }
    await load();
  }

  async function remove() {
    if (!delItem) return;
    const { error } = await supabase.from("frota_veiculos").delete().eq("id", delItem.id);
    setDelItem(null);
    if (error) { toast("Erro: " + error.message, "error"); return; }
    if (editing?.id === delItem.id) resetForm();
    await load();
    toast("Veículo removido.");
  }

  const set = (patch: Partial<typeof FORM_VAZIO>) => setForm((s) => ({ ...s, ...patch }));

  const acoes = (v: FrotaVeiculo) => (
    <>
      <button onClick={() => toggleAtivo(v)} title={v.ativo ? "Desativar" : "Ativar"}
        className={cn("p-2 rounded-md hover:bg-surface-2 cursor-pointer", v.ativo ? "text-green" : "text-muted")}><Power size={15} /></button>
      <button onClick={() => startEdit(v)} title="Editar"
        className="p-2 rounded-md text-muted hover:text-primary hover:bg-primary-soft cursor-pointer"><Pencil size={15} /></button>
      <button onClick={() => setDelItem(v)} title="Excluir"
        className="p-2 rounded-md text-muted hover:text-red hover:bg-red-soft cursor-pointer"><Trash2 size={15} /></button>
    </>
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Inventário de Frota</CardTitle>
      </CardHeader>
      <CardBody className="space-y-4">
        <p className="text-xs text-muted">
          Cadastro dos veículos (separado do Pipeline de Demandas). Alimenta os indicadores por veículo:
          disponibilidade, custo mensal, documentação, seguro e IPVA.
        </p>

        <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 rounded-lg border border-border bg-surface-2 p-3">
          <div>
            <Label>Placa *</Label>
            <Input value={form.placa} onChange={(e) => set({ placa: e.target.value })} placeholder="ABC1D23" className="uppercase" />
          </div>
          <div>
            <Label>Modelo</Label>
            <Input value={form.modelo} onChange={(e) => set({ modelo: e.target.value })} placeholder="ex: Fiat Strada" />
          </div>
          <div>
            <Label>Ano</Label>
            <Input type="number" value={form.ano} onChange={(e) => set({ ano: e.target.value })} placeholder="2022" />
          </div>
          <div>
            <Label>Responsável</Label>
            <Input value={form.responsavel} onChange={(e) => set({ responsavel: e.target.value })} placeholder="Nome" />
          </div>
          <div>
            <Label>Status</Label>
            <Select value={form.status} onChange={(e) => set({ status: e.target.value })}>
              {FROTA_STATUS.map((s) => <option key={s} value={s}>{s}</option>)}
            </Select>
          </div>
          <div>
            <Label>KM atual</Label>
            <Input type="number" value={form.km_atual} onChange={(e) => set({ km_atual: e.target.value })} placeholder="0" />
          </div>
          <div>
            <Label>Custo mensal (R$)</Label>
            <Input type="number" step="0.01" value={form.custo_mensal} onChange={(e) => set({ custo_mensal: e.target.value })} placeholder="0,00" />
          </div>
          <div>
            <Label>Próxima manutenção</Label>
            <Input type="date" value={form.proxima_manutencao} onChange={(e) => set({ proxima_manutencao: e.target.value })} />
          </div>
          <div>
            <Label>Vencimento documento</Label>
            <Input type="date" value={form.venc_documento} onChange={(e) => set({ venc_documento: e.target.value })} />
          </div>
          <div>
            <Label>Vencimento seguro</Label>
            <Input type="date" value={form.venc_seguro} onChange={(e) => set({ venc_seguro: e.target.value })} />
          </div>
          <div>
            <Label>Vencimento IPVA</Label>
            <Input type="date" value={form.venc_ipva} onChange={(e) => set({ venc_ipva: e.target.value })} />
          </div>
          <div className="sm:col-span-2 lg:col-span-4 flex gap-2">
            <Button type="submit" disabled={saving}>
              {editing ? <><Pencil size={15} /> Salvar</> : <><Plus size={15} /> Adicionar</>}
            </Button>
            {editing && (
              <Button type="button" variant="secondary" onClick={resetForm}><X size={15} /> Cancelar</Button>
            )}
          </div>
        </form>

        {/* Desktop: tabela completa */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left">
                <Th>Placa</Th><Th>Modelo</Th><Th>Ano</Th><Th>Responsável</Th><Th>Status</Th>
                <Th className="text-right">KM</Th><Th className="text-right">Custo/mês</Th>
                <Th>Próx. manut.</Th><Th>Documento</Th><Th>Seguro</Th><Th>IPVA</Th>
                <Th className="text-right">Ações</Th>
              </tr>
            </thead>
            <tbody>
              {lista === null ? (
                <tr><td colSpan={12} className="text-center py-8 text-muted text-sm">Carregando...</td></tr>
              ) : lista.length ? lista.map((v) => (
                <tr key={v.id} className={cn("border-b border-border last:border-0 hover:bg-surface-2 transition-colors", !v.ativo && "opacity-50")}>
                  <Td className="font-mono font-medium">{v.placa}</Td>
                  <Td>{v.modelo ?? "—"}</Td>
                  <Td>{v.ano ?? "—"}</Td>
                  <Td>{v.responsavel ?? "—"}</Td>
                  <Td><Badge tone={STATUS_TONE[v.status] ?? "gray"}>{v.status}</Badge></Td>
                  <Td className="text-right tabular-nums">{v.km_atual.toLocaleString("pt-BR")}</Td>
                  <Td className="text-right tabular-nums">{formatCurrency(v.custo_mensal)}</Td>
                  <Td><VencCell iso={v.proxima_manutencao} /></Td>
                  <Td><VencCell iso={v.venc_documento} /></Td>
                  <Td><VencCell iso={v.venc_seguro} /></Td>
                  <Td><VencCell iso={v.venc_ipva} /></Td>
                  <Td className="text-right"><div className="flex justify-end gap-1">{acoes(v)}</div></Td>
                </tr>
              )) : (
                <tr><td colSpan={12} className="text-center py-10 text-muted text-sm">Nenhum veículo cadastrado.</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile: cards empilhados */}
        <div className="md:hidden space-y-2">
          {lista === null ? (
            <p className="text-center py-8 text-muted text-sm">Carregando...</p>
          ) : lista.length ? lista.map((v) => (
            <div key={v.id} className={cn("rounded-lg border border-border bg-surface-2 p-3", !v.ativo && "opacity-60")}>
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono font-semibold">{v.placa}</span>
                <Badge tone={STATUS_TONE[v.status] ?? "gray"}>{v.status}</Badge>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                <div><span className="text-muted">Modelo:</span> {v.modelo ?? "—"}{v.ano ? ` · ${v.ano}` : ""}</div>
                <div><span className="text-muted">Resp.:</span> {v.responsavel ?? "—"}</div>
                <div><span className="text-muted">KM:</span> <span className="tabular-nums">{v.km_atual.toLocaleString("pt-BR")}</span></div>
                <div><span className="text-muted">Custo/mês:</span> <span className="tabular-nums">{formatCurrency(v.custo_mensal)}</span></div>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]">
                <span className="inline-flex items-center gap-1"><span className="text-muted">Manut.</span> <VencCell iso={v.proxima_manutencao} /></span>
                <span className="inline-flex items-center gap-1"><span className="text-muted">Doc</span> <VencCell iso={v.venc_documento} /></span>
                <span className="inline-flex items-center gap-1"><span className="text-muted">Seg</span> <VencCell iso={v.venc_seguro} /></span>
                <span className="inline-flex items-center gap-1"><span className="text-muted">IPVA</span> <VencCell iso={v.venc_ipva} /></span>
              </div>
              <div className="mt-2 flex justify-end gap-1 border-t border-border pt-2">{acoes(v)}</div>
            </div>
          )) : (
            <p className="text-center py-10 text-muted text-sm">Nenhum veículo cadastrado.</p>
          )}
        </div>
      </CardBody>

      <ConfirmDialog
        open={!!delItem}
        message={`Remover o veículo "${delItem?.placa}"?`}
        confirmLabel="Remover"
        onConfirm={remove}
        onCancel={() => setDelItem(null)}
      />
    </Card>
  );
}

function Th({ children, className }: { children: React.ReactNode; className?: string }) {
  return <th className={cn("px-4 py-3 text-xs font-semibold text-muted uppercase tracking-wide whitespace-nowrap", className)}>{children}</th>;
}
function Td({ children, className }: { children: React.ReactNode; className?: string }) {
  return <td className={cn("px-4 py-3 whitespace-nowrap", className)}>{children}</td>;
}
