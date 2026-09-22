-- Sub-daily continuous validation cadence (Hourly / Continuous).
-- Additive enum values only; existing Daily/Weekly/Monthly rows are unchanged.

ALTER TYPE "ScheduleFrequency" ADD VALUE IF NOT EXISTS 'Hourly';
ALTER TYPE "ScheduleFrequency" ADD VALUE IF NOT EXISTS 'Continuous';
