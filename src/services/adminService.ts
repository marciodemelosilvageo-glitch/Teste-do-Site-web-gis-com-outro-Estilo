import { supabase } from '../supabaseClient';

export type UserRole = 'master' | 'manager' | 'user' | 'admin';

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
  password?: string;   // Senha atribuída ao visitante (se houver)
  hasCustomPermissions?: boolean;
  customLayerPermissions?: Record<string, boolean>; // Se definido, sobrepõe o global
  customFeaturePermissions?: FeaturePermissions;    // Se definido, sobrepõe o global
  customAddressColumnsPermissions?: Record<string, boolean>;
  customFeaturePropertiesPermissions?: Record<string, boolean>;
}

export interface ManagerPermissions {
  allowGenerateLogins?: boolean;       // Permitir gerar novos logins de usuários (padrão: true)
  canCreateManagerRole?: boolean;      // Se true: pode criar Gerentes além de Usuários Comuns (padrão: false)
  allowChangePasswords?: boolean;      // Permitir trocar senhas de usuários (padrão: false)
  allowManageGlobalLayers?: boolean;   // Permitir ativar/desativar camadas globais (padrão: false)
  allowViewAllVisitors?: boolean;      // Permitir visualizar monitoramento de todos os visitantes do site (padrão: false)
}

export interface RegisteredUser {
  id: string;
  username: string; // Login de acesso único (ex: 'joao.silva')
  password: string; // Senha de acesso
  name: string;     // Nome completo ou identificação (ex: 'João da Silva')
  role: 'master' | 'manager' | 'user'; // Cargo na hierarquia
  department?: string; // Cargo, setor ou secretaria
  createdAt: string;
  createdBy?: string; // Identificador de quem cadastrou (Master ou Gerente)
  lastLogin?: string;
  isActive: boolean;
  hasCustomPermissions: boolean;
  managerPermissions?: ManagerPermissions;
  customLayerPermissions?: Record<string, boolean>;
  customFeaturePermissions?: FeaturePermissions;
  customAddressColumnsPermissions?: Record<string, boolean>;
  customFeaturePropertiesPermissions?: Record<string, boolean>;
}

const STORAGE_KEYS = {
  ROLE: 'webgis_current_role',
  ADMIN_PASSWORD: 'webgis_admin_password',
  LAYER_PERMISSIONS: 'webgis_layer_permissions',
  FEATURE_PERMISSIONS: 'webgis_feature_permissions',
  ADDRESS_COLUMNS_PERMISSIONS: 'webgis_address_columns_permissions',
  FEATURE_PROPERTIES_PERMISSIONS: 'webgis_feature_properties_permissions',
  ACTIVITY_LOGS: 'webgis_activity_logs',
  SESSION_ID: 'webgis_session_id',
  USER_SESSIONS: 'webgis_user_sessions_v1',
  REGISTERED_USERS: 'webgis_registered_users_v1',
  CURRENT_ACTIVE_USER: 'webgis_current_active_user_v1',
};

// Notificar componentes sobre mudanças de permissões
export const notifyPermissionsUpdated = () => {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('webgis_permissions_updated'));
  }
};

// Sincronização em segundo plano com o Supabase
let isInitialized = false;

export const initAdminService = async (forceRefresh = false) => {
  if (typeof window === 'undefined') return;
  if (isInitialized && !forceRefresh) return;
  isInitialized = true;

  try {
    // 1. Carregar Configurações Globais do Supabase
    const { data: settingsData, error: settingsError } = await supabase
      .from('webgis_settings')
      .select('*')
      .eq('id', 'global')
      .maybeSingle();

    if (settingsError && settingsError.code === 'PGRST205') {
      if (!(window as any).__webgis_schema_warned) {
        (window as any).__webgis_schema_warned = true;
        console.info('ℹ️ WebGIS: Tabelas do Supabase não encontradas. O sistema está utilizando armazenamento local (localStorage). Para ativar a sincronização em nuvem, execute o script supabase_schema.sql no painel do Supabase.');
      }
      return;
    }

    let hasChanged = false;

    if (settingsData && !settingsError) {
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
      if (settingsData.admin_password) {
        if (localStorage.getItem(STORAGE_KEYS.ADMIN_PASSWORD) !== settingsData.admin_password) {
          localStorage.setItem(STORAGE_KEYS.ADMIN_PASSWORD, settingsData.admin_password);
          hasChanged = true;
        }
      }
    } else if (!settingsData && !settingsError) {
      // Cria a linha inicial no Supabase se não existir
      await syncAllSettingsToSupabase();
    }

    // 2. Carregar Usuários Cadastrados do Supabase
    const { data: regUsersData, error: regUsersError } = await supabase
      .from('webgis_settings')
      .select('*')
      .eq('id', 'registered_users')
      .maybeSingle();

    if (regUsersData && !regUsersError) {
      const usersList = regUsersData.feature_permissions || (regUsersData as any).data;
      if (Array.isArray(usersList) && usersList.length > 0) {
        const next = JSON.stringify(usersList);
        if (localStorage.getItem(STORAGE_KEYS.REGISTERED_USERS) !== next) {
          localStorage.setItem(STORAGE_KEYS.REGISTERED_USERS, next);
          hasChanged = true;
        }
      }
    } else if (!regUsersData && !regUsersError) {
      const defaultMaster: RegisteredUser = {
        id: 'master-supremo-001',
        name: 'Master',
        username: 'macim',
        password: '1234',
        isActive: true,
        role: 'master',
        createdAt: new Date().toISOString(),
        hasCustomPermissions: true
      };
      await syncRegisteredUsersToSupabase([defaultMaster]);
      localStorage.setItem(STORAGE_KEYS.REGISTERED_USERS, JSON.stringify([defaultMaster]));
      hasChanged = true;
    }

    // 3. Carregar Sessões de Usuários do Supabase
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

    if (hasChanged) {
      notifyPermissionsUpdated();
    }

    // 4. Polling periódico inteligente de sincronização (apenas quando a aba está ativa)
    if (!(window as any).__webgis_sync_interval_set) {
      (window as any).__webgis_sync_interval_set = true;
      
      setInterval(() => {
        if (typeof document !== 'undefined' && !document.hidden) {
          initAdminService(true).catch(() => {});
        }
      }, 10000);

      // Sincroniza imediatamente sempre que o usuário volta/foca na aba
      window.addEventListener('focus', () => {
        initAdminService(true).catch(() => {});
      });
      document.addEventListener('visibilitychange', () => {
        if (!document.hidden) {
          initAdminService(true).catch(() => {});
        }
      });
    }

  } catch (err) {
    console.warn('Conexão inicial com Supabase fallback para localStorage:', err);
  }
};

// Sincronizar todas as configurações para a nuvem
export const syncAllSettingsToSupabase = async (): Promise<{ success: boolean; error?: string }> => {
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
export const sortUsersMostRecentFirst = (users: RegisteredUser[]): RegisteredUser[] => {
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

// SEMPRE busca a lista MAIS RECENTE do Supabase (ignora cache local)
export const getRegisteredUsersAsync = async (): Promise<RegisteredUser[]> => {
  try {
    const { data, error } = await supabase
      .from('webgis_settings')
      .select('feature_permissions')
      .eq('id', 'registered_users')
      .maybeSingle();

    if (!error && data && Array.isArray(data.feature_permissions) && data.feature_permissions.length > 0) {
      const usersList: RegisteredUser[] = data.feature_permissions.map((u: any) => ({
        ...u,
        role: (u.role === 'admin' ? 'master' : (u.role || 'user'))
      }));
      const sorted = sortUsersMostRecentFirst(usersList);
      // Atualiza o cache local com os dados frescos do servidor
      localStorage.setItem(STORAGE_KEYS.REGISTERED_USERS, JSON.stringify(sorted));
      return sorted;
    }
  } catch (e) {
    console.warn('getRegisteredUsersAsync: falha ao buscar do Supabase, usando cache local:', e);
  }
  // Fallback para cache local
  return getRegisteredUsers();
};

// Sincronizar usuários cadastrados diretamente com o Supabase
export const syncRegisteredUsersToSupabase = async (usersList?: RegisteredUser[]): Promise<{ success: boolean; error?: string }> => {
  try {
    const users = usersList || getRegisteredUsers();
    const { error } = await supabase.from('webgis_settings').upsert({
      id: 'registered_users',
      feature_permissions: users,
      updated_at: new Date().toISOString()
    });

    if (error) {
      console.error('Erro ao salvar usuários cadastrados no Supabase:', error);
      return { success: false, error: error.message };
    }
    return { success: true };
  } catch (e: any) {
    console.warn('Erro ao salvar usuários cadastrados no Supabase:', e);
    return { success: false, error: e?.message || 'Falha de conexão com Supabase' };
  }
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

// Salvar ou Atualizar Usuário Cadastrado (Direto no Supabase)
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

  // Verificação estrita: Não permitir criar mais de uma conta com o mesmo nome de usuário
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

  const existingIndex = userData.id ? currentUsers.findIndex(u => u.id === userData.id) : -1;

  const requesterRole = typeof requester === 'string' ? requester : (requester?.role || 'master');
  const requesterName = typeof requester === 'string' ? requester : (requester?.username || 'Master');
  const isManager = requesterRole === 'manager';
  const managerObj = isManager ? currentUsers.find(u => u.username.toLowerCase() === requesterName.toLowerCase()) : null;

  // Validação para Gerentes:
  if (isManager) {
    // Se for criar novo usuário, verifica se o Master permitiu gerar logins
    if (!userData.id) {
      if (managerObj?.managerPermissions?.allowGenerateLogins === false) {
        return { success: false, users: currentUsers, error: 'O Administrador Master não liberou permissão para você gerar novos logins.' };
      }
    }

    // Gerente não pode editar usuários de outros criadores ou usuários que não sejam comuns
    if (userData.id && existingIndex >= 0) {
      const targetUser = currentUsers[existingIndex];
      if (targetUser.createdBy !== requesterName || targetUser.role !== 'user') {
        return { success: false, users: currentUsers, error: 'Gerentes só podem gerenciar usuários comuns criados por eles mesmos.' };
      }
    }
  }

  let updatedUsers: RegisteredUser[];

  const isMasterRequester = requesterRole === 'master' || requesterRole === 'admin' || !requester;
  const canCreateManager = isMasterRequester || (isManager && managerObj?.managerPermissions?.canCreateManagerRole === true);

  if (userData.id && existingIndex >= 0) {
    // Atualiza usuário existente
    const existing = currentUsers[existingIndex];
    const requestedRole = userData.role || existing.role || 'user';
    const targetRole = (requestedRole === 'manager' && canCreateManager)
      ? 'manager'
      : (requestedRole === 'master' && isMasterRequester ? 'master' : 'user');

    // Se for gerente editando, preserva a senha existente (gerente não pode trocar senha nesta tela)
    const finalPassword = isManager ? existing.password : (userData.password ? userData.password.trim() : existing.password);

    const updatedUser: RegisteredUser = {
      ...existing,
      ...userData,
      username: usernameClean,
      name: nameClean,
      role: targetRole,
      password: finalPassword,
      managerPermissions: (targetRole === 'manager' || existing.role === 'manager')
        ? (userData.managerPermissions || existing.managerPermissions || { allowGenerateLogins: true, canCreateManagerRole: false, allowChangePasswords: false, allowManageGlobalLayers: false })
        : undefined,
    };
    updatedUsers = [...currentUsers];
    updatedUsers[existingIndex] = updatedUser;
    logActivity('ADMIN', `${isManager ? `👔 Gerente @${requesterName}` : '👑 Master'} atualizou o usuário "${nameClean}" (@${usernameClean})`, isManager ? 'manager' : 'admin');
  } else {
    // Cria novo usuário
    if (!userData.password || userData.password.trim().length < 4) {
      return { success: false, users: currentUsers, error: 'A senha deve ter no mínimo 4 caracteres.' };
    }

    const requestedRole = userData.role || 'user';
    const assignedRole = (requestedRole === 'manager' && canCreateManager)
      ? 'manager'
      : (requestedRole === 'master' && isMasterRequester ? 'master' : 'user');

    const isSelfRegistration = userData.createdBy === 'Criada pelo Usuário (Site)' || userData.createdBy === 'auto_site';
    const creatorIdentifier = isSelfRegistration
      ? 'Criada pelo Usuário (Site)'
      : (requesterName ? (requesterName.startsWith('@') || requesterName.toLowerCase() === 'master' ? requesterName : `@${requesterName}`) : 'Master');

    const newUser: RegisteredUser = {
      id: 'usr_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      username: usernameClean,
      password: userData.password.trim(),
      name: nameClean,
      role: assignedRole,
      department: userData.department?.trim() || (isSelfRegistration ? 'Cadastrado pelo Usuário (Site)' : ''),
      createdAt: new Date().toISOString(),
      createdBy: creatorIdentifier,
      isActive: userData.isActive !== undefined ? userData.isActive : true,
      hasCustomPermissions: !!userData.hasCustomPermissions,
      managerPermissions: assignedRole === 'manager'
        ? (userData.managerPermissions || { allowGenerateLogins: true, canCreateManagerRole: false, allowChangePasswords: false, allowManageGlobalLayers: false })
        : undefined,
      customLayerPermissions: userData.customLayerPermissions,
      customFeaturePermissions: userData.customFeaturePermissions,
      customAddressColumnsPermissions: userData.customAddressColumnsPermissions,
      customFeaturePropertiesPermissions: userData.customFeaturePropertiesPermissions,
    };
    updatedUsers = [newUser, ...currentUsers];
    logActivity('ADMIN', `${isManager ? `👔 Gerente @${requesterName}` : '👑 Master'} criou o usuário ${assignedRole === 'manager' ? '👔 GERENTE' : '👤 USUÁRIO'}: "${nameClean}" (@${usernameClean})`, isManager ? 'manager' : 'admin');
  }

  localStorage.setItem(STORAGE_KEYS.REGISTERED_USERS, JSON.stringify(updatedUsers));
  const syncRes = await syncRegisteredUsersToSupabase(updatedUsers);
  notifyPermissionsUpdated();
  
  if (!syncRes.success) {
    console.warn('Aviso: salvo localmente mas falhou no Supabase:', syncRes.error);
  }

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

  const updated = currentUsers.map(u => {
    if (u.id === userId) {
      return {
        ...u,
        role: 'manager' as const,
        managerPermissions: {
          allowGenerateLogins: true,
          allowChangePasswords: false,
          allowManageGlobalLayers: false
        }
      };
    }
    return u;
  });

  localStorage.setItem(STORAGE_KEYS.REGISTERED_USERS, JSON.stringify(updated));
  await syncRegisteredUsersToSupabase(updated);
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

  const updated = currentUsers.map(u => {
    if (u.id === userId) {
      return {
        ...u,
        role: 'user' as const,
        managerPermissions: undefined
      };
    }
    return u;
  });

  localStorage.setItem(STORAGE_KEYS.REGISTERED_USERS, JSON.stringify(updated));
  await syncRegisteredUsersToSupabase(updated);
  logActivity('ADMIN', `👑 Administrador Master rebaixou o gerente "${user.name}" (@${user.username}) para USUÁRIO COMUM 👤`, 'admin');
  notifyPermissionsUpdated();
  return { success: true, users: updated };
};

// Alterar Senha de Usuário Cadastrado (Master ou Gerente com permissão)
export const changeUserPassword = async (
  userId: string,
  newPasswordClean: string,
  requester?: { username?: string; role?: UserRole } | null | 'master'
): Promise<{ success: boolean; users: RegisteredUser[]; error?: string; syncedToServer?: boolean; syncError?: string }> => {
  if (typeof window === 'undefined') return { success: false, users: [] };
  if (!newPasswordClean || newPasswordClean.trim().length < 4) {
    return { success: false, users: getRegisteredUsers(), error: 'A nova senha deve ter no mínimo 4 caracteres.' };
  }

  const requesterRole = typeof requester === 'string' ? requester : (requester?.role || 'master');
  const requesterName = typeof requester === 'string' ? requester : (requester?.username || 'Master');
  const isManager = requesterRole === 'manager';

  // SEMPRE busca a lista mais recente do Supabase para não sobrescrever dados de outros dispositivos
  const currentUsers = await getRegisteredUsersAsync();
  const user = currentUsers.find(u => u.id === userId);
  if (!user) {
    return { success: false, users: currentUsers, error: 'Usuário não encontrado.' };
  }

  // Se for gerente, verifica se tem permissão concedida pelo Master
  if (isManager) {
    const managerObj = currentUsers.find(u => u.username.toLowerCase() === requesterName.toLowerCase());
    if (!managerObj?.managerPermissions?.allowChangePasswords) {
      return { success: false, users: currentUsers, error: 'Você não possui autorização do Administrador Master para alterar senhas.' };
    }
    if (user.createdBy !== requesterName || user.role !== 'user') {
      return { success: false, users: currentUsers, error: 'Gerentes só podem alterar senhas de usuários comuns criados por eles mesmos.' };
    }
  }

  const updatedUsers = currentUsers.map(u => {
    if (u.id === userId) {
      return { ...u, password: newPasswordClean.trim() };
    }
    return u;
  });

  localStorage.setItem(STORAGE_KEYS.REGISTERED_USERS, JSON.stringify(updatedUsers));
  
  // Primeira tentativa de sync
  let syncRes = await syncRegisteredUsersToSupabase(updatedUsers);
  
  // Se falhou, tenta mais uma vez após 2 segundos
  if (!syncRes.success) {
    console.warn('Primeira tentativa de sync falhou, tentando novamente em 2s...');
    await new Promise(r => setTimeout(r, 2000));
    syncRes = await syncRegisteredUsersToSupabase(updatedUsers);
  }

  notifyPermissionsUpdated();
  logActivity('ADMIN', `👑 Master alterou a senha do usuário "${user.name}" (@${user.username})`, 'admin');
  
  if (!syncRes.success) {
    console.error('CRÍTICO: senha atualizada localmente mas FALHOU no Supabase após 2 tentativas:', syncRes.error);
    return { success: true, users: updatedUsers, syncedToServer: false, syncError: syncRes.error };
  }

  return { success: true, users: updatedUsers, syncedToServer: true };
};

// Excluir Usuário Cadastrado
export const deleteRegisteredUser = async (
  userId: string,
  requester?: { username?: string; role?: UserRole } | null | 'master'
): Promise<{ success: boolean; users: RegisteredUser[]; error?: string }> => {
  if (typeof window === 'undefined') return { success: false, users: [] };
  const requesterRole = typeof requester === 'string' ? requester : (requester?.role || 'master');
  const requesterName = typeof requester === 'string' ? requester : (requester?.username || 'Master');
  const isManager = requesterRole === 'manager';

  const currentUsers = await getRegisteredUsersAsync();
  const user = currentUsers.find(u => u.id === userId);
  if (!user) return { success: false, users: currentUsers, error: 'Usuário não encontrado.' };

  if (isManager && (user.createdBy !== requesterName || user.role !== 'user')) {
    return { success: false, users: currentUsers, error: 'Gerentes só podem excluir usuários comuns criados por eles mesmos.' };
  }

  const updated = currentUsers.filter(u => u.id !== userId);
  localStorage.setItem(STORAGE_KEYS.REGISTERED_USERS, JSON.stringify(updated));
  await syncRegisteredUsersToSupabase(updated);
  if (user) {
    logActivity('ADMIN', `${isManager ? `👔 Gerente @${requesterName}` : '👑 Master'} excluiu o login do usuário "${user.name}" (@${user.username})`, isManager ? 'user' : 'admin');
  }
  notifyPermissionsUpdated();
  return { success: true, users: updated };
};

// Alternar Status Ativo / Bloqueado de um Usuário
export const toggleRegisteredUserStatus = async (
  userId: string,
  requester?: { username?: string; role?: UserRole } | null | 'master'
): Promise<{ success: boolean; users: RegisteredUser[]; error?: string }> => {
  if (typeof window === 'undefined') return { success: false, users: [] };
  const requesterRole = typeof requester === 'string' ? requester : (requester?.role || 'master');
  const requesterName = typeof requester === 'string' ? requester : (requester?.username || 'Master');
  const isManager = requesterRole === 'manager';

  const currentUsers = await getRegisteredUsersAsync();
  const user = currentUsers.find(u => u.id === userId);
  if (!user) return { success: false, users: currentUsers, error: 'Usuário não encontrado.' };

  if (isManager && (user.createdBy !== requesterName || user.role !== 'user')) {
    return { success: false, users: currentUsers, error: 'Gerentes só podem bloquear ou desbloquear usuários comuns criados por eles mesmos.' };
  }

  const updated = currentUsers.map(u => {
    if (u.id === userId) {
      const nextActive = !u.isActive;
      logActivity('ADMIN', `${isManager ? `👔 Gerente @${requesterName}` : '👑 Master'} ${nextActive ? 'desbloqueou' : 'bloqueou'} o usuário "${u.name}" (@${u.username})`, isManager ? 'user' : 'admin');
      return { ...u, isActive: nextActive };
    }
    return u;
  });
  localStorage.setItem(STORAGE_KEYS.REGISTERED_USERS, JSON.stringify(updated));
  await syncRegisteredUsersToSupabase(updated);
  notifyPermissionsUpdated();
  return { success: true, users: updated };
};

// Autenticar Usuário Cadastrado
export const authenticateRegisteredUser = (usernameInput: string, passwordInput: string): { success: boolean; user?: RegisteredUser; message?: string } => {
  const users = getRegisteredUsers();
  const cleanUser = usernameInput.trim().toLowerCase();
  const cleanPass = passwordInput.trim();

  const user = users.find(u => u.username.toLowerCase() === cleanUser);
  if (!user) {
    return { success: false, message: 'Usuário não encontrado. Verifique o login digitado.' };
  }

  if (!user.isActive) {
    return { success: false, message: 'Este usuário está temporariamente bloqueado pelo Administrador.' };
  }

  if (user.password !== cleanPass) {
    logActivity('ACESSO', `Tentativa de login com senha incorreta para o usuário @${cleanUser}`, 'user');
    return { success: false, message: 'Senha incorreta. Tente novamente.' };
  }

  // Atualiza data do último login
  const updated = users.map(u => {
    if (u.id === user.id) {
      return { ...u, lastLogin: new Date().toISOString() };
    }
    return u;
  });
  localStorage.setItem(STORAGE_KEYS.REGISTERED_USERS, JSON.stringify(updated));
  syncRegisteredUsersToSupabase(updated);

  // Registra sessão e salva usuário ativo
  setCurrentActiveUser(user);
  const sId = getSessionId();
  const sessionRole: UserRole = user.role === 'master' ? 'master' : (user.role === 'manager' ? 'manager' : 'user');
  
  if (sessionRole !== 'master') {
    saveUserSessionConfig(sId, {
      customName: `${user.name} (@${user.username})`,
      role: sessionRole,
      hasCustomPermissions: user.hasCustomPermissions,
      customLayerPermissions: user.customLayerPermissions,
      customFeaturePermissions: user.customFeaturePermissions,
      customAddressColumnsPermissions: user.customAddressColumnsPermissions,
      customFeaturePropertiesPermissions: user.customFeaturePropertiesPermissions
    });
    logActivity('ACESSO', `Usuário credenciado ${user.role === 'manager' ? '👔 GERENTE' : '👤'} "${user.name}" (@${user.username}) autenticado com sucesso`, sessionRole);
  }

  return { success: true, user };
};

// Autenticar com consulta em tempo real ao Supabase (Sempre consulta a nuvem primeiro)
export const authenticateRegisteredUserAsync = async (
  usernameInput: string,
  passwordInput: string
): Promise<{ success: boolean; user?: RegisteredUser; message?: string }> => {
  const cleanUser = sanitizeUsername(usernameInput);
  const cleanPass = passwordInput.trim();
  const rawUserQuery = (usernameInput || '').trim().toLowerCase();

  // 1. SEMPRE consulta o Supabase PRIMEIRO
  let usersFromSupabase: RegisteredUser[] | null = null;
  try {
    const { data: regUsersData, error } = await supabase
      .from('webgis_settings')
      .select('*')
      .eq('id', 'registered_users')
      .maybeSingle();

    if (regUsersData && !error) {
      const usersList = regUsersData.feature_permissions || (regUsersData as any).data;
      if (Array.isArray(usersList) && usersList.length > 0) {
        usersFromSupabase = usersList.map((u: any) => ({
          ...u,
          role: (u.role === 'admin' ? 'master' : (u.role || 'user'))
        }));
        // Atualiza o cache local com dados frescos do servidor
        localStorage.setItem(STORAGE_KEYS.REGISTERED_USERS, JSON.stringify(usersFromSupabase));
        notifyPermissionsUpdated();
      }
    }
  } catch (e) {
    console.error('[AUTH] Erro ao consultar Supabase:', e);
  }

  // 2. Usa os dados do Supabase diretamente (se disponíveis), senão cai pro localStorage
  const users = usersFromSupabase || getRegisteredUsers();

  // 3. Busca o usuario (por @username, login limpo ou nome completo)
  const user = users.find(u => 
    sanitizeUsername(u.username) === cleanUser ||
    u.username.toLowerCase() === cleanUser ||
    u.username.toLowerCase() === rawUserQuery ||
    u.name.trim().toLowerCase() === rawUserQuery ||
    sanitizeUsername(u.name) === cleanUser
  );
  if (!user) {
    return { success: false, message: 'Usuário não encontrado. Verifique o login digitado.' };
  }

  if (!user.isActive) {
    return { success: false, message: 'Este usuário está temporariamente bloqueado pelo Administrador.' };
  }

  // 4. Compara a senha diretamente dos dados do Supabase
  if (user.password !== cleanPass) {
    logActivity('ACESSO', `Tentativa de login com senha incorreta para o usuário @${cleanUser}`, 'user');
    return { success: false, message: 'Senha incorreta. Tente novamente.' };
  }

  // 5. Atualiza data do último login
  const updated = users.map(u => {
    if (u.id === user.id) {
      return { ...u, lastLogin: new Date().toISOString() };
    }
    return u;
  });
  localStorage.setItem(STORAGE_KEYS.REGISTERED_USERS, JSON.stringify(updated));
  // Fire-and-forget: sincroniza o lastLogin
  syncRegisteredUsersToSupabase(updated).catch(e => console.warn('[AUTH] Falha ao sincronizar lastLogin:', e));

  // 6. Registra sessão e salva usuário ativo
  setCurrentActiveUser(user);
  const sId = getSessionId();
  const sessionRole: UserRole = user.role === 'master' ? 'master' : (user.role === 'manager' ? 'manager' : 'user');
  
  if (sessionRole !== 'master') {
    saveUserSessionConfig(sId, {
      customName: `${user.name} (@${user.username})`,
      role: sessionRole,
      hasCustomPermissions: user.hasCustomPermissions,
      customLayerPermissions: user.customLayerPermissions,
      customFeaturePermissions: user.customFeaturePermissions,
      customAddressColumnsPermissions: user.customAddressColumnsPermissions,
      customFeaturePropertiesPermissions: user.customFeaturePropertiesPermissions
    });
    logActivity('ACESSO', `Usuário credenciado ${user.role === 'manager' ? '👔 GERENTE' : '👤'} "${user.name}" (@${user.username}) autenticado com sucesso`, sessionRole);
  }

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
  } catch (e) {}
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
  } catch (e) {}
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

// Atualizar o próprio perfil de conta do usuário logado (Sincronizado com Supabase)
export const updateSelfAccountProfile = async (
  userId: string,
  updates: {
    name?: string;
    username?: string;
    newPassword?: string;
  }
): Promise<{ success: boolean; user?: RegisteredUser; error?: string }> => {
  if (typeof window === 'undefined') return { success: false, error: 'Ambiente inválido' };

  const currentUsers = await getRegisteredUsersAsync();
  const userIndex = currentUsers.findIndex(u => u.id === userId);
  if (userIndex < 0) {
    return { success: false, error: 'Usuário não encontrado no banco de dados.' };
  }

  const existingUser = currentUsers[userIndex];

  let newName = updates.name !== undefined ? updates.name.trim() : existingUser.name;
  if (!newName) {
    return { success: false, error: 'O nome não pode ficar em branco.' };
  }

  let newUsername = updates.username !== undefined ? sanitizeUsername(updates.username) : sanitizeUsername(existingUser.username);
  if (!newUsername || newUsername.length < 3) {
    return { success: false, error: 'O nome de usuário deve ter pelo menos 3 caracteres.' };
  }

  // Verifica se o novo username já está em uso por outro usuário
  if (newUsername !== sanitizeUsername(existingUser.username)) {
    const isTaken = currentUsers.some(u => u.id !== userId && sanitizeUsername(u.username) === newUsername);
    if (isTaken) {
      return { 
        success: false, 
        error: `Não é permitido utilizar um nome de usuário já existente. O login "@${newUsername}" já pertence a outra conta.` 
      };
    }
  }

  let finalPassword = existingUser.password;
  if (updates.newPassword && updates.newPassword.trim()) {
    if (updates.newPassword.trim().length < 4) {
      return { success: false, error: 'A nova senha deve ter no mínimo 4 caracteres.' };
    }
    finalPassword = updates.newPassword.trim();
  }

  const updatedUser: RegisteredUser = {
    ...existingUser,
    name: newName,
    username: newUsername,
    password: finalPassword
  };

  const updatedUsers = [...currentUsers];
  updatedUsers[userIndex] = updatedUser;

  localStorage.setItem(STORAGE_KEYS.REGISTERED_USERS, JSON.stringify(updatedUsers));
  localStorage.setItem(STORAGE_KEYS.CURRENT_ACTIVE_USER, JSON.stringify(updatedUser));

  const syncRes = await syncRegisteredUsersToSupabase(updatedUsers);
  notifyPermissionsUpdated();
  logActivity('ADMIN', `Usuário "${updatedUser.name}" (@${updatedUser.username}) atualizou seu próprio perfil de conta`, updatedUser.role || 'user');

  if (!syncRes.success) {
    console.warn('Aviso: atualizado localmente mas falhou no Supabase:', syncRes.error);
  }

  return { success: true, user: updatedUser };
};

// Registrar visitante como conta oficial cadastrada no WebGis (Sincronizado com Supabase)
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
  if (!passwordClean || passwordClean.length < 4) {
    return { success: false, error: 'A senha deve ter pelo menos 4 caracteres.' };
  }

  const currentUsers = await getRegisteredUsersAsync();
  const duplicateUser = currentUsers.find(u => sanitizeUsername(u.username) === usernameClean);
  if (duplicateUser) {
    return { 
      success: false, 
      error: `Não é permitido criar mais de uma conta com o mesmo nome de usuário. O login "@${usernameClean}" já está cadastrado no sistema pela conta "${duplicateUser.name}". Escolha outro nome de usuário.` 
    };
  }

  const newUserId = `usr-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  const newUser: RegisteredUser = {
    id: newUserId,
    name: nameClean,
    username: usernameClean,
    password: passwordClean,
    isActive: true,
    role: 'user',
    createdAt: new Date().toISOString(),
    createdBy: 'Criada pelo Usuário (Site)',
    lastLogin: new Date().toISOString(),
    hasCustomPermissions: false
  };

  const updatedUsers = [...currentUsers, newUser];
  localStorage.setItem(STORAGE_KEYS.REGISTERED_USERS, JSON.stringify(updatedUsers));
  localStorage.setItem(STORAGE_KEYS.CURRENT_ACTIVE_USER, JSON.stringify(newUser));

  // Sincroniza com Supabase
  await syncRegisteredUsersToSupabase(updatedUsers);

  // Atualiza também a sessão do visitante para vincular seu nome e senha
  saveUserSessionConfig(sessionId, {
    customName: `${nameClean} (@${usernameClean})`,
    password: passwordClean
  });

  notifyPermissionsUpdated();
  logActivity('ACESSO', `Visitante converteu sua sessão em conta cadastrada: "${nameClean}" (@${usernameClean})`, 'user');

  return { success: true, user: newUser };
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
    const { data: sessionsData, error } = await supabase
      .from('webgis_user_sessions')
      .select('*')
      .order('last_seen', { ascending: false });

    if (!error && sessionsData && sessionsData.length > 0) {
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
          loginCount: row.login_count || 1,
          password: row.password || undefined,
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
  } catch (e) {
    console.warn('getUserSessionsAsync: falha ao buscar do Supabase, usando cache local:', e);
  }
  return getUserSessions();
};

// Salvar todas as sessões
export const saveUserSessions = (sessions: Record<string, UserSessionConfig>): void => {
  try {
    localStorage.setItem(STORAGE_KEYS.USER_SESSIONS, JSON.stringify(sessions));
  } catch (e) {
    console.error('Erro ao salvar sessões de usuários:', e);
  }
};

// Helper para serializar e sanitizar os dados da sessão estritamente compatíveis com as colunas do Supabase
export const formatSessionPayloadForSupabase = (session: UserSessionConfig) => ({
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
});

// Salvar ou atualizar senha de um visitante/sessão específico diretamente no Supabase e localStorage
export const saveUserSessionPassword = async (
  sessionId: string,
  newPassword: string
): Promise<{ success: boolean; error?: string }> => {
  if (typeof window === 'undefined' || !sessionId) return { success: false, error: 'Sessão inválida' };
  try {
    const sessions = getUserSessions();
    const existing = sessions[sessionId];
    if (existing) {
      const passClean = newPassword.trim();
      existing.password = passClean || undefined;
      sessions[sessionId] = existing;
      saveUserSessions(sessions);

      const { error } = await supabase
        .from('webgis_user_sessions')
        .upsert(formatSessionPayloadForSupabase(existing));

      logActivity('ADMIN', `Senha da sessão/visitante "${existing.customName || sessionId}" atualizada pelo Administrador Master`, 'admin');
      
      if (error) {
        console.warn('Erro ao salvar senha da sessão no Supabase:', error);
        return { success: false, error: error.message };
      }
      return { success: true };
    }
    return { success: false, error: 'Sessão não encontrada' };
  } catch (e: any) {
    return { success: false, error: e?.message };
  }
};

// Registrar ou atualizar a atividade da sessão atual
export const touchUserSession = (userRole: UserRole = 'user'): UserSessionConfig => {
  const sessionId = getSessionId();
  const now = new Date();
  const iso = now.toISOString();
  const formatted = now.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }) + ' ' +
    now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

  // O acesso do Administrador Master é 100% anônimo: não é registrado como sessão de visitante
  if (userRole === 'master' || (userRole as string) === 'admin') {
    return {
      sessionId,
      role: 'master',
      firstSeen: iso,
      lastSeen: iso,
      formattedFirstSeen: formatted,
      formattedLastSeen: formatted,
      loginCount: 1,
      isBlocked: false,
      hasCustomPermissions: false
    };
  }

  const sessions = getUserSessions();
  const existing = sessions[sessionId];

  const updated: UserSessionConfig = existing ? {
    ...existing,
    lastSeen: iso,
    formattedLastSeen: formatted,
    loginCount: (existing.loginCount || 1) + 1,
    role: userRole
  } : {
    sessionId,
    firstSeen: iso,
    lastSeen: iso,
    formattedFirstSeen: formatted,
    formattedLastSeen: formatted,
    loginCount: 1,
    role: userRole,
    isBlocked: false,
    hasCustomPermissions: false
  };

  sessions[sessionId] = updated;
  saveUserSessions(sessions);
  
  // Enviar para o Supabase de forma segura e assíncrona
  supabase
    .from('webgis_user_sessions')
    .upsert(formatSessionPayloadForSupabase(updated))
    .then();

  return updated;
};

// Atualizar a configuração individual de um usuário específico
export const updateUserSessionConfig = (sessionId: string, config: Partial<UserSessionConfig>): void => {
  const sessions = getUserSessions();
  if (sessions[sessionId]) {
    sessions[sessionId] = { ...sessions[sessionId], ...config };
    saveUserSessions(sessions);
    
    // Salvar na Nuvem Supabase
    const session = sessions[sessionId];
    supabase
      .from('webgis_user_sessions')
      .upsert(formatSessionPayloadForSupabase(session))
      .then();

    logActivity('ADMIN', `Configurações do usuário ${config.customName || sessionId} alteradas`, 'admin');
  }
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
    };

    sessions[sessionId] = {
      ...existing,
      ...updates,
      sessionId
    };

    localStorage.setItem(STORAGE_KEYS.USER_SESSIONS, JSON.stringify(sessions));

    const session = sessions[sessionId];
    supabase
      .from('webgis_user_sessions')
      .upsert(formatSessionPayloadForSupabase(session))
      .then();

  } catch (e) {
    console.error('Erro ao salvar configuração do usuário:', e);
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
export const registerUserSessionActivity = (sessionId: string, role: UserRole = 'user', customName?: string): void => {
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

    const s = sessions[sessionId];
    supabase
      .from('webgis_user_sessions')
      .upsert(formatSessionPayloadForSupabase(s))
      .then();

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

    const newLog: ActivityLog = {
      id: 'log_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
      timestamp: now.toISOString(),
      formattedDate,
      userRole: effectiveRole,
      category,
      action,
      details: enrichedDetails,
      sessionId: activeUser?.username ? `@${activeUser.username}` : sId
    };

    const saved = localStorage.getItem(STORAGE_KEYS.ACTIVITY_LOGS);
    const logs: ActivityLog[] = saved ? JSON.parse(saved) : [];

    // Mantém os últimos 1.000 registros para alta performance e armazenamento limpo
    const updated = [newLog, ...logs].slice(0, 1000);
    localStorage.setItem(STORAGE_KEYS.ACTIVITY_LOGS, JSON.stringify(updated));

    // Gravar no Supabase
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
        sessionId: row.session_id
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

// Exportar Logs para CSV
export const exportActivityLogsToCSV = (): void => {
  const logs = getActivityLogs();
  const sessions = getUserSessions();
  if (logs.length === 0) {
    alert('Nenhum log registrado para exportar.');
    return;
  }

  const headers = ['Data e Hora', 'Usuário / Identificação', 'Perfil de Acesso', 'Categoria', 'Ação', 'Detalhes', 'ID da Sessão'];
  const rows = logs.map(l => {
    const sessionInfo = sessions[l.sessionId];
    const userDisplayName = sessionInfo?.customName
      ? `${sessionInfo.customName} (${l.sessionId})`
      : l.sessionId;

    return [
      `"${l.formattedDate}"`,
      `"${userDisplayName}"`,
      `"${l.userRole === 'admin' ? 'Administrador' : 'Visitante / Comum'}"`,
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

// Inicialização automática do serviço
if (typeof window !== 'undefined') {
  initAdminService();
}
