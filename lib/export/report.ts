import type { MissionConfig, TrajectoryResult } from "@/lib/types";

export function exportMissionJson(mission: MissionConfig, result: TrajectoryResult) {
  return JSON.stringify({ mission, result, exportedAt: new Date().toISOString() }, null, 2);
}

export function exportSimulationCsv(result: TrajectoryResult) {
  const header = [
    "timestep",
    "elapsed_seconds",
    "position_x_m",
    "position_y_m",
    "position_z_m",
    "velocity_x_mps",
    "velocity_y_mps",
    "velocity_z_mps",
    "acceleration_x_mps2",
    "acceleration_y_mps2",
    "acceleration_z_mps2",
    "fuel_remaining_kg",
    "delta_v_mps"
  ];
  const rows = result.simulationData.map((step) =>
    [
      step.timestep,
      step.elapsedSeconds,
      step.position.x,
      step.position.y,
      step.position.z,
      step.velocity.x,
      step.velocity.y,
      step.velocity.z,
      step.acceleration.x,
      step.acceleration.y,
      step.acceleration.z,
      step.fuelRemainingKg,
      step.deltaVMps
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
  anchor.click();
  URL.revokeObjectURL(url);
}
