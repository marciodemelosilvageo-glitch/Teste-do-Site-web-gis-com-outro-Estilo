-- ==============================================================================
-- SCRIPT 08: CORREÇÃO DE GRANTS E CHAVES DE PERFIS BASE (role_capabilities)
-- ==============================================================================
-- 1. Concede permissões de escrita ao role 'authenticated' nas tabelas relacionais
--    de controle de acesso (o bloqueio/permissão real é governado pelas políticas RLS).
-- 2. Garante que os registros base de base_roles estejam presentes com seus IDs limpos.
-- 3. Trigger defensivo que normaliza automaticamente 'role:visitor' -> 'visitor'.
-- ==============================================================================

BEGIN;

-- 1. Conceder permissões necessárias ao role authenticated (governado por RLS)
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

GRANT SELECT ON TABLE public.auth_capabilities TO anon, authenticated, service_role;
GRANT INSERT, UPDATE, DELETE ON TABLE public.auth_capabilities TO authenticated, service_role;

GRANT SELECT ON TABLE public.base_roles TO anon, authenticated, service_role;
GRANT INSERT, UPDATE, DELETE ON TABLE public.base_roles TO authenticated, service_role;

GRANT SELECT ON TABLE public.role_capabilities TO anon, authenticated, service_role;
GRANT INSERT, UPDATE, DELETE ON TABLE public.role_capabilities TO authenticated, service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.user_capabilities TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.user_delegation_scopes TO authenticated, service_role;
GRANT SELECT, INSERT ON TABLE public.capability_audit_logs TO authenticated, service_role;

-- 2. Garantir que os perfis base fundamentais existam
INSERT INTO public.base_roles (id, name, description, is_system, hierarchy_level)
VALUES
  ('visitor', 'Visitante Anônimo', 'Cidadão público ou visitante sem autenticação formal', TRUE, 0),
  ('site_account', 'Conta do Site', 'Usuário cadastrado pelo formulário público do site', TRUE, 10),
  ('user', 'Usuário Credenciado', 'Usuário institucional cadastrado pela gestão', TRUE, 20),
  ('manager', 'Gerente de Equipe', 'Gestor de equipe com poderes de delegação autorizados', TRUE, 50)
ON CONFLICT (id) DO UPDATE 
SET name = EXCLUDED.name, description = EXCLUDED.description, is_system = TRUE;

-- 3. Trigger de normalização defensiva para role_capabilities
-- Caso qualquer cliente envie 'role:visitor' ou 'visitor', normaliza para 'visitor'
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

DROP TRIGGER IF EXISTS trg_normalize_role_capability_input ON public.role_capabilities;
CREATE TRIGGER trg_normalize_role_capability_input
BEFORE INSERT OR UPDATE ON public.role_capabilities
FOR EACH ROW
EXECUTE FUNCTION public.normalize_role_capability_input();

-- 4. Correção do Trigger de Criação de Usuário (on_auth_user_created)
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

-- 5. Notificar PostgREST para recarregar o schema imediatamente
NOTIFY pgrst, 'reload schema';

COMMIT;
