import type { Ordem } from "@/lib/types";
import { STATUS_LABELS } from "@/lib/types";

export function exportOrdensCSV(ordens: Ordem[]) {
  const headers = [
    "Data", "Região", "Equipe", "Linha", "Cliente", "Valor Venda",
    "Despesa Direta", "Status", "Tempo (h)", "Qualidade", "Resumo",
  ];
  const rows = ordens.map((o) => [
    o.data, o.regiao, o.equipe, o.linha_servico, o.cliente ?? "",
    o.valor_venda, o.despesa_direta, STATUS_LABELS[o.status],
    o.tempo_execucao_h ?? "", o.qualidade ?? "",
    (o.resumo ?? "").replace(/"/g, '""'),
  ]);
  const csv =
    "﻿" +
    [headers, ...rows]
      .map((r) => r.map((v) => `"${v}"`).join(";"))
      .join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `build-brasil-${new Date().toISOString().split("T")[0]}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
