"use client";

import { useParams } from "next/navigation";
import { QuadroBoard } from "@/components/quadro-board";

export default function QuadroBoardPage() {
  const params = useParams<{ id: string }>();
  return <QuadroBoard quadroId={params.id} backHref="/quadros" backLabel="Quadros" />;
}
