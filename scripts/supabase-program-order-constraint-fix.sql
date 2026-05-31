-- Run if creating an event fails with:
--   violates check constraint "program_order_for_programs"
--
-- The old rule required program_order on every ProgramPage row.
-- Events (content_kind = 'event') intentionally have program_order NULL.

ALTER TABLE content_items
  DROP CONSTRAINT IF EXISTS program_order_for_programs;

ALTER TABLE content_items
  ADD CONSTRAINT program_order_for_programs CHECK (
    component <> 'ProgramPage'
    OR content_kind = 'event'
    OR (content_kind = 'program' AND program_order IS NOT NULL)
  );

NOTIFY pgrst, 'reload schema';
