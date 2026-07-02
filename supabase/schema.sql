create extension if not exists "pgcrypto";

create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  email text,
  avatar_url text,
  created_at timestamptz not null default now()
);

create table if not exists public.missions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  mission_name text not null,
  launch_body text not null,
  destination text not null,
  launch_date date not null,
  propulsion_type text not null,
  payload_mass double precision not null,
  fuel_mass double precision not null,
  initial_velocity double precision not null,
  max_acceleration double precision not null,
  optimization_method text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.trajectory_results (
  id uuid primary key default gen_random_uuid(),
  mission_id uuid not null references public.missions(id) on delete cascade,
  travel_time double precision not null,
  total_distance double precision not null,
  max_velocity double precision not null,
  average_velocity double precision not null,
  delta_v double precision not null,
  optimization_score double precision not null,
  fuel_remaining double precision not null,
  simulation_data jsonb not null default '[]'::jsonb
);

create table if not exists public.simulation_steps (
  id uuid primary key default gen_random_uuid(),
  mission_id uuid not null references public.missions(id) on delete cascade,
  timestep integer not null,
  position_x double precision not null,
  position_y double precision not null,
  position_z double precision not null,
  velocity_x double precision not null,
  velocity_y double precision not null,
  velocity_z double precision not null,
  acceleration_x double precision not null,
  acceleration_y double precision not null,
  acceleration_z double precision not null
);

create table if not exists public.gravity_assists (
  id uuid primary key default gen_random_uuid(),
  mission_id uuid not null references public.missions(id) on delete cascade,
  planet_name text not null,
  flyby_order integer not null,
  closest_approach double precision not null,
  velocity_gain double precision,
  turning_angle double precision
);

create table if not exists public.optimization_runs (
  id uuid primary key default gen_random_uuid(),
  mission_id uuid not null references public.missions(id) on delete cascade,
  algorithm text not null,
  generation integer not null,
  score double precision not null,
  travel_time double precision not null,
  fuel_used double precision not null
);

alter table public.users enable row level security;
alter table public.missions enable row level security;
alter table public.trajectory_results enable row level security;
alter table public.simulation_steps enable row level security;
alter table public.gravity_assists enable row level security;
alter table public.optimization_runs enable row level security;

create policy "Users manage own profile" on public.users
  for all using (auth.uid() = id) with check (auth.uid() = id);

create policy "Users manage own missions" on public.missions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Users read own trajectory results" on public.trajectory_results
  for all using (
    exists (select 1 from public.missions m where m.id = mission_id and m.user_id = auth.uid())
  ) with check (
    exists (select 1 from public.missions m where m.id = mission_id and m.user_id = auth.uid())
  );

create policy "Users manage own simulation steps" on public.simulation_steps
  for all using (
    exists (select 1 from public.missions m where m.id = mission_id and m.user_id = auth.uid())
  ) with check (
    exists (select 1 from public.missions m where m.id = mission_id and m.user_id = auth.uid())
  );

create policy "Users manage own gravity assists" on public.gravity_assists
  for all using (
    exists (select 1 from public.missions m where m.id = mission_id and m.user_id = auth.uid())
  ) with check (
    exists (select 1 from public.missions m where m.id = mission_id and m.user_id = auth.uid())
  );

create policy "Users manage own optimization runs" on public.optimization_runs
  for all using (
    exists (select 1 from public.missions m where m.id = mission_id and m.user_id = auth.uid())
  ) with check (
    exists (select 1 from public.missions m where m.id = mission_id and m.user_id = auth.uid())
  );

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.users (id, full_name, email, avatar_url)
  values (
    new.id,
    new.raw_user_meta_data ->> 'full_name',
    new.email,
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

insert into storage.buckets (id, name, public)
values
  ('mission-reports', 'mission-reports', false),
  ('mission-media', 'mission-media', false),
  ('avatars', 'avatars', true)
on conflict (id) do nothing;
