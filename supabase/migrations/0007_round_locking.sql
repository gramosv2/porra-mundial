-- =====================================================================
-- Migration 0007 — Apertura/cierre de predicciones por RONDA
-- =====================================================================
--
-- El admin controla qué fases (rondas) admiten predicciones. Al inicio solo
-- 'grupos' está abierta; el resto se abren manualmente cuando ya se conocen
-- los emparejamientos / resultados de la ronda anterior.
--
-- Guardamos la lista de rondas abiertas en app_settings con la key
-- 'open_rounds' (un array JSON de strings de fase).
-- =====================================================================

-- Valor por defecto: solo grupos abierta.
insert into public.app_settings (key, value)
values ('open_rounds', '["grupos"]'::jsonb)
on conflict (key) do nothing;

-- Helper: indica si una fase está abierta a predicciones.
create or replace function public.round_is_open(phase_in text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select value ? phase_in
      from public.app_settings
      where key = 'open_rounds'
    ),
    false
  );
$$;

grant execute on function public.round_is_open(text) to authenticated, anon;

-- ----- Endurecer policies de predictions -----
-- INSERT: además de lo que ya pedía, la ronda del partido debe estar abierta
-- y el partido en estado 'open'.
drop policy if exists "predictions_insert_own" on public.predictions;
drop policy if exists "predictions_insert_own_if_round_open" on public.predictions;
create policy "predictions_insert_own_if_round_open"
  on public.predictions for insert to authenticated with check (
    user_id = auth.uid()
    and public.is_approved(auth.uid())
    and exists (
      select 1 from public.matches m
      where m.id = match_id
        and m.status = 'open'
        and public.round_is_open(m.phase)
    )
  );

-- UPDATE: igual, y respetando el lock individual de la fila (locked=false).
drop policy if exists "predictions_update_own_if_unlocked" on public.predictions;
create policy "predictions_update_own_if_unlocked"
  on public.predictions for update to authenticated using (
    user_id = auth.uid()
    and locked = false
    and exists (
      select 1 from public.matches m
      where m.id = match_id
        and m.status = 'open'
        and public.round_is_open(m.phase)
    )
  );
