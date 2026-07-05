"use client";

import * as React from "react";
import { CheckCircle2, Mail, CalendarClock } from "lucide-react";

const VALOR_USD = 150;

export default function AssinaturaConfirmadaPage() {
  return (
    <main className="min-h-screen flex items-center justify-center p-4 bg-surface-2">
      <div className="w-full max-w-md rounded-2xl border border-border bg-surface p-10 text-center shadow-sm">
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-green-soft">
          <CheckCircle2 size={40} className="text-green" />
        </div>

        <h1 className="text-2xl font-bold tracking-tight">Deu tudo certo! 🎉</h1>
        <p className="text-sm text-muted mt-2">
          Sua assinatura do <strong className="text-foreground">plano mensal de US$ {VALOR_USD}/mês</strong> foi
          confirmada com sucesso. Seja bem-vindo(a)!
        </p>

        <div className="mt-6 space-y-3 text-left">
          <div className="flex items-start gap-3 rounded-lg border border-border bg-surface-2 px-4 py-3">
            <CalendarClock size={18} className="text-primary shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium">Cobrança recorrente ativa</p>
              <p className="text-xs text-muted">A renovação acontece automaticamente todo mês.</p>
            </div>
          </div>
          <div className="flex items-start gap-3 rounded-lg border border-border bg-surface-2 px-4 py-3">
            <Mail size={18} className="text-primary shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium">Confirmação por e-mail</p>
              <p className="text-xs text-muted">Enviamos os detalhes da sua assinatura para o seu e-mail.</p>
            </div>
          </div>
        </div>

        <p className="mt-6 text-xs text-muted">
          Qualquer dúvida, é só responder o e-mail de confirmação. Obrigado pela confiança! 🙌
        </p>
      </div>
    </main>
  );
}
