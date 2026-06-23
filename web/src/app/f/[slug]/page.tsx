"use client";

import * as React from "react";
import { useParams } from "next/navigation";
import { Input, Select, Textarea, Label } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Send } from "lucide-react";

interface CampoDef {
  chave: string; label: string; tipo: string; opcoes: string[]; obrigatorio: boolean;
}

function fnUrl() {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  return `${base}/functions/v1/formulario-submit`;
}

export default function FormularioPublicoPage() {
  const { slug } = useParams<{ slug: string }>();
  const [estado, setEstado] = React.useState<"carregando" | "ok" | "erro" | "enviado">("carregando");
  const [titulo, setTitulo] = React.useState("");
  const [descricao, setDescricao] = React.useState<string | null>(null);
  const [campos, setCampos] = React.useState<CampoDef[]>([]);
  const [erroMsg, setErroMsg] = React.useState("");
  const [cardTitulo, setCardTitulo] = React.useState("");
  const [valores, setValores] = React.useState<Record<string, unknown>>({});
  const [enviando, setEnviando] = React.useState(false);

  React.useEffect(() => {
    (async () => {
      try {
        const r = await fetch(`${fnUrl()}?slug=${encodeURIComponent(slug)}`);
        const data = await r.json();
        if (!r.ok) { setErroMsg(data.error ?? "Formulário indisponível."); setEstado("erro"); return; }
        setTitulo(data.titulo); setDescricao(data.descricao ?? null); setCampos(data.campos ?? []);
        setEstado("ok");
      } catch {
        setErroMsg("Não foi possível carregar o formulário."); setEstado("erro");
      }
    })();
  }, [slug]);

  function setCampo(chave: string, v: unknown) { setValores((p) => ({ ...p, [chave]: v })); }

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setEnviando(true);
    try {
      const r = await fetch(fnUrl(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, titulo: cardTitulo, valores }),
      });
      const data = await r.json();
      if (!r.ok) { setErroMsg(data.error ?? "Erro ao enviar."); setEnviando(false); return; }
      setEstado("enviado");
    } catch {
      setErroMsg("Erro de conexão. Tente novamente.");
    }
    setEnviando(false);
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-4 bg-surface-2">
      <div className="w-full max-w-lg">
        {estado === "carregando" && <p className="text-center text-sm text-muted">Carregando...</p>}

        {estado === "erro" && (
          <div className="rounded-xl border border-border bg-surface p-8 text-center">
            <p className="text-sm text-foreground font-medium">{erroMsg}</p>
          </div>
        )}

        {estado === "enviado" && (
          <div className="rounded-xl border border-border bg-surface p-10 text-center">
            <CheckCircle2 size={44} className="text-green mx-auto mb-3" />
            <h1 className="text-lg font-semibold">Recebido!</h1>
            <p className="text-sm text-muted mt-1">Sua solicitação foi registrada. Obrigado.</p>
          </div>
        )}

        {estado === "ok" && (
          <div className="rounded-xl border border-border bg-surface shadow-sm">
            <div className="px-6 py-5 border-b border-border">
              <h1 className="text-lg font-semibold">{titulo}</h1>
              {descricao && <p className="text-sm text-muted mt-1">{descricao}</p>}
            </div>
            <form onSubmit={enviar} className="p-6 space-y-4">
              <div>
                <Label>Título / assunto *</Label>
                <Input value={cardTitulo} onChange={(e) => setCardTitulo(e.target.value)} required autoFocus />
              </div>
              {campos.map((c) => (
                <div key={c.chave}>
                  <Label>{c.label}{c.obrigatorio && " *"}</Label>
                  {c.tipo === "texto_longo" ? (
                    <Textarea required={c.obrigatorio} value={(valores[c.chave] as string) ?? ""} onChange={(e) => setCampo(c.chave, e.target.value)} />
                  ) : c.tipo === "selecao" ? (
                    <Select required={c.obrigatorio} value={(valores[c.chave] as string) ?? ""} onChange={(e) => setCampo(c.chave, e.target.value)}>
                      <option value="">—</option>
                      {c.opcoes.map((o) => <option key={o} value={o}>{o}</option>)}
                    </Select>
                  ) : c.tipo === "checkbox" ? (
                    <label className="inline-flex items-center gap-2 text-sm cursor-pointer">
                      <input type="checkbox" checked={!!valores[c.chave]} onChange={(e) => setCampo(c.chave, e.target.checked)} className="h-4 w-4" /> Sim
                    </label>
                  ) : (
                    <Input
                      type={c.tipo === "numero" || c.tipo === "moeda" ? "number" : c.tipo === "data" ? "date" : "text"}
                      step={c.tipo === "moeda" ? "0.01" : undefined}
                      required={c.obrigatorio}
                      value={(valores[c.chave] as string) ?? ""}
                      onChange={(e) => setCampo(c.chave, c.tipo === "numero" || c.tipo === "moeda" ? Number(e.target.value) : e.target.value)}
                    />
                  )}
                </div>
              ))}
              {erroMsg && <p className="text-sm text-red">{erroMsg}</p>}
              <Button type="submit" disabled={enviando} className="w-full"><Send size={15} /> {enviando ? "Enviando..." : "Enviar"}</Button>
            </form>
          </div>
        )}
      </div>
    </main>
  );
}
