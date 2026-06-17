import { ToastProvider } from "@/components/ui/toast";
import { DataProvider } from "@/components/data-provider";

export default function TvLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ToastProvider>
      <DataProvider>{children}</DataProvider>
    </ToastProvider>
  );
}
