"use client";

import { BrainCircuit } from "lucide-react";
import type { AiRecommendation } from "@/lib/types";

export function AiMissionPlanner({ recommendations }: { recommendations: AiRecommendation[] }) {
  return (
    <section className="panel p-4">
      <div className="mb-4 flex items-center gap-2">
        <BrainCircuit size={17} className="text-gold-mission" />
        <h2 className="text-base font-semibold text-white">AI Mission Planner</h2>
      </div>
      {recommendations.length === 0 ? (
        <div className="rounded-md border border-white/10 bg-white/[0.035] p-4 text-sm leading-6 text-slate-300">
          No recommendations yet. Adjust your mission settings to discover optimization opportunities.
        </div>
      ) : (
        <div className="space-y-3">
          {recommendations.map((recommendation) => (
            <article key={recommendation.title} className="min-w-0 rounded-md border border-white/10 bg-white/[0.035] p-4">
              <div className="flex items-start justify-between gap-3">
                <h3 className="min-w-0 text-sm font-semibold leading-5 text-white">{recommendation.title}</h3>
                <span className="shrink-0 rounded border border-gold-mission/25 bg-gold-mission/10 px-2 py-1 text-xs text-gold-mission">
                  {Math.round(recommendation.confidence * 100)}%
                </span>
              </div>
              <p className="mt-2 break-words text-sm font-medium text-cyan-soft">{recommendation.impact}</p>
              <p className="mt-2 text-sm leading-6 text-slate-300">{recommendation.explanation}</p>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
