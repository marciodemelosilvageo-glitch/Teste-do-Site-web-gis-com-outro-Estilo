-- ==============================================================================
-- SCRIPT 31 (ROLLBACK DO 30): RESTAURAR REGRAS ANTERIORES DE PODERES E RPC
-- ==============================================================================

BEGIN;

DROP TRIGGER IF EXISTS trg_protect_admin_role_capabilities ON public.role_capabilities;
DROP FUNCTION IF EXISTS public.protect_admin_role_capabilities();

DROP TRIGGER IF EXISTS trg_protect_admin_user_capabilities ON public.user_capabilities;
DROP FUNCTION IF EXISTS public.protect_admin_user_capabilities();

-- Restaurar role_caps_write_admin do Script 28
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

-- Restaurar get_effective_capabilities do Script 26
CREATE OR REPLACE FUNCTION public.get_effective_capabilities(
  p_user_id UUID DEFAULT auth.uid()
)
RETURNS TABLE (
  capability_key TEXT,
  category TEXT,
  name TEXT,
  can_use BOOLEAN,
  can_grant BOOLEAN,
  source TEXT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_caller UUID := auth.uid();
  v_target UUID;
  v_caller_role TEXT;
  v_is_master BOOLEAN := FALSE;
  v_is_mgr BOOLEAN := FALSE;
  v_role TEXT;
  v_is_anon BOOLEAN := FALSE;
  v_created_by TEXT;
  v_creator_role TEXT;
BEGIN
  IF v_caller IS NULL THEN
    RETURN;
  END IF;

  SELECT role INTO v_caller_role FROM public.profiles WHERE id = v_caller AND is_active = TRUE;
  IF v_caller_role = 'master' THEN
    v_is_master := TRUE;
  ELSIF v_caller_role = 'manager' THEN
    v_is_mgr := TRUE;
  END IF;

  IF p_user_id IS NOT NULL AND p_user_id <> v_caller THEN
    IF v_is_master OR (v_is_mgr AND public.can_manage_target(v_caller, p_user_id)) THEN
      v_target := p_user_id;
    ELSE
      v_target := v_caller;
    END IF;
  ELSE
    v_target := v_caller;
  END IF;

  SELECT role INTO v_role
  FROM public.profiles
  WHERE id = v_target AND is_active = TRUE;

  IF v_role IS NULL THEN
    IF v_target = v_caller AND COALESCE((auth.jwt()->>'is_anonymous')::boolean, FALSE) IS TRUE THEN
      v_role := 'visitor';
    ELSE
      SELECT COALESCE(u.is_anonymous, FALSE) INTO v_is_anon FROM auth.users u WHERE u.id = v_target;
      IF v_is_anon THEN
        v_role := 'visitor';
      ELSE
        v_role := 'user';
      END IF;
    END IF;
  END IF;

  IF v_role = 'user' THEN
    SELECT lower(p.created_by) INTO v_created_by
    FROM public.profiles p
    WHERE p.id = v_target;

    IF v_created_by IS NOT NULL AND v_created_by <> '' THEN
      SELECT c.role INTO v_creator_role
      FROM public.profiles c
      WHERE lower(c.username) = v_created_by
      LIMIT 1;

      IF v_creator_role = 'manager' THEN
        v_role := 'manager_user';
      END IF;
    END IF;
  END IF;

  IF v_role = 'master' THEN
    RETURN QUERY
    SELECT 
      c.key AS capability_key,
      c.category,
      c.name,
      TRUE AS can_use,
      TRUE AS can_grant,
      'master'::TEXT AS source
    FROM public.auth_capabilities c
    ORDER BY c.category, c.name;
    RETURN;
  END IF;

  RETURN QUERY
  SELECT 
    c.key AS capability_key,
    c.category,
    c.name,
    CASE 
      WHEN uc.effect = 'deny' THEN FALSE
      WHEN uc.effect = 'grant' THEN TRUE
      WHEN rc.can_use IS TRUE THEN TRUE
      ELSE FALSE
    END AS can_use,
    CASE
      WHEN uc.effect = 'deny' THEN FALSE
      WHEN uc.can_grant IS TRUE THEN TRUE
      WHEN rc.can_grant IS TRUE THEN TRUE
      ELSE FALSE
    END AS can_grant,
    CASE
      WHEN uc.effect IS NOT NULL THEN 'custom'
      WHEN rc.can_use IS NOT NULL THEN 'role'
      ELSE 'none'
    END::TEXT AS source
  FROM public.auth_capabilities c
  LEFT JOIN public.role_capabilities rc 
    ON rc.capability_key = c.key AND rc.role_id = v_role
  LEFT JOIN public.user_capabilities uc 
    ON uc.capability_key = c.key AND uc.user_id = v_target
  ORDER BY c.category, c.name;
END;
$$;

REVOKE ALL ON FUNCTION public.get_effective_capabilities(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_effective_capabilities(UUID) TO authenticated, service_role;

DELETE FROM public.user_capabilities
WHERE capability_key IN ('admin:roles:manage_visitor', 'admin:roles:manage_site_account', 'admin:roles:manage_user');

DELETE FROM public.role_capabilities
WHERE capability_key IN ('admin:roles:manage_visitor', 'admin:roles:manage_site_account', 'admin:roles:manage_user');

DELETE FROM public.auth_capabilities
WHERE key IN ('admin:roles:manage_visitor', 'admin:roles:manage_site_account', 'admin:roles:manage_user');

COMMIT;

NOTIFY pgrst, 'reload schema';
