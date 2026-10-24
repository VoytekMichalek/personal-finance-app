import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { money } from "@finance/shared";
export function BalanceChart({
  points,
  label,
  valueLabel = "Balance",
  step = false,
}: {
  points: { date: string; balanceCents: number }[];
  label: string;
  valueLabel?: string;
  step?: boolean;
}) {
  return (
    <div role="img" aria-label={label} className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={points}
          margin={{ top: 10, right: 5, left: 0, bottom: 0 }}
        >
          <defs>
            <linearGradient id="balanceFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#007aff" stopOpacity={0.14} />
              <stop offset="100%" stopColor="#007aff" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke="#f0f1f2" />
          <XAxis
            dataKey="date"
            axisLine={false}
            tickLine={false}
            minTickGap={35}
            tick={{ fontSize: 10, fill: "#646c76" }}
            tickFormatter={(date) =>
              new Intl.DateTimeFormat("en-AU", {
                month: "short",
                day: "numeric",
                timeZone: "UTC",
              }).format(new Date(String(date) + "T00:00:00Z"))
            }
          />
          <YAxis
            axisLine={false}
            tickLine={false}
            width={60}
            tick={{ fontSize: 10, fill: "#646c76" }}
            tickFormatter={(n) =>
              Math.abs(n) >= 100000
                ? "$" + Math.round(n / 100000) + "k"
                : money(n, true)
            }
          />
          <Tooltip
            formatter={(value) => [money(Number(value)), valueLabel]}
            labelFormatter={(label) => String(label)}
            contentStyle={{
              borderRadius: 12,
              borderColor: "#e8e9ec",
              fontSize: 12,
            }}
          />
          <Area
            type={step ? "stepAfter" : "monotone"}
            dataKey="balanceCents"
            stroke="#007aff"
            strokeWidth={2.5}
            dot={step ? { r: 3, fill: "#007aff" } : false}
            fill="url(#balanceFill)"
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
