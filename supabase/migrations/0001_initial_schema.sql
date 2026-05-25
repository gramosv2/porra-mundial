-- =====================================================================
-- PORRA MUNDIAL 2026 — Esquema completo
-- =====================================================================

-- Extensiones
create extension if not exists "pgcrypto";

-- =====================================================================
-- TABLA: profiles  (extiende auth.users)
-- =====================================================================
create table if not exists public.profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  username text unique not null,
  display_name text not null,
  avatar_url text,
  role text default 'user' check (role in ('user', 'admin')),
  approved boolean default false,
  total_points integer default 0,
  exact_scores integer default 0,
  correct_results integer default 0,
  created_at timestamptz default now()
);

-- =====================================================================
-- TABLA: matches
-- =====================================================================
create table if not exists public.matches (
  id serial primary key,
  phase text not null check (phase in ('grupos','r32','r16','cuartos','semis','tercero','final')),
  group_name text,
  matchday integer,
  match_date timestamptz not null,
  team1 text not null,
  team2 text not null,
  venue text,
  result_team1 integer,
  result_team2 integer,
  status text default 'open' check (status in ('open','closed','finished')),
  api_match_id text,
  created_at timestamptz default now()
);

create index if not exists idx_matches_phase on public.matches(phase);
create index if not exists idx_matches_status on public.matches(status);
create index if not exists idx_matches_date on public.matches(match_date);

-- =====================================================================
-- TABLA: predictions
-- =====================================================================
create table if not exists public.predictions (
  id serial primary key,
  user_id uuid references public.profiles(id) on delete cascade,
  match_id integer references public.matches(id) on delete cascade,
  pred_team1 integer not null,
  pred_team2 integer not null,
  points_earned integer default 0,
  submitted_at timestamptz default now(),
  unique(user_id, match_id)
);

create index if not exists idx_predictions_user on public.predictions(user_id);
create index if not exists idx_predictions_match on public.predictions(match_id);

-- =====================================================================
-- TABLA: award_predictions
-- =====================================================================
create table if not exists public.award_predictions (
  id serial primary key,
  user_id uuid references public.profiles(id) on delete cascade,
  award_type text not null check (award_type in (
    'balon_oro','bota_oro','guante_oro','mejor_joven','fair_play'
  )),
  prediction text not null,
  is_correct boolean default null,
  points_earned integer default 0,
  unique(user_id, award_type)
);

-- =====================================================================
-- TABLA: watch_events  (sección "ver partidos juntos")
-- =====================================================================
create table if not exists public.watch_events (
  id serial primary key,
  match_id integer references public.matches(id) on delete set null,
  custom_title text,
  custom_date timestamptz,
  location text not null,
  location_url text,
  notes text,
  created_by uuid references public.profiles(id),
  created_at timestamptz default now()
);

create table if not exists public.watch_attendees (
  id serial primary key,
  event_id integer references public.watch_events(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete cascade,
  joined_at timestamptz default now(),
  unique(event_id, user_id)
);

-- =====================================================================
-- RLS
-- =====================================================================
alter table public.profiles enable row level security;
alter table public.matches enable row level security;
alter table public.predictions enable row level security;
alter table public.award_predictions enable row level security;
alter table public.watch_events enable row level security;
alter table public.watch_attendees enable row level security;

-- ---- profiles ----
drop policy if exists "profiles_read_all" on public.profiles;
create policy "profiles_read_all" on public.profiles
  for select using (true);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id);

drop policy if exists "profiles_insert_self" on public.profiles;
create policy "profiles_insert_self" on public.profiles
  for insert with check (auth.uid() = id);

drop policy if exists "profiles_admin_all" on public.profiles;
create policy "profiles_admin_all" on public.profiles
  for all using (
    exists(select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );

-- ---- matches ----
drop policy if exists "matches_read_approved" on public.matches;
create policy "matches_read_approved" on public.matches
  for select using (
    exists(select 1 from public.profiles p where p.id = auth.uid() and p.approved = true)
  );

drop policy if exists "matches_admin_write" on public.matches;
create policy "matches_admin_write" on public.matches
  for all using (
    exists(select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );

-- ---- predictions ----
-- El usuario ve sus propias predicciones siempre.
-- Ve las de los demás SOLO cuando el partido está 'finished'.
drop policy if exists "predictions_read_own_or_finished" on public.predictions;
create policy "predictions_read_own_or_finished" on public.predictions
  for select using (
    user_id = auth.uid()
    or exists(select 1 from public.matches m where m.id = match_id and m.status = 'finished')
  );

drop policy if exists "predictions_insert_own" on public.predictions;
create policy "predictions_insert_own" on public.predictions
  for insert with check (
    user_id = auth.uid()
    and exists(select 1 from public.matches m where m.id = match_id and m.status = 'open')
    and exists(select 1 from public.profiles p where p.id = auth.uid() and p.approved = true)
  );

drop policy if exists "predictions_update_own_if_open" on public.predictions;
create policy "predictions_update_own_if_open" on public.predictions
  for update using (
    user_id = auth.uid()
    and exists(select 1 from public.matches m where m.id = match_id and m.status = 'open')
  );

drop policy if exists "predictions_admin_all" on public.predictions;
create policy "predictions_admin_all" on public.predictions
  for all using (
    exists(select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );

-- ---- award_predictions ----
drop policy if exists "awards_read_own_or_resolved" on public.award_predictions;
create policy "awards_read_own_or_resolved" on public.award_predictions
  for select using (
    user_id = auth.uid()
    or is_correct is not null
  );

drop policy if exists "awards_write_own" on public.award_predictions;
create policy "awards_write_own" on public.award_predictions
  for insert with check (
    user_id = auth.uid()
    and exists(select 1 from public.profiles p where p.id = auth.uid() and p.approved = true)
  );

drop policy if exists "awards_update_own" on public.award_predictions;
create policy "awards_update_own" on public.award_predictions
  for update using (user_id = auth.uid() and is_correct is null);

drop policy if exists "awards_admin_all" on public.award_predictions;
create policy "awards_admin_all" on public.award_predictions
  for all using (
    exists(select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );

-- ---- watch_events ----
drop policy if exists "watch_events_read_approved" on public.watch_events;
create policy "watch_events_read_approved" on public.watch_events
  for select using (
    exists(select 1 from public.profiles p where p.id = auth.uid() and p.approved = true)
  );

drop policy if exists "watch_events_create_approved" on public.watch_events;
create policy "watch_events_create_approved" on public.watch_events
  for insert with check (
    created_by = auth.uid()
    and exists(select 1 from public.profiles p where p.id = auth.uid() and p.approved = true)
  );

drop policy if exists "watch_events_update_owner_or_admin" on public.watch_events;
create policy "watch_events_update_owner_or_admin" on public.watch_events
  for update using (
    created_by = auth.uid()
    or exists(select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );

drop policy if exists "watch_events_delete_owner_or_admin" on public.watch_events;
create policy "watch_events_delete_owner_or_admin" on public.watch_events
  for delete using (
    created_by = auth.uid()
    or exists(select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );

-- ---- watch_attendees ----
drop policy if exists "attendees_read_approved" on public.watch_attendees;
create policy "attendees_read_approved" on public.watch_attendees
  for select using (
    exists(select 1 from public.profiles p where p.id = auth.uid() and p.approved = true)
  );

drop policy if exists "attendees_join_self" on public.watch_attendees;
create policy "attendees_join_self" on public.watch_attendees
  for insert with check (
    user_id = auth.uid()
    and exists(select 1 from public.profiles p where p.id = auth.uid() and p.approved = true)
  );

drop policy if exists "attendees_leave_self" on public.watch_attendees;
create policy "attendees_leave_self" on public.watch_attendees
  for delete using (user_id = auth.uid());

-- =====================================================================
-- TRIGGER: crear perfil al registrarse
-- =====================================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, username, display_name, approved)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'username', split_part(new.email,'@',1)),
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email,'@',1)),
    false
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
