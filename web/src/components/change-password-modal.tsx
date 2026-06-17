"use client";

import * as React from "react";
import { createClient } from "@/lib/supabase/client";
import { Modal, ModalBody, ModalFooter } from "@/components/ui/modal";
import { Input, Label } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

const RULES: { key: string; label: string; test: (s: string) => boolean }[] = [
  { key: "len", label: "Mínimo 8 caracteres", test: (s) => s.length >= 8 },
  { key: "upper", label: "Uma letra maiúscula", test: (s) => /[A-Z]/.test(s) },
  { key: "lower", label: "Uma letra minúscula", test: (s) => /[a-z]/.test(s) },
  { key: "num", label: "Um número", test: (s) => /[0-9]/.test(s) },
];

export function ChangePasswordModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const toast = useToast();
  const [senha, setSenha] = React.useState("");
  const [confirma, setConfirma] = React.useState("");
  const [error, setError] = React.useState("");
  const [loading, setLoading] = React.useState(false);

  const score = RULES.filter((r) => r.test(senha)).length;
  const meterColor =
    score <= 1 ? "bg-red" : score === 2 ? "bg-orange" : score === 3 ? "bg-yellow" : "bg-green";

  function reset() {
    setSenha("");
    setConfirma("");
    setError("");
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (score < 4) {
      setError("A senha não atende a todos os requisitos.");
      return;
    }
    if (senha !== confirma) {
      setError("As senhas não coincidem.");
      return;
    }
    setLoading(true);
    const { error } = await createClient().auth.updateUser({ password: senha });
    setLoading(false);
    if (error) {
      setError("Erro: " + error.message);
      return;
    }
    toast("Senha alterada com sucesso.");
    reset();
    onClose();
  }

  return (
    <Modal
      open={open}
      onClose={() => {
        reset();
        onClose();
      }}
      title="Alterar Senha"
      className="max-w-md"
    >
      <form onSubmit={handleSave}>
        <ModalBody>
          <div>
            <Label>Nova senha</Label>
            <Input
              type="password"
              autoComplete="new-password"
              placeholder="••••••••"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
            />
            <div className="mt-2 h-1.5 rounded-full bg-surface-2 overflow-hidden">
              <div
                className={cn("h-full transition-all", meterColor)}
                style={{ width: `${(score / 4) * 100}%` }}
              />
            </div>
            <ul className="mt-3 grid grid-cols-2 gap-1.5">
              {RULES.map((r) => {
                const ok = r.test(senha);
                return (
                  <li
                    key={r.key}
                    className={cn(
                      "flex items-center gap-1.5 text-xs",
                      ok ? "text-green" : "text-muted",
                    )}
                  >
                    <Check size={13} className={ok ? "opacity-100" : "opacity-30"} />
                    {r.label}
                  </li>
                );
              })}
            </ul>
          </div>
          <div>
            <Label>Confirmar nova senha</Label>
            <Input
              type="password"
              autoComplete="new-password"
              placeholder="••••••••"
              value={confirma}
              onChange={(e) => setConfirma(e.target.value)}
            />
          </div>
          {error && <p className="text-sm text-red">{error}</p>}
        </ModalBody>
        <ModalFooter>
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              reset();
              onClose();
            }}
          >
            Cancelar
          </Button>
          <Button type="submit" disabled={loading}>
            {loading ? "Salvando..." : "Salvar"}
          </Button>
        </ModalFooter>
      </form>
    </Modal>
  );
}
