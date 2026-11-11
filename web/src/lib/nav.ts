import {
  LayoutDashboard,
  TrendingUp,
  Wrench,
  Wallet,
  Package,
  Contact,
  KanbanSquare,
  LayoutGrid,
  CalendarDays,
  Receipt,
  CreditCard,
  FileSignature,
  Database,
  FileText,
  Users,
  Plug,
  BarChart3,
  GaugeCircle,
  Briefcase,
  HardHat,
  Truck,
  Car,
  CalendarCheck,
  Hammer,
  Settings,
  ClipboardList,
  ShoppingCart,
} from "lucide-react";

export type NavIcon = React.ComponentType<{ size?: number; className?: string }>;
export type NavGate = "comercial" | "operacional" | "estoque" | "financeiro" | "admin";
export type NavItem = { href: string; label: string; icon: NavIcon; keywords?: string };
export type NavGroup = { id: NavGate; label: string; icon: NavIcon; items: NavItem[] };

/** Fonte única da navegação: usada pelo menu lateral, pelo título do topo e pela busca (Ctrl K). */
export const HOME: NavItem = { href: "/", label: "Visão Geral", icon: LayoutDashboard, keywords: "inicio dashboard resumo" };

export const NAV_GROUPS: NavGroup[] = [
  {
    id: "comercial",
    label: "Comercial",
    icon: Briefcase,
    items: [
      { href: "/vendas", label: "Performance", icon: BarChart3, keywords: "vendas metas receita" },
      { href: "/chamados", label: "Pipeline Comercial", icon: KanbanSquare, keywords: "chamados funil leads" },
      { href: "/clientes", label: "Clientes", icon: Contact },
      { href: "/orcamentos", label: "Orçamentos", icon: FileSignature, keywords: "propostas" },
    ],
  },
  {
    id: "operacional",
    label: "Operacional",
    icon: HardHat,
    items: [
      { href: "/operacoes", label: "Indicadores", icon: GaugeCircle, keywords: "operacao kpis" },
      { href: "/operacoes/pipeline", label: "Pipeline Operacional", icon: Wrench, keywords: "ordens servico os" },
      { href: "/agenda", label: "Agenda", icon: CalendarDays, keywords: "calendario" },
      { href: "/operacoes/preventivas", label: "Preventivas", icon: CalendarCheck, keywords: "manutencao" },
      { href: "/operacoes/frota", label: "Frota e Logística", icon: Truck, keywords: "veiculos" },
      { href: "/operacoes/frota/inventario", label: "Inventário de Frota", icon: Car, keywords: "veiculos carros" },
      { href: "/operacoes/equipe", label: "Equipe Técnica", icon: HardHat, keywords: "tecnicos funcionarios" },
    ],
  },
  {
    id: "financeiro",
    label: "Financeiro",
    icon: Wallet,
    items: [
      { href: "/financeiro", label: "Resultado", icon: TrendingUp, keywords: "financeiro despesas saldo" },
      { href: "/contas", label: "Contas", icon: Receipt, keywords: "receber boletos vencimentos" },
      { href: "/financeiro/contas-a-pagar", label: "Contas a Pagar", icon: ClipboardList, keywords: "solicitacoes pagamento fornecedores" },
    ],
  },
  {
    id: "estoque",
    label: "Suprimentos",
    icon: Package,
    items: [
      { href: "/estoque", label: "Estoque", icon: Package, keywords: "consumo materiais produtos" },
      { href: "/operacoes/suprimentos", label: "Compras", icon: ShoppingCart, keywords: "suprimentos cotacao pedido materiais" },
      { href: "/operacoes/patrimonio", label: "Patrimônio", icon: Hammer, keywords: "equipamentos ferramentas" },
    ],
  },
  {
    id: "admin",
    label: "Administração",
    icon: Settings,
    items: [
      { href: "/quadros", label: "Quadros", icon: LayoutGrid, keywords: "kanban boards funil" },
      { href: "/cadastros", label: "Cadastros", icon: Database, keywords: "listas equipes regioes" },
      { href: "/assinaturas", label: "Assinaturas", icon: CreditCard },
      { href: "/relatorios", label: "Relatórios", icon: FileText, keywords: "pdf excel exportar" },
      { href: "/integracoes", label: "Integrações", icon: Plug, keywords: "whatsapp webhook api" },
      { href: "/usuarios", label: "Usuários", icon: Users, keywords: "acessos permissoes" },
    ],
  },
];

/** Rota ativa: exata ou prefixo (o item mais específico vence em `findActive`). */
export function isActive(href: string, pathname: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(href + "/");
}

/** Item e grupo da rota atual — escolhe o href mais longo que casa. */
export function findActive(pathname: string): { group: NavGroup | null; item: NavItem | null } {
  if (pathname === "/") return { group: null, item: HOME };
  let best: { group: NavGroup; item: NavItem } | null = null;
  for (const group of NAV_GROUPS) {
    for (const item of group.items) {
      if (isActive(item.href, pathname) && (!best || item.href.length > best.item.href.length)) {
        best = { group, item };
      }
    }
  }
  return best ?? { group: null, item: null };
}

export type Permissoes = {
  isAdmin: boolean;
  podeComercial: boolean;
  podeOperacional: boolean;
  podeEstoque: boolean;
  podeFinanceiro: boolean;
};

export function gruposVisiveis(p: Permissoes): NavGroup[] {
  return NAV_GROUPS.filter((g) => {
    switch (g.id) {
      case "comercial": return p.podeComercial;
      case "operacional": return p.podeOperacional;
      case "estoque": return p.podeEstoque;
      case "financeiro": return p.podeFinanceiro;
      case "admin": return p.isAdmin;
    }
  });
}
