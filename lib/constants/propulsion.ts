import type { PropulsionType } from "@/lib/types";

export type PropulsionModel = {
  type: PropulsionType;
  specificImpulseS: number;
  nominalThrustN: number;
  exhaustVelocityMps: number;
  fuelEfficiency: number;
  accelerationLimitMps2: number;
  description: string;
};

export const propulsionModels: Record<PropulsionType, PropulsionModel> = {
  "Chemical Rocket": {
    type: "Chemical Rocket",
    specificImpulseS: 450,
    nominalThrustN: 3.5e6,
    exhaustVelocityMps: 4_410,
    fuelEfficiency: 0.42,
    accelerationLimitMps2: 29,
    description: "High thrust, low specific impulse, best for impulsive departure burns."
  },
  "Nuclear Thermal Rocket": {
    type: "Nuclear Thermal Rocket",
    specificImpulseS: 900,
    nominalThrustN: 900_000,
    exhaustVelocityMps: 8_829,
    fuelEfficiency: 0.62,
    accelerationLimitMps2: 14,
    description: "Hydrogen propellant heated by a reactor for roughly double chemical ISP."
  },
  "Nuclear Electric Propulsion": {
    type: "Nuclear Electric Propulsion",
    specificImpulseS: 4_500,
    nominalThrustN: 25,
    exhaustVelocityMps: 44_145,
    fuelEfficiency: 0.86,
    accelerationLimitMps2: 0.004,
    description: "Continuous low thrust and very high specific impulse for efficient cruise."
  },
  "Fusion Rocket": {
    type: "Fusion Rocket",
    specificImpulseS: 18_000,
    nominalThrustN: 8_000,
    exhaustVelocityMps: 176_580,
    fuelEfficiency: 0.93,
    accelerationLimitMps2: 0.25,
    description: "Advanced high-energy propulsion with strong interstellar performance."
  },
  "Antimatter Engine": {
    type: "Antimatter Engine",
    specificImpulseS: 100_000,
    nominalThrustN: 120_000,
    exhaustVelocityMps: 980_665,
    fuelEfficiency: 0.985,
    accelerationLimitMps2: 2.5,
    description: "Extremely high energy density with very low reaction mass assumptions."
  },
  "Solar Sail": {
    type: "Solar Sail",
    specificImpulseS: Number.POSITIVE_INFINITY,
    nominalThrustN: 0.8,
    exhaustVelocityMps: Number.POSITIVE_INFINITY,
    fuelEfficiency: 1,
    accelerationLimitMps2: 0.001,
    description: "Photon pressure propulsion that fades with inverse-square solar distance."
  }
};
