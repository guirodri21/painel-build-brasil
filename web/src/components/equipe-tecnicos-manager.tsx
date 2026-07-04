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
import { cn, formatCurrency } from "@/lib/utils";
import { TECNICO_TIPO, TECNICO_DISPONIBILIDADE } from "@/lib/types";
import type { Tecnico } from "@/lib/types";
import { Plus, Pencil, Trash2, Power, X } from "lucide-react";

type Tone = "green" | "gray" | "orange" | "red" | "blue" | "yellow";

const DISPO_TONE: Record<string, Tone> = {
  "Disponível": "green",
  "Ocupado": "blue",
  "Em viagem": "yellow",
  "Folga": "gray",
  "Indisponível": "red",
};

const FORM_VAZIO = {
  nome: "", tipo: "Interno", regiao: "", especialidades: "",
  disponibilidade: "Disponível", contato: "", custo_hora: "", custo_diaria: "", documentos: "",
};

export function EquipeTecnicosManager() {
  const { userId } = useData();
  const toast = useToast();
  const supabase = React.useMemo(() => createClient(), []);

  const [lista, setLista] = React.useState<Tecnico[] | null>(null);
  const [editing, setEditing] = React.useState<Tecnico | null>(null);
  const [form, setForm] = React.useState({ ...FORM_VAZIO });
  const [saving, setSaving] = React.useState(false);
  const [delItem, setDelItem] = React.useState<Tecnico | null>(null);

  const load = React.useCallback(async () => {
    const { data } = await supabase.from("tecnicos").select("*").order("nome");
    setLista((data as Tecnico[]) ?? []);
  }, [supabase]);

  React.useEffect(() => {
    let ativo = true;
    (async () => {
      const { data } = await supabase.from("tecnicos").select("*").order("nome");
      if (ativo) setLista((data as Tecnico[]) ?? []);
    })();
    return () => { ativo = false; };
  }, [supabase]);

  function startEdit(t: Tecnico) {
    setEditing(t);
    setForm({
      nome: t.nome,
      tipo: t.tipo,
      regiao: t.regiao ?? "",
      especialidades: t.especialidades ?? "",
      disponibilidade: t.disponibilidade,
      contato: t.contato ?? "",
      custo_hora: t.custo_hora != null ? String(t.custo_hora) : "",
      custo_diaria: t.custo_diaria != null ? String(t.custo_diaria) : "",
      documentos: t.documentos ?? "",
    });
  }

  function resetForm() {
    setEditing(null);
    setForm({ ...FORM_VAZIO });
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const nome = form.nome.trim();
    if (!nome) { toast("Informe o nome do técnico.", "error"); return; }
    setSaving(true);
    const rec = {
      nome,
      tipo: form.tipo,
      regiao: form.regiao.trim() || null,
      especialidades: form.especialidades.trim() || null,
      disponibilidade: form.disponibilidade,
      contato: form.contato.trim() || null,
      custo_hora: form.custo_hora ? Number(form.custo_hora) : 0,
      custo_diaria: form.custo_diaria ? Number(form.custo_diaria) : 0,
      documentos: form.documentos.trim() || null,
      updated_at: new Date().toISOString(),
    };
    const { error } = editing
      ? await supabase.from("tecnicos").update(rec).eq("id", editing.id)
      : await supabase.from("tecnicos").insert([{ ...rec, created_by: userId }]);
    setSaving(false);
    if (error) { toast("Erro: " + error.message, "error"); return; }
    resetForm();
    await load();
    toast(editing ? "Técnico atualizado." : "Técnico adicionado.");
  }

  async function toggleAtivo(t: Tecnico) {
    const { error } = await supabase.from("tecnicos").update({ ativo: !t.ativo }).eq("id", t.id);
    if (error) { toast("Erro: " + error.message, "error"); return; }
    await load();
  }

  async function remove() {
    if (!delItem) return;
    const { error } = await supabase.from("tecnicos").delete().eq("id", delItem.id);
    setDelItem(null);
    if (error) { toast("Erro: " + error.message, "error"); return; }
    if (editing?.id === delItem.id) resetForm();
    await load();
    toast("Técnico removido.");
  }

  const set = (patch: Partial<typeof FORM_VAZIO>) => setForm((s) => ({ ...s, ...patch }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Banco de Técnicos</CardTitle>
      </CardHeader>
      <CardBody className="space-y-4">
        <p className="text-xs text-muted">
          Internos e terceiros: região de atuação, especialidades, disponibilidade e custo (hora ou diária).
        </p>

        <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 rounded-lg border border-border bg-surface-2 p-3">
          <div>
            <Label>Nome *</Label>
            <Input value={form.nome} onChange={(e) => set({ nome: e.target.value })} placeholder="Nome do técnico" />
          </div>
          <div>
            <Label>Vínculo</Label>
            <Select value={form.tipo} onChange={(e) => set({ tipo: e.target.value })}>
              {TECNICO_TIPO.map((t) => <option key={t} value={t}>{t}</option>)}
            </Select>
          </div>
          <div>
            <Label>Região de atuação</Label>
            <Input value={form.regiao} onChange={(e) => set({ regiao: e.target.value })} placeholder="ex: Grande SP" />
          </div>
          <div>
            <Label>Disponibilidade</Label>
            <Select value={form.disponibilidade} onChange={(e) => set({ disponibilidade: e.target.value })}>
              {TECNICO_DISPONIBILIDADE.map((d) => <option key={d} value={d}>{d}</option>)}
            </Select>
          </div>
          <div className="lg:col-span-2">
            <Label>Especialidades</Label>
            <Input value={form.especialidades} onChange={(e) => set({ especialidades: e.target.value })} placeholder="ex: elétrica, refrigeração" />
          </div>
          <div>
            <Label>Contato</Label>
            <Input value={form.contato} onChange={(e) => set({ contato: e.target.value })} placeholder="Telefone / e-mail" />
          </div>
          <div>
            <Label>Documentos</Label>
            <Input value={form.documentos} onChange={(e) => set({ documentos: e.target.value })} placeholder="obs / links" />
          </div>
          <div>
            <Label>Custo / hora (R$)</Label>
            <Input type="number" step="0.01" value={form.custo_hora} onChange={(e) => set({ custo_hora: e.target.value })} placeholder="0,00" />
          </div>
          <div>
            <Label>Custo / diária (R$)</Label>
            <Input type="number" step="0.01" value={form.custo_diaria} onChange={(e) => set({ custo_diaria: e.target.value })} placeholder="0,00" />
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

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left">
                <Th>Nome</Th><Th>Vínculo</Th><Th>Região</Th><Th>Especialidades</Th><Th>Disponibilidade</Th>
                <Th className="text-right">Custo/h</Th><Th className="text-right">Diária</Th><Th>Status</Th>
                <Th className="text-right">Ações</Th>
              </tr>
            </thead>
            <tbody>
              {lista === null ? (
                <tr><td colSpan={9} className="text-center py-8 text-muted text-sm">Carregando...</td></tr>
              ) : lista.length ? lista.map((t) => (
                <tr key={t.id} className={cn("border-b border-border last:border-0 hover:bg-surface-2 transition-colors", !t.ativo && "opacity-50")}>
                  <Td className="font-medium">{t.nome}</Td>
                  <Td><Badge tone={t.tipo === "Terceiro" ? "orange" : "blue"}>{t.tipo}</Badge></Td>
                  <Td>{t.regiao ?? "—"}</Td>
                  <Td><span className="block max-w-[200px] truncate" title={t.especialidades ?? ""}>{t.especialidades ?? "—"}</span></Td>
                  <Td><Badge tone={DISPO_TONE[t.disponibilidade] ?? "gray"}>{t.disponibilidade}</Badge></Td>
                  <Td className="text-right tabular-nums">{t.custo_hora ? formatCurrency(t.custo_hora) : "—"}</Td>
                  <Td className="text-right tabular-nums">{t.custo_diaria ? formatCurrency(t.custo_diaria) : "—"}</Td>
                  <Td><Badge tone={t.ativo ? "green" : "gray"}>{t.ativo ? "Ativo" : "Inativo"}</Badge></Td>
                  <Td className="text-right">
                    <div className="flex justify-end gap-1">
                      <button onClick={() => toggleAtivo(t)} title={t.ativo ? "Desativar" : "Ativar"}
                        className={cn("p-1.5 rounded-md hover:bg-surface-2 cursor-pointer", t.ativo ? "text-green" : "text-muted")}><Power size={14} /></button>
                      <button onClick={() => startEdit(t)} title="Editar"
                        className="p-1.5 rounded-md text-muted hover:text-primary hover:bg-primary-soft cursor-pointer"><Pencil size={14} /></button>
                      <button onClick={() => setDelItem(t)} title="Excluir"
                        className="p-1.5 rounded-md text-muted hover:text-red hover:bg-red-soft cursor-pointer"><Trash2 size={14} /></button>
                    </div>
                  </Td>
                </tr>
              )) : (
                <tr><td colSpan={9} className="text-center py-10 text-muted text-sm">Nenhum técnico cadastrado.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </CardBody>

      <ConfirmDialog
        open={!!delItem}
        message={`Remover o técnico "${delItem?.nome}"?`}
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
  return <td className={cn("px-4 py-3", className)}>{children}</td>;
}
