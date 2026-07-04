"use client";

import { PageHeader } from "@/components/page-header";
import { FrotaInventarioManager } from "@/components/frota-inventario-manager";

export default function FrotaInventarioPage() {
  return (
    <>
      <PageHeader
        title="Inventário de Frota"
        subtitle="Cadastro de veículos: placa, ano, status, documentação, seguro, IPVA e custo mensal"
      />
      <FrotaInventarioManager />
    </>
  );
}
