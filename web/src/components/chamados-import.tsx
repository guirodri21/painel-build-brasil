"use client";

import * as React from "react";
import { createClient } from "@/lib/supabase/client";
import { useData } from "@/components/data-provider";
import { useToast } from "@/components/ui/toast";
import { Modal, ModalBody, ModalFooter } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { FileSpreadsheet } from "lucide-react";
import * as XLSX from "xlsx";

const norm = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

// Sinônimos de cabeçalho → campo do painel
const MAP: Record<string, string> = {};
const add = (campo: string, nomes: string[]) => nomes.forEach((n) => (MAP[norm(n)] = campo));
add("goalfy_card_id", ["id", "card id", "card_id", "codigo", "código", "id do card"]);
add("titulo", ["titulo", "título", "title", "demanda", "titulo da demanda", "título da demanda"]);
add("cliente", ["cliente", "solicitante", "cliente/solicitante", "cliente / solicitante"]);
add("regiao", ["regiao", "região", "regional", "region"]);
add("descricao", ["descricao", "descrição", "description", "obs", "observacao", "observação"]);
add("prioridade", ["prioridade", "priority"]);
add("ticket_ref", ["ticket", "ticket trilogo", "ticket trílogo", "ticket_trilogo", "nº ticket", "no ticket"]);
add("fase", ["fase", "etapa", "status", "coluna", "fase atual", "estagio", "estágio"]);
add("titulo", ["titulo da demanda", "título da demanda"]); // sobrescreve "Título" genérico
add("valor", ["valor", "valor proposta", "valor da proposta", "valor faturado", "preco", "preço"]);
add("responsavel", ["responsavel", "responsável", "responsible", "responsaveis", "responsáveis"]);
add("equipe", ["equipe", "equipe responsavel", "equipe responsável"]);
add("tipo_demanda", ["tipo de demanda", "tipo demanda", "tipo"]);
add("custo_real", ["custo real", "custo"]);
add("margem", ["margem"]);
add("prazo", ["data de vencimento", "vencimento", "prazo", "sla / prazo", "sla/prazo"]);
add("centro_custo", ["centro de custo (cc)", "centro de custo", "centro custo", "cc"]);
add("status_faturamento", ["status do faturamento", "status faturamento"]);
add("nota_fiscal", ["nota fiscal", "nf"]);
add("motivo_perda", ["motivo da perda", "motivo perda", "motivo"]);
add("concluido_em", ["concluido em", "concluído em", "data de conclusao", "data de conclusão"]);
add("local_demanda", ["local da demanda", "local"]);
add("telefone", ["telefone para contato", "telefone", "contato"]);

/** Converte data BR (DD/MM/AAAA), ISO ou serial Excel para YYYY-MM-DD. */
function parseDate(v: string): string | null {
  if (!v) return null;
  const s = v.trim();
  let m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  const n = Number(s);
  if (!isNaN(n) && n > 30000 && n < 60000) {
    return new Date(Math.round((n - 25569) * 86400000)).toISOString().split("T")[0];
  }
  return null;
}

/** Parser CSV simples com suporte a aspas e delimitador , ou ; */
function parseCSV(text: string): string[][] {
  text = text.replace(/^﻿/, "");
  const delim = (text.split("\n")[0].match(/;/g)?.length ?? 0) > (text.split("\n")[0].match(/,/g)?.length ?? 0) ? ";" : ",";
  const rows: string[][] = [];
  let row: string[] = [], cur = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"' && text[i + 1] === '"') { cur += '"'; i++; }
      else if (c === '"') q = false;
      else cur += c;
    } else {
      if (c === '"') q = true;
      else if (c === delim) { row.push(cur); cur = ""; }
      else if (c === "\n") { row.push(cur); rows.push(row); row = []; cur = ""; }
      else if (c === "\r") { /* ignora */ }
      else cur += c;
    }
  }
  if (cur.length || row.length) { row.push(cur); rows.push(row); }
  return rows.filter((r) => r.some((x) => x.trim()));
}

export function ChamadosImport({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { userId, filial, refresh } = useData();
  const toast = useToast();
  const [busy, setBusy] = React.useState(false);
  const [resumo, setResumo] = React.useState<string | null>(null);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setBusy(true);
    setResumo(null);
    try {
      const nome = file.name.toLowerCase();
      const excel = nome.endsWith(".xlsx") || nome.endsWith(".xls");
      let rows: string[][];
      if (excel) {
        const buf = await file.arrayBuffer();
        const wb = XLSX.read(buf, { type: "array" });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const raw = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, blankrows: false, defval: "" });
        rows = raw.map((r) => (r as unknown[]).map((c) => (c == null ? "" : String(c))));
      } else {
        rows = parseCSV(await file.text());
      }
      if (rows.length < 2) { toast("Planilha vazia ou sem cabeçalho.", "error"); setBusy(false); return; }

      const rawHeader = rows[0];
      const header = rawHeader.map((h) => MAP[norm(h)] ?? null);
      const numericos = new Set(["valor", "custo_real", "margem"]);
      const datas = new Set(["prazo", "concluido_em", "aberto_em"]);
      // Colunas "Tempo total na fase X" → coletadas em tempos_fase
      const tempoCols = rawHeader.map((h) => {
        const m = norm(h).match(/^tempo total na fase (.+)$/);
        return m ? m[1] : null;
      });

      const num = (v: string) => v ? Number(v.replace(/[^\d.,-]/g, "").replace(/\./g, "").replace(",", ".")) || 0 : 0;

      const registros = rows.slice(1).map((cols) => {
        const r: Record<string, unknown> = { filial: filial || "Matriz", created_by: userId };
        const tempos: Record<string, string> = {};
        header.forEach((campo, i) => {
          const raw = (cols[i] ?? "").trim();
          if (campo) {
            if (numericos.has(campo)) r[campo] = num(raw);
            else if (datas.has(campo)) r[campo] = parseDate(raw);
            else r[campo] = raw === "" ? null : raw;
          }
          if (tempoCols[i] && raw) tempos[tempoCols[i] as string] = raw;
        });
        if (Object.keys(tempos).length) r.tempos_fase = tempos;
        if (!r.fase) r.fase = "Triagem";
        // Sem coluna de ID no Goalfy → usa o Ticket Trílogo como chave anti-duplicação
        if (!r.goalfy_card_id && r.ticket_ref) r.goalfy_card_id = "tkt:" + String(r.ticket_ref);
        return r;
      }).filter((r) => r.titulo || r.cliente || r.descricao || r.goalfy_card_id);

      if (!registros.length) { toast("Nenhuma linha válida encontrada.", "error"); setBusy(false); return; }

      const supabase = createClient();
      const comId = registros.filter((r) => r.goalfy_card_id);
      const semId = registros.filter((r) => !r.goalfy_card_id);
      let ok = 0; let err: string | null = null;

      // em lotes de 200
      const lotes = <T,>(arr: T[], n: number) => Array.from({ length: Math.ceil(arr.length / n) }, (_, i) => arr.slice(i * n, i * n + n));
      for (const lote of lotes(comId, 200)) {
        const { data, error } = await supabase.from("chamados").upsert(lote, { onConflict: "goalfy_card_id" }).select("id");
        if (error) { err = error.message; break; } ok += data?.length ?? 0;
      }
      if (!err) for (const lote of lotes(semId, 200)) {
        const { data, error } = await supabase.from("chamados").insert(lote).select("id");
        if (error) { err = error.message; break; } ok += data?.length ?? 0;
      }

      setBusy(false);
      if (err) { toast("Erro ao importar: " + err, "error"); return; }
      await refresh();
      setResumo(`${ok} chamado(s) importado(s) de ${registros.length} linha(s).`);
      toast(`${ok} chamado(s) importado(s).`);
    } catch (e) {
      setBusy(false);
      toast("Falha ao ler o arquivo: " + (e instanceof Error ? e.message : ""), "error");
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Importar chamados (CSV / Excel)" className="max-w-lg">
      <ModalBody>
        <p className="text-sm text-muted">
          Exporte o board do Goalfy em <strong>CSV ou Excel</strong> e selecione o arquivo. O painel reconhece
          automaticamente as colunas: cliente, região, descrição, prioridade, ticket, fase, valor, responsável,
          e o <strong>ID do card</strong> (para não duplicar em reimportações).
        </p>

        <label className="flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border py-8 cursor-pointer hover:bg-surface-2 transition-colors">
          <FileSpreadsheet size={28} className="text-muted" />
          <span className="text-sm font-medium">{busy ? "Importando..." : "Clique para escolher a planilha"}</span>
          <span className="text-xs text-muted">.xlsx, .xls ou .csv</span>
          <input type="file" accept=".csv,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel" className="hidden" onChange={onFile} disabled={busy} />
        </label>

        {resumo && <p className="text-sm text-green font-medium">✓ {resumo}</p>}

        <p className="text-[11px] text-muted">
          Dica: no Goalfy, abra o board → <em>Ações em massa</em> ou o menu de exportação → exportar como Excel/CSV.
          Pode soltar o <strong>.xlsx</strong> direto aqui — não precisa converter.
        </p>
      </ModalBody>
      <ModalFooter>
        <Button variant="secondary" onClick={onClose}>Fechar</Button>
      </ModalFooter>
    </Modal>
  );
}
