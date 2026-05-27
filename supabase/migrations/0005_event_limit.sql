-- =====================================================================
-- Migration 0005 — Límite de asistentes en quedadas
-- =====================================================================
--
-- Añade columna attendee_limit (nullable: NULL = sin límite).
-- Endurece la policy de INSERT de watch_attendees: si la quedada tiene
-- limit y ya alcanzó el aforo, el insert se bloquea. (Excepto el propio
-- creador, que siempre tiene su sitio.)
-- =====================================================================

alter table public.watch_events
  add column if not exists attendee_limit integer;

-- Constraint: si se define, debe ser >= 1
alter table public.watch_events
  drop constraint if exists watch_events_limit_positive;
alter table public.watch_events
  add constraint watch_events_limit_positive
  check (attendee_limit is null or attendee_limit >= 1);

-- Helper: cuenta asistentes actuales de un evento
create or replace function public.event_attendee_count(event_id_in bigint)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::int from public.watch_attendees where event_id = event_id_in;
$$;

grant execute on function public.event_attendee_count(bigint) to authenticated, anon;

-- Helper: indica si todavía cabe un nuevo asistente
create or replace function public.event_has_slot(event_id_in bigint)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select attendee_limit is null
        or public.event_attendee_count(event_id_in) < attendee_limit
      from public.watch_events
      where id = event_id_in
    ),
    false
  );
$$;

grant execute on function public.event_has_slot(bigint) to authenticated, anon;

-- ----- policy: apuntarse solo si hay sitio -----
-- Excepción: el creador siempre puede apuntarse (cuando crea la quedada,
-- el cliente le auto-apunta).
drop policy if exists "attendees_join_self" on public.watch_attendees;
drop policy if exists "attendees_join_self_if_slot" on public.watch_attendees;

create policy "attendees_join_self_if_slot"
  on public.watch_attendees for insert to authenticated
  with check (
    user_id = auth.uid()
    and public.is_approved(auth.uid())
    and (
      public.event_has_slot(event_id)
      or exists (
        select 1 from public.watch_events
        where id = event_id and created_by = auth.uid()
      )
    )
  );

-- ----- policy: el creador/admin pueden expulsar a cualquier asistente -----
drop policy if exists "attendees_leave_self" on public.watch_attendees;
drop policy if exists "attendees_leave_self_or_owner_kick" on public.watch_attendees;

create policy "attendees_leave_self_or_owner_kick"
  on public.watch_attendees for delete to authenticated using (
    user_id = auth.uid()
    or exists (
      select 1 from public.watch_events e
      where e.id = event_id
        and (e.created_by = auth.uid() or public.is_admin(auth.uid()))
    )
  );
