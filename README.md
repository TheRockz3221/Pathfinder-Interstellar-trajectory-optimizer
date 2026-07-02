# Interstellar Trajectory Optimizer

A production-shaped Next.js platform for designing, simulating, visualizing, optimizing, and comparing hypothetical interstellar probe missions. The app combines a NASA/JPL-style dashboard, interactive 3D solar-system visualization, TypeScript astrodynamics kernels, propulsion models, optimization heuristics, Supabase persistence, and export tooling.

## Features

- Mission builder for launch body, destination, launch date, propulsion, spacecraft mass, acceleration, duration, integrator, and weighted optimization objectives.
- Physics modules for Newtonian gravity, escape velocity, rocket equation, solar radiation pressure, gravity assists, RK4, leapfrog, Verlet, and adaptive RK45-style stepping.
- Propulsion catalog covering chemical, nuclear thermal, nuclear electric, fusion, antimatter, and solar sail concepts.
- Interactive dashboard with mission summary, velocity/distance/fuel/delta-v charts, optimization progress, AI recommendations, comparison metrics, educational equations, and report exports.
- 3D React Three Fiber solar-system scene with orbit trails, labeled bodies, trajectory path, time acceleration, pause, and replay controls.
- Supabase-ready schema with normalized tables, storage buckets, auth profile sync, and RLS policies for user-owned mission data.
- Focused Vitest coverage for orbital mechanics calculations.
- Optional Python science kernel in `science/` for notebook validation and future cloud simulation workers without adding a custom REST API.

## Quick Start

```bash
npm install
npm run dev
```

Copy `.env.example` to `.env.local` and fill in your Supabase project URL and anon key to enable persistence and authentication.

## Supabase Setup

1. Create a Supabase project.
2. Run `supabase/schema.sql` in the SQL editor.
3. Enable Email/Password and Google OAuth in Supabase Auth.
4. Add storage bucket policies from the schema for reports, mission media, and avatars.
5. Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.

## Verification

```bash
npm run lint
npm test
npm run build
```

The current execution environment did not have `npm` available, so dependencies were declared but not installed here.

## Architecture

- `app/` contains the Next.js App Router entry, global styling, and React Query provider.
- `components/` contains the mission console, builder, charts, 3D scene, auth, exports, and shadcn-style UI primitives.
- `lib/physics/` contains integrators and astrodynamics calculations.
- `lib/optimization/` and `lib/ai/` contain optimization previews and explainable recommendation logic.
- `lib/supabase/` contains the direct Supabase client and mission persistence functions.
- `supabase/schema.sql` contains tables, triggers, storage buckets, and RLS policies.
- `science/` contains optional Python validation utilities.
