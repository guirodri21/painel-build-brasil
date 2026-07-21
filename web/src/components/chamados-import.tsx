"use client";

import * as React from "react";
import { createClient } from "@/lib/supabase/client";
import { useData } from "@/components/data-provider";
import { useToast } from "@/components/ui/toast";
import { Modal, ModalBody, ModalFooter } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm";
import { FileSpreadsheet, Trash2 } from "lucide-react";
import * as XLSX from "xlsx";
import { indexarFases, casarFase } from "@/lib/fase-match";

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
add("fase_desde", ["data na fase atual", "data na fase", "entrou na fase atual"]);

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
  const { userId, filial, chamados, chamadoFases, isAdmin, refresh } = useData();
  const toast = useToast();
  const [busy, setBusy] = React.useState(false);
  const [reorg, setReorg] = React.useState(false);
  const [limpando, setLimpando] = React.useState(false);
  const [confirmarLimpar, setConfirmarLimpar] = React.useState(false);
  const [resumo, setResumo] = React.useState<string | null>(null);
  const [deParaFases, setDeParaFases] = React.useState<[string, string, number][] | null>(null);

  // Cards que vieram de importação (têm goalfy_card_id) — os criados na mão
  // pelo botão "Novo Card" têm esse campo nulo e são preservados.
  const importados = React.useMemo(() => chamados.filter((c) => c.goalfy_card_id), [chamados]);

  // Fases já criadas (ordenadas) — destino de todo card importado. A primeira
  // é a fase de entrada, usada quando o texto da planilha não casa com nenhuma.
  const fasesOrdenadas = React.useMemo(
    () => [...chamadoFases].sort((a, b) => a.ordem - b.ordem).map((f) => f.nome),
    [chamadoFases],
  );

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setBusy(true);
    setResumo(null);
    setDeParaFases(null);
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
      const datas = new Set(["prazo", "concluido_em", "aberto_em", "fase_desde"]);
      // Colunas "Tempo total na fase X" → coletadas em tempos_fase
      const tempoCols = rawHeader.map((h) => {
        const m = norm(h).match(/^tempo total na fase (.+)$/);
        return m ? m[1] : null;
      });

      const num = (v: string) => v ? Number(v.replace(/[^\d.,-]/g, "").replace(/\./g, "").replace(",", ".")) || 0 : 0;

      // De-para de fases: encaixa o texto da planilha numa fase JÁ existente,
      // em vez de criar coluna nova. Fallback = primeira fase (entrada).
      const idxFases = indexarFases(fasesOrdenadas);
      const faseEntrada = fasesOrdenadas[0] ?? "Oportunidade / Demanda";
      // Conta como cada texto original foi mapeado (para o resumo de-para).
      const dePara = new Map<string, { destino: string; n: number }>();

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
        // Resolve a fase para uma das já criadas. Registra o de-para pelo texto original.
        const faseOriginal = (r.fase as string | null) || "(sem fase)";
        const destino = casarFase((r.fase as string) ?? "", idxFases) ?? faseEntrada;
        r.fase = destino;
        const dp = dePara.get(faseOriginal) ?? { destino, n: 0 };
        dp.n++; dePara.set(faseOriginal, dp);
        // Sem coluna de ID no Goalfy → usa o Ticket Trílogo como chave anti-duplicação
        if (!r.goalfy_card_id && r.ticket_ref) r.goalfy_card_id = "tkt:" + String(r.ticket_ref);
        return r;
      }).filter((r) => r.titulo || r.cliente || r.descricao || r.goalfy_card_id);

      if (!registros.length) { toast("Nenhuma linha válida encontrada.", "error"); setBusy(false); return; }

      const supabase = createClient();
      // Deduplica por chave (tickets repetidos na planilha) — mantém a última linha,
      // senão o upsert dá "ON CONFLICT cannot affect row a second time".
      const mapaUnicos = new Map<string, Record<string, unknown>>();
      for (const r of registros) if (r.goalfy_card_id) mapaUnicos.set(String(r.goalfy_card_id), r);
      const comId = Array.from(mapaUnicos.values());
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
      // Mostra só o que foi de fato remapeado (texto da planilha ≠ fase de destino).
      const remap = Array.from(dePara.entries())
        .filter(([orig, { destino }]) => norm(orig) !== norm(destino))
        .map(([orig, { destino, n }]) => [orig, destino, n] as [string, string, number])
        .sort((a, b) => b[2] - a[2]);
      setDeParaFases(remap.length ? remap : null);
      setResumo(`${ok} chamado(s) importado(s) de ${registros.length} linha(s).`);
      toast(`${ok} chamado(s) importado(s).`);
    } catch (e) {
      setBusy(false);
      toast("Falha ao ler o arquivo: " + (e instanceof Error ? e.message : ""), "error");
    }
  }

  // Cards já existentes cuja fase NÃO é nenhuma das configuradas — são exatamente
  // as colunas "extra" que aparecem no board depois de uma importação antiga.
  const foraDaFase = React.useMemo(() => {
    const nomes = new Set(fasesOrdenadas);
    return chamados.filter((c) => !nomes.has(c.fase));
  }, [chamados, fasesOrdenadas]);

  /** Reencaixa os cards fora do padrão nas fases existentes (corrige importações antigas). */
  async function reorganizar() {
    if (!foraDaFase.length) { toast("Todos os cards já estão nas fases atuais.", "success"); return; }
    const entrada = fasesOrdenadas[0];
    if (!entrada) { toast("Crie ao menos uma fase antes de reorganizar.", "error"); return; }
    setReorg(true);
    setResumo(null);
    setDeParaFases(null);
    const idx = indexarFases(fasesOrdenadas);
    const supabase = createClient();
    // Agrupa por fase de origem: um UPDATE em massa por coluna fora do padrão.
    const origens = Array.from(new Set(foraDaFase.map((c) => c.fase)));
    const dePara: [string, string, number][] = [];
    let ok = 0; let err: string | null = null;
    for (const origem of origens) {
      const destino = casarFase(origem, idx) ?? entrada;
      const { data, error } = await supabase.from("chamados").update({ fase: destino }).eq("fase", origem).select("id");
      if (error) { err = error.message; break; }
      const n = data?.length ?? 0;
      ok += n;
      if (n) dePara.push([origem, destino, n]);
    }
    setReorg(false);
    if (err) { toast("Erro ao reorganizar: " + err, "error"); return; }
    await refresh();
    setDeParaFases(dePara.sort((a, b) => b[2] - a[2]));
    setResumo(`${ok} card(s) reorganizado(s) em ${origens.length} coluna(s) fora do padrão.`);
    toast(`${ok} card(s) reorganizado(s).`);
  }

  /** Apaga TODOS os chamados importados (goalfy_card_id != null). Preserva os criados na mão. */
  async function apagarImportados() {
    setConfirmarLimpar(false);
    if (!importados.length) return;
    setLimpando(true);
    setResumo(null);
    setDeParaFases(null);
    const supabase = createClient();
    // Em lotes de 100 e apagando dependentes antes (FK sem cascade).
    const ids = importados.map((c) => c.id);
    let ok = 0; let err: string | null = null;
    for (let i = 0; i < ids.length; i += 100) {
      const lote = ids.slice(i, i + 100);
      await supabase.from("chamado_comentarios").delete().in("chamado_id", lote);
      await supabase.from("chamado_anexos").delete().in("chamado_id", lote);
      const { data, error } = await supabase.from("chamados").delete().in("id", lote).select("id");
      if (error) { err = error.message; break; }
      ok += data?.length ?? 0;
    }
    setLimpando(false);
    if (err) { toast("Erro ao apagar: " + err, "error"); return; }
    await refresh();
    setResumo(`${ok} chamado(s) importado(s) apagado(s). Pode reimportar do zero.`);
    toast(`${ok} chamado(s) apagado(s).`);
  }

  return (
    <>
    <Modal open={open} onClose={onClose} title="Importar chamados (CSV / Excel)" className="max-w-lg">
      <ModalBody>
        <p className="text-sm text-muted">
          Exporte o board do Goalfy em <strong>CSV ou Excel</strong> e selecione o arquivo. O painel reconhece
          automaticamente as colunas: cliente, região, descrição, prioridade, ticket, fase, valor, responsável,
          e o <strong>ID do card</strong> (para não duplicar em reimportações).
        </p>
        <p className="text-xs text-muted">
          Os cards são encaixados nas <strong>fases já criadas</strong> do seu board (por nome, ignorando acento,
          maiúscula e pontuação). Nenhuma coluna nova é criada — o que não casar vai para a fase de entrada
          (<em>{fasesOrdenadas[0] ?? "primeira fase"}</em>).
        </p>

        <label className="flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border py-8 cursor-pointer hover:bg-surface-2 transition-colors">
          <FileSpreadsheet size={28} className="text-muted" />
          <span className="text-sm font-medium">{busy ? "Importando..." : "Clique para escolher a planilha"}</span>
          <span className="text-xs text-muted">.xlsx, .xls ou .csv</span>
          <input type="file" accept=".csv,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel" className="hidden" onChange={onFile} disabled={busy} />
        </label>

        {resumo && <p className="text-sm text-green font-medium">✓ {resumo}</p>}

        {deParaFases && (
          <div className="rounded-lg border border-border bg-surface-2/40 p-3">
            <p className="text-xs font-medium mb-1.5">Fases encaixadas (planilha → board):</p>
            <ul className="space-y-1 text-[11px] text-muted max-h-40 overflow-y-auto">
              {deParaFases.map(([orig, destino, n]) => (
                <li key={orig} className="flex items-center gap-1.5">
                  <span className="truncate max-w-[45%]" title={orig}>{orig}</span>
                  <span className="text-muted">→</span>
                  <span className="truncate font-medium text-foreground" title={destino}>{destino}</span>
                  <span className="ml-auto tabular-nums shrink-0">{n}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <p className="text-[11px] text-muted">
          Dica: no Goalfy, abra o board → <em>Ações em massa</em> ou o menu de exportação → exportar como Excel/CSV.
          Pode soltar o <strong>.xlsx</strong> direto aqui — não precisa converter.
        </p>

        {isAdmin && foraDaFase.length > 0 && (
          <div className="rounded-lg border border-yellow/40 bg-yellow/5 p-3">
            <p className="text-xs font-medium text-foreground">
              {foraDaFase.length} card(s) estão em colunas fora das fases atuais
            </p>
            <p className="text-[11px] text-muted mt-0.5 mb-2">
              De importações anteriores. Reorganize para encaixá-los nas fases já criadas — sem apagar nada.
            </p>
            <Button variant="secondary" size="sm" onClick={reorganizar} disabled={reorg || busy}>
              {reorg ? "Reorganizando..." : "Reorganizar cards nas fases atuais"}
            </Button>
          </div>
        )}

        {isAdmin && importados.length > 0 && (
          <div className="rounded-lg border border-red/40 bg-red/5 p-3">
            <p className="text-xs font-medium text-foreground">
              Zona de teste — apagar {importados.length} chamado(s) importado(s)
            </p>
            <p className="text-[11px] text-muted mt-0.5 mb-2">
              Remove tudo que veio de planilha para você reimportar do zero. Cards criados na mão
              (botão &quot;Novo Card&quot;) são preservados. Não dá para desfazer.
            </p>
            <Button variant="danger" size="sm" onClick={() => setConfirmarLimpar(true)} disabled={limpando || busy || reorg}>
              <Trash2 size={14} /> {limpando ? "Apagando..." : "Apagar chamados importados"}
            </Button>
          </div>
        )}
      </ModalBody>
      <ModalFooter>
        <Button variant="secondary" onClick={onClose}>Fechar</Button>
      </ModalFooter>
    </Modal>

    <ConfirmDialog
      open={confirmarLimpar}
      title="Apagar chamados importados"
      message={`Isso apaga ${importados.length} chamado(s) importado(s) (todos com ID do Goalfy). Os criados na mão são mantidos. Não dá para desfazer. Confirmar?`}
      confirmLabel="Apagar tudo"
      onConfirm={apagarImportados}
      onCancel={() => setConfirmarLimpar(false)}
    />
    </>
  );
}
