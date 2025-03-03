"use client";
import { ChartConfig, ChartContainer } from "@/components/ui/chart";
import { formatNumber } from "@/utils/format";
import { LineChart, Line, CartesianGrid, XAxis, DotProps, Tooltip, ReferenceLine, Label } from "recharts";
import { ChartTooltip } from "@/components/ui/chart";
import { ComponentProps } from "react";

interface IrmChartDataEntry {
  utilization: number;
  supplyApy: number;
  borrowApy: number;
}

const chartConfig = {
  utilization: {
    label: "Utilization",
    color: "rgb(var(--border-primary))",
  },
  supplyApy: {
    label: "Supply APY",
    color: "rgb(var(--accent-secondary))",
  },
  borrowApy: {
    label: "Borrow APY",
    color: "rgb(var(--accent-ternary))",
  },
} satisfies ChartConfig;

interface IrmChartProps {
  data: IrmChartDataEntry[];
  currentUtilization: number;
}

export default function IrmChart({ data, currentUtilization }: IrmChartProps) {
  return (
    <ChartContainer config={chartConfig} className="h-[216px] w-full">
      <LineChart accessibilityLayer data={data}>
        <CartesianGrid vertical={false} stroke="rgb(var(--border-primary))" />
        <XAxis
          dataKey="utilization"
          tickLine={false}
          tickMargin={14}
          axisLine={false}
          tickCount={2}
          type="number"
          tickFormatter={(value) => {
            return formatNumber(value, { style: "percent", minimumFractionDigits: 0, maximumFractionDigits: 0 });
          }}
          interval="preserveStartEnd"
          className="label-md text-content-secondary"
        />
        <ChartTooltip content={<CustomTooltip />} position={{ y: 0 }} cursor={{ strokeWidth: 3 }} />
        <ReferenceLine x={currentUtilization} stroke="rgb(var(--border-primary))" strokeDasharray="4 4" strokeWidth={2}>
          <Label
            value="Current"
            offset={0}
            position={
              currentUtilization < 0.035 ? "insideTopLeft" : currentUtilization > 0.965 ? "insideTopRight" : "insideTop"
            }
            className="text-content-secondary"
          />
        </ReferenceLine>

        <Line
          dataKey="borrowApy"
          stroke="var(--color-borrowApy)"
          dot={false}
          activeDot={<CustomActiveDot color="var(--color-borrowApy)" />}
          strokeWidth={3}
        />
        <Line
          dataKey="supplyApy"
          stroke="var(--color-supplyApy)"
          dot={false}
          activeDot={<CustomActiveDot color="var(--color-supplyApy)" />}
          strokeWidth={3}
        />
      </LineChart>
    </ChartContainer>
  );
}

function CustomActiveDot({ cx, cy, color }: DotProps) {
  const r = 9;
  return (
    <svg x={cx! - r} y={cy! - r} width={r * 2} height={r * 2} viewBox={`0 0 ${r * 2} ${r * 2}`} className="z-[100]">
      <circle cx={r} cy={r} r={r} fill="rgb(var(--background-secondary))" />
      <circle cx={r} cy={r} r={r - 3} fill={color} />
    </svg>
  );
}

function CustomTooltip({ active, payload }: ComponentProps<typeof Tooltip>) {
  if (active && payload && payload.length) {
    return (
      <div className="label-sm flex flex-col gap-4 rounded-lg bg-background-secondary px-5 py-4 shadow-card">
        <div className="flex items-center justify-between gap-6">
          <span>Utilization:</span>
          {formatNumber(payload[0]?.payload?.utilization ?? 0, { style: "percent" })}
        </div>
        <div className="flex items-center justify-between gap-6">
          <div className="flex items-center gap-2 text-content-secondary">
            <div className="h-4 w-4 rounded-sm bg-accent-secondary" />
            Supply APY
          </div>
          {formatNumber(payload[0]?.payload?.supplyApy ?? 0, { style: "percent" })}
        </div>
        <div className="flex items-center justify-between gap-6">
          <div className="flex items-center gap-2 text-content-secondary">
            <div className="h-4 w-4 rounded-sm bg-accent-ternary" />
            Borrow APY
          </div>
          {formatNumber(payload[0]?.payload?.borrowApy ?? 0, { style: "percent" })}
        </div>
      </div>
    );
  }

  return null;
}
