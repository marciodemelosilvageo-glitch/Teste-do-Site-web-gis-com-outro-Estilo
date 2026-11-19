-- ==============================================================================
-- SCRIPT 13: ROLLBACK DO TRIGGER DE PREVENÇÃO FK EM role_capabilities
-- ==============================================================================
BEGIN;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'role_capabilities'
  ) THEN
    DROP TRIGGER IF EXISTS trg_auto_provision_capability_and_role ON public.role_capabilities;
  END IF;
END $$;
DROP FUNCTION IF EXISTS public.auto_provision_capability_and_role();

NOTIFY pgrst, 'reload schema';

COMMIT;
