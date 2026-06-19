"use client";

import * as React from "react";
import { createClient } from "@/lib/supabase/client";
import { useData } from "@/components/data-provider";
import { useToast } from "@/components/ui/toast";
import { Select } from "@/components/ui/field";
import { Badge } from "@/components/ui/badge";
import { ANEXO_TIPO_LABELS } from "@/lib/types";
import type { OrdemAnexo, AnexoTipo } from "@/lib/types";
import { Paperclip, Upload, Trash2, FileText } from "lucide-react";

const BUCKET = "ordens-anexos";

export function OrdemAnexos({ ordemId, filial }: { ordemId: string; filial: string | null }) {
  const { userId } = useData();
  const toast = useToast();
  const supabase = React.useMemo(() => createClient(), []);
  const [anexos, setAnexos] = React.useState<OrdemAnexo[]>([]);
  const [urls, setUrls] = React.useState<Record<string, string>>({});
  const [tipo, setTipo] = React.useState<AnexoTipo>("foto");
  const [busy, setBusy] = React.useState(false);

  const carregar = React.useCallback(async () => {
    const { data } = await supabase
      .from("ordem_anexos")
      .select("*")
      .eq("ordem_id", ordemId)
      .order("created_at");
    const rows = (data as OrdemAnexo[]) ?? [];
    setAnexos(rows);
    if (rows.length) {
      const { data: signed } = await supabase.storage
        .from(BUCKET)
        .createSignedUrls(rows.map((r) => r.path), 3600);
      const map: Record<string, string> = {};
      (signed ?? []).forEach((s, i) => { if (s.signedUrl) map[rows[i].path] = s.signedUrl; });
      setUrls(map);
    }
  }, [supabase, ordemId]);

  React.useEffect(() => { carregar(); }, [carregar]);

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setBusy(true);
    const ext = file.name.split(".").pop() || "bin";
    const path = `${ordemId}/${crypto.randomUUID()}.${ext}`;
    const up = await supabase.storage.from(BUCKET).upload(path, file, { upsert: false });
    if (up.error) { setBusy(false); toast("Erro no upload: " + up.error.message, "error"); return; }
    const { error } = await supabase.from("ordem_anexos").insert([
      { ordem_id: ordemId, path, tipo, legenda: file.name, filial: filial || "Matriz", created_by: userId },
    ]);
    setBusy(false);
    if (error) { toast("Erro: " + error.message, "error"); return; }
    await carregar();
    toast("Anexo enviado.");
  }

  async function remover(a: OrdemAnexo) {
    await supabase.storage.from(BUCKET).remove([a.path]);
    const { error } = await supabase.from("ordem_anexos").delete().eq("id", a.id);
    if (error) { toast("Erro: " + error.message, "error"); return; }
    await carregar();
    toast("Anexo removido.");
  }

  const isImg = (p: string) => /\.(png|jpe?g|webp|gif|heic)$/i.test(p);

  return (
    <div className="rounded-lg border border-border bg-surface-2/40 p-3">
      <div className="flex items-center gap-2 mb-2 text-sm font-semibold">
        <Paperclip size={15} className="text-muted" /> Anexos / fotos
      </div>

      {anexos.length ? (
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 mb-3">
          {anexos.map((a) => (
            <div key={a.id} className="relative group rounded-lg border border-border overflow-hidden bg-surface">
              {isImg(a.path) && urls[a.path] ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={urls[a.path]} alt={a.legenda ?? ""} className="h-20 w-full object-cover" />
              ) : (
                <a href={urls[a.path]} target="_blank" rel="noopener noreferrer" className="h-20 w-full flex items-center justify-center text-muted">
                  <FileText size={22} />
                </a>
              )}
              <span className="absolute top-1 left-1"><Badge tone="blue">{ANEXO_TIPO_LABELS[a.tipo]}</Badge></span>
              <button type="button" onClick={() => remover(a)} title="Remover"
                className="absolute top-1 right-1 p-1 rounded bg-black/50 text-white opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                <Trash2 size={12} />
              </button>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-muted mb-3">Nenhum anexo.</p>
      )}

      <div className="flex items-center gap-2">
        <Select value={tipo} onChange={(e) => setTipo(e.target.value as AnexoTipo)} className="w-32">
          <option value="foto">Foto</option>
          <option value="antes">Antes</option>
          <option value="depois">Depois</option>
          <option value="doc">Documento</option>
        </Select>
        <label className="inline-flex items-center gap-2 h-9 px-3 rounded-lg border border-border text-sm cursor-pointer hover:bg-surface-2 transition-colors">
          <Upload size={15} /> {busy ? "Enviando..." : "Enviar arquivo"}
          <input type="file" accept="image/*,application/pdf" className="hidden" onChange={onPick} disabled={busy} />
        </label>
      </div>
    </div>
  );
}
