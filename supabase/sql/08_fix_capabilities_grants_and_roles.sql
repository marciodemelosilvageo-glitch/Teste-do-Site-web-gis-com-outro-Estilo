-- ==============================================================================
-- SCRIPT 08: CORREÇÃO DE GRANTS E CHAVES DE PERFIS BASE (role_capabilities)
-- ==============================================================================
-- 1. Concede permissões defensivamente (apenas se as tabelas já existirem,
--    evitando o erro 42P01 caso o Script 01 ainda não tenha sido executado).
-- 2. Garante registros base em base_roles (se a tabela existir).
-- 3. Trigger defensivo que normaliza 'role:visitor' -> 'visitor' (se role_capabilities existir).
-- 4. Correção do Trigger de Criação de Usuário (handle_new_user) para evitar erro 500 no login anônimo.
-- ==============================================================================

BEGIN;

-- 1. Conceder permissões de uso no schema public
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

-- Bloco defensivo: executa GRANTs e inserts somente nas tabelas que já existem
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'auth_capabilities') THEN
    EXECUTE 'GRANT SELECT ON TABLE public.auth_capabilities TO anon, authenticated, service_role';
    EXECUTE 'GRANT INSERT, UPDATE, DELETE ON TABLE public.auth_capabilities TO authenticated, service_role';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'base_roles') THEN
    EXECUTE 'GRANT SELECT ON TABLE public.base_roles TO anon, authenticated, service_role';
    EXECUTE 'GRANT INSERT, UPDATE, DELETE ON TABLE public.base_roles TO authenticated, service_role';
    
    INSERT INTO public.base_roles (id, name, description, is_system, hierarchy_level)
    VALUES
      ('visitor', 'Visitante Anônimo', 'Cidadão público ou visitante sem autenticação formal', TRUE, 0),
      ('site_account', 'Conta do Site', 'Usuário cadastrado pelo formulário público do site', TRUE, 10),
      ('user', 'Usuário Credenciado', 'Usuário institucional cadastrado pela gestão', TRUE, 20),
      ('manager', 'Gerente de Equipe', 'Gestor de equipe com poderes de delegação autorizados', TRUE, 50)
    ON CONFLICT (id) DO UPDATE 
    SET name = EXCLUDED.name, description = EXCLUDED.description, is_system = TRUE;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'role_capabilities') THEN
    EXECUTE 'GRANT SELECT ON TABLE public.role_capabilities TO anon, authenticated, service_role';
    EXECUTE 'GRANT INSERT, UPDATE, DELETE ON TABLE public.role_capabilities TO authenticated, service_role';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'user_capabilities') THEN
    EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.user_capabilities TO authenticated, service_role';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'user_delegation_scopes') THEN
    EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.user_delegation_scopes TO authenticated, service_role';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'capability_audit_logs') THEN
    EXECUTE 'GRANT SELECT, INSERT ON TABLE public.capability_audit_logs TO authenticated, service_role';
  END IF;
END $$;

-- 2. Trigger de normalização defensiva para role_capabilities
CREATE OR REPLACE FUNCTION public.normalize_role_capability_input()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.role_id := replace(NEW.role_id, 'role:', '');
  NEW.updated_at := NOW();
  IF NEW.effect IS NULL THEN
    NEW.effect := CASE WHEN NEW.can_use IS TRUE THEN 'allow' ELSE 'deny' END;
  END IF;
  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'role_capabilities') THEN
    EXECUTE 'DROP TRIGGER IF EXISTS trg_normalize_role_capability_input ON public.role_capabilities';
    EXECUTE 'CREATE TRIGGER trg_normalize_role_capability_input BEFORE INSERT OR UPDATE ON public.role_capabilities FOR EACH ROW EXECUTE FUNCTION public.normalize_role_capability_input()';
  END IF;
END $$;

-- 3. Correção do Trigger de Criação de Usuário (on_auth_user_created)
-- Evita erro 500 no signUp anônimo (anônimos não possuem email nem username para a tabela profiles)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Se for um visitante anônimo (ou sem email/username), NÃO cria perfil em public.profiles
  IF COALESCE(NEW.is_anonymous, FALSE) IS TRUE OR (NEW.email IS NULL AND NEW.raw_user_meta_data->>'username' IS NULL) THEN
    RETURN NEW;
  END IF;

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

-- 4. Notificar PostgREST para recarregar o schema imediatamente
NOTIFY pgrst, 'reload schema';

COMMIT;
