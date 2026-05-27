-- =====================================================================
-- Migration 0004 — Cierre/reapertura de predicciones por el usuario
-- =====================================================================
--
-- Cada predicción (de partido, premio, semifinalista) gana una columna
-- `locked` que indica si el usuario la ha confirmado. Mientras esté locked,
-- no se puede modificar. El usuario puede reabrirla siempre que aún haya
-- ventana de tiempo (≥ 2h antes del partido para predicciones normales;
-- antes del deadline de especiales para premios y semifinalistas).
--
-- Las policies de UPDATE/DELETE se endurecen para impedir tocar filas locked.
-- El propio lock/unlock se hace mediante UPDATE de la columna `locked` con
-- una policy específica que sí lo permite siempre que estemos en ventana.
-- =====================================================================

-- ----- columnas -----
alter table public.predictions
  add column if not exists locked boolean not null default false,
  add column if not exists locked_at timestamptz;

alter table public.award_predictions
  add column if not exists locked boolean not null default false,
  add column if not exists locked_at timestamptz;

alter table public.semifinalist_predictions
  add column if not exists locked boolean not null default false,
  add column if not exists locked_at timestamptz;

-- ----- helper: ventana de tiempo para predicciones de partido -----
-- Devuelve true si todavía estamos a ≥ 2 horas del comienzo del partido.
-- (Si en el futuro quieres cambiar la ventana, cambia el INTERVAL.)
create or replace function public.match_lock_window_open(match_id_in bigint)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists(
    select 1 from public.matches
    where id = match_id_in
      and match_date > now() + interval '2 hours'
  );
$$;

grant execute on function public.match_lock_window_open(bigint) to authenticated, anon;

-- ----- policies predictions -----
drop policy if exists "predictions_update_own_if_open" on public.predictions;

-- UPDATE: solo si es del usuario, el partido sigue abierto, y la fila NO
-- está locked. (Si está locked, primero el usuario tiene que desbloquearla;
-- el desbloqueo se gestiona vía endpoint server-side con admin client.)
create policy "predictions_update_own_if_unlocked"
  on public.predictions for update to authenticated using (
    user_id = auth.uid()
    and locked = false
    and exists (select 1 from public.matches m where m.id = match_id and m.status = 'open')
  );

drop policy if exists "predictions_delete_own_if_unlocked" on public.predictions;
create policy "predictions_delete_own_if_unlocked"
  on public.predictions for delete to authenticated using (
    user_id = auth.uid()
    and locked = false
    and exists (select 1 from public.matches m where m.id = match_id and m.status = 'open')
  );

-- ----- policies award_predictions -----
drop policy if exists "awards_update_own" on public.award_predictions;
create policy "awards_update_own_if_unlocked"
  on public.award_predictions for update to authenticated using (
    user_id = auth.uid()
    and is_correct is null
    and locked = false
    and public.specials_open()
  );

drop policy if exists "awards_delete_own_if_unlocked" on public.award_predictions;
create policy "awards_delete_own_if_unlocked"
  on public.award_predictions for delete to authenticated using (
    user_id = auth.uid()
    and is_correct is null
    and locked = false
    and public.specials_open()
  );

-- ----- policies semifinalist_predictions -----
drop policy if exists "semis_update_own_if_open" on public.semifinalist_predictions;
create policy "semis_update_own_if_unlocked"
  on public.semifinalist_predictions for update to authenticated using (
    user_id = auth.uid()
    and is_correct is null
    and locked = false
    and public.specials_open()
  );

drop policy if exists "semis_delete_own_if_open" on public.semifinalist_predictions;
create policy "semis_delete_own_if_unlocked"
  on public.semifinalist_predictions for delete to authenticated using (
    user_id = auth.uid()
    and is_correct is null
    and locked = false
    and public.specials_open()
  );
