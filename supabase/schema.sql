-- FisioCopilot schema for an empty Supabase project.
-- Run this script in the Supabase SQL Editor.
--
-- SECURITY WARNING: this application currently has no sign-in flow. These
-- policies intentionally grant shared CRUD access to anon and authenticated
-- roles so the current app can operate. Anyone with the project URL and public
-- key can access these patient and clinical records. Do not use this policy
-- model for real patient data in production; add authentication and per-user
-- authorization before storing identifiable health information.

create table if not exists public.patients (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  name text not null,
  dni text,
  phone text,
  email text,
  birthdate date,
  occupation text,
  notes text,
  medical_notes text,
  general_notes text
);

-- Preserve data from the original app schema, which called this field
-- birth_date, and keep existing deployments compatible with the current app.
alter table public.patients
  add column if not exists dni text,
  add column if not exists phone text,
  add column if not exists email text,
  add column if not exists birthdate date,
  add column if not exists occupation text,
  add column if not exists notes text,
  add column if not exists medical_notes text,
  add column if not exists general_notes text;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'patients'
      and column_name = 'birth_date'
  ) then
    execute 'update public.patients set birthdate = coalesce(birthdate, birth_date)';
  end if;
end
$$;

create table if not exists public.episodes (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  patient_id uuid not null references public.patients(id) on delete cascade,
  title text not null,
  region text,
  status text not null default 'active'
    check (status in ('active', 'resolved')),
  diagnosis text,
  notes text,
  anamnesis jsonb
);

alter table public.episodes
  add column if not exists diagnosis text,
  add column if not exists notes text,
  add column if not exists anamnesis jsonb,
  add column if not exists closed_at timestamptz,
  add column if not exists discharge_reason text,
  add column if not exists discharge_notes text;

create table if not exists public.sessions (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  patient_id uuid not null references public.patients(id) on delete cascade,
  episode_id uuid references public.episodes(id) on delete set null,
  date date not null default current_date,
  physio text not null default '',
  eva integer check (eva between 0 and 10),
  eva_post integer check (eva_post between 0 and 10),
  subjective_notes text,
  objective_notes text,
  ultrasound_targets jsonb,
  treatment_applied text,
  next_steps text,
  summary text,
  techniques text[] not null default '{}',
  techniques_summary text,
  retest text,
  improvement integer not null default 0
    check (improvement between 0 and 100),
  clinical_data jsonb
);

alter table public.sessions
  add column if not exists patient_id uuid,
  add column if not exists episode_id uuid,
  add column if not exists date date default current_date,
  add column if not exists physio text not null default '',
  add column if not exists eva integer,
  add column if not exists eva_post integer,
  add column if not exists subjective_notes text,
  add column if not exists objective_notes text,
  add column if not exists ultrasound_targets jsonb,
  add column if not exists treatment_applied text,
  add column if not exists next_steps text,
  add column if not exists summary text,
  add column if not exists techniques text[] not null default '{}',
  add column if not exists techniques_summary text,
  add column if not exists retest text,
  add column if not exists improvement integer not null default 0,
  add column if not exists clinical_data jsonb;

-- Backfill patient_id for sessions created under the original schema, where
-- each session belonged to an episode and did not store patient_id directly.
update public.sessions as s
set patient_id = e.patient_id
from public.episodes as e
where s.patient_id is null
  and s.episode_id = e.id;

alter table public.sessions
  alter column patient_id set not null,
  alter column date set default current_date,
  alter column date set not null;

-- Ensure deleting an episode leaves its session available under the patient.
alter table public.sessions
  alter column episode_id drop not null;
alter table public.sessions
  drop constraint if exists sessions_episode_id_fkey;
alter table public.sessions
  add constraint sessions_episode_id_fkey
  foreign key (episode_id) references public.episodes(id) on delete set null;

alter table public.sessions
  drop constraint if exists sessions_patient_id_fkey;
alter table public.sessions
  add constraint sessions_patient_id_fkey
  foreign key (patient_id) references public.patients(id) on delete cascade;

create index if not exists idx_patients_name
  on public.patients (name);
create index if not exists idx_episodes_patient_id_created_at
  on public.episodes (patient_id, created_at);
create index if not exists idx_sessions_patient_id_date
  on public.sessions (patient_id, date desc);
create index if not exists idx_sessions_episode_id_date
  on public.sessions (episode_id, date);

alter table public.patients enable row level security;
alter table public.episodes enable row level security;
alter table public.sessions enable row level security;

drop policy if exists "shared_clinic_access_patients" on public.patients;
drop policy if exists "Permitir todo en patients" on public.patients;
create policy "shared_clinic_access_patients"
  on public.patients
  for all
  to anon, authenticated
  using (true)
  with check (true);

drop policy if exists "shared_clinic_access_episodes" on public.episodes;
drop policy if exists "Permitir todo en episodes" on public.episodes;
create policy "shared_clinic_access_episodes"
  on public.episodes
  for all
  to anon, authenticated
  using (true)
  with check (true);

drop policy if exists "shared_clinic_access_sessions" on public.sessions;
drop policy if exists "Permitir todo en sessions" on public.sessions;
create policy "shared_clinic_access_sessions"
  on public.sessions
  for all
  to anon, authenticated
  using (true)
  with check (true);

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete
  on public.patients, public.episodes, public.sessions
  to anon, authenticated;

notify pgrst, 'reload schema';
