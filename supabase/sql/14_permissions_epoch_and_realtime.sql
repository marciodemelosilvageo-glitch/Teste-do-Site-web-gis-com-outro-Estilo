-- ==============================================================================
-- SCRIPT 14: TABELA DE ÉPOCA DE PERMISSÕES E PROPAGAÇÃO REALTIME EM ~1 SEGUNDO
-- ==============================================================================
-- 1. Cria a tabela minimalista public.permissions_epoch (contador de versão por escopo).
-- 2. Triggers automáticos em todas as tabelas de controle de poderes, camadas e contas.
-- 3. Habilitação do Supabase Realtime para permissions_epoch e profiles.
-- 4. RLS estrita: leitura liberada (anon e authenticated); escrita bloqueada para clientes.
-- ==============================================================================

BEGIN;

-- 1. TABELA MINIMALISTA DE ÉPOCA DE PERMISSÕES
CREATE TABLE IF NOT EXISTS public.permissions_epoch (
  scope TEXT PRIMARY KEY, -- 'global', 'role:visitor', 'role:user', 'user:<uuid>'
  epoch BIGINT NOT NULL DEFAULT 1,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Configura REPLICA IDENTITY FULL para garantir payload completo nas notificações Realtime
ALTER TABLE public.permissions_epoch REPLICA IDENTITY FULL;

-- Garante que profiles tenha REPLICA IDENTITY FULL para detecção imediata de is_active
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'profiles') THEN
    ALTER TABLE public.profiles REPLICA IDENTITY FULL;
  END IF;
END $$;

-- 2. PERMISSÕES DE LEITURA E RLS
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT SELECT ON TABLE public.permissions_epoch TO anon, authenticated, service_role;

ALTER TABLE public.permissions_epoch ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Leitura publica de permissions_epoch" ON public.permissions_epoch;
CREATE POLICY "Leitura publica de permissions_epoch"
  ON public.permissions_epoch
  FOR SELECT
  TO anon, authenticated, service_role
  USING (true);

-- 3. FUNÇÃO SECURITY DEFINER PARA INCREMENTAR CONTADOR DE ÉPOCA
CREATE OR REPLACE FUNCTION public.bump_permissions_epoch(p_scope TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.permissions_epoch (scope, epoch, updated_at)
  VALUES (p_scope, 1, NOW())
  ON CONFLICT (scope) DO UPDATE
  SET epoch = public.permissions_epoch.epoch + 1,
      updated_at = NOW();
END;
$$;

-- 4. FUNÇÃO TRIGGER CENTRALIZADA DE DISPARO
CREATE OR REPLACE FUNCTION public.trg_bump_permissions_epoch()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role_id TEXT;
  v_user_id TEXT;
BEGIN
  -- 4.1. Catálogo de capacidades
  IF TG_TABLE_NAME = 'auth_capabilities' THEN
    PERFORM public.bump_permissions_epoch('global');

  -- 4.2. Perfis Base
  ELSIF TG_TABLE_NAME = 'base_roles' THEN
    v_role_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.id ELSE NEW.id END;
    PERFORM public.bump_permissions_epoch('role:' || v_role_id);
    PERFORM public.bump_permissions_epoch('global');

  -- 4.3. Matriz de capacidades do perfil
  ELSIF TG_TABLE_NAME = 'role_capabilities' THEN
    v_role_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.role_id ELSE NEW.role_id END;
    PERFORM public.bump_permissions_epoch('role:' || v_role_id);
    PERFORM public.bump_permissions_epoch('global');

  -- 4.4. Exceções individuais por usuário
  ELSIF TG_TABLE_NAME = 'user_capabilities' THEN
    v_user_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.user_id::text ELSE NEW.user_id::text END;
    PERFORM public.bump_permissions_epoch('user:' || v_user_id);
    PERFORM public.bump_permissions_epoch('global');

  -- 4.5. Escopo de delegação de gerentes
  ELSIF TG_TABLE_NAME = 'user_delegation_scopes' THEN
    v_user_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.manager_id::text ELSE NEW.manager_id::text END;
    PERFORM public.bump_permissions_epoch('user:' || v_user_id);
    PERFORM public.bump_permissions_epoch('global');

  -- 4.6. Configurações globais (webgis_settings)
  ELSIF TG_TABLE_NAME = 'webgis_settings' THEN
    PERFORM public.bump_permissions_epoch('global');

  -- 4.7. Perfis de usuários (profiles: alteração de papel ou bloqueio)
  ELSIF TG_TABLE_NAME = 'profiles' THEN
    IF TG_OP = 'UPDATE' THEN
      IF (OLD.role IS DISTINCT FROM NEW.role) OR 
         (OLD.is_active IS DISTINCT FROM NEW.is_active) OR
         (OLD.has_custom_permissions IS DISTINCT FROM NEW.has_custom_permissions) OR
         (OLD.custom_layer_permissions IS DISTINCT FROM NEW.custom_layer_permissions) OR
         (OLD.custom_feature_permissions IS DISTINCT FROM NEW.custom_feature_permissions) THEN
        PERFORM public.bump_permissions_epoch('user:' || NEW.id::text);
        PERFORM public.bump_permissions_epoch('global');
      END IF;
    ELSIF TG_OP = 'DELETE' THEN
      PERFORM public.bump_permissions_epoch('user:' || OLD.id::text);
      PERFORM public.bump_permissions_epoch('global');
    END IF;
  END IF;

  RETURN NULL;
END;
$$;

-- 5. CRIAÇÃO DEFENSIVA DOS TRIGGERS
DO $$
BEGIN
  -- 5.1. auth_capabilities
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'auth_capabilities') THEN
    DROP TRIGGER IF EXISTS trg_epoch_auth_capabilities ON public.auth_capabilities;
    CREATE TRIGGER trg_epoch_auth_capabilities
      AFTER INSERT OR UPDATE OR DELETE ON public.auth_capabilities
      FOR EACH ROW EXECUTE FUNCTION public.trg_bump_permissions_epoch();
  END IF;

  -- 5.2. base_roles
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'base_roles') THEN
    DROP TRIGGER IF EXISTS trg_epoch_base_roles ON public.base_roles;
    CREATE TRIGGER trg_epoch_base_roles
      AFTER INSERT OR UPDATE OR DELETE ON public.base_roles
      FOR EACH ROW EXECUTE FUNCTION public.trg_bump_permissions_epoch();
  END IF;

  -- 5.3. role_capabilities
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'role_capabilities') THEN
    DROP TRIGGER IF EXISTS trg_epoch_role_capabilities ON public.role_capabilities;
    CREATE TRIGGER trg_epoch_role_capabilities
      AFTER INSERT OR UPDATE OR DELETE ON public.role_capabilities
      FOR EACH ROW EXECUTE FUNCTION public.trg_bump_permissions_epoch();
  END IF;

  -- 5.4. user_capabilities
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'user_capabilities') THEN
    DROP TRIGGER IF EXISTS trg_epoch_user_capabilities ON public.user_capabilities;
    CREATE TRIGGER trg_epoch_user_capabilities
      AFTER INSERT OR UPDATE OR DELETE ON public.user_capabilities
      FOR EACH ROW EXECUTE FUNCTION public.trg_bump_permissions_epoch();
  END IF;

  -- 5.5. user_delegation_scopes
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'user_delegation_scopes') THEN
    DROP TRIGGER IF EXISTS trg_epoch_user_delegation_scopes ON public.user_delegation_scopes;
    CREATE TRIGGER trg_epoch_user_delegation_scopes
      AFTER INSERT OR UPDATE OR DELETE ON public.user_delegation_scopes
      FOR EACH ROW EXECUTE FUNCTION public.trg_bump_permissions_epoch();
  END IF;

  -- 5.6. webgis_settings
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'webgis_settings') THEN
    DROP TRIGGER IF EXISTS trg_epoch_webgis_settings ON public.webgis_settings;
    CREATE TRIGGER trg_epoch_webgis_settings
      AFTER INSERT OR UPDATE OR DELETE ON public.webgis_settings
      FOR EACH ROW EXECUTE FUNCTION public.trg_bump_permissions_epoch();
  END IF;

  -- 5.7. profiles
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'profiles') THEN
    DROP TRIGGER IF EXISTS trg_epoch_profiles ON public.profiles;
    CREATE TRIGGER trg_epoch_profiles
      AFTER UPDATE OR DELETE ON public.profiles
      FOR EACH ROW EXECUTE FUNCTION public.trg_bump_permissions_epoch();
  END IF;
END $$;

-- 6. HABILITAÇÃO DO SUPABASE REALTIME
DO $$
BEGIN
  -- Publicação de permissions_epoch
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'permissions_epoch'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.permissions_epoch;
  END IF;

  -- Publicação de profiles (para streaming de is_active do usuário)
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'profiles') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables 
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'profiles'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
    END IF;
  END IF;
END $$;

-- 7. SEED INICIAL DOS ESCOPOS PRINCIPAIS
INSERT INTO public.permissions_epoch (scope, epoch, updated_at)
VALUES
  ('global', 1, NOW()),
  ('role:visitor', 1, NOW()),
  ('role:site_account', 1, NOW()),
  ('role:user', 1, NOW()),
  ('role:manager', 1, NOW())
ON CONFLICT (scope) DO NOTHING;

COMMIT;
