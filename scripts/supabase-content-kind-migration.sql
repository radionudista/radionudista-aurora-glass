-- Run once in Supabase SQL Editor (Dashboard → SQL → New query → Run).
-- Required after deploying code that uses program vs event (content_kind).
-- Without this column, ANY save to content_items fails with PGRST204.

ALTER TABLE content_items
  ADD COLUMN IF NOT EXISTS content_kind text NOT NULL DEFAULT 'program';

ALTER TABLE content_items
  DROP CONSTRAINT IF EXISTS content_items_content_kind_check;

ALTER TABLE content_items
  ADD CONSTRAINT content_items_content_kind_check
  CHECK (content_kind IN ('program', 'event'));

UPDATE content_items SET content_kind = 'program' WHERE content_kind IS NULL;

-- Events are ProgramPage rows without program_order; programs must have an order.
ALTER TABLE content_items
  DROP CONSTRAINT IF EXISTS program_order_for_programs;

ALTER TABLE content_items
  ADD CONSTRAINT program_order_for_programs CHECK (
    component <> 'ProgramPage'
    OR content_kind = 'event'
    OR (content_kind = 'program' AND program_order IS NOT NULL)
  );

-- Refresh PostgREST schema cache (fixes "Could not find column in schema cache")
NOTIFY pgrst, 'reload schema';