-- =====================================================================
-- Migration 0008 — Cierre/apertura MANUAL de predicciones especiales
-- =====================================================================
--
-- El admin controla la apertura de las predicciones especiales (premios +
-- semifinalistas) con un único interruptor manual: la clave 'specials_locked'
-- en app_settings.
--
--   specials_locked = false  → ABIERTAS (los usuarios pueden editar)
--   specials_locked = true   → CERRADAS
--
-- El deadline por fecha YA NO cierra por su cuenta: manda el interruptor.
-- Así el admin puede reabrir las predicciones aunque el deadline ya haya
-- pasado, simplemente poniendo specials_locked = false.
--
-- El bloqueo se aplica a nivel de base de datos (la función specials_open()
-- la usan las RLS policies de award_predictions y semifinalist_predictions),
-- así que el cierre es real y no sólo cosmético.
-- =====================================================================

-- Interruptor por defecto: desbloqueado (abiertas).
insert into public.app_settings (key, value)
values ('specials_locked', 'false'::jsonb)
on conflict (key) do nothing;

-- specials_open() depende ÚNICAMENTE del interruptor manual.
create or replace function public.specials_open()
returns boolean
language sql
stable
as $$
  select coalesce(
    (select (value::text)::boolean from public.app_settings where key = 'specials_locked'),
    false
  ) = false;
$$;

grant execute on function public.specials_open() to authenticated, anon;
