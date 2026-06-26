"use client";

import * as React from "react";
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
  LayoutGrid,
  CalendarDays,
  Receipt,
  FileSignature,
  Percent,
  Database,
  FileText,
  Users,
  Plug,
  MonitorPlay,
  BarChart3,
  GaugeCircle,
  Briefcase,
  HardHat,
  Truck,
  CalendarCheck,
  Hammer,
  Settings,
  ChevronDown,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useData } from "@/components/data-provider";
import { BrandLogo } from "@/components/brand";

type Icon = React.ComponentType<{ size?: number; className?: string }>;
type NavItem = { href: string; label: string; icon: Icon };
type NavGroup = {
  id: string;
  label: string;
  icon: Icon;
  gate?: "financeiro" | "admin";
  items: NavItem[];
};

/** Item solto no topo (sem grupo). */
const HOME: NavItem = { href: "/", label: "Visão Geral", icon: LayoutDashboard };

/** As 4 áreas principais + Admin/Config. */
const GROUPS: NavGroup[] = [
  {
    id: "comercial",
    label: "Comercial / Vendas",
    icon: Briefcase,
    items: [
      { href: "/vendas", label: "Performance Comercial", icon: BarChart3 },
      { href: "/chamados", label: "Pipeline Comercial", icon: KanbanSquare },
      { href: "/clientes", label: "Clientes", icon: Contact },
      { href: "/orcamentos", label: "Orçamentos", icon: FileSignature },
      { href: "/metas", label: "Metas", icon: Target },
    ],
  },
  {
    id: "operacional",
    label: "Operacional",
    icon: HardHat,
    items: [
      { href: "/operacoes", label: "Indicadores Operação", icon: GaugeCircle },
      { href: "/operacoes/pipeline", label: "Pipeline Operacional", icon: Wrench },
      { href: "/agenda", label: "Agenda", icon: CalendarDays },
      { href: "/operacoes/preventivas", label: "Preventivas", icon: CalendarCheck },
      { href: "/operacoes/frota", label: "Frota e Logística", icon: Truck },
    ],
  },
  {
    id: "financeiro",
    label: "Financeiro",
    icon: Wallet,
    gate: "financeiro",
    items: [
      { href: "/financeiro", label: "Financeiro", icon: TrendingUp },
      { href: "/contas", label: "Contas", icon: Receipt },
      { href: "/comissoes", label: "Comissões", icon: Percent },
    ],
  },
  {
    id: "estoque",
    label: "Estoque",
    icon: Package,
    items: [
      { href: "/estoque", label: "Estoque (consumo)", icon: Package },
      { href: "/operacoes/patrimonio", label: "Patrimônio (equip./ferr.)", icon: Hammer },
    ],
  },
  {
    id: "admin",
    label: "Admin / Config",
    icon: Settings,
    gate: "admin",
    items: [
      { href: "/quadros", label: "Quadros", icon: LayoutGrid },
      { href: "/cadastros", label: "Cadastros", icon: Database },
      { href: "/relatorios", label: "Relatórios", icon: FileText },
      { href: "/integracoes", label: "Integrações", icon: Plug },
      { href: "/usuarios", label: "Usuários", icon: Users },
    ],
  },
];

/** Casa a rota ativa com um item (mais específico primeiro). */
function isActive(href: string, pathname: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(href + "/");
}

export function Sidebar({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const pathname = usePathname();
  const { isAdmin, podeFinanceiro } = useData();

  const visibleGroups = React.useMemo(
    () =>
      GROUPS.filter((g) => {
        if (g.gate === "financeiro") return podeFinanceiro;
        if (g.gate === "admin") return isAdmin;
        return true;
      }),
    [isAdmin, podeFinanceiro],
  );

  // Grupo que contém a rota ativa (para auto-expandir).
  const activeGroupId = React.useMemo(
    () =>
      visibleGroups.find((g) => g.items.some((it) => isActive(it.href, pathname)))
        ?.id ?? null,
    [visibleGroups, pathname],
  );

  // Sobreposições explícitas do usuário (clique no cabeçalho). Sem override,
  // o grupo da rota ativa abre por padrão — derivado, sem efeito colateral.
  const [overrides, setOverrides] = React.useState<Record<string, boolean>>({});

  const isOpen = (id: string) => overrides[id] ?? id === activeGroupId;

  const toggle = (id: string) =>
    setOverrides((prev) => ({ ...prev, [id]: !isOpen(id) }));

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
          {/* Visão Geral (topo, sem grupo) */}
          <NavLink item={HOME} active={isActive(HOME.href, pathname)} onClose={onClose} />

          {visibleGroups.map((group) => {
            const groupOpen = isOpen(group.id);
            const groupActive = group.items.some((it) => isActive(it.href, pathname));
            const GroupIcon = group.icon;
            return (
              <div key={group.id} className="pt-1">
                <button
                  onClick={() => toggle(group.id)}
                  className={cn(
                    "w-full flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-semibold transition-colors cursor-pointer",
                    groupActive
                      ? "text-foreground"
                      : "text-muted hover:text-foreground hover:bg-surface-2",
                  )}
                >
                  <GroupIcon size={18} className="shrink-0" />
                  <span className="flex-1 text-left">{group.label}</span>
                  <ChevronDown
                    size={16}
                    className={cn(
                      "shrink-0 text-muted transition-transform",
                      groupOpen ? "rotate-0" : "-rotate-90",
                    )}
                  />
                </button>

                {groupOpen && (
                  <div className="mt-1 ml-3 pl-3 border-l border-border space-y-1">
                    {group.items.map((item) => (
                      <NavLink
                        key={item.href}
                        item={item}
                        active={isActive(item.href, pathname)}
                        onClose={onClose}
                      />
                    ))}
                  </div>
                )}
              </div>
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

function NavLink({
  item,
  active,
  onClose,
}: {
  item: NavItem;
  active: boolean;
  onClose: () => void;
}) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      onClick={onClose}
      className={cn(
        "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
        active
          ? "bg-primary-soft text-primary"
          : "text-muted hover:text-foreground hover:bg-surface-2",
      )}
    >
      <Icon size={18} className="shrink-0" />
      {item.label}
    </Link>
  );
}
