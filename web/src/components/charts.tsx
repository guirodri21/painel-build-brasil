"use client";

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
  PieChart,
  Pie,
  Legend,
  LineChart,
  Line,
} from "recharts";
import { formatCurrency } from "@/lib/utils";

export const CHART_COLORS = [
  "#2563eb",
  "#0d9488",
  "#16a34a",
  "#ea580c",
  "#ca8a04",
  "#7c3aed",
  "#db2777",
];

const axisStyle = { fontSize: 11, fill: "var(--muted)" };

function CurrencyTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border bg-surface px-3 py-2 shadow-md text-xs">
      {label && <div className="font-semibold mb-1">{label}</div>}
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-2">
          <span
            className="h-2 w-2 rounded-full"
            style={{ background: p.color }}
          />
          <span className="text-muted">{p.name}:</span>
          <span className="font-medium">{formatCurrency(p.value)}</span>
        </div>
      ))}
    </div>
  );
}

export function HBarChart({
  data,
  color = CHART_COLORS[0],
  height = 280,
}: {
  data: { name: string; value: number }[];
  color?: string;
  height?: number;
}) {
  if (!data.length)
    return <Empty />;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} layout="vertical" margin={{ left: 8, right: 16 }}>
        <CartesianGrid horizontal={false} stroke="var(--border)" />
        <XAxis
          type="number"
          tick={axisStyle}
          tickFormatter={(v) => formatCurrency(v, true)}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          type="category"
          dataKey="name"
          tick={axisStyle}
          width={120}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip content={<CurrencyTooltip />} cursor={{ fill: "var(--primary-soft)" }} />
        <Bar dataKey="value" radius={[0, 4, 4, 0]} maxBarSize={28} animationDuration={900} animationEasing="ease-out">
          {data.map((_, i) => (
            <Cell key={i} fill={color} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export function DonutChart({
  data,
  height = 280,
}: {
  data: { name: string; value: number }[];
  height?: number;
}) {
  if (!data.length) return <Empty />;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <PieChart>
        <Pie
          data={data}
          dataKey="value"
          nameKey="name"
          innerRadius={60}
          outerRadius={95}
          paddingAngle={2}
          animationDuration={900}
          animationEasing="ease-out"
        >
          {data.map((_, i) => (
            <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
          ))}
        </Pie>
        <Tooltip content={<CurrencyTooltip />} />
        <Legend
          iconType="circle"
          formatter={(v) => <span className="text-xs text-muted">{v}</span>}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}

export function BalancoChart({
  data,
  height = 300,
}: {
  data: { mes: string; receita: number; despesa: number; saldo: number }[];
  height?: number;
}) {
  if (!data.length) return <Empty />;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ left: 8, right: 16, top: 8 }}>
        <CartesianGrid stroke="var(--border)" vertical={false} />
        <XAxis dataKey="mes" tick={axisStyle} axisLine={false} tickLine={false} />
        <YAxis
          tick={axisStyle}
          tickFormatter={(v) => formatCurrency(v, true)}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip content={<CurrencyTooltip />} />
        <Legend
          iconType="line"
          formatter={(v) => <span className="text-xs text-muted">{v}</span>}
        />
        <Line type="monotone" dataKey="receita" name="Receita" stroke={CHART_COLORS[0]} strokeWidth={2} dot={false} animationDuration={1100} animationEasing="ease-out" />
        <Line type="monotone" dataKey="despesa" name="Despesa" stroke={CHART_COLORS[3]} strokeWidth={2} dot={false} animationDuration={1100} animationEasing="ease-out" />
        <Line type="monotone" dataKey="saldo" name="Saldo" stroke={CHART_COLORS[2]} strokeWidth={2} dot={false} animationDuration={1100} animationEasing="ease-out" />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function ValueBarChart({
  data,
  color = CHART_COLORS[1],
  suffix = "",
  height = 280,
}: {
  data: { name: string; value: number }[];
  color?: string;
  suffix?: string;
  height?: number;
}) {
  if (!data.length) return <Empty />;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} layout="vertical" margin={{ left: 8, right: 16 }}>
        <CartesianGrid horizontal={false} stroke="var(--border)" />
        <XAxis type="number" tick={axisStyle} axisLine={false} tickLine={false} />
        <YAxis type="category" dataKey="name" tick={axisStyle} width={120} axisLine={false} tickLine={false} />
        <Tooltip
          cursor={{ fill: "var(--primary-soft)" }}
          contentStyle={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: 8,
            fontSize: 12,
          }}
          formatter={(v) => [`${Number(v).toFixed(1)}${suffix}`, ""]}
        />
        <Bar dataKey="value" radius={[0, 4, 4, 0]} maxBarSize={28} animationDuration={900} animationEasing="ease-out">
          {data.map((_, i) => (
            <Cell key={i} fill={color} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

function Empty() {
  return (
    <div className="flex items-center justify-center h-[280px] text-sm text-muted">
      Sem dados no período.
    </div>
  );
}
