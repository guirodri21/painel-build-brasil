"use client";

import * as React from "react";
import { Sidebar } from "@/components/sidebar";
import { Topbar } from "@/components/topbar";
import { CommandPalette } from "@/components/command-palette";
import { useData } from "@/components/data-provider";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { usePersisted } from "@/lib/use-persisted";

const COLLAPSE_KEY = "bb-sidebar-recolhido";

export function AppShell({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = React.useState(false);
  const [collapsedRaw, setCollapsedRaw] = usePersisted(COLLAPSE_KEY, "0");
  const collapsed = collapsedRaw === "1";
  const { error, refresh } = useData();

  const toggleCollapsed = React.useCallback(
    () => setCollapsedRaw(collapsed ? "0" : "1"),
    [collapsed, setCollapsedRaw],
  );
  const closeSidebar = React.useCallback(() => setSidebarOpen(false), []);
  const openSidebar = React.useCallback(() => setSidebarOpen(true), []);

  // Atalho "[" recolhe/expande o menu (fora de campos de texto).
  React.useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement | null;
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
      if (e.key === "[" && !e.ctrlKey && !e.metaKey && !e.altKey) toggleCollapsed();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toggleCollapsed]);

  return (
    <div className="min-h-screen">
      <CommandPalette />
      <Sidebar open={sidebarOpen} onClose={closeSidebar} collapsed={collapsed} onToggleCollapsed={toggleCollapsed} />
      <div className={cn("min-w-0 transition-[padding] duration-200 ease-out", collapsed ? "lg:pl-16" : "lg:pl-60")}>
        <Topbar onMenu={openSidebar} />
        <main className="p-4 lg:p-6 max-w-[1400px] mx-auto min-w-0 overflow-x-clip">
          {error ? (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red/40 bg-red-soft px-4 py-3 mb-5">
              <div className="flex items-center gap-3">
                <AlertTriangle className="text-red shrink-0" size={18} />
                <p className="text-sm text-red font-medium">{error}</p>
              </div>
              <Button variant="danger" size="sm" onClick={refresh}>
                Tentar novamente
              </Button>
            </div>
          ) : null}
          {children}
        </main>
      </div>
    </div>
  );
}
