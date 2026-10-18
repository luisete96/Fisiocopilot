alter table public.patients
  add column if not exists medical_notes text,
  add column if not exists general_notes text;

alter table public.episodes
  add column if not exists closed_at timestamptz,
  add column if not exists discharge_reason text,
  add column if not exists discharge_notes text;
