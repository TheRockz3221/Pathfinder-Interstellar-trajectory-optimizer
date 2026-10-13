# Interstellar Trajectory Optimizer

An interactive research application for configuring and comparing hypothetical spacecraft trajectories. It includes a mission builder, gravity-assist modeling, numerical trajectory simulation, visualization, educational validation panels, and session-local run comparisons.

## Live application

[Open the Interstellar Trajectory Optimizer](https://pathfinder-interstellar-trajectory.vercel.app) (Vercel authentication is currently enabled for this deployment.)

## Run locally

Requirements: Node.js and npm.

```powershell
npm install
npm run dev
```

Open `http://localhost:3000`. Supabase configuration is optional for local mission simulation; copy `.env.example` to `.env.local` and fill in the values to enable configured Supabase features.

## Tests and checks

```powershell
npm test
npm run lint
npx tsc --noEmit
```

## Reproduce paper Table 2

Run the four fixed-date chemical/fusion configurations and print their trajectory metrics:

```powershell
npm run reproduce
```

The equivalent direct command is `npx tsx scripts/reproduce-paper-results.ts`.

## Cassini Horizons check

Fetch the Cassini and Earth ephemeris samples from NASA/JPL Horizons and print the SOI-boundary comparison:

```powershell
node scripts/cassini-horizons-speed.mjs
```

This check requires network access.

## Known limitations

- Trajectories model flybys only; capture and powered-orbit insertion are not modeled.
- The single-engine mass budget excludes engine mass.
- Planetary positions use simplified models.

## Optional Supabase setup

1. Create a Supabase project.
2. Run `supabase/schema.sql` in the SQL editor.
3. Configure the desired authentication providers and storage policies.
4. Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` in `.env.local`.
