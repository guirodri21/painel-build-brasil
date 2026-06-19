"use client";

import * as React from "react";
import { createClient } from "@/lib/supabase/client";
import { useData } from "@/components/data-provider";
import { useToast } from "@/components/ui/toast";
import { Card, CardHeader, CardTitle, CardBody } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import type { ChecklistTemplate } from "@/lib/types";
import { Plus, Trash2 } from "lucide-react";

export function ChecklistManager() {
  const { linhas } = useData();
  const toast = useToast();
  const supabase = React.useMemo(() => createClient(), []);
  const [linha, setLinha] = React.useState("");
  const [item, setItem] = React.useState("");
  const [tpl, setTpl] = React.useState<ChecklistTemplate[]>([]);
  const [busy, setBusy] = React.useState(false);

  const carregar = React.useCallback(async () => {
    const { data } = await supabase.from("checklist_templates").select("*").order("linha_servico").order("ordem_exibicao");
    setTpl((data as ChecklistTemplate[]) ?? []);
  }, [supabase]);

  React.useEffect(() => { carregar(); }, [carregar]);

  async function adicionar(e: React.FormEvent) {
    e.preventDefault();
    if (!linha || !item.trim()) { toast("Escolha a linha e digite o item.", "error"); return; }
    setBusy(true);
    const prox = tpl.filter((t) => t.linha_servico === linha).length;
    const { error } = await supabase.from("checklist_templates").insert([
      { linha_servico: linha, item: item.trim(), ordem_exibicao: prox },
    ]);
    setBusy(false);
    if (error) { toast(error.code === "23505" ? "Item já existe nessa linha." : "Erro: " + error.message, "error"); return; }
    setItem("");
    await carregar();
    toast("Item adicionado.");
  }

  async function remover(id: string) {
    const { error } = await supabase.from("checklist_templates").delete().eq("id", id);
    if (error) { toast("Erro: " + error.message, "error"); return; }
    await carregar();
  }

  const porLinha = React.useMemo(() => {
    const m = new Map<string, ChecklistTemplate[]>();
    for (const t of tpl) { const a = m.get(t.linha_servico) ?? []; a.push(t); m.set(t.linha_servico, a); }
    return m;
  }, [tpl]);

  return (
    <Card>
      <CardHeader><CardTitle>Checklists por Linha de Serviço</CardTitle></CardHeader>
      <CardBody className="space-y-4">
        <form onSubmit={adicionar} className="flex flex-wrap gap-2 items-end">
          <div className="w-48">
            <Select value={linha} onChange={(e) => setLinha(e.target.value)}>
              <option value="">Linha de serviço</option>
              {linhas.map((l) => <option key={l} value={l}>{l}</option>)}
            </Select>
          </div>
          <Input value={item} onChange={(e) => setItem(e.target.value)} placeholder="Novo item do checklist..." className="flex-1 min-w-[200px]" />
          <Button type="submit" size="icon" disabled={busy} aria-label="Adicionar"><Plus size={16} /></Button>
        </form>

        {porLinha.size ? (
          <div className="grid gap-4 sm:grid-cols-2">
            {Array.from(porLinha.entries()).map(([l, items]) => (
              <div key={l} className="rounded-lg border border-border p-3">
                <p className="text-sm font-semibold mb-2">{l}</p>
                <ul className="divide-y divide-border">
                  {items.map((t) => (
                    <li key={t.id} className="flex items-center justify-between py-1.5 text-sm">
                      <span>{t.item}</span>
                      <button onClick={() => remover(t.id)} className="p-1 rounded text-muted hover:text-red hover:bg-red-soft cursor-pointer" title="Remover">
                        <Trash2 size={13} />
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted">Nenhum checklist configurado.</p>
        )}
      </CardBody>
    </Card>
  );
}
