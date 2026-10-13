"use client";

import type { ReactNode } from "react";
import { Plus, Trash2 } from "lucide-react";
import { launchBodies, missionDestinations } from "@/lib/constants/celestial-bodies";
import { propulsionModels } from "@/lib/constants/propulsion";
import { useMissionStore } from "@/lib/state/mission-store";
import type { CelestialBodyName, IntegratorType, ObjectiveWeights, OptimizationMethod, PropulsionType } from "@/lib/types";

const integrators: IntegratorType[] = ["RK4", "RK45", "Leapfrog", "Verlet"];
const optimizers: OptimizationMethod[] = [
  "Genetic Algorithm",
  "Particle Swarm Optimization",
  "Simulated Annealing",
  "Differential Evolution"
];

export function MissionBuilder() {
  const { mission, updateMission } = useMissionStore();
  const updateWeight = (key: keyof ObjectiveWeights, value: number) => {
    updateMission({ objectiveWeights: { ...mission.objectiveWeights, [key]: value } });
  };

  return (
    <section className="panel min-w-0 p-4">
      <div className="mb-4">
        <h2 className="text-base font-semibold text-white">Mission Builder</h2>
        <p className="text-sm leading-6 text-slate-300">Configure spacecraft, trajectory, propulsion, and objective weighting.</p>
      </div>
      <div className="grid min-w-0 gap-3 sm:grid-cols-2">
        <Field label="Mission name">
          <input value={mission.missionName} onChange={(event) => updateMission({ missionName: event.target.value })} className="field" />
        </Field>
        <Field label="Launch date">
          <input type="date" value={mission.launchDate} onChange={(event) => updateMission({ launchDate: event.target.value })} className="field" />
        </Field>
        <Field label="Launch body">
          <select value={mission.launchBody} onChange={(event) => updateMission({ launchBody: event.target.value as CelestialBodyName })} className="field">
            {launchBodies.map((body) => <option key={body}>{body}</option>)}
          </select>
        </Field>
        <Field label="Destination">
          <select value={mission.destination} onChange={(event) => updateMission({ destination: event.target.value as CelestialBodyName })} className="field">
            {missionDestinations.map((body) => <option key={body}>{body}</option>)}
          </select>
        </Field>
        <Field label="Propulsion">
          <select value={mission.propulsionType} onChange={(event) => updateMission({ propulsionType: event.target.value as PropulsionType })} className="field">
            {Object.keys(propulsionModels).map((type) => <option key={type}>{type}</option>)}
          </select>
        </Field>
        <Field label="Integrator">
          <select value={mission.integrator} onChange={(event) => updateMission({ integrator: event.target.value as IntegratorType })} className="field">
            {integrators.map((type) => <option key={type}>{type}</option>)}
          </select>
        </Field>
        <NumberField label="Payload mass kg" value={mission.payloadMassKg} onChange={(payloadMassKg) => updateMission({ payloadMassKg })} />
        <NumberField label="Fuel mass kg" value={mission.fuelMassKg} onChange={(fuelMassKg) => updateMission({ fuelMassKg })} />
        <NumberField label="Initial heliocentric speed (m/s)" value={mission.initialVelocityMps} onChange={(initialVelocityMps) => updateMission({ initialVelocityMps })} />
        <NumberField label="Max acceleration m/s2" value={mission.maxAccelerationMps2} step={0.01} onChange={(maxAccelerationMps2) => updateMission({ maxAccelerationMps2 })} />
        <NumberField label="Max duration years" value={mission.maxMissionDurationYears} onChange={(maxMissionDurationYears) => updateMission({ maxMissionDurationYears })} />
        <Field label="Optimizer">
          <select value={mission.optimizationMethod} onChange={(event) => updateMission({ optimizationMethod: event.target.value as OptimizationMethod })} className="field">
            {optimizers.map((type) => <option key={type}>{type}</option>)}
          </select>
        </Field>
      </div>

      <div className="mt-5 grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Object.entries(mission.objectiveWeights).map(([key, value]) => (
          <Field key={key} label={key === "travelTime" ? "Travel progress" : key.replace(/([A-Z])/g, " $1")}>
            <input
              type="range"
              min="0"
              max="100"
              value={value}
              onChange={(event) => updateWeight(key as keyof ObjectiveWeights, Number(event.target.value))}
              className="w-full accent-cyan-signal"
            />
            <span className="text-xs text-slate-300">{value}%</span>
          </Field>
        ))}
      </div>

      <div className="mt-5">
        <div className="mb-2 flex items-center justify-between gap-3">
          <h3 className="text-sm font-semibold text-white">Gravity Assist Sequence</h3>
          <button
            onClick={() =>
              updateMission({
                gravityAssists: [
                  ...mission.gravityAssists,
                  { planetName: "Jupiter", flybyOrder: mission.gravityAssists.length + 1, closestApproachKm: 500_000 }
                ]
              })
            }
            className="inline-flex h-9 items-center gap-2 rounded-md border border-cyan-signal/30 bg-cyan-signal/10 px-3 text-sm text-cyan-soft"
          >
            <Plus size={15} />
            Add
          </button>
        </div>
        <label className="mb-1 flex items-center gap-2 text-sm text-slate-300">
          <input
            type="checkbox"
            checked={mission.applyGravityAssists}
            onChange={(event) => updateMission({ applyGravityAssists: event.target.checked })}
            className="accent-cyan-signal"
          />
          Apply assists
        </label>
        <p className="mb-3 text-xs leading-5 text-slate-400">
          Unchecked removes listed bodies from the gravity model; checked includes them.
        </p>
        <p className="mb-2 text-xs text-slate-400">Periapsis altitude (km)</p>
        <div className="space-y-2">
          {mission.gravityAssists.map((assist, index) => (
            <div key={`${assist.flybyOrder}-${index}`} className="grid min-w-0 grid-cols-[minmax(0,1fr)_minmax(0,120px)_38px] gap-2">
              <select
                value={assist.planetName}
                onChange={(event) => {
                  const next = [...mission.gravityAssists];
                  next[index] = { ...assist, planetName: event.target.value as CelestialBodyName };
                  updateMission({ gravityAssists: next });
                }}
                className="field"
              >
                {["Venus", "Earth", "Mars", "Jupiter", "Saturn", "Uranus", "Neptune"].map((body) => <option key={body}>{body}</option>)}
              </select>
              <input
                type="number"
                value={assist.closestApproachKm}
                aria-label={`Periapsis altitude (km) for ${assist.planetName}`}
                onChange={(event) => {
                  const next = [...mission.gravityAssists];
                  next[index] = { ...assist, closestApproachKm: Number(event.target.value) };
                  updateMission({ gravityAssists: next });
                }}
                className="field"
              />
              <button
                aria-label="Remove gravity assist"
                onClick={() => updateMission({ gravityAssists: mission.gravityAssists.filter((_, itemIndex) => itemIndex !== index) })}
                className="inline-flex h-10 items-center justify-center rounded-md border border-plasma/30 bg-plasma/10 text-plasma"
              >
                <Trash2 size={15} />
              </button>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="min-w-0 space-y-1 text-sm">
      <span className="block text-xs uppercase tracking-[0.12em] text-slate-400">{label}</span>
      {children}
    </label>
  );
}

function NumberField({ label, value, onChange, step = 1 }: { label: string; value: number; onChange: (value: number) => void; step?: number }) {
  return (
    <Field label={label}>
      <input type="number" value={value} step={step} onChange={(event) => onChange(Number(event.target.value))} className="field" />
    </Field>
  );
}
