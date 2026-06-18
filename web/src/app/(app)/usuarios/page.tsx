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
import { Plus, Trash2, ShieldCheck, ShieldOff, Lock } from "lucide-react";

interface AdminUser {
  id: string;
  email: string;
  role: "admin" | "membro";
  last_sign_in_at: string | null;
  created_at: string;
}

export default function UsuariosPage() {
  const { isAdmin, userId, loading } = useData();
  const toast = useToast();
  const [users, setUsers] = React.useState<AdminUser[] | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [novoOpen, setNovoOpen] = React.useState(false);
  const [delUser, setDelUser] = React.useState<AdminUser | null>(null);

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
    } catch (e) {
      toast(e instanceof Error ? e.message : "Erro ao listar.", "error");
      setUsers([]);
    }
  }, [call, toast]);

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
                    <Th>E-mail</Th>
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
                          {u.email} {self && <span className="text-xs text-muted">(você)</span>}
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
      <ConfirmDialog
        open={!!delUser}
        title="Excluir usuário"
        message={`Excluir ${delUser?.email}? Esta ação é permanente.`}
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
  onCreate: (body: Record<string, unknown>) => Promise<{ error?: string }>;
  onDone: () => Promise<void>;
}) {
  const toast = useToast();
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState("");

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    const fd = new FormData(e.currentTarget);
    const email = String(fd.get("email") ?? "").trim();
    const password = String(fd.get("password") ?? "");
    const role = fd.get("role") as string;
    if (!email || password.length < 8) {
      setError("Informe e-mail e senha de no mínimo 8 caracteres.");
      return;
    }
    setSaving(true);
    try {
      await onCreate({ action: "create", email, password, role });
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
            <Label>E-mail</Label>
            <Input type="email" name="email" required placeholder="pessoa@buildbrasil.com.br" />
          </div>
          <div>
            <Label>Senha provisória</Label>
            <Input type="text" name="password" required placeholder="mín. 8 caracteres" />
          </div>
          <div>
            <Label>Papel</Label>
            <Select name="role" defaultValue="membro">
              <option value="membro">Membro</option>
              <option value="admin">Administrador</option>
            </Select>
          </div>
          {error && <p className="text-sm text-red">{error}</p>}
          <p className="text-xs text-muted">A pessoa pode trocar a senha depois no botão de senha do topo.</p>
        </ModalBody>
        <ModalFooter>
          <Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button type="submit" disabled={saving}>{saving ? "Criando..." : "Criar"}</Button>
        </ModalFooter>
      </form>
    </Modal>
  );
}

function Th({ children, className }: { children: React.ReactNode; className?: string }) {
  return <th className={cn("px-4 py-3 text-xs font-semibold text-muted uppercase tracking-wide whitespace-nowrap", className)}>{children}</th>;
}
function Td({ children, className }: { children: React.ReactNode; className?: string }) {
  return <td className={cn("px-4 py-3", className)}>{children}</td>;
}
