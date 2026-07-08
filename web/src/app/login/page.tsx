"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/field";
import { BrandMark } from "@/components/brand";
import { usuarioParaEmail } from "@/lib/auth-usuario";

export default function LoginPage() {
  const router = useRouter();
  const [usuario, setUsuario] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [error, setError] = React.useState("");
  const [loading, setLoading] = React.useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!usuario || !password) {
      setError("Preencha usuário e senha.");
      return;
    }
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email: usuarioParaEmail(usuario), password });
    if (error) {
      setError("Credenciais inválidas.");
      setLoading(false);
      return;
    }
    router.replace("/");
    router.refresh();
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <BrandMark size={48} className="mb-3 shadow-md" />
          <h1 className="text-xl font-bold tracking-tight">Build Brasil</h1>
          <p className="text-sm text-muted mt-0.5">Painel de Resultados</p>
        </div>

        <form
          onSubmit={handleLogin}
          className="rounded-xl border border-border bg-surface p-6 shadow-lg space-y-4"
        >
          <div>
            <Label htmlFor="usuario">Usuário</Label>
            <Input
              id="usuario"
              type="text"
              autoComplete="username"
              placeholder="seu usuário"
              value={usuario}
              onChange={(e) => setUsuario(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="password">Senha</Label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          {error && <p className="text-sm text-red text-center">{error}</p>}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Entrando..." : "Entrar"}
          </Button>
        </form>
      </div>
    </div>
  );
}
