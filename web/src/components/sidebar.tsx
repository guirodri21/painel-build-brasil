"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  TrendingUp,
  Wrench,
  Wallet,
  Target,
  Database,
  FileText,
  Building2,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/", label: "Visão Geral", icon: LayoutDashboard },
  { href: "/vendas", label: "Vendas", icon: TrendingUp },
  { href: "/operacoes", label: "Operações", icon: Wrench },
  { href: "/financeiro", label: "Financeiro", icon: Wallet },
  { href: "/metas", label: "Metas", icon: Target },
  { href: "/cadastros", label: "Cadastros", icon: Database },
  { href: "/relatorios", label: "Relatórios", icon: FileText },
];

export function Sidebar({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const pathname = usePathname();

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-30 bg-black/40 lg:hidden"
          onClick={onClose}
        />
      )}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 w-60 border-r border-border bg-surface flex flex-col transition-transform lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex items-center justify-between gap-2 px-5 h-16 border-b border-border">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center shrink-0">
              <Building2 className="text-primary-fg" size={18} />
            </div>
            <div className="leading-tight">
              <div className="text-sm font-bold">Build Brasil</div>
              <div className="text-[11px] text-muted">Painel de Resultados</div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="lg:hidden text-muted hover:text-foreground"
          >
            <X size={18} />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto p-3 space-y-1">
          {NAV.map(({ href, label, icon: Icon }) => {
            const active =
              href === "/" ? pathname === "/" : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                onClick={onClose}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "bg-primary-soft text-primary"
                    : "text-muted hover:text-foreground hover:bg-surface-2",
                )}
              >
                <Icon size={18} className="shrink-0" />
                {label}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-border">
          <p className="text-[11px] text-muted leading-relaxed">
            Build Brasil Engenharia
            <br />
            Gestão Interna · v5
          </p>
        </div>
      </aside>
    </>
  );
}
