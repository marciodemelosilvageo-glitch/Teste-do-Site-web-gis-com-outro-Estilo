-- ============================================================================
-- SCRIPT 05: SESSÕES E LOGS DE AUDITORIA CONFIÁVEIS (SERVER-FIRST)
-- ============================================================================
-- Objetivo:
-- 1. Vincular cada linha de webgis_user_sessions obrigatoriamente a auth.uid().
-- 2. Garantir que INSERT e UPDATE só alterem a própria linha (auth_uid = auth.uid()).
-- 3. SELECT de sessões restrito à própria linha ou a gerentes/master.
-- 4. Adicionar coluna actor_id em webgis_logs, preenchida pelo servidor via trigger.
-- 5. Derivar user_role do log a partir do perfil real no banco, nunca do payload do cliente.
-- 6. Limitar tamanho/formato de logs e aplicar taxa limite (rate limit) contra flood.
-- 7. Revogar permissões perigosas de escrita concedidas a anon.
-- ============================================================================

-- 1. Ajustar colunas de public.webgis_user_sessions
ALTER TABLE public.webgis_user_sessions
  ADD COLUMN IF NOT EXISTS auth_uid UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- 2. Trigger de proteção na INSERÇÃO de sessões
CREATE OR REPLACE FUNCTION public.protect_user_session_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_role TEXT;
BEGIN
  -- A sessão exige autenticação (seja conta real ou visitante anônimo do Supabase Auth)
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Acesso negado: registro de sessão requer autenticação válida (auth.uid requerido)';
  END IF;

  -- auth_uid sempre derivado do token de autenticação
  NEW.auth_uid := auth.uid();
  NEW.session_id := COALESCE(NEW.session_id, auth.uid()::text);
  NEW.first_seen := COALESCE(NEW.first_seen, NOW());
  NEW.last_seen := NOW();
  NEW.updated_at := NOW();

  -- Se não for gerente nem master, campos sensíveis são estritamente forçados pelo servidor
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

-- 3. Trigger de proteção na ATUALIZAÇÃO de sessões (Heartbeat e CustomName)
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

  -- auth_uid é imutável: ninguém pode transferir uma sessão para outro usuário
  NEW.auth_uid := OLD.auth_uid;
  NEW.session_id := OLD.session_id;
  NEW.first_seen := OLD.first_seen;
  NEW.updated_at := NOW();

  -- Se não for gerente nem master, o usuário só pode atualizar seu nome e last_seen (heartbeat)
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

-- 4. Políticas RLS para public.webgis_user_sessions
ALTER TABLE public.webgis_user_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir acesso completo anon webgis_user_sessions" ON public.webgis_user_sessions;
DROP POLICY IF EXISTS "sessions_select_policy" ON public.webgis_user_sessions;
DROP POLICY IF EXISTS "sessions_insert_policy" ON public.webgis_user_sessions;
DROP POLICY IF EXISTS "sessions_update_policy" ON public.webgis_user_sessions;
DROP POLICY IF EXISTS "sessions_delete_policy" ON public.webgis_user_sessions;

-- SELECT: Usuário/visitante só lê sua própria sessão; gerentes e master leem todas
CREATE POLICY "sessions_select_policy"
ON public.webgis_user_sessions FOR SELECT
USING (auth_uid = auth.uid() OR public.is_manager());

-- INSERT: Somente na própria linha
CREATE POLICY "sessions_insert_policy"
ON public.webgis_user_sessions FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL AND (auth_uid IS NULL OR auth_uid = auth.uid()));

-- UPDATE: Somente na própria linha (ou gerentes/master alterando parâmetros)
CREATE POLICY "sessions_update_policy"
ON public.webgis_user_sessions FOR UPDATE
USING (auth_uid = auth.uid() OR public.is_manager())
WITH CHECK (auth_uid = auth.uid() OR public.is_manager());

-- DELETE: Exclusivo do Administrador Master
CREATE POLICY "sessions_delete_policy"
ON public.webgis_user_sessions FOR DELETE
USING (public.is_master());

-- 5. Ajustar colunas e restrições em public.webgis_logs
ALTER TABLE public.webgis_logs
  ADD COLUMN IF NOT EXISTS actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- Restrições de tamanho para prevenir abuso de armazenamento
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_webgis_logs_action_len'
  ) THEN
    ALTER TABLE public.webgis_logs ADD CONSTRAINT chk_webgis_logs_action_len CHECK (length(action) <= 150);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_webgis_logs_details_len'
  ) THEN
    ALTER TABLE public.webgis_logs ADD CONSTRAINT chk_webgis_logs_details_len CHECK (details IS NULL OR length(details) <= 2500);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_webgis_logs_category_len'
  ) THEN
    ALTER TABLE public.webgis_logs ADD CONSTRAINT chk_webgis_logs_category_len CHECK (length(category) <= 50);
  END IF;
END $$;

-- 6. Trigger para enriquecer e proteger logs no servidor (com rate limiting)
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
  -- Requer autenticação para auditar
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Acesso negado: logs de auditoria exigem autenticação válida';
  END IF;

  -- 1. Atribuir o ator real via auth.uid() (impossível forjar pelo cliente)
  NEW.actor_id := auth.uid();
  NEW.timestamp := NOW();
  NEW.created_at := NOW();
  NEW.id := COALESCE(NEW.id, 'log_' || EXTRACT(EPOCH FROM NOW())::BIGINT || '_' || substr(md5(random()::text), 1, 6));

  -- 2. Derivar o papel real no servidor
  SELECT role INTO v_role FROM public.profiles WHERE id = auth.uid() AND is_active = TRUE;
  IF v_role IS NOT NULL THEN
    NEW.user_role := v_role;
  ELSIF (auth.jwt()->>'is_anonymous')::boolean IS TRUE THEN
    NEW.user_role := 'visitor';
  ELSE
    NEW.user_role := 'user';
  END IF;

  -- 3. Taxa Limite (Rate Limiting): Máximo de 60 eventos de log por minuto por usuário
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

-- 7. Políticas RLS para public.webgis_logs
ALTER TABLE public.webgis_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir acesso completo anon webgis_logs" ON public.webgis_logs;
DROP POLICY IF EXISTS "logs_select_policy" ON public.webgis_logs;
DROP POLICY IF EXISTS "logs_insert_policy" ON public.webgis_logs;
DROP POLICY IF EXISTS "logs_update_policy" ON public.webgis_logs;
DROP POLICY IF EXISTS "logs_delete_policy" ON public.webgis_logs;

-- SELECT: Gerentes e Master apenas
CREATE POLICY "logs_select_policy"
ON public.webgis_logs FOR SELECT
USING (public.is_manager());

-- INSERT: Usuários autenticados (inclusive visitantes anônimos com token)
CREATE POLICY "logs_insert_policy"
ON public.webgis_logs FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL AND (actor_id IS NULL OR actor_id = auth.uid()));

-- UPDATE: Logs são imutáveis (ninguém pode alterar histórico de auditoria)
CREATE POLICY "logs_update_policy"
ON public.webgis_logs FOR UPDATE
USING (false);

-- DELETE: Exclusivo do Administrador Master
CREATE POLICY "logs_delete_policy"
ON public.webgis_logs FOR DELETE
USING (public.is_master());

-- 8. Correção dos GRANTs (Revogar permissões indevidas de escrita a anon)
REVOKE ALL ON TABLE public.webgis_user_sessions FROM anon;
REVOKE ALL ON TABLE public.webgis_logs FROM anon;

-- Anon só tem SELECT/USAGE onde estritamente necessário (como settings públicas)
GRANT SELECT ON TABLE public.webgis_settings TO anon;

-- Authenticated (que inclui visitantes anônimos pós-signInAnonymously) tem permissões controladas por RLS
GRANT SELECT, INSERT, UPDATE ON TABLE public.webgis_user_sessions TO authenticated;
GRANT SELECT, INSERT ON TABLE public.webgis_logs TO authenticated;
REVOKE DELETE ON TABLE public.webgis_user_sessions FROM authenticated;
REVOKE DELETE, UPDATE ON TABLE public.webgis_logs FROM authenticated;

-- Service role mantém acesso total
GRANT ALL ON TABLE public.webgis_user_sessions TO service_role;
GRANT ALL ON TABLE public.webgis_logs TO service_role;

NOTIFY pgrst, 'reload schema';
