"use client";

import { Area, AreaChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AU_M, YEAR_S } from "@/lib/constants/celestial-bodies";
import type { OptimizationRun, TrajectoryResult } from "@/lib/types";

type Props = {
  result: TrajectoryResult;
  runs: OptimizationRun[];
};

export function ChartsPanel({ result, runs }: Props) {
  const sampled = result.simulationData
    .filter((_, index) => index % Math.max(1, Math.floor(result.simulationData.length / 80)) === 0)
    .map((step) => ({
      time: +(step.elapsedSeconds / YEAR_S).toFixed(2),
      velocity: +(Math.hypot(step.velocity.x, step.velocity.y, step.velocity.z) / 1_000).toFixed(2),
      distance: +(step.distanceFromSunM / AU_M).toFixed(2),
      fuel: +step.fuelRemainingKg.toFixed(0),
      deltaV: +(step.deltaVMps / 1_000).toFixed(2)
    }));

  return (
    <section className="glass rounded-lg p-4">
      <div className="mb-4">
        <h2 className="text-base font-semibold text-white">Analytics</h2>
        <p className="text-sm text-slate-300">Velocity, distance, fuel, delta-v, and convergence telemetry.</p>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Chart title="Velocity vs Time">
          <AreaChart data={sampled}>
            <CartesianGrid stroke="rgba(255,255,255,0.08)" />
            <XAxis dataKey="time" stroke="#94a3b8" />
            <YAxis stroke="#94a3b8" />
            <Tooltip contentStyle={tooltipStyle} />
            <Area dataKey="velocity" stroke="#44e6ff" fill="#44e6ff" fillOpacity={0.18} />
          </AreaChart>
        </Chart>
        <Chart title="Fuel Remaining">
          <AreaChart data={sampled}>
            <CartesianGrid stroke="rgba(255,255,255,0.08)" />
            <XAxis dataKey="time" stroke="#94a3b8" />
            <YAxis stroke="#94a3b8" />
            <Tooltip contentStyle={tooltipStyle} />
            <Area dataKey="fuel" stroke="#46e6a8" fill="#46e6a8" fillOpacity={0.16} />
          </AreaChart>
        </Chart>
        <Chart title="Distance vs Time">
          <LineChart data={sampled}>
            <CartesianGrid stroke="rgba(255,255,255,0.08)" />
            <XAxis dataKey="time" stroke="#94a3b8" />
            <YAxis stroke="#94a3b8" />
            <Tooltip contentStyle={tooltipStyle} />
            <Line dataKey="distance" stroke="#f7c948" dot={false} strokeWidth={2} />
          </LineChart>
        </Chart>
        <Chart title="Optimization Progress">
          <LineChart data={runs}>
            <CartesianGrid stroke="rgba(255,255,255,0.08)" />
            <XAxis dataKey="generation" stroke="#94a3b8" />
            <YAxis stroke="#94a3b8" />
            <Tooltip contentStyle={tooltipStyle} />
            <Line dataKey="score" stroke="#e85888" dot={false} strokeWidth={2} />
          </LineChart>
        </Chart>
      </div>
    </section>
  );
}

function Chart({ title, children }: { title: string; children: React.ReactElement }) {
  return (
    <div className="h-64 rounded-md border border-white/10 bg-white/[0.035] p-3">
      <p className="mb-2 text-sm font-medium text-white">{title}</p>
      <ResponsiveContainer width="100%" height="86%">
        {children}
      </ResponsiveContainer>
    </div>
  );
}

const tooltipStyle = {
  background: "rgba(3,5,10,0.92)",
  border: "1px solid rgba(156,244,255,0.22)",
  borderRadius: "6px",
  color: "#fff"
};
