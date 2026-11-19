-- ==============================================================================
-- SCRIPT 09: ROLLBACK DA CORREÇÃO DE GRANTS E TRIGGER (SCRIPT 08)
-- ==============================================================================

BEGIN;

-- 1. Remover trigger e função de normalização de role_capabilities
DROP TRIGGER IF EXISTS trg_normalize_role_capability_input ON public.role_capabilities;
DROP FUNCTION IF EXISTS public.normalize_role_capability_input();

-- 2. Restaurar versão anterior do trigger handle_new_user (sem bypass de anônimo)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (
    id,
    username,
    name,
    role,
    is_active,
    must_change_password,
    created_by,
    created_at,
    updated_at
  )
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    'user',
    TRUE,
    FALSE,
    'Auto-cadastro (Site)',
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO UPDATE SET
    username = EXCLUDED.username,
    name = EXCLUDED.name,
    updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_user();

-- 3. Notificar PostgREST
NOTIFY pgrst, 'reload schema';

COMMIT;
