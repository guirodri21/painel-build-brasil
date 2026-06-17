"use client";

import * as React from "react";
import { createClient } from "@/lib/supabase/client";
import { useData } from "@/components/data-provider";
import { useToast } from "@/components/ui/toast";
import { Card, CardHeader, CardTitle, CardBody } from "@/components/ui/card";
import { Input } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm";
import { Plus, Trash2 } from "lucide-react";

export function LookupManager({
  title,
  table,
  items,
}: {
  title: string;
  table: "equipes" | "regioes" | "linhas_servico";
  items: string[];
}) {
  const { refresh } = useData();
  const toast = useToast();
  const [novo, setNovo] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [delNome, setDelNome] = React.useState<string | null>(null);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    const nome = novo.trim();
    if (!nome) return;
    setSaving(true);
    const { error } = await createClient().from(table).insert([{ nome }]);
    setSaving(false);
    if (error) {
      toast(error.code === "23505" ? "Esse item já existe." : "Erro: " + error.message, "error");
      return;
    }
    setNovo("");
    await refresh();
    toast("Adicionado.");
  }

  async function remove() {
    if (!delNome) return;
    const { error } = await createClient().from(table).delete().eq("nome", delNome);
    setDelNome(null);
    if (error) {
      toast(
        error.code === "23503"
          ? "Não é possível excluir: há registros usando este item."
          : "Erro: " + error.message,
        "error",
      );
      return;
    }
    await refresh();
    toast("Removido.");
  }

  return (
    <Card>
      <CardHeader><CardTitle>{title}</CardTitle></CardHeader>
      <CardBody className="space-y-3">
        <form onSubmit={add} className="flex gap-2">
          <Input
            value={novo}
            onChange={(e) => setNovo(e.target.value)}
            placeholder={`Novo item...`}
          />
          <Button type="submit" size="icon" disabled={saving} aria-label="Adicionar">
            <Plus size={16} />
          </Button>
        </form>
        <ul className="divide-y divide-border">
          {items.length ? (
            items.map((nome) => (
              <li key={nome} className="flex items-center justify-between py-2">
                <span className="text-sm">{nome}</span>
                <button
                  onClick={() => setDelNome(nome)}
                  className="p-1.5 rounded-md text-muted hover:text-red hover:bg-red-soft cursor-pointer"
                  title="Remover"
                >
                  <Trash2 size={14} />
                </button>
              </li>
            ))
          ) : (
            <li className="py-4 text-center text-sm text-muted">Nenhum item.</li>
          )}
        </ul>
      </CardBody>
      <ConfirmDialog
        open={!!delNome}
        message={`Remover "${delNome}"?`}
        confirmLabel="Remover"
        onConfirm={remove}
        onCancel={() => setDelNome(null)}
      />
    </Card>
  );
}
