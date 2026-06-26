"use client";

import * as React from "react";
import { createClient } from "@/lib/supabase/client";
import { useData } from "@/components/data-provider";
import { useToast } from "@/components/ui/toast";
import { Modal, ModalBody, ModalFooter } from "@/components/ui/modal";
import { Input, Select } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { CORES, DOT } from "@/lib/quadros";
import { cn } from "@/lib/utils";
import { Plus, Trash2, ChevronUp, ChevronDown, GripVertical } from "lucide-react";

type Linha = {
  id?: string;
  nome: string;
  cor: string;
  final: boolean;
  /** Nome original (quando carregado do banco) — usado para migrar cards no rename. */
  orig?: string;
};

/**
 * Editor das fases do Pipeline Comercial (tabela `chamado_fases`). Admin-only.
 * Permite adicionar, renomear, reordenar, mudar cor, marcar como final e remover.
 * Ao renomear, migra os cards (chamados.fase é texto) para o novo nome.
 * Bloqueia remover uma fase que ainda tem cards.
 */
export function ChamadoFasesConfig({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { chamadoFases, chamados, refresh } = useData();
  const toast = useToast();
  // O componente remonta a cada abertura (renderizado condicionalmente no pai),
  // então inicializa as linhas a partir das fases atuais já no mount.
  const [linhas, setLinhas] = React.useState<Linha[]>(() =>
    [...chamadoFases]
      .sort((a, b) => a.ordem - b.ordem)
      .map((f) => ({ id: f.id, nome: f.nome, cor: f.cor ?? "gray", final: f.final, orig: f.nome })),
  );
  const [saving, setSaving] = React.useState(false);

  // Quantos cards há em cada fase (impede remover fase com cards).
  const contagem = React.useMemo(() => {
    const m = new Map<string, number>();
    for (const c of chamados) m.set(c.fase, (m.get(c.fase) ?? 0) + 1);
    return m;
  }, [chamados]);

  function set(i: number, patch: Partial<Linha>) {
    setLinhas((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  }
  function mover(i: number, dir: -1 | 1) {
    setLinhas((prev) => {
      const j = i + dir;
      if (j < 0 || j >= prev.length) return prev;
      const arr = [...prev];
      [arr[i], arr[j]] = [arr[j], arr[i]];
      return arr;
    });
  }
  function adicionar() {
    setLinhas((prev) => [...prev, { nome: "", cor: "gray", final: false }]);
  }
  function remover(i: number) {
    const l = linhas[i];
    const n = l.orig ? contagem.get(l.orig) ?? 0 : 0;
    if (n > 0) {
      toast(`"${l.orig}" tem ${n} card(s). Mova-os para outra fase antes de remover.`, "error");
      return;
    }
    setLinhas((prev) => prev.filter((_, idx) => idx !== i));
  }

  async function salvar() {
    const nomes = linhas.map((l) => l.nome.trim());
    if (nomes.some((n) => !n)) { toast("Toda fase precisa de um nome.", "error"); return; }
    if (new Set(nomes.map((n) => n.toLowerCase())).size !== nomes.length) {
      toast("Há fases com nomes repetidos.", "error"); return;
    }
    setSaving(true);
    const supabase = createClient();

    // 1) Remoções: fases que existiam (orig) e saíram da lista.
    const idsAtuais = new Set(linhas.filter((l) => l.id).map((l) => l.id));
    const removidas = chamadoFases.filter((f) => !idsAtuais.has(f.id));
    for (const f of removidas) {
      const { error } = await supabase.from("chamado_fases").delete().eq("id", f.id);
      if (error) { setSaving(false); toast("Erro ao remover: " + error.message, "error"); return; }
    }

    // 2) Renomes: migra os cards (fase é texto) para o novo nome.
    for (const l of linhas) {
      if (l.id && l.orig && l.orig !== l.nome.trim()) {
        const { error } = await supabase.from("chamados").update({ fase: l.nome.trim() }).eq("fase", l.orig);
        if (error) { setSaving(false); toast("Erro ao migrar cards: " + error.message, "error"); return; }
      }
    }

    // 3) Upsert das fases na nova ordem.
    for (let i = 0; i < linhas.length; i++) {
      const l = linhas[i];
      const rec = { nome: l.nome.trim(), ordem: i + 1, cor: l.cor, final: l.final };
      const res = l.id
        ? await supabase.from("chamado_fases").update(rec).eq("id", l.id)
        : await supabase.from("chamado_fases").insert([rec]);
      if (res.error) { setSaving(false); toast("Erro ao salvar: " + res.error.message, "error"); return; }
    }

    setSaving(false);
    await refresh();
    toast("Fases atualizadas.");
    onClose();
  }

  return (
    <Modal open={open} onClose={onClose} title="Configurar fases do Pipeline Comercial" className="max-w-2xl">
      <ModalBody>
        <p className="text-xs text-muted mb-3">
          Reordene com as setas, mude a cor, marque a fase de fechamento como <strong>final</strong>.
          Renomear move os cards automaticamente. Não dá para remover uma fase que ainda tem cards.
        </p>
        <div className="space-y-2">
          {linhas.map((l, i) => {
            const n = l.orig ? contagem.get(l.orig) ?? 0 : 0;
            return (
              <div key={l.id ?? `novo-${i}`} className="flex items-center gap-2 rounded-lg border border-border bg-surface-2/40 p-2">
                <GripVertical size={14} className="text-muted shrink-0" />
                <div className="flex flex-col gap-0.5 shrink-0">
                  <button type="button" onClick={() => mover(i, -1)} disabled={i === 0} className="text-muted hover:text-foreground disabled:opacity-30 cursor-pointer"><ChevronUp size={14} /></button>
                  <button type="button" onClick={() => mover(i, 1)} disabled={i === linhas.length - 1} className="text-muted hover:text-foreground disabled:opacity-30 cursor-pointer"><ChevronDown size={14} /></button>
                </div>
                <Select value={l.cor} onChange={(e) => set(i, { cor: e.target.value })} className="w-28 shrink-0">
                  {CORES.map((c) => <option key={c} value={c}>{c}</option>)}
                </Select>
                <span className={cn("h-3 w-3 rounded-full shrink-0", DOT[l.cor] ?? "bg-muted")} />
                <Input value={l.nome} onChange={(e) => set(i, { nome: e.target.value })} placeholder="Nome da fase" className="flex-1" />
                <span className="text-[11px] text-muted tabular-nums w-14 text-right shrink-0">{n > 0 ? `${n} card` : ""}</span>
                <label className="inline-flex items-center gap-1 text-[11px] text-muted cursor-pointer shrink-0">
                  <input type="checkbox" checked={l.final} onChange={(e) => set(i, { final: e.target.checked })} className="h-3.5 w-3.5 rounded border-border" />
                  final
                </label>
                <button type="button" onClick={() => remover(i)} className="text-muted hover:text-red cursor-pointer shrink-0"><Trash2 size={14} /></button>
              </div>
            );
          })}
        </div>
        <Button type="button" variant="secondary" size="sm" onClick={adicionar} className="mt-3"><Plus size={14} /> Adicionar fase</Button>
      </ModalBody>
      <ModalFooter>
        <Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
        <Button type="button" onClick={salvar} disabled={saving}>{saving ? "Salvando..." : "Salvar fases"}</Button>
      </ModalFooter>
    </Modal>
  );
}
