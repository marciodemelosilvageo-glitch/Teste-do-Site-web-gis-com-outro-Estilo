import { createClient } from '@supabase/supabase-js';
import { supabase, toSyntheticEmail, SUPABASE_URL, SUPABASE_ANON_KEY } from '../supabaseClient';

export type UserRole = 'master' | 'manager' | 'manager_user' | 'user' | 'site_account' | 'visitor' | 'admin';

export interface LayerPermission {
  name: string;
  allowed: boolean;
}

export interface FeaturePermissions {
  allowCnefeSearch: boolean;
  allowExportData: boolean;
  allowMeasureTool: boolean;
  allowPrintA4: boolean;
  allowLayerPanel: boolean;
  allowDashboardRaioX: boolean;
  allowSelectedFeaturesPanel: boolean;
  allowFeatureSpecs: boolean;
  allowSourcesFooter: boolean;
  allowSearchActiveLayersOnly: boolean;

  // Novas ferramentas
  allowDissolveFeatures: boolean;
  allowMultiSelect: boolean;
  allowSearchByType: boolean;
  allowSearchAreaAddresses: boolean;
  allowCustomizeUsefulInfo: boolean;
  allowExportCsv: boolean;
  allowExportKml: boolean;
  allowExportKmz: boolean;
  allowExportGeoJson: boolean;
  allowExportShapefile: boolean;
  allowExportGeoPackage: boolean;
  allowBasemapSelector: boolean;
  allowMapLegend: boolean;
}

export const ALL_ADDRESS_COLUMNS = [
  { key: 'codigo_unico', label: 'Código único do endereço' },
  { key: 'municipio', label: 'Nome do município' },
  { key: 'endereco', label: 'Endereço / Logradouro' },
  { key: 'numero_logradouro', label: 'Número no logradouro' },
  { key: 'complemento', label: 'Complemento' },
  { key: 'bairro', label: 'Bairro' },
  { key: 'subdistrito', label: 'Zona / Subdistrito' },
  { key: 'localidade', label: 'Localidade' },
  { key: 'nucleo_urbano', label: 'Núcleo Urbano' },
  { key: 'favela_comunidade', label: 'Favelas ou Comunidades Urbanas' },
  { key: 'agromerado', label: 'Aglomerado' },
  { key: 'comunidade_rural', label: 'Comunidades Rurais de Teresina' },
  { key: 'latitude', label: 'Latitude' },
  { key: 'longitude', label: 'Longitude' },
  { key: 'codigo_setor', label: 'Código do setor censitário' },
  { key: 'estabelecimento', label: 'Identificação do estabelecimento' },
  { key: 'especie', label: 'Espécie de endereço' },
  { key: 'ind_estabelecimento', label: 'Indicador de estabelecimento' },
  { key: 'ind_construcao_reforma', label: 'Indicador de construção/reforma' },
  { key: 'ind_finalidade_construcao', label: 'Finalidade da construção' },
  { key: 'tipo_edificacao', label: 'Tipo da edificação dos domicílios' }
];

export const ALL_FEATURE_PROPERTIES = [
  { key: '_centroide', label: 'Coordenadas (Centro Territorial)' },
  { key: 'NM_MUN', label: 'Nome do Município' },
  { key: 'NM_BAIRRO', label: 'Nome do Bairro' },
  { key: 'NM_DIST', label: 'Nome do Distrito' },
  { key: 'NM_SUBDIST', label: 'Nome do Subdistrito' },
  { key: 'NM_NU', label: 'Nome do Núcleo Urbano' },
  { key: 'NM_FCU', label: 'Nome da Favela/Comunidade' },
  { key: 'NM_AGLOM', label: 'Nome do Aglomerado' },
  { key: 'Area de desenvolvimento', label: 'Área de Desenvolvimento' },
  { key: 'Aisp', label: 'AISP' },
  { key: 'Risp', label: 'RISP' },
  { key: 'Localidade', label: 'Localidade' },
  { key: 'Nome', label: 'Nome da Feição' },
  { key: 'AREA_KM2', label: 'Área Territorial (km²)' },
  { key: 'CD_SETOR', label: 'Geocódigo do Setor Censitário' },
  { key: 'SITUACAO', label: 'Situação (Urbana/Rural)' },
  { key: 'CD_SIT', label: 'Situação Detalhada' },
  { key: 'CD_TIPO', label: 'Tipo do Setor' },
  { key: 'CD_MUN', label: 'Código do Município' },
  { key: 'CD_DIST', label: 'Código do Distrito' },
  { key: 'CD_SUBDIST', label: 'Código do Subdistrito' },
  { key: 'CD_BAIRRO', label: 'Código do Bairro' },
  { key: 'CD_NU', label: 'Código do Núcleo Urbano' },
  { key: 'CD_FCU', label: 'Código da Favela/Comunidade' },
  { key: 'CD_AGLOM', label: 'Código do Aglomerado' },
  { key: 'CD_RGINT', label: 'Código da Região Intermediária' },
  { key: 'NM_RGINT', label: 'Nome da Região Intermediária' },
  { key: 'CD_RGI', label: 'Código da Região Imediata' },
  { key: 'NM_RGI', label: 'Nome da Região Imediata' },
  { key: 'CD_CONCURB', label: 'Código da Concentração Urbana' },
  { key: 'NM_CONCURB', label: 'Nome da Concentração Urbana' },
  { key: 'V0001', label: 'Total de Pessoas (População)' },
  { key: 'V0002', label: 'Total de Domicílios Geral' },
  { key: 'V0003', label: 'Total de Domicílios Particulares' },
  { key: 'V0004', label: 'Total de Domicílios Coletivos' },
  { key: 'V0005', label: 'Média de Moradores por Domicílio' },
  { key: 'V0006', label: 'Percentual de Domicílios Imputados' },
  { key: 'V0007', label: 'Total de Domicílios Particulares Ocupados' },
  { key: 'CEP', label: 'CEP' }
];

export interface ActivityLog {
  id: string;
  timestamp: string; // ISO string
  formattedDate: string;
  userRole: UserRole;
  category: 'ACESSO' | 'BUSCA' | 'ENDERECO' | 'CAMADA' | 'EXPORTACAO' | 'FEICAO' | 'MEDICAO' | 'IMPRESSAO' | 'ADMIN';
  action: string;
  details?: string;
  sessionId: string;
  actorId?: string;
}

export type CapabilityAuditAction =
  | 'grant_use'
  | 'revoke_use'
  | 'grant_delegate'
  | 'revoke_delegate'
  | 'set_deny'
  | 'remove_override';

export interface CapabilityAuditLog {
  id: string;
  timestamp: string; // ISO string
  formattedDate?: string;
  performedBy?: string;
  performedByName?: string;
  targetType: 'user' | 'base_role' | 'global';
  targetId: string;
  targetName?: string;
  capabilityKey: string;
  action: CapabilityAuditAction;
  beforeState?: Record<string, any> | null;
  afterState?: Record<string, any> | null;
  reason?: string | null;
}

export interface UserSessionConfig {
  sessionId: string;
  customName?: string;
  firstSeen: string; // ISO string
  lastSeen: string;  // ISO string
  formattedFirstSeen: string;
  formattedLastSeen: string;
  role: UserRole;
  isBlocked?: boolean;
  loginCount?: number; // Contador de acessos ao site
  device?: string;     // Dispositivo / Plataforma (ex: Windows PC, Android, iOS)
  hasCustomPermissions?: boolean;
  customLayerPermissions?: Record<string, boolean>; // Se definido, sobrepõe o global
  customFeaturePermissions?: FeaturePermissions;    // Se definido, sobrepõe o global
  customAddressColumnsPermissions?: Record<string, boolean>;
  customFeaturePropertiesPermissions?: Record<string, boolean>;
  // Telemetria confiável gerada pelo servidor (auth.users, auth.sessions e heartbeat)
  authUid?: string;
  isAnonymous?: boolean;
  ipAddress?: string;
  userAgent?: string;
  isOnline?: boolean;
  sessionCreatedAt?: string;
  sessionRefreshedAt?: string;
}

export interface ManagerPermissions {
  allowGenerateLogins?: boolean;       // Permitir gerar novos logins de usuários (padrão: true)
  canCreateManagerRole?: boolean;      // Se true: pode criar Gerentes além de Usuários Comuns (padrão: false)
  allowChangePasswords?: boolean;      // Permitir trocar senhas de usuários (padrão: false)
  allowViewAllVisitors?: boolean;      // Permitir visualizar monitoramento de todos os visitantes do site (padrão: false)
  allowBlockUsers?: boolean;
  allowDeleteUsers?: boolean;
  allowManageVisitors?: boolean;
  allowManageSiteAccounts?: boolean;
  allowManageRolesVisitor?: boolean;
  allowManageRolesSiteAccount?: boolean;
  allowManageRolesUser?: boolean;
  allowViewLogs?: boolean;
  allowExportLogs?: boolean;
  allowSimulateProfile?: boolean;
  scopeType?: 'team_only' | 'all_users';
}

export interface RegisteredUser {
  id: string;
  username: string; // Login de acesso único (ex: 'joao.silva')
  password?: string; // Mantido apenas para compatibilidade de tipos (nunca armazenado em texto)
  name: string;     // Nome completo ou identificação (ex: 'João da Silva')
  role: UserRole; // Cargo na hierarquia ('master' | 'manager' | 'user' | 'admin')
  department?: string; // Cargo, setor ou secretaria
  createdAt: string;
  createdBy?: string; // Identificador de quem cadastrou (Master ou Gerente)
  lastLogin?: string;
  isActive: boolean;
  mustChangePassword?: boolean;
  hasCustomPermissions: boolean;
  managerPermissions?: ManagerPermissions;
  customLayerPermissions?: Record<string, boolean>;
  customFeaturePermissions?: FeaturePermissions;
  customAddressColumnsPermissions?: Record<string, boolean>;
  customFeaturePropertiesPermissions?: Record<string, boolean>;
}

const STORAGE_KEYS = {
  ROLE: 'webgis_current_role',
  LAYER_PERMISSIONS: 'webgis_layer_permissions',
  FEATURE_PERMISSIONS: 'webgis_feature_permissions',
  ADDRESS_COLUMNS_PERMISSIONS: 'webgis_address_columns_permissions',
  FEATURE_PROPERTIES_PERMISSIONS: 'webgis_feature_properties_permissions',
  ACTIVITY_LOGS: 'webgis_activity_logs',
  SESSION_ID: 'webgis_session_id',
  USER_SESSIONS: 'webgis_user_sessions_v1',
  REGISTERED_USERS: 'webgis_registered_users_v1',
  CURRENT_ACTIVE_USER: 'webgis_current_active_user_v1',
  CAPABILITY_AUDIT_LOGS: 'webgis_capability_audit_logs',
  ROLE_CAPABILITIES_MATRIX: 'webgis_role_capabilities_matrix_v1',
  USER_CAPABILITIES_OVERRIDES: 'webgis_user_capabilities_overrides_v1',
  USER_DELEGATION_SCOPES: 'webgis_user_delegation_scopes_v1',
};

// Notificar componentes sobre mudanças de permissões
export const notifyPermissionsUpdated = (detail?: { reason?: string; scope?: string }) => {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('webgis_permissions_updated', { detail }));
    // Propaga via Realtime para outras abas e navegadores conectados
    bumpPermissionsEpochOnServer(detail?.scope || 'global').catch(() => {});
  }
};

/**
 * Incrementa a época de permissões no servidor (quando o master/gerente salva alterações)
 */
let isBumpRpcAvailable: boolean | null = (() => {
  try {
    if (typeof sessionStorage !== 'undefined') {
      const val = sessionStorage.getItem('webgis_bump_rpc_available');
      if (val === 'false') return false;
      if (val === 'true') return true;
    }
  } catch {}
  return null;
})();

/**
 * Controle de disponibilidade da Edge Function admin-users (evita erros repetitivos de CORS no console)
 * Por padrão, permanece desativada (false) quando a função não está implantada no projeto Supabase,
 * evitando requisições preflight OPTIONS que retornam 404 e geram bloqueio de CORS no console.
 */
let isEdgeFunctionAvailable: boolean = (() => {
  try {
    if (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_USE_EDGE_FUNCTIONS === 'true') {
      return true;
    }
    if (typeof localStorage !== 'undefined') {
      const val = localStorage.getItem('webgis_edge_function_available');
      if (val === 'true') return true;
      if (val === 'false') return false;
    }
    if (typeof sessionStorage !== 'undefined') {
      const val = sessionStorage.getItem('webgis_edge_function_available');
      if (val === 'true') return true;
      if (val === 'false') return false;
    }
  } catch {}
  return false;
})();

export const setEdgeFunctionAvailable = (available: boolean) => {
  isEdgeFunctionAvailable = available;
  try {
    localStorage.setItem('webgis_edge_function_available', String(available));
    sessionStorage.setItem('webgis_edge_function_available', String(available));
  } catch {}
};

export const resetEdgeFunctionCheck = () => {
  isEdgeFunctionAvailable = false;
  try {
    localStorage.removeItem('webgis_edge_function_available');
    sessionStorage.removeItem('webgis_edge_function_available');
  } catch {}
};

export const bumpPermissionsEpochOnServer = async (scope: string = 'global') => {
  if (isBumpRpcAvailable === false) return;
  // Apenas Master e Gerentes autenticados podem incrementar a época de permissões no servidor (evita 401/400)
  if (!canAttemptDirectSettingsRead()) return;
  try {
    const { data: authData } = await supabase.auth.getSession();
    if (!authData?.session?.user) return;
    const { error, status } = await supabase.rpc('bump_permissions_epoch', { p_scope: scope });
    if (error) {
      if (status === 404 || error.code === 'PGRST202' || error.message?.includes('not found') || (error as any).status === 404) {
        isBumpRpcAvailable = false;
        try { sessionStorage.setItem('webgis_bump_rpc_available', 'false'); } catch {}
      }
    } else {
      isBumpRpcAvailable = true;
      try { sessionStorage.setItem('webgis_bump_rpc_available', 'true'); } catch {}
    }
  } catch {
    isBumpRpcAvailable = false;
    try { sessionStorage.setItem('webgis_bump_rpc_available', 'false'); } catch {}
  }
};

/**
 * Estado de recuo exponencial e controle de alertas para a RPC get_my_access_settings
 */
let rpcSettingsFailures = 0;
let nextRpcSettingsRetryTime = 0;
let rpcSettingsWarned = false;
let lastSettingsSyncTimestamp = Date.now();
let hasStaleSettingsWarnedUI = false;

// 15 minutos sem sincronização bem-sucedida é considerado desatualizado há muito tempo
const STALE_SETTINGS_THRESHOLD_MS = 15 * 60 * 1000;

/**
 * Informa se o cache local de configurações está sem sincronização há muito tempo (> 15 min)
 */
export const isSettingsSyncStale = (): boolean => {
  return Date.now() - lastSettingsSyncTimestamp > STALE_SETTINGS_THRESHOLD_MS;
};

/**
 * Verifica se o usuário atual tem permissão para realizar fallback de leitura direta na tabela webgis_settings.
 * Usuários comuns e visitantes NÃO devem tentar ler a tabela diretamente (bloqueado por RLS).
 */
const canAttemptDirectSettingsRead = (): boolean => {
  try {
    const active = getCurrentActiveUser();
    const role = (active?.role || (typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEYS.ROLE) : null)) as UserRole | null;
    return role === 'master' || role === 'admin' || role === 'manager';
  } catch {
    return false;
  }
};

/**
 * Aplica os dados de permissões retornados às chaves de localStorage e detecta se houve alteração
 */
const applySettingsDataToStorage = (settingsData: any): boolean => {
  if (!settingsData) return false;
  let hasChanged = false;

  if (settingsData.layer_permissions) {
    const next = JSON.stringify(settingsData.layer_permissions);
    if (localStorage.getItem(STORAGE_KEYS.LAYER_PERMISSIONS) !== next) {
      localStorage.setItem(STORAGE_KEYS.LAYER_PERMISSIONS, next);
      hasChanged = true;
    }
  }
  if (settingsData.feature_permissions) {
    const next = JSON.stringify(settingsData.feature_permissions);
    if (localStorage.getItem(STORAGE_KEYS.FEATURE_PERMISSIONS) !== next) {
      localStorage.setItem(STORAGE_KEYS.FEATURE_PERMISSIONS, next);
      hasChanged = true;
    }
  }
  if (settingsData.address_columns_permissions) {
    const next = JSON.stringify(settingsData.address_columns_permissions);
    if (localStorage.getItem(STORAGE_KEYS.ADDRESS_COLUMNS_PERMISSIONS) !== next) {
      localStorage.setItem(STORAGE_KEYS.ADDRESS_COLUMNS_PERMISSIONS, next);
      hasChanged = true;
    }
  }
  if (settingsData.feature_properties_permissions) {
    const next = JSON.stringify(settingsData.feature_properties_permissions);
    if (localStorage.getItem(STORAGE_KEYS.FEATURE_PROPERTIES_PERMISSIONS) !== next) {
      localStorage.setItem(STORAGE_KEYS.FEATURE_PROPERTIES_PERMISSIONS, next);
      hasChanged = true;
    }
  }

  return hasChanged;
};

/**
 * Consulta a RPC get_my_access_settings com proteção contra loops e falhas em cascata:
 * 1. Respeita janela de recuo exponencial (30s, 60s, 120s, até 300s).
 * 2. Emite UM aviso claro no console na primeira falha (sem spam repetitivo por ciclo).
 * 3. Fallback de leitura direta na tabela webgis_settings EXCLUSIVO para Master e Gerente.
 * 4. Cache local em localStorage preservado como último recurso.
 * 5. Notifica a interface apenas se as configurações ficarem desatualizadas por muito tempo (> 15 min).
 */
const fetchGlobalSettingsWithBackoffAsync = async (): Promise<{
  data: any | null;
  schemaMissing?: boolean;
}> => {
  const now = Date.now();

  // Alerta a interface caso as configurações estejam sem sincronização há muito tempo
  if (!hasStaleSettingsWarnedUI && now - lastSettingsSyncTimestamp > STALE_SETTINGS_THRESHOLD_MS) {
    hasStaleSettingsWarnedUI = true;
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('webgis_settings_stale', {
          detail: {
            message: 'Configurações de acesso do sistema estão utilizando dados locais devido a falha na conexão com o servidor.',
            lastSyncTimestamp: lastSettingsSyncTimestamp
          }
        })
      );
    }
  }

  // Se estiver na janela de recuo exponencial, pula nova tentativa da RPC e preserva cache local
  if (now < nextRpcSettingsRetryTime) {
    return { data: null };
  }

  try {
    const { data: rpcData, error: rpcError } = await supabase.rpc('get_my_access_settings');

    if (!rpcError && rpcData) {
      // Sucesso: reseta histórico de falhas e restaura sincronização
      rpcSettingsFailures = 0;
      nextRpcSettingsRetryTime = 0;
      rpcSettingsWarned = false;
      lastSettingsSyncTimestamp = Date.now();
      hasStaleSettingsWarnedUI = false;
      return { data: rpcData };
    }

    // Falha na RPC: incrementa contador e calcula recuo exponencial
    rpcSettingsFailures++;
    // Recuo: 30s, 60s, 120s, 240s, até o teto de 300s (5 minutos)
    const backoffDelayMs = Math.min(30000 * Math.pow(2, rpcSettingsFailures - 1), 300000);
    nextRpcSettingsRetryTime = Date.now() + backoffDelayMs;

    // Registra UM aviso claro no console (não um por ciclo)
    if (!rpcSettingsWarned) {
      rpcSettingsWarned = true;
      const errMsg = rpcError?.message || rpcError?.code || 'Erro de comunicação';
      console.warn(
        `⚠️ [WebGIS] RPC get_my_access_settings indisponível (${errMsg}). ` +
        `Ativando recuo exponencial (${Math.round(backoffDelayMs / 1000)}s) e mantendo cache local.`
      );
    }

    // Fallback de leitura direta: EXCLUSIVO para Master e Gerente
    if (canAttemptDirectSettingsRead()) {
      const { data: directData, error: directError } = await supabase
        .from('webgis_settings')
        .select('*')
        .eq('id', 'global')
        .maybeSingle();

      if (directError && directError.code === 'PGRST205') {
        return { data: null, schemaMissing: true };
      }

      if (!directError && directData) {
        lastSettingsSyncTimestamp = Date.now();
        return { data: directData };
      }
    }

    // Usuário comum e visitante NÃO tentam ler a tabela webgis_settings diretamente
    return { data: null };
  } catch {
    rpcSettingsFailures++;
    const backoffDelayMs = Math.min(30000 * Math.pow(2, rpcSettingsFailures - 1), 300000);
    nextRpcSettingsRetryTime = Date.now() + backoffDelayMs;

    if (!rpcSettingsWarned) {
      rpcSettingsWarned = true;
      console.warn(
        `⚠️ [WebGIS] Falha ao consultar configurações no servidor. ` +
        `Ativando recuo exponencial (${Math.round(backoffDelayMs / 1000)}s) e mantendo cache local.`
      );
    }
    return { data: null };
  }
};

/**
 * Recarrega apenas as configurações globais de forma leve e segura (via RPC get_my_access_settings com recuo exponencial e fallback restrito)
 */
export const refreshGlobalSettingsAsync = async (): Promise<boolean> => {
  try {
    const { data: settingsData } = await fetchGlobalSettingsWithBackoffAsync();
    if (!settingsData) return false;
    return applySettingsDataToStorage(settingsData);
  } catch {
    return false;
  }
};

// Sincronização inicial com o Supabase
let isInitialized = false;

export const initAdminService = async (forceRefresh = false) => {
  if (typeof window === 'undefined') return;
  if (isInitialized && !forceRefresh) return;
  isInitialized = true;

  try {
    // 1. Carregar Configurações Globais (RPC segura get_my_access_settings com recuo exponencial e fallback restrito)
    const { data: settingsData, schemaMissing } = await fetchGlobalSettingsWithBackoffAsync();

    if (schemaMissing) {
      if (!(window as any).__webgis_schema_warned) {
        (window as any).__webgis_schema_warned = true;
        console.info('ℹ️ WebGIS: Tabelas do Supabase não encontradas. O sistema está utilizando armazenamento local (localStorage). Para ativar a sincronização em nuvem, execute o script supabase_schema.sql no painel do Supabase.');
      }
      return;
    }

    let hasChanged = false;

    if (settingsData) {
      hasChanged = applySettingsDataToStorage(settingsData);
    } else if (canAttemptDirectSettingsRead()) {
      // Cria a linha inicial no Supabase se for Master/Gerente e ainda não existir
      await syncAllSettingsToSupabase();
    }

    // 2. Carregar Usuários Cadastrados a partir da tabela profiles (se autenticado com permissão)
    try {
      const freshProfiles = await getRegisteredUsersAsync();
      if (freshProfiles.length > 0) {
        hasChanged = true;
      }
    } catch { }

    // 3. Carregar Sessões de Usuários do Supabase (apenas se autenticado como gestor/master)
    if (canAttemptDirectSettingsRead()) {
      const { data: sessionsData } = await supabase
        .from('webgis_user_sessions')
        .select('*');

      if (sessionsData && sessionsData.length > 0) {
        const localSessions = getUserSessions();
        sessionsData.forEach((row: any) => {
          localSessions[row.session_id] = {
            sessionId: row.session_id,
            customName: row.custom_name,
            firstSeen: row.first_seen,
            lastSeen: row.last_seen,
            formattedFirstSeen: row.formatted_first_seen,
            formattedLastSeen: row.formatted_last_seen,
            role: row.role as UserRole,
            isBlocked: row.is_blocked,
            hasCustomPermissions: row.has_custom_permissions,
            customLayerPermissions: row.custom_layer_permissions,
            customFeaturePermissions: row.custom_feature_permissions,
            customAddressColumnsPermissions: row.custom_address_columns_permissions,
            customFeaturePropertiesPermissions: row.custom_feature_properties_permissions,
          };
        });
        const nextSessions = JSON.stringify(localSessions);
        if (localStorage.getItem(STORAGE_KEYS.USER_SESSIONS) !== nextSessions) {
          localStorage.setItem(STORAGE_KEYS.USER_SESSIONS, nextSessions);
          hasChanged = true;
        }
      }
    }

    if (hasChanged) {
      notifyPermissionsUpdated();
    }

    // 4. Polling pesado de 10s removido com sucesso:
    // A propagação agora é realizada via Supabase Realtime (permissions_epoch) em ~1 segundo,
    // complementada por verificação leve de contadores a cada 45s apenas se houver novas épocas.

  } catch (err) {
    console.warn('Conexão inicial com Supabase fallback para localStorage:', err);
  }
};

// Sincronizar todas as configurações para a nuvem
const syncAllSettingsToSupabase = async (): Promise<{ success: boolean; error?: string }> => {
  try {
    const layerPerms = getLayerPermissions([]);
    const featPerms = getFeaturePermissions();
    const addrPerms = getAddressColumnsPermissions();
    const propPerms = getFeaturePropertiesPermissions();

    const { error } = await supabase.from('webgis_settings').upsert({
      id: 'global',
      layer_permissions: layerPerms,
      feature_permissions: featPerms,
      address_columns_permissions: addrPerms,
      feature_properties_permissions: propPerms,
      updated_at: new Date().toISOString()
    });

    if (error) {
      console.error('Erro ao sincronizar configurações com Supabase:', error);
      return { success: false, error: error.message };
    }
    return { success: true };
  } catch (e: any) {
    console.warn('Erro ao sincronizar configurações com Supabase:', e);
    return { success: false, error: e?.message || 'Falha de conexão com Supabase' };
  }
};

// Obter ou gerar ID de Sessão único para rastreamento
export const getSessionId = (): string => {
  if (typeof window === 'undefined') return 'server';
  let sId = sessionStorage.getItem(STORAGE_KEYS.SESSION_ID);
  if (!sId) {
    sId = 'sess_' + Math.random().toString(36).substring(2, 8) + '_' + Date.now().toString(36);
    sessionStorage.setItem(STORAGE_KEYS.SESSION_ID, sId);
  }
  return sId;
};

// Ordenador auxiliar: Contas mais recentes criadas/cadastradas sempre no topo (ordem decrescente)
const sortUsersMostRecentFirst = (users: RegisteredUser[]): RegisteredUser[] => {
  if (!Array.isArray(users)) return [];
  return [...users].sort((a, b) => {
    const parseTime = (u: RegisteredUser): number => {
      if (u.createdAt) {
        const t = new Date(u.createdAt).getTime();
        if (!isNaN(t) && t > 0) return t;
      }
      if (u.lastLogin) {
        const t = new Date(u.lastLogin).getTime();
        if (!isNaN(t) && t > 0) return t;
      }
      if (u.id && u.id.startsWith('usr_')) {
        const parts = u.id.split('_');
        const num = parseInt(parts[1], 10);
        if (!isNaN(num) && num > 0) return num;
      }
      return 0;
    };
    return parseTime(b) - parseTime(a);
  });
};

// ================= USUÁRIOS CADASTRADOS (LOGINS ATIVOS) =================

// Obter todos os usuários cadastrados (lê o cache local atualizado pelo Supabase)
export const getRegisteredUsers = (): RegisteredUser[] => {
  if (typeof window === 'undefined') return [];

  let usersList: RegisteredUser[] = [];
  try {
    const saved = localStorage.getItem(STORAGE_KEYS.REGISTERED_USERS);
    if (saved) {
      const list = JSON.parse(saved);
      if (Array.isArray(list)) {
        // Garantir que todos tenham o campo role normalizado
        usersList = list.map(u => ({
          ...u,
          role: (u.role as any) === 'admin' ? 'master' : (u.role || 'user')
        }));
      }
    }
  } catch (e) {
    console.error('Erro ao ler usuários cadastrados:', e);
  }

  return sortUsersMostRecentFirst(usersList);
};

// Helper para identificar de forma segura se um usuário é anônimo
export const isAnonymousUser = (user: any): boolean => {
  if (!user) return false;
  return Boolean(user.is_anonymous || user.app_metadata?.provider === 'anonymous');
};

// Garante sessão anônima para visitantes com token JWT do Supabase (NUNCA reaproveita sessão de conta)
export const ensureVisitorAuth = async (): Promise<string | null> => {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    // Se já existe sessão E ela é comprovadamente anônima, reaproveita o ID
    if (session?.user && isAnonymousUser(session.user)) {
      return session.user.id;
    }

    // Se existe uma sessão ativa de CONTA (não-anônima), desconecta para não contaminar visitante com conta
    if (session?.user && !isAnonymousUser(session.user)) {
      console.info('[AUTH] Desconectando conta anterior antes de iniciar sessão anônima de visitante.');
      await supabase.auth.signOut({ scope: 'local' });
    }

    const { data: anonData, error } = await supabase.auth.signInAnonymously();
    if (!error && anonData?.user) {
      return anonData.user.id;
    }
    if (error) {
      console.warn('Falha no login anônimo de visitante:', error.message);
    }
  } catch (e) {
    console.warn('Erro ao verificar/criar sessão de visitante:', e);
  }
  return null;
};

// SEMPRE busca a lista MAIS RECENTE da tabela public.profiles no Supabase
export const getRegisteredUsersAsync = async (): Promise<RegisteredUser[]> => {
  try {
    const { data: authData } = await supabase.auth.getSession();
    const authUser = authData?.session?.user;
    // Visitantes anônimos e usuários não autenticados não têm permissão na tabela profiles (evita 401)
    if (!authUser || isAnonymousUser(authUser)) {
      return getRegisteredUsers();
    }

    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error && Array.isArray(data)) {
      const usersList: RegisteredUser[] = data.map((p: any) => ({
        id: p.id,
        username: p.username,
        name: p.name,
        role: (p.role === 'admin' ? 'master' : (p.role || 'user')) as UserRole,
        department: p.department || '',
        createdAt: p.created_at,
        createdBy: p.created_by || '',
        lastLogin: p.last_login,
        isActive: p.is_active !== false,
        mustChangePassword: !!p.must_change_password,
        hasCustomPermissions: !!p.has_custom_permissions,
        managerPermissions: p.manager_permissions || undefined,
        customLayerPermissions: p.custom_layer_permissions || undefined,
        customFeaturePermissions: p.custom_feature_permissions || undefined,
        customAddressColumnsPermissions: p.custom_address_columns_permissions || undefined,
        customFeaturePropertiesPermissions: p.custom_feature_properties_permissions || undefined,
      }));
      const sorted = sortUsersMostRecentFirst(usersList);
      // Atualiza o cache local com os dados frescos do servidor
      localStorage.setItem(STORAGE_KEYS.REGISTERED_USERS, JSON.stringify(sorted));
      return sorted;
    }
  } catch (e) {
    console.warn('getRegisteredUsersAsync: falha ao buscar da tabela profiles:', e);
  }
  // Fallback para cache local
  return getRegisteredUsers();
};

// Normalizador de nome de usuário (@, lowercase, trim)
export const sanitizeUsername = (username: string): string => {
  return (username || '')
    .trim()
    .toLowerCase()
    .replace(/^@+/, '')
    .trim();
};

// Verificar em tempo real se um nome de usuário está disponível
export const isUsernameAvailableAsync = async (
  username: string,
  excludeUserId?: string
): Promise<{ available: boolean; existingUser?: RegisteredUser }> => {
  const clean = sanitizeUsername(username);
  if (!clean || clean.length < 3) return { available: false };
  const allUsers = await getRegisteredUsersAsync();
  const found = allUsers.find(u =>
    sanitizeUsername(u.username) === clean && (!excludeUserId || u.id !== excludeUserId)
  );
  return {
    available: !found,
    existingUser: found
  };
};

// Salvar ou Atualizar Usuário Cadastrado (Via Edge Function segura no Supabase)
export const saveRegisteredUser = async (
  userData: Partial<RegisteredUser> & { username: string; name: string },
  requester?: { username?: string; role?: UserRole } | null | 'master'
): Promise<{ success: boolean; users: RegisteredUser[]; error?: string }> => {
  if (typeof window === 'undefined') return { success: false, users: [], error: 'Ambiente inválido' };

  const usernameClean = sanitizeUsername(userData.username);
  if (!usernameClean || usernameClean.length < 3) {
    return { success: false, users: getRegisteredUsers(), error: 'O nome de usuário deve ter pelo menos 3 caracteres.' };
  }

  const nameClean = userData.name.trim();
  if (!nameClean) {
    return { success: false, users: getRegisteredUsers(), error: 'Informe o nome completo do usuário.' };
  }

  const currentUsers = await getRegisteredUsersAsync();

  // Verificação estrita: Não permitir duplicidade de nome de usuário
  const duplicateUser = currentUsers.find(u =>
    sanitizeUsername(u.username) === usernameClean && (!userData.id || u.id !== userData.id)
  );

  if (duplicateUser) {
    return {
      success: false,
      users: currentUsers,
      error: `Não é permitido criar mais de uma conta com o mesmo nome de usuário. O login "@${usernameClean}" já está em uso pela conta "${duplicateUser.name}".`
    };
  }

  const requesterRole = typeof requester === 'string' ? requester : (requester?.role || 'master');
  const requesterName = typeof requester === 'string' ? requester : (requester?.username || 'Master');
  const isManager = requesterRole === 'manager';
  const managerObj = isManager ? currentUsers.find(u => u.username.toLowerCase() === requesterName.toLowerCase()) : null;

  // Validação para Gerentes:
  if (isManager) {
    if (!userData.id && managerObj?.managerPermissions?.allowGenerateLogins === false) {
      return { success: false, users: currentUsers, error: 'O Administrador Master não liberou permissão para você gerar novos logins.' };
    }
  }

  // 1. CRIAÇÃO DE NOVO USUÁRIO: Tenta Edge Function admin-users com fallback direto seguro
  if (!userData.id) {
    if (!userData.password || userData.password.trim().length < 8) {
      return { success: false, users: currentUsers, error: 'A senha inicial deve ter no mínimo 8 caracteres.' };
    }

    const requestedRole = userData.role || 'user';
    const canCreateManager = requesterRole === 'master' || (isManager && managerObj?.managerPermissions?.canCreateManagerRole === true);
    const assignedRole = (requestedRole === 'manager' && canCreateManager) ? 'manager' : (requestedRole === 'master' && requesterRole === 'master' ? 'master' : 'user');

    let createdViaEdgeFunction = false;
    let createdUserId: string | null = null;

    // 1.1 Tenta criar via Edge Function administrativa (apenas se estiver explicitamente habilitada/implantada)
    if (isEdgeFunctionAvailable === true) {
      try {
        const { data: fnData, error: fnError } = await supabase.functions.invoke('admin-users', {
          body: {
            action: 'create_user',
            payload: {
              username: usernameClean,
              password: userData.password.trim(),
              name: nameClean,
              role: assignedRole,
              department: userData.department?.trim() || '',
              managerPermissions: assignedRole === 'manager' ? (userData.managerPermissions || { allowGenerateLogins: true, canCreateManagerRole: false, allowChangePasswords: false }) : null,
              customPermissions: {
                layers: userData.customLayerPermissions || null,
                features: userData.customFeaturePermissions || null,
                addressColumns: userData.customAddressColumnsPermissions || null,
                featureProperties: userData.customFeaturePropertiesPermissions || null,
              }
            }
          }
        });

        if (!fnError && !fnData?.error && (fnData?.user?.id || fnData?.userId)) {
          createdViaEdgeFunction = true;
          createdUserId = fnData?.user?.id || fnData?.userId;
          setEdgeFunctionAvailable(true);
        } else {
          setEdgeFunctionAvailable(false);
          console.warn('Edge Function admin-users não disponível ou retornou erro, aplicando fallback direto:', fnError?.message || fnData?.error);
        }
      } catch (e: any) {
        setEdgeFunctionAvailable(false);
        console.warn('Exceção ao invocar Edge Function admin-users (CORS/404), aplicando fallback direto:', e?.message || e);
      }
    }

    // 1.2 Fallback Direto Resiliente: se a Edge Function não estiver implantada ou falhar por CORS/404
    if (!createdViaEdgeFunction) {
      // Cria a conta em auth.users através de cliente secundário isolado (sem persistir sessão local para não desconectar o Master)
      const isolatedAuthClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
        }
      });

      const syntheticEmail = toSyntheticEmail(usernameClean);
      let authDataResult = await isolatedAuthClient.auth.signUp({
        email: syntheticEmail,
        password: userData.password.trim(),
        options: {
          data: {
            name: nameClean,
            username: usernameClean
          }
        }
      });

      // Se falhar porque o usuário já existe em auth.users (mas não está em profiles, por ter sido excluído antes):
      if (authDataResult.error && (
        authDataResult.error.message?.toLowerCase().includes('already registered') ||
        authDataResult.error.message?.toLowerCase().includes('already exists') ||
        (authDataResult.error as any).code === 'user_already_exists'
      )) {
        console.warn(`[ADMIN] Usuário @${usernameClean} já existia em auth.users (órfão de exclusão anterior). Tentando limpeza via RPC...`);
        try {
          const { data: cleanData, error: cleanErr } = await supabase.rpc('admin_cleanup_orphan_user', {
            p_username: usernameClean
          });

          if (!cleanErr && (cleanData as any)?.success) {
            console.info(`[ADMIN] Conta órfã @${usernameClean} removida de auth.users com sucesso. Recriando...`);
            authDataResult = await isolatedAuthClient.auth.signUp({
              email: syntheticEmail,
              password: userData.password.trim(),
              options: {
                data: {
                  name: nameClean,
                  username: usernameClean
                }
              }
            });
          }
        } catch (cleanCatchErr) {
          console.warn('[ADMIN] Falha ao tentar limpar conta órfã via RPC:', cleanCatchErr);
        }
      }

      if (authDataResult.error || !authDataResult.data?.user) {
        return {
          success: false,
          users: currentUsers,
          error: `Falha ao criar credenciais de acesso (${authDataResult.error?.message || 'Erro no Supabase Auth'})`
        };
      }

      createdUserId = authDataResult.data.user.id;

      // Grava / atualiza o perfil em public.profiles via RPC segura (evita conflito 403 com handle_new_user)
      const safeManagerPerms = assignedRole === 'manager'
        ? (userData.managerPermissions || { allowGenerateLogins: true, canCreateManagerRole: false, allowChangePasswords: false })
        : null;

      const { error: rpcErr } = await supabase.rpc('admin_finalize_created_profile', {
        p_user_id: createdUserId,
        p_username: usernameClean,
        p_name: nameClean,
        p_role: assignedRole,
        p_department: userData.department?.trim() || '',
        p_manager_permissions: safeManagerPerms,
        p_has_custom_permissions: !!userData.hasCustomPermissions,
        p_custom_layer_permissions: userData.customLayerPermissions || null,
        p_custom_feature_permissions: userData.customFeaturePermissions || null,
        p_custom_address_columns_permissions: userData.customAddressColumnsPermissions || null,
        p_custom_feature_properties_permissions: userData.customFeaturePropertiesPermissions || null
      });

      if (rpcErr) {
        // Fallback direto caso a RPC ainda não tenha sido aplicada no banco
        const profilePayload = {
          id: createdUserId,
          username: usernameClean,
          name: nameClean,
          role: assignedRole,
          department: userData.department?.trim() || '',
          is_active: true,
          must_change_password: true,
          manager_permissions: safeManagerPerms,
          custom_layer_permissions: userData.customLayerPermissions || null,
          custom_feature_permissions: userData.customFeaturePermissions || null,
          custom_address_columns_permissions: userData.customAddressColumnsPermissions || null,
          custom_feature_properties_permissions: userData.customFeaturePropertiesPermissions || null,
          has_custom_permissions: !!userData.hasCustomPermissions,
          created_by: isManager ? requesterName : 'Master',
          updated_at: new Date().toISOString()
        };

        const { error: upsertErr } = await supabase
          .from('profiles')
          .upsert(profilePayload);

        if (upsertErr) {
          const { error: updErr } = await supabase
            .from('profiles')
            .update(profilePayload)
            .eq('id', createdUserId);

          if (updErr) {
            console.error('Erro ao salvar perfil do usuário criado via fallback:', updErr);
            return {
              success: false,
              users: currentUsers,
              error: 'Credenciais criadas, mas falha ao configurar perfil e permissões: ' + (rpcErr.message || updErr.message)
            };
          }
        }
      }
    }

    logActivity('ADMIN', `${isManager ? `👔 Gerente @${requesterName}` : '👑 Master'} criou o usuário ${assignedRole === 'manager' ? '👔 GERENTE' : '👤 USUÁRIO'}: "${nameClean}" (@${usernameClean})`, isManager ? 'manager' : 'admin');
  } else {
    // 2. ATUALIZAÇÃO DE USUÁRIO EXISTENTE
    const requestedRole = userData.role || 'user';
    const canCreateManager = requesterRole === 'master' || (isManager && managerObj?.managerPermissions?.canCreateManagerRole === true);
    const targetRole = (requestedRole === 'manager' && canCreateManager) ? 'manager' : (requestedRole === 'master' && requesterRole === 'master' ? 'master' : 'user');

    // Atualização direta em public.profiles (Protegida por RLS e trigger prevent_self_elevation)
    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        name: nameClean,
        role: targetRole,
        department: userData.department?.trim() || '',
        manager_permissions: targetRole === 'manager' ? userData.managerPermissions : null,
        custom_layer_permissions: userData.customLayerPermissions || null,
        custom_feature_permissions: userData.customFeaturePermissions || null,
        custom_address_columns_permissions: userData.customAddressColumnsPermissions || null,
        custom_feature_properties_permissions: userData.customFeaturePropertiesPermissions || null,
        has_custom_permissions: !!userData.hasCustomPermissions,
        updated_at: new Date().toISOString()
      })
      .eq('id', userData.id);

    if (updateError) {
      return { success: false, users: currentUsers, error: 'Falha ao atualizar perfil: ' + updateError.message };
    }

    logActivity('ADMIN', `${isManager ? `👔 Gerente @${requesterName}` : '👑 Master'} atualizou o usuário "${nameClean}" (@${usernameClean})`, isManager ? 'manager' : 'admin');
  }

  const updatedUsers = await getRegisteredUsersAsync();
  notifyPermissionsUpdated();
  return { success: true, users: updatedUsers };
};

// Promover Usuário Comum a Gerente (Apenas Master pode executar)
export const promoteUserToManager = async (
  userId: string,
  requester?: { username?: string; role?: UserRole } | null | 'master'
): Promise<{ success: boolean; users: RegisteredUser[]; error?: string }> => {
  if (typeof window === 'undefined') return { success: false, users: [] };
  const requesterRole = typeof requester === 'string' ? requester : (requester?.role || 'master');
  if (requesterRole !== 'master') {
    return { success: false, users: [], error: 'Apenas o Administrador Master pode promover usuários.' };
  }

  const currentUsers = await getRegisteredUsersAsync();
  const user = currentUsers.find(u => u.id === userId);
  if (!user) return { success: false, users: currentUsers, error: 'Usuário não encontrado.' };

  const { error: updError } = await supabase
    .from('profiles')
    .update({
      role: 'manager',
      manager_permissions: {
        allowGenerateLogins: true,
        allowChangePasswords: false
      },
      updated_at: new Date().toISOString()
    })
    .eq('id', userId);

  if (updError) {
    return { success: false, users: currentUsers, error: updError.message };
  }

  const updated = await getRegisteredUsersAsync();
  logActivity('ADMIN', `👑 Administrador Master promoveu o usuário "${user.name}" (@${user.username}) para GERENTE 👔`, 'admin');
  notifyPermissionsUpdated();
  return { success: true, users: updated };
};

// Rebaixar Gerente para Usuário Comum (Apenas Master pode executar)
export const demoteManagerToUser = async (
  userId: string,
  requester?: { username?: string; role?: UserRole } | null | 'master'
): Promise<{ success: boolean; users: RegisteredUser[]; error?: string }> => {
  if (typeof window === 'undefined') return { success: false, users: [] };
  const requesterRole = typeof requester === 'string' ? requester : (requester?.role || 'master');
  if (requesterRole !== 'master') {
    return { success: false, users: [], error: 'Apenas o Administrador Master pode rebaixar gerentes.' };
  }

  const currentUsers = await getRegisteredUsersAsync();
  const user = currentUsers.find(u => u.id === userId);
  if (!user) return { success: false, users: currentUsers, error: 'Usuário não encontrado.' };

  const { error: updError } = await supabase
    .from('profiles')
    .update({
      role: 'user',
      manager_permissions: null,
      updated_at: new Date().toISOString()
    })
    .eq('id', userId);

  if (updError) {
    return { success: false, users: currentUsers, error: updError.message };
  }

  const updated = await getRegisteredUsersAsync();
  logActivity('ADMIN', `👑 Administrador Master rebaixou o gerente "${user.name}" (@${user.username}) para USUÁRIO COMUM 👤`, 'admin');
  notifyPermissionsUpdated();
  return { success: true, users: updated };
};

// Alterar Senha de Usuário Cadastrado (Via Edge Function no Supabase ou Fallback)
export const changeUserPassword = async (
  userId: string,
  newPasswordClean: string,
  requester?: { username?: string; role?: UserRole } | null | 'master'
): Promise<{ success: boolean; users: RegisteredUser[]; error?: string; syncedToServer?: boolean; syncError?: string }> => {
  if (typeof window === 'undefined') return { success: false, users: [] };
  if (!newPasswordClean || newPasswordClean.trim().length < 8) {
    return { success: false, users: getRegisteredUsers(), error: 'A nova senha deve ter no mínimo 8 caracteres.' };
  }

  const currentUsers = await getRegisteredUsersAsync();
  const user = currentUsers.find(u => u.id === userId);
  if (!user) {
    return { success: false, users: currentUsers, error: 'Usuário não encontrado.' };
  }

  let edgeSuccess = false;
  if (isEdgeFunctionAvailable === true) {
    try {
      const { data: fnData, error: fnError } = await supabase.functions.invoke('admin-users', {
        body: {
          action: 'reset_password',
          payload: {
            userId,
            newPassword: newPasswordClean.trim()
          }
        }
      });

      if (!fnError && !fnData?.error) {
        edgeSuccess = true;
        setEdgeFunctionAvailable(true);
      } else {
        setEdgeFunctionAvailable(false);
        console.warn('Falha na Edge Function ao alterar senha:', fnError?.message || fnData?.error);
      }
    } catch (err: any) {
      setEdgeFunctionAvailable(false);
      console.warn('Exceção ao invocar Edge Function admin-users (CORS/404):', err?.message || err);
    }
  }

  if (edgeSuccess) {
    const updated = await getRegisteredUsersAsync();
    logActivity('ADMIN', `Senha do usuário "${user.name}" (@${user.username}) redefinida com sucesso`, 'admin');
    notifyPermissionsUpdated();
    return { success: true, users: updated, syncedToServer: true };
  }

  // Fallback: se a Edge Function não estiver implantada ou falhou por CORS,
  // marca must_change_password = true no perfil do usuário
  const { error: updError } = await supabase
    .from('profiles')
    .update({ must_change_password: true, updated_at: new Date().toISOString() })
    .eq('id', userId);

  if (updError) {
    return { success: false, users: currentUsers, error: 'Falha ao atualizar status de senha: ' + updError.message };
  }

  const updated = await getRegisteredUsersAsync();
  logActivity('ADMIN', `Solicitação de troca obrigatória de senha ativada para "${user.name}" (@${user.username})`, 'admin');
  notifyPermissionsUpdated();
  return {
    success: true,
    users: updated,
    syncedToServer: false,
    syncError: 'A Edge Function admin-users não está implantada no Supabase. O usuário foi marcado para redefinir a senha no próximo acesso.'
  };
};

// Excluir Usuário Cadastrado (Via Edge Function no Supabase ou Fallback)
export const deleteRegisteredUser = async (
  userId: string,
  requester?: { username?: string; role?: UserRole } | null | 'master'
): Promise<{ success: boolean; users: RegisteredUser[]; error?: string }> => {
  if (typeof window === 'undefined') return { success: false, users: [] };
  const currentUsers = await getRegisteredUsersAsync();
  const user = currentUsers.find(u => u.id === userId);
  if (!user) return { success: false, users: currentUsers, error: 'Usuário não encontrado.' };

  let edgeSuccess = false;
  if (isEdgeFunctionAvailable === true) {
    try {
      const { data: fnData, error: fnError } = await supabase.functions.invoke('admin-users', {
        body: {
          action: 'delete_user',
          payload: { userId }
        }
      });

      if (!fnError && !fnData?.error) {
        edgeSuccess = true;
        setEdgeFunctionAvailable(true);
      } else {
        setEdgeFunctionAvailable(false);
        console.warn('Falha na Edge Function delete_user, aplicando fallback em profiles:', fnError?.message || fnData?.error);
      }
    } catch (err: any) {
      setEdgeFunctionAvailable(false);
      console.warn('Exceção ao invocar Edge Function delete_user (CORS/404), aplicando fallback:', err?.message || err);
    }
  }

  if (!edgeSuccess) {
    // 1. Tenta exclusão atômica via RPC admin_delete_user (remove de profiles E auth.users)
    let deletedViaRpc = false;
    try {
      const { data: rpcData, error: rpcError } = await supabase.rpc('admin_delete_user', { p_user_id: userId });
      if (!rpcError && (rpcData as any)?.success) {
        deletedViaRpc = true;
      }
    } catch {}

    // 2. Se a RPC não estiver instalada, exclui de profiles (que acionará o trigger no banco caso instalado)
    if (!deletedViaRpc) {
      const { error: delError } = await supabase
        .from('profiles')
        .delete()
        .eq('id', userId);

      if (delError) {
        return { success: false, users: currentUsers, error: 'Falha ao excluir perfil: ' + delError.message };
      }
    }
  }

  const updated = await getRegisteredUsersAsync();
  logActivity('ADMIN', `Conta do usuário "${user.name}" (@${user.username}) foi excluída permanentemente`, 'admin');
  notifyPermissionsUpdated();
  return { success: true, users: updated };
};

// Alternar Status Ativo / Bloqueado de um Usuário
export const toggleRegisteredUserStatus = async (
  userId: string,
  requester?: { username?: string; role?: UserRole } | null | 'master'
): Promise<{ success: boolean; users: RegisteredUser[]; error?: string }> => {
  if (typeof window === 'undefined') return { success: false, users: [] };
  const currentUsers = await getRegisteredUsersAsync();
  const user = currentUsers.find(u => u.id === userId);
  if (!user) return { success: false, users: currentUsers, error: 'Usuário não encontrado.' };

  const nextActive = !user.isActive;

  // Invoca a Edge Function admin-users para garantir bloqueio no profiles E revogação de sessões no Supabase Auth
  let edgeSuccess = false;
  if (isEdgeFunctionAvailable === true) {
    try {
      const { data: fnData, error: fnError } = await supabase.functions.invoke('admin-users', {
        body: {
          action: 'toggle_status',
          payload: {
            userId,
            isActive: nextActive
          }
        }
      });

      if (!fnError && !fnData?.error) {
        edgeSuccess = true;
        setEdgeFunctionAvailable(true);
      } else {
        setEdgeFunctionAvailable(false);
        console.warn('Falha na Edge Function toggle_status, aplicando fallback em profiles:', fnError || fnData?.error);
      }
    } catch (e: any) {
      setEdgeFunctionAvailable(false);
      console.warn('Exceção na Edge Function toggle_status, aplicando fallback em profiles:', e?.message || e);
    }
  }

  if (!edgeSuccess) {
    const { error: updError } = await supabase
      .from('profiles')
      .update({ is_active: nextActive, updated_at: new Date().toISOString() })
      .eq('id', userId);

    if (updError) {
      return { success: false, users: currentUsers, error: updError.message };
    }
  }

  const updated = await getRegisteredUsersAsync();
  logActivity('ADMIN', `Usuário "${user.name}" (@${user.username}) foi ${nextActive ? 'desbloqueado' : 'bloqueado'}`, 'admin');
  notifyPermissionsUpdated();
  return { success: true, users: updated };
};

// Autenticar com consulta em tempo real ao Supabase Auth (Servidor de Identidade)
export const authenticateRegisteredUserAsync = async (
  usernameInput: string,
  passwordInput: string
): Promise<{ success: boolean; user?: RegisteredUser; message?: string }> => {
  const cleanUser = sanitizeUsername(usernameInput);
  const cleanPass = passwordInput.trim();

  if (!cleanUser || !cleanPass) {
    return { success: false, message: 'Informe o login e a senha para acessar.' };
  }

  try {
    // Se havia uma sessão anônima ativa de visitante, descarta-a localmente de forma limpa antes de autenticar a conta
    const { data: { session: existingSession } } = await supabase.auth.getSession();
    if (existingSession?.user?.is_anonymous) {
      await supabase.auth.signOut({ scope: 'local' });
    }

    const syntheticEmail = toSyntheticEmail(cleanUser);

    // 1. Autenticação oficial no Supabase Auth com senha protegida por hash Bcrypt/Argon2
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: syntheticEmail,
      password: cleanPass
    });

    if (authError || !authData?.user) {
      // Diagnóstico detalhado no console do navegador (sem vazar senhas)
      if (authError) {
        console.error('[Supabase Auth Error]', {
          message: authError.message,
          status: authError.status,
          code: (authError as any)?.code
        });
      }

      const errCode = ((authError as any)?.code || '').toLowerCase();
      const errMsg = (authError?.message || '').toLowerCase();

      let userFacingMessage = 'Usuário ou senha incorretos';

      if (errCode === 'email_not_confirmed' || errMsg.includes('email not confirmed')) {
        userFacingMessage = 'Conta ainda não confirmada: peça ao administrador para ativar';
      } else if (errCode === 'invalid_credentials' || errMsg.includes('invalid login credentials')) {
        userFacingMessage = 'Usuário ou senha incorretos';
      } else if (authError?.message) {
        userFacingMessage = authError.message;
      }

      return { success: false, message: userFacingMessage };
    }

    // 2. Busca o perfil completo da tabela public.profiles
    const { data: profile, error: profError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', authData.user.id)
      .maybeSingle();

    if (profError || !profile) {
      return { success: false, message: 'Perfil do usuário não encontrado na base de dados.' };
    }

    if (!profile.is_active) {
      await supabase.auth.signOut();
      return { success: false, message: 'Este usuário está temporariamente bloqueado pelo Administrador.' };
    }

    // 3. Atualiza data do último login no perfil
    await supabase.from('profiles').update({
      last_login: new Date().toISOString()
    }).eq('id', profile.id);

    // 4. Mapeia para o objeto de sessão ativo
    const userRole = (profile.role === 'admin' ? 'master' : (profile.role || 'user')) as UserRole;
    const mappedUser: RegisteredUser = {
      id: profile.id,
      username: profile.username,
      name: profile.name,
      role: userRole,
      department: profile.department || '',
      createdAt: profile.created_at,
      createdBy: profile.created_by || '',
      lastLogin: new Date().toISOString(),
      isActive: true,
      mustChangePassword: !!profile.must_change_password,
      hasCustomPermissions: !!profile.has_custom_permissions,
      managerPermissions: profile.manager_permissions || undefined,
      customLayerPermissions: profile.custom_layer_permissions || undefined,
      customFeaturePermissions: profile.custom_feature_permissions || undefined,
      customAddressColumnsPermissions: profile.custom_address_columns_permissions || undefined,
      customFeaturePropertiesPermissions: profile.custom_feature_properties_permissions || undefined,
    };

    setCurrentActiveUser(mappedUser);
    const sId = getSessionId();

    if (userRole !== 'master') {
      saveUserSessionConfig(sId, {
        customName: `${mappedUser.name} (@${mappedUser.username})`,
        role: userRole,
        hasCustomPermissions: mappedUser.hasCustomPermissions,
        customLayerPermissions: mappedUser.customLayerPermissions,
        customFeaturePermissions: mappedUser.customFeaturePermissions,
        customAddressColumnsPermissions: mappedUser.customAddressColumnsPermissions,
        customFeaturePropertiesPermissions: mappedUser.customFeaturePropertiesPermissions
      });
      logActivity('ACESSO', `Usuário credenciado ${mappedUser.role === 'manager' ? '👔 GERENTE' : '👤'} "${mappedUser.name}" (@${mappedUser.username}) autenticado com sucesso`, userRole);
    } else {
      logActivity('ACESSO', `👑 Administrador Master autenticado com sucesso`, 'master');
    }

    return { success: true, user: mappedUser };
  } catch (err: any) {
    console.error('[AUTH] Erro ao autenticar no Supabase Auth:', err);
    return { success: false, message: err?.message || 'Falha de conexão com o servidor de autenticação.' };
  }
};

// Versão síncrona mantida para compatibilidade com chamadas legado
export const authenticateRegisteredUser = (
  usernameInput: string,
  _passwordInput: string
): { success: boolean; user?: RegisteredUser; message?: string } => {
  const users = getRegisteredUsers();
  const cleanUser = sanitizeUsername(usernameInput);
  const user = users.find(u => sanitizeUsername(u.username) === cleanUser);
  if (!user) return { success: false, message: 'Usuário não encontrado.' };
  return { success: true, user };
};

// Buscar se um usuário já existe no banco de dados por Login (@username) ou Nome Completo
export const findRegisteredUserByLoginOrNameAsync = async (identifier: string): Promise<RegisteredUser | null> => {
  if (!identifier) return null;
  const cleanUsername = sanitizeUsername(identifier);
  const cleanRaw = identifier.trim().toLowerCase();
  if (!cleanUsername && !cleanRaw) return null;

  const users = await getRegisteredUsersAsync();
  return users.find(u =>
    sanitizeUsername(u.username) === cleanUsername ||
    u.username.toLowerCase() === cleanRaw ||
    u.name.trim().toLowerCase() === cleanRaw ||
    sanitizeUsername(u.name) === cleanUsername
  ) || null;
};

// Obter / Salvar usuário ativo na sessão
export const getCurrentActiveUser = (): RegisteredUser | null => {
  if (typeof window === 'undefined') return null;
  try {
    const saved = localStorage.getItem(STORAGE_KEYS.CURRENT_ACTIVE_USER);
    if (saved) return JSON.parse(saved);
  } catch (e) { }
  return null;
};

export const setCurrentActiveUser = (user: RegisteredUser | null) => {
  if (typeof window === 'undefined') return;
  if (user) {
    localStorage.setItem(STORAGE_KEYS.CURRENT_ACTIVE_USER, JSON.stringify(user));
    localStorage.setItem('webgis_last_logged_in_user_v1', JSON.stringify(user));
  } else {
    localStorage.removeItem(STORAGE_KEYS.CURRENT_ACTIVE_USER);
  }
};

export const getLastLoggedInUser = (): RegisteredUser | null => {
  if (typeof window === 'undefined') return null;
  try {
    const saved = localStorage.getItem('webgis_last_logged_in_user_v1');
    if (saved) return JSON.parse(saved);
  } catch (e) { }
  return null;
};

export const setLastLoggedInUser = (user: RegisteredUser | null) => {
  if (typeof window === 'undefined') return;
  if (user) {
    localStorage.setItem('webgis_last_logged_in_user_v1', JSON.stringify(user));
  } else {
    localStorage.removeItem('webgis_last_logged_in_user_v1');
  }
};

// Atualizar o próprio perfil de conta do usuário logado (Sincronizado com Supabase Auth & profiles)
export const updateSelfAccountProfile = async (
  userId: string,
  updates: {
    name?: string;
    username?: string;
    newPassword?: string;
  }
): Promise<{ success: boolean; user?: RegisteredUser; error?: string }> => {
  if (typeof window === 'undefined') return { success: false, error: 'Ambiente inválido' };

  try {
    // 1. Se informou nova senha, valida mínimo de 8 caracteres e atualiza diretamente no Supabase Auth (com hash seguro)
    if (updates.newPassword) {
      const cleanPass = updates.newPassword.trim();
      if (cleanPass.length < 8) {
        return { success: false, error: 'A nova senha deve ter no mínimo 8 caracteres.' };
      }
      const { error: passError } = await supabase.auth.updateUser({
        password: cleanPass
      });
      if (passError) {
        return { success: false, error: 'Erro ao atualizar senha no Supabase: ' + passError.message };
      }
    }

    // 2. Atualiza os dados no perfil da tabela public.profiles
    const profUpdates: any = {
      updated_at: new Date().toISOString()
    };
    if (updates.name && updates.name.trim()) {
      profUpdates.name = updates.name.trim();
    }
    if (updates.newPassword) {
      profUpdates.must_change_password = false;
    }

    const { data: updatedProfile, error: profError } = await supabase
      .from('profiles')
      .update(profUpdates)
      .eq('id', userId)
      .select()
      .single();

    if (profError) {
      return { success: false, error: 'Erro ao salvar alterações no perfil: ' + profError.message };
    }

    const userRole = (updatedProfile.role === 'admin' ? 'master' : (updatedProfile.role || 'user')) as UserRole;
    const mappedUser: RegisteredUser = {
      id: updatedProfile.id,
      username: updatedProfile.username,
      name: updatedProfile.name,
      role: userRole,
      department: updatedProfile.department || '',
      createdAt: updatedProfile.created_at,
      createdBy: updatedProfile.created_by || '',
      lastLogin: updatedProfile.last_login,
      isActive: updatedProfile.is_active !== false,
      mustChangePassword: !!updatedProfile.must_change_password,
      hasCustomPermissions: !!updatedProfile.has_custom_permissions,
      managerPermissions: updatedProfile.manager_permissions || undefined,
      customLayerPermissions: updatedProfile.custom_layer_permissions || undefined,
      customFeaturePermissions: updatedProfile.custom_feature_permissions || undefined,
      customAddressColumnsPermissions: updatedProfile.custom_address_columns_permissions || undefined,
      customFeaturePropertiesPermissions: updatedProfile.custom_feature_properties_permissions || undefined,
    };

    setCurrentActiveUser(mappedUser);
    notifyPermissionsUpdated();
    logActivity('ADMIN', `Usuário "${mappedUser.name}" (@${mappedUser.username}) atualizou seu perfil de conta`, userRole);

    return { success: true, user: mappedUser };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Falha ao atualizar perfil' };
  }
};

// Registrar visitante como conta oficial cadastrada no WebGis
export const registerVisitorAsAccount = async (
  sessionId: string,
  accountData: {
    name: string;
    username: string;
    password: string;
  }
): Promise<{ success: boolean; user?: RegisteredUser; error?: string }> => {
  if (typeof window === 'undefined') return { success: false, error: 'Ambiente inválido' };

  const nameClean = accountData.name.trim();
  const usernameClean = sanitizeUsername(accountData.username);
  const passwordClean = accountData.password.trim();

  if (!nameClean) {
    return { success: false, error: 'Informe seu nome completo.' };
  }
  if (!usernameClean || usernameClean.length < 3) {
    return { success: false, error: 'O nome de usuário deve ter pelo menos 3 caracteres.' };
  }
  if (!passwordClean || passwordClean.length < 8) {
    return { success: false, error: 'A senha deve ter pelo menos 8 caracteres.' };
  }

  try {
    // Se havia uma sessão anônima ativa de visitante, descarta-a localmente de forma limpa antes de registrar a conta
    const { data: { session: existingSession } } = await supabase.auth.getSession();
    if (existingSession?.user?.is_anonymous) {
      await supabase.auth.signOut({ scope: 'local' });
    }

    const syntheticEmail = toSyntheticEmail(usernameClean);

    // 1. Cria conta no Supabase Auth com senha protegida
    const { data: authData, error: authErr } = await supabase.auth.signUp({
      email: syntheticEmail,
      password: passwordClean,
      options: {
        data: {
          name: nameClean,
          username: usernameClean
        }
      }
    });

    if (authErr || !authData.user) {
      return { success: false, error: authErr?.message || 'Erro ao registrar conta no Supabase Auth' };
    }

    // Se a sessão não foi iniciada no signUp, realiza login automático
    if (!authData.session) {
      await supabase.auth.signInWithPassword({
        email: syntheticEmail,
        password: passwordClean
      });
    }

    // 2. Insere ou atualiza o perfil em public.profiles
    const { data: profile, error: profErr } = await supabase
      .from('profiles')
      .upsert({
        id: authData.user.id,
        username: usernameClean,
        name: nameClean,
        role: 'user',
        is_active: true,
        must_change_password: false,
        created_by: 'Auto-cadastro (Site)'
      })
      .select()
      .maybeSingle();

    if (profErr || !profile) {
      return { success: false, error: profErr?.message || 'Erro ao gravar perfil no banco de dados' };
    }

    const mappedUser: RegisteredUser = {
      id: profile.id,
      username: profile.username,
      name: profile.name,
      role: 'user',
      department: '',
      createdAt: profile.created_at,
      createdBy: 'Auto-cadastro (Site)',
      lastLogin: new Date().toISOString(),
      isActive: true,
      hasCustomPermissions: false
    };

    setCurrentActiveUser(mappedUser);
    saveUserSessionConfig(sessionId, {
      customName: `${nameClean} (@${usernameClean})`,
      role: 'user'
    });

    notifyPermissionsUpdated();
    logActivity('ACESSO', `Visitante converteu sua sessão em conta cadastrada: "${nameClean}" (@${usernameClean})`, 'user');

    return { success: true, user: mappedUser };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Falha ao registrar conta' };
  }
};

// Atualizar nome de visitante na sessão
export const updateVisitorNameAndSession = async (
  sessionId: string,
  customName: string
): Promise<{ success: boolean; error?: string }> => {
  if (typeof window === 'undefined') return { success: false, error: 'Ambiente inválido' };
  const nameClean = customName.trim();
  if (!nameClean) {
    return { success: false, error: 'O nome do visitante não pode ficar em branco.' };
  }

  saveUserSessionConfig(sessionId, {
    customName: nameClean
  });

  notifyPermissionsUpdated();
  logActivity('ACESSO', `Visitante atualizou seu nome de exibição para "${nameClean}"`, 'user');

  return { success: true };
};

// ================= PERMISSÕES GLOBAIS =================

// Obter permissões globais das camadas para Usuários Comuns
export const getLayerPermissions = (defaultLayerNames: string[]): Record<string, boolean> => {
  if (typeof window === 'undefined') {
    return defaultLayerNames.reduce((acc, name) => ({ ...acc, [name]: true }), {});
  }

  try {
    const saved = localStorage.getItem(STORAGE_KEYS.LAYER_PERMISSIONS);
    if (saved) {
      const parsed = JSON.parse(saved);
      // Assegurar que camadas novas existam no mapa de permissões
      defaultLayerNames.forEach(name => {
        if (parsed[name] === undefined) {
          parsed[name] = true;
        }
      });
      return parsed;
    }
  } catch (e) {
    console.error('Erro ao ler permissões de camadas:', e);
  }

  // Padrão: todas liberadas
  return defaultLayerNames.reduce((acc, name) => ({ ...acc, [name]: true }), {});
};

// Salvar permissões globais das camadas diretamente no Supabase e localStorage
export const saveLayerPermissions = async (permissions: Record<string, boolean>): Promise<{ success: boolean; error?: string }> => {
  try {
    localStorage.setItem(STORAGE_KEYS.LAYER_PERMISSIONS, JSON.stringify(permissions));

    // Salvar diretamente na Nuvem Supabase
    const { error } = await supabase.from('webgis_settings').upsert({
      id: 'global',
      layer_permissions: permissions,
      feature_permissions: getFeaturePermissions(),
      address_columns_permissions: getAddressColumnsPermissions(),
      feature_properties_permissions: getFeaturePropertiesPermissions(),
      updated_at: new Date().toISOString()
    });

    notifyPermissionsUpdated();
    logActivity('ADMIN', `Permissões globais de camadas atualizadas no Supabase`, 'admin');

    if (error) {
      console.error('Erro ao salvar permissões de camadas no Supabase:', error);
      return { success: false, error: error.message };
    }
    return { success: true };
  } catch (e: any) {
    console.error('Erro ao salvar permissões de camadas:', e);
    return { success: false, error: e?.message };
  }
};

// Obter permissões globais de ferramentas/módulos
export const getFeaturePermissions = (): FeaturePermissions => {
  const defaultFeatures: FeaturePermissions = {
    allowCnefeSearch: true,
    allowExportData: true,
    allowMeasureTool: true,
    allowPrintA4: true,
    allowLayerPanel: true,
    allowDashboardRaioX: true,
    allowSelectedFeaturesPanel: true,
    allowFeatureSpecs: true,
    allowSourcesFooter: true,
    allowSearchActiveLayersOnly: true,

    allowDissolveFeatures: true,
    allowMultiSelect: true,
    allowSearchByType: true,
    allowSearchAreaAddresses: true,
    allowCustomizeUsefulInfo: true,
    allowExportCsv: true,
    allowExportKml: true,
    allowExportKmz: true,
    allowExportGeoJson: true,
    allowExportShapefile: true,
    allowExportGeoPackage: true,
    allowBasemapSelector: true,
    allowMapLegend: true,
  };

  if (typeof window === 'undefined') return defaultFeatures;

  try {
    const saved = localStorage.getItem(STORAGE_KEYS.FEATURE_PERMISSIONS);
    if (saved) {
      return { ...defaultFeatures, ...JSON.parse(saved) };
    }
  } catch (e) { }

  return defaultFeatures;
};

// Salvar permissões globais de ferramentas diretamente no Supabase e localStorage
export const saveFeaturePermissions = async (perms: FeaturePermissions): Promise<{ success: boolean; error?: string }> => {
  try {
    localStorage.setItem(STORAGE_KEYS.FEATURE_PERMISSIONS, JSON.stringify(perms));

    // Salvar diretamente na Nuvem Supabase
    const { error } = await supabase.from('webgis_settings').upsert({
      id: 'global',
      layer_permissions: getLayerPermissions([]),
      feature_permissions: perms,
      address_columns_permissions: getAddressColumnsPermissions(),
      feature_properties_permissions: getFeaturePropertiesPermissions(),
      updated_at: new Date().toISOString()
    });

    notifyPermissionsUpdated();
    logActivity('ADMIN', `Permissões globais de ferramentas atualizadas no Supabase`, 'admin');

    if (error) {
      console.error('Erro ao salvar feature_permissions no Supabase:', error);
      return { success: false, error: error.message };
    }
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e?.message };
  }
};

// ================= PERMISSÕES DE COLUNAS E PROPRIEDADES =================

export const getAddressColumnsPermissions = (): Record<string, boolean> => {
  const defaults: Record<string, boolean> = {};
  ALL_ADDRESS_COLUMNS.forEach(col => { defaults[col.key] = true; });
  if (typeof window === 'undefined') return defaults;
  try {
    const saved = localStorage.getItem(STORAGE_KEYS.ADDRESS_COLUMNS_PERMISSIONS);
    if (saved) {
      return { ...defaults, ...JSON.parse(saved) };
    }
  } catch (e) { }
  return defaults;
};

export const saveAddressColumnsPermissions = async (perms: Record<string, boolean>): Promise<{ success: boolean; error?: string }> => {
  try {
    localStorage.setItem(STORAGE_KEYS.ADDRESS_COLUMNS_PERMISSIONS, JSON.stringify(perms));

    // Salvar diretamente na Nuvem Supabase
    const { error } = await supabase.from('webgis_settings').upsert({
      id: 'global',
      layer_permissions: getLayerPermissions([]),
      feature_permissions: getFeaturePermissions(),
      address_columns_permissions: perms,
      feature_properties_permissions: getFeaturePropertiesPermissions(),
      updated_at: new Date().toISOString()
    });

    notifyPermissionsUpdated();
    logActivity('ADMIN', `Permissões globais de colunas do CNEFE atualizadas no Supabase`, 'admin');

    if (error) {
      console.error('Erro ao salvar address_columns_permissions no Supabase:', error);
      return { success: false, error: error.message };
    }
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e?.message };
  }
};

export const getFeaturePropertiesPermissions = (): Record<string, boolean> => {
  const defaults: Record<string, boolean> = {};
  ALL_FEATURE_PROPERTIES.forEach(prop => { defaults[prop.key] = true; });
  if (typeof window === 'undefined') return defaults;
  try {
    const saved = localStorage.getItem(STORAGE_KEYS.FEATURE_PROPERTIES_PERMISSIONS);
    if (saved) {
      return { ...defaults, ...JSON.parse(saved) };
    }
  } catch (e) { }
  return defaults;
};

export const saveFeaturePropertiesPermissions = async (perms: Record<string, boolean>): Promise<{ success: boolean; error?: string }> => {
  try {
    localStorage.setItem(STORAGE_KEYS.FEATURE_PROPERTIES_PERMISSIONS, JSON.stringify(perms));

    // Salvar diretamente na Nuvem Supabase
    const { error } = await supabase.from('webgis_settings').upsert({
      id: 'global',
      layer_permissions: getLayerPermissions([]),
      feature_permissions: getFeaturePermissions(),
      address_columns_permissions: getAddressColumnsPermissions(),
      feature_properties_permissions: perms,
      updated_at: new Date().toISOString()
    });

    notifyPermissionsUpdated();
    logActivity('ADMIN', `Permissões globais de atributos e propriedades atualizadas no Supabase`, 'admin');

    if (error) {
      console.error('Erro ao salvar feature_properties_permissions no Supabase:', error);
      return { success: false, error: error.message };
    }
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e?.message };
  }
};


// ================= GESTÃO INDIVIDUAL DE SESSÕES / USUÁRIOS =================

// Obter todas as sessões registradas (sincronizadas e ordenadas)
export const getUserSessions = (): Record<string, UserSessionConfig> => {
  if (typeof window === 'undefined') return {};
  try {
    const saved = localStorage.getItem(STORAGE_KEYS.USER_SESSIONS);
    return saved ? JSON.parse(saved) : {};
  } catch (e) {
    console.error('Erro ao ler sessões de usuários:', e);
    return {};
  }
};

// Obter sessões de usuários diretamente do Supabase em tempo real (ordenadas da mais recente para a mais antiga)
export const getUserSessionsAsync = async (): Promise<Record<string, UserSessionConfig>> => {
  try {
    // 1. Ler as sessões diretamente da tabela webgis_user_sessions (tabela autoritativa com RLS, sempre disponível e sem erro 404)
    const { data: sessionsData, error } = await supabase
      .from('webgis_user_sessions')
      .select('*')
      .order('last_seen', { ascending: false });

    if (!error && sessionsData && sessionsData.length > 0) {
      const localSessions = getUserSessions();
      sessionsData.forEach((row: any) => {
        localSessions[row.session_id] = {
          sessionId: row.session_id,
          authUid: row.auth_uid,
          customName: row.custom_name,
          firstSeen: row.first_seen,
          lastSeen: row.last_seen,
          formattedFirstSeen: row.formatted_first_seen,
          formattedLastSeen: row.formatted_last_seen,
          role: row.role as UserRole,
          isBlocked: row.is_blocked,
          loginCount: row.login_count || 1,
          hasCustomPermissions: row.has_custom_permissions,
          customLayerPermissions: row.custom_layer_permissions,
          customFeaturePermissions: row.custom_feature_permissions,
          customAddressColumnsPermissions: row.custom_address_columns_permissions,
          customFeaturePropertiesPermissions: row.custom_feature_properties_permissions,
        };
      });
      localStorage.setItem(STORAGE_KEYS.USER_SESSIONS, JSON.stringify(localSessions));
      return localSessions;
    }

    // 2. Telemetria avançada de servidor via RPC get_telemetry_active_sessions (executada apenas se expressamente habilitada, requer Script 06)
    if (typeof window !== 'undefined' && localStorage.getItem('webgis_enable_telemetry_rpc') === 'true') {
      const { data: telemetryData, error: telemetryError } = await supabase
        .rpc('get_telemetry_active_sessions');

      if (!telemetryError && telemetryData && Array.isArray(telemetryData) && telemetryData.length > 0) {
        const liveSessions: Record<string, UserSessionConfig> = {};
        telemetryData.forEach((row: any) => {
          const sId = row.session_id || row.auth_uid;
          liveSessions[sId] = {
            sessionId: sId,
            authUid: row.auth_uid,
            customName: row.display_name,
            firstSeen: row.first_seen,
            lastSeen: row.last_seen,
            formattedFirstSeen: row.formatted_first_seen,
            formattedLastSeen: row.formatted_last_seen,
            role: row.role as UserRole,
            isBlocked: !!row.is_blocked,
            loginCount: 1,
            device: row.device,
            isAnonymous: !!row.is_anonymous,
            ipAddress: row.ip_address,
            userAgent: row.user_agent,
            sessionCreatedAt: row.session_created_at,
            sessionRefreshedAt: row.session_refreshed_at,
            isOnline: !!row.is_online,
            hasCustomPermissions: !!row.has_custom_permissions,
            customLayerPermissions: row.custom_layer_permissions || undefined,
            customFeaturePermissions: row.custom_feature_permissions || undefined,
            customAddressColumnsPermissions: row.custom_address_columns_permissions || undefined,
            customFeaturePropertiesPermissions: row.custom_feature_properties_permissions || undefined,
          };
        });
        localStorage.setItem(STORAGE_KEYS.USER_SESSIONS, JSON.stringify(liveSessions));
        return liveSessions;
      }
    }
  } catch (e) {
    console.warn('getUserSessionsAsync: falha ao buscar do Supabase, usando cache local:', e);
  }
  return getUserSessions();
};

// Helper interno para serializar e sanitizar os dados da sessão compatíveis com o Supabase
const formatSessionPayloadForSupabase = (session: UserSessionConfig, authUid?: string | null) => {
  const payload: any = {
    session_id: session.sessionId,
    custom_name: session.customName || null,
    first_seen: session.firstSeen,
    last_seen: session.lastSeen,
    formatted_first_seen: session.formattedFirstSeen,
    formatted_last_seen: session.formattedLastSeen,
    role: session.role || 'user',
    is_blocked: !!session.isBlocked,
    has_custom_permissions: !!session.hasCustomPermissions,
    custom_layer_permissions: session.customLayerPermissions || null,
    custom_feature_permissions: session.customFeaturePermissions || null,
    custom_address_columns_permissions: session.customAddressColumnsPermissions || null,
    custom_feature_properties_permissions: session.customFeaturePropertiesPermissions || null,
    updated_at: new Date().toISOString()
  };
  const resolvedUid = authUid || session.authUid;
  if (resolvedUid) {
    payload.auth_uid = resolvedUid;
  }
  return payload;
};

// Detectar dispositivo / plataforma do cliente de forma leve e segura
export const detectClientDevice = (): string => {
  if (typeof window === 'undefined' || !navigator) return 'Desconhecido';
  const ua = navigator.userAgent || '';
  if (/android/i.test(ua)) return 'Android';
  if (/ipad|iphone|ipod/i.test(ua)) return 'iOS (iPhone/iPad)';
  if (/windows/i.test(ua)) return 'Windows PC';
  if (/macintosh|mac os x/i.test(ua)) return 'macOS';
  if (/linux/i.test(ua)) return 'Linux';
  return 'Navegador Web';
};

// Salvar / atualizar a configuração de uma sessão individual
export const saveUserSessionConfig = (sessionId: string, updates: Partial<UserSessionConfig>): void => {
  if (typeof window === 'undefined' || !sessionId) return;
  try {
    const sessions = getUserSessions();
    const existing = sessions[sessionId] || {
      sessionId,
      role: 'user',
      firstSeen: new Date().toISOString(),
      lastSeen: new Date().toISOString(),
      formattedFirstSeen: new Date().toLocaleDateString('pt-BR') + ' ' + new Date().toLocaleTimeString('pt-BR'),
      formattedLastSeen: new Date().toLocaleDateString('pt-BR') + ' ' + new Date().toLocaleTimeString('pt-BR'),
      loginCount: 1,
      device: detectClientDevice(),
    };

    const initialMerged: UserSessionConfig = {
      ...existing,
      ...updates,
      device: updates.device || existing.device || detectClientDevice(),
      sessionId
    };

    sessions[sessionId] = initialMerged;
    localStorage.setItem(STORAGE_KEYS.USER_SESSIONS, JSON.stringify(sessions));

    // Obter auth.uid atual para vincular estritamente no Supabase
    supabase.auth.getSession().then(async ({ data: authData }) => {
      const currentUid = authData?.session?.user?.id;
      // OBJETIVO 2: Só grava no Supabase se houver auth.uid válido (aguarda login anônimo ou de conta)
      if (!currentUid) {
        return;
      }

      const isAnonymous = Boolean(
        authData?.session?.user?.is_anonymous ||
        authData?.session?.user?.app_metadata?.provider === 'anonymous'
      );

      // OBJETIVO 3: Garantir que o session_id corresponda ao usuário autenticado atual.
      // Quando for visitante ou quando o auth_uid for diferente do gravado, deriva do currentUid
      let effectiveSessionId = sessionId;
      if (isAnonymous || (initialMerged.authUid && initialMerged.authUid !== currentUid)) {
        effectiveSessionId = currentUid;
        try {
          sessionStorage.setItem(STORAGE_KEYS.SESSION_ID, effectiveSessionId);
        } catch {}
      }

      const targetSession: UserSessionConfig = {
        ...initialMerged,
        sessionId: effectiveSessionId,
        authUid: currentUid,
        isAnonymous,
        role: isAnonymous ? 'visitor' : (initialMerged.role || 'user'),
      };

      sessions[effectiveSessionId] = targetSession;
      localStorage.setItem(STORAGE_KEYS.USER_SESSIONS, JSON.stringify(sessions));

      const payload = formatSessionPayloadForSupabase(targetSession, currentUid);

      // OBJETIVO 4: Tratar resposta do upsert e registrar console.warn curto em caso de erro, sem toast
      const { error } = await supabase
        .from('webgis_user_sessions')
        .upsert(payload);

      if (error) {
        console.warn(`[WebGIS] Falha ao sincronizar sessão (${error.code}):`, error.message);
      }
    }).catch((err) => {
      // OBJETIVO 2: Não faz upsert sem auth_uid! Apenas registra aviso curto
      console.warn('[WebGIS] Erro ao obter sessão para sincronização:', err?.message || err);
    });

  } catch (e) {
    console.warn('[WebGIS] Erro ao salvar configuração do usuário:', e);
  }
};

// Enviar batimento de presença (heartbeat curto) para atualizar last_seen no servidor
export const sendSessionHeartbeat = async (): Promise<void> => {
  if (typeof window === 'undefined') return;
  try {
    const { data: authData } = await supabase.auth.getSession();
    const uid = authData?.session?.user?.id;
    if (!uid) return;

    const nowIso = new Date().toISOString();
    const formattedNow = new Date().toLocaleDateString('pt-BR') + ' ' + new Date().toLocaleTimeString('pt-BR');

    await supabase
      .from('webgis_user_sessions')
      .update({
        last_seen: nowIso,
        formatted_last_seen: formattedNow,
        updated_at: nowIso,
      })
      .eq('auth_uid', uid);
  } catch {
    // Silencioso para não interromper a interface
  }
};

// Acionar rotina de expurgo de dados antigos e visitantes inativos (Exclusivo do Master)
export const cleanupStaleTelemetryAsync = async (
  anonRetentionDays: number = 30,
  logRetentionDays: number = 90
): Promise<{ success: boolean; message: string; details?: any }> => {
  try {
    const { data, error } = await supabase.rpc('cleanup_stale_telemetry_and_anonymous', {
      p_anon_retention_days: anonRetentionDays,
      p_log_retention_days: logRetentionDays
    });

    if (error) {
      return { success: false, message: error.message };
    }
    return {
      success: true,
      message: `Expurgo realizado com sucesso! ${data?.purged_logs || 0} logs, ${data?.purged_sessions || 0} sessões e ${data?.purged_anon_users || 0} usuários anônimos removidos.`,
      details: data
    };
  } catch (e: any) {
    return { success: false, message: e?.message || 'Falha ao executar rotina de expurgo' };
  }
};

// Remover registro de uma sessão
export const deleteUserSession = (sessionId: string): void => {
  if (typeof window === 'undefined' || !sessionId) return;
  try {
    const sessions = getUserSessions();
    if (sessions[sessionId]) {
      delete sessions[sessionId];
      localStorage.setItem(STORAGE_KEYS.USER_SESSIONS, JSON.stringify(sessions));

      // Remover no Supabase
      supabase.from('webgis_user_sessions').delete().eq('session_id', sessionId).then();

      logActivity('ADMIN', `Sessão ${sessionId} foi removida da base`, 'admin');
    }
  } catch (e) { }
};

// Registrar ou atualizar atividade da sessão
const registerUserSessionActivity = (sessionId: string, role: UserRole = 'user', customName?: string): void => {
  if (typeof window === 'undefined' || !sessionId) return;

  // O acesso do Administrador Master é 100% anônimo: nunca registra como sessão de visitante
  if (
    role === 'master' ||
    (role as string) === 'admin' ||
    sessionId === 'master' ||
    (customName && (customName.toLowerCase().includes('master') || customName.toLowerCase().includes('administrador')))
  ) {
    return;
  }

  try {
    const sessions = getUserSessions();
    const now = new Date();
    const formattedNow = now.toLocaleDateString('pt-BR') + ' ' + now.toLocaleTimeString('pt-BR');

    if (!sessions[sessionId]) {
      sessions[sessionId] = {
        sessionId,
        customName: customName || undefined,
        role,
        firstSeen: now.toISOString(),
        lastSeen: now.toISOString(),
        formattedFirstSeen: formattedNow,
        formattedLastSeen: formattedNow,
        loginCount: 1,
        isBlocked: false,
        hasCustomPermissions: false,
      };
    } else {
      sessions[sessionId].lastSeen = now.toISOString();
      sessions[sessionId].formattedLastSeen = formattedNow;
      sessions[sessionId].role = role;
      if (customName) sessions[sessionId].customName = customName;
      if (!sessions[sessionId].loginCount) sessions[sessionId].loginCount = 1;
    }

    localStorage.setItem(STORAGE_KEYS.USER_SESSIONS, JSON.stringify(sessions));

    // OBJETIVO 5: Envia batimento de presença leve por auth_uid no servidor sem gerar conflito de chave primária
    sendSessionHeartbeat().catch(() => {});

  } catch (e) { }
};

// Obter as permissões efetivas para uma sessão (individuais se existirem, senão globais)
export const getEffectiveUserPermissions = (
  sessionId: string,
  defaultLayerNames: string[],
  activeUserOverride?: RegisteredUser | null
): {
  layerPermissions: Record<string, boolean>;
  featurePermissions: FeaturePermissions;
  addressColumnsPermissions: Record<string, boolean>;
  featurePropertiesPermissions: Record<string, boolean>;
  isBlocked: boolean;
  isCustom: boolean;
  customName?: string;
} => {
  const globalLayers = getLayerPermissions(defaultLayerNames);
  const globalFeatures = getFeaturePermissions();
  const globalAddressColumns = getAddressColumnsPermissions();
  const globalFeatureProperties = getFeaturePropertiesPermissions();

  if (typeof window === 'undefined') {
    return {
      layerPermissions: globalLayers,
      featurePermissions: globalFeatures,
      addressColumnsPermissions: globalAddressColumns,
      featurePropertiesPermissions: globalFeatureProperties,
      isBlocked: false,
      isCustom: false,
    };
  }

  // Se foi passado activeUserOverride (inclusive null para simulação de visitante), usa a substituição
  const activeUser = activeUserOverride !== undefined ? activeUserOverride : getCurrentActiveUser();
  if (activeUser) {
    // Busca os dados em tempo real da lista atualizada pelo Supabase
    const liveUsers = getRegisteredUsers();
    const freshUser = liveUsers.find(u => u.id === activeUser.id || u.username.toLowerCase() === activeUser.username.toLowerCase()) || activeUser;

    const isBlocked = freshUser.isActive === false;
    const isCustom = !!freshUser.hasCustomPermissions;

    const effectiveLayers = isCustom && freshUser.customLayerPermissions
      ? { ...globalLayers, ...freshUser.customLayerPermissions }
      : globalLayers;

    const effectiveFeatures = isCustom && freshUser.customFeaturePermissions
      ? { ...globalFeatures, ...freshUser.customFeaturePermissions }
      : globalFeatures;

    const effectiveAddressColumns = isCustom && freshUser.customAddressColumnsPermissions
      ? { ...globalAddressColumns, ...freshUser.customAddressColumnsPermissions }
      : globalAddressColumns;

    const effectiveFeatureProperties = isCustom && freshUser.customFeaturePropertiesPermissions
      ? { ...globalFeatureProperties, ...freshUser.customFeaturePropertiesPermissions }
      : globalFeatureProperties;

    return {
      layerPermissions: effectiveLayers,
      featurePermissions: effectiveFeatures,
      addressColumnsPermissions: effectiveAddressColumns,
      featurePropertiesPermissions: effectiveFeatureProperties,
      isBlocked,
      isCustom,
      customName: freshUser.name + (freshUser.department ? ` (${freshUser.department})` : ''),
    };
  }

  const sessions = getUserSessions();
  const session = sessions[sessionId];

  if (!session) {
    return {
      layerPermissions: globalLayers,
      featurePermissions: globalFeatures,
      addressColumnsPermissions: globalAddressColumns,
      featurePropertiesPermissions: globalFeatureProperties,
      isBlocked: false,
      isCustom: false,
    };
  }

  const isBlocked = !!session.isBlocked;
  const isCustom = !!session.hasCustomPermissions;

  const effectiveLayers = isCustom && session.customLayerPermissions
    ? { ...globalLayers, ...session.customLayerPermissions }
    : globalLayers;

  const effectiveFeatures = isCustom && session.customFeaturePermissions
    ? { ...globalFeatures, ...session.customFeaturePermissions }
    : globalFeatures;

  const effectiveAddressColumns = isCustom && session.customAddressColumnsPermissions
    ? { ...globalAddressColumns, ...session.customAddressColumnsPermissions }
    : globalAddressColumns;

  const effectiveFeatureProperties = isCustom && session.customFeaturePropertiesPermissions
    ? { ...globalFeatureProperties, ...session.customFeaturePropertiesPermissions }
    : globalFeatureProperties;

  return {
    layerPermissions: effectiveLayers,
    featurePermissions: effectiveFeatures,
    addressColumnsPermissions: effectiveAddressColumns,
    featurePropertiesPermissions: effectiveFeatureProperties,
    isBlocked,
    isCustom,
    customName: session.customName,
  };
};

// ================= AUDIT LOGGING =================

// Registrar Atividade no Sistema
export const logActivity = (
  category: ActivityLog['category'],
  action: string,
  userRole: UserRole = 'user',
  details?: string
): void => {
  if (typeof window === 'undefined') return;

  try {
    const sId = getSessionId();
    const now = new Date();
    const formattedDate = now.toLocaleDateString('pt-BR') + ' ' + now.toLocaleTimeString('pt-BR');

    // Identificar se há um usuário credenciado logado no momento
    const activeUser = getCurrentActiveUser();
    const effectiveRole: UserRole = activeUser?.role || userRole;

    // Se o usuário autenticado for gerente ou usuário, enriquece a identificação nos detalhes
    let enrichedDetails = details;
    if (activeUser && activeUser.username) {
      const userTag = `@${activeUser.username} (${activeUser.name})`;
      if (!enrichedDetails) {
        enrichedDetails = `Responsável: ${userTag}`;
      } else if (!enrichedDetails.includes(activeUser.username)) {
        enrichedDetails = `${enrichedDetails} • [${userTag}]`;
      }
    }

    // Atualiza a sessão nos registros de usuários
    registerUserSessionActivity(sId, effectiveRole, activeUser?.name);

    // Truncar para respeitar as restrições estritas do banco de dados (<= 150 action, <= 2500 details, <= 50 category)
    const safeAction = (action || '').substring(0, 150);
    const safeDetails = enrichedDetails ? enrichedDetails.substring(0, 2500) : null;
    const safeCategory = (category || 'ACESSO').substring(0, 50) as ActivityLog['category'];

    const newLog: ActivityLog = {
      id: 'log_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
      timestamp: now.toISOString(),
      formattedDate,
      userRole: effectiveRole,
      category: safeCategory,
      action: safeAction,
      details: safeDetails || undefined,
      sessionId: activeUser?.username ? `@${activeUser.username}` : sId
    };

    const saved = localStorage.getItem(STORAGE_KEYS.ACTIVITY_LOGS);
    const logs: ActivityLog[] = saved ? JSON.parse(saved) : [];

    // Mantém os últimos 1.000 registros para alta performance e armazenamento limpo
    const updated = [newLog, ...logs].slice(0, 1000);
    localStorage.setItem(STORAGE_KEYS.ACTIVITY_LOGS, JSON.stringify(updated));

    // Gravar no Supabase (com actor_id do token atual e enriquecimento por trigger)
    supabase.auth.getSession().then(({ data: authData }) => {
      const uid = authData?.session?.user?.id;
      supabase.from('webgis_logs').insert({
        id: newLog.id,
        timestamp: newLog.timestamp,
        formatted_date: newLog.formattedDate,
        user_role: newLog.userRole,
        category: newLog.category,
        action: newLog.action,
        details: newLog.details || null,
        session_id: newLog.sessionId,
        ...(uid ? { actor_id: uid } : {})
      }).then();
    }).catch(() => {
      supabase.from('webgis_logs').insert({
        id: newLog.id,
        timestamp: newLog.timestamp,
        formatted_date: newLog.formattedDate,
        user_role: newLog.userRole,
        category: newLog.category,
        action: newLog.action,
        details: newLog.details || null,
        session_id: newLog.sessionId
      }).then();
    });

  } catch (e) {
    console.warn('Falha ao gravar log de auditoria:', e);
  }
};

// Obter todos os logs de atividade (cache local)
export const getActivityLogs = (): ActivityLog[] => {
  if (typeof window === 'undefined') return [];
  try {
    const saved = localStorage.getItem(STORAGE_KEYS.ACTIVITY_LOGS);
    return saved ? JSON.parse(saved) : [];
  } catch (e) {
    return [];
  }
};

// Obter todos os logs de atividade diretamente do Supabase em tempo real (Sincronizado na Nuvem)
export const getActivityLogsAsync = async (): Promise<ActivityLog[]> => {
  try {
    const { data, error } = await supabase
      .from('webgis_logs')
      .select('*')
      .order('timestamp', { ascending: false })
      .limit(1000);

    if (!error && data && data.length > 0) {
      const logs: ActivityLog[] = data.map((row: any) => ({
        id: row.id,
        timestamp: row.timestamp,
        formattedDate: row.formatted_date,
        userRole: row.user_role as UserRole,
        category: row.category,
        action: row.action,
        details: row.details,
        sessionId: row.session_id,
        actorId: row.actor_id || undefined,
      }));
      localStorage.setItem(STORAGE_KEYS.ACTIVITY_LOGS, JSON.stringify(logs));
      return logs;
    }
  } catch (e) {
    console.warn('getActivityLogsAsync: erro ao buscar logs do Supabase:', e);
  }
  return getActivityLogs();
};

// Obter logs exclusivos de um usuário/sessão específico (local)
export const getUserLogs = (sessionId: string, username?: string, customName?: string): ActivityLog[] => {
  const allLogs = getActivityLogs();
  const cleanId = sessionId?.toLowerCase() || '';
  const cleanUser = username?.toLowerCase().replace(/^@/, '') || '';
  const cleanName = customName?.toLowerCase() || '';

  return allLogs.filter(log => {
    const sId = (log.sessionId || '').toLowerCase().replace(/^@/, '');
    const act = (log.action || '').toLowerCase();
    const det = (log.details || '').toLowerCase();

    if (cleanId && (sId === cleanId || sId.includes(cleanId))) return true;
    if (cleanUser && (sId === cleanUser || act.includes(cleanUser) || det.includes(cleanUser))) return true;
    if (cleanName && (act.includes(cleanName) || det.includes(cleanName))) return true;
    return false;
  });
};

// Obter logs do usuário diretamente do Supabase em tempo real
export const getUserLogsAsync = async (sessionId?: string, username?: string, customName?: string): Promise<ActivityLog[]> => {
  try {
    const allLogs = await getActivityLogsAsync();
    const cleanId = sessionId?.toLowerCase() || '';
    const cleanUser = username?.toLowerCase().replace(/^@/, '') || '';
    const cleanName = customName?.toLowerCase() || '';

    return allLogs.filter(log => {
      const sId = (log.sessionId || '').toLowerCase().replace(/^@/, '');
      const act = (log.action || '').toLowerCase();
      const det = (log.details || '').toLowerCase();

      if (cleanId && (sId === cleanId || sId.includes(cleanId))) return true;
      if (cleanUser && (sId === cleanUser || act.includes(cleanUser) || det.includes(cleanUser))) return true;
      if (cleanName && (act.includes(cleanName) || det.includes(cleanName))) return true;
      return false;
    });
  } catch (e) {
    console.warn('getUserLogsAsync: fallback para logs locais:', e);
    return getUserLogs(sessionId || '', username, customName);
  }
};

// Limpar todos os logs
export const clearActivityLogs = (): void => {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(STORAGE_KEYS.ACTIVITY_LOGS);
  supabase.from('webgis_logs').delete().neq('id', '').then();
  logActivity('ADMIN', 'Histórico de auditoria e logs foi limpo', 'admin');
};

// Exportar Logs para CSV (com suporte a filtro opcional e papéis normalizados)
export const exportActivityLogsToCSV = (logsToExport?: ActivityLog[]): void => {
  const logs = logsToExport || getActivityLogs();
  const sessions = getUserSessions();
  if (logs.length === 0) {
    return;
  }

  const formatRoleLabel = (r?: UserRole): string => {
    if (r === 'master' || r === 'admin') return 'Administrador Master';
    if (r === 'manager') return 'Gerente';
    return 'Usuário Comum / Visitante';
  };

  const headers = ['Data e Hora', 'Usuário / Identificação', 'Perfil de Acesso', 'Categoria', 'Ação', 'Detalhes', 'ID da Sessão'];
  const rows = logs.map(l => {
    const sessionInfo = sessions[l.sessionId];
    const userDisplayName = sessionInfo?.customName
      ? `${sessionInfo.customName} (${l.sessionId})`
      : l.sessionId;

    return [
      `"${l.formattedDate}"`,
      `"${userDisplayName}"`,
      `"${formatRoleLabel(l.userRole)}"`,
      `"${l.category}"`,
      `"${(l.action || '').replace(/"/g, '""')}"`,
      `"${(l.details || '').replace(/"/g, '""')}"`,
      `"${l.sessionId}"`
    ];
  });

  const csv = '\uFEFF' + headers.join(',') + '\r\n' + rows.map(r => r.join(',')).join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `relatorio_atividades_webgis_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

// ================= AUDITORIA DE MUDANÇA DE PODERES (auth_capability_audit) =================

const DEFAULT_CAPABILITY_AUDIT_LOGS: CapabilityAuditLog[] = [
  {
    id: 'audit_init_001',
    timestamp: new Date(Date.now() - 3600000 * 2).toISOString(),
    formattedDate: new Date(Date.now() - 3600000 * 2).toLocaleDateString('pt-BR') + ' ' + new Date(Date.now() - 3600000 * 2).toLocaleTimeString('pt-BR'),
    performedByName: 'Administrador Master',
    targetType: 'base_role',
    targetId: 'role:manager',
    targetName: 'Perfil Base Gerente',
    capabilityKey: 'admin:users:create',
    action: 'grant_delegate',
    beforeState: { can_use: true, can_grant: false },
    afterState: { can_use: true, can_grant: true },
    reason: 'Delegação de poderes de criação de equipe para perfil Gerente'
  },
  {
    id: 'audit_init_002',
    timestamp: new Date(Date.now() - 3600000 * 5).toISOString(),
    formattedDate: new Date(Date.now() - 3600000 * 5).toLocaleDateString('pt-BR') + ' ' + new Date(Date.now() - 3600000 * 5).toLocaleTimeString('pt-BR'),
    performedByName: 'Administrador Master',
    targetType: 'base_role',
    targetId: 'role:visitor',
    targetName: 'Perfil Base Visitante',
    capabilityKey: 'tool:dissolve_features',
    action: 'set_deny',
    beforeState: { can_use: true },
    afterState: { can_use: false, is_denied: true },
    reason: 'Restrição de ferramentas pesadas de geoprocessamento para visitantes anônimos'
  },
  {
    id: 'audit_init_003',
    timestamp: new Date(Date.now() - 3600000 * 24).toISOString(),
    formattedDate: new Date(Date.now() - 3600000 * 24).toLocaleDateString('pt-BR') + ' ' + new Date(Date.now() - 3600000 * 24).toLocaleTimeString('pt-BR'),
    performedByName: 'Administrador Master',
    targetType: 'global',
    targetId: 'catalog',
    targetName: 'Catálogo de Poderes',
    capabilityKey: 'admin:panel:access',
    action: 'grant_use',
    beforeState: null,
    afterState: { can_use: true, can_grant: true },
    reason: 'Ativação do catálogo relacional com proteção de imunidade ao Master'
  }
];

export const getCapabilityAuditLogs = (): CapabilityAuditLog[] => {
  if (typeof window === 'undefined') return DEFAULT_CAPABILITY_AUDIT_LOGS;
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.CAPABILITY_AUDIT_LOGS);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
    localStorage.setItem(STORAGE_KEYS.CAPABILITY_AUDIT_LOGS, JSON.stringify(DEFAULT_CAPABILITY_AUDIT_LOGS));
    return DEFAULT_CAPABILITY_AUDIT_LOGS;
  } catch {
    return DEFAULT_CAPABILITY_AUDIT_LOGS;
  }
};

export const getCapabilityAuditLogsAsync = async (): Promise<CapabilityAuditLog[]> => {
  try {
    const { data, error } = await supabase
      .from('capability_audit_logs')
      .select('*')
      .order('timestamp', { ascending: false })
      .limit(1000);

    if (error) {
      // Se a tabela ainda não existir no schema cache do Supabase, usa fallback local silencioso
      return getCapabilityAuditLogs();
    }

    if (data && data.length > 0) {
      const logs: CapabilityAuditLog[] = data.map((row: any) => ({
        id: row.id,
        timestamp: row.timestamp,
        formattedDate: new Date(row.timestamp).toLocaleDateString('pt-BR') + ' ' + new Date(row.timestamp).toLocaleTimeString('pt-BR'),
        performedBy: row.performed_by,
        performedByName: row.performed_by_name || 'Sistema / Master',
        targetType: row.target_type,
        targetId: row.target_id,
        targetName: row.target_type === 'base_role'
          ? (row.target_id === 'role:visitor' ? 'Visitante' : row.target_id === 'role:site_account' ? 'Conta do Site' : row.target_id === 'role:user' ? 'Usuário' : row.target_id === 'role:manager_user' ? 'Login gerado por Gerente' : 'Gerente')
          : (row.target_type === 'global' ? 'Global' : `@${row.target_id}`),
        capabilityKey: row.capability_key,
        action: row.action,
        beforeState: row.before_state,
        afterState: row.after_state,
        reason: row.reason
      }));
      localStorage.setItem(STORAGE_KEYS.CAPABILITY_AUDIT_LOGS, JSON.stringify(logs));
      return logs;
    }
  } catch {
    // Fallback local silencioso
  }
  return getCapabilityAuditLogs();
};

export const logCapabilityAudit = async (
  entry: Omit<CapabilityAuditLog, 'id' | 'timestamp' | 'formattedDate'>
): Promise<void> => {
  if (typeof window === 'undefined') return;
  const now = new Date();
  const clientUuid = (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function')
    ? crypto.randomUUID()
    : 'c' + Date.now().toString(16).padStart(11, '0') + '-0000-4000-8000-' + Math.random().toString(16).substring(2, 14).padEnd(12, '0');

  const newLog: CapabilityAuditLog = {
    id: clientUuid,
    timestamp: now.toISOString(),
    formattedDate: now.toLocaleDateString('pt-BR') + ' ' + now.toLocaleTimeString('pt-BR'),
    ...entry
  };
  const current = getCapabilityAuditLogs();
  const updated = [newLog, ...current].slice(0, 1000);
  localStorage.setItem(STORAGE_KEYS.CAPABILITY_AUDIT_LOGS, JSON.stringify(updated));

  try {
    const { data: authData } = await supabase.auth.getSession();
    const actorUid = authData?.session?.user?.id || entry.performedBy || null;

    const payload: any = {
      timestamp: newLog.timestamp,
      performed_by: actorUid,
      performed_by_name: newLog.performedByName || (authData?.session?.user?.email ?? null),
      target_type: newLog.targetType,
      target_id: newLog.targetId,
      capability_key: newLog.capabilityKey,
      action: newLog.action,
      before_state: newLog.beforeState || null,
      after_state: newLog.afterState || null,
      reason: newLog.reason || null
    };

    // Só envia id se for UUID estritamente válido para o PostgreSQL, senão deixa o banco gerar gen_random_uuid()
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(clientUuid)) {
      payload.id = clientUuid;
    }

    await supabase.from('capability_audit_logs').insert(payload);
  } catch (err) {
    console.warn('Erro ao salvar auditoria de capacidade no Supabase:', err);
  }
};

export const exportCapabilityAuditLogsToCSV = (logsToExport?: CapabilityAuditLog[]): void => {
  const logs = logsToExport || getCapabilityAuditLogs();
  if (logs.length === 0) return;

  const actionLabels: Record<string, string> = {
    grant_use: 'Conceder Uso',
    revoke_use: 'Revogar Uso',
    grant_delegate: 'Conceder Repasse (Delegação)',
    revoke_delegate: 'Revogar Repasse',
    set_deny: 'Negar Expressamente',
    remove_override: 'Remover Exceção'
  };

  const headers = ['Data e Hora', 'Responsável', 'Tipo de Alvo', 'Alvo', 'Poder / Capacidade', 'Ação', 'Estado Anterior', 'Estado Novo', 'Motivo / Justificativa'];
  const rows = logs.map(l => {
    return [
      `"${l.formattedDate || l.timestamp}"`,
      `"${(l.performedByName || 'Sistema').replace(/"/g, '""')}"`,
      `"${l.targetType.toUpperCase()}"`,
      `"${(l.targetName || l.targetId).replace(/"/g, '""')}"`,
      `"${l.capabilityKey}"`,
      `"${actionLabels[l.action] || l.action}"`,
      `"${JSON.stringify(l.beforeState || {}).replace(/"/g, '""')}"`,
      `"${JSON.stringify(l.afterState || {}).replace(/"/g, '""')}"`,
      `"${(l.reason || '').replace(/"/g, '""')}"`
    ];
  });

  const csv = '\uFEFF' + headers.join(',') + '\r\n' + rows.map(r => r.join(',')).join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `auditoria_mudanca_poderes_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

// ================= CAPACIDADES EFETIVAS & NOVO MODELO DE PODERES =================

export interface EffectiveCapability {
  can_use: boolean;
  can_grant: boolean;
  source: string;
}

export const STANDARD_LAYER_NAMES = [
  'AISP',
  'Aglomerados Rurais',
  'Áreas de Desenvolvimento',
  'Bairros',
  'Comunidades Rurais de Teresina',
  'Favelas e Comunidades',
  'Localidades (Piauí)',
  'Municipios',
  'Núcleos Urbanos',
  'RISP'
];

/**
 * Constrói o mapa de capacidades seguro de fallback correspondente aos perfis base
 * (Visitante, Conta do Site, Usuário, Gerente, Master), aplicando exceções individuais se existirem.
 */
export const buildFallbackCapabilitiesMap = (
  userId?: string
): Record<string, EffectiveCapability> => {
  const activeUser = getCurrentActiveUser();
  const role: UserRole = activeUser ? (activeUser.role || 'user') : 'visitor';
  const isMaster = role === 'master' || role === 'admin';
  const isManager = role === 'manager';
  const isSiteAccount = role === 'site_account';
  const isManagerUser = role === 'manager_user';
  const isUser = role === 'user';

  const map: Record<string, EffectiveCapability> = {};

  // Se for Master, todas as capacidades do catálogo recebem uso e delegação total
  if (isMaster) {
    const catalog = getAllCapabilitiesCatalog(STANDARD_LAYER_NAMES);
    catalog.forEach(item => {
      map[item.key] = { can_use: true, can_grant: true, source: 'master' };
    });
    return map;
  }

  // 1. Matriz completa de poderes por papel base (camadas, ferramentas, dados, conta, admin)
  const baseMatrix = getBaseRolesMatrix(STANDARD_LAYER_NAMES);
  const roleKey: BaseRoleKey = isManager ? 'manager' : isSiteAccount ? 'site_account' : isManagerUser ? 'manager_user' : isUser ? 'user' : 'visitor';
  const roleEntries = baseMatrix[roleKey] || {};

  Object.entries(roleEntries).forEach(([capKey, entry]) => {
    map[capKey] = {
      can_use: entry.can_use === true,
      can_grant: entry.can_grant === true,
      source: 'base_role'
    };
  });

  // 2. Sobrepor permissões de camadas globais salvas (se alguma camada foi desativada globalmente)
  const globalLayers = getLayerPermissions(STANDARD_LAYER_NAMES);
  STANDARD_LAYER_NAMES.forEach(layerName => {
    if (globalLayers[layerName] === false) {
      if (map[`layer:${layerName}`]) {
        map[`layer:${layerName}`].can_use = false;
      }
    }
  });

  // 3. Sobrepor ferramentas globais salvas
  const globalFeatures = getFeaturePermissions();
  const legacyToolMap: Record<string, keyof FeaturePermissions> = {
    'tool:cnefe_search': 'allowCnefeSearch',
    'tool:advanced_search': 'allowCnefeSearch',
    'tool:measure': 'allowMeasureTool',
    'tool:print_a4': 'allowPrintA4',
    'tool:layer_panel': 'allowLayerPanel',
    'tool:raio_x': 'allowDashboardRaioX',
    'tool:selected_features': 'allowSelectedFeaturesPanel',
    'tool:feature_specs': 'allowFeatureSpecs',
    'tool:sources_footer': 'allowSourcesFooter',
    'tool:search_active_layers_only': 'allowSearchActiveLayersOnly',
    'tool:dissolve_features': 'allowDissolveFeatures',
    'tool:multi_select': 'allowMultiSelect',
    'tool:search_by_type': 'allowSearchByType',
    'tool:search_area_addresses': 'allowSearchAreaAddresses',
    'tool:customize_useful_info': 'allowCustomizeUsefulInfo',
    'tool:basemap_selector': 'allowBasemapSelector',
    'tool:map_legend': 'allowMapLegend',
    'tool:export_data': 'allowExportData',
    'data:export:csv': 'allowExportCsv',
    'data:export:kml': 'allowExportKml',
    'data:export:kmz': 'allowExportKmz',
    'data:export:geojson': 'allowExportGeoJson',
    'data:export:shapefile': 'allowExportShapefile',
    'data:export:geopackage': 'allowExportGeoPackage'
  };

  Object.entries(legacyToolMap).forEach(([capKey, prop]) => {
    if (globalFeatures[prop] === false) {
      if (map[capKey]) {
        map[capKey].can_use = false;
      }
    }
  });

  // 4. Sobrepor exceções individuais granulares (tabela user_capabilities / local storage)
  const targetId = userId || activeUser?.id;
  if (targetId) {
    const overrides = getUserOverrides(targetId);
    Object.entries(overrides).forEach(([capKey, override]) => {
      if (override.override_type === 'allow') {
        map[capKey] = {
          can_use: true,
          can_grant: isManager && override.can_grant === true,
          source: 'user_override'
        };
      } else if (override.override_type === 'deny') {
        map[capKey] = {
          can_use: false,
          can_grant: false,
          source: 'user_override'
        };
      }
    });
  }

  // 5. Retrocompatibilidade com customLayerPermissions e customFeaturePermissions
  if (activeUser?.hasCustomPermissions) {
    if (activeUser.customLayerPermissions) {
      Object.entries(activeUser.customLayerPermissions).forEach(([layerName, allowed]) => {
        if (allowed !== undefined) {
          map[`layer:${layerName}`] = {
            can_use: allowed === true,
            can_grant: isManager && allowed === true,
            source: 'user_override'
          };
        }
      });
    }
    if (activeUser.customFeaturePermissions) {
      Object.entries(legacyToolMap).forEach(([capKey, prop]) => {
        const val = activeUser.customFeaturePermissions?.[prop];
        if (val !== undefined) {
          map[capKey] = {
            can_use: val === true,
            can_grant: isManager && val === true,
            source: 'user_override'
          };
        }
      });
    }
  }

  return map;
};

// Controle de cache e disponibilidade da função RPC get_effective_capabilities no Supabase
let isRpcAvailable: boolean | null = (() => {
  try {
    if (typeof sessionStorage !== 'undefined') {
      const val = sessionStorage.getItem('webgis_rpc_capabilities_available');
      if (val === 'false') return false;
      if (val === 'true') return true;
    }
  } catch {}
  return null;
})();
let lastRpcCheckTime = 0;
const RPC_CHECK_COOLDOWN_MS = 60 * 60 * 1000; // 1 hora de cooldown se a função ainda não existir no banco

const inFlightCapabilitiesPromises = new Map<string, Promise<Record<string, EffectiveCapability>>>();

/**
 * Reseta o indicador de disponibilidade do RPC permitindo nova verificação imediata (apenas se forçado)
 */
export const resetRpcCapabilitiesCheck = (force = false) => {
  if (force) {
    isRpcAvailable = null;
    try { sessionStorage.removeItem('webgis_rpc_capabilities_available'); } catch {}
  }
  inFlightCapabilitiesPromises.clear();
};

const internalFetchEffectiveCapabilities = async (
  targetId?: string
): Promise<Record<string, EffectiveCapability>> => {
  const cacheKey = `webgis_capabilities_cache_${targetId || 'visitor'}`;

  // 1. Tentar buscar em tempo real do banco de dados (RPC get_effective_capabilities) se estiver disponível
  const now = Date.now();
  const shouldTryRpc = isRpcAvailable !== false || (now - lastRpcCheckTime > RPC_CHECK_COOLDOWN_MS);

  if (shouldTryRpc) {
    try {
      const { data: authData } = await supabase.auth.getSession();
      if (authData?.session?.user) {
        lastRpcCheckTime = now;
        const { data, error } = await supabase.rpc('get_effective_capabilities', {
          p_user_id: targetId || null
        });

        if (error) {
          // Se a função ainda não foi criada no banco de dados (404 / PGRST202 / schema cache)
          if (
            error.code === 'PGRST202' ||
            error.message?.includes('not found') ||
            error.message?.includes('schema cache') ||
            (error as any).status === 404 ||
            error.message?.includes('404')
          ) {
            isRpcAvailable = false;
            try { sessionStorage.setItem('webgis_rpc_capabilities_available', 'false'); } catch {}
            console.info(
              '[WebGIS] Nota: A função SQL "get_effective_capabilities" ainda não foi instalada no Supabase. Utilizando matriz de capacidades segura (fallback local).'
            );
          }
        } else if (Array.isArray(data) && data.length > 0) {
          isRpcAvailable = true;
          try { sessionStorage.setItem('webgis_rpc_capabilities_available', 'true'); } catch {}
          const map: Record<string, EffectiveCapability> = {};
          data.forEach((row: any) => {
            if (row.capability_key) {
              map[row.capability_key] = {
                can_use: row.can_use === true,
                can_grant: row.can_grant === true,
                source: row.source || 'server'
              };
            }
          });
          try {
            localStorage.setItem(cacheKey, JSON.stringify(map));
          } catch (e) { }
          return map;
        }
      }
    } catch (e) {
      isRpcAvailable = false;
    }
  }

  // 2. Fallback: Recuperar do cache offline seguro (validando se contém camadas)
  try {
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      const parsed = JSON.parse(cached);
      if (parsed && typeof parsed === 'object' && Object.keys(parsed).some(k => k.startsWith('layer:'))) {
        return parsed;
      }
    }
  } catch (e) { }

  // 3. Fallback: Computar mapa padrão seguro
  const fallback = buildFallbackCapabilitiesMap(targetId);
  try {
    localStorage.setItem(cacheKey, JSON.stringify(fallback));
  } catch (e) { }
  return fallback;
};

/**
 * Carrega as capacidades efetivas do servidor (Supabase RPC) e armazena em cache offline no localStorage.
 * Inclui deduplicação de chamadas simultâneas (in-flight de-duplication) para evitar requisições redundantes.
 */
export const fetchEffectiveCapabilitiesAsync = (
  userId?: string
): Promise<Record<string, EffectiveCapability>> => {
  const activeUser = getCurrentActiveUser();
  const targetId = userId || activeUser?.id;
  const inFlightKey = targetId || 'visitor';

  const existingPromise = inFlightCapabilitiesPromises.get(inFlightKey);
  if (existingPromise) {
    return existingPromise;
  }

  const promise = (async () => {
    try {
      return await internalFetchEffectiveCapabilities(targetId);
    } finally {
      inFlightCapabilitiesPromises.delete(inFlightKey);
    }
  })();

  inFlightCapabilitiesPromises.set(inFlightKey, promise);
  return promise;
};

// ================= MATRIZ DE PODERES E CATÁLOGO RELACIONAL =================

export type CapabilityGroup = 'camadas' | 'ferramentas' | 'dados' | 'conta' | 'administracao';

export interface CapabilityItem {
  key: string;
  name: string;
  group: CapabilityGroup;
  description: string;
  riskLevel?: 'low' | 'medium' | 'high' | 'critical';
}

export type BaseRoleKey = 'visitor' | 'site_account' | 'user' | 'manager_user' | 'manager';

export interface RoleCapabilityEntry {
  can_use: boolean;
  can_grant: boolean;
}

export type RoleCapabilitiesMatrix = Record<BaseRoleKey, Record<string, RoleCapabilityEntry>>;

export type OverrideSetting = 'inherit' | 'allow' | 'deny';

export interface UserCapabilityOverrideEntry {
  override_type: OverrideSetting;
  can_grant?: boolean;
}

export interface ManagerScopeConfig {
  scope_type: 'team_only' | 'all_users';
  can_manage_site_accounts: boolean;
  can_manage_visitors: boolean;
}

export const isAdminCapability = (capKey: string): boolean => capKey.startsWith('admin:');

export const getAllCapabilitiesCatalog = (layersList?: string[]): CapabilityItem[] => {
  const dynamicLayers = layersList || ['Municipios', 'Bairros', 'Favelas e Comunidades'];
  const layerItems: CapabilityItem[] = dynamicLayers.map(l => ({
    key: `layer:${l}`,
    name: `Camada: ${l}`,
    group: 'camadas',
    description: `Acesso e visualização geoespacial da camada ${l} no mapa`,
    riskLevel: 'low'
  }));

  const standardItems: CapabilityItem[] = [
    // Ferramentas
    { key: 'tool:cnefe_search', name: 'Busca CNEFE de Endereços', group: 'ferramentas', description: 'Consulta geocodificada na base do CNEFE/IBGE', riskLevel: 'low' },
    { key: 'tool:advanced_search', name: 'Busca Avançada de Endereços', group: 'ferramentas', description: 'Painel e gaveta inferior de consulta avançada CNEFE', riskLevel: 'low' },
    { key: 'tool:search_area_addresses', name: 'Buscar Endereços na Área', group: 'ferramentas', description: 'Extração de endereços contidos no interior do polígono', riskLevel: 'medium' },
    { key: 'tool:search_by_type', name: 'Buscar por Categoria / Tipo', group: 'ferramentas', description: 'Filtro por estabelecimentos e tipos de edificação', riskLevel: 'low' },
    { key: 'tool:measure', name: 'Régua e Medição', group: 'ferramentas', description: 'Medição interativa de distâncias lineares e perímetros', riskLevel: 'low' },
    { key: 'tool:print_a4', name: 'Impressão em A4', group: 'ferramentas', description: 'Geração de prancha cartográfica A4 com escala e norte', riskLevel: 'low' },
    { key: 'tool:layer_panel', name: 'Painel de Camadas', group: 'ferramentas', description: 'Controle de visibilidade e ordem das camadas territoriais', riskLevel: 'low' },
    { key: 'tool:raio_x', name: 'Raio-X Territorial', group: 'ferramentas', description: 'Painel analítico agregado de indicadores demográficos', riskLevel: 'medium' },
    { key: 'tool:selected_features', name: 'Feições Selecionadas', group: 'ferramentas', description: 'Lista e inspeção rápida das geometrias marcadas', riskLevel: 'low' },
    { key: 'tool:feature_specs', name: 'Detalhes da Feição', group: 'ferramentas', description: 'Ficha completa de atributos censitários da geometria', riskLevel: 'low' },
    { key: 'tool:dissolve_features', name: 'Dissolver Feições', group: 'ferramentas', description: 'União geométrica de múltiplos polígonos em contorno único', riskLevel: 'medium' },
    { key: 'tool:multi_select', name: 'Multiseleção de Áreas', group: 'ferramentas', description: 'Seleção contínua de várias áreas com Ctrl ou botão', riskLevel: 'low' },
    { key: 'tool:customize_useful_info', name: 'Personalizar Informações Úteis', group: 'ferramentas', description: 'Configuração individual dos cartões da ficha de feição', riskLevel: 'low' },
    { key: 'tool:basemap_selector', name: 'Seletor de Mapa Base', group: 'ferramentas', description: 'Alternância entre mapas vetoriais, relevo e satélite', riskLevel: 'low' },
    { key: 'tool:map_legend', name: 'Legenda do Mapa', group: 'ferramentas', description: 'Exibição da convenção cartográfica e cores das camadas', riskLevel: 'low' },
    { key: 'tool:search_active_layers_only', name: 'Buscar Apenas em Camadas Ativas', group: 'ferramentas', description: 'Restrição da busca global às camadas visíveis', riskLevel: 'low' },
    { key: 'tool:export_data', name: 'Exportação de Dados', group: 'ferramentas', description: 'Acesso ao painel e download de geometrias e atributos', riskLevel: 'medium' },

    // Dados
    { key: 'data:export:csv', name: 'Exportar CSV (Planilhas)', group: 'dados', description: 'Download tabular com UTF-8 BOM compatível com Excel', riskLevel: 'medium' },
    { key: 'data:export:geojson', name: 'Exportar GeoJSON', group: 'dados', description: 'Formato aberto padrão web com atributos e geometrias', riskLevel: 'medium' },
    { key: 'data:export:kml', name: 'Exportar KML (Google Earth)', group: 'dados', description: 'Arquivo KML para visualização no Google Earth', riskLevel: 'medium' },
    { key: 'data:export:kmz', name: 'Exportar KMZ (Compactado)', group: 'dados', description: 'Pacote comprimido de alta performance para Google Earth', riskLevel: 'medium' },
    { key: 'data:export:shapefile', name: 'Exportar Shapefile (ZIP)', group: 'dados', description: 'Pacote padrão ESRI SHP/SHX/DBF/PRJ para QGIS/ArcGIS', riskLevel: 'high' },
    { key: 'data:export:geopackage', name: 'Exportar GeoPackage (GPKG)', group: 'dados', description: 'Padrão moderno OGC SQLite para geoprocessamento', riskLevel: 'high' },
    { key: 'data:column:address', name: 'Colunas de Endereço CNEFE', group: 'dados', description: 'Visibilidade das colunas de logradouro, número e CEP', riskLevel: 'low' },
    { key: 'data:property:feature', name: 'Propriedades Censitárias', group: 'dados', description: 'Visibilidade dos campos populacionais e domiciliares', riskLevel: 'low' },
    { key: 'data:limit:high_volume', name: 'Exportar Mais de 50.000 Linhas', group: 'dados', description: 'Autorização especial para extrações de grande volume', riskLevel: 'high' },

    // Conta
    { key: 'account:self_register', name: 'Autocadastro', group: 'conta', description: 'Criação autônoma de conta pelo portal do site', riskLevel: 'low' },
    { key: 'account:change_own_password', name: 'Trocar a Própria Senha', group: 'conta', description: 'Alteração de credencial pelo próprio usuário autenticado', riskLevel: 'low' },
    { key: 'account:edit_own_profile', name: 'Editar o Próprio Perfil', group: 'conta', description: 'Atualização de nome e preferências pessoais', riskLevel: 'low' },

    // Administração
    { key: 'admin:panel:access', name: 'Abrir Painel de Administração', group: 'administracao', description: 'Acesso à interface de controle do sistema', riskLevel: 'high' },
    { key: 'admin:users:view', name: 'Visualizar Usuários', group: 'administracao', description: 'Leitura da lista de contas cadastradas e da equipe', riskLevel: 'medium' },
    { key: 'admin:users:create', name: 'Criar Usuários', group: 'administracao', description: 'Cadastro de novos membros com senha inicial segura', riskLevel: 'high' },
    { key: 'admin:users:reset_password', name: 'Redefinir Senhas', group: 'administracao', description: 'Geração de nova senha obrigatória para usuários', riskLevel: 'high' },
    { key: 'admin:users:block', name: 'Bloquear Contas', group: 'administracao', description: 'Suspensão temporária do acesso de usuários', riskLevel: 'high' },
    { key: 'admin:users:delete', name: 'Excluir Usuários', group: 'administracao', description: 'Remoção definitiva de contas subordinadas', riskLevel: 'critical' },
    { key: 'admin:users:promote_manager', name: 'Promover a Gerente', group: 'administracao', description: 'Delegação de prerrogativas de gerência de equipe', riskLevel: 'critical' },
    { key: 'admin:roles:manage', name: 'Gerenciar Catálogo e Perfis Base', group: 'administracao', description: 'Edição da matriz de permissões dos papéis base', riskLevel: 'critical' },
    { key: 'admin:roles:manage_visitor', name: 'Editar Permissões Padrão: Visitante', group: 'administracao', description: 'Permite editar a coluna Visitante na matriz de perfis', riskLevel: 'high' },
    { key: 'admin:roles:manage_site_account', name: 'Editar Permissões Padrão: Conta do Site', group: 'administracao', description: 'Permite editar a coluna Conta do Site na matriz de perfis', riskLevel: 'high' },
    { key: 'admin:roles:manage_user', name: 'Editar Permissões Padrão: Usuário', group: 'administracao', description: 'Permite editar as colunas Usuário e Login gerado por Gerente', riskLevel: 'high' },
    { key: 'admin:logs:view', name: 'Visualizar Auditoria', group: 'administracao', description: 'Consulta à trilha de atividades e mudanças de poderes', riskLevel: 'medium' },
    { key: 'admin:logs:export', name: 'Exportar Auditoria (CSV)', group: 'administracao', description: 'Download dos registros históricos do sistema', riskLevel: 'medium' },
    { key: 'admin:simulate:profile', name: 'Simular Visão de Perfil', group: 'administracao', description: 'Testar a aplicação instantaneamente como outro papel', riskLevel: 'low' },
  ];

  return [...layerItems, ...standardItems];
};

export const buildDefaultRolesMatrix = (layersList?: string[]): RoleCapabilitiesMatrix => {
  const catalog = getAllCapabilitiesCatalog(layersList);
  const matrix: RoleCapabilitiesMatrix = {
    visitor: {},
    site_account: {},
    user: {},
    manager_user: {},
    manager: {}
  };

  catalog.forEach(item => {
    // 1. Visitante
    const isVisitorAllowed =
      item.group === 'camadas' ||
      item.key === 'tool:cnefe_search' ||
      item.key === 'tool:advanced_search' ||
      item.key === 'tool:raio_x' ||
      item.key === 'tool:selected_features' ||
      item.key === 'tool:feature_specs' ||
      item.key === 'tool:basemap_selector' ||
      item.key === 'tool:map_legend' ||
      item.key === 'tool:layer_panel' ||
      item.key === 'data:column:address' ||
      item.key === 'data:property:feature' ||
      item.key === 'account:self_register';

    matrix.visitor[item.key] = {
      can_use: isVisitorAllowed,
      can_grant: false
    };

    // 2. Conta do Site
    const isSiteAllowed =
      isVisitorAllowed ||
      item.key === 'tool:measure' ||
      item.key === 'tool:export_data' ||
      item.key === 'data:export:csv' ||
      item.key === 'data:export:geojson' ||
      item.key === 'account:change_own_password' ||
      item.key === 'account:edit_own_profile';

    matrix.site_account[item.key] = {
      can_use: isSiteAllowed,
      can_grant: false
    };

    // 3. Usuário Comum
    const isUserAllowed =
      item.group === 'camadas' ||
      item.group === 'ferramentas' ||
      item.group === 'dados' ||
      item.group === 'conta';

    matrix.user[item.key] = {
      can_use: isUserAllowed,
      can_grant: false
    };

    // 3b. Login gerado por Gerente (ponto de partida idêntico ao perfil Usuário)
    matrix.manager_user[item.key] = {
      can_use: isUserAllowed,
      can_grant: false
    };

    // 4. Gerente
    const isManagerUse =
      item.group === 'camadas' ||
      item.group === 'ferramentas' ||
      item.group === 'dados' ||
      item.group === 'conta' ||
      item.key === 'admin:panel:access' ||
      item.key === 'admin:users:view' ||
      item.key === 'admin:users:create' ||
      item.key === 'admin:users:reset_password' ||
      item.key === 'admin:logs:view' ||
      item.key === 'admin:logs:export' ||
      item.key === 'admin:simulate:profile';

    const isManagerGrant =
      item.group === 'ferramentas' ||
      item.group === 'camadas';

    matrix.manager[item.key] = {
      can_use: isManagerUse,
      can_grant: isManagerGrant
    };
  });

  return matrix;
};

export const getBaseRolesMatrix = (layersList?: string[]): RoleCapabilitiesMatrix => {
  if (typeof window === 'undefined') return buildDefaultRolesMatrix(layersList);
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.ROLE_CAPABILITIES_MATRIX);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.visitor && parsed.user && parsed.manager) {
        if (!parsed.manager_user) {
          parsed.manager_user = { ...parsed.user };
        }
        return parsed;
      }
    }
  } catch (e) { }

  const defaults = buildDefaultRolesMatrix(layersList);
  try {
    localStorage.setItem(STORAGE_KEYS.ROLE_CAPABILITIES_MATRIX, JSON.stringify(defaults));
  } catch (e) { }
  return defaults;
};

export const saveBaseRolesMatrix = async (
  matrix: RoleCapabilitiesMatrix
): Promise<{ success: boolean; error?: string }> => {
  if (typeof window === 'undefined') return { success: true };
  try {
    localStorage.setItem(STORAGE_KEYS.ROLE_CAPABILITIES_MATRIX, JSON.stringify(matrix));
    notifyPermissionsUpdated();
    return { success: true };
  } catch (err: any) {
    return { success: true };
  }
};

// Salvar alteração pontual de um poder em um perfil base (seguro e sem conflito de FK)
export const saveRoleCapability = async (
  role: BaseRoleKey,
  capKey: string,
  setting: RoleCapabilityEntry,
  options?: { canManageRoles?: boolean; isMaster?: boolean }
): Promise<{ success: boolean; error?: string }> => {
  if (typeof window === 'undefined') return { success: true };
  if (isAdminCapability(capKey) && role !== 'manager') {
    return { success: false, error: 'Poderes administrativos são exclusivos de Gerentes e Master.' };
  }
  if (options?.canManageRoles === false) {
    return { success: false, error: 'Você não tem permissão para editar os perfis padrão.' };
  }
  try {
    // 1. Persistir no Supabase primeiro quando autenticado; se recusar, não grava localmente
    const { data: authData } = await supabase.auth.getSession();
    if (authData?.session?.user) {
      const cleanRoleId = role.replace(/^role:/, '');

      // Apenas o Master tem permissão de escrita em auth_capabilities e base_roles;
      // para Gerentes, pular esses upserts evita 403 Forbidden no console.
      if (options?.isMaster) {
        try {
          await supabase.from('auth_capabilities').upsert({
            key: capKey,
            category: capKey.startsWith('layer:') ? 'camadas' : capKey.startsWith('data:') ? 'dados' : capKey.startsWith('account:') ? 'conta' : 'ferramentas',
            name: capKey,
            description: 'Capacidade cadastrada pelo sistema',
            risk_level: 'low'
          }, { onConflict: 'key' });
        } catch { }

        try {
          await supabase.from('base_roles').upsert({
            id: cleanRoleId,
            name: cleanRoleId === 'visitor' ? 'Visitante Anônimo' : cleanRoleId === 'site_account' ? 'Conta do Site' : cleanRoleId === 'user' ? 'Usuário Credenciado' : cleanRoleId === 'manager_user' ? 'Login gerado por Gerente' : 'Gerente de Equipe',
            is_system: true
          }, { onConflict: 'id' });
        } catch { }
      }

      // 1.3 Upsert pontual da capacidade do perfil base
      const { error } = await supabase.from('role_capabilities').upsert({
        role_id: cleanRoleId,
        capability_key: capKey,
        can_use: setting.can_use,
        can_grant: setting.can_grant,
        effect: setting.can_use ? 'allow' : 'deny',
        updated_at: new Date().toISOString()
      }, { onConflict: 'role_id,capability_key' });

      if (error) {
        return {
          success: false,
          error: error.message || 'O servidor recusou a alteração deste perfil.'
        };
      }
    }

    // 2. Atualizar e sincronizar a matriz local somente após confirmação
    const matrix = getBaseRolesMatrix();
    if (!matrix[role]) matrix[role] = {};
    matrix[role][capKey] = setting;
    localStorage.setItem(STORAGE_KEYS.ROLE_CAPABILITIES_MATRIX, JSON.stringify(matrix));
    notifyPermissionsUpdated();

    return { success: true };
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || 'Erro ao salvar alteração de perfil.'
    };
  }
};

export const getUserOverrides = (userId: string): Record<string, UserCapabilityOverrideEntry> => {
  if (typeof window === 'undefined' || !userId) return {};
  try {
    const raw = localStorage.getItem(`${STORAGE_KEYS.USER_CAPABILITIES_OVERRIDES}_${userId}`);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch (e) { }
  return {};
};

export const saveUserOverride = async (
  userId: string,
  capKey: string,
  override: OverrideSetting,
  canGrant = false,
  options?: { targetRole?: string }
): Promise<{ success: boolean; error?: string }> => {
  if (typeof window === 'undefined' || !userId) return { success: true };
  if (
    isAdminCapability(capKey) &&
    override !== 'inherit' &&
    options?.targetRole &&
    !['manager', 'master', 'admin'].includes(options.targetRole.toLowerCase())
  ) {
    return { success: false, error: 'Poderes administrativos são exclusivos de Gerentes e Master.' };
  }
  try {
    const current = getUserOverrides(userId);
    try {
      if (override === 'inherit') {
        delete current[capKey];
        const { error } = await supabase.from('user_capabilities').delete().match({ user_id: userId, capability_key: capKey });
        if (error) return { success: false, error: error.message };
      } else {
        current[capKey] = {
          override_type: override,
          can_grant: canGrant
        };
        const { error } = await supabase.from('user_capabilities').upsert({
          user_id: userId,
          capability_key: capKey,
          can_use: override === 'allow',
          can_grant: canGrant,
          effect: override,
          updated_at: new Date().toISOString()
        }, { onConflict: 'user_id,capability_key' });
        if (error) return { success: false, error: error.message };
      }
    } catch (e: any) {
      return { success: false, error: e?.message || 'Erro ao sincronizar poder no servidor.' };
    }
    localStorage.setItem(`${STORAGE_KEYS.USER_CAPABILITIES_OVERRIDES}_${userId}`, JSON.stringify(current));
    notifyPermissionsUpdated();
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Erro ao salvar exceção individual.' };
  }
};

export const getManagerScope = (managerId: string): ManagerScopeConfig => {
  if (typeof window === 'undefined' || !managerId) {
    return { scope_type: 'team_only', can_manage_site_accounts: false, can_manage_visitors: false };
  }
  try {
    const raw = localStorage.getItem(`${STORAGE_KEYS.USER_DELEGATION_SCOPES}_${managerId}`);
    if (raw) return JSON.parse(raw);
  } catch (e) { }
  return { scope_type: 'team_only', can_manage_site_accounts: false, can_manage_visitors: false };
};

export const saveManagerScope = async (
  managerId: string,
  scope: Partial<ManagerScopeConfig>
): Promise<{ success: boolean }> => {
  if (typeof window === 'undefined' || !managerId) return { success: true };
  try {
    const current = getManagerScope(managerId);
    const updated = { ...current, ...scope };
    localStorage.setItem(`${STORAGE_KEYS.USER_DELEGATION_SCOPES}_${managerId}`, JSON.stringify(updated));

    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(managerId);
    if (isUuid) {
      try {
        await supabase.from('user_delegation_scopes').upsert({
          manager_id: managerId,
          scope_type: updated.scope_type,
          can_manage_site_accounts: updated.can_manage_site_accounts,
          can_manage_visitors: updated.can_manage_visitors,
          updated_at: new Date().toISOString()
        }, { onConflict: 'manager_id' });
      } catch {
        // Ignora silenciosamente antes da aplicação dos scripts SQL no Supabase
      }
    }

    notifyPermissionsUpdated();
    return { success: true };
  } catch (err) {
    return { success: true };
  }
};

// Inicialização automática do serviço
if (typeof window !== 'undefined') {
  initAdminService();
}
