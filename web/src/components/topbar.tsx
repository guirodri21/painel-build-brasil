"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Menu, RefreshCw, LogOut, KeyRound } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { ThemeToggle } from "@/components/theme-toggle";
import { useData } from "@/components/data-provider";
import { useToast } from "@/components/ui/toast";
import { ChangePasswordModal } from "@/components/change-password-modal";
import { NotificationBell } from "@/components/notification-bell";
import { cn } from "@/lib/utils";

export function Topbar({ onMenu }: { onMenu: () => void }) {
  const router = useRouter();
  const { refresh, loading, filiais, filial, setFilial } = useData();
  const toast = useToast();
  const [pwOpen, setPwOpen] = React.useState(false);
  const [email, setEmail] = React.useState("");

  React.useEffect(() => {
    createClient()
      .auth.getUser()
      .then(({ data }) => setEmail(data.user?.email ?? ""));
  }, []);

  async function logout() {
    await createClient().auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  async function handleRefresh() {
    await refresh();
    toast("Dados atualizados.");
  }

  return (
    <header className="sticky top-0 z-20 flex items-center gap-3 h-16 px-4 lg:px-6 border-b border-border bg-surface/80 backdrop-blur">
      <button
        onClick={onMenu}
        className="lg:hidden text-muted hover:text-foreground"
        aria-label="Menu"
      >
        <Menu size={20} />
      </button>

      {filiais.length > 1 && (
        <select
          value={filial}
          onChange={(e) => setFilial(e.target.value)}
          title="Filial"
          className="h-9 rounded-lg border border-border bg-surface px-2.5 text-sm text-foreground cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
        >
          <option value="">Todas as filiais</option>
          {filiais.map((f) => (
            <option key={f} value={f}>{f}</option>
          ))}
        </select>
      )}

      <div className="flex-1" />

      <button
        onClick={handleRefresh}
        className="inline-flex h-9 items-center gap-2 rounded-lg border border-border px-3 text-sm text-muted hover:text-foreground hover:bg-surface-2 transition-colors cursor-pointer"
      >
        <RefreshCw size={15} className={cn(loading && "animate-spin")} />
        <span className="hidden sm:inline">Atualizar</span>
      </button>

      <NotificationBell />

      <ThemeToggle />

      {email && (
        <span className="hidden md:inline text-xs text-muted max-w-[180px] truncate">
          {email}
        </span>
      )}

      <button
        onClick={() => setPwOpen(true)}
        className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border text-muted hover:text-foreground hover:bg-surface-2 transition-colors cursor-pointer"
        title="Alterar senha"
      >
        <KeyRound size={16} />
      </button>

      <button
        onClick={logout}
        className="inline-flex h-9 items-center gap-2 rounded-lg border border-border px-3 text-sm text-muted hover:text-foreground hover:bg-surface-2 transition-colors cursor-pointer"
      >
        <LogOut size={15} />
        <span className="hidden sm:inline">Sair</span>
      </button>

      <ChangePasswordModal open={pwOpen} onClose={() => setPwOpen(false)} />
    </header>
  );
}
