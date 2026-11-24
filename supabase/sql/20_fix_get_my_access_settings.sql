-- ==============================================================================
-- SCRIPT 20: CORREÇÃO DA RPC get_my_access_settings (ELIMINA ERRO 42703 / 400)
-- ==============================================================================
-- Descrição:
--   Remove a referência inexistente à coluna 'system_config' da tabela
--   public.webgis_settings. A tabela webgis_settings real contém exclusivamente:
--   id, layer_permissions, feature_permissions, address_columns_permissions,
--   feature_properties_permissions, updated_at e data.
--   A tentativa de leitura de v_settings.system_config disparava a exceção
--   42703 (record has no field), fazendo o PostgREST responder 400 Bad Request.
--
-- Segurança:
--   - Função STABLE e SECURITY DEFINER com search_path = public.
--   - Acesso concedido a anon, authenticated e service_role.
--   - Execução revogada de PUBLIC.
-- ==============================================================================

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
  -- 1. Carrega configurações globais de webgis_settings
  SELECT * INTO v_settings FROM public.webgis_settings WHERE id = 'global' LIMIT 1;
  IF v_settings.id IS NOT NULL THEN
    v_layer_perms := COALESCE(v_settings.layer_permissions, '{}'::jsonb);
    v_feat_perms  := COALESCE(v_settings.feature_permissions, '{}'::jsonb);
    v_addr_perms  := COALESCE(v_settings.address_columns_permissions, '{}'::jsonb);
    v_prop_perms  := COALESCE(v_settings.feature_properties_permissions, '{}'::jsonb);
  END IF;

  -- 2. Visitante anônimo ou sem sessão ativa
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object(
      'role', 'visitor',
      'layer_permissions', v_layer_perms,
      'feature_permissions', v_feat_perms,
      'address_columns_permissions', v_addr_perms,
      'feature_properties_permissions', v_prop_perms
    );
  END IF;

  -- 3. Usuário autenticado: busca perfil do usuário
  SELECT * INTO v_profile FROM public.profiles WHERE id = v_uid LIMIT 1;
  IF v_profile.id IS NOT NULL THEN
    v_role := COALESCE(v_profile.role, 'user');

    -- Sobreposição individual de permissões (se has_custom_permissions for TRUE)
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

-- Permissões de Execução
REVOKE EXECUTE ON FUNCTION public.get_my_access_settings() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_my_access_settings() TO anon, authenticated, service_role;

COMMENT ON FUNCTION public.get_my_access_settings() IS 
  'Retorna as configurações globais e permissões resolvidas para o usuário atual sem vazar dados protegidos e sem referências a colunas inexistentes.';
