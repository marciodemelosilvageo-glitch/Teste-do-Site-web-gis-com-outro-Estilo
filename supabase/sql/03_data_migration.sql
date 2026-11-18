-- ==============================================================================
-- SCRIPT 03: MIGRAÇÃO DOS DADOS ATUAIS PARA O NOVO MODELO
-- ==============================================================================
-- Transforma blobs JSON globais e individuais no catálogo unificado sem perda de dados.
-- Execute no SQL Editor do Supabase (ambiente de teste primeiro).
-- ==============================================================================

BEGIN;

-- ==============================================================================
-- 1. CARGA DO CATÁLOGO INICIAL DE CAPACIDADES (auth_capabilities)
-- ==============================================================================

INSERT INTO public.auth_capabilities (key, category, name, description, risk_level)
VALUES
  -- A. Ferramentas
  ('tool:cnefe_search', 'ferramentas', 'Busca CNEFE de Endereços', 'Pesquisa textual e tabular em mais de 450 mil endereços', 'low'),
  ('tool:advanced_search', 'ferramentas', 'Busca Avançada', 'Filtros combinados de endereço, setor e bairro', 'low'),
  ('tool:search_by_type', 'ferramentas', 'Buscar por Tipo', 'Busca rápida de farmácias, restaurantes, postos, hotéis e hospitais', 'low'),
  ('tool:search_area_addresses', 'ferramentas', 'Buscar Endereços na Área', 'Varredura de endereços contidos em polígono ou medição', 'medium'),
  ('tool:measure', 'ferramentas', 'Ferramenta de Medição', 'Cálculo de distâncias lineares e áreas territoriais no mapa', 'low'),
  ('tool:print_a4', 'ferramentas', 'Impressão de Mapas em A4', 'Geração e impressão de mapas temáticos com cabeçalho', 'low'),
  ('tool:layer_panel', 'ferramentas', 'Painel de Camadas', 'Ativação, desativação e reordenação de camadas cartográficas', 'low'),
  ('tool:raio_x', 'ferramentas', 'Dashboard Raio-X Urbano', 'Estatísticas demográficas, domiciliares e socioeconômicas', 'low'),
  ('tool:selected_features', 'ferramentas', 'Painel de Feições Selecionadas', 'Visualização de lista e detalhes das feições clicadas', 'low'),
  ('tool:feature_specs', 'ferramentas', 'Especificações da Feição', 'Exibição técnica detalhada dos atributos da feição', 'low'),
  ('tool:sources_footer', 'ferramentas', 'Rodapé de Fontes e Metadados', 'Exibição de fontes cartográficas oficiais no rodapé', 'low'),
  ('tool:search_active_layers_only', 'ferramentas', 'Pesquisar Somente nas Camadas Ativas', 'Restringe o escopo da busca às camadas ligadas no mapa', 'low'),
  ('tool:dissolve_features', 'ferramentas', 'Dissolver Feições', 'Unificação geométrica de polígonos adjacentes selecionados', 'medium'),
  ('tool:multi_select', 'ferramentas', 'Multiseleção de Feições', 'Seleção simultânea de múltiplas feições no mapa', 'low'),
  ('tool:customize_useful_info', 'ferramentas', 'Personalizar Informações Úteis', 'Configuração de quais atributos aparecem no resumo de feição', 'low'),
  ('tool:basemap_selector', 'ferramentas', 'Seletor de Mapa Base', 'Alternância entre satélite, relevo, escuro e mapas de rua', 'low'),
  ('tool:map_legend', 'ferramentas', 'Legenda Cartográfica', 'Exibição da legenda visual das camadas ativas', 'low'),

  -- B. Dados e Formatos de Exportação
  ('data:export:csv', 'dados', 'Exportar em CSV', 'Exportação de tabelas de feições ou endereços para formato CSV', 'low'),
  ('data:export:kml', 'dados', 'Exportar em KML', 'Download de camadas e áreas no formato Google Earth KML', 'low'),
  ('data:export:kmz', 'dados', 'Exportar em KMZ', 'Download de camadas compactadas no formato KMZ', 'low'),
  ('data:export:geojson', 'dados', 'Exportar em GeoJSON', 'Exportação de geometrias vetoriais em GeoJSON', 'low'),
  ('data:export:shapefile', 'dados', 'Exportar em Shapefile (ZIP)', 'Download de feições no padrão vetorial ESRI Shapefile', 'medium'),
  ('data:export:geopackage', 'dados', 'Exportar em GeoPackage (GPKG)', 'Download em padrão geoespacial aberto GeoPackage OGC', 'medium'),
  ('data:limit:unlimited_rows', 'dados', 'Exportação sem Limite de Linhas', 'Permite exportar mais de 50.000 linhas sem truncamento', 'high'),

  -- C. Conta e Acesso Pessoal
  ('account:self_register', 'conta', 'Autocadastro pelo Site', 'Capacidade de criar uma conta própria a partir da tela inicial', 'low'),
  ('account:change_own_password', 'conta', 'Trocar a Própria Senha', 'Permissão para alterar sua própria senha de acesso', 'low'),
  ('account:edit_own_profile', 'conta', 'Editar o Próprio Perfil', 'Permissão para alterar seu nome e dados de contato', 'low'),

  -- D. Administração
  ('admin:panel:access', 'administracao', 'Acesso ao Painel de Controle', 'Visualização do botão e abertura da tela administrativa', 'medium'),
  ('admin:users:view', 'administracao', 'Visualizar Lista de Usuários', 'Consulta de usuários cadastrados e sessões de visitantes', 'medium'),
  ('admin:users:create', 'administracao', 'Criar Novos Usuários', 'Geração de novos logins institucionais para o sistema', 'high'),
  ('admin:users:reset_password', 'administracao', 'Redefinir Senhas de Terceiros', 'Definição de nova senha provisória para outros usuários', 'high'),
  ('admin:users:block', 'administracao', 'Bloquear e Ativar Contas', 'Interrupção ou liberação imediata do acesso de um usuário', 'high'),
  ('admin:users:delete', 'administracao', 'Excluir Contas de Usuários', 'Exclusão definitiva de credenciais e perfis do sistema', 'critical'),
  ('admin:users:promote_manager', 'administracao', 'Promover Usuário a Gerente', 'Elevação de usuário comum ao cargo de Gerente de Equipe', 'critical'),
  ('admin:roles:manage', 'administracao', 'Gerenciar Perfis Base e Catálogo', 'Edição de poderes atribuídos a Visitante, Usuário, etc.', 'critical'),
  ('admin:global_settings:manage', 'administracao', 'Gerenciar Configurações Globais', 'Alteração de parâmetros e regras globais do WebGIS', 'critical'),
  ('admin:logs:view', 'administracao', 'Visualizar Logs de Auditoria', 'Leitura do histórico de acessos, buscas e ações de usuários', 'medium'),
  ('admin:logs:export', 'administracao', 'Exportar Logs para CSV', 'Download completo da trilha de auditoria e atividades', 'high'),
  ('admin:logs:clear', 'administracao', 'Limpar Histórico de Logs', 'Exclusão de registros antigos de auditoria', 'critical'),
  ('admin:simulate:profile', 'administracao', 'Simular Visão ("Ver como")', 'Navegar no sistema simulando os poderes de outro perfil', 'high')
ON CONFLICT (key) DO UPDATE 
SET name = EXCLUDED.name, description = EXCLUDED.description, category = EXCLUDED.category, risk_level = EXCLUDED.risk_level;

-- Inserir Colunas de Endereço CNEFE no Catálogo de Dados
INSERT INTO public.auth_capabilities (key, category, name, description, risk_level)
VALUES
  ('data:address_col:codigo_unico', 'dados', 'Coluna CNEFE: Código único', 'Exibição do identificador único do endereço', 'low'),
  ('data:address_col:municipio', 'dados', 'Coluna CNEFE: Município', 'Exibição do nome do município', 'low'),
  ('data:address_col:endereco', 'dados', 'Coluna CNEFE: Endereço', 'Exibição do logradouro e nome da rua/avenida', 'low'),
  ('data:address_col:numero_logradouro', 'dados', 'Coluna CNEFE: Número', 'Exibição do número predial do endereço', 'low'),
  ('data:address_col:complemento', 'dados', 'Coluna CNEFE: Complemento', 'Exibição de apartamento, bloco, sala, etc.', 'low'),
  ('data:address_col:bairro', 'dados', 'Coluna CNEFE: Bairro', 'Exibição do bairro territorial', 'low'),
  ('data:address_col:subdistrito', 'dados', 'Coluna CNEFE: Subdistrito/Zona', 'Exibição da zona ou subdistrito municipal', 'low'),
  ('data:address_col:localidade', 'dados', 'Coluna CNEFE: Localidade', 'Exibição do nome da localidade', 'low'),
  ('data:address_col:nucleo_urbano', 'dados', 'Coluna CNEFE: Núcleo Urbano', 'Exibição do núcleo urbano IBGE', 'low'),
  ('data:address_col:favela_comunidade', 'dados', 'Coluna CNEFE: Favela/Comunidade', 'Identificação de favelas ou comunidades urbanas', 'low'),
  ('data:address_col:agromerado', 'dados', 'Coluna CNEFE: Aglomerado', 'Identificação de aglomerados subnormais', 'low'),
  ('data:address_col:comunidade_rural', 'dados', 'Coluna CNEFE: Comunidade Rural', 'Exibição de comunidades rurais', 'low'),
  ('data:address_col:latitude', 'dados', 'Coluna CNEFE: Latitude', 'Exibição das coordenadas de latitude', 'low'),
  ('data:address_col:longitude', 'dados', 'Coluna CNEFE: Longitude', 'Exibição das coordenadas de longitude', 'low'),
  ('data:address_col:codigo_setor', 'dados', 'Coluna CNEFE: Código do Setor', 'Exibição do geocódigo do setor censitário', 'low'),
  ('data:address_col:estabelecimento', 'dados', 'Coluna CNEFE: Estabelecimento', 'Identificação do nome do estabelecimento', 'low'),
  ('data:address_col:especie', 'dados', 'Coluna CNEFE: Espécie', 'Classificação: domicílio particular, coletivo, etc.', 'low'),
  ('data:address_col:ind_estabelecimento', 'dados', 'Coluna CNEFE: Indicador de Estabelecimento', 'Indicador de tipo de estabelecimento', 'low'),
  ('data:address_col:ind_construcao_reforma', 'dados', 'Coluna CNEFE: Construção/Reforma', 'Status de obra no endereço', 'low'),
  ('data:address_col:ind_finalidade_construcao', 'dados', 'Coluna CNEFE: Finalidade da Construção', 'Finalidade residencial, comercial ou mista', 'low'),
  ('data:address_col:tipo_edificacao', 'dados', 'Coluna CNEFE: Tipo de Edificação', 'Casa, apartamento, etc.', 'low')
ON CONFLICT (key) DO NOTHING;

-- Inserir Camadas Padrão no Catálogo (para cada camada existente)
INSERT INTO public.auth_capabilities (key, category, name, description, risk_level)
VALUES
  ('layer:Teresina', 'camadas', 'Camada: Limite Municipal de Teresina', 'Polígono do contorno do município de Teresina', 'low'),
  ('layer:Bairros', 'camadas', 'Camada: Bairros', 'Malha dos bairros oficiais de Teresina', 'low'),
  ('layer:Setores Censitarios', 'camadas', 'Camada: Setores Censitários', 'Divisões censitárias oficiais do Censo IBGE 2022', 'low'),
  ('layer:Localidades', 'camadas', 'Camada: Localidades', 'Pontos e áreas de localidades rurais e urbanas', 'low'),
  ('layer:Comunidades Rurais', 'camadas', 'Camada: Comunidades Rurais', 'Delimitação das comunidades rurais do município', 'low'),
  ('layer:Favelas e Comunidades Urbanas', 'camadas', 'Camada: Favelas e Comunidades Urbanas', 'Delimitações territoriais de comunidades urbanas', 'low'),
  ('layer:Nucleos Urbanos', 'camadas', 'Camada: Núcleos Urbanos', 'Núcleos urbanos do IBGE', 'low'),
  ('layer:Aglomerados Urbanos', 'camadas', 'Camada: Aglomerados Urbanos', 'Aglomerados populacionais urbanos', 'low'),
  ('layer:Subdistritos', 'camadas', 'Camada: Subdistritos', 'Subdivisões administrativas de Teresina', 'low'),
  ('layer:Distritos', 'camadas', 'Camada: Distritos', 'Distritos municipais', 'low'),
  ('layer:Regioes Integradas (RISP)', 'camadas', 'Camada: RISP', 'Regiões Integradas de Segurança Pública', 'low'),
  ('layer:Areas Integradas (AISP)', 'camadas', 'Camada: AISP', 'Áreas Integradas de Segurança Pública', 'low'),
  ('layer:Areas de Desenvolvimento', 'camadas', 'Camada: Áreas de Desenvolvimento', 'Áreas de Planejamento e Desenvolvimento municipal', 'low'),
  ('layer:Concentracao Urbana', 'camadas', 'Camada: Concentração Urbana', 'Mancha urbana concentrada', 'low'),
  ('layer:Regiao Intermediaria', 'camadas', 'Camada: Região Intermediária', 'Região geográfica intermediária do IBGE', 'low'),
  ('layer:Regiao Imediata', 'camadas', 'Camada: Região Imediata', 'Região geográfica imediata de Teresina', 'low'),
  ('layer:Equipamentos Publicos', 'camadas', 'Camada: Equipamentos Públicos', 'Escolas, postos de saúde, hospitais e delegacias', 'low')
ON CONFLICT (key) DO NOTHING;

-- ==============================================================================
-- 2. MIGRAÇÃO DOS PERFIS BASE COM BASE NAS CONFIGURAÇÕES GLOBAIS ATUAIS
-- ==============================================================================

-- 2.1 Perfil "visitor" (Visitante Anônimo)
-- Libera por padrão ferramentas de consulta pública e mapa base
INSERT INTO public.role_capabilities (role_id, capability_key, can_use, can_grant, effect)
SELECT 'visitor', key, TRUE, FALSE, 'allow'
FROM public.auth_capabilities
WHERE key IN (
  'tool:cnefe_search', 'tool:search_by_type', 'tool:layer_panel', 
  'tool:raio_x', 'tool:selected_features', 'tool:feature_specs', 
  'tool:sources_footer', 'tool:search_active_layers_only',
  'tool:basemap_selector', 'tool:map_legend',
  'account:self_register'
)
ON CONFLICT (role_id, capability_key) DO UPDATE 
SET can_use = EXCLUDED.can_use, effect = EXCLUDED.effect;

-- Libera todas as camadas para o visitante
INSERT INTO public.role_capabilities (role_id, capability_key, can_use, can_grant, effect)
SELECT 'visitor', key, TRUE, FALSE, 'allow'
FROM public.auth_capabilities
WHERE category = 'camadas'
ON CONFLICT (role_id, capability_key) DO NOTHING;

-- Libera colunas de endereço para o visitante
INSERT INTO public.role_capabilities (role_id, capability_key, can_use, can_grant, effect)
SELECT 'visitor', key, TRUE, FALSE, 'allow'
FROM public.auth_capabilities
WHERE category = 'dados' AND key LIKE 'data:address_col:%'
ON CONFLICT (role_id, capability_key) DO NOTHING;

-- 2.2 Perfil "site_account" (Conta do Site / Autocadastro)
-- Herda tudo de visitante + capacidade de alterar própria senha e exportar formatos básicos
INSERT INTO public.role_capabilities (role_id, capability_key, can_use, can_grant, effect)
SELECT 'site_account', capability_key, can_use, FALSE, effect
FROM public.role_capabilities
WHERE role_id = 'visitor'
ON CONFLICT (role_id, capability_key) DO NOTHING;

INSERT INTO public.role_capabilities (role_id, capability_key, can_use, can_grant, effect)
VALUES
  ('site_account', 'account:change_own_password', TRUE, FALSE, 'allow'),
  ('site_account', 'account:edit_own_profile', TRUE, FALSE, 'allow'),
  ('site_account', 'tool:measure', TRUE, FALSE, 'allow'),
  ('site_account', 'data:export:csv', TRUE, FALSE, 'allow'),
  ('site_account', 'data:export:geojson', TRUE, FALSE, 'allow')
ON CONFLICT (role_id, capability_key) DO UPDATE SET can_use = TRUE;

-- 2.3 Perfil "user" (Usuário Institucional Cadastrado)
-- Herda poderes completos de uso de ferramentas e exportações comuns
INSERT INTO public.role_capabilities (role_id, capability_key, can_use, can_grant, effect)
SELECT 'user', key, TRUE, FALSE, 'allow'
FROM public.auth_capabilities
WHERE category IN ('camadas', 'dados')
ON CONFLICT (role_id, capability_key) DO NOTHING;

INSERT INTO public.role_capabilities (role_id, capability_key, can_use, can_grant, effect)
SELECT 'user', key, TRUE, FALSE, 'allow'
FROM public.auth_capabilities
WHERE category = 'ferramentas'
ON CONFLICT (role_id, capability_key) DO UPDATE SET can_use = TRUE;

INSERT INTO public.role_capabilities (role_id, capability_key, can_use, can_grant, effect)
VALUES
  ('user', 'account:change_own_password', TRUE, FALSE, 'allow'),
  ('user', 'account:edit_own_profile', TRUE, FALSE, 'allow')
ON CONFLICT (role_id, capability_key) DO NOTHING;

-- 2.4 Perfil "manager" (Gerente de Equipe)
-- Todos os poderes de uso liberados + poderes padrão de repasse para sua equipe
INSERT INTO public.role_capabilities (role_id, capability_key, can_use, can_grant, effect)
SELECT 'manager', key, TRUE, TRUE, 'allow'
FROM public.auth_capabilities
WHERE category IN ('camadas', 'ferramentas', 'dados')
ON CONFLICT (role_id, capability_key) DO UPDATE 
SET can_use = TRUE, can_grant = TRUE;

INSERT INTO public.role_capabilities (role_id, capability_key, can_use, can_grant, effect)
VALUES
  ('manager', 'admin:panel:access', TRUE, FALSE, 'allow'),
  ('manager', 'admin:users:view', TRUE, FALSE, 'allow'),
  ('manager', 'admin:users:create', TRUE, TRUE, 'allow'),
  ('manager', 'admin:users:reset_password', TRUE, FALSE, 'allow'),
  ('manager', 'admin:logs:view', TRUE, FALSE, 'allow'),
  ('manager', 'admin:logs:export', TRUE, FALSE, 'allow'),
  ('manager', 'account:change_own_password', TRUE, FALSE, 'allow'),
  ('manager', 'account:edit_own_profile', TRUE, FALSE, 'allow')
ON CONFLICT (role_id, capability_key) DO UPDATE 
SET can_use = TRUE;

-- ==============================================================================
-- 3. MIGRAÇÃO DAS CONTAS DO SITE E EXCEÇÕES INDIVIDUAIS EM public.profiles
-- ==============================================================================

-- 3.1 Converter contas criadas pelo site para o perfil base 'site_account'
UPDATE public.profiles
SET role = 'site_account'
WHERE role = 'user' 
  AND (
    created_by ILIKE '%site%' 
    OR created_by ILIKE '%auto%' 
    OR created_by ILIKE '%visitante%'
    OR department ILIKE '%cadastrado pelo usuário%'
  );

-- 3.2 Migrar permissões de gerência legadas (manager_permissions) para user_capabilities e scopes
DO $$
DECLARE
  r RECORD;
  v_perms JSONB;
BEGIN
  FOR r IN SELECT id, manager_permissions, created_by FROM public.profiles WHERE role = 'manager' LOOP
    v_perms := r.manager_permissions;

    -- Criar escopo padrão do gerente (equipe dele)
    INSERT INTO public.user_delegation_scopes (manager_id, scope_type, allowed_departments, can_manage_site_accounts, can_manage_visitors)
    VALUES (
      r.id,
      'team_only',
      '{}',
      TRUE,
      COALESCE((v_perms->>'allowViewAllVisitors')::BOOLEAN, FALSE)
    )
    ON CONFLICT (manager_id) DO UPDATE SET
      can_manage_visitors = EXCLUDED.can_manage_visitors;

    -- Se tiver autorização de trocar senhas, atribui can_use e can_grant
    IF (v_perms->>'allowChangePasswords')::BOOLEAN = TRUE THEN
      INSERT INTO public.user_capabilities (user_id, capability_key, can_use, can_grant, effect)
      VALUES (r.id, 'admin:users:reset_password', TRUE, TRUE, 'allow')
      ON CONFLICT (user_id, capability_key) DO UPDATE SET can_use = TRUE, can_grant = TRUE;
    END IF;

    -- Se tiver autorização de criar gerentes
    IF (v_perms->>'canCreateManagerRole')::BOOLEAN = TRUE THEN
      INSERT INTO public.user_capabilities (user_id, capability_key, can_use, can_grant, effect)
      VALUES (r.id, 'admin:users:promote_manager', TRUE, TRUE, 'allow')
      ON CONFLICT (user_id, capability_key) DO UPDATE SET can_use = TRUE, can_grant = TRUE;
    END IF;

    -- Se geração de logins foi explicitamente bloqueada pelo master
    IF (v_perms->>'allowGenerateLogins')::BOOLEAN = FALSE THEN
      INSERT INTO public.user_capabilities (user_id, capability_key, can_use, can_grant, effect)
      VALUES (r.id, 'admin:users:create', FALSE, FALSE, 'deny')
      ON CONFLICT (user_id, capability_key) DO UPDATE SET can_use = FALSE, can_grant = FALSE, effect = 'deny';
    END IF;
  END LOOP;
END $$;

-- 3.3 Migrar exceções de ferramentas (custom_feature_permissions) para user_capabilities
DO $$
DECLARE
  r RECORD;
  k TEXT;
  v_val BOOLEAN;
  v_cap_key TEXT;
BEGIN
  FOR r IN SELECT id, custom_feature_permissions FROM public.profiles WHERE has_custom_permissions = TRUE AND custom_feature_permissions IS NOT NULL LOOP
    FOR k, v_val IN SELECT * FROM jsonb_each_text(r.custom_feature_permissions) LOOP
      -- Mapeia chaves booleanas antigas para capability keys
      CASE k
        WHEN 'allowCnefeSearch' THEN v_cap_key := 'tool:cnefe_search';
        WHEN 'allowMeasureTool' THEN v_cap_key := 'tool:measure';
        WHEN 'allowPrintA4' THEN v_cap_key := 'tool:print_a4';
        WHEN 'allowLayerPanel' THEN v_cap_key := 'tool:layer_panel';
        WHEN 'allowDashboardRaioX' THEN v_cap_key := 'tool:raio_x';
        WHEN 'allowSelectedFeaturesPanel' THEN v_cap_key := 'tool:selected_features';
        WHEN 'allowFeatureSpecs' THEN v_cap_key := 'tool:feature_specs';
        WHEN 'allowSourcesFooter' THEN v_cap_key := 'tool:sources_footer';
        WHEN 'allowSearchActiveLayersOnly' THEN v_cap_key := 'tool:search_active_layers_only';
        WHEN 'allowDissolveFeatures' THEN v_cap_key := 'tool:dissolve_features';
        WHEN 'allowMultiSelect' THEN v_cap_key := 'tool:multi_select';
        WHEN 'allowSearchByType' THEN v_cap_key := 'tool:search_by_type';
        WHEN 'allowSearchAreaAddresses' THEN v_cap_key := 'tool:search_area_addresses';
        WHEN 'allowCustomizeUsefulInfo' THEN v_cap_key := 'tool:customize_useful_info';
        WHEN 'allowBasemapSelector' THEN v_cap_key := 'tool:basemap_selector';
        WHEN 'allowMapLegend' THEN v_cap_key := 'tool:map_legend';
        WHEN 'allowExportCsv' THEN v_cap_key := 'data:export:csv';
        WHEN 'allowExportKml' THEN v_cap_key := 'data:export:kml';
        WHEN 'allowExportKmz' THEN v_cap_key := 'data:export:kmz';
        WHEN 'allowExportGeoJson' THEN v_cap_key := 'data:export:geojson';
        WHEN 'allowExportShapefile' THEN v_cap_key := 'data:export:shapefile';
        WHEN 'allowExportGeoPackage' THEN v_cap_key := 'data:export:geopackage';
        ELSE v_cap_key := NULL;
      END CASE;

      IF v_cap_key IS NOT NULL THEN
        INSERT INTO public.user_capabilities (user_id, capability_key, can_use, can_grant, effect)
        VALUES (r.id, v_cap_key, v_val, FALSE, CASE WHEN v_val THEN 'allow' ELSE 'deny' END)
        ON CONFLICT (user_id, capability_key) DO UPDATE 
        SET can_use = EXCLUDED.can_use, effect = EXCLUDED.effect;
      END IF;
    END LOOP;
  END LOOP;
END $$;

-- 4. Registrar Auditoria Inicial da Migração
INSERT INTO public.capability_audit_logs (
  performed_by,
  performed_by_name,
  target_type,
  target_id,
  capability_key,
  action,
  reason
)
VALUES (
  NULL,
  'Sistema de Migração SQL',
  'global',
  'system',
  '*',
  'grant_use',
  'Migração estrutural de permissões e perfis base para o novo modelo relacional de capacidades.'
);

COMMIT;
