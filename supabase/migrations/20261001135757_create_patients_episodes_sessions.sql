/*
# Multi-patient system: patients, episodes, and treatment sessions

## What this migration does
Creates a full multi-patient clinical record system for FisioCopilot. 
Previously the app stored sessions in localStorage with mock data only.
Now patients, their clinical episodes (one per injury/pathology), and 
individual treatment sessions are persisted in Supabase.

## New Tables

### patients
- `id` (uuid, PK): unique patient identifier
- `name` (text, not null): patient full name
- `birth_date` (date, nullable): date of birth
- `notes` (text, nullable): general patient notes
- `created_at` (timestamptz): creation timestamp

### episodes
- `id` (uuid, PK): unique episode identifier
- `patient_id` (uuid, FK → patients.id ON DELETE CASCADE): owning patient
- `title` (text, not null): short label e.g. "Hombro derecho - Enero 2026"
- `region` (text, nullable): affected body region
- `anamnesis` (jsonb, nullable): { que, porque, desde } structured anamnesis
- `status` (text, default 'active'): 'active' | 'resolved'
- `created_at` (timestamptz): creation timestamp

### sessions
- `id` (uuid, PK): unique session identifier
- `episode_id` (uuid, FK → episodes.id ON DELETE CASCADE): owning episode
- `date` (date, not null): session date
- `physio` (text, not null): professional who performed the session
- `eva` (int, default 0): EVA score 0-10
- `summary` (text, nullable): session summary text
- `techniques` (text[], default '{}'): array of technique labels
- `techniques_summary` (text, nullable): ultra-compact one-line technique summary
- `retest` (text, nullable): retest of the comparable sign
- `improvement` (int, default 0): improvement percentage
- `created_at` (timestamptz): creation timestamp

## Security
- This is a single-tenant app (no sign-in/auth), so all policies use
  `TO anon, authenticated` with `USING (true)` — data is intentionally
  shared/public within the clinic.
- RLS enabled on all three tables.
- 4 policies per table (SELECT, INSERT, UPDATE, DELETE).
*/