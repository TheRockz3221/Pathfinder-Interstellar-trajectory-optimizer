import type { MissionConfig, OptimizationRun } from "@/lib/types";
import { runTrajectorySimulation } from "@/lib/physics/simulation";

export const DIFFERENTIAL_EVOLUTION_SETTINGS = {
  populationSize: 6,
  mutation: 0.8,
  crossover: 0.9,
  maxGenerations: 4,
  minimumGenerations: 2,
  scoreTolerance: 0.01,
  stableGenerations: 2,
  bounds: {
    initialVelocityMps: { min: 20_000, max: 100_000 },
    maxAccelerationMps2: { min: 0.005, max: 0.5 }
  }
} as const;

export type SeedMetrics = {
  seed: number;
  travelTimeYears: number;
  deltaVKps: number;
  score: number;
};

export type SeedMetricRange = {
  mean: number;
  min: number;
  max: number;
};

export type SeedSummary = {
  count: number;
  travelTimeYears: SeedMetricRange;
  deltaVKps: SeedMetricRange;
  score: SeedMetricRange;
};

export type OptimizationSeedBatch = {
  runs: OptimizationRun[];
  seedMetrics: SeedMetrics[];
  summary: SeedSummary;
};

type Candidate = {
  velocityMps: number;
  accelerationMps2: number;
  run: OptimizationRun;
};

export function runOptimizationPreview(mission: MissionConfig, seed = 1): OptimizationRun[] {
  return runDifferentialEvolution(mission, seed);
}

export function runOptimizationSeeds(mission: MissionConfig, count: number): OptimizationSeedBatch {
  if (!Number.isInteger(count) || count < 1 || count > 20) {
    throw new RangeError("Seed count must be an integer from 1 to 20.");
  }
  const seedMetrics: SeedMetrics[] = [];
  let runs: OptimizationRun[] = [];
  for (let index = 0; index < count; index++) {
    const seed = index + 1;
    const seedRuns = runDifferentialEvolution(mission, seed);
    if (index === 0) runs = seedRuns;
    const best = seedRuns.at(-1);
    if (best) {
      seedMetrics.push({
        seed,
        travelTimeYears: best.travelTimeYears,
        deltaVKps: best.deltaVKps,
        score: best.score
      });
    }
  }
  return { runs, seedMetrics, summary: summarizeSeeds(seedMetrics) };
}

function runDifferentialEvolution(mission: MissionConfig, seed: number): OptimizationRun[] {
  const settings = DIFFERENTIAL_EVOLUTION_SETTINGS;
  let randomState = seed >>> 0 || 1;
  const random = () => {
    randomState = (randomState * 1_664_525 + 1_013_904_223) >>> 0;
    return randomState / 0x1_0000_0000;
  };
  const velocityBounds = settings.bounds.initialVelocityMps;
  const accelerationBounds = settings.bounds.maxAccelerationMps2;
  const evaluate = (velocityMps: number, accelerationMps2: number, generation: number): Candidate => {
    const result = runTrajectorySimulation({
      ...mission,
      initialVelocityMps: velocityMps,
      maxAccelerationMps2: accelerationMps2
    }, 120);
    return {
      velocityMps,
      accelerationMps2,
      run: {
        algorithm: "Differential Evolution",
        generation,
        score: result.optimizationScore,
        travelTimeYears: result.travelTimeYears,
        deltaVKps: result.deltaVKps,
        fuelUsedKg: mission.fuelMassKg - result.fuelRemainingKg
      }
    };
  };

  const population = Array.from({ length: settings.populationSize }, () =>
    evaluate(
      velocityBounds.min + random() * (velocityBounds.max - velocityBounds.min),
      accelerationBounds.min + random() * (accelerationBounds.max - accelerationBounds.min),
      0
    )
  );
  const history: OptimizationRun[] = [bestCandidate(population).run];
  let stableGenerations = 0;

  for (let generation = 1; generation <= settings.maxGenerations; generation++) {
    const previousBestScore = bestCandidate(population).run.score;
    for (let index = 0; index < population.length; index++) {
      const indices: number[] = [];
      while (indices.length < 3) {
        const candidateIndex = Math.floor(random() * population.length);
        if (candidateIndex !== index && !indices.includes(candidateIndex)) indices.push(candidateIndex);
      }
      const [a, b, c] = indices.map((candidateIndex) => population[candidateIndex]);
      const mutantVelocity = clamp(
        a.velocityMps + settings.mutation * (b.velocityMps - c.velocityMps),
        velocityBounds.min,
        velocityBounds.max
      );
      const mutantAcceleration = clamp(
        a.accelerationMps2 + settings.mutation * (b.accelerationMps2 - c.accelerationMps2),
        accelerationBounds.min,
        accelerationBounds.max
      );
      const useVelocity = random() < settings.crossover;
      const trial = evaluate(
        useVelocity ? mutantVelocity : population[index].velocityMps,
        !useVelocity || random() < settings.crossover ? mutantAcceleration : population[index].accelerationMps2,
        generation
      );
      if (trial.run.score >= population[index].run.score) population[index] = trial;
    }

    const generationBest = bestCandidate(population).run;
    history.push(generationBest);
    stableGenerations =
      Math.abs(generationBest.score - previousBestScore) <= settings.scoreTolerance ? stableGenerations + 1 : 0;
    if (generation >= settings.minimumGenerations && stableGenerations >= settings.stableGenerations) break;
  }

  return history;
}

function bestCandidate(population: Candidate[]) {
  return population.reduce((best, candidate) => (candidate.run.score > best.run.score ? candidate : best));
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function summarizeSeeds(seedMetrics: SeedMetrics[]): SeedSummary {
  const range = (values: number[]): SeedMetricRange => ({
    mean: values.reduce((sum, value) => sum + value, 0) / values.length,
    min: Math.min(...values),
    max: Math.max(...values)
  });
  return {
    count: seedMetrics.length,
    travelTimeYears: range(seedMetrics.map((metrics) => metrics.travelTimeYears)),
    deltaVKps: range(seedMetrics.map((metrics) => metrics.deltaVKps)),
    score: range(seedMetrics.map((metrics) => metrics.score))
  };
}

export function mutateMissionForComparison(mission: MissionConfig): MissionConfig[] {
  return [
    mission,
    {
      ...mission,
      id: `${mission.id}-fusion`,
      missionName: `${mission.missionName} Fusion Variant`,
      propulsionType: "Fusion Rocket",
      maxAccelerationMps2: Math.max(mission.maxAccelerationMps2, 0.12)
    },
    {
      ...mission,
      id: `${mission.id}-jupiter`,
      missionName: `${mission.missionName} Jupiter Assist`,
      gravityAssists: [
        ...mission.gravityAssists,
        { planetName: "Jupiter", flybyOrder: mission.gravityAssists.length + 1, closestApproachKm: 520_000 }
      ]
    }
  ];
}
