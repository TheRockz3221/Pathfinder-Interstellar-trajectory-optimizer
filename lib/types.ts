export type Vector3 = {
  x: number;
  y: number;
  z: number;
};

export type CelestialBodyName =
  | "Sun"
  | "Mercury"
  | "Venus"
  | "Earth"
  | "Moon"
  | "Mars"
  | "Jupiter"
  | "Saturn"
  | "Uranus"
  | "Neptune"
  | "Pluto"
  | "Alpha Centauri"
  | "Proxima Centauri"
  | "Barnard's Star";

export type PropulsionType =
  | "Chemical Rocket"
  | "Nuclear Thermal Rocket"
  | "Nuclear Electric Propulsion"
  | "Fusion Rocket"
  | "Antimatter Engine"
  | "Solar Sail";

export type IntegratorType = "RK4" | "RK45" | "Leapfrog" | "Verlet";

export type OptimizationMethod =
  | "Genetic Algorithm"
  | "Particle Swarm Optimization"
  | "Simulated Annealing"
  | "Differential Evolution";

export type ObjectiveWeights = {
  travelTime: number;
  fuel: number;
  safety: number;
  deltaV: number;
};

export type MissionConfig = {
  id: string;
  missionName: string;
  launchBody: CelestialBodyName;
  destination: CelestialBodyName;
  launchDate: string;
  propulsionType: PropulsionType;
  payloadMassKg: number;
  fuelMassKg: number;
  initialVelocityMps: number;
  maxAccelerationMps2: number;
  maxMissionDurationYears: number;
  optimizationMethod: OptimizationMethod;
  integrator: IntegratorType;
  gravityAssists: GravityAssistPlan[];
  applyGravityAssists: boolean;
  objectiveWeights: ObjectiveWeights;
  propulsionSettings: PropulsionSettings;
};

export type PropulsionSettings = {
  specificImpulseS?: number;
  thrustN?: number;
  burnDurationS?: number;
  reactorEfficiency?: number;
  exhaustVelocityMps?: number;
  powerOutputW?: number;
  reactionMassKg?: number;
  sailAreaM2?: number;
  reflectivity?: number;
  materialDensityKgM2?: number;
};

export type GravityAssistPlan = {
  planetName: CelestialBodyName;
  flybyOrder: number;
  closestApproachKm: number;
};

export type SimulationStep = {
  timestep: number;
  elapsedSeconds: number;
  position: Vector3;
  velocity: Vector3;
  acceleration: Vector3;
  distanceFromSunM: number;
  fuelRemainingKg: number;
  deltaVMps: number;
};

export type GravityAssistEvent = {
  planetName: CelestialBodyName;
  flybyOrder: number;
  elapsedSeconds: number;
  closestApproachKm: number;
  detectedDistanceKm: number;
  relativeSpeedMps: number;
  incomingSpeedMps: number;
  velocityGainMps: number;
  outgoingSpeedMps: number;
};

export type TrajectoryResult = {
  travelTimeYears: number;
  totalDistanceAu: number;
  maxVelocityKps: number;
  averageVelocityKps: number;
  deltaVKps: number;
  optimizationScore: number;
  fuelRemainingKg: number;
  simulationData: SimulationStep[];
  gravityAssistEvents: GravityAssistEvent[];
};

export type OptimizationRun = {
  algorithm: OptimizationMethod;
  generation: number;
  score: number;
  travelTimeYears: number;
  deltaVKps: number;
  fuelUsedKg: number;
};

export type AiRecommendation = {
  title: string;
  impact: string;
  explanation: string;
  confidence: number;
};
