import { ToastProvider } from "@/components/ui/toast";
import { DataProvider } from "@/components/data-provider";
import { FiltersProvider } from "@/components/filters-provider";
import { AppShell } from "@/components/app-shell";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ToastProvider>
      <DataProvider>
        <FiltersProvider>
          <AppShell>{children}</AppShell>
        </FiltersProvider>
      </DataProvider>
    </ToastProvider>
  );
}
