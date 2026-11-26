-- ==============================================================================
-- SCRIPT 28: TRAVAS DE ESCOPO E PODERES DE GERENTE NO SERVIDOR
-- ==============================================================================
-- 1. can_manage_target: respeita can_manage_visitors e can_manage_site_accounts
--    do escopo do Gerente (padrão FALSE).
-- 2. profiles (policy INSERT + trigger BEFORE INSERT OR UPDATE):
--    - Criar conta exige 'admin:users:create' e created_by próprio.
--    - Criar ou promover para 'manager' exige 'admin:users:promote_manager'.
--    - Bloquear/desbloquear (is_active) exige 'admin:users:block' + can_manage_target.
--    - Reset de senha (must_change_password) exige 'admin:users:reset_password' + can_manage_target.
-- 3. admin_delete_user: permite Gerente excluir apenas com 'admin:users:delete' + can_manage_target.
-- 4. role_caps_write_admin: permite Gerente alterar role_capabilities apenas com 'admin:roles:manage'.
-- 5. webgis_logs e capability_audit_logs: exigem 'admin:logs:view' (além do Script 24).
-- ==============================================================================

BEGIN;

-- 1. can_manage_target com suporte a can_manage_visitors e can_manage_site_accounts
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
  IF v_target_role IN ('master', 'admin') THEN RETURN FALSE; END IF;

  SELECT * INTO v_scope FROM public.user_delegation_scopes WHERE manager_id = p_manager_id;

  IF v_target_role = 'visitor' THEN
    RETURN COALESCE(v_scope.can_manage_visitors, FALSE);
  END IF;

  IF v_target_role = 'site_account' THEN
    RETURN COALESCE(v_scope.can_manage_site_accounts, FALSE);
  END IF;

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

-- 2. Policy de INSERT em profiles exigindo admin:users:create e admin:users:promote_manager
DROP POLICY IF EXISTS "profiles_insert_master" ON public.profiles;
CREATE POLICY "profiles_insert_master" ON public.profiles
FOR INSERT TO authenticated
WITH CHECK (
  public.is_master()
  OR (
    public.is_manager()
    AND public.can('admin:users:create')
    AND created_by IS NOT NULL
    AND lower(created_by) = (SELECT lower(username) FROM public.profiles WHERE id = auth.uid() LIMIT 1)
    AND role NOT IN ('master', 'admin')
    AND (role <> 'manager' OR public.can('admin:users:promote_manager'))
  )
);

-- 3. Trigger de proteção de operações de Gerente em profiles
CREATE OR REPLACE FUNCTION public.protect_manager_profile_operations()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id UUID := auth.uid();
BEGIN
  IF current_user IN ('postgres', 'supabase_admin', 'service_role') AND v_caller_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF public.is_master() THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF public.is_manager() THEN
      IF NOT public.can('admin:users:create') THEN
        RAISE EXCEPTION 'Acesso negado: você não tem permissão para criar usuários.';
      END IF;
      IF NEW.role IN ('master', 'admin') THEN
        RAISE EXCEPTION 'Acesso negado: não é permitido criar conta com este papel.';
      END IF;
      IF NEW.role = 'manager' AND NOT public.can('admin:users:promote_manager') THEN
        RAISE EXCEPTION 'Acesso negado: você não tem permissão para criar contas de Gerente.';
      END IF;
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND v_caller_id IS NOT NULL AND OLD.id <> v_caller_id THEN
    IF public.is_manager() THEN
      IF NOT public.can_manage_target(v_caller_id, OLD.id) THEN
        RAISE EXCEPTION 'Acesso negado: usuário fora do seu alcance de gerência.';
      END IF;

      IF NEW.role IS DISTINCT FROM OLD.role THEN
        IF (NEW.role = 'manager' OR OLD.role = 'manager') AND NOT public.can('admin:users:promote_manager') THEN
          RAISE EXCEPTION 'Acesso negado: você não tem permissão para promover ou rebaixar gerentes.';
        END IF;
      END IF;

      IF NEW.is_active IS DISTINCT FROM OLD.is_active AND NOT public.can('admin:users:block') THEN
        RAISE EXCEPTION 'Acesso negado: você não tem permissão para bloquear ou reativar contas.';
      END IF;

      IF NEW.must_change_password IS DISTINCT FROM OLD.must_change_password AND NOT public.can('admin:users:reset_password') THEN
        RAISE EXCEPTION 'Acesso negado: você não tem permissão para redefinir senhas.';
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_manager_profile_operations ON public.profiles;
CREATE TRIGGER trg_protect_manager_profile_operations
BEFORE INSERT OR UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.protect_manager_profile_operations();

-- 4. admin_delete_user respeitando admin:users:delete + can_manage_target
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

  IF v_caller_role = 'master' THEN
    NULL;
  ELSIF v_caller_role = 'manager' THEN
    IF NOT public.can('admin:users:delete') THEN
      RAISE EXCEPTION 'Acesso negado: você não tem permissão para excluir contas.';
    END IF;
    IF NOT public.can_manage_target(auth.uid(), p_user_id) THEN
      RAISE EXCEPTION 'Acesso negado: usuário fora do seu alcance de gerência.';
    END IF;
  ELSE
    RAISE EXCEPTION 'Acesso negado: permissão insuficiente para excluir contas.';
  END IF;

  IF p_user_id = auth.uid() THEN
    RAISE EXCEPTION 'Operação inválida: você não pode excluir a própria conta.';
  END IF;

  SELECT role INTO v_target_role FROM public.profiles WHERE id = p_user_id;
  IF v_target_role IN ('master', 'admin') THEN
    RAISE EXCEPTION 'Operação inválida: conta protegida contra exclusão.';
  END IF;

  DELETE FROM public.profiles WHERE id = p_user_id;
  DELETE FROM auth.users WHERE id = p_user_id;

  RETURN jsonb_build_object('success', TRUE, 'deleted_user_id', p_user_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_delete_user(UUID) TO authenticated, service_role;

-- 5. role_capabilities: Gerente só altera com admin:roles:manage
DROP POLICY IF EXISTS "role_caps_write_admin" ON public.role_capabilities;
CREATE POLICY "role_caps_write_admin" ON public.role_capabilities
FOR ALL TO authenticated
USING (
  public.is_master()
  OR (
    public.is_manager()
    AND public.can('admin:roles:manage')
    AND role_id NOT IN ('master', 'admin', 'manager')
  )
)
WITH CHECK (
  public.is_master()
  OR (
    public.is_manager()
    AND public.can('admin:roles:manage')
    AND role_id NOT IN ('master', 'admin', 'manager')
  )
);

-- 6. webgis_logs e capability_audit_logs: exigir admin:logs:view para Gerentes
DROP POLICY IF EXISTS "logs_select_isolated" ON public.webgis_logs;
CREATE POLICY "logs_select_isolated" ON public.webgis_logs
FOR SELECT TO authenticated
USING (
  public.is_master()
  OR (
    public.is_manager()
    AND public.can('admin:panel:access')
    AND public.can('admin:logs:view')
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
    AND public.can('admin:logs:view')
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
