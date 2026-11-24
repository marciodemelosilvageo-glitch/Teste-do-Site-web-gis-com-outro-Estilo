-- ==============================================================================
-- SCRIPT 00: INSTALAÇÃO COMPLETA E UNIFICADA DO WEBGIS (BANCO NOVO OU ATUALIZAÇÃO)
-- ==============================================================================
-- Este script executa a configuração completa do banco de dados em UMA ÚNICA ETAPA.
-- Pode ser executado em um banco novo do Supabase ou em um banco existente.
-- É 100% idempotente (pode ser executado várias vezes com total segurança).
--
-- Contém:
-- 1. Remoção defensiva de triggers temporários para evitar conflitos na carga.
-- 2. Criação de todas as 11 tabelas estruturais.
-- 3. Funções auxiliares e RPCs com bypass seguro para o DBA (SQL Editor).
-- 4. Seed inicial dos perfis base e catálogo de capacidades.
-- 5. Ativação de triggers de integridade, proteção contra auto-elevação e auditoria.
-- 6. Hardening total de RLS, concessão por coluna e bloqueio de anon.
-- 7. Ativação do Supabase Realtime (permissions_epoch e profiles).
-- ==============================================================================

BEGIN;

-- ==============================================================================
-- 1. REMOÇÃO DEFENSIVA DE TRIGGERS PRÉVIOS (EVITA DISPAROS INDEVIDOS NA MIGRAÇÃO)
-- ==============================================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'auth_capabilities') THEN
    DROP TRIGGER IF EXISTS trg_epoch_auth_capabilities ON public.auth_capabilities;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'base_roles') THEN
    DROP TRIGGER IF EXISTS trg_epoch_base_roles ON public.base_roles;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'role_capabilities') THEN
    DROP TRIGGER IF EXISTS trg_epoch_role_capabilities ON public.role_capabilities;
    DROP TRIGGER IF EXISTS trg_auto_provision_capability_and_role ON public.role_capabilities;
    DROP TRIGGER IF EXISTS trg_normalize_role_capability_input ON public.role_capabilities;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'user_capabilities') THEN
    DROP TRIGGER IF EXISTS trg_epoch_user_capabilities ON public.user_capabilities;
    DROP TRIGGER IF EXISTS trg_protect_user_capabilities_write ON public.user_capabilities;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'user_delegation_scopes') THEN
    DROP TRIGGER IF EXISTS trg_epoch_user_delegation_scopes ON public.user_delegation_scopes;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'webgis_settings') THEN
    DROP TRIGGER IF EXISTS trg_epoch_webgis_settings ON public.webgis_settings;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'profiles') THEN
    DROP TRIGGER IF EXISTS trg_epoch_profiles ON public.profiles;
    DROP TRIGGER IF EXISTS trg_prevent_self_elevation ON public.profiles;
    DROP TRIGGER IF EXISTS trg_protect_master_profile ON public.profiles;
    DROP TRIGGER IF EXISTS trg_protect_master_delete ON public.profiles;
  END IF;
END $$;

-- ==============================================================================
-- 2. CRIAÇÃO DAS 11 TABELAS ESTRUTURAIS
-- ==============================================================================

-- 2.1 Perfis de Usuários (public.profiles)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('master', 'manager', 'user', 'site_account', 'visitor', 'admin')) DEFAULT 'user',
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

-- 2.2 Configurações Globais (public.webgis_settings)
CREATE TABLE IF NOT EXISTS public.webgis_settings (
  id TEXT PRIMARY KEY,
  layer_permissions JSONB,
  feature_permissions JSONB,
  address_columns_permissions JSONB,
  feature_properties_permissions JSONB,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  data JSONB
);

-- 2.3 Monitoramento de Sessões e Visitantes (public.webgis_user_sessions)
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

-- 2.4 Logs de Atividades e Auditoria (public.webgis_logs)
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

-- 2.5 Catálogo Mestre de Capacidades (public.auth_capabilities)
CREATE TABLE IF NOT EXISTS public.auth_capabilities (
  key TEXT PRIMARY KEY,
  category TEXT NOT NULL CHECK (category IN ('camadas', 'ferramentas', 'dados', 'conta', 'administracao')),
  name TEXT NOT NULL,
  description TEXT,
  risk_level TEXT NOT NULL DEFAULT 'low' CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2.6 Perfis Base Editáveis (public.base_roles)
CREATE TABLE IF NOT EXISTS public.base_roles (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  is_system BOOLEAN NOT NULL DEFAULT FALSE,
  hierarchy_level INT NOT NULL DEFAULT 10,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2.7 Matriz Perfil-Poder (public.role_capabilities)
CREATE TABLE IF NOT EXISTS public.role_capabilities (
  role_id TEXT NOT NULL REFERENCES public.base_roles(id) ON DELETE CASCADE,
  capability_key TEXT NOT NULL REFERENCES public.auth_capabilities(key) ON DELETE CASCADE,
  can_use BOOLEAN NOT NULL DEFAULT TRUE,
  can_grant BOOLEAN NOT NULL DEFAULT FALSE,
  effect TEXT NOT NULL DEFAULT 'allow' CHECK (effect IN ('allow', 'deny')),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (role_id, capability_key)
);

-- 2.8 Exceções Individuais por Usuário (public.user_capabilities)
CREATE TABLE IF NOT EXISTS public.user_capabilities (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  capability_key TEXT NOT NULL REFERENCES public.auth_capabilities(key) ON DELETE CASCADE,
  can_use BOOLEAN NOT NULL DEFAULT TRUE,
  can_grant BOOLEAN NOT NULL DEFAULT FALSE,
  effect TEXT NOT NULL DEFAULT 'allow' CHECK (effect IN ('allow', 'deny')),
  granted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, capability_key)
);

-- 2.9 Escopos de Delegação de Gerentes (public.user_delegation_scopes)
CREATE TABLE IF NOT EXISTS public.user_delegation_scopes (
  manager_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  scope_type TEXT NOT NULL DEFAULT 'team_only' CHECK (scope_type IN ('team_only', 'department', 'all_users')),
  allowed_departments TEXT[] NOT NULL DEFAULT '{}',
  can_manage_site_accounts BOOLEAN NOT NULL DEFAULT TRUE,
  can_manage_visitors BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- 2.10 Auditoria de Alteração de Poderes (public.capability_audit_logs)
CREATE TABLE IF NOT EXISTS public.capability_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  performed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  performed_by_name TEXT,
  target_type TEXT NOT NULL CHECK (target_type IN ('user', 'base_role', 'global')),
  target_id TEXT NOT NULL,
  capability_key TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('grant_use', 'revoke_use', 'grant_delegate', 'revoke_delegate', 'set_deny', 'remove_override')),
  before_state JSONB,
  after_state JSONB,
  reason TEXT
);

-- 2.11 Tabela de Época de Permissões (public.permissions_epoch)
CREATE TABLE IF NOT EXISTS public.permissions_epoch (
  scope TEXT PRIMARY KEY,
  epoch BIGINT NOT NULL DEFAULT 1,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices de Performance
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);
CREATE INDEX IF NOT EXISTS idx_role_capabilities_role ON public.role_capabilities(role_id);
CREATE INDEX IF NOT EXISTS idx_user_capabilities_user ON public.user_capabilities(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_time ON public.capability_audit_logs(timestamp DESC);

-- ==============================================================================
-- 3. FUNÇÕES AUXILIARES DE CONTEXTO E SEGURANÇA (SECURITY DEFINER + search_path)
-- ==============================================================================

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

-- is_master(): Reconhece o DBA (SQL Editor / postgres) e service_role
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

-- is_manager(): Reconhece o DBA (SQL Editor / postgres) e service_role
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

-- bump_permissions_epoch: Atualiza contador para propagação Realtime em ~1s
CREATE OR REPLACE FUNCTION public.bump_permissions_epoch(p_scope TEXT DEFAULT 'global')
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Permite chamadas internas do DBA / triggers e bloqueia usuários comuns via API
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
  IF current_user IN ('postgres', 'service_role', 'supabase_admin') AND auth.uid() IS NULL THEN
    RETURN TRUE;
  END IF;

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

CREATE OR REPLACE FUNCTION public.can(
  p_capability TEXT,
  p_user_id UUID DEFAULT auth.uid()
)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role TEXT;
  v_user_effect TEXT;
  v_user_can_use BOOLEAN;
  v_role_effect TEXT;
  v_role_can_use BOOLEAN;
BEGIN
  IF p_user_id IS NULL THEN
    SELECT effect, can_use INTO v_role_effect, v_role_can_use
    FROM public.role_capabilities
    WHERE role_id = 'visitor' AND capability_key = p_capability;
    IF v_role_effect = 'deny' THEN RETURN FALSE; END IF;
    RETURN COALESCE(v_role_can_use, FALSE);
  END IF;

  SELECT role INTO v_role FROM public.profiles WHERE id = p_user_id AND is_active = TRUE;
  IF v_role = 'master' THEN RETURN TRUE; END IF;

  SELECT effect, can_use INTO v_user_effect, v_user_can_use
  FROM public.user_capabilities
  WHERE user_id = p_user_id AND capability_key = p_capability;

  IF FOUND THEN
    IF v_user_effect = 'deny' THEN RETURN FALSE; END IF;
    RETURN v_user_can_use;
  END IF;

  IF v_role IS NULL THEN v_role := 'visitor'; END IF;

  SELECT effect, can_use INTO v_role_effect, v_role_can_use
  FROM public.role_capabilities
  WHERE role_id = v_role AND capability_key = p_capability;

  IF FOUND THEN
    IF v_role_effect = 'deny' THEN RETURN FALSE; END IF;
    RETURN v_role_can_use;
  END IF;

  RETURN FALSE;
END;
$$;

CREATE OR REPLACE FUNCTION public.can_grant(
  p_capability TEXT,
  p_user_id UUID DEFAULT auth.uid()
)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role TEXT;
  v_can_grant BOOLEAN;
BEGIN
  IF p_user_id IS NULL THEN RETURN FALSE; END IF;

  SELECT role INTO v_role FROM public.profiles WHERE id = p_user_id AND is_active = TRUE;
  IF v_role = 'master' THEN RETURN TRUE; END IF;

  SELECT can_grant INTO v_can_grant
  FROM public.user_capabilities
  WHERE user_id = p_user_id AND capability_key = p_capability AND effect = 'allow';

  IF FOUND THEN RETURN COALESCE(v_can_grant, FALSE); END IF;

  SELECT can_grant INTO v_can_grant
  FROM public.role_capabilities
  WHERE role_id = v_role AND capability_key = p_capability AND effect = 'allow';

  RETURN COALESCE(v_can_grant, FALSE);
END;
$$;

-- ==============================================================================
-- 4. RPCS PRINCIPAIS EXPIRADAS AO FRONTEND (SECURITY DEFINER + search_path)
-- ==============================================================================

-- 4.1 get_my_access_settings (Lê permissões sem erro de coluna inexistente system_config)
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
  SELECT * INTO v_settings FROM public.webgis_settings WHERE id = 'global' LIMIT 1;
  IF v_settings.id IS NOT NULL THEN
    v_layer_perms := COALESCE(v_settings.layer_permissions, '{}'::jsonb);
    v_feat_perms  := COALESCE(v_settings.feature_permissions, '{}'::jsonb);
    v_addr_perms  := COALESCE(v_settings.address_columns_permissions, '{}'::jsonb);
    v_prop_perms  := COALESCE(v_settings.feature_properties_permissions, '{}'::jsonb);
  END IF;

  IF v_uid IS NULL THEN
    RETURN jsonb_build_object(
      'role', 'visitor',
      'layer_permissions', v_layer_perms,
      'feature_permissions', v_feat_perms,
      'address_columns_permissions', v_addr_perms,
      'feature_properties_permissions', v_prop_perms
    );
  END IF;

  SELECT * INTO v_profile FROM public.profiles WHERE id = v_uid LIMIT 1;
  IF v_profile.id IS NOT NULL THEN
    v_role := COALESCE(v_profile.role, 'user');

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

-- 4.2 get_effective_capabilities (Lê catálogo de poderes resolvidos para o usuário)
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
SET search_path = public
AS $$
DECLARE
  v_caller UUID := auth.uid();
  v_target UUID;
  v_caller_role TEXT;
  v_is_master BOOLEAN := FALSE;
  v_is_mgr BOOLEAN := FALSE;
  v_role TEXT;
BEGIN
  IF v_caller IS NULL THEN RETURN; END IF;

  SELECT role INTO v_caller_role FROM public.profiles WHERE id = v_caller AND is_active = TRUE;
  IF v_caller_role = 'master' THEN v_is_master := TRUE;
  ELSIF v_caller_role = 'manager' THEN v_is_mgr := TRUE; END IF;

  IF p_user_id IS NOT NULL AND p_user_id <> v_caller THEN
    IF v_is_master OR (v_is_mgr AND public.can_manage_target(v_caller, p_user_id)) THEN
      v_target := p_user_id;
    ELSE
      v_target := v_caller;
    END IF;
  ELSE
    v_target := v_caller;
  END IF;

  SELECT role INTO v_role FROM public.profiles WHERE id = v_target AND is_active = TRUE;

  IF v_role = 'master' THEN
    RETURN QUERY
    SELECT c.key, c.category, c.name, TRUE, TRUE, 'master'::TEXT
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
  LEFT JOIN public.role_capabilities rc ON rc.capability_key = c.key AND rc.role_id = COALESCE(v_role, 'user')
  LEFT JOIN public.user_capabilities uc ON uc.capability_key = c.key AND uc.user_id = v_target
  ORDER BY c.category, c.name;
END;
$$;

-- 4.3 get_telemetry_active_sessions (Telemetria com mascaramento de IP para gerente)
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
  IF current_user NOT IN ('postgres', 'service_role', 'supabase_admin') THEN
    IF NOT (public.is_master() OR public.is_manager()) THEN
      RAISE EXCEPTION 'Acesso negado: apenas gerentes e o Administrador Master podem consultar a telemetria do sistema';
    END IF;
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

-- 4.4 admin_delete_user (Exclusão atômica de usuário em profiles e auth.users)
CREATE OR REPLACE FUNCTION public.admin_delete_user(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_caller_role TEXT;
  v_target_role TEXT;
BEGIN
  IF current_user NOT IN ('postgres', 'service_role', 'supabase_admin') THEN
    SELECT role INTO v_caller_role FROM public.profiles WHERE id = auth.uid() AND is_active = TRUE;
    IF v_caller_role != 'master' AND NOT public.is_master() THEN
      RAISE EXCEPTION 'Acesso negado: apenas o Administrador Master pode excluir contas de usuários.';
    END IF;
  END IF;

  IF p_user_id = auth.uid() THEN
    RAISE EXCEPTION 'Operação inválida: você não pode excluir sua própria conta Master.';
  END IF;

  SELECT role INTO v_target_role FROM public.profiles WHERE id = p_user_id;
  IF v_target_role = 'master' THEN
    RAISE EXCEPTION 'Operação inválida: não é permitido excluir outra conta Master.';
  END IF;

  DELETE FROM public.profiles WHERE id = p_user_id;
  DELETE FROM auth.users WHERE id = p_user_id;

  RETURN jsonb_build_object('success', TRUE, 'deleted_user_id', p_user_id);
END;
$$;

-- 4.5 admin_cleanup_orphan_user (Limpeza de credenciais órfãs em auth.users)
CREATE OR REPLACE FUNCTION public.admin_cleanup_orphan_user(p_username TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_caller_role TEXT;
  v_clean_user TEXT;
  v_target_email TEXT;
  v_orphan_id UUID;
  v_target_role TEXT;
BEGIN
  IF current_user NOT IN ('postgres', 'service_role', 'supabase_admin') THEN
    IF NOT public.is_master() THEN
      RAISE EXCEPTION 'Acesso negado: apenas o Administrador Master pode executar esta ação.';
    END IF;
  END IF;

  v_clean_user := lower(trim(replace(p_username, '@', '')));
  v_target_email := v_clean_user || '@usuarios.webgis';

  SELECT id INTO v_orphan_id FROM auth.users WHERE lower(email) = v_target_email;
  IF v_orphan_id IS NOT NULL THEN
    IF v_orphan_id = auth.uid() THEN
      RAISE EXCEPTION 'Operação inválida: não é permitido remover a conta Master.';
    END IF;

    SELECT role INTO v_target_role FROM public.profiles WHERE id = v_orphan_id;
    IF v_target_role = 'master' THEN
      RAISE EXCEPTION 'Operação inválida: não é permitido remover outra conta Master.';
    END IF;

    DELETE FROM public.profiles WHERE id = v_orphan_id;
    DELETE FROM auth.users WHERE id = v_orphan_id;

    RETURN jsonb_build_object('success', TRUE, 'cleaned_id', v_orphan_id, 'username', v_clean_user);
  END IF;

  RETURN jsonb_build_object('success', FALSE, 'message', 'Usuário não encontrado em auth.users');
END;
$$;

-- 4.6 cleanup_stale_telemetry_and_anonymous (Expurgo de telemetria e visitantes inativos)
CREATE OR REPLACE FUNCTION public.cleanup_stale_telemetry_and_anonymous(
  p_anon_retention_days INT DEFAULT 30,
  p_log_retention_days INT DEFAULT 90
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_purged_logs INT := 0;
  v_purged_sessions INT := 0;
  v_purged_anon_users INT := 0;
  v_log_cutoff TIMESTAMPTZ := NOW() - (p_log_retention_days || ' days')::INTERVAL;
  v_anon_cutoff TIMESTAMPTZ := NOW() - (p_anon_retention_days || ' days')::INTERVAL;
BEGIN
  IF current_user NOT IN ('postgres', 'service_role', 'supabase_admin') THEN
    IF NOT public.is_master() THEN
      RAISE EXCEPTION 'Acesso negado: apenas o Administrador Master possui permissão de expurgo de dados';
    END IF;
  END IF;

  WITH d_logs AS (DELETE FROM public.webgis_logs WHERE created_at < v_log_cutoff RETURNING 1)
  SELECT COUNT(*) INTO v_purged_logs FROM d_logs;

  WITH d_sess AS (DELETE FROM public.webgis_user_sessions WHERE role = 'visitor' AND last_seen < v_anon_cutoff RETURNING 1)
  SELECT COUNT(*) INTO v_purged_sessions FROM d_sess;

  WITH d_users AS (DELETE FROM auth.users WHERE is_anonymous = TRUE AND COALESCE(last_sign_in_at, created_at) < v_anon_cutoff RETURNING 1)
  SELECT COUNT(*) INTO v_purged_anon_users FROM d_users;

  INSERT INTO public.webgis_logs (id, timestamp, formatted_date, user_role, category, action, details, session_id, actor_id, created_at)
  VALUES (
    'log_' || EXTRACT(EPOCH FROM NOW())::BIGINT || '_purge',
    NOW(),
    to_char(NOW(), 'DD/MM/YYYY HH24:MI:SS'),
    'master',
    'ADMIN',
    'EXPURGO_TELEMETRIA',
    format('Expurgo concluído: %s logs, %s sessões anônimas, %s usuários anônimos', v_purged_logs, v_purged_sessions, v_purged_anon_users),
    auth.uid()::text,
    auth.uid(),
    NOW()
  );

  RETURN jsonb_build_object(
    'success', TRUE,
    'purged_logs', v_purged_logs,
    'purged_sessions', v_purged_sessions,
    'purged_anon_users', v_purged_anon_users
  );
END;
$$;

-- 4.7 record_trusted_auth_event
CREATE OR REPLACE FUNCTION public.record_trusted_auth_event(
  p_event_type TEXT,
  p_action TEXT,
  p_details TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_role TEXT := 'visitor';
  v_log_id TEXT := 'log_' || EXTRACT(EPOCH FROM NOW())::BIGINT || '_' || substr(md5(random()::text), 1, 6);
BEGIN
  IF auth.uid() IS NOT NULL THEN
    SELECT role INTO v_role FROM public.profiles WHERE id = auth.uid() AND is_active = TRUE;
  END IF;

  INSERT INTO public.webgis_logs (id, timestamp, formatted_date, user_role, category, action, details, session_id, actor_id, created_at)
  VALUES (
    v_log_id, NOW(), to_char(NOW(), 'DD/MM/YYYY HH24:MI:SS'),
    COALESCE(v_role, 'visitor'), COALESCE(p_event_type, 'AUTH'), p_action, p_details,
    auth.uid()::text, auth.uid(), NOW()
  );

  RETURN jsonb_build_object('success', TRUE, 'log_id', v_log_id);
END;
$$;

-- ==============================================================================
-- 5. SEED INICIAL DE DADOS (CONFIGURAÇÕES, PAPÉIS E CAPACIDADES)
-- ==============================================================================

-- Linha inicial de webgis_settings
INSERT INTO public.webgis_settings (id, updated_at)
VALUES ('global', NOW())
ON CONFLICT (id) DO NOTHING;

-- 4 Perfis Fundamentais
INSERT INTO public.base_roles (id, name, description, is_system, hierarchy_level)
VALUES
  ('visitor', 'Visitante Anônimo', 'Cidadão público ou visitante sem autenticação formal', TRUE, 0),
  ('site_account', 'Conta do Site', 'Usuário cadastrado pelo formulário público do site', TRUE, 10),
  ('user', 'Usuário Credenciado', 'Usuário institucional cadastrado pela gestão', TRUE, 20),
  ('manager', 'Gerente de Equipe', 'Gestor de equipe com poderes de delegação autorizados', TRUE, 50)
ON CONFLICT (id) DO UPDATE 
SET name = EXCLUDED.name, description = EXCLUDED.description, is_system = TRUE;

-- Catálogo Mestre de Capacidades
INSERT INTO public.auth_capabilities (key, category, name, description, risk_level)
VALUES
  ('tool:cnefe_search', 'ferramentas', 'Busca CNEFE de Endereços', 'Pesquisa textual e tabular em mais de 450 mil endereços', 'low'),
  ('tool:advanced_search', 'ferramentas', 'Busca Avançada', 'Filtros combinados de endereço, setor e bairro', 'low'),
  ('tool:search_by_type', 'ferramentas', 'Buscar por Tipo', 'Busca rápida de farmácias, restaurantes, postos, hotéis e hospitais', 'low'),
  ('tool:search_area_addresses', 'ferramentas', 'Buscar Endereços na Área', 'Varredura de endereços contidos em polígono ou medição', 'medium'),
  ('tool:measure', 'ferramentas', 'Ferramenta de Medição', 'Cálculo de distâncias lineares e áreas territoriais no mapa', 'low'),
  ('tool:print_a4', 'ferramentas', 'Impressão de Mapas em A4', 'Geração e impressão de mapas temáticos com cabeçalho', 'low'),
  ('tool:layer_panel', 'ferramentas', 'Painel de Camadas', 'Ativação, desativação e reordenação de camadas cartográficas', 'low'),
  ('tool:raio_x', 'ferramentas', 'Dashboard Raio-X Urbano', 'Estatísticas demográficas, domiciliares e socioeconômicas', 'low'),
  ('tool:selected_features', 'ferramentas', 'Painel de Feições Selecionadas', 'Visualização de lista e detalhes das feições clicadas', 'low'),
  ('tool:feature_specs', 'ferramentas', 'Especificações da Feição', 'Exibição técnica detalhada dos atributos da feição', 'low'),
  ('tool:sources_footer', 'ferramentas', 'Rodapé de Fontes e Metadados', 'Exibição de fontes cartográficas oficiais no rodapé', 'low'),
  ('tool:search_active_layers_only', 'ferramentas', 'Pesquisar Somente nas Camadas Ativas', 'Restringe o escopo da busca às camadas ligadas no mapa', 'low'),
  ('tool:dissolve_features', 'ferramentas', 'Dissolver Feições', 'Unificação geométrica de polígonos adjacentes selecionados', 'medium'),
  ('tool:multi_select', 'ferramentas', 'Multiseleção de Feições', 'Seleção simultânea de múltiplas feições no mapa', 'low'),
  ('tool:customize_useful_info', 'ferramentas', 'Personalizar Informações Úteis', 'Configuração de quais atributos aparecem no resumo de feição', 'low'),
  ('tool:basemap_selector', 'ferramentas', 'Seletor de Mapa Base', 'Alternância entre satélite, relevo, escuro e mapas de rua', 'low'),
  ('tool:map_legend', 'ferramentas', 'Legenda Cartográfica', 'Exibição da legenda visual das camadas ativas', 'low'),
  ('data:export:csv', 'dados', 'Exportar em CSV', 'Exportação de tabelas de feições ou endereços para formato CSV', 'low'),
  ('data:export:kml', 'dados', 'Exportar em KML', 'Download de camadas e áreas no formato Google Earth KML', 'low'),
  ('data:export:kmz', 'dados', 'Exportar em KMZ', 'Download de camadas compactadas no formato KMZ', 'low'),
  ('data:export:geojson', 'dados', 'Exportar em GeoJSON', 'Exportação de geometrias vetoriais em GeoJSON', 'low'),
  ('data:export:shapefile', 'dados', 'Exportar em Shapefile (ZIP)', 'Download de feições no padrão vetorial ESRI Shapefile', 'medium'),
  ('data:export:geopackage', 'dados', 'Exportar em GeoPackage (GPKG)', 'Download em padrão geoespacial aberto GeoPackage OGC', 'medium'),
  ('data:limit:unlimited_rows', 'dados', 'Exportação sem Limite de Linhas', 'Permite exportar mais de 50.000 linhas sem truncamento', 'high'),
  ('account:self_register', 'conta', 'Autocadastro pelo Site', 'Capacidade de criar uma conta própria a partir da tela inicial', 'low'),
  ('account:change_own_password', 'conta', 'Trocar a Própria Senha', 'Permissão para alterar sua própria senha de acesso', 'low'),
  ('account:edit_own_profile', 'conta', 'Editar o Próprio Perfil', 'Permissão para alterar seu nome e dados de contato', 'low'),
  ('admin:panel:access', 'administracao', 'Acesso ao Painel de Controle', 'Visualização do botão e abertura da tela administrativa', 'medium'),
  ('admin:users:view', 'administracao', 'Visualizar Lista de Usuários', 'Consulta de usuários cadastrados e sessões de visitantes', 'medium'),
  ('admin:users:create', 'administracao', 'Criar Novos Usuários', 'Geração de novos logins institucionais para o sistema', 'high'),
  ('admin:users:reset_password', 'administracao', 'Redefinir Senhas de Terceiros', 'Definição de nova senha provisória para outros usuários', 'high'),
  ('admin:users:block', 'administracao', 'Bloquear e Ativar Contas', 'Interrupção ou liberação imediata do acesso de um usuário', 'high'),
  ('admin:users:delete', 'administracao', 'Excluir Contas de Usuários', 'Exclusão definitiva de credenciais e perfis do sistema', 'critical'),
  ('admin:users:promote_manager', 'administracao', 'Promover Usuário a Gerente', 'Elevação de usuário comum ao cargo de Gerente de Equipe', 'critical'),
  ('admin:roles:manage', 'administracao', 'Gerenciar Perfis Base e Catálogo', 'Edição de poderes atribuídos a Visitante, Usuário, etc.', 'critical'),
  ('admin:global_settings:manage', 'administracao', 'Gerenciar Configurações Globais', 'Alteração de parâmetros e regras globais do WebGIS', 'critical'),
  ('admin:logs:view', 'administracao', 'Visualizar Logs de Auditoria', 'Leitura do histórico de acessos, buscas e ações de usuários', 'medium'),
  ('admin:logs:export', 'administracao', 'Exportar Logs para CSV', 'Download completo da trilha de auditoria e atividades', 'high'),
  ('admin:logs:clear', 'administracao', 'Limpar Histórico de Logs', 'Exclusão de registros antigos de auditoria', 'critical'),
  ('admin:simulate:profile', 'administracao', 'Simular Visão ("Ver como")', 'Navegar no sistema simulando os poderes de outro perfil', 'high')
ON CONFLICT (key) DO UPDATE 
SET name = EXCLUDED.name, description = EXCLUDED.description, category = EXCLUDED.category, risk_level = EXCLUDED.risk_level;

-- Colunas de Endereço CNEFE
INSERT INTO public.auth_capabilities (key, category, name, description, risk_level)
VALUES
  ('data:address_col:codigo_unico', 'dados', 'Coluna CNEFE: Código único', 'Exibição do identificador único do endereço', 'low'),
  ('data:address_col:municipio', 'dados', 'Coluna CNEFE: Município', 'Exibição do nome do município', 'low'),
  ('data:address_col:endereco', 'dados', 'Coluna CNEFE: Endereço', 'Exibição do logradouro e nome da rua/avenida', 'low'),
  ('data:address_col:numero_logradouro', 'dados', 'Coluna CNEFE: Número', 'Exibição do número predial do endereço', 'low'),
  ('data:address_col:complemento', 'dados', 'Coluna CNEFE: Complemento', 'Exibição de apartamento, bloco, sala, etc.', 'low'),
  ('data:address_col:bairro', 'dados', 'Coluna CNEFE: Bairro', 'Exibição do bairro territorial', 'low'),
  ('data:address_col:subdistrito', 'dados', 'Coluna CNEFE: Subdistrito/Zona', 'Exibição da zona ou subdistrito municipal', 'low'),
  ('data:address_col:localidade', 'dados', 'Coluna CNEFE: Localidade', 'Exibição do nome da localidade', 'low'),
  ('data:address_col:nucleo_urbano', 'dados', 'Coluna CNEFE: Núcleo Urbano', 'Exibição do núcleo urbano IBGE', 'low'),
  ('data:address_col:favela_comunidade', 'dados', 'Coluna CNEFE: Favela/Comunidade', 'Identificação de favelas ou comunidades urbanas', 'low'),
  ('data:address_col:agromerado', 'dados', 'Coluna CNEFE: Aglomerado', 'Identificação de aglomerados subnormais', 'low'),
  ('data:address_col:comunidade_rural', 'dados', 'Coluna CNEFE: Comunidade Rural', 'Exibição de comunidades rurais', 'low'),
  ('data:address_col:latitude', 'dados', 'Coluna CNEFE: Latitude', 'Exibição das coordenadas de latitude', 'low'),
  ('data:address_col:longitude', 'dados', 'Coluna CNEFE: Longitude', 'Exibição das coordenadas de longitude', 'low'),
  ('data:address_col:codigo_setor', 'dados', 'Coluna CNEFE: Código do Setor', 'Exibição do geocódigo do setor censitário', 'low'),
  ('data:address_col:estabelecimento', 'dados', 'Coluna CNEFE: Estabelecimento', 'Identificação do nome do estabelecimento', 'low'),
  ('data:address_col:especie', 'dados', 'Coluna CNEFE: Espécie', 'Classificação: domicílio particular, coletivo, etc.', 'low'),
  ('data:address_col:ind_estabelecimento', 'dados', 'Coluna CNEFE: Indicador de Estabelecimento', 'Indicador de tipo de estabelecimento', 'low'),
  ('data:address_col:ind_construcao_reforma', 'dados', 'Coluna CNEFE: Construção/Reforma', 'Status de obra no endereço', 'low'),
  ('data:address_col:ind_finalidade_construcao', 'dados', 'Coluna CNEFE: Finalidade da Construção', 'Finalidade residencial, comercial ou mista', 'low'),
  ('data:address_col:tipo_edificacao', 'dados', 'Coluna CNEFE: Tipo de Edificação', 'Casa, apartamento, etc.', 'low')
ON CONFLICT (key) DO NOTHING;

-- Camadas Padrão
INSERT INTO public.auth_capabilities (key, category, name, description, risk_level)
VALUES
  ('layer:Teresina', 'camadas', 'Camada: Limite Municipal de Teresina', 'Polígono do contorno do município de Teresina', 'low'),
  ('layer:Bairros', 'camadas', 'Camada: Bairros', 'Malha dos bairros oficiais de Teresina', 'low'),
  ('layer:Setores Censitarios', 'camadas', 'Camada: Setores Censitários', 'Divisões censitárias oficiais do Censo IBGE 2022', 'low'),
  ('layer:Localidades', 'camadas', 'Camada: Localidades', 'Pontos e áreas de localidades rurais e urbanas', 'low'),
  ('layer:Comunidades Rurais', 'camadas', 'Camada: Comunidades Rurais', 'Delimitação das comunidades rurais do município', 'low'),
  ('layer:Favelas e Comunidades Urbanas', 'camadas', 'Camada: Favelas e Comunidades Urbanas', 'Delimitações territoriais de comunidades urbanas', 'low'),
  ('layer:Nucleos Urbanos', 'camadas', 'Camada: Núcleos Urbanos', 'Núcleos urbanos do IBGE', 'low'),
  ('layer:Aglomerados Urbanos', 'camadas', 'Camada: Aglomerados Urbanos', 'Aglomerados populacionais urbanos', 'low'),
  ('layer:Subdistritos', 'camadas', 'Camada: Subdistritos', 'Subdivisões administrativas de Teresina', 'low'),
  ('layer:Distritos', 'camadas', 'Camada: Distritos', 'Distritos municipais', 'low'),
  ('layer:Regioes Integradas (RISP)', 'camadas', 'Camada: RISP', 'Regiões Integradas de Segurança Pública', 'low'),
  ('layer:Areas Integradas (AISP)', 'camadas', 'Camada: AISP', 'Áreas Integradas de Segurança Pública', 'low'),
  ('layer:Areas de Desenvolvimento', 'camadas', 'Camada: Áreas de Desenvolvimento', 'Áreas de Planejamento e Desenvolvimento municipal', 'low'),
  ('layer:Concentracao Urbana', 'camadas', 'Camada: Concentração Urbana', 'Mancha urbana concentrada', 'low'),
  ('layer:Regiao Intermediaria', 'camadas', 'Camada: Região Intermediária', 'Região geográfica intermediária do IBGE', 'low'),
  ('layer:Regiao Imediata', 'camadas', 'Camada: Região Imediata', 'Região geográfica imediata de Teresina', 'low'),
  ('layer:Equipamentos Publicos', 'camadas', 'Camada: Equipamentos Públicos', 'Escolas, postos de saúde, hospitais e delegacias', 'low')
ON CONFLICT (key) DO NOTHING;

-- Matriz Padrão de Poderes por Perfil Base
INSERT INTO public.role_capabilities (role_id, capability_key, can_use, can_grant, effect)
SELECT 'visitor', key, TRUE, FALSE, 'allow' FROM public.auth_capabilities
WHERE key IN ('tool:cnefe_search', 'tool:search_by_type', 'tool:layer_panel', 'tool:raio_x', 'tool:selected_features', 'tool:feature_specs', 'tool:sources_footer', 'tool:search_active_layers_only', 'tool:basemap_selector', 'tool:map_legend', 'account:self_register')
ON CONFLICT (role_id, capability_key) DO UPDATE SET can_use = TRUE;

INSERT INTO public.role_capabilities (role_id, capability_key, can_use, can_grant, effect)
SELECT 'visitor', key, TRUE, FALSE, 'allow' FROM public.auth_capabilities WHERE category = 'camadas' OR key LIKE 'data:address_col:%'
ON CONFLICT (role_id, capability_key) DO NOTHING;

INSERT INTO public.role_capabilities (role_id, capability_key, can_use, can_grant, effect)
SELECT 'site_account', capability_key, can_use, FALSE, effect FROM public.role_capabilities WHERE role_id = 'visitor'
ON CONFLICT (role_id, capability_key) DO NOTHING;

INSERT INTO public.role_capabilities (role_id, capability_key, can_use, can_grant, effect)
VALUES
  ('site_account', 'account:change_own_password', TRUE, FALSE, 'allow'),
  ('site_account', 'account:edit_own_profile', TRUE, FALSE, 'allow'),
  ('site_account', 'tool:measure', TRUE, FALSE, 'allow'),
  ('site_account', 'data:export:csv', TRUE, FALSE, 'allow'),
  ('site_account', 'data:export:geojson', TRUE, FALSE, 'allow')
ON CONFLICT (role_id, capability_key) DO UPDATE SET can_use = TRUE;

INSERT INTO public.role_capabilities (role_id, capability_key, can_use, can_grant, effect)
SELECT 'user', key, TRUE, FALSE, 'allow' FROM public.auth_capabilities WHERE category IN ('camadas', 'dados', 'ferramentas')
ON CONFLICT (role_id, capability_key) DO UPDATE SET can_use = TRUE;

INSERT INTO public.role_capabilities (role_id, capability_key, can_use, can_grant, effect)
VALUES
  ('user', 'account:change_own_password', TRUE, FALSE, 'allow'),
  ('user', 'account:edit_own_profile', TRUE, FALSE, 'allow')
ON CONFLICT (role_id, capability_key) DO NOTHING;

INSERT INTO public.role_capabilities (role_id, capability_key, can_use, can_grant, effect)
SELECT 'manager', key, TRUE, TRUE, 'allow' FROM public.auth_capabilities WHERE category IN ('camadas', 'ferramentas', 'dados')
ON CONFLICT (role_id, capability_key) DO UPDATE SET can_use = TRUE, can_grant = TRUE;

INSERT INTO public.role_capabilities (role_id, capability_key, can_use, can_grant, effect)
VALUES
  ('manager', 'admin:panel:access', TRUE, FALSE, 'allow'),
  ('manager', 'admin:users:view', TRUE, FALSE, 'allow'),
  ('manager', 'admin:users:create', TRUE, TRUE, 'allow'),
  ('manager', 'admin:users:reset_password', TRUE, FALSE, 'allow'),
  ('manager', 'admin:logs:view', TRUE, FALSE, 'allow'),
  ('manager', 'admin:logs:export', TRUE, FALSE, 'allow'),
  ('manager', 'account:change_own_password', TRUE, FALSE, 'allow'),
  ('manager', 'account:edit_own_profile', TRUE, FALSE, 'allow')
ON CONFLICT (role_id, capability_key) DO UPDATE SET can_use = TRUE;

-- Seed inicial de Épocas
INSERT INTO public.permissions_epoch (scope, epoch, updated_at)
VALUES
  ('global', 1, NOW()),
  ('role:visitor', 1, NOW()),
  ('role:site_account', 1, NOW()),
  ('role:user', 1, NOW()),
  ('role:manager', 1, NOW())
ON CONFLICT (scope) DO NOTHING;

-- ==============================================================================
-- 6. TRIGGERS DE INTEGRIDADE, SESSÃO E AUDITORIA
-- ==============================================================================

-- 6.1 Auto-cadastro de novos usuários (ignora visitantes anônimos para não poluir profiles)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF COALESCE(NEW.is_anonymous, FALSE) IS TRUE OR (NEW.email IS NULL AND NEW.raw_user_meta_data->>'username' IS NULL) THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.profiles (
    id, username, name, role, is_active, must_change_password, created_by, created_at, updated_at
  )
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    'user', TRUE, FALSE, 'Auto-cadastro (Site)', NOW(), NOW()
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
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 6.2 Prevenção contra auto-elevação e proteção do Master
CREATE OR REPLACE FUNCTION public.prevent_self_elevation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF current_user IN ('postgres', 'supabase_admin', 'service_role') AND auth.uid() IS NULL THEN
    NEW.updated_at = NOW();
    RETURN NEW;
  END IF;

  IF NOT public.is_master() THEN
    NEW.role = OLD.role;
    NEW.is_active = OLD.is_active;
    NEW.manager_permissions = OLD.manager_permissions;
    NEW.username = OLD.username;
    NEW.has_custom_permissions = OLD.has_custom_permissions;
    NEW.custom_layer_permissions = OLD.custom_layer_permissions;
    NEW.custom_feature_permissions = OLD.custom_feature_permissions;
    NEW.custom_address_columns_permissions = OLD.custom_address_columns_permissions;
    NEW.custom_feature_properties_permissions = OLD.custom_feature_properties_permissions;
    NEW.created_by = OLD.created_by;
    NEW.created_at = OLD.created_at;

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
FOR EACH ROW EXECUTE FUNCTION public.prevent_self_elevation();

-- 6.3 Cascata na exclusão: profiles -> auth.users
CREATE OR REPLACE FUNCTION public.trg_delete_auth_user_on_profile_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM auth.users WHERE id = OLD.id) THEN
    DELETE FROM auth.users WHERE id = OLD.id;
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_delete_auth_user_on_profile_delete ON public.profiles;
CREATE TRIGGER trg_delete_auth_user_on_profile_delete
AFTER DELETE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.trg_delete_auth_user_on_profile_delete();

-- 6.4 Proteção de Sessões (INSERT e UPDATE forçados pelo servidor)
CREATE OR REPLACE FUNCTION public.protect_user_session_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_role TEXT;
BEGIN
  IF current_user IN ('postgres', 'service_role', 'supabase_admin') AND auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

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
    IF v_role IS NOT NULL THEN NEW.role := v_role;
    ELSIF (auth.jwt()->>'is_anonymous')::boolean IS TRUE THEN NEW.role := 'visitor';
    ELSE NEW.role := 'user'; END IF;

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
FOR EACH ROW EXECUTE FUNCTION public.protect_user_session_insert();

CREATE OR REPLACE FUNCTION public.protect_user_session_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  IF current_user IN ('postgres', 'service_role', 'supabase_admin') AND auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

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
FOR EACH ROW EXECUTE FUNCTION public.protect_user_session_update();

-- 6.5 Proteção de Logs (Sanitização e Rate Limit)
CREATE OR REPLACE FUNCTION public.protect_and_enrich_log_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_role TEXT;
  v_count INT;
BEGIN
  IF current_user IN ('postgres', 'service_role', 'supabase_admin') AND auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Acesso negado: logs de auditoria exigem autenticação válida';
  END IF;

  NEW.actor_id := auth.uid();
  NEW.timestamp := NOW();
  NEW.created_at := NOW();
  NEW.id := COALESCE(NEW.id, 'log_' || EXTRACT(EPOCH FROM NOW())::BIGINT || '_' || substr(md5(random()::text), 1, 6));

  SELECT role INTO v_role FROM public.profiles WHERE id = auth.uid() AND is_active = TRUE;
  IF v_role IS NOT NULL THEN NEW.user_role := v_role;
  ELSIF (auth.jwt()->>'is_anonymous')::boolean IS TRUE THEN NEW.user_role := 'visitor';
  ELSE NEW.user_role := 'user'; END IF;

  SELECT COUNT(*) INTO v_count FROM public.webgis_logs
  WHERE actor_id = auth.uid() AND created_at > NOW() - INTERVAL '1 minute';
  IF v_count >= 60 THEN
    RAISE EXCEPTION 'Limite de taxa de auditoria excedido (máximo 60 logs/min por sessão)';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_and_enrich_log_insert ON public.webgis_logs;
CREATE TRIGGER trg_protect_and_enrich_log_insert
BEFORE INSERT ON public.webgis_logs
FOR EACH ROW EXECUTE FUNCTION public.protect_and_enrich_log_insert();

-- 6.6 Auto-provisioning em role_capabilities (elimina erro FK 409)
CREATE OR REPLACE FUNCTION public.auto_provision_capability_and_role()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.role_id := replace(NEW.role_id, 'role:', '');
  NEW.updated_at := NOW();
  IF NEW.effect IS NULL THEN
    NEW.effect := CASE WHEN NEW.can_use IS TRUE THEN 'allow' ELSE 'deny' END;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.base_roles WHERE id = NEW.role_id) THEN
    INSERT INTO public.base_roles (id, name, description, is_system, hierarchy_level)
    VALUES (NEW.role_id, INITCAP(NEW.role_id), 'Perfil ' || NEW.role_id, TRUE, 10)
    ON CONFLICT (id) DO NOTHING;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.auth_capabilities WHERE key = NEW.capability_key) THEN
    INSERT INTO public.auth_capabilities (key, category, name, description, risk_level)
    VALUES (
      NEW.capability_key,
      CASE
        WHEN NEW.capability_key LIKE 'layer:%' THEN 'camadas'
        WHEN NEW.capability_key LIKE 'data:%' THEN 'dados'
        WHEN NEW.capability_key LIKE 'account:%' THEN 'conta'
        ELSE 'ferramentas'
      END,
      NEW.capability_key, 'Capacidade registrada automaticamente', 'low'
    )
    ON CONFLICT (key) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_provision_capability_and_role ON public.role_capabilities;
CREATE TRIGGER trg_auto_provision_capability_and_role
BEFORE INSERT OR UPDATE ON public.role_capabilities
FOR EACH ROW EXECUTE FUNCTION public.auto_provision_capability_and_role();

-- 6.7 Trigger Centralizado de Propagação de Época para Realtime
CREATE OR REPLACE FUNCTION public.trg_bump_permissions_epoch()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.permissions_epoch (scope, epoch, updated_at)
  VALUES ('global', 1, NOW())
  ON CONFLICT (scope) DO UPDATE
  SET epoch = public.permissions_epoch.epoch + 1,
      updated_at = NOW();
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_epoch_role_capabilities ON public.role_capabilities;
CREATE TRIGGER trg_epoch_role_capabilities AFTER INSERT OR UPDATE OR DELETE ON public.role_capabilities FOR EACH ROW EXECUTE FUNCTION public.trg_bump_permissions_epoch();

DROP TRIGGER IF EXISTS trg_epoch_user_capabilities ON public.user_capabilities;
CREATE TRIGGER trg_epoch_user_capabilities AFTER INSERT OR UPDATE OR DELETE ON public.user_capabilities FOR EACH ROW EXECUTE FUNCTION public.trg_bump_permissions_epoch();

DROP TRIGGER IF EXISTS trg_epoch_webgis_settings ON public.webgis_settings;
CREATE TRIGGER trg_epoch_webgis_settings AFTER INSERT OR UPDATE OR DELETE ON public.webgis_settings FOR EACH ROW EXECUTE FUNCTION public.trg_bump_permissions_epoch();

DROP TRIGGER IF EXISTS trg_epoch_profiles ON public.profiles;
CREATE TRIGGER trg_epoch_profiles AFTER UPDATE OR DELETE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.trg_bump_permissions_epoch();

-- ==============================================================================
-- 7. HARDENING TOTAL DE PRIVILÉGIOS (REVOGAÇÕES E CONCESSÕES POR COLUNA)
-- ==============================================================================

REVOKE ALL ON SCHEMA public FROM anon, PUBLIC;
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

-- Revoga privilégios gerais de tabelas de anon e PUBLIC
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
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM anon, PUBLIC;

-- Concessões mínimas por coluna para AUTHENTICATED
GRANT SELECT (id, username, name, role, department, is_active, must_change_password, created_by, created_at, updated_at) ON public.profiles TO authenticated;
GRANT UPDATE (name, department, updated_at) ON public.profiles TO authenticated;

GRANT SELECT (session_id, custom_name, first_seen, last_seen, formatted_first_seen, formatted_last_seen, role, is_blocked, auth_uid) ON public.webgis_user_sessions TO authenticated;
GRANT INSERT (session_id, custom_name, first_seen, last_seen, formatted_first_seen, formatted_last_seen, role, is_blocked, auth_uid) ON public.webgis_user_sessions TO authenticated;
GRANT UPDATE (last_seen, formatted_last_seen) ON public.webgis_user_sessions TO authenticated;

GRANT SELECT, INSERT ON public.webgis_logs TO authenticated;
GRANT SELECT ON public.permissions_epoch TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_capabilities TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_delegation_scopes TO authenticated;
GRANT SELECT, INSERT ON public.capability_audit_logs TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.webgis_settings TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.auth_capabilities TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.base_roles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.role_capabilities TO authenticated;

GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;

-- ==============================================================================
-- 8. ATIVAÇÃO DE RLS E POLÍTICAS ESTRITAS POR USUÁRIO (ISOLAMENTO TOTAL)
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

-- Limpeza de políticas prévias
DROP POLICY IF EXISTS "profiles_select_isolated" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_isolated" ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert_master" ON public.profiles;
DROP POLICY IF EXISTS "profiles_delete_master" ON public.profiles;
DROP POLICY IF EXISTS "sessions_select_isolated" ON public.webgis_user_sessions;
DROP POLICY IF EXISTS "sessions_insert_own" ON public.webgis_user_sessions;
DROP POLICY IF EXISTS "sessions_update_own" ON public.webgis_user_sessions;
DROP POLICY IF EXISTS "sessions_delete_master" ON public.webgis_user_sessions;
DROP POLICY IF EXISTS "logs_select_isolated" ON public.webgis_logs;
DROP POLICY IF EXISTS "logs_insert_own" ON public.webgis_logs;
DROP POLICY IF EXISTS "logs_delete_master" ON public.webgis_logs;
DROP POLICY IF EXISTS "user_caps_select_isolated" ON public.user_capabilities;
DROP POLICY IF EXISTS "user_caps_write_admin" ON public.user_capabilities;
DROP POLICY IF EXISTS "delegation_scopes_select_admin" ON public.user_delegation_scopes;
DROP POLICY IF EXISTS "delegation_scopes_write_master" ON public.user_delegation_scopes;
DROP POLICY IF EXISTS "capability_audit_select_admin" ON public.capability_audit_logs;
DROP POLICY IF EXISTS "capability_audit_insert_admin" ON public.capability_audit_logs;
DROP POLICY IF EXISTS "settings_select_admin" ON public.webgis_settings;
DROP POLICY IF EXISTS "settings_write_master" ON public.webgis_settings;
DROP POLICY IF EXISTS "auth_caps_select_admin" ON public.auth_capabilities;
DROP POLICY IF EXISTS "auth_caps_write_master" ON public.auth_capabilities;
DROP POLICY IF EXISTS "base_roles_select_admin" ON public.base_roles;
DROP POLICY IF EXISTS "base_roles_write_master" ON public.base_roles;
DROP POLICY IF EXISTS "role_caps_select_admin" ON public.role_capabilities;
DROP POLICY IF EXISTS "role_caps_write_admin" ON public.role_capabilities;
DROP POLICY IF EXISTS "epoch_select_scoped" ON public.permissions_epoch;

-- 8.1 profiles
CREATE POLICY "profiles_select_isolated" ON public.profiles FOR SELECT TO authenticated
USING (id = auth.uid() OR public.is_master() OR (public.is_manager() AND public.can_manage_target(auth.uid(), id)));

CREATE POLICY "profiles_update_isolated" ON public.profiles FOR UPDATE TO authenticated
USING ((id = auth.uid() AND is_active = TRUE) OR public.is_master() OR (public.is_manager() AND public.can_manage_target(auth.uid(), id)))
WITH CHECK ((id = auth.uid() AND is_active = TRUE) OR public.is_master() OR (public.is_manager() AND public.can_manage_target(auth.uid(), id)));

CREATE POLICY "profiles_insert_master" ON public.profiles FOR INSERT TO authenticated
WITH CHECK (public.is_master() OR (public.is_manager() AND (created_by IS NOT NULL)));

CREATE POLICY "profiles_delete_master" ON public.profiles FOR DELETE TO authenticated
USING (public.is_master());

-- 8.2 webgis_user_sessions
CREATE POLICY "sessions_select_isolated" ON public.webgis_user_sessions FOR SELECT TO authenticated
USING (auth_uid = auth.uid() OR public.is_master() OR (public.is_manager() AND public.can_manage_target(auth.uid(), auth_uid)));

CREATE POLICY "sessions_insert_own" ON public.webgis_user_sessions FOR INSERT TO authenticated
WITH CHECK (auth_uid = auth.uid());

CREATE POLICY "sessions_update_own" ON public.webgis_user_sessions FOR UPDATE TO authenticated
USING (auth_uid = auth.uid() OR public.is_master())
WITH CHECK (auth_uid = auth.uid() OR public.is_master());

CREATE POLICY "sessions_delete_master" ON public.webgis_user_sessions FOR DELETE TO authenticated
USING (public.is_master());

-- 8.3 webgis_logs
CREATE POLICY "logs_select_isolated" ON public.webgis_logs FOR SELECT TO authenticated
USING (actor_id = auth.uid() OR public.is_master() OR public.is_manager());

CREATE POLICY "logs_insert_own" ON public.webgis_logs FOR INSERT TO authenticated
WITH CHECK (actor_id = auth.uid());

CREATE POLICY "logs_delete_master" ON public.webgis_logs FOR DELETE TO authenticated
USING (public.is_master());

-- 8.4 user_capabilities
CREATE POLICY "user_caps_select_isolated" ON public.user_capabilities FOR SELECT TO authenticated
USING (user_id = auth.uid() OR public.is_master() OR (public.is_manager() AND public.can_manage_target(auth.uid(), user_id)));

CREATE POLICY "user_caps_write_admin" ON public.user_capabilities FOR ALL TO authenticated
USING (public.is_master() OR (public.is_manager() AND public.can_manage_target(auth.uid(), user_id)))
WITH CHECK (public.is_master() OR (public.is_manager() AND public.can_manage_target(auth.uid(), user_id)));

-- 8.5 user_delegation_scopes
CREATE POLICY "delegation_scopes_select_admin" ON public.user_delegation_scopes FOR SELECT TO authenticated
USING (manager_id = auth.uid() OR public.is_master());

CREATE POLICY "delegation_scopes_write_master" ON public.user_delegation_scopes FOR ALL TO authenticated
USING (public.is_master()) WITH CHECK (public.is_master());

-- 8.6 capability_audit_logs
CREATE POLICY "capability_audit_select_admin" ON public.capability_audit_logs FOR SELECT TO authenticated
USING (public.is_master() OR public.is_manager());

CREATE POLICY "capability_audit_insert_admin" ON public.capability_audit_logs FOR INSERT TO authenticated
WITH CHECK (performed_by = auth.uid() AND (public.is_master() OR public.is_manager()));

-- 8.7 webgis_settings
CREATE POLICY "settings_select_admin" ON public.webgis_settings FOR SELECT TO authenticated
USING (public.is_master() OR public.is_manager());

CREATE POLICY "settings_write_master" ON public.webgis_settings FOR ALL TO authenticated
USING (public.is_master()) WITH CHECK (public.is_master());

-- 8.8 auth_capabilities
CREATE POLICY "auth_caps_select_admin" ON public.auth_capabilities FOR SELECT TO authenticated
USING (public.is_master() OR public.is_manager());

CREATE POLICY "auth_caps_write_master" ON public.auth_capabilities FOR ALL TO authenticated
USING (public.is_master()) WITH CHECK (public.is_master());

-- 8.9 base_roles
CREATE POLICY "base_roles_select_admin" ON public.base_roles FOR SELECT TO authenticated
USING (public.is_master() OR public.is_manager());

CREATE POLICY "base_roles_write_master" ON public.base_roles FOR ALL TO authenticated
USING (public.is_master()) WITH CHECK (public.is_master());

-- 8.10 role_capabilities
CREATE POLICY "role_caps_select_admin" ON public.role_capabilities FOR SELECT TO authenticated
USING (public.is_master() OR public.is_manager());

CREATE POLICY "role_caps_write_admin" ON public.role_capabilities FOR ALL TO authenticated
USING (public.is_master()) WITH CHECK (public.is_master());

-- 8.11 permissions_epoch
CREATE POLICY "epoch_select_scoped" ON public.permissions_epoch FOR SELECT TO authenticated
USING (
  scope = 'global'
  OR scope = ('role:' || public.get_current_user_role())
  OR scope = ('user:' || auth.uid()::text)
  OR public.is_master()
  OR public.is_manager()
);

-- ==============================================================================
-- 9. CONCESSÃO DE EXECUÇÃO DAS RPCS AOS ROLES DO POSTGREST
-- ==============================================================================

GRANT EXECUTE ON FUNCTION public.get_my_access_settings() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_effective_capabilities(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.bump_permissions_epoch(TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_telemetry_active_sessions() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_master() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_manager() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_current_user_role() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can(TEXT, UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_grant(TEXT, UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_manage_target(UUID, UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.record_trusted_auth_event(TEXT, TEXT, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_delete_user(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_cleanup_orphan_user(TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.cleanup_stale_telemetry_and_anonymous(INT, INT) TO authenticated, service_role;

-- ==============================================================================
-- 10. HABILITAÇÃO DO SUPABASE REALTIME
-- ==============================================================================

ALTER TABLE public.permissions_epoch REPLICA IDENTITY FULL;
ALTER TABLE public.profiles REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'permissions_epoch'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.permissions_epoch;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'profiles'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
  END IF;
END $$;

COMMIT;

-- 11. Recarregar cache de esquema do PostgREST
NOTIFY pgrst, 'reload schema';
