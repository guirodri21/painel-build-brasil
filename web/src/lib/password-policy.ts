/** Política de senha do painel — usada na criação de usuário e na troca de senha. */

export interface RegraSenha {
  label: string;
  ok: (s: string) => boolean;
}

export const REGRAS_SENHA: RegraSenha[] = [
  { label: "Mínimo de 8 caracteres", ok: (s) => s.length >= 8 },
  { label: "Uma letra maiúscula", ok: (s) => /[A-Z]/.test(s) },
  { label: "Uma letra minúscula", ok: (s) => /[a-z]/.test(s) },
  { label: "Um número", ok: (s) => /[0-9]/.test(s) },
  { label: "Um símbolo (!@#$…)", ok: (s) => /[^A-Za-z0-9]/.test(s) },
];

/** True se a senha satisfaz todas as regras. */
export function senhaValida(s: string): boolean {
  return REGRAS_SENHA.every((r) => r.ok(s));
}
