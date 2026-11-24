-- ==============================================================================
-- SCRIPT 02: FUNÇÕES DE AVALIAÇÃO DE PODERES E GATILHOS DE PROTEÇÃO DO MASTER
-- ==============================================================================
-- Execute no SQL Editor do Supabase (ambiente de teste primeiro).
-- ==============================================================================

BEGIN;

-- ==============================================================================
-- 1. FUNÇÕES DE RESOLUÇÃO DE PODERES: can(), can_grant() E get_effective_capabilities()
-- ==============================================================================

-- 1.1 Avaliação do poder efetivo de USO
CREATE OR REPLACE FUNCTION public.can(
  p_capability TEXT,
  p_user_id UUID DEFAULT auth.uid()
)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role TEXT;
  v_user_effect TEXT;
  v_user_can_use BOOLEAN;
  v_role_effect TEXT;
  v_role_can_use BOOLEAN;
BEGIN
  -- A. Visitante anônimo (p_user_id nulo)
  IF p_user_id IS NULL THEN
    SELECT effect, can_use INTO v_role_effect, v_role_can_use
    FROM public.role_capabilities
    WHERE role_id = 'visitor' AND capability_key = p_capability;

    IF v_role_effect = 'deny' THEN RETURN FALSE; END IF;
    RETURN COALESCE(v_role_can_use, FALSE);
  END IF;

  -- B. Administrador Master: poder irrestrito a todas as capacidades
  SELECT role INTO v_role FROM public.profiles WHERE id = p_user_id AND is_active = TRUE;
  IF v_role = 'master' THEN
    RETURN TRUE;
  END IF;

  -- C. Exceção Individual em user_capabilities (vence o perfil base)
  SELECT effect, can_use INTO v_user_effect, v_user_can_use
  FROM public.user_capabilities
  WHERE user_id = p_user_id AND capability_key = p_capability;

  IF FOUND THEN
    IF v_user_effect = 'deny' THEN RETURN FALSE; END IF;
    RETURN v_user_can_use;
  END IF;

  -- D. Perfil Base associado ao usuário
  IF v_role IS NULL THEN v_role := 'visitor'; END IF;

  SELECT effect, can_use INTO v_role_effect, v_role_can_use
  FROM public.role_capabilities
  WHERE role_id = v_role AND capability_key = p_capability;

  IF FOUND THEN
    IF v_role_effect = 'deny' THEN RETURN FALSE; END IF;
    RETURN v_role_can_use;
  END IF;

  -- E. Default seguro fechado (Zero Trust)
  RETURN FALSE;
END;
$$;

-- 1.2 Avaliação do poder de REPASSE / DELEGAÇÃO (can_grant)
CREATE OR REPLACE FUNCTION public.can_grant(
  p_capability TEXT,
  p_user_id UUID DEFAULT auth.uid()
)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role TEXT;
  v_can_grant BOOLEAN;
BEGIN
  IF p_user_id IS NULL THEN RETURN FALSE; END IF;

  -- Master tem direito universal de repasse
  SELECT role INTO v_role FROM public.profiles WHERE id = p_user_id AND is_active = TRUE;
  IF v_role = 'master' THEN
    RETURN TRUE;
  END IF;

  -- Exceção individual com efeito allow
  SELECT can_grant INTO v_can_grant
  FROM public.user_capabilities
  WHERE user_id = p_user_id AND capability_key = p_capability AND effect = 'allow';

  IF FOUND THEN
    RETURN COALESCE(v_can_grant, FALSE);
  END IF;

  -- Perfil base
  SELECT can_grant INTO v_can_grant
  FROM public.role_capabilities
  WHERE role_id = v_role AND capability_key = p_capability AND effect = 'allow';

  RETURN COALESCE(v_can_grant, FALSE);
END;
$$;

-- 1.3 Verificação de Alcance / Escopo do Gerente sobre Usuário Alvo
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

  -- O usuário sempre pode alterar seus próprios dados permitidos (ex: trocar própria senha)
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

  -- NINGUÉM, exceto o próprio master, pode gerenciar ou tocar na conta de um Master!
  IF v_target_role = 'master' THEN RETURN FALSE; END IF;

  -- Verificar escopo configurado
  SELECT * INTO v_scope FROM public.user_delegation_scopes WHERE manager_id = p_manager_id;
  IF NOT FOUND THEN
    -- Padrão seguro: Equipe dele (logins cujo created_by confere com o username do gerente)
    RETURN (v_target_created_by IS NOT NULL AND lower(v_target_created_by) = lower(v_mgr_username));
  END IF;

  IF v_scope.scope_type = 'all_users' THEN
    RETURN TRUE;
  ELSIF v_scope.scope_type = 'department' THEN
    RETURN (v_target_dept = ANY(v_scope.allowed_departments));
  ELSE
    -- team_only
    RETURN (v_target_created_by IS NOT NULL AND lower(v_target_created_by) = lower(v_mgr_username));
  END IF;
END;
$$;

-- 1.4 Resolução em lote de todos os poderes do usuário (usado no login pelo client)
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
SET search_path = public
AS $$
DECLARE
  v_role TEXT;
  v_is_master BOOLEAN := FALSE;
BEGIN
  IF p_user_id IS NOT NULL THEN
    SELECT role INTO v_role FROM public.profiles WHERE id = p_user_id AND is_active = TRUE;
    IF v_role = 'master' THEN v_is_master := TRUE; END IF;
  ELSE
    v_role := 'visitor';
  END IF;

  IF v_role IS NULL THEN v_role := 'visitor'; END IF;

  RETURN QUERY
  SELECT 
    c.key AS capability_key,
    c.category,
    c.name,
    CASE 
      WHEN v_is_master THEN TRUE
      WHEN uc.effect = 'deny' THEN FALSE
      WHEN uc.effect = 'allow' THEN uc.can_use
      WHEN rc.effect = 'deny' THEN FALSE
      WHEN rc.effect = 'allow' THEN rc.can_use
      ELSE FALSE
    END AS can_use,
    CASE 
      WHEN v_is_master THEN TRUE
      WHEN uc.effect = 'deny' THEN FALSE
      WHEN uc.effect = 'allow' THEN uc.can_grant
      WHEN rc.effect = 'deny' THEN FALSE
      WHEN rc.effect = 'allow' THEN rc.can_grant
      ELSE FALSE
    END AS can_grant,
    CASE 
      WHEN v_is_master THEN 'master'
      WHEN uc.user_id IS NOT NULL THEN 'user_override'
      WHEN rc.role_id IS NOT NULL THEN 'base_role'
      ELSE 'default_closed'
    END AS source
  FROM public.auth_capabilities c
  LEFT JOIN public.user_capabilities uc 
    ON uc.capability_key = c.key AND uc.user_id = p_user_id
  LEFT JOIN public.role_capabilities rc 
    ON rc.capability_key = c.key AND rc.role_id = v_role
  ORDER BY c.category, c.name;
END;
$$;

-- ==============================================================================
-- 2. GATILHOS DE PROTEÇÃO ABSOLUTA DO MASTER E DO ÚLTIMO MASTER
-- ==============================================================================

-- 2.1 Trigger de Proteção de Perfil no UPDATE
CREATE OR REPLACE FUNCTION public.protect_master_profile()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id UUID := auth.uid();
  v_active_masters INT;
BEGIN
  -- Permite operações administrativas diretas do DBA (SQL Editor / postgres / service_role)
  IF current_user IN ('postgres', 'supabase_admin', 'service_role') AND auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  -- A. Proteção de conta MASTER existente
  IF OLD.role = 'master' THEN
    -- Regra 1: NINGUÉM, nem outro Master, pode editar a conta de um Master! Apenas o próprio.
    IF v_caller_id IS NULL OR v_caller_id <> OLD.id THEN
      RAISE EXCEPTION 'Acesso Proibido: Ninguém, nem outro Administrador Master, pode alterar a conta de um Master.';
    END IF;

    -- Regra 2: O próprio master não pode rebaixar seu papel nem desativar sua conta se for o último master
    IF (NEW.role <> 'master' OR NEW.is_active = FALSE) THEN
      SELECT count(*) INTO v_active_masters
      FROM public.profiles
      WHERE role = 'master' AND is_active = TRUE AND id <> OLD.id;

      IF v_active_masters < 1 THEN
        RAISE EXCEPTION 'Operação Bloqueada: Não é permitido desativar ou rebaixar o único Administrador Master do sistema.';
      END IF;
    END IF;
  END IF;

  -- B. Proteção contra auto-elevação para Master
  IF NEW.role = 'master' AND OLD.role <> 'master' THEN
    IF NOT public.is_master() THEN
      RAISE EXCEPTION 'Acesso Proibido: Apenas um Administrador Master ativo pode promover outro usuário a Master.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_master_profile ON public.profiles;
CREATE TRIGGER trg_protect_master_profile
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.protect_master_profile();

-- 2.2 Trigger de Proteção de Perfil no DELETE
CREATE OR REPLACE FUNCTION public.protect_master_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id UUID := auth.uid();
  v_active_masters INT;
BEGIN
  -- Permite operações administrativas diretas do DBA (SQL Editor / postgres / service_role)
  IF current_user IN ('postgres', 'supabase_admin', 'service_role') AND auth.uid() IS NULL THEN
    RETURN OLD;
  END IF;

  IF OLD.role = 'master' THEN
    -- Regra 1: Ninguém pode excluir um master a não ser ele mesmo
    IF v_caller_id IS NULL OR v_caller_id <> OLD.id THEN
      RAISE EXCEPTION 'Acesso Proibido: Ninguém pode excluir a conta de um Administrador Master.';
    END IF;

    -- Regra 2: Impedir exclusão do último master
    SELECT count(*) INTO v_active_masters
    FROM public.profiles
    WHERE role = 'master' AND is_active = TRUE AND id <> OLD.id;

    IF v_active_masters < 1 THEN
      RAISE EXCEPTION 'Operação Bloqueada: Não é permitido excluir o único Administrador Master do sistema.';
    END IF;
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_master_delete ON public.profiles;
CREATE TRIGGER trg_protect_master_delete
BEFORE DELETE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.protect_master_delete();

-- 2.3 Trigger de Proteção contra Escalonamento em user_capabilities
CREATE OR REPLACE FUNCTION public.protect_user_capabilities_write()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id UUID := auth.uid();
BEGIN
  -- Permite operações administrativas diretas do DBA (SQL Editor / postgres / service_role)
  IF current_user IN ('postgres', 'supabase_admin', 'service_role') AND auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  -- Se for Master, permite
  IF public.is_master() THEN
    RETURN NEW;
  END IF;

  -- Usuário comum nunca pode atribuir capacidades a si próprio nem a outros
  IF NOT public.is_manager() THEN
    RAISE EXCEPTION 'Acesso Negado: Apenas a gestão administrativa pode conceder ou retirar poderes.';
  END IF;

  -- Se for gerente:
  -- 1. Deve estar dentro do seu alcance sobre o usuário alvo
  IF NOT public.can_manage_target(v_caller_id, NEW.user_id) THEN
    RAISE EXCEPTION 'Acesso Negado: O usuário alvo está fora do seu alcance de gerenciamento de equipe.';
  END IF;

  -- 2. Não pode repassar capacidade que ele próprio não tenha can_grant = TRUE
  IF NOT public.can_grant(NEW.capability_key, v_caller_id) THEN
    RAISE EXCEPTION 'Acesso Negado: Você não possui autorização (can_grant) para conceder ou alterar este poder específico.';
  END IF;

  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'user_capabilities'
  ) THEN
    DROP TRIGGER IF EXISTS trg_protect_user_capabilities_write ON public.user_capabilities;
    CREATE TRIGGER trg_protect_user_capabilities_write
    BEFORE INSERT OR UPDATE ON public.user_capabilities
    FOR EACH ROW
    EXECUTE FUNCTION public.protect_user_capabilities_write();
  END IF;
END $$;

COMMIT;
