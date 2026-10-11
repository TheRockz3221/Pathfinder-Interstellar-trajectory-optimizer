"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import { BarChart3, BookOpen, ChevronDown, GitCompare, Orbit, RotateCcw, Satellite } from "lucide-react";
import { generateMissionRecommendations } from "@/lib/ai/recommendations";
import { runOptimizationPreview, runOptimizationSeeds, type SeedSummary } from "@/lib/optimization/optimizer";
import { runTrajectorySimulation } from "@/lib/physics/simulation";
import { useMissionStore } from "@/lib/state/mission-store";
import { cn, formatNumber } from "@/lib/utils";
import { AiMissionPlanner } from "@/components/AiMissionPlanner";
import { AuthPanel } from "@/components/AuthPanel";
import { ChartsPanel } from "@/components/ChartsPanel";
import { EducationalPanel } from "@/components/EducationalPanel";
import { ExportPanel } from "@/components/ExportPanel";
import { MissionBuilder } from "@/components/MissionBuilder";
import { MissionComparison, type RecentMissionRun } from "@/components/MissionComparison";
import { MissionDashboard } from "@/components/MissionDashboard";
import { OptimizationPanel } from "@/components/OptimizationPanel";

const SolarSystemScene = dynamic(() => import("@/components/SolarSystemScene").then((mod) => mod.SolarSystemScene), {
  ssr: false,
  loading: () => <div className="flex h-[520px] items-center justify-center text-sm text-cyan-soft">Initializing orbital scene...</div>
});

const views = [
  { id: "dashboard", label: "Dashboard", icon: BarChart3 },
  { id: "builder", label: "Builder", icon: Orbit },
  { id: "compare", label: "Compare", icon: GitCompare },
  { id: "education", label: "Education", icon: BookOpen }
] as const;

export function AppShell() {
  const { mission, selectedView, setView, resetMission } = useMissionStore();
  const result = useMemo(() => runTrajectorySimulation(mission, 950), [mission]);
  const [optimizationRuns, setOptimizationRuns] = useState<ReturnType<typeof runOptimizationPreview>>([]);
  const [isOptimizing, setIsOptimizing] = useState(true);
  const [seedSummary, setSeedSummary] = useState<SeedSummary | null>(null);
  const [optimizationError, setOptimizationError] = useState("");
  const [recentRuns, setRecentRuns] = useState<RecentMissionRun[]>([]);
  const recommendations = useMemo(() => generateMissionRecommendations(mission, result), [mission, result]);
  const isDashboardView = selectedView === "dashboard";

  useEffect(() => {
    let isCurrent = true;
    setIsOptimizing(true);
    setOptimizationRuns([]);
    const timeout = window.setTimeout(() => {
      const runs = runOptimizationPreview(mission);
      if (isCurrent) {
        setOptimizationRuns(runs);
        setIsOptimizing(false);
      }
    }, 0);

    return () => {
      isCurrent = false;
      window.clearTimeout(timeout);
    };
  }, [mission]);

  useEffect(() => {
    const signature = JSON.stringify(mission);
    setRecentRuns((previous) => {
      if (previous[0] && JSON.stringify(previous[0].mission) === signature) return previous;
      const currentRun: RecentMissionRun = {
        id: `${Date.now()}-${signature}`,
        mission,
        result,
        capturedAt: new Date().toISOString()
      };
      return [currentRun, ...previous].slice(0, 4);
    });
  }, [mission, result]);

  const handleRunSeeds = (count: number) => {
    setIsOptimizing(true);
    setOptimizationError("");
    setSeedSummary(null);
    window.setTimeout(() => {
      try {
        const batch = runOptimizationSeeds(mission, count);
        setOptimizationRuns(batch.runs);
        setSeedSummary(batch.summary);
      } catch (error) {
        setOptimizationError(error instanceof Error ? error.message : "Optimization failed.");
      } finally {
        setIsOptimizing(false);
      }
    }, 0);
  };

  return (
    <main className="min-h-screen px-4 py-4 sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-[1600px] flex-col gap-4">
        <header className="panel flex flex-col gap-4 p-4 lg:sticky lg:top-4 lg:z-30">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-md border border-cyan-signal/25 bg-cyan-signal/10 text-cyan-signal shadow-glow">
              <Satellite size={22} />
              </div>
              <div>
                <h1 className="text-xl font-semibold tracking-normal text-white sm:text-2xl">Interstellar Trajectory Optimizer</h1>
                <p className="text-sm text-slate-300">{mission.missionName} / {mission.destination} / {mission.propulsionType}</p>
              </div>
            </div>
            <button
              onClick={resetMission}
              className="inline-flex h-10 items-center gap-2 self-start rounded-md border border-gold-mission/30 bg-gold-mission/10 px-3 text-sm text-gold-mission transition hover:bg-gold-mission/15 lg:self-auto"
            >
              <RotateCcw size={16} />
              Reset mission
            </button>
            <details className="relative">
              <summary className="inline-flex h-10 cursor-pointer list-none items-center rounded-md border border-white/10 bg-white/5 px-3 text-sm text-slate-200">
                Account
              </summary>
              <div className="absolute right-0 top-full z-40 mt-2 w-[min(22rem,calc(100vw-2rem))]">
                <AuthPanel />
              </div>
            </details>
          </div>

          <nav className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {views.map((view) => {
              const Icon = view.icon;
              return (
                <button
                  key={view.id}
                  onClick={() => setView(view.id)}
                  className={cn(
                    "inline-flex h-10 items-center justify-center gap-2 rounded-md border px-3 text-sm transition",
                    selectedView === view.id
                      ? "border-cyan-signal/60 bg-cyan-signal/15 text-cyan-soft"
                      : "border-white/10 bg-white/5 text-slate-300 hover:border-cyan-signal/35 hover:text-white"
                  )}
                >
                  <Icon size={16} />
                  {view.label}
                </button>
              );
            })}
          </nav>

          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            <Snapshot label="Simulated window" value={`${formatNumber(result.travelTimeYears, 1)} / ${mission.maxMissionDurationYears} yr`} />
            <Snapshot label="Max velocity" value={`${formatNumber(result.maxVelocityKps, 1)} km/s`} />
            <Snapshot label="Fuel left" value={`${formatNumber(result.fuelRemainingKg, 0)} kg`} />
            <Snapshot label="Mission score" value={formatNumber(result.optimizationScore, 1)} />
          </div>
        </header>

        <section className="grid min-w-0 gap-4 2xl:grid-cols-[minmax(0,0.86fr)_minmax(0,1.14fr)]">
          <div className="flex min-w-0 flex-col gap-4">
            {selectedView === "builder" ? (
              <MissionBuilder />
            ) : selectedView === "compare" ? (
              <MissionComparison runs={recentRuns} />
            ) : selectedView === "education" ? (
              <EducationalPanel mission={mission} result={result} />
            ) : (
              <>
                <MissionDashboard mission={mission} result={result} />
                <AiMissionPlanner recommendations={recommendations} />
              </>
            )}

            {!isDashboardView && <MissionDashboard mission={mission} result={result} />}

            <details className="panel group p-4" open={isDashboardView}>
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-medium text-white">
                Advanced mission tools
                <ChevronDown size={16} className="text-cyan-soft transition group-open:rotate-180" />
              </summary>
              <div className="mt-4 grid gap-4">
                <OptimizationPanel
                  runs={optimizationRuns}
                  isOptimizing={isOptimizing}
                  seedSummary={seedSummary}
                  error={optimizationError}
                  onRunSeeds={handleRunSeeds}
                />
                <ExportPanel mission={mission} result={result} />
              </div>
            </details>
          </div>

          <aside className="flex min-w-0 flex-col gap-4">
            <div className="panel overflow-hidden p-0">
              <SolarSystemScene mission={mission} result={result} />
            </div>
            <div className="panel p-4">
              <h2 className="text-base font-semibold text-white">Telemetry & Trends</h2>
              <p className="mb-4 text-sm text-slate-300">Time-series mission behavior and optimizer convergence.</p>
              <ChartsPanel result={result} runs={optimizationRuns} />
            </div>
          </aside>
        </section>
      </div>
    </main>
  );
}

function Snapshot({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-white/10 bg-white/[0.04] px-3 py-2">
      <p className="text-[11px] uppercase tracking-[0.12em] text-slate-400">{label}</p>
      <p className="mt-1 text-sm font-semibold text-white">{value}</p>
    </div>
  );
}
