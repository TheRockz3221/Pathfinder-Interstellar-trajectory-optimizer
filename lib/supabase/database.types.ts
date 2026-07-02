export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          full_name: string | null;
          email: string | null;
          avatar_url: string | null;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["users"]["Row"]> & { id: string };
        Update: Partial<Database["public"]["Tables"]["users"]["Row"]>;
      };
      missions: {
        Row: {
          id: string;
          user_id: string;
          mission_name: string;
          launch_body: string;
          destination: string;
          launch_date: string;
          propulsion_type: string;
          payload_mass: number;
          fuel_mass: number;
          initial_velocity: number;
          max_acceleration: number;
          optimization_method: string;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["missions"]["Row"]> & { user_id: string; mission_name: string };
        Update: Partial<Database["public"]["Tables"]["missions"]["Row"]>;
      };
      trajectory_results: {
        Row: {
          id: string;
          mission_id: string;
          travel_time: number;
          total_distance: number;
          max_velocity: number;
          average_velocity: number;
          delta_v: number;
          optimization_score: number;
          fuel_remaining: number;
          simulation_data: Json;
        };
        Insert: Partial<Database["public"]["Tables"]["trajectory_results"]["Row"]> & { mission_id: string };
        Update: Partial<Database["public"]["Tables"]["trajectory_results"]["Row"]>;
      };
      simulation_steps: {
        Row: Record<string, unknown>;
        Insert: Record<string, unknown>;
        Update: Record<string, unknown>;
      };
      gravity_assists: {
        Row: Record<string, unknown>;
        Insert: Record<string, unknown>;
        Update: Record<string, unknown>;
      };
      optimization_runs: {
        Row: Record<string, unknown>;
        Insert: Record<string, unknown>;
        Update: Record<string, unknown>;
      };
    };
  };
};
