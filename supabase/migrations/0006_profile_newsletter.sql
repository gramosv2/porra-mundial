-- =====================================================================
-- Migration 0006 — Avatar + bio en perfiles + tabla newsletters
-- =====================================================================

-- ----- 1) Perfiles: avatar + bio -----
alter table public.profiles
  add column if not exists avatar_url text,
  add column if not exists bio text;

-- Aseguramos que cualquiera autenticado puede LEER perfiles aprobados
-- (necesario para mostrar las tarjetas en clasificación con bio/avatar).
-- Si tu policy actual ya lo hace, esta no añade nada nuevo.
drop policy if exists "profiles_read_approved" on public.profiles;
create policy "profiles_read_approved"
  on public.profiles for select to authenticated using (
    approved = true or id = auth.uid()
  );

-- ----- 2) Bucket de Storage para avatares -----
-- Lo creamos idempotentemente. Si ya existe, no hace nada.
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

-- Policies del bucket: SELECT público, INSERT/UPDATE/DELETE solo del propio user.
-- (El path del fichero debe empezar por <user_id>/ para validar.)
drop policy if exists "avatars_public_read" on storage.objects;
create policy "avatars_public_read"
  on storage.objects for select to public
  using (bucket_id = 'avatars');

drop policy if exists "avatars_user_insert" on storage.objects;
create policy "avatars_user_insert"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "avatars_user_update" on storage.objects;
create policy "avatars_user_update"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "avatars_user_delete" on storage.objects;
create policy "avatars_user_delete"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- ----- 3) Tabla newsletters -----
create table if not exists public.newsletters (
  id serial primary key,
  title text not null,
  body text not null,
  published_at timestamptz not null default now(),
  created_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz default now()
);

create index if not exists idx_newsletters_published on public.newsletters(published_at desc);

alter table public.newsletters enable row level security;

drop policy if exists "newsletters_read_approved" on public.newsletters;
create policy "newsletters_read_approved"
  on public.newsletters for select to authenticated using (
    public.is_approved(auth.uid())
  );

drop policy if exists "newsletters_admin_all" on public.newsletters;
create policy "newsletters_admin_all"
  on public.newsletters for all to authenticated
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));
