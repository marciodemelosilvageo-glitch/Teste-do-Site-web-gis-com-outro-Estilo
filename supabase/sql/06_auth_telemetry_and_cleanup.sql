-- ============================================================================
-- SCRIPT 06: TELEMETRIA DE AUTENTICAÇÃO E ROTINA DE RETENÇÃO/EXPURGO
-- ============================================================================
-- Objetivo:
-- 1. Função SECURITY DEFINER get_telemetry_active_sessions para leitura segura
--    de auth.users e auth.sessions pelo painel Master/Gerente.
-- 2. Conceito de "online agora" (último sinal recente nos últimos 3 minutos).
-- 3. Função record_trusted_auth_event para registro direto pelo servidor.
-- 4. Procedimento de limpeza e expurgo para visitantes inativos (> 30 dias) e logs antigos.
-- ============================================================================

-- 1. Função de Telemetria de Sessões Ativas (SECURITY DEFINER)
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
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  -- Apenas Master e Gerentes podem consultar telemetria real de sessões
  IF NOT public.is_manager() THEN
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
    -- Conceito de "online agora": heartbeat ou atualização recente nos últimos 3 minutos
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
    -- Gerente só vê usuários permitidos (não vê master nem contas restritas)
    (public.is_master() OR p.role IS NULL OR p.role != 'master')
  ORDER BY COALESCE(ws.last_seen, u.last_sign_in_at, u.created_at) DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_telemetry_active_sessions() TO authenticated, service_role;

-- 2. Função para registro de eventos de autenticação confiáveis no servidor
CREATE OR REPLACE FUNCTION public.record_trusted_auth_event(
  p_action TEXT,
  p_details TEXT DEFAULT NULL,
  p_category TEXT DEFAULT 'ACESSO'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_log_id TEXT;
  v_role TEXT;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Acesso negado: operação requer autenticação válida';
  END IF;

  SELECT role INTO v_role FROM public.profiles WHERE id = auth.uid() AND is_active = TRUE;
  IF v_role IS NULL THEN
    IF (auth.jwt()->>'is_anonymous')::boolean IS TRUE THEN
      v_role := 'visitor';
    ELSE
      v_role := 'user';
    END IF;
  END IF;

  v_log_id := 'log_' || EXTRACT(EPOCH FROM NOW())::BIGINT || '_' || substr(md5(random()::text), 1, 6);

  INSERT INTO public.webgis_logs (
    id,
    timestamp,
    formatted_date,
    user_role,
    category,
    action,
    details,
    session_id,
    actor_id,
    created_at
  ) VALUES (
    v_log_id,
    NOW(),
    to_char(NOW(), 'DD/MM/YYYY HH24:MI:SS'),
    v_role,
    p_category,
    p_action,
    p_details,
    auth.uid()::text,
    auth.uid(),
    NOW()
  );

  RETURN jsonb_build_object('success', TRUE, 'log_id', v_log_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_trusted_auth_event(TEXT, TEXT, TEXT) TO authenticated, service_role;

-- 3. Procedimento de Retenção e Limpeza Segura (Exclusivo do Master)
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
  v_log_cutoff TIMESTAMPTZ;
  v_anon_cutoff TIMESTAMPTZ;
BEGIN
  -- Apenas o Administrador Master pode acionar a limpeza
  IF NOT public.is_master() THEN
    RAISE EXCEPTION 'Acesso negado: apenas o Administrador Master possui permissão de expurgo de dados';
  END IF;

  v_log_cutoff := NOW() - (p_log_retention_days || ' days')::INTERVAL;
  v_anon_cutoff := NOW() - (p_anon_retention_days || ' days')::INTERVAL;

  -- 1. Excluir logs anteriores ao período de retenção
  WITH deleted_logs AS (
    DELETE FROM public.webgis_logs
    WHERE created_at < v_log_cutoff
    RETURNING 1
  )
  SELECT COUNT(*) INTO v_purged_logs FROM deleted_logs;

  -- 2. Excluir sessões inativas de visitantes anônimos
  WITH deleted_sessions AS (
    DELETE FROM public.webgis_user_sessions
    WHERE role = 'visitor'
      AND last_seen < v_anon_cutoff
    RETURNING 1
  )
  SELECT COUNT(*) INTO v_purged_sessions FROM deleted_sessions;

  -- 3. Excluir contas anônimas do auth.users sem atividade há mais de p_anon_retention_days dias
  WITH deleted_users AS (
    DELETE FROM auth.users
    WHERE is_anonymous = TRUE
      AND COALESCE(last_sign_in_at, created_at) < v_anon_cutoff
    RETURNING 1
  )
  SELECT COUNT(*) INTO v_purged_anon_users FROM deleted_users;

  -- 4. Registrar a operação de expurgo na auditoria
  INSERT INTO public.webgis_logs (
    id,
    timestamp,
    formatted_date,
    user_role,
    category,
    action,
    details,
    session_id,
    actor_id,
    created_at
  ) VALUES (
    'log_' || EXTRACT(EPOCH FROM NOW())::BIGINT || '_purge',
    NOW(),
    to_char(NOW(), 'DD/MM/YYYY HH24:MI:SS'),
    'master',
    'ADMIN',
    'EXPURGO_TELEMETRIA',
    format('Expurgo concluído: %s logs (> %sd), %s sessões anônimas, %s usuários anônimos (> %sd)',
      v_purged_logs, p_log_retention_days, v_purged_sessions, v_purged_anon_users, p_anon_retention_days),
    auth.uid()::text,
    auth.uid(),
    NOW()
  );

  RETURN jsonb_build_object(
    'success', TRUE,
    'purged_logs', v_purged_logs,
    'purged_sessions', v_purged_sessions,
    'purged_anon_users', v_purged_anon_users,
    'log_retention_days', p_log_retention_days,
    'anon_retention_days', p_anon_retention_days
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.cleanup_stale_telemetry_and_anonymous(INT, INT) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
