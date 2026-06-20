"use client";

import * as React from "react";
import { createClient } from "@/lib/supabase/client";
import { useData } from "@/components/data-provider";
import { useToast } from "@/components/ui/toast";
import { Textarea } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/utils";
import { MessageSquare, Paperclip, Send, Trash2, Upload, FileText } from "lucide-react";

const BUCKET = "ordens-anexos";

type Coment = { id: string; texto: string; autor_nome: string | null; created_by: string | null; created_at: string };
type Anexo = { id: string; path: string; legenda: string | null; created_by: string | null; created_at: string };

export function ChamadoAtividade({ chamadoId }: { chamadoId: string }) {
  const { userId } = useData();
  const toast = useToast();
  const supabase = React.useMemo(() => createClient(), []);
  const [coments, setComents] = React.useState<Coment[]>([]);
  const [anexos, setAnexos] = React.useState<Anexo[]>([]);
  const [urls, setUrls] = React.useState<Record<string, string>>({});
  const [texto, setTexto] = React.useState("");
  const [email, setEmail] = React.useState<string>("");
  const [busy, setBusy] = React.useState(false);

  const carregar = React.useCallback(async () => {
    const [c, a] = await Promise.all([
      supabase.from("chamado_comentarios").select("*").eq("chamado_id", chamadoId).order("created_at"),
      supabase.from("chamado_anexos").select("*").eq("chamado_id", chamadoId).order("created_at"),
    ]);
    setComents((c.data as Coment[]) ?? []);
    const rows = (a.data as Anexo[]) ?? [];
    setAnexos(rows);
    if (rows.length) {
      const { data } = await supabase.storage.from(BUCKET).createSignedUrls(rows.map((r) => r.path), 3600);
      const m: Record<string, string> = {};
      (data ?? []).forEach((s, i) => { if (s.signedUrl) m[rows[i].path] = s.signedUrl; });
      setUrls(m);
    }
  }, [supabase, chamadoId]);

  React.useEffect(() => {
    carregar();
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? ""));
  }, [carregar, supabase]);

  async function comentar() {
    if (!texto.trim()) return;
    setBusy(true);
    const { error } = await supabase.from("chamado_comentarios").insert([
      { chamado_id: chamadoId, texto: texto.trim(), autor_nome: email || null, created_by: userId },
    ]);
    setBusy(false);
    if (error) { toast("Erro: " + error.message, "error"); return; }
    setTexto("");
    carregar();
  }

  async function delComent(id: string) {
    await supabase.from("chamado_comentarios").delete().eq("id", id);
    carregar();
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setBusy(true);
    const ext = file.name.split(".").pop() || "bin";
    const path = `chamados/${chamadoId}/${crypto.randomUUID()}.${ext}`;
    const up = await supabase.storage.from(BUCKET).upload(path, file);
    if (up.error) { setBusy(false); toast("Erro no upload: " + up.error.message, "error"); return; }
    const { error } = await supabase.from("chamado_anexos").insert([{ chamado_id: chamadoId, path, legenda: file.name, created_by: userId }]);
    setBusy(false);
    if (error) { toast("Erro: " + error.message, "error"); return; }
    carregar();
    toast("Anexo enviado.");
  }

  async function delAnexo(a: Anexo) {
    await supabase.storage.from(BUCKET).remove([a.path]);
    await supabase.from("chamado_anexos").delete().eq("id", a.id);
    carregar();
  }

  const isImg = (p: string) => /\.(png|jpe?g|webp|gif|heic)$/i.test(p);

  return (
    <div className="rounded-lg border border-border bg-surface-2/40 p-3 space-y-3">
      <div className="flex items-center gap-2 text-sm font-semibold">
        <MessageSquare size={15} className="text-muted" /> Atividade
      </div>

      {/* Comentários */}
      <div className="space-y-2 max-h-48 overflow-y-auto">
        {coments.length ? coments.map((c) => (
          <div key={c.id} className="rounded-lg bg-surface border border-border px-3 py-2 text-sm group">
            <div className="flex items-center justify-between gap-2 text-[11px] text-muted mb-0.5">
              <span className="font-medium">{c.autor_nome ?? "—"}</span>
              <span className="flex items-center gap-2">
                {formatDate(c.created_at.split("T")[0])}
                {c.created_by === userId && (
                  <button onClick={() => delComent(c.id)} className="opacity-0 group-hover:opacity-100 hover:text-red cursor-pointer"><Trash2 size={11} /></button>
                )}
              </span>
            </div>
            <p className="whitespace-pre-wrap">{c.texto}</p>
          </div>
        )) : <p className="text-xs text-muted">Sem comentários ainda.</p>}
      </div>

      <div className="flex gap-2 items-end">
        <Textarea value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Escrever um comentário..." className="min-h-[40px]" />
        <Button type="button" size="icon" onClick={comentar} disabled={busy || !texto.trim()} aria-label="Comentar"><Send size={15} /></Button>
      </div>

      {/* Anexos */}
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-xs font-medium text-muted"><Paperclip size={13} /> Anexos</span>
        <label className="inline-flex items-center gap-1.5 text-xs cursor-pointer text-primary hover:underline">
          <Upload size={13} /> {busy ? "..." : "Enviar"}
          <input type="file" accept="image/*,application/pdf" className="hidden" onChange={onFile} disabled={busy} />
        </label>
      </div>
      {anexos.length > 0 && (
        <div className="grid grid-cols-4 gap-2">
          {anexos.map((a) => (
            <div key={a.id} className="relative group rounded-lg border border-border overflow-hidden bg-surface">
              {isImg(a.path) && urls[a.path] ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={urls[a.path]} alt="" className="h-16 w-full object-cover" />
              ) : (
                <a href={urls[a.path]} target="_blank" rel="noopener noreferrer" className="h-16 w-full flex items-center justify-center text-muted"><FileText size={20} /></a>
              )}
              <button onClick={() => delAnexo(a)} className="absolute top-1 right-1 p-1 rounded bg-black/50 text-white opacity-0 group-hover:opacity-100 cursor-pointer"><Trash2 size={11} /></button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
