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

-- 2. Remove triggers defensivamente (apenas nas tabelas que existirem)
DO $$
DECLARE
  t TEXT;
  tbls TEXT[] := ARRAY[
    'auth_capabilities',
    'base_roles',
    'role_capabilities',
    'user_capabilities',
    'user_delegation_scopes',
    'webgis_settings',
    'profiles'
  ];
BEGIN
  FOREACH t IN ARRAY tbls LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name = t
    ) THEN
      EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.%I', 'trg_epoch_' || t, t);
    END IF;
  END LOOP;
END $$;

-- 3. Remove funções
DROP FUNCTION IF EXISTS public.trg_bump_permissions_epoch();
DROP FUNCTION IF EXISTS public.bump_permissions_epoch(TEXT);

-- 4. Remove tabela de época
DROP TABLE IF EXISTS public.permissions_epoch CASCADE;

COMMIT;
