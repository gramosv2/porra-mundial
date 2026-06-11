-- =====================================================================
-- Migration 0009 — Cierre automático de predicciones al kickoff
-- =====================================================================
--
-- PROBLEMA:
-- Las predicciones sólo se bloqueaban cuando matches.status pasaba a
-- 'closed'/'finished'. Pero ese cambio de estado depende del cron
-- /api/sync-results (cada 2h), así que un partido podía seguir aceptando
-- predicciones DESPUÉS de haber empezado, hasta que el cron lo cerrara.
--
-- SOLUCIÓN:
-- Que las policies de INSERT/UPDATE de predictions comprueben también que
-- todavía no ha llegado la hora del partido (match_date > now()). Así el
-- cierre es exacto a la hora del kickoff, sin depender de ningún cron.
--
-- Se mantiene además la comprobación de status='open' y round_is_open(),
-- por lo que el admin puede seguir cerrando rondas o partidos manualmente.
--
-- Esta migration es idempotente: usa "drop policy if exists" + "create".
-- =====================================================================

-- Helper: ¿se puede todavía predecir este partido por tiempo?
-- (true si el partido aún no ha empezado)
create or replace function public.match_not_started(m_id integer)
returns boolean
language sql
stable
as $$
  select exists (
    select 1 from public.matches m
    where m.id = m_id
      and m.match_date > now()
  );
$$;

grant execute on function public.match_not_started(integer) to authenticated, anon;


-- =====================================================================
-- Rehacemos las policies de escritura de predictions añadiendo el
-- chequeo de tiempo. Mantenemos el resto de condiciones que ya existían
-- (aprobado, status='open', ronda abierta).
-- =====================================================================

-- ---- INSERT ----
drop policy if exists "predictions_insert_own" on public.predictions;
drop policy if exists "predictions_insert_own_if_round_open" on public.predictions;
create policy "predictions_insert_own_if_round_open"
  on public.predictions for insert to authenticated
  with check (
    user_id = auth.uid()
    and public.is_approved(auth.uid())
    and exists (
      select 1 from public.matches m
      where m.id = match_id
        and m.status = 'open'
        and m.match_date > now()                 -- <<< cierre al kickoff
    )
    and public.round_is_open(
      (select phase from public.matches where id = match_id)
    )
  );

-- ---- UPDATE ----
drop policy if exists "predictions_update_own_if_open" on public.predictions;
drop policy if exists "predictions_update_own_if_unlocked" on public.predictions;
drop policy if exists "predictions_update_own_if_round_open" on public.predictions;
create policy "predictions_update_own_if_round_open"
  on public.predictions for update to authenticated
  using (
    user_id = auth.uid()
    and coalesce(locked, false) = false
    and exists (
      select 1 from public.matches m
      where m.id = match_id
        and m.status = 'open'
        and m.match_date > now()                 -- <<< cierre al kickoff
    )
    and public.round_is_open(
      (select phase from public.matches where id = match_id)
    )
  );

-- ---- DELETE (por si el usuario borra su predicción) ----
drop policy if exists "predictions_delete_own_if_open" on public.predictions;
create policy "predictions_delete_own_if_open"
  on public.predictions for delete to authenticated
  using (
    user_id = auth.uid()
    and coalesce(locked, false) = false
    and exists (
      select 1 from public.matches m
      where m.id = match_id
        and m.match_date > now()                 -- <<< cierre al kickoff
    )
  );
