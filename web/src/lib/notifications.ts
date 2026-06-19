import { createClient } from "@/lib/supabase/client";

/** Cria notificações in-app para todos os administradores. Fire-and-forget. */
export async function notificarAdmins(titulo: string, mensagem?: string, link?: string): Promise<void> {
  try {
    const supabase = createClient();
    const { data: admins } = await supabase.from("profiles").select("id").eq("role", "admin");
    if (!admins?.length) return;
    const rows = admins.map((a) => ({ user_id: a.id, titulo, mensagem: mensagem ?? null, link: link ?? null }));
    await supabase.from("notificacoes").insert(rows);
  } catch {
    /* silencioso */
  }
}
