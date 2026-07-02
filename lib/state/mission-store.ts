"use client";

import { create } from "zustand";
import type { MissionConfig } from "@/lib/types";

export const defaultMission: MissionConfig = {
  id: "mission-alpha-centauri-fusion",
  missionName: "Alpha Centauri Fusion Probe",
  launchBody: "Earth",
  destination: "Alpha Centauri",
  launchDate: "2048-07-16",
  propulsionType: "Fusion Rocket",
  payloadMassKg: 1_200,
  fuelMassKg: 8_500,
  initialVelocityMps: 42_000,
  maxAccelerationMps2: 0.18,
  maxMissionDurationYears: 90,
  optimizationMethod: "Differential Evolution",
  integrator: "RK4",
  gravityAssists: [
    { planetName: "Venus", flybyOrder: 1, closestApproachKm: 62_000 },
    { planetName: "Earth", flybyOrder: 2, closestApproachKm: 24_000 },
    { planetName: "Jupiter", flybyOrder: 3, closestApproachKm: 540_000 }
  ],
  objectiveWeights: {
    travelTime: 70,
    fuel: 15,
    safety: 10,
    deltaV: 5
  },
  propulsionSettings: {
    reactorEfficiency: 0.42,
    exhaustVelocityMps: 176_580,
    powerOutputW: 3.2e9,
    reactionMassKg: 8_500,
    sailAreaM2: 90_000,
    reflectivity: 0.88,
    materialDensityKgM2: 0.006
  }
};

type MissionStore = {
  mission: MissionConfig;
  selectedView: "dashboard" | "builder" | "compare" | "education";
  setView: (view: MissionStore["selectedView"]) => void;
  updateMission: (patch: Partial<MissionConfig>) => void;
  resetMission: () => void;
};

export const useMissionStore = create<MissionStore>((set) => ({
  mission: defaultMission,
  selectedView: "dashboard",
  setView: (view) => set({ selectedView: view }),
  updateMission: (patch) =>
    set((state) => ({
      mission: {
        ...state.mission,
        ...patch,
        objectiveWeights: patch.objectiveWeights
          ? { ...state.mission.objectiveWeights, ...patch.objectiveWeights }
          : state.mission.objectiveWeights,
        propulsionSettings: patch.propulsionSettings
          ? { ...state.mission.propulsionSettings, ...patch.propulsionSettings }
          : state.mission.propulsionSettings
      }
    })),
  resetMission: () => set({ mission: defaultMission })
}));
