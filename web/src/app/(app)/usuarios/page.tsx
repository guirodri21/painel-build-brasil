"use client";

import * as React from "react";
import { createClient } from "@/lib/supabase/client";
import { useData } from "@/components/data-provider";
import { useToast } from "@/components/ui/toast";
import { PageHeader } from "@/components/page-header";
import { Card, CardHeader, CardTitle, CardBody } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input, Select, Label } from "@/components/ui/field";
import { Modal, ModalBody, ModalFooter } from "@/components/ui/modal";
import { ConfirmDialog } from "@/components/ui/confirm";
import { formatDate, cn } from "@/lib/utils";
import { usuarioParaEmail, emailParaUsuario } from "@/lib/auth-usuario";
import { REGRAS_SENHA, senhaValida } from "@/lib/password-policy";
import { Plus, Trash2, ShieldCheck, ShieldOff, Lock, SlidersHorizontal, Check } from "lucide-react";

interface AdminUser {
  id: string;
  email: string;
  role: "admin" | "membro";
  last_sign_in_at: string | null;
  created_at: string;
}

type Acessos = { comercial: boolean; operacional: boolean; estoque: boolean; financeiro: boolean };
const ACESSO_PADRAO: Acessos = { comercial: true, operacional: true, estoque: true, financeiro: true };
const SECOES: { chave: keyof Acessos; coluna: string; label: string }[] = [
  { chave: "comercial", coluna: "pode_comercial", label: "Comercial / Vendas" },
  { chave: "operacional", coluna: "pode_operacional", label: "Operacional" },
  { chave: "estoque", coluna: "pode_estoque", label: "Suprimentos / Estoque" },
  { chave: "financeiro", coluna: "pode_financeiro", label: "Financeiro" },
];

export default function UsuariosPage() {
  const { isAdmin, userId, loading } = useData();
  const toast = useToast();
  const [users, setUsers] = React.useState<AdminUser[] | null>(null);
  const [acessos, setAcessos] = React.useState<Record<string, Acessos>>({});
  const [busy, setBusy] = React.useState(false);
  const [novoOpen, setNovoOpen] = React.useState(false);
  const [delUser, setDelUser] = React.useState<AdminUser | null>(null);
  const [acessoUser, setAcessoUser] = React.useState<AdminUser | null>(null);

  const call = React.useCallback(async (body: Record<string, unknown>) => {
    const { data, error } = await createClient().functions.invoke("admin-users", { body });
    if (error) throw new Error(error.message);
    if (data?.error) throw new Error(data.error);
    return data;
  }, []);

  const load = React.useCallback(async () => {
    try {
      const data = await call({ action: "list" });
      setUsers(data.users);
      const { data: profs } = await createClient()
        .from("profiles")
        .select("id, pode_comercial, pode_operacional, pode_estoque, pode_financeiro");
      const map: Record<string, Acessos> = {};
      for (const p of profs ?? []) {
        map[p.id] = {
          comercial: p.pode_comercial !== false,
          operacional: p.pode_operacional !== false,
          estoque: p.pode_estoque !== false,
          financeiro: p.pode_financeiro !== false,
        };
      }
      setAcessos(map);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Erro ao listar.", "error");
      setUsers([]);
    }
  }, [call, toast]);

  async function salvarAcessos(u: AdminUser, a: Acessos) {
    setBusy(true);
    const { error } = await createClient().from("profiles").update({
      pode_comercial: a.comercial,
      pode_operacional: a.operacional,
      pode_estoque: a.estoque,
      pode_financeiro: a.financeiro,
    }).eq("id", u.id);
    setBusy(false);
    if (error) { toast("Erro: " + error.message, "error"); return; }
    setAcessos((m) => ({ ...m, [u.id]: a }));
    setAcessoUser(null);
    toast("Acessos atualizados.");
  }

  React.useEffect(() => {
    if (isAdmin) load();
  }, [isAdmin, load]);

  async function setRole(u: AdminUser, role: "admin" | "membro") {
    setBusy(true);
    try {
      await call({ action: "setRole", id: u.id, role });
      toast("Papel atualizado.");
      await load();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Erro.", "error");
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    if (!delUser) return;
    setBusy(true);
    try {
      await call({ action: "delete", id: delUser.id });
      toast("Usuário excluído.");
      setDelUser(null);
      await load();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Erro.", "error");
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <><PageHeader title="Usuários" /><Skeleton className="h-72" /></>;

  if (!isAdmin)
    return (
      <>
        <PageHeader title="Usuários" />
        <Card>
          <CardBody>
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Lock size={36} className="text-muted mb-3" />
              <p className="text-sm text-muted">Acesso restrito a administradores.</p>
            </div>
          </CardBody>
        </Card>
      </>
    );

  return (
    <>
      <PageHeader title="Usuários" subtitle="Gerencie quem acessa o painel e seus papéis">
        <Button onClick={() => setNovoOpen(true)}><Plus size={16} /> Novo usuário</Button>
      </PageHeader>

      <Card>
        <CardHeader><CardTitle>Usuários do sistema</CardTitle></CardHeader>
        <CardBody className="p-0">
          {users === null ? (
            <div className="p-5 space-y-3"><Skeleton className="h-10" /><Skeleton className="h-10" /></div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left">
                    <Th>Usuário</Th>
                    <Th>Papel</Th>
                    <Th>Último acesso</Th>
                    <Th className="text-right">Ações</Th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => {
                    const self = u.id === userId;
                    return (
                      <tr key={u.id} className="border-b border-border last:border-0 hover:bg-surface-2 transition-colors">
                        <Td className="font-medium">
                          {emailParaUsuario(u.email)} {self && <span className="text-xs text-muted">(você)</span>}
                        </Td>
                        <Td>
                          <Badge tone={u.role === "admin" ? "blue" : "gray"}>
                            {u.role === "admin" ? "Administrador" : "Membro"}
                          </Badge>
                        </Td>
                        <Td className="text-muted">
                          {u.last_sign_in_at ? formatDate(u.last_sign_in_at.substring(0, 10)) : "—"}
                        </Td>
                        <Td className="text-right">
                          <div className="flex justify-end gap-1">
                            {u.role !== "admin" && (
                              <button disabled={busy} onClick={() => setAcessoUser(u)}
                                className="inline-flex items-center gap-1 p-1.5 rounded-md text-muted hover:text-primary hover:bg-primary-soft cursor-pointer"
                                title="Definir acessos por seção">
                                <SlidersHorizontal size={15} /> <span className="text-xs">Acessos</span>
                              </button>
                            )}
                            {u.role === "admin" ? (
                              <button disabled={busy || self} onClick={() => setRole(u, "membro")}
                                className="p-1.5 rounded-md text-muted hover:text-orange hover:bg-orange-soft disabled:opacity-30 cursor-pointer" title="Tornar membro">
                                <ShieldOff size={15} />
                              </button>
                            ) : (
                              <button disabled={busy} onClick={() => setRole(u, "admin")}
                                className="p-1.5 rounded-md text-muted hover:text-primary hover:bg-primary-soft cursor-pointer" title="Tornar admin">
                                <ShieldCheck size={15} />
                              </button>
                            )}
                            <button disabled={busy || self} onClick={() => setDelUser(u)}
                              className="p-1.5 rounded-md text-muted hover:text-red hover:bg-red-soft disabled:opacity-30 cursor-pointer" title="Excluir">
                              <Trash2 size={15} />
                            </button>
                          </div>
                        </Td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardBody>
      </Card>

      {novoOpen && <NovoUsuarioModal onClose={() => setNovoOpen(false)} onCreate={call} onDone={load} />}
      {acessoUser && (
        <AcessosModal
          user={acessoUser}
          inicial={acessos[acessoUser.id] ?? ACESSO_PADRAO}
          busy={busy}
          onClose={() => setAcessoUser(null)}
          onSave={(a) => salvarAcessos(acessoUser, a)}
        />
      )}
      <ConfirmDialog
        open={!!delUser}
        title="Excluir usuário"
        message={`Excluir ${delUser ? emailParaUsuario(delUser.email) : ""}? Esta ação é permanente.`}
        confirmLabel="Excluir"
        onConfirm={handleDelete}
        onCancel={() => setDelUser(null)}
      />
    </>
  );
}

function NovoUsuarioModal({
  onClose,
  onCreate,
  onDone,
}: {
  onClose: () => void;
  onCreate: (body: Record<string, unknown>) => Promise<{ error?: string; id?: string }>;
  onDone: () => Promise<void>;
}) {
  const toast = useToast();
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [role, setRole] = React.useState<"membro" | "admin">("membro");
  const [acessos, setAcessos] = React.useState<Acessos>(ACESSO_PADRAO);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    const fd = new FormData(e.currentTarget);
    const usuario = String(fd.get("usuario") ?? "").trim();
    if (!usuario) { setError("Informe o usuário."); return; }
    if (!senhaValida(password)) { setError("A senha não atende às regras."); return; }
    setSaving(true);
    try {
      const res = await onCreate({ action: "create", email: usuarioParaEmail(usuario), password, role });
      // Aplica os acessos escolhidos (só faz sentido para membro; admin vê tudo).
      if (role === "membro" && res?.id) {
        await createClient().from("profiles").update({
          pode_comercial: acessos.comercial,
          pode_operacional: acessos.operacional,
          pode_estoque: acessos.estoque,
          pode_financeiro: acessos.financeiro,
        }).eq("id", res.id);
      }
      toast("Usuário criado.");
      await onDone();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao criar.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open onClose={onClose} title="Novo usuário" className="max-w-md">
      <form onSubmit={submit}>
        <ModalBody>
          <div>
            <Label>Usuário</Label>
            <Input type="text" name="usuario" required placeholder="ex.: joao" autoComplete="off" />
          </div>
          <div>
            <Label>Senha provisória</Label>
            <Input type="text" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="crie uma senha forte" autoComplete="new-password" />
            <ul className="mt-2 space-y-1">
              {REGRAS_SENHA.map((r) => {
                const ok = r.ok(password);
                return (
                  <li key={r.label} className={cn("flex items-center gap-1.5 text-[11px]", ok ? "text-green" : "text-muted")}>
                    <Check size={12} className={ok ? "opacity-100" : "opacity-30"} /> {r.label}
                  </li>
                );
              })}
            </ul>
          </div>
          <div>
            <Label>Papel</Label>
            <Select value={role} onChange={(e) => setRole(e.target.value as "membro" | "admin")}>
              <option value="membro">Membro</option>
              <option value="admin">Administrador</option>
            </Select>
          </div>

          {/* O que a pessoa vai ver — definido já na criação */}
          <div className="rounded-lg border border-border bg-surface-2/40 p-3">
            <p className="text-xs font-medium text-muted mb-2">O que este usuário vai acessar</p>
            {role === "admin" ? (
              <p className="text-[13px] flex items-center gap-1.5">
                <ShieldCheck size={14} className="text-primary" /> Administrador — vê <strong>tudo</strong>, incluindo Admin/Config e gestão de usuários.
              </p>
            ) : (
              <div className="space-y-2">
                {SECOES.map((s) => (
                  <label key={s.chave} className="flex items-center gap-3 rounded-md border border-border bg-surface px-3 py-2 cursor-pointer hover:bg-surface-2">
                    <input
                      type="checkbox"
                      checked={acessos[s.chave]}
                      onChange={(e) => setAcessos((prev) => ({ ...prev, [s.chave]: e.target.checked }))}
                      className="h-4 w-4 rounded border-border"
                    />
                    <span className="text-sm">{s.label}</span>
                  </label>
                ))}
                <p className="text-[11px] text-muted">Você pode ajustar depois no botão “Acessos”.</p>
              </div>
            )}
          </div>

          {error && <p className="text-sm text-red">{error}</p>}
          <p className="text-xs text-muted">A pessoa pode trocar a senha depois no botão de senha do topo.</p>
        </ModalBody>
        <ModalFooter>
          <Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button type="submit" disabled={saving || !senhaValida(password)}>{saving ? "Criando..." : "Criar"}</Button>
        </ModalFooter>
      </form>
    </Modal>
  );
}

function AcessosModal({
  user, inicial, busy, onClose, onSave,
}: {
  user: AdminUser;
  inicial: Acessos;
  busy: boolean;
  onClose: () => void;
  onSave: (a: Acessos) => void;
}) {
  const [a, setA] = React.useState<Acessos>(inicial);
  return (
    <Modal open onClose={onClose} title={`Acessos — ${emailParaUsuario(user.email)}`} className="max-w-md">
      <ModalBody>
        <p className="text-xs text-muted">Marque as seções que este usuário pode acessar no menu.</p>
        <div className="space-y-2">
          {SECOES.map((s) => (
            <label key={s.chave} className="flex items-center gap-3 rounded-lg border border-border px-3 py-2.5 cursor-pointer hover:bg-surface-2">
              <input
                type="checkbox"
                checked={a[s.chave]}
                onChange={(e) => setA((prev) => ({ ...prev, [s.chave]: e.target.checked }))}
                className="h-4 w-4 rounded border-border"
              />
              <span className="text-sm">{s.label}</span>
            </label>
          ))}
        </div>
        <p className="text-[11px] text-muted">O menu Admin/Config continua exclusivo de administradores.</p>
      </ModalBody>
      <ModalFooter>
        <Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
        <Button type="button" disabled={busy} onClick={() => onSave(a)}>{busy ? "Salvando..." : "Salvar acessos"}</Button>
      </ModalFooter>
    </Modal>
  );
}

function Th({ children, className }: { children: React.ReactNode; className?: string }) {
  return <th className={cn("px-4 py-3 text-xs font-semibold text-muted uppercase tracking-wide whitespace-nowrap", className)}>{children}</th>;
}
function Td({ children, className }: { children: React.ReactNode; className?: string }) {
  return <td className={cn("px-4 py-3", className)}>{children}</td>;
}
