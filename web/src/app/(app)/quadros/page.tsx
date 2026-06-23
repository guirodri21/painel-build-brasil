"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useData } from "@/components/data-provider";
import { useToast } from "@/components/ui/toast";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Modal, ModalBody, ModalFooter } from "@/components/ui/modal";
import { Input, Textarea, Label, Select } from "@/components/ui/field";
import { Skeleton } from "@/components/ui/skeleton";
import { DOT, CORES } from "@/lib/quadros";
import { cn } from "@/lib/utils";
import type { Quadro } from "@/lib/types";
import { KanbanSquare, Plus, ChevronRight } from "lucide-react";

/** Fases padrão criadas junto com um quadro novo. */
const FASES_PADRAO = [
  { nome: "A fazer", cor: "gray", final: false },
  { nome: "Em andamento", cor: "blue", final: false },
  { nome: "Concluído", cor: "green", final: true },
];

export default function QuadrosPage() {
  const { isAdmin, userId, filial } = useData();
  const toast = useToast();
  const router = useRouter();
  const [quadros, setQuadros] = React.useState<Quadro[]>([]);
  const [counts, setCounts] = React.useState<Record<string, number>>({});
  const [loading, setLoading] = React.useState(true);
  const [novo, setNovo] = React.useState(false);
  const [salvando, setSalvando] = React.useState(false);

  const carregar = React.useCallback(async () => {
    const supabase = createClient();
    const [{ data: qs }, { data: cards }] = await Promise.all([
      supabase.from("quadros").select("*").eq("ativo", true).order("ordem").order("created_at"),
      supabase.from("quadro_cards").select("quadro_id"),
    ]);
    setQuadros((qs as Quadro[]) ?? []);
    const c: Record<string, number> = {};
    for (const row of (cards as { quadro_id: string }[]) ?? []) c[row.quadro_id] = (c[row.quadro_id] ?? 0) + 1;
    setCounts(c);
    setLoading(false);
  }, []);

  React.useEffect(() => { carregar(); }, [carregar]);

  async function criar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSalvando(true);
    const fd = new FormData(e.currentTarget);
    const supabase = createClient();
    const { data, error } = await supabase.from("quadros").insert([{
      nome: (fd.get("nome") as string).trim(),
      descricao: (fd.get("descricao") as string)?.trim() || null,
      cor: (fd.get("cor") as string) || "blue",
      filial: filial || "Matriz",
      created_by: userId,
    }]).select("id").single();

    if (error || !data) { setSalvando(false); toast("Erro: " + (error?.message ?? ""), "error"); return; }

    await supabase.from("quadro_fases").insert(
      FASES_PADRAO.map((f, i) => ({ quadro_id: data.id, nome: f.nome, ordem: i + 1, cor: f.cor, final: f.final })),
    );
    setSalvando(false);
    setNovo(false);
    toast("Quadro criado.");
    router.push(`/quadros/${data.id}`);
  }

  return (
    <>
      <PageHeader title="Quadros" subtitle="Funis e processos configuráveis — no estilo Goalfy">
        {isAdmin && <Button onClick={() => setNovo(true)}><Plus size={16} /> Novo quadro</Button>}
      </PageHeader>

      {loading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-28" />)}
        </div>
      ) : quadros.length === 0 ? (
        <div className="rounded-xl border border-border bg-surface p-10 text-center">
          <KanbanSquare size={36} className="text-muted mx-auto mb-3" />
          <p className="text-sm text-muted">
            Nenhum quadro ainda. {isAdmin ? "Crie o primeiro quadro para montar um funil." : "Peça a um administrador para criar um quadro."}
          </p>
        </div>
      ) : (
        <div className="stagger grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {quadros.map((q) => (
            <Link key={q.id} href={`/quadros/${q.id}`}>
              <Card className="p-4 h-full hover:border-border-strong transition-colors group cursor-pointer">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className={cn("h-9 w-9 rounded-lg grid place-items-center shrink-0", DOT[q.cor ?? "blue"], "bg-opacity-15")}>
                      <KanbanSquare size={18} className="text-foreground" />
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold truncate">{q.nome}</p>
                      <p className="text-xs text-muted">{counts[q.id] ?? 0} cards</p>
                    </div>
                  </div>
                  <ChevronRight size={16} className="text-muted group-hover:text-foreground transition-colors shrink-0" />
                </div>
                {q.descricao && <p className="text-xs text-muted mt-2.5 line-clamp-2">{q.descricao}</p>}
              </Card>
            </Link>
          ))}
        </div>
      )}

      {novo && (
        <Modal open={novo} onClose={() => setNovo(false)} title="Novo quadro">
          <form onSubmit={criar}>
            <ModalBody>
              <div>
                <Label>Nome *</Label>
                <Input name="nome" required placeholder="Ex.: Funil de Vendas, Onboarding, RH..." autoFocus />
              </div>
              <div>
                <Label>Cor</Label>
                <Select name="cor" defaultValue="blue">
                  {CORES.map((c) => <option key={c} value={c}>{c}</option>)}
                </Select>
              </div>
              <div>
                <Label>Descrição</Label>
                <Textarea name="descricao" placeholder="Para que serve este quadro?" />
              </div>
              <p className="text-[11px] text-muted">
                Criado com 3 fases padrão (A fazer · Em andamento · Concluído). Você ajusta tudo depois na aba <strong>Configurar</strong>.
              </p>
            </ModalBody>
            <ModalFooter>
              <Button type="button" variant="secondary" onClick={() => setNovo(false)}>Cancelar</Button>
              <Button type="submit" disabled={salvando}>{salvando ? "Criando..." : "Criar quadro"}</Button>
            </ModalFooter>
          </form>
        </Modal>
      )}
    </>
  );
}
