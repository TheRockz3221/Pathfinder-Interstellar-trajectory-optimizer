import type { CelestialBodyName, Vector3 } from "@/lib/types";

export const G = 6.6743e-11;
export const AU_M = 149_597_870_700;
export const DAY_S = 86_400;
export const YEAR_S = 365.25 * DAY_S;
export const SOLAR_LUMINOSITY_W = 3.828e26;
export const SPEED_OF_LIGHT_MPS = 299_792_458;

export type CelestialBody = {
  name: CelestialBodyName;
  massKg: number;
  radiusKm: number;
  semiMajorAxisAu: number;
  orbitalPeriodDays: number;
  color: string;
  initialPhaseRad: number;
  positionAtEpoch: Vector3;
};

export const celestialBodies: Record<CelestialBodyName, CelestialBody> = {
  Sun: {
    name: "Sun",
    massKg: 1.98847e30,
    radiusKm: 695_700,
    semiMajorAxisAu: 0,
    orbitalPeriodDays: 0,
    color: "#f7c948",
    initialPhaseRad: 0,
    positionAtEpoch: { x: 0, y: 0, z: 0 }
  },
  Mercury: body("Mercury", 3.3011e23, 2_439.7, 0.387, 87.969, "#b7a99a", 0.6),
  Venus: body("Venus", 4.8675e24, 6_051.8, 0.723, 224.701, "#d8b16f", 1.2),
  Earth: body("Earth", 5.97237e24, 6_371, 1, 365.256, "#45a3ff", 1.9),
  Moon: body("Moon", 7.342e22, 1_737.4, 1.00257, 27.322, "#d4d7df", 2.15),
  Mars: body("Mars", 6.4171e23, 3_389.5, 1.524, 686.98, "#e46f47", 2.7),
  Jupiter: body("Jupiter", 1.8982e27, 69_911, 5.204, 4_332.59, "#d7b38a", 3.4),
  Saturn: body("Saturn", 5.6834e26, 58_232, 9.582, 10_759.22, "#e5c889", 4.1),
  Uranus: body("Uranus", 8.681e25, 25_362, 19.201, 30_688.5, "#85eff2", 4.9),
  Neptune: body("Neptune", 1.02413e26, 24_622, 30.047, 60_182, "#4978ff", 5.5),
  Pluto: body("Pluto", 1.303e22, 1_188.3, 39.482, 90_560, "#c9b6a1", 0.2),
  "Alpha Centauri": star("Alpha Centauri", 4.367, "#f7df8a"),
  "Proxima Centauri": star("Proxima Centauri", 4.2465, "#ff9d7a"),
  "Barnard's Star": star("Barnard's Star", 5.963, "#f0a07a")
};

function body(
  name: CelestialBodyName,
  massKg: number,
  radiusKm: number,
  semiMajorAxisAu: number,
  orbitalPeriodDays: number,
  color: string,
  initialPhaseRad: number
): CelestialBody {
  return {
    name,
    massKg,
    radiusKm,
    semiMajorAxisAu,
    orbitalPeriodDays,
    color,
    initialPhaseRad,
    positionAtEpoch: {
      x: Math.cos(initialPhaseRad) * semiMajorAxisAu * AU_M,
      y: Math.sin(initialPhaseRad) * semiMajorAxisAu * AU_M,
      z: 0
    }
  };
}

function star(name: CelestialBodyName, lightYears: number, color: string): CelestialBody {
  const meters = lightYears * 63_241.077 * AU_M;
  return {
    name,
    massKg: 2.0e30,
    radiusKm: 100_000,
    semiMajorAxisAu: meters / AU_M,
    orbitalPeriodDays: 0,
    color,
    initialPhaseRad: 0,
    positionAtEpoch: { x: meters, y: 0, z: 0 }
  };
}

export const missionDestinations = [
  "Mars",
  "Jupiter",
  "Saturn",
  "Uranus",
  "Neptune",
  "Alpha Centauri",
  "Proxima Centauri",
  "Barnard's Star"
] satisfies CelestialBodyName[];

export const launchBodies = ["Earth", "Moon", "Mars"] satisfies CelestialBodyName[];
