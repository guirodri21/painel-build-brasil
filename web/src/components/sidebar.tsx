"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  TrendingUp,
  Wrench,
  Wallet,
  Target,
  Package,
  Contact,
  KanbanSquare,
  CalendarDays,
  Receipt,
  FileSignature,
  Percent,
  Database,
  FileText,
  Users,
  Plug,
  MonitorPlay,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useData } from "@/components/data-provider";
import { BrandLogo } from "@/components/brand";

const NAV = [
  { href: "/", label: "Visão Geral", icon: LayoutDashboard },
  { href: "/vendas", label: "Vendas", icon: TrendingUp },
  { href: "/operacoes", label: "Operações", icon: Wrench },
  { href: "/chamados", label: "Chamados", icon: KanbanSquare },
  { href: "/agenda", label: "Agenda", icon: CalendarDays },
  { href: "/clientes", label: "Clientes", icon: Contact },
  { href: "/orcamentos", label: "Orçamentos", icon: FileSignature },
  { href: "/financeiro", label: "Financeiro", icon: Wallet },
  { href: "/contas", label: "Contas", icon: Receipt },
  { href: "/estoque", label: "Estoque", icon: Package },
  { href: "/comissoes", label: "Comissões", icon: Percent },
  { href: "/metas", label: "Metas", icon: Target },
  { href: "/cadastros", label: "Cadastros", icon: Database },
  { href: "/relatorios", label: "Relatórios", icon: FileText },
];

const ADMIN_NAV = [
  { href: "/integracoes", label: "Integrações", icon: Plug },
  { href: "/usuarios", label: "Usuários", icon: Users },
];

export function Sidebar({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const pathname = usePathname();
  const { isAdmin } = useData();
  const nav = isAdmin ? [...NAV, ...ADMIN_NAV] : NAV;

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
          <BrandLogo />
          <button
            onClick={onClose}
            className="lg:hidden text-muted hover:text-foreground"
          >
            <X size={18} />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto p-3 space-y-1">
          {nav.map(({ href, label, icon: Icon }) => {
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

        <div className="p-3 border-t border-border">
          <a
            href="/tv"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-primary bg-primary-soft hover:opacity-90 transition-opacity"
          >
            <MonitorPlay size={18} className="shrink-0" />
            Modo TV
          </a>
        </div>
        <div className="px-4 pb-4">
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
