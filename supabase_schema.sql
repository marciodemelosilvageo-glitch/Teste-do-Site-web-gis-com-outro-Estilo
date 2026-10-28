-- ==============================================================================
-- WebGIS — Script de Inicialização das Tabelas no Supabase
-- Execute este script no SQL Editor do painel do seu projeto Supabase.
-- ==============================================================================

-- 1. Tabela de Configurações Globais e Usuários Cadastrados
CREATE TABLE IF NOT EXISTS public.webgis_settings (
  id TEXT PRIMARY KEY,
  layer_permissions JSONB,
  feature_permissions JSONB,
  address_columns_permissions JSONB,
  feature_properties_permissions JSONB,
  admin_password TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  data JSONB
);

-- 2. Tabela de Monitoramento de Sessões e Visitantes
CREATE TABLE IF NOT EXISTS public.webgis_user_sessions (
  session_id TEXT PRIMARY KEY,
  custom_name TEXT,
  first_seen TIMESTAMPTZ DEFAULT NOW(),
  last_seen TIMESTAMPTZ DEFAULT NOW(),
  formatted_first_seen TEXT,
  formatted_last_seen TEXT,
  role TEXT DEFAULT 'user',
  is_blocked BOOLEAN DEFAULT FALSE,
  has_custom_permissions BOOLEAN DEFAULT FALSE,
  custom_layer_permissions JSONB,
  custom_feature_permissions JSONB,
  custom_address_columns_permissions JSONB,
  custom_feature_properties_permissions JSONB,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Tabela de Logs de Atividades e Auditoria
CREATE TABLE IF NOT EXISTS public.webgis_logs (
  id TEXT PRIMARY KEY,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  formatted_date TEXT,
  user_role TEXT DEFAULT 'user',
  category TEXT,
  action TEXT,
  details TEXT,
  session_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Habilitar Row Level Security (RLS)
ALTER TABLE public.webgis_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webgis_user_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webgis_logs ENABLE ROW LEVEL SECURITY;

-- 5. Criar Políticas de Acesso (Leitura e Gravação para Anon Key)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'webgis_settings' AND policyname = 'Permitir acesso completo anon webgis_settings'
  ) THEN
    CREATE POLICY "Permitir acesso completo anon webgis_settings" 
    ON public.webgis_settings FOR ALL 
    USING (true) WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'webgis_user_sessions' AND policyname = 'Permitir acesso completo anon webgis_user_sessions'
  ) THEN
    CREATE POLICY "Permitir acesso completo anon webgis_user_sessions" 
    ON public.webgis_user_sessions FOR ALL 
    USING (true) WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'webgis_logs' AND policyname = 'Permitir acesso completo anon webgis_logs'
  ) THEN
    CREATE POLICY "Permitir acesso completo anon webgis_logs" 
    ON public.webgis_logs FOR ALL 
    USING (true) WITH CHECK (true);
  END IF;
END $$;

-- 6. Conceder permissões para a anon key (acesso da API REST)
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.webgis_settings TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.webgis_user_sessions TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.webgis_logs TO anon, authenticated, service_role;

-- 7. Inicializar linha padrão para 'global' caso não exista
INSERT INTO public.webgis_settings (id, updated_at)
VALUES ('global', NOW())
ON CONFLICT (id) DO NOTHING;

-- 8. Forçar a API do Supabase (PostgREST) a recarregar o cache de tabelas imediatamente
NOTIFY pgrst, 'reload schema';
