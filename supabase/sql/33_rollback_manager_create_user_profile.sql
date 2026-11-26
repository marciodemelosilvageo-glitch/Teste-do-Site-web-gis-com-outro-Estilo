-- ==============================================================================
-- SCRIPT 33 (ROLLBACK DO 32): REMOVER admin_finalize_created_profile
-- ==============================================================================

BEGIN;

DROP FUNCTION IF EXISTS public.admin_finalize_created_profile(
  UUID, TEXT, TEXT, TEXT, TEXT, JSONB, BOOLEAN, JSONB, JSONB, JSONB, JSONB
);

COMMIT;

NOTIFY pgrst, 'reload schema';
