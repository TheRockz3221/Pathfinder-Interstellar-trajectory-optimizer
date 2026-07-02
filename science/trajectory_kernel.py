"""Offline astrodynamics validation helpers for Interstellar Trajectory Optimizer.

The web app intentionally talks directly to Supabase instead of a custom REST API.
This module is a research/validation kernel for notebooks, CI benchmarks, and future
cloud simulation jobs that need Python scientific libraries.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Callable

import numpy as np

G = 6.67430e-11
EARTH_MASS_KG = 5.97237e24
EARTH_RADIUS_M = 6_371_000
SUN_MASS_KG = 1.98847e30
AU_M = 149_597_870_700


@dataclass(frozen=True)
class State:
    position_m: np.ndarray
    velocity_mps: np.ndarray


def escape_velocity(mass_kg: float = EARTH_MASS_KG, radius_m: float = EARTH_RADIUS_M) -> float:
    return float(np.sqrt(2 * G * mass_kg / radius_m))


def rocket_equation_delta_v(isp_s: float, dry_mass_kg: float, fuel_mass_kg: float) -> float:
    wet_mass = dry_mass_kg + fuel_mass_kg
    return float(9.80665 * isp_s * np.log(wet_mass / dry_mass_kg))


def solar_gravity(position_m: np.ndarray) -> np.ndarray:
    radius = np.linalg.norm(position_m)
    if radius == 0:
        return np.zeros(3)
    return -G * SUN_MASS_KG * position_m / radius**3


def rk4_step(state: State, dt_s: float, acceleration: Callable[[np.ndarray, np.ndarray], np.ndarray]) -> State:
    def derivative(position: np.ndarray, velocity: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
        return velocity, acceleration(position, velocity)

    k1_p, k1_v = derivative(state.position_m, state.velocity_mps)
    k2_p, k2_v = derivative(state.position_m + k1_p * dt_s / 2, state.velocity_mps + k1_v * dt_s / 2)
    k3_p, k3_v = derivative(state.position_m + k2_p * dt_s / 2, state.velocity_mps + k2_v * dt_s / 2)
    k4_p, k4_v = derivative(state.position_m + k3_p * dt_s, state.velocity_mps + k3_v * dt_s)

    next_position = state.position_m + dt_s * (k1_p + 2 * k2_p + 2 * k3_p + k4_p) / 6
    next_velocity = state.velocity_mps + dt_s * (k1_v + 2 * k2_v + 2 * k3_v + k4_v) / 6
    return State(next_position, next_velocity)
