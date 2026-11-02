create table if not exists public.physiotherapists (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc'::text, now())
);

create unique index if not exists idx_physiotherapists_active_name
  on public.physiotherapists (lower(name))
  where is_active = true;

insert into public.physiotherapists (name)
select 'Luis'
where not exists (
  select 1 from public.physiotherapists where lower(name) = lower('Luis')
);

insert into public.physiotherapists (name)
select 'Carlos'
where not exists (
  select 1 from public.physiotherapists where lower(name) = lower('Carlos')
);

alter table public.physiotherapists enable row level security;

drop policy if exists "shared_clinic_access_physiotherapists" on public.physiotherapists;
create policy "shared_clinic_access_physiotherapists"
  on public.physiotherapists
  for all
  to anon, authenticated
  using (true)
  with check (true);

grant select, insert, update, delete
  on public.physiotherapists
  to anon, authenticated;

notify pgrst, 'reload schema';
