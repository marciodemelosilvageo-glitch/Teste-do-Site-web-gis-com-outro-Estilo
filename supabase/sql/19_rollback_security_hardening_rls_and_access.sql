-- ==============================================================================
-- SCRIPT 19: ROLLBACK DO SCRIPT 18 (RESTAURAÇÃO DO ESTADO ANTERIOR DE RLS E PRIVILÉGIOS)
-- ==============================================================================

BEGIN;

-- 1. Remove políticas estritas criadas no Script 18
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

-- 2. Restaura políticas abertas de leitura
CREATE POLICY "capabilities_read_all" ON public.auth_capabilities FOR SELECT USING (true);
CREATE POLICY "capabilities_write_master" ON public.auth_capabilities FOR ALL USING (public.is_master()) WITH CHECK (public.is_master());

CREATE POLICY "roles_read_all" ON public.base_roles FOR SELECT USING (true);
CREATE POLICY "roles_write_master" ON public.base_roles FOR ALL USING (public.is_master()) WITH CHECK (public.is_master());

CREATE POLICY "role_caps_read_all" ON public.role_capabilities FOR SELECT USING (true);
CREATE POLICY "role_caps_write_master" ON public.role_capabilities FOR ALL USING (public.is_master()) WITH CHECK (public.is_master());

CREATE POLICY "settings_read_all" ON public.webgis_settings FOR SELECT USING (true);
CREATE POLICY "settings_write_master" ON public.webgis_settings FOR ALL USING (public.is_master()) WITH CHECK (public.is_master());

CREATE POLICY "Leitura publica de permissions_epoch" ON public.permissions_epoch FOR SELECT TO anon, authenticated, service_role USING (true);

CREATE POLICY "profiles_select_all" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "profiles_self_update" ON public.profiles FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- 3. Restaura GRANTs anteriores a anon e authenticated
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT SELECT ON TABLE public.webgis_settings TO anon, authenticated, service_role;
GRANT SELECT ON TABLE public.auth_capabilities TO anon, authenticated, service_role;
GRANT SELECT ON TABLE public.base_roles TO anon, authenticated, service_role;
GRANT SELECT ON TABLE public.role_capabilities TO anon, authenticated, service_role;
GRANT SELECT ON TABLE public.permissions_epoch TO anon, authenticated, service_role;
GRANT SELECT ON TABLE public.profiles TO anon, authenticated, service_role;
GRANT UPDATE ON TABLE public.profiles TO authenticated;

-- 4. Remove a RPC get_my_access_settings
DROP FUNCTION IF EXISTS public.get_my_access_settings();

COMMIT;

NOTIFY pgrst, 'reload schema';
