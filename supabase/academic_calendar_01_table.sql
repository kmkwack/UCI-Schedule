-- Step 1: Create table + RLS
-- Run this first in Supabase SQL Editor.

CREATE TABLE IF NOT EXISTS academic_calendar (
  id           TEXT PRIMARY KEY,
  school       TEXT NOT NULL,
  quarter_key  TEXT NOT NULL,
  title        TEXT NOT NULL,
  subtitle     TEXT,
  date         TEXT NOT NULL,
  end_date     TEXT,
  category     TEXT NOT NULL,
  url          TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_academic_calendar_school_quarter
  ON academic_calendar (school, quarter_key);

ALTER TABLE academic_calendar ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read academic_calendar" ON academic_calendar;
CREATE POLICY "Public read academic_calendar"
  ON academic_calendar FOR SELECT USING (true);
