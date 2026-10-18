/*
# Add clinical_data and eva_post columns to sessions

1. Modified Tables
- `sessions`: Added `clinical_data` (jsonb, nullable) — stores the full clinical
  state at the time the session was saved (dichotomous findings, red/yellow flags,
  orthopedic test results, comparable sign, hypotheses, etc.). This enables
  restoring the prior clinical context when a follow-up session is opened.
- `sessions`: Added `eva_post` (int, nullable) — the EVA measured AFTER treatment
  during the session (test-retest). Allows showing EVA pre vs post evolution in
  the session history cards.

2. Security
- No RLS changes. Existing policies on `sessions` already allow anon/authenticated
  CRUD. The new columns inherit those policies automatically.

3. Important Notes
- Both columns are nullable so existing session rows remain valid.
- `clinical_data` is stored as jsonb for flexibility — the app serializes the
  ClinicalData TypeScript object into it on report save and deserializes it back
  when opening a follow-up valoración.
- `eva_post` complements the existing `eva` column (which represents the pre-session
  / basal EVA of the comparable sign).
*/

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sessions' AND column_name = 'clinical_data'
  ) THEN
    ALTER TABLE sessions ADD COLUMN clinical_data jsonb;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sessions' AND column_name = 'eva_post'
  ) THEN
    ALTER TABLE sessions ADD COLUMN eva_post int;
  END IF;
END $$;
