-- ==============================================================================
-- SCRIPT 30: PODERES ADMINISTRATIVOS EXCLUSIVOS DE GERENTE/MASTER + CHAVES DE PERFIL
-- ==============================================================================
-- 1. Cadastra admin:roles:manage_visitor, admin:roles:manage_site_account e
--    admin:roles:manage_user em auth_capabilities (padrão desligado para manager).
-- 2. Migra quem já possui admin:roles:manage para as 3 novas chaves.
-- 3. Triggers em role_capabilities e user_capabilities recusando admin:* fora de
--    manager/master.
-- 4. Policy role_caps_write_admin exigindo a chave manage_* correspondente.
-- 5. get_effective_capabilities() ignora admin:* para quem não é manager/master.
-- ==============================================================================

BEGIN;

-- 1. Novas chaves granulares no catálogo
INSERT INTO public.auth_capabilities (key, category, name, description, risk_level)
VALUES
  ('admin:roles:manage_visitor', 'administracao', 'Editar Permissões Padrão: Visitante', 'Permite editar a coluna Visitante na matriz de perfis', 'high'),
  ('admin:roles:manage_site_account', 'administracao', 'Editar Permissões Padrão: Conta do Site', 'Permite editar a coluna Conta do Site na matriz de perfis', 'high'),
  ('admin:roles:manage_user', 'administracao', 'Editar Permissões Padrão: Usuário', 'Permite editar as colunas Usuário e Login gerado por Gerente', 'high')
ON CONFLICT (key) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  risk_level = EXCLUDED.risk_level;

-- Padrão desligado para o papel base 'manager'
INSERT INTO public.role_capabilities (role_id, capability_key, can_use, can_grant, effect)
VALUES
  ('manager', 'admin:roles:manage_visitor', FALSE, FALSE, 'allow'),
  ('manager', 'admin:roles:manage_site_account', FALSE, FALSE, 'allow'),
  ('manager', 'admin:roles:manage_user', FALSE, FALSE, 'allow')
ON CONFLICT (role_id, capability_key) DO NOTHING;

-- Remover repasse padrão de admin:users:create e admin:users:reset_password para manager
UPDATE public.role_capabilities
SET can_grant = FALSE
WHERE role_id = 'manager'
  AND capability_key IN ('admin:users:create', 'admin:users:reset_password');

-- 2. Migrar quem já possui admin:roles:manage para as 3 novas chaves
INSERT INTO public.user_capabilities (user_id, capability_key, can_use, can_grant, effect, granted_by)
SELECT uc.user_id, k.new_key, uc.can_use, uc.can_grant, uc.effect, uc.granted_by
FROM public.user_capabilities uc
CROSS JOIN (
  VALUES
    ('admin:roles:manage_visitor'),
    ('admin:roles:manage_site_account'),
    ('admin:roles:manage_user')
) AS k(new_key)
WHERE uc.capability_key = 'admin:roles:manage'
  AND uc.effect = 'allow'
  AND uc.can_use IS TRUE
ON CONFLICT (user_id, capability_key) DO NOTHING;

-- 3a. Trigger em role_capabilities recusando admin:* fora de manager/master
CREATE OR REPLACE FUNCTION public.protect_admin_role_capabilities()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.capability_key LIKE 'admin:%'
     AND NEW.role_id NOT IN ('manager', 'master', 'admin')
     AND (NEW.can_use IS TRUE OR NEW.can_grant IS TRUE OR NEW.effect = 'allow') THEN
    RAISE EXCEPTION 'Poderes administrativos (%) são exclusivos de Gerentes e Master.', NEW.capability_key;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_admin_role_capabilities ON public.role_capabilities;
CREATE TRIGGER trg_protect_admin_role_capabilities
BEFORE INSERT OR UPDATE ON public.role_capabilities
FOR EACH ROW
EXECUTE FUNCTION public.protect_admin_role_capabilities();

-- 3b. Trigger em user_capabilities recusando admin:* para contas que não sejam manager/master
CREATE OR REPLACE FUNCTION public.protect_admin_user_capabilities()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_target_role TEXT;
BEGIN
  IF NEW.capability_key LIKE 'admin:%'
     AND (NEW.can_use IS TRUE OR NEW.can_grant IS TRUE OR NEW.effect = 'allow') THEN
    SELECT role INTO v_target_role FROM public.profiles WHERE id = NEW.user_id;
    IF COALESCE(v_target_role, 'user') NOT IN ('manager', 'master', 'admin') THEN
      RAISE EXCEPTION 'Poderes administrativos (%) são exclusivos de Gerentes e Master.', NEW.capability_key;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_admin_user_capabilities ON public.user_capabilities;
CREATE TRIGGER trg_protect_admin_user_capabilities
BEFORE INSERT OR UPDATE ON public.user_capabilities
FOR EACH ROW
EXECUTE FUNCTION public.protect_admin_user_capabilities();

-- 4. Policy role_caps_write_admin por coluna liberada
DROP POLICY IF EXISTS "role_caps_write_admin" ON public.role_capabilities;
CREATE POLICY "role_caps_write_admin" ON public.role_capabilities
FOR ALL TO authenticated
USING (
  public.is_master()
  OR (
    public.is_manager()
    AND role_id NOT IN ('master', 'admin', 'manager')
    AND capability_key NOT LIKE 'admin:%'
    AND (
      public.can('admin:roles:manage')
      OR (role_id = 'visitor' AND public.can('admin:roles:manage_visitor'))
      OR (role_id = 'site_account' AND public.can('admin:roles:manage_site_account'))
      OR (role_id = 'user' AND public.can('admin:roles:manage_user'))
      OR (role_id = 'manager_user' AND (public.can('admin:users:create') OR public.can('admin:roles:manage_user')))
    )
  )
)
WITH CHECK (
  public.is_master()
  OR (
    public.is_manager()
    AND role_id NOT IN ('master', 'admin', 'manager')
    AND capability_key NOT LIKE 'admin:%'
    AND (
      public.can('admin:roles:manage')
      OR (role_id = 'visitor' AND public.can('admin:roles:manage_visitor'))
      OR (role_id = 'site_account' AND public.can('admin:roles:manage_site_account'))
      OR (role_id = 'user' AND public.can('admin:roles:manage_user'))
      OR (role_id = 'manager_user' AND (public.can('admin:users:create') OR public.can('admin:roles:manage_user')))
    )
  )
);

-- 5. get_effective_capabilities() ignora admin:* para quem não é manager/master
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
      WHEN c.key LIKE 'admin:%' AND v_role NOT IN ('manager', 'master', 'admin') THEN FALSE
      WHEN uc.effect = 'deny' THEN FALSE
      WHEN uc.effect = 'grant' THEN TRUE
      WHEN rc.can_use IS TRUE THEN TRUE
      ELSE FALSE
    END AS can_use,
    CASE
      WHEN c.key LIKE 'admin:%' AND v_role NOT IN ('manager', 'master', 'admin') THEN FALSE
      WHEN uc.effect = 'deny' THEN FALSE
      WHEN uc.can_grant IS TRUE THEN TRUE
      WHEN rc.can_grant IS TRUE THEN TRUE
      ELSE FALSE
    END AS can_grant,
    CASE
      WHEN c.key LIKE 'admin:%' AND v_role NOT IN ('manager', 'master', 'admin') THEN 'none'
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

COMMIT;

NOTIFY pgrst, 'reload schema';
