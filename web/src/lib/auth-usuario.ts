/**
 * Login por NOME DE USUÁRIO (não e-mail).
 *
 * O Supabase Auth é baseado em e-mail, então internamente cada usuário vira
 * `usuario@LOGIN_DOMAIN` — um domínio interno, sem envio de e-mail real
 * (senha é trocada dentro do app). A pessoa só digita o usuário no login e na
 * criação. E-mails reais (com "@") continuam funcionando normalmente.
 */

/** Domínio interno dos logins por usuário. Trocar aqui muda tudo. */
export const LOGIN_DOMAIN = "buildbrasil.com.br";

/** Normaliza um usuário digitado (minúsculas, sem acento, sem caractere inválido). */
export function slugUsuario(usuario: string): string {
  return usuario
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9._-]+/g, ".")
    .replace(/^\.+|\.+$/g, "");
}

/** Converte o que a pessoa digitou em e-mail para o Supabase Auth.
 *  Se já vier com "@" (e-mail real), só normaliza minúsculas. */
export function usuarioParaEmail(entrada: string): string {
  const v = entrada.trim().toLowerCase();
  if (v.includes("@")) return v;
  return `${slugUsuario(entrada)}@${LOGIN_DOMAIN}`;
}

/** Extrai o nome de usuário de um e-mail interno (para exibição). */
export function emailParaUsuario(email: string): string {
  const sufixo = `@${LOGIN_DOMAIN}`;
  return email.endsWith(sufixo) ? email.slice(0, -sufixo.length) : email;
}
