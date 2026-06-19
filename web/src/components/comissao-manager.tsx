"use client";

import * as React from "react";
import { createClient } from "@/lib/supabase/client";
import { useData } from "@/components/data-provider";
import { useToast } from "@/components/ui/toast";
import { Card, CardHeader, CardTitle, CardBody } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import type { ComissaoRegra } from "@/lib/types";
import { Plus, Trash2 } from "lucide-react";

export function ComissaoManager() {
  const { equipes, filial } = useData();
  const toast = useToast();
  const supabase = React.useMemo(() => createClient(), []);
  const [regras, setRegras] = React.useState<ComissaoRegra[]>([]);
  const [equipe, setEquipe] = React.useState("");
  const [base, setBase] = React.useState<"receita" | "margem">("receita");
  const [pct, setPct] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  const carregar = React.useCallback(async () => {
    const { data } = await supabase.from("comissao_regras").select("*").order("equipe");
    setRegras((data as ComissaoRegra[]) ?? []);
  }, [supabase]);
  React.useEffect(() => { carregar(); }, [carregar]);

  async function adicionar(e: React.FormEvent) {
    e.preventDefault();
    const percentual = parseFloat(pct);
    if (!equipe || isNaN(percentual)) { toast("Escolha equipe e percentual.", "error"); return; }
    setBusy(true);
    const { error } = await supabase.from("comissao_regras")
      .upsert([{ equipe, base, percentual, filial: filial || "Matriz" }], { onConflict: "filial,equipe" });
    setBusy(false);
    if (error) { toast("Erro: " + error.message, "error"); return; }
    setPct("");
    await carregar();
    toast("Regra salva.");
  }

  async function remover(id: string) {
    const { error } = await supabase.from("comissao_regras").delete().eq("id", id);
    if (error) { toast("Erro: " + error.message, "error"); return; }
    await carregar();
  }

  return (
    <Card>
      <CardHeader><CardTitle>Regras de Comissão</CardTitle></CardHeader>
      <CardBody className="space-y-3">
        <form onSubmit={adicionar} className="flex flex-wrap gap-2 items-end">
          <div className="w-40">
            <Select value={equipe} onChange={(e) => setEquipe(e.target.value)}>
              <option value="">Equipe</option>
              {equipes.map((eq) => <option key={eq} value={eq}>{eq}</option>)}
            </Select>
          </div>
          <div className="w-32">
            <Select value={base} onChange={(e) => setBase(e.target.value as "receita" | "margem")}>
              <option value="receita">sobre Receita</option>
              <option value="margem">sobre Margem</option>
            </Select>
          </div>
          <div className="w-24">
            <Input type="number" step="0.1" min="0" placeholder="%" value={pct} onChange={(e) => setPct(e.target.value)} />
          </div>
          <Button type="submit" size="icon" disabled={busy} aria-label="Salvar regra"><Plus size={16} /></Button>
        </form>
        <ul className="divide-y divide-border">
          {regras.length ? regras.map((r) => (
            <li key={r.id} className="flex items-center justify-between py-2 text-sm">
              <span><strong>{r.equipe}</strong> — {r.percentual}% sobre {r.base === "receita" ? "receita" : "margem"}</span>
              <button onClick={() => remover(r.id)} className="p-1 rounded text-muted hover:text-red hover:bg-red-soft cursor-pointer" title="Remover"><Trash2 size={13} /></button>
            </li>
          )) : <li className="py-3 text-center text-sm text-muted">Nenhuma regra.</li>}
        </ul>
      </CardBody>
    </Card>
  );
}
