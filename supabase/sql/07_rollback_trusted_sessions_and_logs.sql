-- ============================================================================
-- SCRIPT 07: ROLLBACK DE SESSÕES E LOGS DE AUDITORIA CONFIÁVEIS
-- ============================================================================
-- Reverte as alterações introduzidas pelos scripts 05 e 06,
-- retornando o schema ao estado anterior.
-- ============================================================================

-- 1. Remover funções de telemetria e expurgo criadas no Script 06
DROP FUNCTION IF EXISTS public.cleanup_stale_telemetry_and_anonymous(INT, INT);
DROP FUNCTION IF EXISTS public.record_trusted_auth_event(TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.get_telemetry_active_sessions();

-- 2. Remover trigger e função de enriquecimento de logs criados no Script 05
DROP TRIGGER IF EXISTS trg_protect_and_enrich_log_insert ON public.webgis_logs;
DROP FUNCTION IF EXISTS public.protect_and_enrich_log_insert();

-- 3. Remover restrições de tamanho de logs
ALTER TABLE public.webgis_logs DROP CONSTRAINT IF EXISTS chk_webgis_logs_action_len;
ALTER TABLE public.webgis_logs DROP CONSTRAINT IF EXISTS chk_webgis_logs_details_len;
ALTER TABLE public.webgis_logs DROP CONSTRAINT IF EXISTS chk_webgis_logs_category_len;

-- 4. Restaurar políticas originais de logs
DROP POLICY IF EXISTS "logs_select_policy" ON public.webgis_logs;
DROP POLICY IF EXISTS "logs_insert_policy" ON public.webgis_logs;
DROP POLICY IF EXISTS "logs_update_policy" ON public.webgis_logs;
DROP POLICY IF EXISTS "logs_delete_policy" ON public.webgis_logs;

CREATE POLICY "logs_select_policy" ON public.webgis_logs FOR SELECT USING (public.is_manager());
CREATE POLICY "logs_insert_policy" ON public.webgis_logs FOR INSERT WITH CHECK (true);
CREATE POLICY "logs_delete_policy" ON public.webgis_logs FOR DELETE USING (public.is_master());

-- 5. Restaurar triggers e políticas originais de sessões
DROP TRIGGER IF EXISTS trg_protect_user_session_insert ON public.webgis_user_sessions;
DROP TRIGGER IF EXISTS trg_protect_user_session_update ON public.webgis_user_sessions;

CREATE OR REPLACE FUNCTION public.protect_user_session_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_manager() THEN
    NEW.role = 'user';
    NEW.is_blocked = FALSE;
    NEW.has_custom_permissions = FALSE;
    NEW.custom_layer_permissions = NULL;
    NEW.custom_feature_permissions = NULL;
    NEW.custom_address_columns_permissions = NULL;
    NEW.custom_feature_properties_permissions = NULL;
  END IF;
  IF auth.uid() IS NOT NULL THEN
    NEW.auth_uid = auth.uid();
  END IF;
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_protect_user_session_insert
BEFORE INSERT ON public.webgis_user_sessions
FOR EACH ROW
EXECUTE FUNCTION public.protect_user_session_insert();

CREATE OR REPLACE FUNCTION public.protect_user_session_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_manager() THEN
    NEW.role = OLD.role;
    NEW.is_blocked = OLD.is_blocked;
    NEW.has_custom_permissions = OLD.has_custom_permissions;
    NEW.custom_layer_permissions = OLD.custom_layer_permissions;
    NEW.custom_feature_permissions = OLD.custom_feature_permissions;
    NEW.custom_address_columns_permissions = OLD.custom_address_columns_permissions;
    NEW.custom_feature_properties_permissions = OLD.custom_feature_properties_permissions;
  END IF;
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_protect_user_session_update
BEFORE UPDATE ON public.webgis_user_sessions
FOR EACH ROW
EXECUTE FUNCTION public.protect_user_session_update();

-- 6. Restaurar políticas originais de sessões
DROP POLICY IF EXISTS "sessions_select_policy" ON public.webgis_user_sessions;
DROP POLICY IF EXISTS "sessions_insert_policy" ON public.webgis_user_sessions;
DROP POLICY IF EXISTS "sessions_update_policy" ON public.webgis_user_sessions;
DROP POLICY IF EXISTS "sessions_delete_policy" ON public.webgis_user_sessions;

CREATE POLICY "sessions_select_policy" ON public.webgis_user_sessions FOR SELECT USING (true);
CREATE POLICY "sessions_insert_policy" ON public.webgis_user_sessions FOR INSERT WITH CHECK (true);
CREATE POLICY "sessions_update_policy" ON public.webgis_user_sessions FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "sessions_delete_policy" ON public.webgis_user_sessions FOR DELETE USING (public.is_master());

-- 7. Restaurar permissões concedidas a anon
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.webgis_user_sessions TO anon, authenticated, service_role;
GRANT SELECT, INSERT, DELETE ON TABLE public.webgis_logs TO anon, authenticated, service_role;

NOTIFY pgrst, 'reload schema';
