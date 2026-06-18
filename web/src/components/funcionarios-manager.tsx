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
import { cn } from "@/lib/utils";
import type { Funcionario } from "@/lib/types";
import { Plus, Pencil, Trash2, Power, X } from "lucide-react";

export function FuncionariosManager() {
  const { equipes, userId } = useData();
  const toast = useToast();
  const supabase = React.useMemo(() => createClient(), []);

  const [lista, setLista] = React.useState<Funcionario[] | null>(null);
  const [editing, setEditing] = React.useState<Funcionario | null>(null);
  const [form, setForm] = React.useState({ nome: "", telefone: "", equipe: "", cargo: "" });
  const [saving, setSaving] = React.useState(false);
  const [delItem, setDelItem] = React.useState<Funcionario | null>(null);

  const load = React.useCallback(async () => {
    const { data } = await supabase.from("funcionarios").select("*").order("nome");
    setLista((data as Funcionario[]) ?? []);
  }, [supabase]);

  React.useEffect(() => { load(); }, [load]);

  function startEdit(f: Funcionario) {
    setEditing(f);
    setForm({ nome: f.nome, telefone: f.telefone, equipe: f.equipe ?? "", cargo: f.cargo ?? "" });
  }

  function resetForm() {
    setEditing(null);
    setForm({ nome: "", telefone: "", equipe: "", cargo: "" });
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const nome = form.nome.trim();
    const telefone = form.telefone.replace(/\D/g, "");
    if (!nome) { toast("Informe o nome.", "error"); return; }
    if (telefone.length < 10) { toast("Telefone inválido (use DDI+DDD).", "error"); return; }
    setSaving(true);
    const rec = {
      nome,
      telefone,
      equipe: form.equipe || null,
      cargo: form.cargo.trim() || null,
    };
    const { error } = editing
      ? await supabase.from("funcionarios").update(rec).eq("id", editing.id)
      : await supabase.from("funcionarios").insert([{ ...rec, created_by: userId }]);
    setSaving(false);
    if (error) {
      toast(error.code === "23505" ? "Já existe um funcionário com esse telefone." : "Erro: " + error.message, "error");
      return;
    }
    resetForm();
    await load();
    toast(editing ? "Funcionário atualizado." : "Funcionário adicionado.");
  }

  async function toggleAtivo(f: Funcionario) {
    const { error } = await supabase.from("funcionarios").update({ ativo: !f.ativo }).eq("id", f.id);
    if (error) { toast("Erro: " + error.message, "error"); return; }
    await load();
  }

  async function remove() {
    if (!delItem) return;
    const { error } = await supabase.from("funcionarios").delete().eq("id", delItem.id);
    setDelItem(null);
    if (error) { toast("Erro: " + error.message, "error"); return; }
    if (editing?.id === delItem.id) resetForm();
    await load();
    toast("Funcionário removido.");
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Funcionários (WhatsApp)</CardTitle>
      </CardHeader>
      <CardBody className="space-y-4">
        <p className="text-xs text-muted">
          Cadastre o telefone de cada funcionário para receber notificações do bot e ser identificado nas conversas.
          Formato do telefone: DDI + DDD + número (ex: <code>5511999999999</code>).
        </p>

        <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2 rounded-lg border border-border bg-surface-2 p-3">
          <div>
            <Label>Nome *</Label>
            <Input value={form.nome} onChange={(e) => setForm((s) => ({ ...s, nome: e.target.value }))} placeholder="Nome do funcionário" />
          </div>
          <div>
            <Label>Telefone (WhatsApp) *</Label>
            <Input value={form.telefone} onChange={(e) => setForm((s) => ({ ...s, telefone: e.target.value }))} placeholder="5511999999999" className="font-mono text-xs" />
          </div>
          <div>
            <Label>Equipe</Label>
            <Select value={form.equipe} onChange={(e) => setForm((s) => ({ ...s, equipe: e.target.value }))}>
              <option value="">— sem equipe —</option>
              {equipes.map((eq) => <option key={eq} value={eq}>{eq}</option>)}
            </Select>
          </div>
          <div>
            <Label>Cargo</Label>
            <Input value={form.cargo} onChange={(e) => setForm((s) => ({ ...s, cargo: e.target.value }))} placeholder="ex: Encarregado" />
          </div>
          <div className="sm:col-span-2 flex gap-2">
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
                <Th>Nome</Th><Th>Telefone</Th><Th>Equipe</Th><Th>Cargo</Th><Th>Status</Th><Th className="text-right">Ações</Th>
              </tr>
            </thead>
            <tbody>
              {lista === null ? (
                <tr><td colSpan={6} className="text-center py-8 text-muted text-sm">Carregando...</td></tr>
              ) : lista.length ? lista.map((f) => (
                <tr key={f.id} className="border-b border-border last:border-0 hover:bg-surface-2 transition-colors">
                  <Td className="font-medium">{f.nome}</Td>
                  <Td className="font-mono text-xs">{f.telefone}</Td>
                  <Td>{f.equipe ?? "—"}</Td>
                  <Td>{f.cargo ?? "—"}</Td>
                  <Td><Badge tone={f.ativo ? "green" : "gray"}>{f.ativo ? "Ativo" : "Inativo"}</Badge></Td>
                  <Td className="text-right">
                    <div className="flex justify-end gap-1">
                      <button onClick={() => toggleAtivo(f)} title={f.ativo ? "Desativar" : "Ativar"}
                        className={cn("p-1.5 rounded-md hover:bg-surface-2 cursor-pointer", f.ativo ? "text-green" : "text-muted")}><Power size={14} /></button>
                      <button onClick={() => startEdit(f)} title="Editar"
                        className="p-1.5 rounded-md text-muted hover:text-primary hover:bg-primary-soft cursor-pointer"><Pencil size={14} /></button>
                      <button onClick={() => setDelItem(f)} title="Excluir"
                        className="p-1.5 rounded-md text-muted hover:text-red hover:bg-red-soft cursor-pointer"><Trash2 size={14} /></button>
                    </div>
                  </Td>
                </tr>
              )) : (
                <tr><td colSpan={6} className="text-center py-10 text-muted text-sm">Nenhum funcionário cadastrado.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </CardBody>

      <ConfirmDialog
        open={!!delItem}
        message={`Remover "${delItem?.nome}"?`}
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
