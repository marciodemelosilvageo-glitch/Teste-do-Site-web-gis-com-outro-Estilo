-- ==============================================================================
-- SCRIPT 15: ROLLBACK DO SCRIPT 14 (ÉPOCA DE PERMISSÕES E REALTIME)
-- ==============================================================================

BEGIN;

-- 1. Remove tabelas da publicação do Supabase Realtime
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'permissions_epoch'
  ) THEN
    ALTER PUBLICATION supabase_realtime DROP TABLE public.permissions_epoch;
  END IF;
END $$;

-- 2. Remove triggers
DROP TRIGGER IF EXISTS trg_epoch_auth_capabilities ON public.auth_capabilities;
DROP TRIGGER IF EXISTS trg_epoch_base_roles ON public.base_roles;
DROP TRIGGER IF EXISTS trg_epoch_role_capabilities ON public.role_capabilities;
DROP TRIGGER IF EXISTS trg_epoch_user_capabilities ON public.user_capabilities;
DROP TRIGGER IF EXISTS trg_epoch_user_delegation_scopes ON public.user_delegation_scopes;
DROP TRIGGER IF EXISTS trg_epoch_webgis_settings ON public.webgis_settings;
DROP TRIGGER IF EXISTS trg_epoch_profiles ON public.profiles;

-- 3. Remove funções
DROP FUNCTION IF EXISTS public.trg_bump_permissions_epoch();
DROP FUNCTION IF EXISTS public.bump_permissions_epoch(TEXT);

-- 4. Remove tabela de época
DROP TABLE IF EXISTS public.permissions_epoch CASCADE;

COMMIT;
