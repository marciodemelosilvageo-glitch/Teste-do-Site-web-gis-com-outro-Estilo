-- ==============================================================================
-- SCRIPT 13: ROLLBACK DO TRIGGER DE PREVENÇÃO FK EM role_capabilities
-- ==============================================================================
BEGIN;

DROP TRIGGER IF EXISTS trg_auto_provision_capability_and_role ON public.role_capabilities;
DROP FUNCTION IF EXISTS public.auto_provision_capability_and_role();

NOTIFY pgrst, 'reload schema';

COMMIT;
