import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export type ScoreChartRow = {
  name: string;
  score: number;
  growth: number;
};

export type GrowthRevenueRow = {
  symbol: string;
  growthPct: number;
  revenueB: number;
};

type Props = {
  scoreChartData: ScoreChartRow[];
  growthRevenueData: GrowthRevenueRow[];
};

export default function DealCharts({ scoreChartData, growthRevenueData }: Props) {
  return (
    <section className="grid gap-8 lg:grid-cols-2">
      <div className="rounded-2xl border border-white/10 bg-ink-900/40 p-5">
        <h3 className="text-lg font-semibold text-white">Acquisition scores</h3>
        <p className="text-sm text-slate-500">
          Higher = more attractive vs. model
        </p>
        <div className="mt-4 h-72">
          {scoreChartData.length === 0 ? (
            <p className="text-sm text-slate-600">No data</p>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={scoreChartData}
                margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#243040" />
                <XAxis
                  dataKey="name"
                  tick={{ fill: "#94a3b8", fontSize: 11 }}
                />
                <YAxis tick={{ fill: "#94a3b8", fontSize: 11 }} />
                <Tooltip
                  contentStyle={{
                    background: "#4A90E2",
                    border: "1px solid rgba(255,255,255,0.35)",
                    borderRadius: 8,
                    color: "#ffffff",
                  }}
                  labelStyle={{ color: "#ffffff" }}
                  itemStyle={{ color: "#ffffff" }}
                />
                <Bar dataKey="score" radius={[4, 4, 0, 0]}>
                  {scoreChartData.map((_, idx) => (
                    <Cell key={idx} fill={idx === 0 ? "#d4a853" : "#3d4f66"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-ink-900/40 p-5">
        <h3 className="text-lg font-semibold text-white">Growth vs revenue scale</h3>
        <p className="text-sm text-slate-500">
          YoY revenue growth (%) and TTM revenue ($B)
        </p>
        <div className="mt-4 h-72">
          {growthRevenueData.length === 0 ? (
            <p className="text-sm text-slate-600">No data</p>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={growthRevenueData}
                margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#243040" />
                <XAxis
                  dataKey="symbol"
                  tick={{ fill: "#94a3b8", fontSize: 11 }}
                />
                <YAxis yAxisId="left" tick={{ fill: "#94a3b8", fontSize: 11 }} />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  tick={{ fill: "#94a3b8", fontSize: 11 }}
                />
                <Tooltip
                  contentStyle={{
                    background: "#0f1419",
                    border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: 8,
                  }}
                />
                <Legend />
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="growthPct"
                  name="Growth %"
                  stroke="#d4a853"
                  strokeWidth={2}
                  dot={false}
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="revenueB"
                  name="Rev $B"
                  stroke="#60a5fa"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </section>
  );
}
