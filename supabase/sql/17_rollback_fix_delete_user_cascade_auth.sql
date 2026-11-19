-- ==============================================================================
-- SCRIPT 17: ROLLBACK DO SCRIPT 16 (CASCATA SEGURA DE EXCLUSÃO DE USUÁRIO)
-- ==============================================================================

BEGIN;

DROP TRIGGER IF EXISTS trg_delete_auth_user_on_profile_delete ON public.profiles;
DROP FUNCTION IF EXISTS public.trg_delete_auth_user_on_profile_delete();
DROP FUNCTION IF EXISTS public.admin_delete_user(UUID);
DROP FUNCTION IF EXISTS public.admin_cleanup_orphan_user(TEXT);

COMMIT;

NOTIFY pgrst, 'reload schema';
