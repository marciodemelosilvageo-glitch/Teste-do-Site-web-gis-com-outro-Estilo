-- ==============================================================================
-- SCRIPT 04: SCRIPT DE ROLLBACK COMPLETO (REVERSÃO SEGURA)
-- ==============================================================================
-- Use este script se precisar reverter as alterações dos scripts 01, 02 e 03.
-- As tabelas legadas (public.profiles, public.webgis_settings) têm seus dados originais preservados.
-- ==============================================================================

BEGIN;

-- 1. Remover Triggers e Funções de Proteção Criadas no Script 02
DROP TRIGGER IF EXISTS trg_protect_user_capabilities_write ON public.user_capabilities;
DROP FUNCTION IF EXISTS public.protect_user_capabilities_write();

DROP TRIGGER IF EXISTS trg_protect_master_delete ON public.profiles;
DROP FUNCTION IF EXISTS public.protect_master_delete();

DROP TRIGGER IF EXISTS trg_protect_master_profile ON public.profiles;
DROP FUNCTION IF EXISTS public.protect_master_profile();

-- Restaurar Trigger Legado prevent_self_elevation (se foi substituído)
CREATE OR REPLACE FUNCTION public.prevent_self_elevation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_master() THEN
    NEW.role = OLD.role;
    NEW.is_active = OLD.is_active;
    NEW.manager_permissions = OLD.manager_permissions;
    NEW.username = OLD.username;
    NEW.has_custom_permissions = OLD.has_custom_permissions;
    NEW.custom_layer_permissions = OLD.custom_layer_permissions;
    NEW.custom_feature_permissions = OLD.custom_feature_permissions;
    NEW.custom_address_columns_permissions = OLD.custom_address_columns_permissions;
    NEW.custom_feature_properties_permissions = OLD.custom_feature_properties_permissions;
    NEW.created_by = OLD.created_by;
    NEW.created_at = OLD.created_at;
    IF NEW.must_change_password IS DISTINCT FROM OLD.must_change_password THEN
      IF NEW.must_change_password = FALSE AND OLD.must_change_password = TRUE THEN
        NEW.must_change_password = FALSE;
      ELSE
        NEW.must_change_password = OLD.must_change_password;
      END IF;
    END IF;
  END IF;
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_self_elevation ON public.profiles;
CREATE TRIGGER trg_prevent_self_elevation
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.prevent_self_elevation();

-- 2. Remover Funções de Resolução de Poderes
DROP FUNCTION IF EXISTS public.get_effective_capabilities(UUID);
DROP FUNCTION IF EXISTS public.can_manage_target(UUID, UUID);
DROP FUNCTION IF EXISTS public.can_grant(TEXT, UUID);
DROP FUNCTION IF EXISTS public.can(TEXT, UUID);

-- 3. Restaurar Roles de 'site_account' de volta para 'user' (compatibilidade legado)
UPDATE public.profiles
SET role = 'user'
WHERE role = 'site_account';

-- 4. Excluir as Novas Tabelas em Ordem Reversa de Dependência
DROP TABLE IF EXISTS public.capability_audit_logs CASCADE;
DROP TABLE IF EXISTS public.user_delegation_scopes CASCADE;
DROP TABLE IF EXISTS public.user_capabilities CASCADE;
DROP TABLE IF EXISTS public.role_capabilities CASCADE;
DROP TABLE IF EXISTS public.base_roles CASCADE;
DROP TABLE IF EXISTS public.auth_capabilities CASCADE;

COMMIT;
