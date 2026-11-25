import React, { createContext, useContext, useCallback, useMemo, useState, useEffect, useRef } from 'react';
import {
  FeaturePermissions,
  UserRole,
  RegisteredUser,
  EffectiveCapability,
  fetchEffectiveCapabilitiesAsync,
  buildFallbackCapabilitiesMap,
  resetRpcCapabilitiesCheck,
  logActivity
} from '../services/adminService';

export interface AccessContextType {
  // Verificação universal de poderes
  can: (capabilityKey: string) => boolean;
  canGrant: (capabilityKey: string) => boolean;
  canExport: (format?: string) => boolean;
  canViewLayer: (layerName: string) => boolean;
  canViewAddressColumn: (columnKey: string) => boolean;
  canViewFeatureProperty: (propertyKey: string) => boolean;
  getNumericLimit: (key: string, defaultValue?: number) => number;
  guardAction: (capabilityKey: string, actionName: string, action: () => void) => boolean;

  // Estado e perfis
  userRole: UserRole;
  isMaster: boolean;
  isManager: boolean;
  isSiteAccount: boolean;
  isVisitor: boolean;
  effectiveCapabilities: Record<string, EffectiveCapability>;
  refreshAccess: () => Promise<void>;

  // Compatibilidade com código legado
  featurePermissions: FeaturePermissions;
  layerPermissions: Record<string, boolean>;
  addressColumnsPermissions: Record<string, boolean>;
  featurePropertiesPermissions: Record<string, boolean>;
}

// Mantido para compatibilidade com importações legadas
export type FeatureAccessContextType = AccessContextType;

const AccessContext = createContext<AccessContextType | null>(null);

export interface FeatureAccessProviderProps {
  currentActiveUser?: RegisteredUser | null;
  userRole: UserRole;
  isMaster: boolean;
  isManager: boolean;
  featurePermissions?: FeaturePermissions;
  layerPermissions?: Record<string, boolean>;
  addressColumnsPermissions?: Record<string, boolean>;
  featurePropertiesPermissions?: Record<string, boolean>;
  showToast?: (message: string) => void;
  children: React.ReactNode;
}

const LEGACY_TOOL_MAP: Record<string, string> = {
  allowCnefeSearch: 'tool:cnefe_search',
  allowMeasureTool: 'tool:measure',
  allowPrintA4: 'tool:print_a4',
  allowLayerPanel: 'tool:layer_panel',
  allowDashboardRaioX: 'tool:raio_x',
  allowSelectedFeaturesPanel: 'tool:selected_features',
  allowFeatureSpecs: 'tool:feature_specs',
  allowSourcesFooter: 'tool:sources_footer',
  allowSearchActiveLayersOnly: 'tool:search_active_layers_only',
  allowDissolveFeatures: 'tool:dissolve_features',
  allowMultiSelect: 'tool:multi_select',
  allowSearchByType: 'tool:search_by_type',
  allowSearchAreaAddresses: 'tool:search_area_addresses',
  allowCustomizeUsefulInfo: 'tool:customize_useful_info',
  allowBasemapSelector: 'tool:basemap_selector',
  allowMapLegend: 'tool:map_legend',
  allowExportData: 'tool:export_data',
  allowExportCsv: 'data:export:csv',
  allowExportKml: 'data:export:kml',
  allowExportKmz: 'data:export:kmz',
  allowExportGeoJson: 'data:export:geojson',
  allowExportShapefile: 'data:export:shapefile',
  allowExportGeoPackage: 'data:export:geopackage',
  allowAdvancedSearch: 'tool:advanced_search',
  // Flags de gerência
  allowGenerateLogins: 'admin:users:create',
  allowChangePasswords: 'admin:users:reset_password',
  canCreateManagerRole: 'admin:users:promote_manager',
  allowViewAllVisitors: 'admin:users:view'
};

const CANONICAL_TO_LEGACY_TOOL_MAP: Record<string, keyof FeaturePermissions> = Object.entries(LEGACY_TOOL_MAP)
  .reduce((acc, [legacyKey, canonicalKey]) => {
    if (!canonicalKey.startsWith('admin:')) {
      acc[canonicalKey] = legacyKey as keyof FeaturePermissions;
    }
    return acc;
  }, {} as Record<string, keyof FeaturePermissions>);

/**
 * Normaliza qualquer variante de chave de permissão (dot-notation, camelCase legado ou chave canônica)
 * para a chave canônica do catálogo do banco.
 */
export const normalizeCapabilityKey = (raw: string): string => {
  if (!raw) return '';
  const key = raw.trim();

  // 1. Mapeamento direto de camelCase de FeaturePermissions
  if (LEGACY_TOOL_MAP[key]) return LEGACY_TOOL_MAP[key];

  // 2. Mapeamento de dot-notation em português
  const dotMap: Record<string, string> = {
    'ferramenta.cnefe': 'tool:cnefe_search',
    'ferramenta.buscaavancada': 'tool:advanced_search',
    'ferramenta.buscatipo': 'tool:search_by_type',
    'ferramenta.buscaarea': 'tool:search_area_addresses',
    'ferramenta.medir': 'tool:measure',
    'ferramenta.imprimir': 'tool:print_a4',
    'ferramenta.camadas': 'tool:layer_panel',
    'ferramenta.raiox': 'tool:raio_x',
    'ferramenta.selecao': 'tool:selected_features',
    'ferramenta.especificacoes': 'tool:feature_specs',
    'ferramenta.fontes': 'tool:sources_footer',
    'ferramenta.ativas': 'tool:search_active_layers_only',
    'ferramenta.dissolver': 'tool:dissolve_features',
    'ferramenta.multiselecao': 'tool:multi_select',
    'ferramenta.personalizarinfo': 'tool:customize_useful_info',
    'ferramenta.mapabase': 'tool:basemap_selector',
    'ferramenta.legenda': 'tool:map_legend',
    'exportar.csv': 'data:export:csv',
    'exportar.kml': 'data:export:kml',
    'exportar.kmz': 'data:export:kmz',
    'exportar.geojson': 'data:export:geojson',
    'exportar.shapefile': 'data:export:shapefile',
    'exportar.geopackage': 'data:export:geopackage',
    'exportar.dados': 'tool:export_data',
    'admin.painel': 'admin:panel:access',
    'admin.usuarios.ver': 'admin:users:view',
    'admin.usuarios.criar': 'admin:users:create',
    'admin.usuarios.redefinirsenha': 'admin:users:reset_password',
    'admin.usuarios.bloquear': 'admin:users:block',
    'admin.usuarios.excluir': 'admin:users:delete',
    'admin.usuarios.promover': 'admin:users:promote_manager',
    'admin.papeis': 'admin:roles:manage',
    'admin.configuracoes': 'admin:global_settings:manage',
    'admin.logs': 'admin:logs:view',
    'admin.logs.exportar': 'admin:logs:export',
    'admin.logs.limpar': 'admin:logs:clear',
    'admin.simular': 'admin:simulate:profile',
    'conta.autocadastro': 'account:self_register',
    'conta.trocarsenha': 'account:change_own_password',
    'conta.perfil': 'account:edit_own_profile'
  };
  const lower = key.toLowerCase();
  if (dotMap[lower]) return dotMap[lower];

  // 3. Prefixos inteligentes: camada.X -> layer:X
  if (lower.startsWith('camada.')) {
    return 'layer:' + key.slice(7);
  }

  return key;
};

export interface FeatureAccessStateParams {
  currentActiveUser?: RegisteredUser | null;
  userRole?: UserRole;
  isMaster?: boolean;
  isManager?: boolean;
  featurePermissions?: FeaturePermissions;
  layerPermissions?: Record<string, boolean>;
  addressColumnsPermissions?: Record<string, boolean>;
  featurePropertiesPermissions?: Record<string, boolean>;
  showToast?: (message: string) => void;
}

export interface FeatureAccessProviderProps extends FeatureAccessStateParams {
  value?: AccessContextType;
  children: React.ReactNode;
}

export const useFeatureAccessState = ({
  currentActiveUser = null,
  userRole = 'visitor',
  isMaster = false,
  isManager = false,
  featurePermissions = {} as FeaturePermissions,
  layerPermissions = {},
  addressColumnsPermissions = {},
  featurePropertiesPermissions = {},
  showToast
}: FeatureAccessStateParams = {}): AccessContextType => {
  const isSiteAccount = userRole === 'site_account';
  const isVisitor = userRole === 'visitor' || (!currentActiveUser && !isMaster && !isManager);

  // Mapa de capacidades efetivas (carregado via Supabase ou cache offline)
  const [capabilities, setCapabilities] = useState<Record<string, EffectiveCapability>>(() => {
    return buildFallbackCapabilitiesMap(currentActiveUser?.id);
  });

  const activeUserId = currentActiveUser?.id;

  const refreshAccess = useCallback(async () => {
    const fresh = await fetchEffectiveCapabilitiesAsync(activeUserId);
    setCapabilities(fresh);
  }, [activeUserId]);

  // Carregar capacidades ao montar o componente ou alterar o usuário autenticado
  useEffect(() => {
    refreshAccess();
  }, [refreshAccess]);

  // Ouvir eventos globais de atualização de permissões disparados pelo AdminPanel ou outras abas
  useEffect(() => {
    const handlePermissionsUpdated = () => {
      resetRpcCapabilitiesCheck();
      refreshAccess();
    };
    window.addEventListener('webgis_permissions_updated', handlePermissionsUpdated);
    return () => {
      window.removeEventListener('webgis_permissions_updated', handlePermissionsUpdated);
    };
  }, [refreshAccess]);

  // Avaliação central de USO (can)
  const can = useCallback((rawKey: string): boolean => {
    // 1. O Administrador Master tem controle total e irrestrito
    if (isMaster) return true;

    const canonicalKey = normalizeCapabilityKey(rawKey);
    const capEntry = capabilities[canonicalKey];

    // 2. Override individual explícito por usuário sempre prevalece
    if (capEntry?.source === 'custom' || capEntry?.source === 'user') {
      return capEntry.can_use;
    }

    // 3. Bloqueios globais definidos pelo Master em webgis_settings prevalecem sobre o padrão do papel
    const mappedLegacyTool = CANONICAL_TO_LEGACY_TOOL_MAP[canonicalKey];
    if (mappedLegacyTool && featurePermissions[mappedLegacyTool] === false) {
      return false;
    }
    if (
      canonicalKey === 'tool:advanced_search' &&
      featurePermissions.allowCnefeSearch === false
    ) {
      return false;
    }
    if (canonicalKey.startsWith('layer:')) {
      const layerName = canonicalKey.slice(6);
      if (layerPermissions[layerName] === false) return false;
    }
    if (canonicalKey.startsWith('data:address_col:')) {
      const col = canonicalKey.slice(17);
      if (addressColumnsPermissions[col] === false) return false;
    }
    if (canonicalKey.startsWith('data:prop:')) {
      const prop = canonicalKey.slice(10);
      if (featurePropertiesPermissions[prop] === false) return false;
    }

    // 4. Se a capacidade foi resolvida no mapa efetivo do banco/cache
    if (capEntry !== undefined) {
      return capEntry.can_use;
    }

    // Caso especial para busca avançada: se não estiver explicitamente mapeada, herda da busca cnefe
    if (canonicalKey === 'tool:advanced_search') {
      if (capabilities['tool:cnefe_search'] !== undefined) {
        return capabilities['tool:cnefe_search'].can_use;
      }
      if (featurePermissions.allowCnefeSearch !== undefined) {
        return featurePermissions.allowCnefeSearch !== false;
      }
      return true;
    }

    // 3. Fallbacks de compatibilidade com valores legados
    if (canonicalKey.startsWith('tool:') || rawKey.startsWith('allow')) {
      const legacyKey = rawKey as keyof FeaturePermissions;
      if (featurePermissions[legacyKey] !== undefined) {
        return featurePermissions[legacyKey] !== false;
      }
    }

    if (canonicalKey.startsWith('layer:')) {
      const layerName = canonicalKey.slice(6);
      if (layerPermissions[layerName] !== undefined) {
        return layerPermissions[layerName] !== false;
      }
      return true;
    }

    if (canonicalKey.startsWith('data:address_col:')) {
      const col = canonicalKey.slice(17);
      if (addressColumnsPermissions[col] !== undefined) {
        return addressColumnsPermissions[col] !== false;
      }
      return true;
    }

    if (canonicalKey.startsWith('data:prop:')) {
      const prop = canonicalKey.slice(10);
      if (featurePropertiesPermissions[prop] !== undefined) {
        return featurePropertiesPermissions[prop] !== false;
      }
      return true;
    }

    if (canonicalKey.startsWith('admin:')) {
      return isMaster || isManager;
    }

    return false;
  }, [isMaster, isManager, capabilities, featurePermissions, layerPermissions, addressColumnsPermissions, featurePropertiesPermissions]);

  // Avaliação central de REPASSE / DELEGAÇÃO (canGrant)
  const canGrant = useCallback((rawKey: string): boolean => {
    if (isMaster) return true;
    const canonicalKey = normalizeCapabilityKey(rawKey);

    if (capabilities[canonicalKey] !== undefined) {
      return capabilities[canonicalKey].can_grant;
    }

    return false;
  }, [isMaster, capabilities]);

  // Formatos de exportação por poder
  const canExport = useCallback((format?: string): boolean => {
    if (isMaster) return true;
    if (!can('tool:export_data') && !can('allowExportData')) return false;
    if (!format) return true;

    const fmt = format.toLowerCase().trim();
    if (fmt === 'csv') return can('data:export:csv') || can('allowExportCsv');
    if (fmt === 'kml') return can('data:export:kml') || can('allowExportKml');
    if (fmt === 'kmz') return can('data:export:kmz') || can('allowExportKmz');
    if (fmt === 'geojson') return can('data:export:geojson') || can('allowExportGeoJson');
    if (fmt === 'shapefile' || fmt === 'shp') return can('data:export:shapefile') || can('allowExportShapefile');
    if (fmt === 'gpkg' || fmt === 'geopackage') return can('data:export:geopackage') || can('allowExportGeoPackage');

    return true;
  }, [isMaster, can]);

  // Visibilidade de camadas
  const canViewLayer = useCallback((layerName: string): boolean => {
    if (isMaster) return true;
    return can(`layer:${layerName}`);
  }, [isMaster, can]);

  // Visibilidade de colunas CNEFE
  const canViewAddressColumn = useCallback((columnKey: string): boolean => {
    if (isMaster) return true;
    return can(`data:address_col:${columnKey}`);
  }, [isMaster, can]);

  // Visibilidade de propriedades de feições
  const canViewFeatureProperty = useCallback((propertyKey: string): boolean => {
    if (isMaster) return true;
    return can(`data:prop:${propertyKey}`);
  }, [isMaster, can]);

  // Limites numéricos por poder (linhas exportadas e resultados de consulta)
  const getNumericLimit = useCallback((key: string, defaultValue?: number): number => {
    if (isMaster || can('data:limit:unlimited_rows')) {
      return Infinity;
    }

    if (key === 'export_rows') {
      if (isManager) return 100000;
      if (userRole === 'user') return 50000;
      if (isSiteAccount) return 10000;
      if (isVisitor) return 1000;
      return defaultValue || 10000;
    }

    if (key === 'query_results') {
      if (isManager || userRole === 'user') return 50000;
      if (isSiteAccount) return 20000;
      if (isVisitor) return 5000;
      return defaultValue || 5000;
    }

    return defaultValue || 5000;
  }, [isMaster, isManager, isSiteAccount, isVisitor, userRole, can]);

  // Guarda de ação com log automático de bloqueio e aviso amigável
  const guardAction = useCallback((capabilityKey: string, actionName: string, action: () => void): boolean => {
    if (can(capabilityKey)) {
      action();
      return true;
    }

    const canonical = normalizeCapabilityKey(capabilityKey);
    console.warn(`[PERMISSIONS BLOCKED] Tentativa de acesso bloqueada: "${actionName}". Poder necessário ausente: "${canonical}" (papel: ${userRole})`);

    logActivity(
      'ADMIN',
      `Tentativa de acesso bloqueada por permissão: "${actionName}"`,
      userRole,
      `Poder necessário ausente: ${canonical}`
    );

    if (showToast) {
      showToast(`⚠️ Acesso restrito: Você não possui permissão para ${actionName}.`);
    }
    return false;
  }, [can, userRole, showToast]);

  return useMemo<AccessContextType>(() => ({
    can,
    canGrant,
    canExport,
    canViewLayer,
    canViewAddressColumn,
    canViewFeatureProperty,
    getNumericLimit,
    guardAction,
    userRole,
    isMaster,
    isManager,
    isSiteAccount,
    isVisitor,
    effectiveCapabilities: capabilities,
    refreshAccess,
    featurePermissions,
    layerPermissions,
    addressColumnsPermissions,
    featurePropertiesPermissions
  }), [
    can,
    canGrant,
    canExport,
    canViewLayer,
    canViewAddressColumn,
    canViewFeatureProperty,
    getNumericLimit,
    guardAction,
    userRole,
    isMaster,
    isManager,
    isSiteAccount,
    isVisitor,
    capabilities,
    refreshAccess,
    featurePermissions,
    layerPermissions,
    addressColumnsPermissions,
    featurePropertiesPermissions
  ]);
};

export const FeatureAccessProvider: React.FC<FeatureAccessProviderProps> = ({
  value: explicitValue,
  children,
  ...props
}) => {
  const localValue = useFeatureAccessState(explicitValue ? undefined : props);
  const value = explicitValue || localValue;

  return (
    <AccessContext.Provider value={value}>
      {children}
    </AccessContext.Provider>
  );
};

const FALLBACK_ACCESS: AccessContextType = {
  can: () => true,
  canGrant: () => true,
  canExport: () => true,
  canViewLayer: () => true,
  canViewAddressColumn: () => true,
  canViewFeatureProperty: () => true,
  getNumericLimit: () => Infinity,
  guardAction: (_k, _name, action) => { action(); return true; },
  userRole: 'master',
  isMaster: true,
  isManager: false,
  isSiteAccount: false,
  isVisitor: false,
  effectiveCapabilities: {},
  refreshAccess: async () => {},
  featurePermissions: {} as FeaturePermissions,
  layerPermissions: {},
  addressColumnsPermissions: {},
  featurePropertiesPermissions: {}
};

// Hook principal recomendado para toda a aplicação
export const useAccess = (params?: FeatureAccessStateParams): AccessContextType => {
  const ctx = useContext(AccessContext);
  const localValue = useFeatureAccessState(params || {});
  if (ctx) return ctx;
  if (params && (params.userRole || params.isMaster !== undefined || params.currentActiveUser !== undefined)) {
    return localValue;
  }
  return FALLBACK_ACCESS;
};

// Alias de retrocompatibilidade com componentes existentes
export const useFeatureAccess = useAccess;
export const AccessProvider = FeatureAccessProvider;
