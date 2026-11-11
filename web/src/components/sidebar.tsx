"use client";

import * as React from "react";
import Link, { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";
import { MonitorPlay, ChevronDown, X, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { cn } from "@/lib/utils";
import { useData } from "@/components/data-provider";
import { BrandLogo, BrandMark } from "@/components/brand";
import { HOME, findActive, gruposVisiveis, type NavItem } from "@/lib/nav";
import { usePersisted } from "@/lib/use-persisted";

const OPEN_KEY = "bb-nav-grupos";

export function Sidebar({
  open,
  onClose,
  collapsed,
  onToggleCollapsed,
}: {
  open: boolean;
  onClose: () => void;
  collapsed: boolean;
  onToggleCollapsed: () => void;
}) {
  const pathname = usePathname();
  const perms = useData();
  const { isAdmin, podeFinanceiro, podeComercial, podeOperacional, podeEstoque } = perms;

  const groups = React.useMemo(
    () => gruposVisiveis({ isAdmin, podeFinanceiro, podeComercial, podeOperacional, podeEstoque }),
    [isAdmin, podeFinanceiro, podeComercial, podeOperacional, podeEstoque],
  );
  const { group: activeGroup, item: activeItem } = findActive(pathname);

  // Grupos abertos/fechados ficam salvos; sem escolha salva, abre o grupo da rota atual.
  const [overridesRaw, setOverridesRaw] = usePersisted(OPEN_KEY, "{}");
  const overrides = React.useMemo<Record<string, boolean>>(() => {
    try { return JSON.parse(overridesRaw); } catch { return {}; }
  }, [overridesRaw]);
  const isOpen = (id: string) => overrides[id] ?? id === activeGroup?.id;
  const toggle = (id: string) => setOverridesRaw(JSON.stringify({ ...overrides, [id]: !isOpen(id) }));

  // Gaveta mobile: fecha com Esc (ou ao clicar num link) e trava a rolagem do fundo.
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  // No modo recolhido (só desktop) mostramos ícones; na gaveta mobile sempre o menu completo.
  const rail = collapsed && !open;

  return (
    <>
      <div
        className={cn(
          "fixed inset-0 z-30 bg-black/40 backdrop-blur-[2px] lg:hidden transition-opacity duration-200",
          open ? "opacity-100" : "opacity-0 pointer-events-none",
        )}
        onClick={onClose}
        aria-hidden
      />
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 w-64 border-r border-border bg-surface flex flex-col",
          "transition-[transform,width] duration-200 ease-out lg:translate-x-0",
          open ? "translate-x-0 shadow-lg" : "-translate-x-full",
          collapsed ? "lg:w-16" : "lg:w-60",
        )}
        aria-label="Menu principal"
      >
        <div className={cn("flex items-center h-14 border-b border-border shrink-0", rail ? "lg:justify-center lg:px-0 px-4" : "justify-between gap-2 px-4")}>
          <Link href="/" className="min-w-0" title="Visão Geral">
            <span className={cn(rail && "lg:hidden")}><BrandLogo /></span>
            <span className={cn("hidden", rail && "lg:block")}><BrandMark size={32} /></span>
          </Link>
          <button onClick={onClose} className="lg:hidden p-1 -mr-1 text-muted hover:text-foreground" aria-label="Fechar menu">
            <X size={18} />
          </button>
        </div>

        <nav className={cn("flex-1 overflow-y-auto overscroll-contain py-3", rail ? "px-2" : "px-3")}>
          <NavLink item={HOME} active={activeItem?.href === HOME.href} rail={rail} onNavigate={onClose} />

          {groups.map((group) => {
            const GroupIcon = group.icon;
            const groupOpen = rail || isOpen(group.id);
            const groupActive = activeGroup?.id === group.id;
            return (
              <div key={group.id} className={cn(rail ? "mt-2 pt-2 border-t border-border" : "mt-3")}>
                {!rail && (
                  <button
                    onClick={() => toggle(group.id)}
                    aria-expanded={groupOpen}
                    className={cn(
                      "group w-full flex items-center gap-2 rounded-md px-2.5 py-1.5 text-[11px] font-semibold uppercase tracking-wider transition-colors cursor-pointer",
                      groupActive ? "text-foreground" : "text-muted hover:text-foreground",
                    )}
                  >
                    <GroupIcon size={14} className="shrink-0" />
                    <span className="flex-1 text-left">{group.label}</span>
                    <ChevronDown
                      size={14}
                      className={cn("shrink-0 opacity-60 transition-transform duration-200", !groupOpen && "-rotate-90")}
                    />
                  </button>
                )}
                {/* Abre/fecha com animação de altura (grid 0fr → 1fr). */}
                <div
                  className={cn(
                    "grid transition-[grid-template-rows,opacity] duration-200 ease-out",
                    groupOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
                  )}
                >
                  {/* inert: itens fechados não recebem clique nem foco de teclado. */}
                  <div className="overflow-hidden" inert={!groupOpen}>
                    <div className={cn("space-y-0.5", !rail && "mt-0.5")}>
                      {group.items.map((item) => (
                        <NavLink key={item.href} item={item} active={activeItem?.href === item.href} rail={rail} onNavigate={onClose} />
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </nav>

        <div className={cn("border-t border-border p-2 space-y-1 shrink-0", !rail && "px-3")}>
          <a
            href="/tv"
            target="_blank"
            rel="noopener noreferrer"
            title="Modo TV"
            className={cn(
              "flex items-center gap-3 rounded-lg px-2.5 h-9 text-sm font-medium text-muted hover:text-foreground hover:bg-surface-2 transition-colors",
              rail && "justify-center px-0",
            )}
          >
            <MonitorPlay size={17} className="shrink-0" />
            {!rail && "Modo TV"}
          </a>
          <button
            onClick={onToggleCollapsed}
            title={collapsed ? "Expandir menu ( [ )" : "Recolher menu ( [ )"}
            className={cn(
              "hidden lg:flex w-full items-center gap-3 rounded-lg px-2.5 h-9 text-sm text-muted hover:text-foreground hover:bg-surface-2 transition-colors cursor-pointer",
              rail && "justify-center px-0",
            )}
          >
            {collapsed ? <PanelLeftOpen size={17} /> : <PanelLeftClose size={17} />}
            {!rail && "Recolher"}
          </button>
        </div>
      </aside>
    </>
  );
}

function NavLink({ item, active, rail, onNavigate }: { item: NavItem; active: boolean; rail: boolean; onNavigate: () => void }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      title={rail ? item.label : undefined}
      aria-current={active ? "page" : undefined}
      className={cn(
        "relative flex items-center gap-3 rounded-lg h-9 text-sm transition-colors",
        rail ? "justify-center" : "px-2.5",
        active
          ? "bg-primary-soft text-primary font-semibold"
          : "text-muted font-medium hover:text-foreground hover:bg-surface-2",
      )}
    >
      {active && !rail && <span className="absolute left-0 top-2 bottom-2 w-[3px] rounded-r bg-primary" aria-hidden />}
      <Icon size={17} className="shrink-0" />
      {!rail && <span className="truncate flex-1">{item.label}</span>}
      <PendingDot rail={rail} />
    </Link>
  );
}

/** Pontinho que pulsa enquanto a página clicada carrega (feedback imediato do clique). */
function PendingDot({ rail }: { rail: boolean }) {
  const { pending } = useLinkStatus();
  return (
    <span
      aria-hidden
      className={cn(
        "h-1.5 w-1.5 rounded-full bg-primary transition-opacity duration-150",
        rail && "absolute top-1.5 right-1.5",
        pending ? "opacity-100 animate-pulse" : "opacity-0",
      )}
    />
  );
}
