import type { MissionConfig, TrajectoryResult } from "@/lib/types";
import { magnitude, rocketEquationDeltaV } from "@/lib/physics/orbital";

export function exportMissionJson(mission: MissionConfig, result: TrajectoryResult) {
  return JSON.stringify({ mission, result, exportedAt: new Date().toISOString() }, null, 2);
}

export function exportSimulationCsv(mission: MissionConfig, result: TrajectoryResult) {
  const totalDeltaVMps = rocketEquationDeltaV(
    mission.propulsionType,
    mission.payloadMassKg,
    mission.fuelMassKg,
    mission.propulsionSettings.specificImpulseS
  );
  const header = [
    "time_seconds",
    "heliocentric_distance_m",
    "speed_mps",
    "delta_v_remaining_mps",
    "fuel_remaining_kg"
  ];
  const rows = result.simulationData.map((step) =>
    [
      step.elapsedSeconds,
      step.distanceFromSunM,
      magnitude(step.velocity),
      Math.max(0, totalDeltaVMps - step.deltaVMps),
      step.fuelRemainingKg
    ].join(",")
  );
  return [header.join(","), ...rows].join("\n");
}

export function downloadTextFile(filename: string, contents: string, mimeType: string) {
  const blob = new Blob([contents], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.style.display = "none";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}
