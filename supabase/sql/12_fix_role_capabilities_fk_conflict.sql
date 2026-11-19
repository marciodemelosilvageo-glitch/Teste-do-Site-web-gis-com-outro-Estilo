-- ==============================================================================
-- SCRIPT 12: PREVENÇÃO DEFINITIVA DE CONFLITO FK (409) EM role_capabilities
-- ==============================================================================
-- 1. Garante as tabelas auth_capabilities, base_roles e role_capabilities.
-- 2. Insere trigger BEFORE INSERT OR UPDATE em role_capabilities que auto-insere
--    qualquer chave ausente em auth_capabilities e qualquer papel em base_roles,
--    tornando impossível o erro de chave estrangeira (violates foreign key constraint 23503 / 409).
-- ==============================================================================

BEGIN;

-- 1. Garante existência das tabelas base caso o Script 01 não tenha sido executado
CREATE TABLE IF NOT EXISTS public.auth_capabilities (
  key TEXT PRIMARY KEY,
  category TEXT NOT NULL CHECK (category IN ('camadas', 'ferramentas', 'dados', 'conta', 'administracao')),
  name TEXT NOT NULL,
  description TEXT,
  risk_level TEXT NOT NULL DEFAULT 'low' CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.base_roles (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  is_system BOOLEAN NOT NULL DEFAULT FALSE,
  hierarchy_level INT NOT NULL DEFAULT 10,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.role_capabilities (
  role_id TEXT NOT NULL REFERENCES public.base_roles(id) ON DELETE CASCADE,
  capability_key TEXT NOT NULL REFERENCES public.auth_capabilities(key) ON DELETE CASCADE,
  can_use BOOLEAN NOT NULL DEFAULT TRUE,
  can_grant BOOLEAN NOT NULL DEFAULT FALSE,
  effect TEXT NOT NULL DEFAULT 'allow' CHECK (effect IN ('allow', 'deny')),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (role_id, capability_key)
);

-- 2. Garante os 4 perfis fundamentais
INSERT INTO public.base_roles (id, name, description, is_system, hierarchy_level)
VALUES
  ('visitor', 'Visitante Anônimo', 'Cidadão público ou visitante sem autenticação formal', TRUE, 0),
  ('site_account', 'Conta do Site', 'Usuário cadastrado pelo formulário público do site', TRUE, 10),
  ('user', 'Usuário Credenciado', 'Usuário institucional cadastrado pela gestão', TRUE, 20),
  ('manager', 'Gerente de Equipe', 'Gestor de equipe com poderes de delegação autorizados', TRUE, 50)
ON CONFLICT (id) DO UPDATE 
SET name = EXCLUDED.name, description = EXCLUDED.description, is_system = TRUE;

-- 3. Trigger defensivo inteligente: auto-provisiona chaves e papéis para prevenir erro 409 (FK 23503)
CREATE OR REPLACE FUNCTION public.auto_provision_capability_and_role()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Normaliza prefixo 'role:'
  NEW.role_id := replace(NEW.role_id, 'role:', '');
  NEW.updated_at := NOW();
  IF NEW.effect IS NULL THEN
    NEW.effect := CASE WHEN NEW.can_use IS TRUE THEN 'allow' ELSE 'deny' END;
  END IF;

  -- Auto-provisiona base_roles se não existir
  IF NOT EXISTS (SELECT 1 FROM public.base_roles WHERE id = NEW.role_id) THEN
    INSERT INTO public.base_roles (id, name, description, is_system, hierarchy_level)
    VALUES (NEW.role_id, INITCAP(NEW.role_id), 'Perfil ' || NEW.role_id, TRUE, 10)
    ON CONFLICT (id) DO NOTHING;
  END IF;

  -- Auto-provisiona auth_capabilities se não existir
  IF NOT EXISTS (SELECT 1 FROM public.auth_capabilities WHERE key = NEW.capability_key) THEN
    INSERT INTO public.auth_capabilities (key, category, name, description, risk_level)
    VALUES (
      NEW.capability_key,
      CASE
        WHEN NEW.capability_key LIKE 'layer:%' THEN 'camadas'
        WHEN NEW.capability_key LIKE 'data:%' THEN 'dados'
        WHEN NEW.capability_key LIKE 'account:%' THEN 'conta'
        ELSE 'ferramentas'
      END,
      NEW.capability_key,
      'Capacidade registrada automaticamente',
      'low'
    )
    ON CONFLICT (key) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_provision_capability_and_role ON public.role_capabilities;
CREATE TRIGGER trg_auto_provision_capability_and_role
BEFORE INSERT OR UPDATE ON public.role_capabilities
FOR EACH ROW
EXECUTE FUNCTION public.auto_provision_capability_and_role();

-- 4. Permissões
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT SELECT ON TABLE public.auth_capabilities TO anon, authenticated, service_role;
GRANT INSERT, UPDATE, DELETE ON TABLE public.auth_capabilities TO authenticated, service_role;
GRANT SELECT ON TABLE public.base_roles TO anon, authenticated, service_role;
GRANT INSERT, UPDATE, DELETE ON TABLE public.base_roles TO authenticated, service_role;
GRANT SELECT ON TABLE public.role_capabilities TO anon, authenticated, service_role;
GRANT INSERT, UPDATE, DELETE ON TABLE public.role_capabilities TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';

COMMIT;
