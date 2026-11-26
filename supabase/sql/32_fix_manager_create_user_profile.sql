-- ==============================================================================
-- SCRIPT 32: CORRIGIR GRAVAÇÃO DE PERFIL NA CRIAÇÃO DE LOGIN POR GERENTE
-- ==============================================================================
-- Problema:
--   Ao criar usuário via signUp(), o trigger handle_new_user() insere o perfil
--   com created_by = 'Auto-cadastro (Site)'. Em seguida, o upsert/update feito
--   pelo Gerente em public.profiles falha com 403 porque can_manage_target()
--   ainda não reconhece o novo usuário como criação do gerente.
--
-- Solução:
--   RPC SECURITY DEFINER admin_finalize_created_profile() que valida o papel e
--   o poder admin:users:create (e admin:users:promote_manager se role='manager'),
--   e grava created_by com o username real do criador no servidor.
-- ==============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.admin_finalize_created_profile(
  p_user_id UUID,
  p_username TEXT,
  p_name TEXT,
  p_role TEXT DEFAULT 'user',
  p_department TEXT DEFAULT '',
  p_manager_permissions JSONB DEFAULT NULL,
  p_has_custom_permissions BOOLEAN DEFAULT FALSE,
  p_custom_layer_permissions JSONB DEFAULT NULL,
  p_custom_feature_permissions JSONB DEFAULT NULL,
  p_custom_address_columns_permissions JSONB DEFAULT NULL,
  p_custom_feature_properties_permissions JSONB DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_caller_id UUID := auth.uid();
  v_caller_role TEXT;
  v_caller_username TEXT;
  v_safe_role TEXT := 'user';
  v_created_by TEXT;
BEGIN
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Acesso negado: autenticação necessária.';
  END IF;

  SELECT role, username INTO v_caller_role, v_caller_username
  FROM public.profiles
  WHERE id = v_caller_id AND is_active = TRUE;

  IF v_caller_role = 'master' THEN
    v_created_by := 'Master';
    v_safe_role := CASE
      WHEN p_role IN ('master', 'manager', 'user', 'site_account', 'visitor') THEN p_role
      ELSE 'user'
    END;
  ELSIF v_caller_role = 'manager' THEN
    IF NOT public.can('admin:users:create') THEN
      RAISE EXCEPTION 'Acesso negado: você não tem permissão para criar usuários.';
    END IF;
    v_created_by := v_caller_username;
    IF p_role = 'manager' THEN
      IF NOT public.can('admin:users:promote_manager') THEN
        RAISE EXCEPTION 'Acesso negado: você não tem permissão para criar contas de Gerente.';
      END IF;
      v_safe_role := 'manager';
    ELSE
      v_safe_role := 'user';
    END IF;
  ELSE
    RAISE EXCEPTION 'Acesso negado: apenas Master ou Gerente autorizado podem criar contas.';
  END IF;

  INSERT INTO public.profiles (
    id,
    username,
    name,
    role,
    department,
    is_active,
    must_change_password,
    has_custom_permissions,
    manager_permissions,
    custom_layer_permissions,
    custom_feature_permissions,
    custom_address_columns_permissions,
    custom_feature_properties_permissions,
    created_by,
    updated_at
  )
  VALUES (
    p_user_id,
    lower(trim(p_username)),
    trim(p_name),
    v_safe_role,
    COALESCE(p_department, ''),
    TRUE,
    TRUE,
    COALESCE(p_has_custom_permissions, FALSE),
    CASE WHEN v_safe_role = 'manager' THEN p_manager_permissions ELSE NULL END,
    p_custom_layer_permissions,
    p_custom_feature_permissions,
    p_custom_address_columns_permissions,
    p_custom_feature_properties_permissions,
    v_created_by,
    NOW()
  )
  ON CONFLICT (id) DO UPDATE SET
    username = EXCLUDED.username,
    name = EXCLUDED.name,
    role = EXCLUDED.role,
    department = EXCLUDED.department,
    is_active = TRUE,
    must_change_password = TRUE,
    has_custom_permissions = EXCLUDED.has_custom_permissions,
    manager_permissions = EXCLUDED.manager_permissions,
    custom_layer_permissions = EXCLUDED.custom_layer_permissions,
    custom_feature_permissions = EXCLUDED.custom_feature_permissions,
    custom_address_columns_permissions = EXCLUDED.custom_address_columns_permissions,
    custom_feature_properties_permissions = EXCLUDED.custom_feature_properties_permissions,
    created_by = EXCLUDED.created_by,
    updated_at = NOW();

  RETURN jsonb_build_object(
    'success', TRUE,
    'user_id', p_user_id,
    'role', v_safe_role,
    'created_by', v_created_by
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_finalize_created_profile(
  UUID, TEXT, TEXT, TEXT, TEXT, JSONB, BOOLEAN, JSONB, JSONB, JSONB, JSONB
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_finalize_created_profile(
  UUID, TEXT, TEXT, TEXT, TEXT, JSONB, BOOLEAN, JSONB, JSONB, JSONB, JSONB
) TO authenticated, service_role;

COMMIT;

NOTIFY pgrst, 'reload schema';
