"use client";

import { BrainCircuit } from "lucide-react";
import type { AiRecommendation } from "@/lib/types";

export function AiMissionPlanner({ recommendations }: { recommendations: AiRecommendation[] }) {
  return (
    <section className="glass rounded-lg p-4">
      <div className="mb-3 flex items-center gap-2">
        <BrainCircuit size={17} className="text-gold-mission" />
        <h2 className="text-base font-semibold text-white">AI Mission Planner</h2>
      </div>
      <div className="space-y-3">
        {recommendations.map((recommendation) => (
          <article key={recommendation.title} className="rounded-md border border-white/10 bg-white/[0.035] p-3">
            <div className="flex items-start justify-between gap-3">
              <h3 className="text-sm font-semibold text-white">{recommendation.title}</h3>
              <span className="rounded border border-gold-mission/25 bg-gold-mission/10 px-2 py-1 text-xs text-gold-mission">
                {Math.round(recommendation.confidence * 100)}%
              </span>
            </div>
            <p className="mt-1 text-sm text-cyan-soft">{recommendation.impact}</p>
            <p className="mt-2 text-sm leading-6 text-slate-300">{recommendation.explanation}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
