"use client";

import { BookOpenCheck } from "lucide-react";
import { escapeVelocity, gravityAssistVelocityGain, rocketEquationDeltaV } from "@/lib/physics/orbital";
import { cassiniEarthFlybyValidation } from "@/lib/physics/cassini-validation";
import { DIFFERENTIAL_EVOLUTION_SETTINGS } from "@/lib/optimization/optimizer";
import { propulsionModels } from "@/lib/constants/propulsion";
import type { MissionConfig, TrajectoryResult } from "@/lib/types";
import { formatNumber } from "@/lib/utils";

export function EducationalPanel({ mission, result }: { mission: MissionConfig; result: TrajectoryResult }) {
  const propulsionModel = propulsionModels[mission.propulsionType];
  const specificImpulseS = mission.propulsionSettings.specificImpulseS ?? propulsionModel.specificImpulseS;
  const exhaustVelocityMps = specificImpulseS * 9.80665;
  const rocketDv = rocketEquationDeltaV(
    mission.propulsionType,
    mission.payloadMassKg,
    mission.fuelMassKg,
    specificImpulseS
  );
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
      equation:
        "Score = 100 × (wtravel·P + wfuel·F + wsafety·S + wΔv·D) / Σw; P=clamp((initial range−final range)/initial range,0,1); F=clamp(fuel left/fuel total,0,1); S=clamp(1−0.035·Nplanned assists,0,1); D=clamp(1−Δv used/Δv budget,0,1), Δv budget=Isp·g0·ln((payload+fuel)/payload).",
      body: `The current weighted objective scores ${formatNumber(result.optimizationScore, 2)}. Travel is measured as destination-range progress over the simulated window; it does not award points simply for reaching the 90-year limit.`
    },
    {
      title: "Propulsion Performance",
      equation: `Isp = ${formatNumber(specificImpulseS, 0)} s · ve = Isp × g0 = ${formatNumber(exhaustVelocityMps, 1)} m/s`,
      body: `The simulator uses ${formatNumber(specificImpulseS, 0)} s specific impulse in the rocket equation for ${mission.propulsionType}. The displayed effective exhaust velocity is derived from that Isp using g0 = 9.80665 m/s².`
    },
    {
      title: "Differential Evolution Settings",
      equation: `population ${DIFFERENTIAL_EVOLUTION_SETTINGS.populationSize} · mutation ${DIFFERENTIAL_EVOLUTION_SETTINGS.mutation} · crossover ${DIFFERENTIAL_EVOLUTION_SETTINGS.crossover}`,
      body: `Bounds: initial velocity ${formatNumber(DIFFERENTIAL_EVOLUTION_SETTINGS.bounds.initialVelocityMps.min / 1_000, 0)}–${formatNumber(DIFFERENTIAL_EVOLUTION_SETTINGS.bounds.initialVelocityMps.max / 1_000, 0)} km/s; max acceleration ${DIFFERENTIAL_EVOLUTION_SETTINGS.bounds.maxAccelerationMps2.min}–${DIFFERENTIAL_EVOLUTION_SETTINGS.bounds.maxAccelerationMps2.max} m/s². Stop after ${DIFFERENTIAL_EVOLUTION_SETTINGS.maxGenerations} generations, or after at least ${DIFFERENTIAL_EVOLUTION_SETTINGS.minimumGenerations} generations when best-score improvement stays within ${DIFFERENTIAL_EVOLUTION_SETTINGS.scoreTolerance} for ${DIFFERENTIAL_EVOLUTION_SETTINGS.stableGenerations} consecutive generations.`
    }
  ];

  return (
    <section className="panel min-w-0 p-4">
      <div className="mb-4 flex items-center gap-2">
        <BookOpenCheck size={18} className="text-cyan-signal" />
        <h2 className="text-base font-semibold text-white">Educational Mode</h2>
      </div>
      <div className="space-y-3">
        {cards.map((card) => (
          <article key={card.title} className="min-w-0 rounded-md border border-white/10 bg-white/[0.035] p-4">
            <h3 className="text-sm font-semibold text-white">{card.title}</h3>
            <p className="mt-2 break-words font-mono text-sm leading-6 text-gold-mission">{card.equation}</p>
            <p className="mt-2 text-sm leading-6 text-slate-300">{card.body}</p>
            {card.title === "Mission Performance" && (
              <p className="mt-2 text-xs leading-5 text-slate-400">
                Current weights: travel progress {mission.objectiveWeights.travelTime}%, fuel {mission.objectiveWeights.fuel}%, safety {mission.objectiveWeights.safety}%, delta-v {mission.objectiveWeights.deltaV}%.
              </p>
            )}
          </article>
        ))}
        <article className="min-w-0 rounded-md border border-cyan-signal/20 bg-white/[0.035] p-4">
          <h3 className="text-sm font-semibold text-white">Cassini Earth Flyby Validation</h3>
          <p className="mt-2 text-sm leading-6 text-slate-300">
            {cassiniEarthFlybyValidation.date}: NASA reports a 1,186 km periapsis altitude. JPL Horizons reconstructed
            geocentric states give an energy-corrected approach v∞ of {formatNumber(cassiniEarthFlybyValidation.approachVInfinityMps / 1_000, 3)} km/s.
          </p>
          <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-3">
            <div><dt className="text-slate-400">Ephemeris vector Δv</dt><dd className="text-white">{formatNumber(cassiniEarthFlybyValidation.ephemerisDeltaVMps / 1_000, 3)} km/s</dd></div>
            <div><dt className="text-slate-400">Patched-conic Δv</dt><dd className="text-white">{formatNumber(cassiniEarthFlybyValidation.simulatedDeltaVMps / 1_000, 3)} km/s</dd></div>
            <div><dt className="text-slate-400">Difference</dt><dd className="text-white">{formatNumber(cassiniEarthFlybyValidation.percentDifference, 3)}%</dd></div>
          </dl>
          <p className="mt-2 text-xs leading-5 text-slate-400">
            Δv compares the relative-velocity vector change, not heliocentric scalar-speed gain. v∞ is derived from the JPL Horizons Earth-relative states at 1999-08-17 12:00 and 1999-08-19 12:00 TDB.
          </p>
          <div className="mt-2 flex flex-wrap gap-3 text-xs text-cyan-soft">
            <a href={cassiniEarthFlybyValidation.sourceLinks.altitude} target="_blank" rel="noreferrer" className="underline">NASA NTRS flyby altitude</a>
            <a href={cassiniEarthFlybyValidation.sourceLinks.ephemeris} target="_blank" rel="noreferrer" className="underline">NASA/JPL Horizons ephemeris</a>
          </div>
        </article>
      </div>
    </section>
  );
}
