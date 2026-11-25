-- ==============================================================================
-- SCRIPT 22: CORRIGIR get_effective_capabilities PARA RESOLVER VISITANTE ANÔNIMO
-- ==============================================================================
-- Problema:
--   Quando um visitante entra com signInAnonymously(), ele não tem linha em
--   public.profiles. A função get_effective_capabilities usava COALESCE(v_role, 'user'),
--   aplicando as permissões de 'user' em vez de 'visitor' e ignorando bloqueios
--   feitos para o perfil 'visitor' na tabela role_capabilities.
--
-- Correção:
--   Se v_role for NULL (sem perfil em public.profiles), verifica se o usuário
--   é anônimo via JWT (auth.jwt()->>'is_anonymous') ou auth.users.is_anonymous
--   e resolve como 'visitor'; caso contrário, 'user'.
-- ==============================================================================

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

  -- Se for passado p_user_id de terceiro, exige privilégio de Master ou Gerente no alcance
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

NOTIFY pgrst, 'reload schema';
