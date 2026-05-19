import { LineChart, Line, ResponsiveContainer, YAxis } from "recharts";

export function Sparkline({ data, color = "var(--coral)", height = 32 }: {
  data: { date: string; value: number }[];
  color?: string;
  height?: number;
}) {
  if (!data || data.length === 0) return <div style={{ height }} />;
  return (
    <div style={{ width: "100%", height }}>
      <ResponsiveContainer>
        <LineChart data={data}>
          <YAxis hide domain={["dataMin", "dataMax"]} />
          <Line type="monotone" dataKey="value" stroke={color} strokeWidth={1.5} dot={false} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
