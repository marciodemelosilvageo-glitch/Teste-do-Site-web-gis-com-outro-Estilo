-- ==============================================================================
-- SCRIPT 10: INSTALAÇÃO DA FUNÇÃO RPC DE TELEMETRIA DE SESSÕES ATIVAS
-- ==============================================================================
-- Cria a função public.get_telemetry_active_sessions() permitindo que o Painel
-- Master / Gerente consulte a telemetria com mascaramento de IP para gerentes.
-- ==============================================================================

BEGIN;

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

NOTIFY pgrst, 'reload schema';

COMMIT;
