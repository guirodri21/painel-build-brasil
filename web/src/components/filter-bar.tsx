"use client";

import { useData } from "@/components/data-provider";
import { useFiltros } from "@/components/filters-provider";
import { Input, Select } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { Search, X } from "lucide-react";

export function FilterBar() {
  const { regioes, equipes, linhas } = useData();
  const { filtros, setFiltro, clear } = useFiltros();

  const hasActive = Object.values(filtros).some(Boolean);

  return (
    <div className="rounded-xl border border-border bg-surface p-3 shadow-sm mb-5">
      <div className="flex flex-wrap items-end gap-2">
        <Field label="Região">
          <Select
            value={filtros.regiao}
            onChange={(e) => setFiltro("regiao", e.target.value)}
            className="min-w-[130px]"
          >
            <option value="">Todas</option>
            {regioes.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </Select>
        </Field>
        <Field label="Equipe">
          <Select
            value={filtros.equipe}
            onChange={(e) => setFiltro("equipe", e.target.value)}
            className="min-w-[130px]"
          >
            <option value="">Todas</option>
            {equipes.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </Select>
        </Field>
        <Field label="Linha de Serviço">
          <Select
            value={filtros.linha}
            onChange={(e) => setFiltro("linha", e.target.value)}
            className="min-w-[150px]"
          >
            <option value="">Todas</option>
            {linhas.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </Select>
        </Field>
        <Field label="De">
          <Input
            type="date"
            value={filtros.de}
            onChange={(e) => setFiltro("de", e.target.value)}
            className="w-[150px]"
          />
        </Field>
        <Field label="Até">
          <Input
            type="date"
            value={filtros.ate}
            onChange={(e) => setFiltro("ate", e.target.value)}
            className="w-[150px]"
          />
        </Field>
        <Field label="Busca">
          <div className="relative">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" />
            <Input
              type="text"
              placeholder="Cliente, resumo…"
              value={filtros.busca}
              onChange={(e) => setFiltro("busca", e.target.value)}
              className="pl-8 min-w-[180px]"
            />
          </div>
        </Field>
        {hasActive && (
          <Button variant="ghost" size="sm" onClick={clear} className="h-9">
            <X size={14} /> Limpar
          </Button>
        )}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col">
      <span className="text-[11px] font-medium text-muted mb-1">{label}</span>
      {children}
    </div>
  );
}
