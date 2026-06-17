"use client";

import * as React from "react";
import { Sidebar } from "@/components/sidebar";
import { Topbar } from "@/components/topbar";
import { useData } from "@/components/data-provider";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";

export function AppShell({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = React.useState(false);
  const { error, refresh } = useData();

  return (
    <div className="min-h-screen">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="lg:pl-60">
        <Topbar onMenu={() => setSidebarOpen(true)} />
        <main className="p-4 lg:p-6 max-w-[1400px] mx-auto">
          {error ? (
            <div className="flex items-center justify-between gap-4 rounded-xl border border-red bg-red-soft px-5 py-4 mb-6">
              <div className="flex items-center gap-3">
                <AlertTriangle className="text-red shrink-0" size={20} />
                <p className="text-sm text-red font-medium">
                  Não foi possível carregar os dados. Verifique sua conexão.
                </p>
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
