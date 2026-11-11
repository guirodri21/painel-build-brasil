"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import { Menu, RefreshCw, LogOut, KeyRound, Search, Moon, Sun, ChevronRight, ChevronDown } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useData, clearDataCache } from "@/components/data-provider";
import { useToast } from "@/components/ui/toast";
import { ChangePasswordModal } from "@/components/change-password-modal";
import { NotificationBell } from "@/components/notification-bell";
import { emailParaUsuario } from "@/lib/auth-usuario";
import { findActive } from "@/lib/nav";
import { cn } from "@/lib/utils";
import { useTheme } from "@/lib/use-persisted";

const iconBtn =
  "inline-flex h-9 w-9 items-center justify-center rounded-lg text-muted hover:text-foreground hover:bg-surface-2 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]";

export function Topbar({ onMenu }: { onMenu: () => void }) {
  const pathname = usePathname();
  const { refresh, refreshing, filiais, filial, setFilial } = useData();
  const toast = useToast();
  const { group, item } = findActive(pathname);

  async function handleRefresh() {
    await refresh();
    toast("Dados atualizados.");
  }

  return (
    <header className="sticky top-0 z-20 flex items-center gap-1.5 sm:gap-2 h-14 px-3 sm:px-4 lg:px-6 border-b border-border bg-surface/85 backdrop-blur-md">
      <button onClick={onMenu} className={cn(iconBtn, "lg:hidden -ml-1")} aria-label="Abrir menu">
        <Menu size={20} />
      </button>

      {/* Onde estou: Grupo › Página */}
      <div className="flex min-w-0 items-center gap-1.5 text-sm">
        {group && (
          <>
            <span className="hidden sm:inline text-muted truncate">{group.label}</span>
            <ChevronRight size={14} className="hidden sm:inline text-muted/60 shrink-0" />
          </>
        )}
        <span className="font-semibold truncate">{item?.label ?? ""}</span>
      </div>

      <div className="flex-1" />

      {filiais.length > 1 && (
        <select
          value={filial}
          onChange={(e) => setFilial(e.target.value)}
          title="Filial"
          className="h-9 max-w-[8.5rem] sm:max-w-[12rem] shrink rounded-lg border border-border bg-surface px-2.5 text-sm text-foreground cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
        >
          <option value="">Todas as filiais</option>
          {filiais.map((f) => (
            <option key={f} value={f}>{f}</option>
          ))}
        </select>
      )}

      <button
        onClick={() => window.dispatchEvent(new Event("open-palette"))}
        className="hidden md:inline-flex h-9 w-56 items-center gap-2 rounded-lg border border-border bg-surface-2/60 px-3 text-sm text-muted hover:text-foreground hover:border-border-strong transition-colors cursor-pointer"
        title="Buscar ou ir para… (Ctrl K)"
      >
        <Search size={15} />
        <span className="flex-1 text-left">Buscar ou ir para…</span>
        <kbd className="text-[10px] font-sans border border-border rounded px-1 py-px bg-surface">Ctrl K</kbd>
      </button>
      <button
        onClick={() => window.dispatchEvent(new Event("open-palette"))}
        className={cn(iconBtn, "md:hidden")}
        aria-label="Buscar"
      >
        <Search size={17} />
      </button>

      <button onClick={handleRefresh} className={iconBtn} title="Atualizar dados" aria-label="Atualizar dados">
        <RefreshCw size={16} className={cn(refreshing && "animate-spin")} />
      </button>

      <NotificationBell />

      <UserMenu />
    </header>
  );
}

function UserMenu() {
  const router = useRouter();
  const { email } = useData();
  const [open, setOpen] = React.useState(false);
  const [pwOpen, setPwOpen] = React.useState(false);
  const [theme, setTheme] = useTheme();
  const ref = React.useRef<HTMLDivElement>(null);
  const usuario = email ? emailParaUsuario(email) : "";
  const inicial = (usuario || "?").charAt(0).toUpperCase();

  React.useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const toggleTheme = () => setTheme(theme === "dark" ? "light" : "dark");

  async function logout() {
    clearDataCache();
    await createClient().auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  const itemCls =
    "w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left hover:bg-surface-2 transition-colors cursor-pointer";

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="inline-flex h-9 items-center gap-1.5 rounded-lg pl-1 pr-1.5 hover:bg-surface-2 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
        title={usuario || "Conta"}
      >
        <span className="grid h-7 w-7 place-items-center rounded-full bg-primary text-primary-fg text-xs font-semibold">
          {inicial}
        </span>
        <ChevronDown size={14} className={cn("text-muted transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 mt-2 w-56 overflow-hidden rounded-xl border border-border bg-surface shadow-lg animate-in z-50"
        >
          {usuario && (
            <div className="px-3 py-2.5 border-b border-border">
              <p className="text-[11px] text-muted">Conectado como</p>
              <p className="text-sm font-medium truncate">{usuario}</p>
            </div>
          )}
          <div className="py-1">
            <button role="menuitem" onClick={toggleTheme} className={itemCls}>
              {theme === "dark" ? <Sun size={15} className="text-muted" /> : <Moon size={15} className="text-muted" />}
              {theme === "dark" ? "Tema claro" : "Tema escuro"}
            </button>
            <button role="menuitem" onClick={() => { setOpen(false); setPwOpen(true); }} className={itemCls}>
              <KeyRound size={15} className="text-muted" />
              Alterar senha
            </button>
          </div>
          <div className="py-1 border-t border-border">
            <button role="menuitem" onClick={logout} className={cn(itemCls, "text-red")}>
              <LogOut size={15} />
              Sair
            </button>
          </div>
        </div>
      )}

      <ChangePasswordModal open={pwOpen} onClose={() => setPwOpen(false)} />
    </div>
  );
}
