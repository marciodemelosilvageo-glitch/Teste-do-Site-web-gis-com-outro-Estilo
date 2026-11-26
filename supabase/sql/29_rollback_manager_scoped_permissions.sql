-- ==============================================================================
-- SCRIPT 29 (ROLLBACK DO 28): RESTAURAR can_manage_target, profiles, delete e policies
-- ==============================================================================
-- Restaura exatamente o estado anterior (Scripts 16, 18 e 24).
-- ==============================================================================

BEGIN;

-- 1. Remover trigger e função criados no Script 28
DROP TRIGGER IF EXISTS trg_protect_manager_profile_operations ON public.profiles;
DROP FUNCTION IF EXISTS public.protect_manager_profile_operations();

-- 2. Restaurar can_manage_target do Script 18
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

-- 3. Restaurar profiles_insert_master do Script 18
DROP POLICY IF EXISTS "profiles_insert_master" ON public.profiles;
CREATE POLICY "profiles_insert_master" ON public.profiles
FOR INSERT TO authenticated
WITH CHECK (
  public.is_master() OR (public.is_manager() AND (created_by IS NOT NULL))
);

-- 4. Restaurar admin_delete_user do Script 16
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
  SELECT role INTO v_caller_role FROM public.profiles WHERE id = auth.uid() AND is_active = TRUE;
  IF v_caller_role != 'master' THEN
    RAISE EXCEPTION 'Acesso negado: apenas o Administrador Master pode excluir contas de usuários.';
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

GRANT EXECUTE ON FUNCTION public.admin_delete_user(UUID) TO authenticated, service_role;

-- 5. Restaurar role_caps_write_admin do Script 18
DROP POLICY IF EXISTS "role_caps_write_admin" ON public.role_capabilities;
CREATE POLICY "role_caps_write_admin" ON public.role_capabilities
FOR ALL TO authenticated
USING (public.is_master())
WITH CHECK (public.is_master());

-- 6. Restaurar policies de logs e auditoria do Script 24
DROP POLICY IF EXISTS "logs_select_isolated" ON public.webgis_logs;
CREATE POLICY "logs_select_isolated" ON public.webgis_logs
FOR SELECT TO authenticated
USING (
  public.is_master()
  OR (
    public.is_manager()
    AND public.can('admin:panel:access')
    AND (
      actor_id = auth.uid()
      OR (
        actor_id IS NOT NULL
        AND public.can_manage_target(auth.uid(), actor_id)
        AND COALESCE(lower(user_role), '') NOT IN ('master', 'admin')
      )
    )
  )
  OR (
    NOT public.is_manager()
    AND actor_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "capability_audit_select_admin" ON public.capability_audit_logs;
CREATE POLICY "capability_audit_select_admin" ON public.capability_audit_logs
FOR SELECT TO authenticated
USING (
  public.is_master()
  OR (
    public.is_manager()
    AND public.can('admin:panel:access')
    AND (
      performed_by = auth.uid()
      OR (
        (
          performed_by IS NULL
          OR NOT EXISTS (
            SELECT 1 FROM public.profiles pm
            WHERE pm.id = performed_by
              AND lower(pm.role) IN ('master', 'admin')
          )
        )
        AND lower(COALESCE(performed_by_name, '')) NOT LIKE '%master%'
        AND lower(COALESCE(target_id, '')) NOT IN ('master', 'role:master', 'admin', 'role:admin')
        AND (
          (
            target_type = 'user'
            AND EXISTS (
              SELECT 1 FROM public.profiles pt
              WHERE (lower(pt.username) = lower(target_id) OR pt.id::text = target_id)
                AND lower(pt.role) NOT IN ('master', 'admin')
                AND public.can_manage_target(auth.uid(), pt.id)
            )
          )
          OR (
            target_type IN ('base_role', 'global')
            AND performed_by = auth.uid()
          )
        )
      )
    )
  )
);

COMMIT;

NOTIFY pgrst, 'reload schema';
