-- ==============================================================================
-- SCRIPT 01: TABELAS DO CATÁLOGO DE PODERES, PERFIS BASE E RLS ESTRITA
-- ==============================================================================
-- Execute no SQL Editor do Supabase (ambiente de teste primeiro).
-- ==============================================================================

BEGIN;

-- 1. Catálogo Mestre de Capacidades / Poderes do Sistema
CREATE TABLE IF NOT EXISTS public.auth_capabilities (
  key TEXT PRIMARY KEY,
  category TEXT NOT NULL CHECK (category IN ('camadas', 'ferramentas', 'dados', 'conta', 'administracao')),
  name TEXT NOT NULL,
  description TEXT,
  risk_level TEXT NOT NULL DEFAULT 'low' CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Tabela de Perfis Base Editáveis (Visitante, Conta do site, Usuário, Gerente, etc.)
CREATE TABLE IF NOT EXISTS public.base_roles (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  is_system BOOLEAN NOT NULL DEFAULT FALSE,
  hierarchy_level INT NOT NULL DEFAULT 10,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Inserção inicial dos 4 perfis fundamentais
INSERT INTO public.base_roles (id, name, description, is_system, hierarchy_level)
VALUES
  ('visitor', 'Visitante Anônimo', 'Cidadão público ou visitante sem autenticação formal', TRUE, 0),
  ('site_account', 'Conta do Site', 'Usuário cadastrado pelo formulário público do site', TRUE, 10),
  ('user', 'Usuário Credenciado', 'Usuário institucional cadastrado pela gestão', TRUE, 20),
  ('manager', 'Gerente de Equipe', 'Gestor de equipe com poderes de delegação autorizados', TRUE, 50)
ON CONFLICT (id) DO UPDATE 
SET name = EXCLUDED.name, description = EXCLUDED.description, is_system = TRUE;

-- 3. Capacidades Padrão por Perfil Base
CREATE TABLE IF NOT EXISTS public.role_capabilities (
  role_id TEXT NOT NULL REFERENCES public.base_roles(id) ON DELETE CASCADE,
  capability_key TEXT NOT NULL REFERENCES public.auth_capabilities(key) ON DELETE CASCADE,
  can_use BOOLEAN NOT NULL DEFAULT TRUE,
  can_grant BOOLEAN NOT NULL DEFAULT FALSE,
  effect TEXT NOT NULL DEFAULT 'allow' CHECK (effect IN ('allow', 'deny')),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (role_id, capability_key)
);

-- 4. Exceções Individuais por Usuário (vencem o perfil base; negar vence conceder)
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

-- 5. Escopo de Delegação do Gerente (alcance sobre quem ele gerencia)
CREATE TABLE IF NOT EXISTS public.user_delegation_scopes (
  manager_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  scope_type TEXT NOT NULL DEFAULT 'team_only' CHECK (scope_type IN ('team_only', 'department', 'all_users')),
  allowed_departments TEXT[] NOT NULL DEFAULT '{}',
  can_manage_site_accounts BOOLEAN NOT NULL DEFAULT TRUE,
  can_manage_visitors BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- 6. Trilha de Auditoria Granular de Mudança de Poderes
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

-- Índices de Performance
CREATE INDEX IF NOT EXISTS idx_role_capabilities_role ON public.role_capabilities(role_id);
CREATE INDEX IF NOT EXISTS idx_user_capabilities_user ON public.user_capabilities(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_target ON public.capability_audit_logs(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_time ON public.capability_audit_logs(timestamp DESC);

-- ==============================================================================
-- 7. POLÍTICAS RLS ESTRITAS (Sem USING (true) para escrita)
-- ==============================================================================

ALTER TABLE public.auth_capabilities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.base_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_capabilities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_capabilities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_delegation_scopes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.capability_audit_logs ENABLE ROW LEVEL SECURITY;

-- 7.1 auth_capabilities: Leitura pública; Escrita restrita a Master
DROP POLICY IF EXISTS "capabilities_read_all" ON public.auth_capabilities;
CREATE POLICY "capabilities_read_all" ON public.auth_capabilities
FOR SELECT USING (true);

DROP POLICY IF EXISTS "capabilities_write_master" ON public.auth_capabilities;
CREATE POLICY "capabilities_write_master" ON public.auth_capabilities
FOR ALL USING (public.is_master()) WITH CHECK (public.is_master());

-- 7.2 base_roles: Leitura pública; Escrita restrita a Master
DROP POLICY IF EXISTS "base_roles_read_all" ON public.base_roles;
CREATE POLICY "base_roles_read_all" ON public.base_roles
FOR SELECT USING (true);

DROP POLICY IF EXISTS "base_roles_write_master" ON public.base_roles;
CREATE POLICY "base_roles_write_master" ON public.base_roles
FOR ALL USING (public.is_master()) WITH CHECK (public.is_master());

-- 7.3 role_capabilities: Leitura pública; Escrita restrita a Master
DROP POLICY IF EXISTS "role_capabilities_read_all" ON public.role_capabilities;
CREATE POLICY "role_capabilities_read_all" ON public.role_capabilities
FOR SELECT USING (true);

DROP POLICY IF EXISTS "role_capabilities_write_master" ON public.role_capabilities;
CREATE POLICY "role_capabilities_write_master" ON public.role_capabilities
FOR ALL USING (public.is_master()) WITH CHECK (public.is_master());

-- 7.4 user_capabilities: Leitura do próprio usuário ou gerente/master; Escrita restrita a Master ou Service Role
DROP POLICY IF EXISTS "user_capabilities_read_own_or_admin" ON public.user_capabilities;
CREATE POLICY "user_capabilities_read_own_or_admin" ON public.user_capabilities
FOR SELECT USING (
  auth.uid() = user_id OR public.is_manager()
);

DROP POLICY IF EXISTS "user_capabilities_write_master" ON public.user_capabilities;
CREATE POLICY "user_capabilities_write_master" ON public.user_capabilities
FOR ALL USING (public.is_master()) WITH CHECK (public.is_master());

-- 7.5 user_delegation_scopes: Leitura do próprio gerente ou master; Escrita restrita a Master
DROP POLICY IF EXISTS "delegation_scopes_read_own_or_master" ON public.user_delegation_scopes;
CREATE POLICY "delegation_scopes_read_own_or_master" ON public.user_delegation_scopes
FOR SELECT USING (
  auth.uid() = manager_id OR public.is_master()
);

DROP POLICY IF EXISTS "delegation_scopes_write_master" ON public.user_delegation_scopes;
CREATE POLICY "delegation_scopes_write_master" ON public.user_delegation_scopes
FOR ALL USING (public.is_master()) WITH CHECK (public.is_master());

-- 7.6 capability_audit_logs: Leitura por gerentes/master; Escrita por autenticado com dados próprios; Imutável (sem DELETE/UPDATE)
DROP POLICY IF EXISTS "audit_logs_read_manager" ON public.capability_audit_logs;
CREATE POLICY "audit_logs_read_manager" ON public.capability_audit_logs
FOR SELECT USING (public.is_manager());

DROP POLICY IF EXISTS "audit_logs_insert_authenticated" ON public.capability_audit_logs;
CREATE POLICY "audit_logs_insert_authenticated" ON public.capability_audit_logs
FOR INSERT WITH CHECK (
  auth.uid() IS NOT NULL AND (performed_by = auth.uid() OR public.is_master())
);

-- Concessão de Permissões aos Postgres Roles (Governada por RLS)
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

COMMIT;
