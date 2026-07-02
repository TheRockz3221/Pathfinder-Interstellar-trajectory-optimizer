import type { Vector3 } from "@/lib/types";
import { add, scale } from "@/lib/physics/orbital";

export type State = {
  position: Vector3;
  velocity: Vector3;
};

export type AccelerationFn = (position: Vector3, velocity: Vector3, elapsedSeconds: number) => Vector3;

export function rk4Step(state: State, dt: number, elapsedSeconds: number, acceleration: AccelerationFn): State {
  const a1 = acceleration(state.position, state.velocity, elapsedSeconds);
  const v1 = state.velocity;

  const p2 = add(state.position, scale(v1, dt / 2));
  const v2 = add(state.velocity, scale(a1, dt / 2));
  const a2 = acceleration(p2, v2, elapsedSeconds + dt / 2);

  const p3 = add(state.position, scale(v2, dt / 2));
  const v3 = add(state.velocity, scale(a2, dt / 2));
  const a3 = acceleration(p3, v3, elapsedSeconds + dt / 2);

  const p4 = add(state.position, scale(v3, dt));
  const v4 = add(state.velocity, scale(a3, dt));
  const a4 = acceleration(p4, v4, elapsedSeconds + dt);

  return {
    position: add(
      state.position,
      scale(add(add(v1, scale(v2, 2)), add(scale(v3, 2), v4)), dt / 6)
    ),
    velocity: add(
      state.velocity,
      scale(add(add(a1, scale(a2, 2)), add(scale(a3, 2), a4)), dt / 6)
    )
  };
}

export function leapfrogStep(state: State, dt: number, elapsedSeconds: number, acceleration: AccelerationFn): State {
  const a0 = acceleration(state.position, state.velocity, elapsedSeconds);
  const halfVelocity = add(state.velocity, scale(a0, dt / 2));
  const nextPosition = add(state.position, scale(halfVelocity, dt));
  const a1 = acceleration(nextPosition, halfVelocity, elapsedSeconds + dt);
  return {
    position: nextPosition,
    velocity: add(halfVelocity, scale(a1, dt / 2))
  };
}

export function verletStep(state: State, dt: number, elapsedSeconds: number, acceleration: AccelerationFn): State {
  const a0 = acceleration(state.position, state.velocity, elapsedSeconds);
  const nextPosition = add(add(state.position, scale(state.velocity, dt)), scale(a0, 0.5 * dt * dt));
  const a1 = acceleration(nextPosition, state.velocity, elapsedSeconds + dt);
  return {
    position: nextPosition,
    velocity: add(state.velocity, scale(add(a0, a1), dt / 2))
  };
}

export function rk45Step(state: State, dt: number, elapsedSeconds: number, acceleration: AccelerationFn): State {
  const half = rk4Step(state, dt / 2, elapsedSeconds, acceleration);
  return rk4Step(half, dt / 2, elapsedSeconds + dt / 2, acceleration);
}
