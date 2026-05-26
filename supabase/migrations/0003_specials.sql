-- =====================================================================
-- Migration 0003 — Predicciones especiales (semifinalistas) + ajustes globales
-- =====================================================================
--
-- 1. Tabla app_settings: clave-valor para configuración runtime (deadline
--    de predicciones especiales, bote informativo, etc.).
-- 2. Tabla semifinalist_predictions: hasta 4 selecciones por usuario.
-- 3. Función + columna para saber si los premios e semifinalistas siguen
--    abiertos (deadline = inicio del torneo).
-- =====================================================================

-- ----- app_settings -----
create table if not exists public.app_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz default now()
);

alter table public.app_settings enable row level security;

drop policy if exists "settings_read_authenticated" on public.app_settings;
create policy "settings_read_authenticated"
  on public.app_settings for select to authenticated using (true);

drop policy if exists "settings_admin_all" on public.app_settings;
create policy "settings_admin_all"
  on public.app_settings for all to authenticated
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

-- Deadline por defecto: 11 junio 2026 a las 18:00 UTC (primer partido).
-- Si necesitas cambiarlo: update app_settings set value = '"2026-06-11T18:00:00Z"' where key='special_predictions_deadline';
insert into public.app_settings (key, value)
values ('special_predictions_deadline', '"2026-06-11T18:00:00Z"'::jsonb)
on conflict (key) do nothing;

-- ----- semifinalist_predictions -----
create table if not exists public.semifinalist_predictions (
  id serial primary key,
  user_id uuid references public.profiles(id) on delete cascade,
  team text not null,            -- nombre del equipo (mismo formato que matches.team1)
  position smallint not null,    -- 1..4 para ordenar la elección
  is_correct boolean default null,
  points_earned integer default 0,
  created_at timestamptz default now(),
  unique(user_id, position),
  unique(user_id, team)          -- no puede elegir el mismo equipo dos veces
);

create index if not exists idx_semis_user on public.semifinalist_predictions(user_id);

alter table public.semifinalist_predictions enable row level security;

-- Cada usuario ve sus propias predicciones siempre.
-- Las ajenas solo se ven una vez resueltas (is_correct != null).
drop policy if exists "semis_read_own_or_resolved" on public.semifinalist_predictions;
create policy "semis_read_own_or_resolved"
  on public.semifinalist_predictions for select to authenticated using (
    user_id = auth.uid() or is_correct is not null
  );

-- Solo el usuario puede insertar/actualizar/borrar las suyas si el deadline no ha pasado.
-- Comprobamos la fecha leyendo app_settings (admin client la bypasea con is_admin).
create or replace function public.specials_open()
returns boolean language sql stable as $$
  select coalesce(
    (now() < (select (value::text)::timestamptz from public.app_settings where key = 'special_predictions_deadline')),
    true
  );
$$;

grant execute on function public.specials_open() to authenticated, anon;

drop policy if exists "semis_insert_own_if_open" on public.semifinalist_predictions;
create policy "semis_insert_own_if_open"
  on public.semifinalist_predictions for insert to authenticated with check (
    user_id = auth.uid()
    and public.is_approved(auth.uid())
    and public.specials_open()
  );

drop policy if exists "semis_update_own_if_open" on public.semifinalist_predictions;
create policy "semis_update_own_if_open"
  on public.semifinalist_predictions for update to authenticated using (
    user_id = auth.uid()
    and is_correct is null
    and public.specials_open()
  );

drop policy if exists "semis_delete_own_if_open" on public.semifinalist_predictions;
create policy "semis_delete_own_if_open"
  on public.semifinalist_predictions for delete to authenticated using (
    user_id = auth.uid()
    and is_correct is null
    and public.specials_open()
  );

drop policy if exists "semis_admin_all" on public.semifinalist_predictions;
create policy "semis_admin_all"
  on public.semifinalist_predictions for all to authenticated
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

-- ----- Endurecer awards: tampoco se pueden editar si pasó el deadline -----
drop policy if exists "awards_insert_own" on public.award_predictions;
create policy "awards_insert_own"
  on public.award_predictions for insert to authenticated with check (
    user_id = auth.uid()
    and public.is_approved(auth.uid())
    and public.specials_open()
  );

drop policy if exists "awards_update_own" on public.award_predictions;
create policy "awards_update_own"
  on public.award_predictions for update to authenticated using (
    user_id = auth.uid()
    and is_correct is null
    and public.specials_open()
  );
