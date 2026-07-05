"use client";

import * as React from "react";
import { Input, Label } from "@/components/ui/field";
import { cn } from "@/lib/utils";
import {
  Check, ArrowRight, ArrowLeft, Building2, User, Sparkles, CheckCircle2, Send,
} from "lucide-react";

const VALOR = 150;
const fnUrl = () => `${process.env.NEXT_PUBLIC_SUPABASE_URL ?? ""}/functions/v1/assinar`;

const FEATURES = [
  "Acesso completo ao painel de gestão",
  "Pipeline comercial e operacional",
  "Indicadores e relatórios em tempo real",
  "Cobranças e assinaturas",
  "Usuários ilimitados",
  "Suporte prioritário",
];

type Etapa = "plano" | "form" | "enviado";
type Tipo = "empresa" | "pessoa";

export default function AssinarPage() {
  const [etapa, setEtapa] = React.useState<Etapa>("plano");
  const [tipo, setTipo] = React.useState<Tipo>("empresa");
  const [form, setForm] = React.useState({ nome: "", documento: "", responsavel: "", email: "", telefone: "" });
  const [enviando, setEnviando] = React.useState(false);
  const [erro, setErro] = React.useState("");

  const set = (p: Partial<typeof form>) => setForm((s) => ({ ...s, ...p }));

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setErro("");
    setEnviando(true);
    try {
      const r = await fetch(fnUrl(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tipo,
          empresa: form.nome,
          cnpj: form.documento,
          responsavel: tipo === "empresa" ? form.responsavel : null,
          email: form.email,
          telefone: form.telefone,
        }),
      });
      const data = await r.json();
      if (!r.ok) { setErro(data.error ?? "Não foi possível concluir. Tente novamente."); setEnviando(false); return; }
      if (data.checkout_url) { window.location.href = data.checkout_url; return; }
      setEtapa("enviado");
    } catch {
      setErro("Erro de conexão. Tente novamente.");
    }
    setEnviando(false);
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-4 bg-surface-2">
      {etapa === "plano" && (
        <div className="w-full max-w-sm">
          <div className="rounded-2xl border border-border bg-surface p-8 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-base font-semibold">Pro</span>
              <span className="inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-0.5 text-[11px] font-medium text-muted">
                <Sparkles size={11} /> Mais popular
              </span>
            </div>
            <p className="text-sm text-muted mt-1">Tudo que a sua operação precisa, em um só lugar.</p>

            <div className="mt-6 flex items-baseline gap-1.5">
              <span className="text-5xl font-bold tracking-tight">${VALOR}</span>
              <span className="text-muted">/mês</span>
            </div>

            <button
              onClick={() => setEtapa("form")}
              className="mt-6 w-full h-11 inline-flex items-center justify-center gap-2 rounded-lg bg-foreground text-background text-sm font-semibold hover:opacity-90 transition-opacity cursor-pointer"
            >
              Fazer Upgrade <ArrowRight size={16} />
            </button>

            <div className="mt-7 pt-6 border-t border-border">
              <p className="text-xs font-medium text-muted mb-3">Inclui</p>
              <ul className="space-y-2.5">
                {FEATURES.map((f) => (
                  <li key={f} className="flex items-center gap-2.5 text-sm">
                    <Check size={16} className="text-foreground shrink-0" /> {f}
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <p className="text-center text-[11px] text-muted mt-3">Cobrança recorrente mensal. Cancele quando quiser.</p>
        </div>
      )}

      {etapa === "form" && (
        <div className="w-full max-w-md rounded-2xl border border-border bg-surface shadow-sm">
          <div className="px-6 py-5 border-b border-border">
            <button onClick={() => setEtapa("plano")} className="inline-flex items-center gap-1 text-xs text-muted hover:text-foreground mb-2 cursor-pointer">
              <ArrowLeft size={13} /> Voltar
            </button>
            <h1 className="text-lg font-semibold">Finalizar assinatura</h1>
            <p className="text-sm text-muted mt-0.5">Plano Pro · <strong className="text-foreground">${VALOR}/mês</strong></p>
          </div>

          <form onSubmit={enviar} className="p-6 space-y-4">
            {/* Empresa x Pessoa */}
            <div className="grid grid-cols-2 gap-1 rounded-lg border border-border bg-surface-2 p-1">
              {([["empresa", Building2, "Empresa"], ["pessoa", User, "Pessoa física"]] as const).map(([val, Icon, label]) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => setTipo(val)}
                  className={cn(
                    "h-9 rounded-md text-sm font-medium inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer",
                    tipo === val ? "bg-surface shadow-sm text-foreground" : "text-muted hover:text-foreground",
                  )}
                >
                  <Icon size={15} /> {label}
                </button>
              ))}
            </div>

            <div>
              <Label>{tipo === "empresa" ? "Nome da empresa *" : "Nome completo *"}</Label>
              <Input value={form.nome} onChange={(e) => set({ nome: e.target.value })} required autoFocus
                placeholder={tipo === "empresa" ? "Razão social" : "Seu nome"} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>{tipo === "empresa" ? "CNPJ" : "CPF"}</Label>
                <Input value={form.documento} onChange={(e) => set({ documento: e.target.value })}
                  placeholder={tipo === "empresa" ? "00.000.000/0000-00" : "000.000.000-00"} />
              </div>
              <div>
                <Label>Telefone</Label>
                <Input value={form.telefone} onChange={(e) => set({ telefone: e.target.value })} placeholder="(11) 90000-0000" />
              </div>
            </div>

            {tipo === "empresa" && (
              <div>
                <Label>Responsável</Label>
                <Input value={form.responsavel} onChange={(e) => set({ responsavel: e.target.value })} placeholder="Nome do responsável" />
              </div>
            )}

            <div>
              <Label>E-mail *</Label>
              <Input type="email" value={form.email} onChange={(e) => set({ email: e.target.value })} required
                placeholder={tipo === "empresa" ? "contato@empresa.com" : "voce@email.com"} />
            </div>

            {erro && <p className="text-sm text-red">{erro}</p>}

            <button
              type="submit"
              disabled={enviando}
              className="w-full h-11 inline-flex items-center justify-center gap-2 rounded-lg bg-foreground text-background text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 cursor-pointer"
            >
              <Send size={15} /> {enviando ? "Processando..." : `Assinar por $${VALOR}/mês`}
            </button>
            <p className="text-[11px] text-muted text-center">Ao continuar, você concorda com a cobrança recorrente mensal.</p>
          </form>
        </div>
      )}

      {etapa === "enviado" && (
        <div className="w-full max-w-md rounded-2xl border border-border bg-surface p-10 text-center shadow-sm">
          <CheckCircle2 size={48} className="text-green mx-auto mb-4" />
          <h1 className="text-xl font-semibold">Assinatura recebida! 🎉</h1>
          <p className="text-sm text-muted mt-2">
            Enviamos um e-mail de confirmação para <strong className="text-foreground">{form.email}</strong>.
            Em seguida você recebe os dados de pagamento do plano de <strong className="text-foreground">${VALOR}/mês</strong>.
          </p>
        </div>
      )}
    </main>
  );
}
