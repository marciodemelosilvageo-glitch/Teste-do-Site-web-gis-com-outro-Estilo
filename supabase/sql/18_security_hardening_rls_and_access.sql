-- ==============================================================================
-- SCRIPT 18: FECHAMENTO TOTAL DE SEGURANÇA, RLS E ISOLAMENTO ESTRITO POR USUÁRIO
-- ==============================================================================
-- 1. RLS ATIVO EM TODAS AS 11 TABELAS: Padrão "negar tudo".
-- 2. REVOGAÇÃO COMPLETA DE ANON E PUBLIC: Nenhuma tabela ou função aberta.
-- 3. ISOLAMENTO POR auth.uid(): Cada pessoa só enxerga/altera suas próprias linhas.
-- 4. PRIVILÉGIOS ESTRITOS POR COLUNA: profiles e webgis_user_sessions blindadas contra auto-promoção.
-- 5. BLINDAGEM DE CONFIGURAÇÕES E CATÁLOGO: Leitura direta bloqueada para usuário comum;
--    acesso exclusivamente via RPC segura get_my_access_settings() e get_effective_capabilities().
-- 6. PERMISSIONS_EPOCH LIMITADA AO ESCOPO: Realtime e leitura restritos a global, papel ou id próprio.
-- 7. ALTER DEFAULT PRIVILEGES: Garante que novos objetos futuros não nasçam expostos.
-- ==============================================================================

BEGIN;

-- ==============================================================================
-- 1. FUNÇÕES AUXILIARES DE CONTEXTO E SEGURANÇA (SECURITY DEFINER + search_path)
-- ==============================================================================

DROP FUNCTION IF EXISTS public.get_current_user_role();
CREATE OR REPLACE FUNCTION public.get_current_user_role()
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

CREATE OR REPLACE FUNCTION public.can_manage_target(
  p_manager_id UUID,
  p_target_user_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_mgr_role TEXT;
  v_target_role TEXT;
  v_target_created_by TEXT;
  v_target_dept TEXT;
  v_mgr_username TEXT;
  v_scope RECORD;
BEGIN
  IF p_manager_id IS NULL OR p_target_user_id IS NULL THEN RETURN FALSE; END IF;

  IF p_manager_id = p_target_user_id THEN RETURN TRUE; END IF;

  SELECT role, username INTO v_mgr_role, v_mgr_username 
  FROM public.profiles 
  WHERE id = p_manager_id AND is_active = TRUE;

  IF v_mgr_role = 'master' THEN RETURN TRUE; END IF;
  IF v_mgr_role <> 'manager' THEN RETURN FALSE; END IF;

  SELECT role, created_by, department INTO v_target_role, v_target_created_by, v_target_dept
  FROM public.profiles 
  WHERE id = p_target_user_id;

  IF NOT FOUND THEN RETURN FALSE; END IF;

  IF v_target_role = 'master' THEN RETURN FALSE; END IF;

  SELECT * INTO v_scope FROM public.user_delegation_scopes WHERE manager_id = p_manager_id;
  IF NOT FOUND THEN
    RETURN (v_target_created_by IS NOT NULL AND lower(v_target_created_by) = lower(v_mgr_username));
  END IF;

  IF v_scope.scope_type = 'all_users' THEN
    RETURN TRUE;
  ELSIF v_scope.scope_type = 'department' THEN
    RETURN (v_target_dept = ANY(v_scope.allowed_departments));
  ELSE
    RETURN (v_target_created_by IS NOT NULL AND lower(v_target_created_by) = lower(v_mgr_username));
  END IF;
END;
$$;

-- ==============================================================================
-- 2. NOVA RPC: get_my_access_settings() (Substitui leitura direta de webgis_settings)
-- ==============================================================================

DROP FUNCTION IF EXISTS public.get_my_access_settings();
CREATE OR REPLACE FUNCTION public.get_my_access_settings()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_role TEXT := 'visitor';
  v_settings RECORD;
  v_layer_perms JSONB := '{}'::jsonb;
  v_feat_perms JSONB := '{}'::jsonb;
  v_addr_perms JSONB := '{}'::jsonb;
  v_prop_perms JSONB := '{}'::jsonb;
  v_profile RECORD;
BEGIN
  -- 2.1 Carrega dados globais de webgis_settings
  SELECT * INTO v_settings FROM public.webgis_settings WHERE id = 'global' LIMIT 1;
  IF v_settings.id IS NOT NULL THEN
    v_layer_perms := COALESCE(v_settings.layer_permissions, '{}'::jsonb);
    v_feat_perms  := COALESCE(v_settings.feature_permissions, '{}'::jsonb);
    v_addr_perms  := COALESCE(v_settings.address_columns_permissions, '{}'::jsonb);
    v_prop_perms  := COALESCE(v_settings.feature_properties_permissions, '{}'::jsonb);
  END IF;

  -- 2.2 Visitante anônimo ou sem login
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object(
      'role', 'visitor',
      'layer_permissions', v_layer_perms,
      'feature_permissions', v_feat_perms,
      'address_columns_permissions', v_addr_perms,
      'feature_properties_permissions', v_prop_perms
    );
  END IF;

  -- 2.3 Usuário autenticado: busca perfil
  SELECT * INTO v_profile FROM public.profiles WHERE id = v_uid LIMIT 1;
  IF v_profile.id IS NOT NULL THEN
    v_role := COALESCE(v_profile.role, 'user');

    -- Sobreposição individual de permissões (se ativada no perfil)
    IF v_profile.has_custom_permissions IS TRUE THEN
      IF v_profile.custom_layer_permissions IS NOT NULL THEN
        v_layer_perms := v_layer_perms || v_profile.custom_layer_permissions;
      END IF;
      IF v_profile.custom_feature_permissions IS NOT NULL THEN
        v_feat_perms := v_feat_perms || v_profile.custom_feature_permissions;
      END IF;
      IF v_profile.custom_address_columns_permissions IS NOT NULL THEN
        v_addr_perms := v_addr_perms || v_profile.custom_address_columns_permissions;
      END IF;
      IF v_profile.custom_feature_properties_permissions IS NOT NULL THEN
        v_prop_perms := v_prop_perms || v_profile.custom_feature_properties_permissions;
      END IF;
    END IF;
  ELSE
    -- Conta autenticada como anônima do Supabase
    v_role := 'visitor';
  END IF;

  RETURN jsonb_build_object(
    'role', v_role,
    'layer_permissions', v_layer_perms,
    'feature_permissions', v_feat_perms,
    'address_columns_permissions', v_addr_perms,
    'feature_properties_permissions', v_prop_perms
  );
END;
$$;

-- ==============================================================================
-- 3. BLINDAGEM DE RPCS EXISTENTES CONTRA ENUMERAÇÃO E EXECUÇÃO INDEVIDA
-- ==============================================================================

-- 3.1 get_effective_capabilities: Garante que usuário comum só consulte o próprio auth.uid()
DROP FUNCTION IF EXISTS public.get_effective_capabilities(UUID);
DROP FUNCTION IF EXISTS public.get_effective_capabilities();

CREATE OR REPLACE FUNCTION public.get_effective_capabilities(
  p_user_id UUID DEFAULT auth.uid()
)
RETURNS TABLE (
  capability_key TEXT,
  category TEXT,
  name TEXT,
  can_use BOOLEAN,
  can_grant BOOLEAN,
  source TEXT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_caller UUID := auth.uid();
  v_target UUID;
  v_caller_role TEXT;
  v_is_master BOOLEAN := FALSE;
  v_is_mgr BOOLEAN := FALSE;
  v_role TEXT;
  v_is_anon BOOLEAN := FALSE;
BEGIN
  IF v_caller IS NULL THEN
    RETURN;
  END IF;

  SELECT role INTO v_caller_role FROM public.profiles WHERE id = v_caller AND is_active = TRUE;
  IF v_caller_role = 'master' THEN
    v_is_master := TRUE;
  ELSIF v_caller_role = 'manager' THEN
    v_is_mgr := TRUE;
  END IF;

  -- Se for passado p_user_id de terceiro, exige privilégio de Master ou Gerente no alcance
  IF p_user_id IS NOT NULL AND p_user_id <> v_caller THEN
    IF v_is_master OR (v_is_mgr AND public.can_manage_target(v_caller, p_user_id)) THEN
      v_target := p_user_id;
    ELSE
      v_target := v_caller;
    END IF;
  ELSE
    v_target := v_caller;
  END IF;

  SELECT role INTO v_role
  FROM public.profiles
  WHERE id = v_target AND is_active = TRUE;

  IF v_role IS NULL THEN
    IF v_target = v_caller AND COALESCE((auth.jwt()->>'is_anonymous')::boolean, FALSE) IS TRUE THEN
      v_role := 'visitor';
    ELSE
      SELECT COALESCE(u.is_anonymous, FALSE) INTO v_is_anon FROM auth.users u WHERE u.id = v_target;
      v_role := CASE WHEN v_is_anon THEN 'visitor' ELSE 'user' END;
    END IF;
  END IF;

  IF v_role = 'master' THEN
    RETURN QUERY
    SELECT 
      c.key AS capability_key,
      c.category,
      c.name,
      TRUE AS can_use,
      TRUE AS can_grant,
      'master'::TEXT AS source
    FROM public.auth_capabilities c
    ORDER BY c.category, c.name;
    RETURN;
  END IF;

  RETURN QUERY
  SELECT 
    c.key AS capability_key,
    c.category,
    c.name,
    CASE 
      WHEN uc.effect = 'deny' THEN FALSE
      WHEN uc.effect = 'grant' THEN TRUE
      WHEN rc.can_use IS TRUE THEN TRUE
      ELSE FALSE
    END AS can_use,
    CASE
      WHEN uc.effect = 'deny' THEN FALSE
      WHEN uc.can_grant IS TRUE THEN TRUE
      WHEN rc.can_grant IS TRUE THEN TRUE
      ELSE FALSE
    END AS can_grant,
    CASE
      WHEN uc.effect IS NOT NULL THEN 'custom'
      WHEN rc.can_use IS NOT NULL THEN 'role'
      ELSE 'none'
    END::TEXT AS source
  FROM public.auth_capabilities c
  LEFT JOIN public.role_capabilities rc 
    ON rc.capability_key = c.key AND rc.role_id = v_role
  LEFT JOIN public.user_capabilities uc 
    ON uc.capability_key = c.key AND uc.user_id = v_target
  ORDER BY c.category, c.name;
END;
$$;

-- 3.2 bump_permissions_epoch: Bloqueia acionamento de usuários comuns e visitantes
DROP FUNCTION IF EXISTS public.bump_permissions_epoch(TEXT);
DROP FUNCTION IF EXISTS public.bump_permissions_epoch();

CREATE OR REPLACE FUNCTION public.bump_permissions_epoch(p_scope TEXT DEFAULT 'global')
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF current_user NOT IN ('postgres', 'service_role', 'supabase_admin') THEN
    IF NOT (public.is_master() OR public.is_manager()) THEN
      RAISE EXCEPTION 'Acesso negado: apenas administradores podem atualizar épocas de permissão.';
    END IF;
  END IF;

  INSERT INTO public.permissions_epoch (scope, epoch, updated_at)
  VALUES (COALESCE(p_scope, 'global'), 1, NOW())
  ON CONFLICT (scope) DO UPDATE SET
    epoch = public.permissions_epoch.epoch + 1,
    updated_at = NOW();
END;
$$;

-- 3.3 get_telemetry_active_sessions: Bloqueia usuários comuns
DROP FUNCTION IF EXISTS public.get_telemetry_active_sessions();

CREATE OR REPLACE FUNCTION public.get_telemetry_active_sessions()
RETURNS TABLE (
  auth_uid UUID,
  session_id TEXT,
  username TEXT,
  display_name TEXT,
  role TEXT,
  is_anonymous BOOLEAN,
  first_seen TIMESTAMPTZ,
  last_seen TIMESTAMPTZ,
  formatted_first_seen TEXT,
  formatted_last_seen TEXT,
  device TEXT,
  ip_address TEXT,
  user_agent TEXT,
  session_created_at TIMESTAMPTZ,
  session_refreshed_at TIMESTAMPTZ,
  is_online BOOLEAN,
  is_blocked BOOLEAN,
  has_custom_permissions BOOLEAN,
  custom_layer_permissions JSONB,
  custom_feature_permissions JSONB,
  custom_address_columns_permissions JSONB,
  custom_feature_properties_permissions JSONB
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  IF NOT (public.is_master() OR public.is_manager()) THEN
    RAISE EXCEPTION 'Acesso negado: apenas gerentes e o Administrador Master podem consultar a telemetria do sistema';
  END IF;

  RETURN QUERY
  SELECT
    u.id AS auth_uid,
    COALESCE(ws.session_id, u.id::text) AS session_id,
    COALESCE(p.username, (u.raw_user_meta_data->>'username'), 'anonimo') AS username,
    COALESCE(ws.custom_name, p.name, (u.raw_user_meta_data->>'name'), 'Visitante') AS display_name,
    COALESCE(p.role, ws.role, 'visitor') AS role,
    COALESCE(u.is_anonymous, FALSE) AS is_anonymous,
    COALESCE(ws.first_seen, u.created_at) AS first_seen,
    COALESCE(ws.last_seen, s.refreshed_at, s.updated_at, u.last_sign_in_at, u.created_at) AS last_seen,
    COALESCE(ws.formatted_first_seen, to_char(u.created_at, 'DD/MM/YYYY HH24:MI:SS')) AS formatted_first_seen,
    COALESCE(ws.formatted_last_seen, to_char(COALESCE(ws.last_seen, u.last_sign_in_at), 'DD/MM/YYYY HH24:MI:SS')) AS formatted_last_seen,
    COALESCE(ws.device, CASE
      WHEN s.user_agent ILIKE '%android%' THEN 'Android'
      WHEN s.user_agent ILIKE '%iphone%' OR s.user_agent ILIKE '%ipad%' THEN 'iOS'
      WHEN s.user_agent ILIKE '%windows%' THEN 'Windows'
      WHEN s.user_agent ILIKE '%macintosh%' OR s.user_agent ILIKE '%mac os%' THEN 'macOS'
      WHEN s.user_agent ILIKE '%linux%' THEN 'Linux'
      ELSE 'Navegador Web'
    END) AS device,
    -- Mascarar IP para segurança se não for master
    CASE
      WHEN public.is_master() THEN host(s.ip)::text
      ELSE regexp_replace(host(s.ip)::text, '(\d+)\.(\d+)\.(\d+)\.(\d+)', '\1.\2.***.***')
    END AS ip_address,
    COALESCE(s.user_agent, 'Desconhecido') AS user_agent,
    COALESCE(s.created_at, u.created_at) AS session_created_at,
    COALESCE(s.refreshed_at, s.updated_at, u.last_sign_in_at) AS session_refreshed_at,
    (COALESCE(ws.last_seen, s.refreshed_at, s.updated_at, u.last_sign_in_at) > NOW() - INTERVAL '3 minutes') AS is_online,
    COALESCE(p.is_active = FALSE, ws.is_blocked, FALSE) AS is_blocked,
    COALESCE(ws.has_custom_permissions, FALSE) AS has_custom_permissions,
    ws.custom_layer_permissions,
    ws.custom_feature_permissions,
    ws.custom_address_columns_permissions,
    ws.custom_feature_properties_permissions
  FROM auth.users u
  LEFT JOIN public.profiles p ON p.id = u.id
  LEFT JOIN public.webgis_user_sessions ws ON ws.auth_uid = u.id
  LEFT JOIN LATERAL (
    SELECT s_inner.ip, s_inner.user_agent, s_inner.created_at, s_inner.updated_at, s_inner.refreshed_at
    FROM auth.sessions s_inner
    WHERE s_inner.user_id = u.id
    ORDER BY s_inner.updated_at DESC
    LIMIT 1
  ) s ON true
  WHERE
    (public.is_master() OR (public.is_manager() AND (p.id IS NULL OR public.can_manage_target(auth.uid(), p.id)) AND (p.role IS NULL OR p.role != 'master')))
  ORDER BY COALESCE(ws.last_seen, u.last_sign_in_at, u.created_at) DESC;
END;
$$;

-- ==============================================================================
-- 4. REVOGAÇÃO GERAL DE ANON E PUBLIC (FECHAMENTO TOTAL DE PRIVILÉGIOS)
-- ==============================================================================

REVOKE ALL ON SCHEMA public FROM anon, PUBLIC;
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

-- Revoga todos os privilégios das 11 tabelas de anon e PUBLIC
REVOKE ALL ON TABLE public.profiles FROM anon, PUBLIC;
REVOKE ALL ON TABLE public.webgis_settings FROM anon, PUBLIC;
REVOKE ALL ON TABLE public.auth_capabilities FROM anon, PUBLIC;
REVOKE ALL ON TABLE public.base_roles FROM anon, PUBLIC;
REVOKE ALL ON TABLE public.role_capabilities FROM anon, PUBLIC;
REVOKE ALL ON TABLE public.user_capabilities FROM anon, PUBLIC;
REVOKE ALL ON TABLE public.user_delegation_scopes FROM anon, PUBLIC;
REVOKE ALL ON TABLE public.capability_audit_logs FROM anon, PUBLIC;
REVOKE ALL ON TABLE public.webgis_user_sessions FROM anon, PUBLIC;
REVOKE ALL ON TABLE public.webgis_logs FROM anon, PUBLIC;
REVOKE ALL ON TABLE public.permissions_epoch FROM anon, PUBLIC;

-- Revoga EXECUTE em todas as funções de anon e PUBLIC
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM anon, PUBLIC;

-- Configura privilégios padrão futuros estritos
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon, PUBLIC;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon, PUBLIC;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM anon, PUBLIC;

-- ==============================================================================
-- 5. ATIVAÇÃO DE RLS EM TODAS AS 11 TABELAS
-- ==============================================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webgis_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auth_capabilities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.base_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_capabilities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_capabilities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_delegation_scopes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.capability_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webgis_user_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webgis_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.permissions_epoch ENABLE ROW LEVEL SECURITY;

-- ==============================================================================
-- 6. REMOÇÃO DE TODAS AS POLÍTICAS ANTIGAS E COM USING (true)
-- ==============================================================================

-- profiles
DROP POLICY IF EXISTS "Perfis sao visiveis publicamente" ON public.profiles;
DROP POLICY IF EXISTS "Perfis são visíveis publicamente" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_all" ON public.profiles;
DROP POLICY IF EXISTS "profiles_read_all" ON public.profiles;
DROP POLICY IF EXISTS "profiles_self_update" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_isolated" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_isolated" ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert_master" ON public.profiles;
DROP POLICY IF EXISTS "profiles_delete_master" ON public.profiles;

-- webgis_settings
DROP POLICY IF EXISTS "settings_read_all" ON public.webgis_settings;
DROP POLICY IF EXISTS "settings_write_master" ON public.webgis_settings;
DROP POLICY IF EXISTS "settings_select_admin" ON public.webgis_settings;

-- auth_capabilities
DROP POLICY IF EXISTS "capabilities_read_all" ON public.auth_capabilities;
DROP POLICY IF EXISTS "capabilities_write_master" ON public.auth_capabilities;
DROP POLICY IF EXISTS "auth_caps_select_admin" ON public.auth_capabilities;
DROP POLICY IF EXISTS "auth_caps_write_master" ON public.auth_capabilities;

-- base_roles
DROP POLICY IF EXISTS "roles_read_all" ON public.base_roles;
DROP POLICY IF EXISTS "roles_write_master" ON public.base_roles;
DROP POLICY IF EXISTS "base_roles_select_admin" ON public.base_roles;
DROP POLICY IF EXISTS "base_roles_write_master" ON public.base_roles;

-- role_capabilities
DROP POLICY IF EXISTS "role_caps_read_all" ON public.role_capabilities;
DROP POLICY IF EXISTS "role_caps_write_master" ON public.role_capabilities;
DROP POLICY IF EXISTS "role_caps_select_admin" ON public.role_capabilities;
DROP POLICY IF EXISTS "role_caps_write_admin" ON public.role_capabilities;

-- user_capabilities
DROP POLICY IF EXISTS "user_caps_read" ON public.user_capabilities;
DROP POLICY IF EXISTS "user_caps_write" ON public.user_capabilities;
DROP POLICY IF EXISTS "user_caps_select_isolated" ON public.user_capabilities;
DROP POLICY IF EXISTS "user_caps_write_admin" ON public.user_capabilities;

-- user_delegation_scopes
DROP POLICY IF EXISTS "delegation_scopes_read" ON public.user_delegation_scopes;
DROP POLICY IF EXISTS "delegation_scopes_write" ON public.user_delegation_scopes;
DROP POLICY IF EXISTS "delegation_scopes_select_admin" ON public.user_delegation_scopes;
DROP POLICY IF EXISTS "delegation_scopes_write_master" ON public.user_delegation_scopes;

-- capability_audit_logs
DROP POLICY IF EXISTS "audit_logs_read" ON public.capability_audit_logs;
DROP POLICY IF EXISTS "audit_logs_write" ON public.capability_audit_logs;
DROP POLICY IF EXISTS "capability_audit_select_admin" ON public.capability_audit_logs;
DROP POLICY IF EXISTS "capability_audit_insert_admin" ON public.capability_audit_logs;

-- webgis_user_sessions
DROP POLICY IF EXISTS "sessions_select_policy" ON public.webgis_user_sessions;
DROP POLICY IF EXISTS "sessions_insert_policy" ON public.webgis_user_sessions;
DROP POLICY IF EXISTS "sessions_update_policy" ON public.webgis_user_sessions;
DROP POLICY IF EXISTS "sessions_delete_policy" ON public.webgis_user_sessions;
DROP POLICY IF EXISTS "sessions_select_isolated" ON public.webgis_user_sessions;
DROP POLICY IF EXISTS "sessions_insert_own" ON public.webgis_user_sessions;
DROP POLICY IF EXISTS "sessions_update_own" ON public.webgis_user_sessions;
DROP POLICY IF EXISTS "sessions_delete_master" ON public.webgis_user_sessions;

-- webgis_logs
DROP POLICY IF EXISTS "logs_select_policy" ON public.webgis_logs;
DROP POLICY IF EXISTS "logs_insert_policy" ON public.webgis_logs;
DROP POLICY IF EXISTS "logs_delete_policy" ON public.webgis_logs;
DROP POLICY IF EXISTS "logs_select_isolated" ON public.webgis_logs;
DROP POLICY IF EXISTS "logs_insert_own" ON public.webgis_logs;
DROP POLICY IF EXISTS "logs_delete_master" ON public.webgis_logs;

-- permissions_epoch
DROP POLICY IF EXISTS "Leitura publica de permissions_epoch" ON public.permissions_epoch;
DROP POLICY IF EXISTS "epoch_select_scoped" ON public.permissions_epoch;

-- ==============================================================================
-- 7. CONCESSÃO DE PRIVILÉGIOS MÍNIMOS POR COLUNA PARA AUTHENTICATED
-- ==============================================================================

-- 7.1 profiles: Leitura de dados cadastrais; UPDATE apenas em colunas não-privilegiadas
GRANT SELECT (id, username, name, role, department, is_active, must_change_password, created_by, created_at, updated_at)
  ON public.profiles TO authenticated;
GRANT UPDATE (name, department, updated_at)
  ON public.profiles TO authenticated;
-- Master e rotinas de backend possuem controle total via service_role ou funções SECURITY DEFINER

-- 7.2 webgis_user_sessions: Inserção e leitura da própria sessão; UPDATE só de batimento cardíaco (last_seen)
GRANT SELECT (session_id, custom_name, first_seen, last_seen, formatted_first_seen, formatted_last_seen, role, is_blocked, auth_uid)
  ON public.webgis_user_sessions TO authenticated;
GRANT INSERT (session_id, custom_name, first_seen, last_seen, formatted_first_seen, formatted_last_seen, role, is_blocked, auth_uid)
  ON public.webgis_user_sessions TO authenticated;
GRANT UPDATE (last_seen, formatted_last_seen)
  ON public.webgis_user_sessions TO authenticated;

-- 7.3 webgis_logs: Leitura e inserção apenas
GRANT SELECT, INSERT ON public.webgis_logs TO authenticated;

-- 7.4 permissions_epoch: Leitura apenas (escrita exclusiva de triggers e RPC)
GRANT SELECT ON public.permissions_epoch TO authenticated;

-- 7.5 Tabelas de gestão: Concessão para authenticated (RLS filtrará quem é Master/Gerente)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_capabilities TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_delegation_scopes TO authenticated;
GRANT SELECT, INSERT ON public.capability_audit_logs TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.webgis_settings TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.auth_capabilities TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.base_roles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.role_capabilities TO authenticated;

-- Service role mantém acesso administrativo total
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;

-- ==============================================================================
-- 8. POLÍTICAS RLS ESTRITAS POR USUÁRIO (ISOLAMENTO TOTAL)
-- ==============================================================================

-- 8.1 profiles
CREATE POLICY "profiles_select_isolated" ON public.profiles
FOR SELECT TO authenticated
USING (
  id = auth.uid()
  OR public.is_master()
  OR (public.is_manager() AND public.can_manage_target(auth.uid(), id))
);

CREATE POLICY "profiles_update_isolated" ON public.profiles
FOR UPDATE TO authenticated
USING (
  (id = auth.uid() AND is_active = TRUE)
  OR public.is_master()
  OR (public.is_manager() AND public.can_manage_target(auth.uid(), id))
)
WITH CHECK (
  (id = auth.uid() AND is_active = TRUE)
  OR public.is_master()
  OR (public.is_manager() AND public.can_manage_target(auth.uid(), id))
);

CREATE POLICY "profiles_insert_master" ON public.profiles
FOR INSERT TO authenticated
WITH CHECK (
  public.is_master() OR (public.is_manager() AND (created_by IS NOT NULL))
);

CREATE POLICY "profiles_delete_master" ON public.profiles
FOR DELETE TO authenticated
USING (public.is_master());

-- 8.2 webgis_user_sessions
CREATE POLICY "sessions_select_isolated" ON public.webgis_user_sessions
FOR SELECT TO authenticated
USING (
  auth_uid = auth.uid()
  OR public.is_master()
  OR (public.is_manager() AND public.can_manage_target(auth.uid(), auth_uid))
);

CREATE POLICY "sessions_insert_own" ON public.webgis_user_sessions
FOR INSERT TO authenticated
WITH CHECK (auth_uid = auth.uid());

CREATE POLICY "sessions_update_own" ON public.webgis_user_sessions
FOR UPDATE TO authenticated
USING (auth_uid = auth.uid() OR public.is_master())
WITH CHECK (auth_uid = auth.uid() OR public.is_master());

CREATE POLICY "sessions_delete_master" ON public.webgis_user_sessions
FOR DELETE TO authenticated
USING (public.is_master());

-- 8.3 webgis_logs
CREATE POLICY "logs_select_isolated" ON public.webgis_logs
FOR SELECT TO authenticated
USING (
  actor_id = auth.uid()
  OR public.is_master()
  OR public.is_manager()
);

CREATE POLICY "logs_insert_own" ON public.webgis_logs
FOR INSERT TO authenticated
WITH CHECK (actor_id = auth.uid());

CREATE POLICY "logs_delete_master" ON public.webgis_logs
FOR DELETE TO authenticated
USING (public.is_master());

-- 8.4 user_capabilities
CREATE POLICY "user_caps_select_isolated" ON public.user_capabilities
FOR SELECT TO authenticated
USING (
  user_id = auth.uid()
  OR public.is_master()
  OR (public.is_manager() AND public.can_manage_target(auth.uid(), user_id))
);

CREATE POLICY "user_caps_write_admin" ON public.user_capabilities
FOR ALL TO authenticated
USING (
  public.is_master()
  OR (public.is_manager() AND public.can_manage_target(auth.uid(), user_id))
)
WITH CHECK (
  public.is_master()
  OR (public.is_manager() AND public.can_manage_target(auth.uid(), user_id))
);

-- 8.5 user_delegation_scopes
CREATE POLICY "delegation_scopes_select_admin" ON public.user_delegation_scopes
FOR SELECT TO authenticated
USING (
  manager_id = auth.uid()
  OR public.is_master()
);

CREATE POLICY "delegation_scopes_write_master" ON public.user_delegation_scopes
FOR ALL TO authenticated
USING (public.is_master())
WITH CHECK (public.is_master());

-- 8.6 capability_audit_logs
CREATE POLICY "capability_audit_select_admin" ON public.capability_audit_logs
FOR SELECT TO authenticated
USING (public.is_master() OR public.is_manager());

CREATE POLICY "capability_audit_insert_admin" ON public.capability_audit_logs
FOR INSERT TO authenticated
WITH CHECK (
  performed_by = auth.uid() AND (public.is_master() OR public.is_manager())
);

-- 8.7 webgis_settings (Configuração geral do sistema)
CREATE POLICY "settings_select_admin" ON public.webgis_settings
FOR SELECT TO authenticated
USING (public.is_master() OR public.is_manager());

CREATE POLICY "settings_write_master" ON public.webgis_settings
FOR ALL TO authenticated
USING (public.is_master())
WITH CHECK (public.is_master());

-- 8.8 auth_capabilities (Catálogo de poderes)
CREATE POLICY "auth_caps_select_admin" ON public.auth_capabilities
FOR SELECT TO authenticated
USING (public.is_master() OR public.is_manager());

CREATE POLICY "auth_caps_write_master" ON public.auth_capabilities
FOR ALL TO authenticated
USING (public.is_master())
WITH CHECK (public.is_master());

-- 8.9 base_roles (Papéis base)
CREATE POLICY "base_roles_select_admin" ON public.base_roles
FOR SELECT TO authenticated
USING (public.is_master() OR public.is_manager());

CREATE POLICY "base_roles_write_master" ON public.base_roles
FOR ALL TO authenticated
USING (public.is_master())
WITH CHECK (public.is_master());

-- 8.10 role_capabilities (Matriz perfil-poder)
CREATE POLICY "role_caps_select_admin" ON public.role_capabilities
FOR SELECT TO authenticated
USING (public.is_master() OR public.is_manager());

CREATE POLICY "role_caps_write_admin" ON public.role_capabilities
FOR ALL TO authenticated
USING (public.is_master())
WITH CHECK (public.is_master());

-- 8.11 permissions_epoch (Realtime e sincronização)
CREATE POLICY "epoch_select_scoped" ON public.permissions_epoch
FOR SELECT TO authenticated
USING (
  scope = 'global'
  OR scope = ('role:' || public.get_current_user_role())
  OR scope = ('user:' || auth.uid()::text)
  OR public.is_master()
  OR public.is_manager()
);

-- ==============================================================================
-- 9. CONCESSÃO DE EXECUÇÃO EXCLUSIVA A AUTHENTICATED NAS RPCS NECESSÁRIAS
-- ==============================================================================

DO $$
BEGIN
  -- Funções criadas diretamente pelo Script 18
  EXECUTE 'GRANT EXECUTE ON FUNCTION public.get_my_access_settings() TO anon, authenticated, service_role';
  EXECUTE 'GRANT EXECUTE ON FUNCTION public.get_effective_capabilities(UUID) TO authenticated, service_role';
  EXECUTE 'GRANT EXECUTE ON FUNCTION public.is_master() TO authenticated, service_role';
  EXECUTE 'GRANT EXECUTE ON FUNCTION public.is_manager() TO authenticated, service_role';
  EXECUTE 'GRANT EXECUTE ON FUNCTION public.get_current_user_role() TO authenticated, service_role';
  EXECUTE 'GRANT EXECUTE ON FUNCTION public.bump_permissions_epoch(TEXT) TO authenticated, service_role';
  EXECUTE 'GRANT EXECUTE ON FUNCTION public.get_telemetry_active_sessions() TO authenticated, service_role';

  -- Concessão segura e defensiva para RPCs auxiliares existentes (ignora se não estiverem instaladas)
  BEGIN
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.can(TEXT, UUID) TO authenticated, service_role';
  EXCEPTION WHEN undefined_function THEN NULL;
  END;

  BEGIN
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.can_grant(TEXT, UUID) TO authenticated, service_role';
  EXCEPTION WHEN undefined_function THEN NULL;
  END;

  BEGIN
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.can_manage_target(UUID, UUID) TO authenticated, service_role';
  EXCEPTION WHEN undefined_function THEN NULL;
  END;

  BEGIN
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.record_trusted_auth_event(TEXT, TEXT, TEXT) TO authenticated, service_role';
  EXCEPTION WHEN undefined_function THEN NULL;
  END;

  BEGIN
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.admin_delete_user(UUID) TO authenticated, service_role';
  EXCEPTION WHEN undefined_function THEN NULL;
  END;

  BEGIN
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.admin_cleanup_orphan_user(TEXT) TO authenticated, service_role';
  EXCEPTION WHEN undefined_function THEN NULL;
  END;

  BEGIN
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.cleanup_stale_telemetry_and_anonymous(INT, INT) TO authenticated, service_role';
  EXCEPTION WHEN undefined_function THEN NULL;
  END;
END;
$$;

COMMIT;

NOTIFY pgrst, 'reload schema';
