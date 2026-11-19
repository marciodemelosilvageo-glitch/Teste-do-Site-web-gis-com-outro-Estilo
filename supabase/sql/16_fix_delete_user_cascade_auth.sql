-- ==============================================================================
-- SCRIPT 16: CASCATA SEGURA DE EXCLUSÃO DE USUÁRIO (PROFILES -> AUTH.USERS) E LIMPEZA DE ÓRFÃOS
-- ==============================================================================
-- 1. Cria a função e trigger para remover credenciais de auth.users quando um perfil for excluído.
-- 2. Cria a RPC admin_delete_user para exclusão atômica de perfil e credenciais pelo Master.
-- 3. Cria a RPC admin_cleanup_orphan_user para limpar contas órfãs em auth.users caso necessário.
-- 4. Executa a limpeza imediata de logins órfãos em auth.users que já foram excluídos de profiles.
-- ==============================================================================

BEGIN;

-- 1. TRIGGER PARA EXCLUIR AUTOMATICAMENTE DE AUTH.USERS QUANDO PERFIL FOR EXCLUÍDO EM PROFILES
CREATE OR REPLACE FUNCTION public.trg_delete_auth_user_on_profile_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  -- Se o registro ainda existir em auth.users, remove-o
  IF EXISTS (SELECT 1 FROM auth.users WHERE id = OLD.id) THEN
    DELETE FROM auth.users WHERE id = OLD.id;
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_delete_auth_user_on_profile_delete ON public.profiles;
CREATE TRIGGER trg_delete_auth_user_on_profile_delete
  AFTER DELETE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_delete_auth_user_on_profile_delete();

-- 2. RPC ATÔMICA PARA EXCLUSÃO DEFINITIVA DE USUÁRIO (MASTER ONLY)
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
  -- 2.1 Verifica se o chamador é o Administrador Master
  SELECT role INTO v_caller_role FROM public.profiles WHERE id = auth.uid() AND is_active = TRUE;
  IF v_caller_role != 'master' THEN
    RAISE EXCEPTION 'Acesso negado: apenas o Administrador Master pode excluir contas de usuários.';
  END IF;

  -- 2.2 Bloqueia auto-exclusão do Master
  IF p_user_id = auth.uid() THEN
    RAISE EXCEPTION 'Operação inválida: você não pode excluir sua própria conta Master.';
  END IF;

  -- 2.3 Bloqueia exclusão de outra conta Master
  SELECT role INTO v_target_role FROM public.profiles WHERE id = p_user_id;
  IF v_target_role = 'master' THEN
    RAISE EXCEPTION 'Operação inválida: não é permitido excluir outra conta Master.';
  END IF;

  -- 2.4 Exclui de profiles (o trigger cuidará de auth.users, mas garantimos aqui também)
  DELETE FROM public.profiles WHERE id = p_user_id;
  DELETE FROM auth.users WHERE id = p_user_id;

  RETURN jsonb_build_object('success', TRUE, 'deleted_user_id', p_user_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_delete_user(UUID) TO authenticated, service_role;

-- 3. RPC PARA LIMPEZA DE CONTA ÓRFÃ EM AUTH.USERS PELO USERNAME (MASTER ONLY)
CREATE OR REPLACE FUNCTION public.admin_cleanup_orphan_user(p_username TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_caller_role TEXT;
  v_clean_user TEXT;
  v_target_email TEXT;
  v_orphan_id UUID;
  v_target_role TEXT;
BEGIN
  -- 3.1 Verifica se o chamador é Master
  SELECT role INTO v_caller_role FROM public.profiles WHERE id = auth.uid() AND is_active = TRUE;
  IF v_caller_role != 'master' THEN
    RAISE EXCEPTION 'Acesso negado: apenas o Administrador Master pode executar esta ação.';
  END IF;

  v_clean_user := lower(trim(replace(p_username, '@', '')));
  v_target_email := v_clean_user || '@usuarios.webgis';

  -- 3.2 Busca se existe em auth.users
  SELECT id INTO v_orphan_id FROM auth.users WHERE lower(email) = v_target_email;

  IF v_orphan_id IS NOT NULL THEN
    -- Não permite se for a conta do próprio Master
    IF v_orphan_id = auth.uid() THEN
      RAISE EXCEPTION 'Operação inválida: não é permitido remover a conta Master.';
    END IF;

    -- Não permite se houver um Master com esse id em profiles
    SELECT role INTO v_target_role FROM public.profiles WHERE id = v_orphan_id;
    IF v_target_role = 'master' THEN
      RAISE EXCEPTION 'Operação inválida: não é permitido remover outra conta Master.';
    END IF;

    -- Remove de profiles (se houver) e de auth.users
    DELETE FROM public.profiles WHERE id = v_orphan_id;
    DELETE FROM auth.users WHERE id = v_orphan_id;

    RETURN jsonb_build_object('success', TRUE, 'cleaned_id', v_orphan_id, 'username', v_clean_user);
  END IF;

  RETURN jsonb_build_object('success', FALSE, 'message', 'Usuário não encontrado em auth.users');
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_cleanup_orphan_user(TEXT) TO authenticated, service_role;

-- 4. LIMPEZA IMEDIATA DE CONTAS ÓRFÃS EM AUTH.USERS
-- Exclui qualquer registro em auth.users com domínio @usuarios.webgis que não possua mais perfil correspondente em public.profiles
DELETE FROM auth.users u
WHERE u.email LIKE '%@usuarios.webgis'
  AND NOT EXISTS (
    SELECT 1 FROM public.profiles p WHERE p.id = u.id
  );

COMMIT;

NOTIFY pgrst, 'reload schema';
