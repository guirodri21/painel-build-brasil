"use client";

import * as React from "react";
import { Input, Label } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Send, Check } from "lucide-react";

const VALOR_USD = 150;

function fnUrl() {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  return `${base}/functions/v1/assinar`;
}

const BENEFICIOS = [
  "Acesso completo ao painel de gestão",
  "Pipeline comercial e operacional",
  "Relatórios e indicadores em tempo real",
  "Suporte e atualizações contínuas",
];

export default function AssinarPage() {
  const [form, setForm] = React.useState({ empresa: "", cnpj: "", responsavel: "", email: "", telefone: "" });
  const [enviando, setEnviando] = React.useState(false);
  const [enviado, setEnviado] = React.useState(false);
  const [erro, setErro] = React.useState("");

  const set = (patch: Partial<typeof form>) => setForm((s) => ({ ...s, ...patch }));

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setErro("");
    setEnviando(true);
    try {
      const r = await fetch(fnUrl(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await r.json();
      if (!r.ok) { setErro(data.error ?? "Não foi possível concluir. Tente novamente."); setEnviando(false); return; }
      setEnviado(true);
    } catch {
      setErro("Erro de conexão. Tente novamente.");
    }
    setEnviando(false);
  }

  if (enviado)
    return (
      <main className="min-h-screen flex items-center justify-center p-4 bg-surface-2">
        <div className="w-full max-w-md rounded-2xl border border-border bg-surface p-10 text-center shadow-sm">
          <CheckCircle2 size={48} className="text-green mx-auto mb-4" />
          <h1 className="text-xl font-semibold">Assinatura recebida! 🎉</h1>
          <p className="text-sm text-muted mt-2">
            Enviamos um e-mail de confirmação para <strong className="text-foreground">{form.email}</strong>.
            Em seguida você recebe os dados de pagamento do plano de <strong className="text-foreground">US$ {VALOR_USD}/mês</strong>.
          </p>
        </div>
      </main>
    );

  return (
    <main className="min-h-screen flex items-center justify-center p-4 bg-surface-2">
      <div className="w-full max-w-4xl grid gap-5 md:grid-cols-2">
        {/* Plano */}
        <div className="rounded-2xl border border-border bg-surface p-8 shadow-sm flex flex-col">
          <span className="inline-flex w-fit items-center rounded-full bg-primary-soft text-primary text-xs font-semibold px-3 py-1">
            Plano Mensal
          </span>
          <div className="mt-4 flex items-end gap-1">
            <span className="text-4xl font-bold tracking-tight">US$ {VALOR_USD}</span>
            <span className="text-muted mb-1">/mês</span>
          </div>
          <p className="text-sm text-muted mt-2">Cobrança recorrente mensal. Cancele quando quiser.</p>
          <ul className="mt-6 space-y-2.5">
            {BENEFICIOS.map((b) => (
              <li key={b} className="flex items-start gap-2 text-sm">
                <Check size={16} className="text-green shrink-0 mt-0.5" /> {b}
              </li>
            ))}
          </ul>
        </div>

        {/* Formulário */}
        <div className="rounded-2xl border border-border bg-surface shadow-sm">
          <div className="px-6 py-5 border-b border-border">
            <h1 className="text-lg font-semibold">Dados da empresa</h1>
            <p className="text-sm text-muted mt-1">Preencha para receber a confirmação por e-mail.</p>
          </div>
          <form onSubmit={enviar} className="p-6 space-y-4">
            <div>
              <Label>Empresa *</Label>
              <Input value={form.empresa} onChange={(e) => set({ empresa: e.target.value })} required autoFocus placeholder="Razão social / nome" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>CNPJ</Label>
                <Input value={form.cnpj} onChange={(e) => set({ cnpj: e.target.value })} placeholder="00.000.000/0000-00" />
              </div>
              <div>
                <Label>Telefone</Label>
                <Input value={form.telefone} onChange={(e) => set({ telefone: e.target.value })} placeholder="(11) 90000-0000" />
              </div>
            </div>
            <div>
              <Label>Responsável</Label>
              <Input value={form.responsavel} onChange={(e) => set({ responsavel: e.target.value })} placeholder="Nome do responsável" />
            </div>
            <div>
              <Label>E-mail *</Label>
              <Input type="email" value={form.email} onChange={(e) => set({ email: e.target.value })} required placeholder="contato@empresa.com" />
            </div>
            {erro && <p className="text-sm text-red">{erro}</p>}
            <Button type="submit" disabled={enviando} className="w-full">
              <Send size={15} /> {enviando ? "Enviando..." : `Assinar por US$ ${VALOR_USD}/mês`}
            </Button>
            <p className="text-[11px] text-muted text-center">
              Ao assinar, você concorda com a cobrança recorrente mensal.
            </p>
          </form>
        </div>
      </div>
    </main>
  );
}
