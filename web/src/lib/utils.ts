import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(value: number, compact = false): string {
  if (compact && Math.abs(value) >= 1000) {
    return "R$ " + (value / 1000).toFixed(1).replace(".0", "") + "k";
  }
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

export function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

export function formatPercent(value: number, digits = 1): string {
  return value.toFixed(digits).replace(".", ",") + "%";
}

export function todayISO(): string {
  return new Date().toISOString().split("T")[0];
}

export function monthLabel(ym: string): string {
  const meses = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  const [y, m] = ym.split("-");
  return `${meses[parseInt(m, 10) - 1]}/${y.slice(2)}`;
}
