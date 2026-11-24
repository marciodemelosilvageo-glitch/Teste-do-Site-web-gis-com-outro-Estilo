-- ==============================================================================
-- SCRIPT 21: ROLLBACK DA CORREÇÃO DA RPC get_my_access_settings
-- ==============================================================================
-- Restaura a definição original da função get_my_access_settings conforme
-- implementada no script 18_security_hardening_rls_and_access.sql.
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
  v_sys_config JSONB := '{}'::jsonb;
  v_profile RECORD;
BEGIN
  SELECT * INTO v_settings FROM public.webgis_settings WHERE id = 'global' LIMIT 1;
  IF v_settings.id IS NOT NULL THEN
    v_layer_perms := COALESCE(v_settings.layer_permissions, '{}'::jsonb);
    v_feat_perms  := COALESCE(v_settings.feature_permissions, '{}'::jsonb);
    v_addr_perms  := COALESCE(v_settings.address_columns_permissions, '{}'::jsonb);
    v_prop_perms  := COALESCE(v_settings.feature_properties_permissions, '{}'::jsonb);
    v_sys_config  := COALESCE(v_settings.system_config, '{}'::jsonb);
  END IF;

  IF v_uid IS NULL THEN
    RETURN jsonb_build_object(
      'role', 'visitor',
      'layer_permissions', v_layer_perms,
      'feature_permissions', v_feat_perms,
      'address_columns_permissions', v_addr_perms,
      'feature_properties_permissions', v_prop_perms,
      'system_config', v_sys_config
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
    'feature_properties_permissions', v_prop_perms,
    'system_config', v_sys_config
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_my_access_settings() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_my_access_settings() TO anon, authenticated, service_role;
