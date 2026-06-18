import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
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

/** Gera um PDF com layout próprio (cabeçalho + tabela + rodapé). */
export function exportRelatorioPDF({
  titulo,
  subtitulo,
  colunas,
  linhas,
}: {
  titulo: string;
  subtitulo?: string;
  colunas: string[];
  linhas: (string | number)[][];
}) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

  // Cabeçalho
  doc.setFontSize(16);
  doc.setTextColor(37, 99, 235); // primary
  doc.text("Build Brasil", 14, 18);
  doc.setFontSize(12);
  doc.setTextColor(30, 30, 30);
  doc.text(titulo, 14, 26);
  if (subtitulo) {
    doc.setFontSize(9);
    doc.setTextColor(120, 120, 120);
    doc.text(subtitulo, 14, 32);
  }

  autoTable(doc, {
    startY: subtitulo ? 37 : 31,
    head: [colunas],
    body: linhas.map((r) => r.map((c) => String(c))),
    styles: { fontSize: 9, cellPadding: 2.5 },
    headStyles: { fillColor: [37, 99, 235], textColor: 255 },
    alternateRowStyles: { fillColor: [245, 247, 250] },
  });

  // Rodapé com data de geração
  const gerado = new Date().toLocaleString("pt-BR");
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text(`Gerado em ${gerado}`, 14, doc.internal.pageSize.getHeight() - 8);
    doc.text(`${i}/${pages}`, doc.internal.pageSize.getWidth() - 20, doc.internal.pageSize.getHeight() - 8);
  }

  doc.save(`relatorio-build-brasil-${new Date().toISOString().split("T")[0]}.pdf`);
}
