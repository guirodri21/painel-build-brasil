"use client";

import * as React from "react";
import { createClient } from "@/lib/supabase/client";
import { useData } from "@/components/data-provider";
import { useToast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { PenLine, Eraser } from "lucide-react";

const BUCKET = "ordens-anexos";

/** Coleta a assinatura do cliente num canvas e salva como anexo (tipo assinatura). */
export function AssinaturaPad({
  ordemId,
  filial,
  onSaved,
}: {
  ordemId: string;
  filial: string | null;
  onSaved?: () => void;
}) {
  const { userId } = useData();
  const toast = useToast();
  const supabase = React.useMemo(() => createClient(), []);
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const [aberto, setAberto] = React.useState(false);
  const [desenhou, setDesenhou] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const drawing = React.useRef(false);

  function pos(e: React.PointerEvent<HTMLCanvasElement>) {
    const c = canvasRef.current!;
    const r = c.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * c.width, y: ((e.clientY - r.top) / r.height) * c.height };
  }
  function start(e: React.PointerEvent<HTMLCanvasElement>) {
    drawing.current = true;
    const ctx = canvasRef.current!.getContext("2d")!;
    const p = pos(e);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    canvasRef.current!.setPointerCapture(e.pointerId);
  }
  function move(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current) return;
    const ctx = canvasRef.current!.getContext("2d")!;
    ctx.lineWidth = 2.2;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#0f172a";
    const p = pos(e);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    setDesenhou(true);
  }
  function end() { drawing.current = false; }

  function limpar() {
    const c = canvasRef.current;
    if (!c) return;
    c.getContext("2d")!.clearRect(0, 0, c.width, c.height);
    setDesenhou(false);
  }

  async function salvar() {
    const c = canvasRef.current;
    if (!c || !desenhou) { toast("Assine antes de salvar.", "error"); return; }
    setBusy(true);
    const blob: Blob | null = await new Promise((res) => c.toBlob(res, "image/png"));
    if (!blob) { setBusy(false); toast("Falha ao gerar imagem.", "error"); return; }
    const path = `${ordemId}/assinatura-${crypto.randomUUID()}.png`;
    const up = await supabase.storage.from(BUCKET).upload(path, blob, { contentType: "image/png" });
    if (up.error) { setBusy(false); toast("Erro: " + up.error.message, "error"); return; }
    const { error } = await supabase.from("ordem_anexos").insert([
      { ordem_id: ordemId, path, tipo: "assinatura", legenda: "Assinatura do cliente", filial: filial || "Matriz", created_by: userId },
    ]);
    setBusy(false);
    if (error) { toast("Erro: " + error.message, "error"); return; }
    limpar();
    setAberto(false);
    toast("Assinatura salva.");
    onSaved?.();
  }

  if (!aberto) {
    return (
      <Button type="button" variant="secondary" size="sm" onClick={() => setAberto(true)}>
        <PenLine size={15} /> Coletar assinatura
      </Button>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-surface-2/40 p-3 space-y-2">
      <p className="text-xs font-semibold flex items-center gap-2"><PenLine size={14} className="text-muted" /> Assinatura do cliente</p>
      <canvas
        ref={canvasRef}
        width={500}
        height={180}
        onPointerDown={start}
        onPointerMove={move}
        onPointerUp={end}
        onPointerLeave={end}
        className="w-full h-[140px] rounded-lg border border-border bg-white touch-none cursor-crosshair"
      />
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={limpar}><Eraser size={14} /> Limpar</Button>
        <Button type="button" variant="secondary" size="sm" onClick={() => setAberto(false)}>Fechar</Button>
        <Button type="button" size="sm" onClick={salvar} disabled={busy}>{busy ? "Salvando..." : "Salvar assinatura"}</Button>
      </div>
    </div>
  );
}
