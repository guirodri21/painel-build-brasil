"use client";

import { PageHeader } from "@/components/page-header";
import { EquipeTecnicosManager } from "@/components/equipe-tecnicos-manager";
import { EquipeAvaliacao } from "@/components/equipe-avaliacao";

export default function EquipePage() {
  return (
    <>
      <PageHeader
        title="Equipe Técnica e Qualidade"
        subtitle="Banco de técnicos (internos e terceiros) e avaliação de qualidade por técnico"
      />
      <div className="space-y-5">
        <EquipeTecnicosManager />
        <EquipeAvaliacao />
      </div>
    </>
  );
}
