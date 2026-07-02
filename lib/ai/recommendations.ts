import { AU_M } from "@/lib/constants/celestial-bodies";
import { propulsionModels } from "@/lib/constants/propulsion";
import type { AiRecommendation, MissionConfig, TrajectoryResult } from "@/lib/types";

export function generateMissionRecommendations(mission: MissionConfig, result: TrajectoryResult): AiRecommendation[] {
  const recs: AiRecommendation[] = [];
  const model = propulsionModels[mission.propulsionType];

  if (!mission.gravityAssists.some((assist) => assist.planetName === "Jupiter") && mission.destination !== "Mars") {
    recs.push({
      title: "Evaluate a Jupiter gravity assist",
      impact: "Potential travel-time reduction: 12-22%",
      explanation:
        "Jupiter's high mass and orbital velocity can rotate the outbound asymptote and increase heliocentric energy. The benefit is strongest for Saturn, Uranus, Neptune, and interstellar escape trajectories.",
      confidence: 0.84
    });
  }

  if (mission.propulsionType === "Solar Sail") {
    const farSteps = result.simulationData.filter((step) => step.distanceFromSunM > 8 * AU_M).length;
    recs.push({
      title: "Plan sail operations before 8 AU",
      impact: farSteps > 0 ? "Thrust authority drops sharply in late cruise" : "Current profile stays inside useful sail range",
      explanation:
        "Solar radiation pressure follows an inverse-square falloff, so sail acceleration beyond the outer solar system becomes very small without laser beaming or a close solar perihelion.",
      confidence: 0.9
    });
  }

  if (mission.propulsionType !== "Fusion Rocket" && mission.destination.includes("Centauri")) {
    recs.push({
      title: "Compare against fusion propulsion",
      impact: "Estimated fuel reduction: 25-40%",
      explanation:
        "The selected destination is interstellar, where high exhaust velocity matters more than launch thrust. Fusion-class propulsion improves cruise efficiency and keeps delta-v margins healthier.",
      confidence: 0.79
    });
  }

  if (mission.payloadMassKg > mission.fuelMassKg && mission.propulsionType !== "Solar Sail") {
    recs.push({
      title: "Increase propellant fraction or lower payload mass",
      impact: "Delta-v margin is mass-ratio limited",
      explanation:
        "The rocket equation is logarithmic: when dry mass dominates, adding a small amount of fuel produces only a modest delta-v increase. Payload trades may be more valuable than larger tanks.",
      confidence: 0.76
    });
  }

  if (model.accelerationLimitMps2 < 0.01 && mission.maxMissionDurationYears < 5) {
    recs.push({
      title: "Extend the mission duration for low-thrust propulsion",
      impact: "Improves optimizer feasibility",
      explanation:
        "Electric propulsion accumulates velocity over long arcs. Short mission-duration constraints force it to behave like an impulsive transfer, which is physically mismatched.",
      confidence: 0.81
    });
  }

  return recs.slice(0, 4);
}
