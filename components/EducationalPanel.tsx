"use client";

import { BookOpenCheck } from "lucide-react";
import { escapeVelocity, gravityAssistVelocityGain, rocketEquationDeltaV } from "@/lib/physics/orbital";
import type { MissionConfig, TrajectoryResult } from "@/lib/types";
import { formatNumber } from "@/lib/utils";

export function EducationalPanel({ mission, result }: { mission: MissionConfig; result: TrajectoryResult }) {
  const rocketDv = rocketEquationDeltaV(mission.propulsionType, mission.payloadMassKg, mission.fuelMassKg);
  const escape = escapeVelocity(mission.launchBody);
  const assist = mission.gravityAssists[0]
    ? gravityAssistVelocityGain(mission.gravityAssists[0].planetName, mission.gravityAssists[0].closestApproachKm, mission.initialVelocityMps)
    : null;

  const cards = [
    {
      title: "Newtonian Gravity",
      equation: "a = GM / r^2",
      body: "Acceleration grows with central-body mass and falls with the square of distance. The simulator sums this contribution from the Sun and major planets at every timestep."
    },
    {
      title: "Tsiolkovsky Rocket Equation",
      equation: "Delta-v = Isp g0 ln(m0 / mf)",
      body: `${mission.propulsionType} provides an ideal delta-v budget near ${formatNumber(rocketDv / 1_000, 2)} km/s for the current mass ratio.`
    },
    {
      title: "Escape Velocity",
      equation: "vesc = sqrt(2GM / r)",
      body: `${mission.launchBody} escape velocity at the reference radius is ${formatNumber(escape / 1_000, 2)} km/s before launch-site and parking-orbit details.`
    },
    {
      title: "Gravity Assist",
      equation: "turn angle = 2 asin(1 / (1 + rp vinf^2 / mu))",
      body: assist
        ? `The first planned flyby can rotate the excess velocity by about ${formatNumber(assist.turningAngleDeg, 1)} degrees in this simplified patched-conics estimate.`
        : "A flyby trades geometry and timing for heliocentric energy without spending onboard propellant."
    },
    {
      title: "Mission Performance",
      equation: "score = weighted(time, fuel, safety, delta-v)",
      body: `The current weighted objective scores ${formatNumber(result.optimizationScore, 1)} using the configured mission priorities.`
    }
  ];

  return (
    <section className="glass rounded-lg p-4">
      <div className="mb-4 flex items-center gap-2">
        <BookOpenCheck size={18} className="text-cyan-signal" />
        <h2 className="text-base font-semibold text-white">Educational Mode</h2>
      </div>
      <div className="space-y-3">
        {cards.map((card) => (
          <article key={card.title} className="rounded-md border border-white/10 bg-white/[0.035] p-3">
            <h3 className="text-sm font-semibold text-white">{card.title}</h3>
            <p className="mt-2 font-mono text-sm text-gold-mission">{card.equation}</p>
            <p className="mt-2 text-sm leading-6 text-slate-300">{card.body}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
