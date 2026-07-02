import { supabase } from "@/lib/supabase/client";
import type { Json } from "@/lib/supabase/database.types";
import type { MissionConfig, TrajectoryResult } from "@/lib/types";

export async function saveMissionSnapshot(mission: MissionConfig, result: TrajectoryResult) {
  if (!supabase) {
    throw new Error("Supabase is not configured.");
  }

  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser();

  if (userError || !user) {
    throw new Error("Sign in before saving missions.");
  }

  const { data: missionRow, error: missionError } = await supabase
    .from("missions")
    .insert({
      user_id: user.id,
      mission_name: mission.missionName,
      launch_body: mission.launchBody,
      destination: mission.destination,
      launch_date: mission.launchDate,
      propulsion_type: mission.propulsionType,
      payload_mass: mission.payloadMassKg,
      fuel_mass: mission.fuelMassKg,
      initial_velocity: mission.initialVelocityMps,
      max_acceleration: mission.maxAccelerationMps2,
      optimization_method: mission.optimizationMethod
    })
    .select("id")
    .single();

  if (missionError) {
    throw missionError;
  }

  const missionId = missionRow.id;

  const { error: resultError } = await supabase.from("trajectory_results").insert({
    mission_id: missionId,
    travel_time: result.travelTimeYears,
    total_distance: result.totalDistanceAu,
    max_velocity: result.maxVelocityKps,
    average_velocity: result.averageVelocityKps,
    delta_v: result.deltaVKps,
    optimization_score: result.optimizationScore,
    fuel_remaining: result.fuelRemainingKg,
    simulation_data: result.simulationData as unknown as Json
  });

  if (resultError) {
    throw resultError;
  }

  if (mission.gravityAssists.length > 0) {
    const { error: assistError } = await supabase.from("gravity_assists").insert(
      mission.gravityAssists.map((assist) => ({
        mission_id: missionId,
        planet_name: assist.planetName,
        flyby_order: assist.flybyOrder,
        closest_approach: assist.closestApproachKm
      }))
    );

    if (assistError) {
      throw assistError;
    }
  }

  return missionId;
}
