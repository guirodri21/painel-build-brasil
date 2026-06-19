"use client";

import * as React from "react";
import { createClient } from "@/lib/supabase/client";
import { useData } from "@/components/data-provider";
import { useToast } from "@/components/ui/toast";
import type { ChecklistTemplate, OrdemChecklistItem } from "@/lib/types";
import { ListChecks } from "lucide-react";

/** Checklist da ordem, baseado no template da linha de serviço. */
export function OrdemChecklist({
  ordemId,
  linhaServico,
  filial,
}: {
  ordemId: string;
  linhaServico: string;
  filial: string | null;
}) {
  const { userId } = useData();
  const toast = useToast();
  const supabase = React.useMemo(() => createClient(), []);
  const [tpl, setTpl] = React.useState<ChecklistTemplate[]>([]);
  const [itens, setItens] = React.useState<OrdemChecklistItem[]>([]);
  const [loading, setLoading] = React.useState(true);

  const carregar = React.useCallback(async () => {
    const [t, c] = await Promise.all([
      supabase.from("checklist_templates").select("*").eq("linha_servico", linhaServico).order("ordem_exibicao"),
      supabase.from("ordem_checklist").select("*").eq("ordem_id", ordemId),
    ]);
    setTpl((t.data as ChecklistTemplate[]) ?? []);
    setItens((c.data as OrdemChecklistItem[]) ?? []);
    setLoading(false);
  }, [supabase, linhaServico, ordemId]);

  React.useEffect(() => { carregar(); }, [carregar]);

  const estado = React.useMemo(() => new Map(itens.map((i) => [i.item, i])), [itens]);

  async function toggle(item: string, feito: boolean) {
    const existente = estado.get(item);
    if (existente) {
      await supabase.from("ordem_checklist").update({ feito }).eq("id", existente.id);
    } else {
      await supabase.from("ordem_checklist").insert([
        { ordem_id: ordemId, item, feito, filial: filial || "Matriz", created_by: userId },
      ]);
    }
    await carregar();
  }

  if (loading || !tpl.length) return null;

  const feitos = tpl.filter((t) => estado.get(t.item)?.feito).length;

  return (
    <div className="rounded-lg border border-border bg-surface-2/40 p-3">
      <div className="flex items-center justify-between mb-2 text-sm font-semibold">
        <span className="flex items-center gap-2"><ListChecks size={15} className="text-muted" /> Checklist</span>
        <span className="text-xs text-muted tabular-nums">{feitos}/{tpl.length}</span>
      </div>
      <ul className="space-y-1.5">
        {tpl.map((t) => {
          const it = estado.get(t.item);
          return (
            <li key={t.id}>
              <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
                <input type="checkbox" checked={!!it?.feito}
                  onChange={(e) => toggle(t.item, e.target.checked)}
                  className="h-4 w-4 rounded border-border accent-[var(--primary)]" />
                <span className={it?.feito ? "line-through text-muted" : ""}>{t.item}</span>
              </label>
            </li>
          );
        })}
      </ul>
      {feitos === tpl.length && <p className="text-xs text-green mt-2">✓ Checklist completo.</p>}
    </div>
  );
}
