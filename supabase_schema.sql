-- ==============================================================================
-- WebGIS — Script Completo de Inicialização e Segurança no Supabase
-- Execute este script no SQL Editor do painel do seu projeto Supabase.
-- ==============================================================================

-- 1. Tabela de Perfis de Usuários (public.profiles)
-- Vinculada 1:1 com auth.users. As senhas ficam com hash seguro no Supabase Auth.
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('master', 'manager', 'user')) DEFAULT 'user',
  department TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  must_change_password BOOLEAN NOT NULL DEFAULT FALSE,
  has_custom_permissions BOOLEAN DEFAULT FALSE,
  manager_permissions JSONB DEFAULT NULL,
  custom_layer_permissions JSONB DEFAULT NULL,
  custom_feature_permissions JSONB DEFAULT NULL,
  custom_address_columns_permissions JSONB DEFAULT NULL,
  custom_feature_properties_permissions JSONB DEFAULT NULL,
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_login TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Tabela de Configurações Globais (public.webgis_settings)
-- Sem senhas e sem lista de usuários em texto puro.
CREATE TABLE IF NOT EXISTS public.webgis_settings (
  id TEXT PRIMARY KEY,
  layer_permissions JSONB,
  feature_permissions JSONB,
  address_columns_permissions JSONB,
  feature_properties_permissions JSONB,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  data JSONB
);

-- 3. Tabela de Monitoramento de Sessões e Visitantes (public.webgis_user_sessions)
CREATE TABLE IF NOT EXISTS public.webgis_user_sessions (
  session_id TEXT PRIMARY KEY,
  auth_uid UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  custom_name TEXT,
  first_seen TIMESTAMPTZ DEFAULT NOW(),
  last_seen TIMESTAMPTZ DEFAULT NOW(),
  formatted_first_seen TEXT,
  formatted_last_seen TEXT,
  role TEXT DEFAULT 'user',
  is_blocked BOOLEAN DEFAULT FALSE,
  has_custom_permissions BOOLEAN DEFAULT FALSE,
  custom_layer_permissions JSONB,
  custom_feature_permissions JSONB,
  custom_address_columns_permissions JSONB,
  custom_feature_properties_permissions JSONB,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Tabela de Logs de Atividades e Auditoria (public.webgis_logs)
CREATE TABLE IF NOT EXISTS public.webgis_logs (
  id TEXT PRIMARY KEY,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  formatted_date TEXT,
  user_role TEXT DEFAULT 'user',
  category TEXT,
  action TEXT,
  details TEXT,
  session_id TEXT,
  actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Habilitar Row Level Security (RLS) em todas as tabelas
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webgis_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webgis_user_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webgis_logs ENABLE ROW LEVEL SECURITY;

-- 6. Funções SECURITY DEFINER (para checagem segura de papéis no RLS)
CREATE OR REPLACE FUNCTION public.get_auth_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(role, 'visitor') 
  FROM public.profiles 
  WHERE id = auth.uid() AND is_active = TRUE 
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.is_master()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT (
    (current_user IN ('postgres', 'service_role', 'supabase_admin') AND auth.uid() IS NULL)
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'master' AND is_active = TRUE
    )
  );
$$;

CREATE OR REPLACE FUNCTION public.is_manager()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT (
    (current_user IN ('postgres', 'service_role', 'supabase_admin') AND auth.uid() IS NULL)
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('master', 'manager') AND is_active = TRUE
    )
  );
$$;

-- 7. Trigger de Proteção: Impede que o usuário comum altere seu próprio papel, status ou permissões customizadas
CREATE OR REPLACE FUNCTION public.prevent_self_elevation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Permite operações administrativas diretas via SQL Editor / Migrações (postgres / service_role)
  IF current_user IN ('postgres', 'supabase_admin', 'service_role') AND auth.uid() IS NULL THEN
    NEW.updated_at = NOW();
    RETURN NEW;
  END IF;

  IF NOT public.is_master() THEN
    -- 1. Proteção de Cargo, Status e Permissões de Gerência
    NEW.role = OLD.role;
    NEW.is_active = OLD.is_active;
    NEW.manager_permissions = OLD.manager_permissions;

    -- 2. Proteção de Identidade / Login (impede troca de username)
    NEW.username = OLD.username;

    -- 3. Proteção de Permissões Personalizadas (impede auto-concessão de permissões)
    NEW.has_custom_permissions = OLD.has_custom_permissions;
    NEW.custom_layer_permissions = OLD.custom_layer_permissions;
    NEW.custom_feature_permissions = OLD.custom_feature_permissions;
    NEW.custom_address_columns_permissions = OLD.custom_address_columns_permissions;
    NEW.custom_feature_properties_permissions = OLD.custom_feature_properties_permissions;

    -- 4. Proteção de Metadados de Criação
    NEW.created_by = OLD.created_by;
    NEW.created_at = OLD.created_at;

    -- 5. Exceção Segura para must_change_password:
    -- O usuário comum só pode alterar must_change_password para FALSE (ao salvar nova senha).
    IF NEW.must_change_password IS DISTINCT FROM OLD.must_change_password THEN
      IF NEW.must_change_password = FALSE AND OLD.must_change_password = TRUE THEN
        NEW.must_change_password = FALSE;
      ELSE
        NEW.must_change_password = OLD.must_change_password;
      END IF;
    END IF;
  END IF;

  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_self_elevation ON public.profiles;
CREATE TRIGGER trg_prevent_self_elevation
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.prevent_self_elevation();

-- Trigger automático para criação de perfil em auto-cadastros do Supabase Auth
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Se for um visitante anônimo (ou sem email/username), NÃO cria perfil em public.profiles
  -- Visitantes anônimos não possuem credenciais de acesso nem perfil em profiles.
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

-- 8. Políticas RLS: public.profiles
DROP POLICY IF EXISTS "profiles_select_policy" ON public.profiles;
CREATE POLICY "profiles_select_policy"
ON public.profiles FOR SELECT
USING (
  auth.uid() = id
  OR public.is_manager()
);

DROP POLICY IF EXISTS "profiles_update_policy" ON public.profiles;
CREATE POLICY "profiles_update_policy"
ON public.profiles FOR UPDATE
USING (
  auth.uid() = id
  OR public.is_master()
)
WITH CHECK (
  auth.uid() = id
  OR public.is_master()
);

DROP POLICY IF EXISTS "profiles_insert_policy" ON public.profiles;
CREATE POLICY "profiles_insert_policy"
ON public.profiles FOR INSERT
WITH CHECK (
  public.is_master()
  OR (auth.uid() = id AND role = 'user' AND is_active = TRUE)
);

DROP POLICY IF EXISTS "profiles_delete_policy" ON public.profiles;
CREATE POLICY "profiles_delete_policy"
ON public.profiles FOR DELETE
USING (public.is_master());

-- 9. Políticas RLS e Triggers: public.webgis_user_sessions
-- Triggers de segurança: garantem que sessões pertençam a auth.uid(), com campos sensíveis forçados pelo servidor
CREATE OR REPLACE FUNCTION public.protect_user_session_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_role TEXT;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Acesso negado: registro de sessão requer autenticação válida (auth.uid requerido)';
  END IF;

  NEW.auth_uid := auth.uid();
  NEW.session_id := COALESCE(NEW.session_id, auth.uid()::text);
  NEW.first_seen := COALESCE(NEW.first_seen, NOW());
  NEW.last_seen := NOW();
  NEW.updated_at := NOW();

  IF NOT public.is_manager() THEN
    SELECT role INTO v_role FROM public.profiles WHERE id = auth.uid() AND is_active = TRUE;
    IF v_role IS NOT NULL THEN
      NEW.role := v_role;
    ELSIF (auth.jwt()->>'is_anonymous')::boolean IS TRUE THEN
      NEW.role := 'visitor';
    ELSE
      NEW.role := 'user';
    END IF;

    NEW.is_blocked := FALSE;
    NEW.has_custom_permissions := FALSE;
    NEW.custom_layer_permissions := NULL;
    NEW.custom_feature_permissions := NULL;
    NEW.custom_address_columns_permissions := NULL;
    NEW.custom_feature_properties_permissions := NULL;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_user_session_insert ON public.webgis_user_sessions;
CREATE TRIGGER trg_protect_user_session_insert
BEFORE INSERT ON public.webgis_user_sessions
FOR EACH ROW
EXECUTE FUNCTION public.protect_user_session_insert();

CREATE OR REPLACE FUNCTION public.protect_user_session_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Acesso negado: atualização de sessão requer autenticação válida';
  END IF;

  NEW.auth_uid := OLD.auth_uid;
  NEW.session_id := OLD.session_id;
  NEW.first_seen := OLD.first_seen;
  NEW.updated_at := NOW();

  IF NOT public.is_manager() THEN
    NEW.role := OLD.role;
    NEW.is_blocked := OLD.is_blocked;
    NEW.has_custom_permissions := OLD.has_custom_permissions;
    NEW.custom_layer_permissions := OLD.custom_layer_permissions;
    NEW.custom_feature_permissions := OLD.custom_feature_permissions;
    NEW.custom_address_columns_permissions := OLD.custom_address_columns_permissions;
    NEW.custom_feature_properties_permissions := OLD.custom_feature_properties_permissions;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_user_session_update ON public.webgis_user_sessions;
CREATE TRIGGER trg_protect_user_session_update
BEFORE UPDATE ON public.webgis_user_sessions
FOR EACH ROW
EXECUTE FUNCTION public.protect_user_session_update();

DROP POLICY IF EXISTS "Permitir acesso completo anon webgis_user_sessions" ON public.webgis_user_sessions;
DROP POLICY IF EXISTS "sessions_select_policy" ON public.webgis_user_sessions;
CREATE POLICY "sessions_select_policy"
ON public.webgis_user_sessions FOR SELECT
USING (auth_uid = auth.uid() OR public.is_manager());

DROP POLICY IF EXISTS "sessions_insert_policy" ON public.webgis_user_sessions;
CREATE POLICY "sessions_insert_policy"
ON public.webgis_user_sessions FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL AND (auth_uid IS NULL OR auth_uid = auth.uid()));

DROP POLICY IF EXISTS "sessions_update_policy" ON public.webgis_user_sessions;
CREATE POLICY "sessions_update_policy"
ON public.webgis_user_sessions FOR UPDATE
USING (auth_uid = auth.uid() OR public.is_manager())
WITH CHECK (auth_uid = auth.uid() OR public.is_manager());

DROP POLICY IF EXISTS "sessions_delete_policy" ON public.webgis_user_sessions;
CREATE POLICY "sessions_delete_policy"
ON public.webgis_user_sessions FOR DELETE
USING (public.is_master());

-- 10. Políticas RLS e Triggers: public.webgis_logs
CREATE OR REPLACE FUNCTION public.protect_and_enrich_log_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_role TEXT;
  v_recent_count INT;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Acesso negado: logs de auditoria exigem autenticação válida';
  END IF;

  NEW.actor_id := auth.uid();
  NEW.timestamp := NOW();
  NEW.created_at := NOW();
  NEW.id := COALESCE(NEW.id, 'log_' || EXTRACT(EPOCH FROM NOW())::BIGINT || '_' || substr(md5(random()::text), 1, 6));

  SELECT role INTO v_role FROM public.profiles WHERE id = auth.uid() AND is_active = TRUE;
  IF v_role IS NOT NULL THEN
    NEW.user_role := v_role;
  ELSIF (auth.jwt()->>'is_anonymous')::boolean IS TRUE THEN
    NEW.user_role := 'visitor';
  ELSE
    NEW.user_role := 'user';
  END IF;

  SELECT COUNT(*) INTO v_recent_count
  FROM public.webgis_logs
  WHERE actor_id = auth.uid()
    AND created_at > NOW() - INTERVAL '1 minute';

  IF v_recent_count >= 60 THEN
    RAISE EXCEPTION 'Limite de taxa de auditoria excedido (máximo 60 logs/min por sessão)';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_and_enrich_log_insert ON public.webgis_logs;
CREATE TRIGGER trg_protect_and_enrich_log_insert
BEFORE INSERT ON public.webgis_logs
FOR EACH ROW
EXECUTE FUNCTION public.protect_and_enrich_log_insert();

DROP POLICY IF EXISTS "Permitir acesso completo anon webgis_logs" ON public.webgis_logs;
DROP POLICY IF EXISTS "logs_select_policy" ON public.webgis_logs;
CREATE POLICY "logs_select_policy"
ON public.webgis_logs FOR SELECT
USING (public.is_manager());

DROP POLICY IF EXISTS "logs_insert_policy" ON public.webgis_logs;
CREATE POLICY "logs_insert_policy"
ON public.webgis_logs FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL AND (actor_id IS NULL OR actor_id = auth.uid()));

DROP POLICY IF EXISTS "logs_update_policy" ON public.webgis_logs;
CREATE POLICY "logs_update_policy"
ON public.webgis_logs FOR UPDATE
USING (false);

DROP POLICY IF EXISTS "logs_delete_policy" ON public.webgis_logs;
CREATE POLICY "logs_delete_policy"
ON public.webgis_logs FOR DELETE
USING (public.is_master());

-- 11. Políticas RLS: public.webgis_settings
DROP POLICY IF EXISTS "Permitir acesso completo anon webgis_settings" ON public.webgis_settings;
DROP POLICY IF EXISTS "settings_select_policy" ON public.webgis_settings;
CREATE POLICY "settings_select_policy"
ON public.webgis_settings FOR SELECT
USING (true);

DROP POLICY IF EXISTS "settings_write_policy" ON public.webgis_settings;
CREATE POLICY "settings_write_policy"
ON public.webgis_settings FOR ALL
USING (public.is_master())
WITH CHECK (public.is_master());

-- 12. Permissões de Acesso às Tabelas (Revogados privilégios perigosos de anon)
REVOKE ALL ON TABLE public.webgis_user_sessions FROM anon;
REVOKE ALL ON TABLE public.webgis_logs FROM anon;

GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT SELECT ON TABLE public.webgis_settings TO anon;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.profiles TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE ON TABLE public.webgis_user_sessions TO authenticated;
GRANT SELECT, INSERT ON TABLE public.webgis_logs TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.webgis_settings TO authenticated, service_role;

GRANT ALL ON TABLE public.webgis_user_sessions TO service_role;
GRANT ALL ON TABLE public.webgis_logs TO service_role;

-- 13. Linha inicial padrão para configurações globais
INSERT INTO public.webgis_settings (id, updated_at)
VALUES ('global', NOW())
ON CONFLICT (id) DO NOTHING;

-- 14. Recarregar o cache do PostgREST
NOTIFY pgrst, 'reload schema';
