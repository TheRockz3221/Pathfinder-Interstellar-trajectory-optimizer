"use client";

import dynamic from "next/dynamic";
import { useMemo } from "react";
import { motion } from "framer-motion";
import { BarChart3, BookOpen, GitCompare, Orbit, RotateCcw, Satellite } from "lucide-react";
import { generateMissionRecommendations } from "@/lib/ai/recommendations";
import { runOptimizationPreview } from "@/lib/optimization/optimizer";
import { runTrajectorySimulation } from "@/lib/physics/simulation";
import { useMissionStore } from "@/lib/state/mission-store";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { AiMissionPlanner } from "@/components/AiMissionPlanner";
import { AuthPanel } from "@/components/AuthPanel";
import { ChartsPanel } from "@/components/ChartsPanel";
import { EducationalPanel } from "@/components/EducationalPanel";
import { ExportPanel } from "@/components/ExportPanel";
import { MissionBuilder } from "@/components/MissionBuilder";
import { MissionComparison } from "@/components/MissionComparison";
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
  const optimizationRuns = useMemo(() => runOptimizationPreview(mission), [mission]);
  const recommendations = useMemo(() => generateMissionRecommendations(mission, result), [mission, result]);

  return (
    <main className="min-h-screen px-4 py-4 sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-[1720px] flex-col gap-4">
        <header className="glass flex flex-col gap-4 rounded-lg px-4 py-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-md border border-cyan-signal/25 bg-cyan-signal/10 text-cyan-signal shadow-glow">
              <Satellite size={22} />
            </div>
            <div>
              <h1 className="text-xl font-semibold tracking-normal text-white sm:text-2xl">Interstellar Trajectory Optimizer</h1>
              <p className="text-sm text-slate-300">{mission.missionName} / {mission.destination} / {mission.propulsionType}</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {views.map((view) => {
              const Icon = view.icon;
              return (
                <button
                  key={view.id}
                  onClick={() => setView(view.id)}
                  className={cn(
                    "inline-flex h-10 items-center gap-2 rounded-md border px-3 text-sm transition",
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
            <button
              onClick={resetMission}
              className="inline-flex h-10 items-center gap-2 rounded-md border border-gold-mission/30 bg-gold-mission/10 px-3 text-sm text-gold-mission transition hover:bg-gold-mission/15"
            >
              <RotateCcw size={16} />
              Reset
            </button>
          </div>
        </header>

        <section className="grid gap-4 xl:grid-cols-[minmax(360px,0.82fr)_minmax(640px,1.18fr)]">
          <motion.div layout className="flex flex-col gap-4">
            {selectedView === "builder" ? (
              <MissionBuilder />
            ) : selectedView === "compare" ? (
              <MissionComparison mission={mission} />
            ) : selectedView === "education" ? (
              <EducationalPanel mission={mission} result={result} />
            ) : (
              <>
                <MissionDashboard mission={mission} result={result} />
                <AiMissionPlanner recommendations={recommendations} />
              </>
            )}
            <OptimizationPanel runs={optimizationRuns} />
            <ExportPanel mission={mission} result={result} />
            <AuthPanel />
            <div className="glass rounded-lg p-4 text-xs text-slate-400">
              Supabase: {isSupabaseConfigured ? "connected from environment" : "waiting for .env.local credentials"}.
              Realtime mission progress channels are schema-ready.
            </div>
          </motion.div>

          <div className="flex min-w-0 flex-col gap-4">
            <div className="glass overflow-hidden rounded-lg">
              <SolarSystemScene mission={mission} result={result} />
            </div>
            <ChartsPanel result={result} runs={optimizationRuns} />
          </div>
        </section>
      </div>
    </main>
  );
}
