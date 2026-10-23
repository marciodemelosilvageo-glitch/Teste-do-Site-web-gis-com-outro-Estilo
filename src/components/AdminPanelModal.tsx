import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  ShieldCheck,
  Layers,
  Wrench,
  Activity,
  KeyRound,
  X,
  Check,
  AlertTriangle,
  Download,
  Trash2,
  Search,
  Eye,
  EyeOff,
  Users,
  Sparkles,
  RefreshCw,
  Clock,
  CheckCircle2,
  XCircle,
  FileSpreadsheet,
  User,
  ShieldAlert,
  ArrowLeft,
  Sliders,
  Calendar,
  MousePointerClick,
  Edit2,
  Save,
  Ban,
  Unlock,
  MapPin,
  Ruler,
  Printer,
  UserCheck,
  Shield,
  TableProperties,
  FileText,
  CheckSquare,
  Square,
  BarChart3,
  ListTree,
  FileCode,
  BookOpen,
  Filter,
  UserPlus,
  Key,
  UserCheck2,
  Lock,
  Crown,
  Briefcase,
  ArrowUpCircle,
  ArrowDownCircle,
  UserCog,
  Loader2,
  Plus
} from 'lucide-react';
import {
  FeaturePermissions,
  ManagerPermissions,
  ActivityLog,
  UserSessionConfig,
  RegisteredUser,
  UserRole,
  ALL_ADDRESS_COLUMNS,
  ALL_FEATURE_PROPERTIES,
  getActivityLogs,
  getActivityLogsAsync,
  getUserLogs,
  getUserLogsAsync,
  getUserSessions,
  getUserSessionsAsync,
  saveUserSessionPassword,
  getRegisteredUsers,
  getRegisteredUsersAsync,
  saveRegisteredUser,
  deleteRegisteredUser,
  toggleRegisteredUserStatus,
  promoteUserToManager,
  demoteManagerToUser,
  changeUserPassword,
  saveUserSessionConfig,
  deleteUserSession,
  clearActivityLogs,
  exportActivityLogsToCSV,
  getLayerPermissions,
  saveLayerPermissions,
  getFeaturePermissions,
  saveFeaturePermissions,
  getAddressColumnsPermissions,
  saveAddressColumnsPermissions,
  getFeaturePropertiesPermissions,
  saveFeaturePropertiesPermissions,
  notifyPermissionsUpdated,
  logActivity
} from '../services/adminService';
import { dataSources } from '../data';

interface AdminPanelModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUserRole?: UserRole;
  currentActiveUser?: RegisteredUser | null;
  layerPermissions: Record<string, boolean>;
  onUpdateLayerPermissions: (newPerms: Record<string, boolean>) => void;
  featurePermissions: FeaturePermissions;
  onUpdateFeaturePermissions: (newPerms: FeaturePermissions) => void;
  addressColumnsPermissions?: Record<string, boolean>;
  onUpdateAddressColumnsPermissions?: (newPerms: Record<string, boolean>) => void;
  featurePropertiesPermissions?: Record<string, boolean>;
  onUpdateFeaturePropertiesPermissions?: (newPerms: Record<string, boolean>) => void;
  onSimulateUser?: (sessionId: string, role?: UserRole) => void;
  onOpenSimulationChoice?: () => void;
  showToast: (msg: string) => void;
}

export const AdminPanelModal: React.FC<AdminPanelModalProps> = ({
  isOpen,
  onClose,
  currentUserRole = 'master',
  currentActiveUser = null,
  layerPermissions,
  onUpdateLayerPermissions,
  featurePermissions,
  onUpdateFeaturePermissions,
  addressColumnsPermissions,
  onUpdateAddressColumnsPermissions,
  featurePropertiesPermissions,
  onUpdateFeaturePropertiesPermissions,
  onSimulateUser,
  onOpenSimulationChoice,
  showToast
}) => {
  const isMaster = currentUserRole === 'master' || currentUserRole === 'admin';
  const isManager = currentUserRole === 'manager';

  const [activeTab, setActiveTab] = useState<'users' | 'layers' | 'features' | 'columns' | 'logs'>('users');
  const [userViewMode, setUserViewMode] = useState<'registered' | 'sessions'>('registered');
  const [userRoleFilter, setUserRoleFilter] = useState<'ALL' | 'USER_CREATED' | 'MASTER' | 'MANAGER' | 'USER'>('ALL');

  // Estado local de permissões globais de camadas
  const [localLayerPerms, setLocalLayerPerms] = useState<Record<string, boolean>>(layerPermissions);

  // Estado local de permissões globais de ferramentas
  const [localFeaturePerms, setLocalFeaturePerms] = useState<FeaturePermissions>(featurePermissions);

  // Estados locais de permissões de colunas e propriedades
  const [localAddressColumns, setLocalAddressColumns] = useState<Record<string, boolean>>(() => getAddressColumnsPermissions());
  const [localFeatureProperties, setLocalFeatureProperties] = useState<Record<string, boolean>>(() => getFeaturePropertiesPermissions());

  // Estados de Usuários Cadastrados (Logins Ativos)
  const [registeredUsers, setRegisteredUsers] = useState<RegisteredUser[]>(() => getRegisteredUsers());

  // Busca sempre a versão mais atualizada do usuário logado na lista de registeredUsers
  const activeManagerUser = useMemo(() => {
    if (!currentActiveUser) return null;
    const found = registeredUsers.find(u => 
      u.id === currentActiveUser.id || 
      (u.username && currentActiveUser.username && u.username.toLowerCase() === currentActiveUser.username.toLowerCase())
    );
    return found || currentActiveUser;
  }, [registeredUsers, currentActiveUser]);

  const canManagerGenerateLogins = isMaster || (isManager && activeManagerUser?.managerPermissions?.allowGenerateLogins !== false);
  const canManagerCreateManagerRole = isMaster || (isManager && activeManagerUser?.managerPermissions?.canCreateManagerRole === true);
  const canManagerChangePasswords = isMaster || (isManager && activeManagerUser?.managerPermissions?.allowChangePasswords === true);
  const canManagerManageGlobalLayers = isMaster || (isManager && activeManagerUser?.managerPermissions?.allowManageGlobalLayers === true);
  const canManagerViewAllVisitors = isMaster || (isManager && activeManagerUser?.managerPermissions?.allowViewAllVisitors === true);

  const [registeredSearchTerm, setRegisteredSearchTerm] = useState<string>('');
  const [isUserModalOpen, setIsUserModalOpen] = useState<boolean>(false);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);

  // Campos do formulário de usuário cadastrado
  const [userFormName, setUserFormName] = useState<string>('');
  const [userFormUsername, setUserFormUsername] = useState<string>('');
  const [userFormPassword, setUserFormPassword] = useState<string>('');
  const [userFormRole, setUserFormRole] = useState<'master' | 'manager' | 'user'>('user');
  const [userFormDepartment, setUserFormDepartment] = useState<string>('');
  const [userFormManagerPerms, setUserFormManagerPerms] = useState<ManagerPermissions>({
    allowGenerateLogins: true,
    canCreateManagerRole: false,
    allowChangePasswords: false,
    allowManageGlobalLayers: false,
    allowViewAllVisitors: false
  });
  const [userFormHasCustom, setUserFormHasCustom] = useState<boolean>(false);
  const [userFormLayers, setUserFormLayers] = useState<Record<string, boolean>>({});
  const [userFormFeatures, setUserFormFeatures] = useState<FeaturePermissions>(featurePermissions);
  const [userFormAddressColumns, setUserFormAddressColumns] = useState<Record<string, boolean>>({});
  const [userFormFeatureProperties, setUserFormFeatureProperties] = useState<Record<string, boolean>>({});
  const [userFormError, setUserFormError] = useState<string | null>(null);
  const [showUserFormPass, setShowUserFormPass] = useState<boolean>(false);

  // Modal de Detalhes e Histórico de Atividades de Usuário Cadastrado
  const [selectedUserDetail, setSelectedUserDetail] = useState<RegisteredUser | null>(null);
  const [userDetailTab, setUserDetailTab] = useState<'info' | 'activity' | 'team'>('info');
  const [userDetailLogs, setUserDetailLogs] = useState<ActivityLog[]>([]);
  const [isLoadingUserDetailLogs, setIsLoadingUserDetailLogs] = useState<boolean>(false);

  // Modal de Redefinição Rápida de Senha de Usuário Cadastrado
  const [resetPassUser, setResetPassUser] = useState<RegisteredUser | null>(null);
  const [resetPassInput, setResetPassInput] = useState<string>('');
  const [resetPassError, setResetPassError] = useState<string | null>(null);
  const [showResetPassCurrent, setShowResetPassCurrent] = useState<boolean>(false);
  const [showResetPassNew, setShowResetPassNew] = useState<boolean>(false);

  // Controle de Visualização de Senhas na Lista de Usuários (Apenas Master)
  const [revealedPasswords, setRevealedPasswords] = useState<Record<string, boolean>>({});
  const toggleRevealPassword = (userId: string) => {
    setRevealedPasswords(prev => ({
      ...prev,
      [userId]: !prev[userId]
    }));
  };

  // Estados de Sessões / Visitantes Recentes
  const [userSessions, setUserSessions] = useState<Record<string, UserSessionConfig>>({});
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [userSearchTerm, setUserSearchTerm] = useState<string>('');
  const [userFilterStatus, setUserFilterStatus] = useState<string>('TODOS');

  // Estado de edição da sessão de visitante selecionada
  const [editingUserName, setEditingUserName] = useState<string>('');
  const [userCustomLayers, setUserCustomLayers] = useState<Record<string, boolean>>({});
  const [userCustomFeatures, setUserCustomFeatures] = useState<FeaturePermissions>(featurePermissions);
  const [userCustomAddressColumns, setUserCustomAddressColumns] = useState<Record<string, boolean>>({});
  const [userCustomFeatureProperties, setUserCustomFeatureProperties] = useState<Record<string, boolean>>({});
  const [userIsCustom, setUserIsCustom] = useState<boolean>(false);
  const [userIsBlocked, setUserIsBlocked] = useState<boolean>(false);

  // Estados de Senha e Dossiê do Usuário Selecionado (Exclusivo Master)
  const [selectedUserPasswordInput, setSelectedUserPasswordInput] = useState<string>('');
  const [showSelectedUserPassword, setShowSelectedUserPassword] = useState<boolean>(false);
  const [isUpdatingPassword, setIsUpdatingPassword] = useState<boolean>(false);
  const [selectedUserLiveLogs, setSelectedUserLiveLogs] = useState<ActivityLog[]>([]);
  const [isLoadingUserLogs, setIsLoadingUserLogs] = useState<boolean>(false);

  // Estados de Logs Gerais
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [logSearch, setLogSearch] = useState('');
  const [logCategoryFilter, setLogCategoryFilter] = useState<string>('TODOS');
  const [logRoleFilter, setLogRoleFilter] = useState<string>('TODOS');

  // Sincronizar dados e travar rolagem do fundo quando modal abre
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      document.documentElement.style.overflow = 'hidden';
      if (isManager) {
        setUserViewMode('registered');
        setActiveTab('users');
      }
      const initialLayers = getLayerPermissions(dataSources.map(s => s.name));
      const initialFeatures = getFeaturePermissions();
      const initialAddressColumns = getAddressColumnsPermissions();
      const initialFeatureProperties = getFeaturePropertiesPermissions();

      setLocalLayerPerms(initialLayers);
      setLocalFeaturePerms(initialFeatures);
      setLocalAddressColumns(initialAddressColumns);
      setLocalFeatureProperties(initialFeatureProperties);
      setLogs(getActivityLogs());
      setUserSessions(getUserSessions());
      setRegisteredUsers(getRegisteredUsers());
      
      // Busca sempre os logs de auditoria, sessões e usuários mais recentes do Supabase em tempo real
      getActivityLogsAsync().then(liveLogs => {
        if (liveLogs && liveLogs.length > 0) setLogs(liveLogs);
      }).catch(() => {});

      getUserSessionsAsync().then(s => {
        if (s && Object.keys(s).length > 0) setUserSessions(s);
      }).catch(() => {});

      getRegisteredUsersAsync().then(users => {
        if (users && users.length > 0) {
          setRegisteredUsers(users);
        }
      }).catch(() => {});
    }

    return () => {
      document.body.style.overflow = '';
      document.documentElement.style.overflow = '';
    };
  }, [isOpen]);

  // Carregar histórico de atividades em tempo real ao abrir o modal de detalhes do usuário (Gerente/Usuário)
  useEffect(() => {
    if (selectedUserDetail) {
      setIsLoadingUserDetailLogs(true);
      getUserLogsAsync(selectedUserDetail.id, selectedUserDetail.username, selectedUserDetail.name)
        .then(liveLogs => {
          setUserDetailLogs(liveLogs);
        })
        .catch(() => {
          setUserDetailLogs(getUserLogs(selectedUserDetail.id, selectedUserDetail.username, selectedUserDetail.name));
        })
        .finally(() => {
          setIsLoadingUserDetailLogs(false);
        });
    } else {
      setUserDetailLogs([]);
    }
  }, [selectedUserDetail]);

  // Travar a rolagem da página de fundo enquanto o painel do administrador estiver aberto
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      document.documentElement.style.overflow = 'hidden';
    }
    return () => {
      document.body.style.overflow = '';
      document.documentElement.style.overflow = '';
    };
  }, [isOpen]);

  // Sincronização automática em tempo real do painel administrativo (sem necessidade de F5)
  useEffect(() => {
    const handlePermissionsUpdated = () => {
      setRegisteredUsers(getRegisteredUsers());
      setUserSessions(getUserSessions());
      setLocalLayerPerms(getLayerPermissions([]));
      setLocalFeaturePerms(getFeaturePermissions());
      setLocalAddressColumns(getAddressColumnsPermissions());
      setLocalFeatureProperties(getFeaturePropertiesPermissions());
    };
    window.addEventListener('webgis_permissions_updated', handlePermissionsUpdated);
    return () => {
      window.removeEventListener('webgis_permissions_updated', handlePermissionsUpdated);
    };
  }, []);

  // Recarregar dados
  const handleRefreshData = useCallback(() => {
    getActivityLogsAsync().then(liveLogs => {
      setLogs(liveLogs);
    }).catch(() => {
      setLogs(getActivityLogs());
    });
    getUserSessionsAsync().then(s => setUserSessions(s)).catch(() => setUserSessions(getUserSessions()));
    getRegisteredUsersAsync().then(users => {
      setRegisteredUsers(users);
      showToast('Dados de usuários e logs atualizados com sucesso!');
    }).catch(() => {
      setRegisteredUsers(getRegisteredUsers());
      showToast('Dados de usuários e logs atualizados!');
    });
  }, [showToast]);

  // ================= AÇÕES DE USUÁRIO INDIVIDUAL =================

  const handleSelectUser = async (sessionId: string) => {
    const session = userSessions[sessionId];
    if (!session) return;

    setSelectedSessionId(sessionId);
    setEditingUserName(session.customName || '');
    setUserIsBlocked(!!session.isBlocked);
    setUserIsCustom(!!session.hasCustomPermissions);
    setSelectedUserPasswordInput(session.password || '');
    setShowSelectedUserPassword(false);

    // Carregar logs detalhados do usuário / sessão em tempo real
    setIsLoadingUserLogs(true);
    try {
      const liveLogs = await getUserLogsAsync(sessionId, undefined, session.customName);
      setSelectedUserLiveLogs(liveLogs);
    } catch {
      setSelectedUserLiveLogs(getUserLogs(sessionId, undefined, session.customName));
    } finally {
      setIsLoadingUserLogs(false);
    }

    // Se tiver permissões customizadas de camada, usa elas; senão herda as globais
    const initialLayers: Record<string, boolean> = {};
    dataSources.forEach(s => {
      if (session.customLayerPermissions && session.customLayerPermissions[s.name] !== undefined) {
        initialLayers[s.name] = session.customLayerPermissions[s.name];
      } else {
        initialLayers[s.name] = localLayerPerms[s.name] !== false;
      }
    });
    setUserCustomLayers(initialLayers);

    // Se tiver permissões customizadas de ferramentas, usa elas; senão herda as globais
    setUserCustomFeatures(session.customFeaturePermissions || { ...localFeaturePerms });

    // Se tiver permissões customizadas de colunas CNEFE
    const initialCols: Record<string, boolean> = {};
    ALL_ADDRESS_COLUMNS.forEach(c => {
      if (session.customAddressColumnsPermissions && session.customAddressColumnsPermissions[c.key] !== undefined) {
        initialCols[c.key] = session.customAddressColumnsPermissions[c.key];
      } else {
        initialCols[c.key] = localAddressColumns[c.key] !== false;
      }
    });
    setUserCustomAddressColumns(initialCols);

    // Se tiver permissões customizadas de propriedades de feições
    const initialProps: Record<string, boolean> = {};
    ALL_FEATURE_PROPERTIES.forEach(p => {
      if (session.customFeaturePropertiesPermissions && session.customFeaturePropertiesPermissions[p.key] !== undefined) {
        initialProps[p.key] = session.customFeaturePropertiesPermissions[p.key];
      } else {
        initialProps[p.key] = localFeatureProperties[p.key] !== false;
      }
    });
    setUserCustomFeatureProperties(initialProps);
  };

  const handleSavePasswordForSession = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!selectedSessionId) return;

    if (!selectedUserPasswordInput.trim()) {
      showToast('⚠️ Digite uma senha válida para salvar.');
      return;
    }

    setIsUpdatingPassword(true);
    try {
      const res = await saveUserSessionPassword(selectedSessionId, selectedUserPasswordInput.trim());
      if (res.success) {
        const fresh = await getUserSessionsAsync();
        setUserSessions(fresh);
        showToast('🔐 Senha do visitante atualizada com sucesso!');
      } else {
        showToast(`⚠️ Erro ao salvar senha: ${res.error || 'Erro no banco'}`);
      }
    } catch (err: any) {
      showToast(`⚠️ Erro ao salvar senha: ${err?.message || 'Erro de conexão'}`);
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  // ================= AÇÕES DE USUÁRIOS CADASTRADOS (LOGINS ATIVOS) =================

  const handleOpenCreateUser = () => {
    setEditingUserId(null);
    setUserFormName('');
    setUserFormUsername('');
    setUserFormPassword('');
    setUserFormRole('user');
    setUserFormDepartment('');
    setUserFormManagerPerms({
      allowGenerateLogins: true,
      canCreateManagerRole: false,
      allowChangePasswords: false,
      allowManageGlobalLayers: false,
      allowViewAllVisitors: false
    });
    setUserFormHasCustom(false);
    setUserFormLayers(localLayerPerms);
    setUserFormFeatures(localFeaturePerms);
    setUserFormAddressColumns(localAddressColumns);
    setUserFormFeatureProperties(localFeatureProperties);
    setUserFormError(null);
    setIsUserModalOpen(true);
  };

  const handleOpenEditUser = (user: RegisteredUser) => {
    setEditingUserId(user.id);
    setUserFormName(user.name);
    setUserFormUsername(user.username);
    setUserFormPassword('');
    setUserFormRole(user.role || 'user');
    setUserFormDepartment(user.department || '');
    setUserFormManagerPerms(user.managerPermissions || {
      allowGenerateLogins: true,
      canCreateManagerRole: false,
      allowChangePasswords: false,
      allowManageGlobalLayers: false,
      allowViewAllVisitors: false
    });
    setUserFormHasCustom(!!user.hasCustomPermissions);
    setUserFormLayers(user.customLayerPermissions || localLayerPerms);
    setUserFormFeatures(user.customFeaturePermissions || localFeaturePerms);
    setUserFormAddressColumns(user.customAddressColumnsPermissions || localAddressColumns);
    setUserFormFeatureProperties(user.customFeaturePropertiesPermissions || localFeatureProperties);
    setUserFormError(null);
    setIsUserModalOpen(true);
  };

  const handleSaveRegisteredUserForm = async (e: React.FormEvent) => {
    e.preventDefault();
    setUserFormError(null);

    const requester = currentActiveUser || (isMaster ? 'master' : null);
    const canSelectManager = isMaster || (isManager && currentActiveUser?.managerPermissions?.canCreateManagerRole === true);
    const effectiveRole = canSelectManager ? userFormRole : 'user';

    const result = await saveRegisteredUser({
      id: editingUserId || undefined,
      name: userFormName,
      username: userFormUsername,
      password: userFormPassword || undefined,
      role: effectiveRole,
      department: userFormDepartment,
      managerPermissions: effectiveRole === 'manager' ? userFormManagerPerms : undefined,
      hasCustomPermissions: userFormHasCustom,
      customLayerPermissions: userFormHasCustom ? userFormLayers : undefined,
      customFeaturePermissions: userFormHasCustom ? userFormFeatures : undefined,
      customAddressColumnsPermissions: userFormHasCustom ? userFormAddressColumns : undefined,
      customFeaturePropertiesPermissions: userFormHasCustom ? userFormFeatureProperties : undefined,
    }, requester);

    if (result.success) {
      setRegisteredUsers(result.users);
      setIsUserModalOpen(false);
      showToast(editingUserId ? 'Usuário atualizado com sucesso!' : 'Novo login de usuário salvo com sucesso!');
    } else {
      setUserFormError(result.error || 'Erro ao salvar usuário.');
    }
  };

  const handleDeleteRegisteredUser = async (userId: string) => {
    if (window.confirm('Tem certeza que deseja excluir permanentemente este login de usuário?')) {
      const requester = currentActiveUser || (isMaster ? 'master' : null);
      const result = await deleteRegisteredUser(userId, requester);
      if (result.success) {
        setRegisteredUsers(result.users);
        showToast('Login de usuário excluído com sucesso.');
      } else {
        showToast(result.error || 'Erro ao excluir usuário.');
      }
    }
  };

  const handleToggleRegisteredUserStatus = async (userId: string) => {
    const requester = currentActiveUser || (isMaster ? 'master' : null);
    const result = await toggleRegisteredUserStatus(userId, requester);
    if (result.success) {
      setRegisteredUsers(result.users);
    } else {
      showToast(result.error || 'Erro ao alterar status.');
    }
  };

  const handlePromoteToManager = async (userId: string) => {
    if (window.confirm('Deseja promover este usuário ao cargo de GERENTE 👔? Ele poderá gerenciar os usuários da equipe.')) {
      const result = await promoteUserToManager(userId, currentActiveUser || 'master');
      if (result.success) {
        setRegisteredUsers(result.users);
        showToast('👔 Usuário promovido a GERENTE com sucesso!');
      } else {
        showToast(result.error || 'Erro ao promover usuário.');
      }
    }
  };

  const handleDemoteToUser = async (userId: string) => {
    if (window.confirm('Deseja rebaixar este Gerente para USUÁRIO COMUM 👤? Ele perderá o acesso ao painel de gerência.')) {
      const result = await demoteManagerToUser(userId, currentActiveUser || 'master');
      if (result.success) {
        setRegisteredUsers(result.users);
        showToast('👤 Gerente rebaixado para USUÁRIO COMUM.');
      } else {
        showToast(result.error || 'Erro ao rebaixar gerente.');
      }
    }
  };

  const handleConfirmResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetPassUser) return;
    if (!resetPassInput || resetPassInput.trim().length < 4) {
      setResetPassError('A nova senha deve ter no mínimo 4 caracteres.');
      return;
    }

    const requester = currentActiveUser || (isMaster ? 'master' : null);
    const result = await changeUserPassword(resetPassUser.id, resetPassInput.trim(), requester);

    if (result.success) {
      if (result.syncedToServer) {
        setRegisteredUsers(result.users);
        setResetPassUser(null);
        setResetPassInput('');
        setResetPassError(null);
        showToast(`✅ Senha de "${resetPassUser.name}" atualizada com sucesso!`);
      } else {
        setResetPassError(`⚠️ Não foi possível sincronizar com o servidor: ${result.syncError || 'erro de conexão'}. Tente novamente.`);
      }
    } else {
      setResetPassError(result.error || 'Erro ao redefinir senha.');
    }
  };

  const handleSaveUserConfig = () => {
    if (!selectedSessionId) return;

    saveUserSessionConfig(selectedSessionId, {
      customName: editingUserName.trim() || undefined,
      isBlocked: userIsBlocked,
      hasCustomPermissions: userIsCustom,
      customLayerPermissions: userIsCustom ? userCustomLayers : undefined,
      customFeaturePermissions: userIsCustom ? userCustomFeatures : undefined,
      customAddressColumnsPermissions: userIsCustom ? userCustomAddressColumns : undefined,
      customFeaturePropertiesPermissions: userIsCustom ? userCustomFeatureProperties : undefined,
    });

    setUserSessions(getUserSessions());
    notifyPermissionsUpdated();
    showToast(`Configurações salvas para o usuário com sucesso!`);
  };

  const handleDeleteUser = (sessionId: string) => {
    if (window.confirm('Tem certeza que deseja remover este usuário da lista de monitoramento?')) {
      deleteUserSession(sessionId);
      setUserSessions(getUserSessions());
      if (selectedSessionId === sessionId) {
        setSelectedSessionId(null);
      }
      notifyPermissionsUpdated();
      showToast('Usuário removido da lista.');
    }
  };

  const handleToggleBlockUser = (sessionId: string) => {
    const session = userSessions[sessionId];
    if (!session) return;
    const nextBlocked = !session.isBlocked;

    saveUserSessionConfig(sessionId, {
      ...session,
      isBlocked: nextBlocked
    });

    if (selectedSessionId === sessionId) {
      setUserIsBlocked(nextBlocked);
    }

    setUserSessions(getUserSessions());
    notifyPermissionsUpdated();
    logActivity(
      'ACESSO',
      `${nextBlocked ? 'Bloqueou' : 'Desbloqueou'} o acesso do usuário "${session.customName || sessionId}"`,
      'admin'
    );
    showToast(nextBlocked ? 'Usuário bloqueado! Acesso ao WebGis suspenso.' : 'Usuário desbloqueado com sucesso! Acesso ao WebGis liberado.');
  };

  const handleToggleUserLayer = (layerName: string) => {
    setUserCustomLayers(prev => ({
      ...prev,
      [layerName]: !prev[layerName]
    }));
  };

  const handleToggleUserFeature = (featureKey: keyof FeaturePermissions) => {
    setUserCustomFeatures(prev => ({
      ...prev,
      [featureKey]: !prev[featureKey]
    }));
  };

  const handleToggleUserAddressColumn = (colKey: string) => {
    setUserCustomAddressColumns(prev => ({
      ...prev,
      [colKey]: !prev[colKey]
    }));
  };

  const handleToggleUserFeatureProperty = (propKey: string) => {
    setUserCustomFeatureProperties(prev => ({
      ...prev,
      [propKey]: !prev[propKey]
    }));
  };

  // ================= AÇÕES GLOBAIS DE COLUNAS E PROPRIEDADES =================

  const handleToggleGlobalAddressColumn = async (colKey: string) => {
    const isCurrentlyAllowed = localAddressColumns[colKey] !== false;
    const nextState = !isCurrentlyAllowed;
    const updated = {
      ...localAddressColumns,
      [colKey]: nextState
    };
    setLocalAddressColumns(updated);
    localStorage.setItem('webgis_address_columns_permissions', JSON.stringify(updated));
    notifyPermissionsUpdated();
    if (onUpdateAddressColumnsPermissions) onUpdateAddressColumnsPermissions(updated);
    await saveAddressColumnsPermissions(updated);
  };

  const handleToggleAllGlobalAddressColumns = async (allow: boolean) => {
    const updated: Record<string, boolean> = {};
    ALL_ADDRESS_COLUMNS.forEach(col => {
      updated[col.key] = allow;
    });
    setLocalAddressColumns(updated);
    localStorage.setItem('webgis_address_columns_permissions', JSON.stringify(updated));
    notifyPermissionsUpdated();
    if (onUpdateAddressColumnsPermissions) onUpdateAddressColumnsPermissions(updated);
    await saveAddressColumnsPermissions(updated);
    showToast(allow ? 'Todas as colunas de endereços foram ativadas!' : 'Todas as colunas de endereços foram desativadas!');
  };

  const handleToggleGlobalFeatureProperty = async (propKey: string) => {
    const isCurrentlyAllowed = localFeatureProperties[propKey] !== false;
    const nextState = !isCurrentlyAllowed;
    const updated = {
      ...localFeatureProperties,
      [propKey]: nextState
    };
    setLocalFeatureProperties(updated);
    localStorage.setItem('webgis_feature_properties_permissions', JSON.stringify(updated));
    notifyPermissionsUpdated();
    if (onUpdateFeaturePropertiesPermissions) onUpdateFeaturePropertiesPermissions(updated);
    await saveFeaturePropertiesPermissions(updated);
  };

  const handleToggleAllGlobalFeatureProperties = async (allow: boolean) => {
    const updated: Record<string, boolean> = {};
    ALL_FEATURE_PROPERTIES.forEach(p => { updated[p.key] = allow; });
    setLocalFeatureProperties(updated);
    localStorage.setItem('webgis_feature_properties_permissions', JSON.stringify(updated));
    notifyPermissionsUpdated();
    if (onUpdateFeaturePropertiesPermissions) onUpdateFeaturePropertiesPermissions(updated);
    await saveFeaturePropertiesPermissions(updated);
    showToast(allow ? 'Todas as propriedades de feições foram ativadas!' : 'Todas as propriedades de feições foram desativadas!');
  };

  // ================= AÇÕES GLOBAIS DE CAMADAS E RECURSOS =================

  const handleToggleGlobalLayer = async (layerName: string) => {
    const isCurrentlyAllowed = localLayerPerms[layerName] !== false;
    const nextState = !isCurrentlyAllowed;
    const updated = {
      ...localLayerPerms,
      [layerName]: nextState
    };
    setLocalLayerPerms(updated);
    localStorage.setItem('webgis_layer_permissions', JSON.stringify(updated));
    notifyPermissionsUpdated();
    if (onUpdateLayerPermissions) onUpdateLayerPermissions(updated);
    const res = await saveLayerPermissions(updated);
    if (!res.success) {
      showToast(`⚠️ Não foi possível salvar a alteração da camada.`);
    } else {
      showToast(nextState ? `Camada "${layerName}" ativada globalmente!` : `Camada "${layerName}" desativada globalmente!`);
    }
  };

  const handleToggleAllGlobalLayers = async (allow: boolean) => {
    const updated: Record<string, boolean> = {};
    dataSources.forEach(s => {
      updated[s.name] = allow;
    });
    setLocalLayerPerms(updated);
    localStorage.setItem('webgis_layer_permissions', JSON.stringify(updated));
    notifyPermissionsUpdated();
    if (onUpdateLayerPermissions) onUpdateLayerPermissions(updated);
    const res = await saveLayerPermissions(updated);
    if (!res.success) {
      showToast(`⚠️ Não foi possível salvar as alterações.`);
    } else {
      showToast(allow ? 'Todas as camadas foram liberadas!' : 'Todas as camadas foram bloqueadas!');
    }
  };

  const handleToggleGlobalFeature = async (featureKey: keyof FeaturePermissions) => {
    const isCurrentlyAllowed = localFeaturePerms[featureKey] !== false;
    const nextState = !isCurrentlyAllowed;
    const updated = {
      ...localFeaturePerms,
      [featureKey]: nextState
    };
    setLocalFeaturePerms(updated);
    localStorage.setItem('webgis_feature_permissions', JSON.stringify(updated));
    notifyPermissionsUpdated();
    if (onUpdateFeaturePermissions) onUpdateFeaturePermissions(updated);
    const res = await saveFeaturePermissions(updated);
    if (!res.success) {
      showToast(`⚠️ Não foi possível salvar as alterações.`);
    } else {
      showToast(nextState ? 'Ferramenta ativada globalmente!' : 'Ferramenta desativada globalmente!');
    }
  };

  const handleClearLogs = () => {
    if (window.confirm('Tem certeza que deseja limpar todo o histórico de logs e atividades?')) {
      clearActivityLogs();
      setLogs([]);
      showToast('Histórico de logs foi limpo com sucesso!');
    }
  };

  // Lista de Usuários Filtrados (Ordenados do mais recente para o mais antigo)
  const filteredUserSessions = useMemo(() => {
    const sessionList = Object.values(userSessions);
    return sessionList.filter(s => {
      // O acesso do Administrador Master é 100% ANÔNIMO: NUNCA aparece para Gerentes nem para nenhum outro usuário!
      if (!isMaster) {
        const sid = (s.sessionId || '').toLowerCase();
        const sName = (s.customName || '').toLowerCase();
        const sRole = (s.role || '').toLowerCase();
        if (
          sid === 'master' ||
          sid.includes('master') ||
          sid.includes('admin') ||
          sName.includes('master') ||
          sName.includes('administrador') ||
          sName.includes('chefe') ||
          sRole === 'master' ||
          sRole === 'admin'
        ) {
          return false;
        }
      }

      const matchSearch = userSearchTerm.trim() === '' ||
        s.sessionId.toLowerCase().includes(userSearchTerm.toLowerCase()) ||
        (s.customName && s.customName.toLowerCase().includes(userSearchTerm.toLowerCase()));

      let matchStatus = true;
      if (userFilterStatus === 'BLOQUEADOS') matchStatus = !!s.isBlocked;
      if (userFilterStatus === 'PERSONALIZADOS') matchStatus = !!s.hasCustomPermissions;
      if (userFilterStatus === 'PADRAO') matchStatus = !s.hasCustomPermissions && !s.isBlocked;

      return matchSearch && matchStatus;
    }).sort((a, b) => new Date(b.lastSeen || b.firstSeen || 0).getTime() - new Date(a.lastSeen || a.firstSeen || 0).getTime());
  }, [userSessions, userSearchTerm, userFilterStatus, isMaster]);

  const filteredUserSessionsList = filteredUserSessions;

  // Logs do Usuário Selecionado (usa os logs em tempo real se carregados)
  const selectedUserLogs = useMemo(() => {
    if (!selectedSessionId) return [];
    if (selectedUserLiveLogs && selectedUserLiveLogs.length > 0) {
      return selectedUserLiveLogs;
    }
    const session = userSessions[selectedSessionId];
    return getUserLogs(selectedSessionId, undefined, session?.customName);
  }, [selectedSessionId, selectedUserLiveLogs, logs, userSessions]);

  // Estatísticas de Ação do Usuário Selecionado
  const userActionStats = useMemo(() => {
    const counts = {
      searches: 0,
      addresses: 0,
      layers: 0,
      features: 0,
      exports: 0,
      measures: 0,
      prints: 0,
      total: 0
    };
    selectedUserLogs.forEach(l => {
      counts.total++;
      if (l.category === 'BUSCA') counts.searches++;
      else if (l.category === 'ENDERECO') counts.addresses++;
      else if (l.category === 'CAMADA') counts.layers++;
      else if (l.category === 'FEICAO') counts.features++;
      else if (l.category === 'EXPORTACAO') counts.exports++;
      else if (l.category === 'MEDICAO') counts.measures++;
      else if (l.category === 'IMPRESSAO') counts.prints++;
    });
    return counts;
  }, [selectedUserLogs]);

  // Função auxiliar para renderizar badges visuais coloridos com ícones por categoria de ação
  const renderCategoryBadge = (category: ActivityLog['category']) => {
    switch (category) {
      case 'BUSCA':
        return (
          <span className="text-[10px] font-black uppercase bg-blue-100 dark:bg-blue-950/80 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800/60 px-2 py-0.5 rounded-md flex items-center gap-1 shrink-0">
            <Search className="w-3 h-3 text-blue-600 dark:text-blue-400" />
            BUSCA
          </span>
        );
      case 'ENDERECO':
        return (
          <span className="text-[10px] font-black uppercase bg-rose-100 dark:bg-rose-950/80 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800/60 px-2 py-0.5 rounded-md flex items-center gap-1 shrink-0">
            <MapPin className="w-3 h-3 text-rose-600 dark:text-rose-400" />
            ENDEREÇO
          </span>
        );
      case 'CAMADA':
        return (
          <span className="text-[10px] font-black uppercase bg-amber-100 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60 px-2 py-0.5 rounded-md flex items-center gap-1 shrink-0">
            <Layers className="w-3 h-3 text-amber-600 dark:text-amber-400" />
            CAMADA
          </span>
        );
      case 'FEICAO':
        return (
          <span className="text-[10px] font-black uppercase bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60 px-2 py-0.5 rounded-md flex items-center gap-1 shrink-0">
            <MousePointerClick className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
            FEIÇÃO
          </span>
        );
      case 'EXPORTACAO':
        return (
          <span className="text-[10px] font-black uppercase bg-purple-100 dark:bg-purple-950/80 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800/60 px-2 py-0.5 rounded-md flex items-center gap-1 shrink-0">
            <Download className="w-3 h-3 text-purple-600 dark:text-purple-400" />
            EXPORTAÇÃO
          </span>
        );
      case 'MEDICAO':
        return (
          <span className="text-[10px] font-black uppercase bg-cyan-100 dark:bg-cyan-950/80 text-cyan-700 dark:text-cyan-300 border border-cyan-200 dark:border-cyan-800/60 px-2 py-0.5 rounded-md flex items-center gap-1 shrink-0">
            <Ruler className="w-3 h-3 text-cyan-600 dark:text-cyan-400" />
            MEDIÇÃO
          </span>
        );
      case 'IMPRESSAO':
        return (
          <span className="text-[10px] font-black uppercase bg-orange-100 dark:bg-orange-950/80 text-orange-700 dark:text-orange-300 border border-orange-200 dark:border-orange-800/60 px-2 py-0.5 rounded-md flex items-center gap-1 shrink-0">
            <Printer className="w-3 h-3 text-orange-600 dark:text-orange-400" />
            IMPRESSÃO
          </span>
        );
      case 'ADMIN':
        return (
          <span className="text-[10px] font-black uppercase bg-red-100 dark:bg-red-950/80 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800/60 px-2 py-0.5 rounded-md flex items-center gap-1 shrink-0">
            <Shield className="w-3 h-3 text-red-600 dark:text-red-400" />
            ADMIN
          </span>
        );
      default:
        return (
          <span className="text-[10px] font-black uppercase bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 px-2 py-0.5 rounded-md flex items-center gap-1 shrink-0">
            <UserCheck className="w-3 h-3 text-slate-500" />
            {category}
          </span>
        );
    }
  };



  // Filtragem dos Logs Gerais (Oculta ações do próprio Master para focar no monitoramento de Gerentes e Usuários)
  const filteredLogs = useMemo(() => {
    return logs.filter(log => {
      // O acesso e ações do Administrador Master são 100% ANÔNIMOS para Gerentes
      if (!isMaster) {
        const lRole = (log.userRole || '').toLowerCase();
        const lSid = (log.sessionId || '').toLowerCase();
        const lDet = (log.details || '').toLowerCase();
        const lAct = (log.action || '').toLowerCase();
        if (
          lRole === 'master' ||
          lRole === 'admin' ||
          lSid.includes('master') ||
          lSid.includes('admin') ||
          lAct.includes('master') ||
          lDet.includes('master')
        ) {
          return false;
        }
      } else {
        const isMasterOnlyLog = log.userRole === 'master' && 
                                !log.action.toLowerCase().includes('gerente') &&
                                !log.action.toLowerCase().includes('👔') &&
                                !log.sessionId.toLowerCase().includes('gerente') &&
                                !(log.details && log.details.toLowerCase().includes('gerente'));
        
        if (isMasterOnlyLog) {
          return false;
        }
      }

      const matchSearch = logSearch.trim() === '' ||
        log.action.toLowerCase().includes(logSearch.toLowerCase()) ||
        (log.details && log.details.toLowerCase().includes(logSearch.toLowerCase())) ||
        log.sessionId.toLowerCase().includes(logSearch.toLowerCase()) ||
        log.formattedDate.toLowerCase().includes(logSearch.toLowerCase());

      const matchCategory = logCategoryFilter === 'TODOS' || log.category === logCategoryFilter;
      const matchRole = logRoleFilter === 'TODOS' || log.userRole === logRoleFilter;

      return matchSearch && matchCategory && matchRole;
    });
  }, [logs, logSearch, logCategoryFilter, logRoleFilter, isMaster]);

  // Estatísticas de Auditoria
  const stats = useMemo(() => {
    const sessionList = Object.values(userSessions).filter(s => {
      if (!isMaster) {
        const sid = (s.sessionId || '').toLowerCase();
        const sName = (s.customName || '').toLowerCase();
        const sRole = (s.role || '').toLowerCase();
        if (
          sid === 'master' ||
          sid.includes('master') ||
          sid.includes('admin') ||
          sName.includes('master') ||
          sName.includes('administrador') ||
          sName.includes('chefe') ||
          sRole === 'master' ||
          sRole === 'admin'
        ) {
          return false;
        }
      }
      return true;
    });

    const visibleLogs = logs.filter(l => {
      if (!isMaster) {
        const lRole = (l.userRole || '').toLowerCase();
        const lSid = (l.sessionId || '').toLowerCase();
        const lDet = (l.details || '').toLowerCase();
        const lAct = (l.action || '').toLowerCase();
        if (
          lRole === 'master' ||
          lRole === 'admin' ||
          lSid.includes('master') ||
          lSid.includes('admin') ||
          lAct.includes('master') ||
          lDet.includes('master')
        ) {
          return false;
        }
      }
      return true;
    });

    const totalUsers = sessionList.length;
    const totalBlocked = sessionList.filter(s => s.isBlocked).length;
    const totalCustom = sessionList.filter(s => s.hasCustomPermissions).length;
    const totalSearches = visibleLogs.filter(l => l.category === 'BUSCA').length;
    return { totalUsers, totalBlocked, totalCustom, totalSearches };
  }, [userSessions, logs, isMaster]);

  // Helper para identificar contas criadas pelo próprio visitante/usuário no site
  const isUserSelfCreated = useCallback((u: RegisteredUser) => {
    const role = u.role || 'user';
    if (role !== 'user') return false;
    const cb = (u.createdBy || '').toLowerCase();
    
    // Se foi explicitamente criado pelo Master ou por um Gerente, NUNCA é auto-cadastrado
    if (cb === 'master' || cb.startsWith('master') || cb.includes('gerente') || cb.includes('admin') || cb.startsWith('@')) {
      return false;
    }

    // Só é considerado auto-cadastrado se a origem for explicitamente pelo site / visitante
    return (
      cb.includes('site') ||
      cb.includes('auto') ||
      cb.includes('visitante') ||
      cb.includes('pelo usuário') ||
      cb.includes('pelo usuario') ||
      (u.department || '').toLowerCase().includes('cadastrado pelo usuário')
    );
  }, []);

  const isCreatedByThisManager = useCallback((u: RegisteredUser, mgrUsername: string) => {
    if (!mgrUsername) return false;
    const cleanMgr = mgrUsername.toLowerCase().replace(/^@/, '').trim();
    const cleanCb = (u.createdBy || '').toLowerCase().replace(/^@/, '').trim();
    return cleanCb === cleanMgr || cleanCb.startsWith(cleanMgr) || cleanCb.includes(cleanMgr);
  }, []);

  const userCounts = useMemo(() => {
    let masters = 0;
    let managers = 0;
    let regulars = 0;
    let userCreated = 0;
    const managerUsername = (activeManagerUser?.username || currentActiveUser?.username || '').toLowerCase();
    let myTeam = 0;

    registeredUsers.forEach(u => {
      const role = u.role || 'user';
      if (role === 'master') {
        masters++;
      } else if (role === 'manager') {
        managers++;
      } else if (isUserSelfCreated(u)) {
        userCreated++;
      } else {
        regulars++;
      }

      if (isCreatedByThisManager(u, managerUsername)) {
        myTeam++;
      }
    });
    return { masters, managers, regulars, userCreated, total: registeredUsers.length, myTeam };
  }, [registeredUsers, activeManagerUser, currentActiveUser, isUserSelfCreated, isCreatedByThisManager]);

  // Lista filtrada de Usuários Cadastrados
  const filteredRegisteredUsers = useMemo(() => {
    const term = registeredSearchTerm.trim().toLowerCase();
    const managerUsername = (activeManagerUser?.username || currentActiveUser?.username || '').toLowerCase();

    const filtered = registeredUsers.filter(u => {
      // Contas Master NUNCA aparecem para Gerentes nem para outros usuários
      if (!isMaster) {
        const uRole = (u.role || '').toLowerCase();
        const uUser = (u.username || '').toLowerCase();
        if (uRole === 'master' || uRole === 'admin' || uUser === 'master') {
          return false;
        }
        // Se for Gerente, só enxerga os logins que ele gerou
        if (!isCreatedByThisManager(u, managerUsername)) return false;
      }

      // Filtros de Cargo e Origem para o Master
      if (isMaster) {
        const role = u.role || 'user';
        const isAuto = isUserSelfCreated(u);

        if (userRoleFilter === 'USER_CREATED') {
          if (!isAuto) return false;
        } else if (userRoleFilter === 'MASTER') {
          if (role !== 'master') return false;
        } else if (userRoleFilter === 'MANAGER') {
          if (role !== 'manager') return false;
        } else if (userRoleFilter === 'USER') {
          if (role !== 'user' || isAuto) return false;
        }
      }

      if (!term) return true;

      return (
        u.name.toLowerCase().includes(term) ||
        u.username.toLowerCase().includes(term) ||
        (u.department && u.department.toLowerCase().includes(term)) ||
        (u.createdBy && u.createdBy.toLowerCase().includes(term))
      );
    });

    // Ordenação: MAIS RECENTES PRIMEIRO (decrescente por createdAt ou timestamp de ID)
    return [...filtered].sort((a, b) => {
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
  }, [registeredUsers, registeredSearchTerm, userRoleFilter, isMaster, isManager, currentActiveUser, isUserSelfCreated, isCreatedByThisManager]);

  if (!isOpen) return null;

  return createPortal(
    <div 
      className="fixed inset-0 top-0 left-0 right-0 bottom-0 z-[9999] w-screen h-screen min-h-[100dvh] bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 overflow-y-auto animate-fadeIn overscroll-contain"
      onWheel={(e) => e.stopPropagation()}
    >
      <div
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl max-w-5xl w-full flex flex-col max-h-[94vh] overflow-hidden my-auto overscroll-contain"
        onClick={(e) => e.stopPropagation()}
        onWheel={(e) => e.stopPropagation()}
      >
        {/* Cabeçalho do Painel */}
        <div className={`px-4 sm:px-6 py-3.5 sm:py-4 text-white flex items-center justify-between shadow-md shrink-0 ${
          isManager 
            ? 'bg-gradient-to-r from-indigo-800 via-blue-700 to-indigo-900' 
            : 'bg-gradient-to-r from-red-800 via-rose-700 to-red-900'
        }`}>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-white/15 backdrop-blur-md flex items-center justify-center border border-white/20 shadow-inner shrink-0">
              {isManager ? (
                <Briefcase className="w-5 h-5 text-indigo-200" />
              ) : (
                <Crown className="w-5 h-5 text-amber-300" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-black tracking-tight">
                  {isManager ? 'Painel do Gerente (Monitoramento)' : 'Painel do Administrador Master'}
                </h2>
                <span className={`text-white font-extrabold text-[9px] px-2.5 py-0.5 rounded-full uppercase tracking-wider hidden sm:inline-block ${
                  isManager ? 'bg-indigo-500/40 border border-indigo-300/30' : 'bg-amber-500/30 border border-amber-300/40 text-amber-200'
                }`}>
                  {isManager ? '👔 GERENTE' : '👑 CHEFE SUPREMO'}
                </span>
              </div>
              <p className="text-[11px] text-white/80 font-medium">
                {isManager 
                  ? `Monitoramento em tempo real de visitantes e acessos ao WebGIS (@${currentActiveUser?.username || 'gerente'}).`
                  : 'Governança global, cargos de gerência, camadas, ferramentas, colunas e auditoria centralizada.'
                }
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isMaster && onOpenSimulationChoice && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenSimulationChoice();
                }}
                className="px-3 py-1.5 bg-white/20 hover:bg-white/30 text-white border border-white/30 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shadow-sm"
                title="Simular a visão de Visitante ou Gerente"
              >
                <Eye className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Simular Visão</span>
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="text-white/80 hover:text-white hover:bg-white/20 p-2 rounded-xl transition-all cursor-pointer"
              title="Fechar Painel"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Barra de Navegação por Abas (Segmented Pills Bar) */}
        <div className="bg-slate-50 dark:bg-slate-900/90 border-b border-slate-200 dark:border-slate-800 px-3 sm:px-5 py-2.5 shrink-0">
          <div className="flex items-center gap-1.5 overflow-x-auto custom-scrollbar pb-0.5">
            <button
              onClick={() => { setActiveTab('users'); setSelectedSessionId(null); }}
              className={`px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer shrink-0 ${
                activeTab === 'users'
                  ? (isManager ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/20' : 'bg-red-600 text-white shadow-sm shadow-red-600/20')
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-200/60 dark:hover:bg-slate-800'
              }`}
            >
              {isManager ? <UserCheck2 className="w-3.5 h-3.5" /> : <Crown className="w-3.5 h-3.5" />}
              <span>{isManager ? (canManagerViewAllVisitors ? 'Equipe & Visitantes' : 'Minha Equipe (Logins)') : 'Usuários & Gerentes'}</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-black ${
                activeTab === 'users' ? 'bg-white/25 text-white' : 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
              }`}>
                {isManager ? (canManagerViewAllVisitors ? (stats.totalUsers + userCounts.myTeam) : userCounts.myTeam) : (stats.totalUsers + registeredUsers.length)}
              </span>
            </button>

            {isMaster && (
              <>
                <button
                  onClick={() => setActiveTab('layers')}
                  className={`px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer shrink-0 ${
                    activeTab === 'layers'
                      ? 'bg-red-600 text-white shadow-sm shadow-red-600/20'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-200/60 dark:hover:bg-slate-800'
                  }`}
                >
                  <Layers className="w-3.5 h-3.5" />
                  <span>Camadas Globais</span>
                </button>

                <button
                  onClick={() => setActiveTab('features')}
                  className={`px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer shrink-0 ${
                    activeTab === 'features'
                      ? 'bg-red-600 text-white shadow-sm shadow-red-600/20'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-200/60 dark:hover:bg-slate-800'
                  }`}
                >
                  <Wrench className="w-3.5 h-3.5" />
                  <span>Ferramentas Globais</span>
                </button>

                <button
                  onClick={() => setActiveTab('columns')}
                  className={`px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer shrink-0 ${
                    activeTab === 'columns'
                      ? 'bg-red-600 text-white shadow-sm shadow-red-600/20'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-200/60 dark:hover:bg-slate-800'
                  }`}
                >
                  <TableProperties className="w-3.5 h-3.5" />
                  <span>Colunas & Dados</span>
                </button>

                <button
                  onClick={() => setActiveTab('logs')}
                  className={`px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer shrink-0 ${
                    activeTab === 'logs'
                      ? 'bg-red-600 text-white shadow-sm shadow-red-600/20'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-200/60 dark:hover:bg-slate-800'
                  }`}
                >
                  <Activity className="w-3.5 h-3.5" />
                  <span>Auditoria (Logs)</span>
                </button>
              </>
            )}
          </div>
        </div>

        {/* Corpo do Painel com Rolagem */}
        <div 
          className="p-4 sm:p-6 overflow-y-auto flex-grow custom-scrollbar overscroll-contain"
          onWheel={(e) => e.stopPropagation()}
        >

          {/* ================= ABA 1: CONTROLE INDIVIDUAL DE USUÁRIOS ================= */}
          {activeTab === 'users' && (
            <div className="space-y-4">
              {/* SELETOR DE MODO: CONTAS CADASTRADAS VS SESSÕES RECENTES */}
              {(isMaster || canManagerViewAllVisitors) && (
                <div className="flex items-center gap-2 p-1.5 bg-slate-100 dark:bg-slate-800 rounded-2xl w-full sm:w-fit border border-slate-200 dark:border-slate-700">
                  <button
                    type="button"
                    onClick={() => { setUserViewMode('registered'); setSelectedSessionId(null); }}
                    className={`flex-1 sm:flex-initial px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 cursor-pointer ${
                      userViewMode === 'registered'
                        ? (isManager ? 'bg-indigo-600 text-white shadow-xs' : 'bg-white dark:bg-slate-900 text-red-600 dark:text-red-400 shadow-xs')
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                    }`}
                  >
                    <UserCheck2 className="w-4 h-4 text-emerald-500" />
                    <span>{isManager ? 'Logins Gerados por Mim' : 'Contas Cadastradas (Usuários & Logins)'}</span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-black ${
                      userViewMode === 'registered' && isManager
                        ? 'bg-white/20 text-white'
                        : 'bg-red-100 dark:bg-red-950/80 text-red-700 dark:text-red-300'
                    }`}>
                      {isManager ? userCounts.myTeam : registeredUsers.length}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => { setUserViewMode('sessions'); setSelectedSessionId(null); }}
                    className={`flex-1 sm:flex-initial px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 cursor-pointer ${
                      userViewMode === 'sessions'
                        ? (isManager ? 'bg-indigo-600 text-white shadow-xs' : 'bg-white dark:bg-slate-900 text-red-600 dark:text-red-400 shadow-xs')
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                    }`}
                  >
                    <Users className="w-4 h-4 text-blue-500" />
                    <span>{isManager ? 'Todos os Visitantes no Site' : 'Sessões Recentes de Visitantes'}</span>
                    <span className="bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 text-[10px] px-2 py-0.5 rounded-full font-black">
                      {stats.totalUsers}
                    </span>
                  </button>
                </div>
              )}

              {/* CONTEÚDO DO MODO LOGINS CADASTRADOS */}
              {userViewMode === 'registered' && (
                <div className="space-y-4">
                  {/* Filtro por Cargo e Origem (Apenas para Master) */}
                  {isMaster && (
                    <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                      <button
                        type="button"
                        onClick={() => setUserRoleFilter('ALL')}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                          userRoleFilter === 'ALL'
                            ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-xs'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
                        }`}
                      >
                        Todas as Contas ({userCounts.total})
                      </button>
                      <button
                        type="button"
                        onClick={() => setUserRoleFilter('USER_CREATED')}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                          userRoleFilter === 'USER_CREATED'
                            ? 'bg-emerald-600 text-white shadow-xs'
                            : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60 hover:bg-emerald-100'
                        }`}
                      >
                        <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Criadas por Usuários ({userCounts.userCreated})</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setUserRoleFilter('USER')}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                          userRoleFilter === 'USER'
                            ? 'bg-teal-600 text-white shadow-xs'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
                        }`}
                      >
                        <User className="w-3.5 h-3.5 text-teal-400" />
                        <span>Logins Gerados ({userCounts.regulars})</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setUserRoleFilter('MANAGER')}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                          userRoleFilter === 'MANAGER'
                            ? 'bg-indigo-600 text-white shadow-xs'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
                        }`}
                      >
                        <Briefcase className="w-3.5 h-3.5 text-indigo-400" />
                        <span>Gerentes ({userCounts.managers})</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setUserRoleFilter('MASTER')}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                          userRoleFilter === 'MASTER'
                            ? 'bg-gradient-to-r from-amber-500 to-rose-600 text-white shadow-xs'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
                        }`}
                      >
                        <Crown className="w-3.5 h-3.5 text-amber-500" />
                        <span>Masters ({userCounts.masters})</span>
                      </button>
                    </div>
                  )}

                  {/* Barra de Ações: Busca + Botão Criar Usuário */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50 dark:bg-slate-800/60 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800">
                    <div className="relative flex-1">
                      <input
                        type="text"
                        placeholder="Buscar por nome, @login ou setor..."
                        value={registeredSearchTerm}
                        onChange={(e) => setRegisteredSearchTerm(e.target.value)}
                        className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl pl-8 pr-3 py-2 text-xs text-slate-800 dark:text-slate-100 outline-none focus:ring-1 focus:ring-red-500"
                      />
                      <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                    </div>

                    {canManagerGenerateLogins && (
                      <button
                        type="button"
                        onClick={handleOpenCreateUser}
                        className={`px-4 py-2 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 transition-all shadow-md cursor-pointer shrink-0 ${
                          isManager
                            ? 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-600/30'
                            : 'bg-red-600 hover:bg-red-700 shadow-red-600/30'
                        }`}
                      >
                        <UserPlus className="w-4 h-4" />
                        <span>{isManager ? 'Gerar Novo Login' : 'Cadastrar Nova Conta'}</span>
                      </button>
                    )}
                  </div>

                  {/* Lista de Usuários Cadastrados */}
                  <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden max-h-[440px] overflow-y-auto custom-scrollbar">
                    {filteredRegisteredUsers.length > 0 ? (
                      <div className="divide-y divide-slate-100 dark:divide-slate-800/80 bg-white dark:bg-slate-900">
                        {filteredRegisteredUsers.map(user => {
                          const role = user.role || 'user';
                          const isUserMaster = role === 'master';
                          const isUserManager = role === 'manager';
                          const isUserAutoCreated = isUserSelfCreated(user);
                          const isOnline = !!(user.lastLogin && (Date.now() - new Date(user.lastLogin).getTime() < 10 * 60 * 1000));
                          const teamCount = isUserManager ? registeredUsers.filter(u => u.createdBy?.toLowerCase() === user.username.toLowerCase()).length : 0;

                          return (
                            <div
                              key={user.id}
                              className="p-4 hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                            >
                              <div className="flex items-center gap-3.5 min-w-0">
                                <div className={`w-11 h-11 rounded-2xl flex items-center justify-center font-black text-sm shrink-0 shadow-inner ${
                                  isUserMaster
                                    ? 'bg-gradient-to-br from-amber-400 to-rose-600 text-white'
                                    : isUserManager
                                      ? 'bg-indigo-600 text-white'
                                      : user.isActive
                                        ? 'bg-red-100 dark:bg-red-950/80 text-red-600 dark:text-red-400'
                                        : 'bg-slate-200 dark:bg-slate-800 text-slate-400'
                                }`}>
                                  {isUserMaster ? (
                                    <Crown className="w-5 h-5" />
                                  ) : isUserManager ? (
                                    <Briefcase className="w-5 h-5" />
                                  ) : (
                                    user.name.charAt(0).toUpperCase()
                                  )}
                                </div>

                                <div className="space-y-1 min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <h4 className="text-sm font-black text-slate-900 dark:text-slate-100 truncate">
                                      {user.name}
                                    </h4>
                                    <span className="font-mono text-xs font-bold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/50 px-2 py-0.5 rounded-lg">
                                      @{user.username}
                                    </span>

                                    {/* Status Online/Offline */}
                                    {isOnline ? (
                                      <span className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 text-[10px] font-black px-2 py-0.5 rounded-full border border-emerald-500/30 flex items-center gap-1">
                                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                                        ONLINE
                                      </span>
                                    ) : (
                                      <span className="bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400 text-[10px] font-bold px-2 py-0.5 rounded-full">
                                        OFFLINE
                                      </span>
                                    )}

                                    {/* Role Badge */}
                                    {isUserMaster ? (
                                      <span className="bg-gradient-to-r from-amber-500 to-rose-600 text-white text-[10px] font-black px-2.5 py-0.5 rounded-full flex items-center gap-1 shadow-xs">
                                        <Crown className="w-3 h-3" /> ACESSO SUPREMO IRRESTRITO
                                      </span>
                                    ) : isUserManager ? (
                                      <span className="bg-indigo-600 text-white text-[10px] font-black px-2.5 py-0.5 rounded-full flex items-center gap-1 shadow-xs">
                                        <Briefcase className="w-3 h-3" /> GERENTE {teamCount > 0 && `(${teamCount} na equipe)`}
                                      </span>
                                    ) : (
                                      <span className="bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 border border-slate-200 dark:border-slate-700">
                                        <User className="w-3 h-3" /> USUÁRIO
                                      </span>
                                    )}

                                    {user.isActive ? (
                                      <span className="bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 text-[10px] font-black px-2 py-0.5 rounded-full flex items-center gap-1">
                                        <CheckCircle2 className="w-3 h-3" /> ATIVO
                                      </span>
                                    ) : (
                                      <span className="bg-red-600 text-white text-[10px] font-black px-2 py-0.5 rounded-full flex items-center gap-1">
                                        <Ban className="w-3 h-3" /> BLOQUEADO
                                      </span>
                                    )}

                                    {isUserAutoCreated && (
                                      <span className="bg-emerald-50 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300 border border-emerald-300/80 dark:border-emerald-700/80 text-[10px] font-black px-2.5 py-0.5 rounded-full flex items-center gap-1 shadow-2xs">
                                        <Sparkles className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                                        Criada pelo Usuário (Site)
                                      </span>
                                    )}

                                    {!isUserMaster && user.hasCustomPermissions && (
                                      <span className="bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300 text-[9px] font-black px-2 py-0.5 rounded-full">
                                        ⭐ PERMISSÕES INDIVIDUAIS
                                      </span>
                                    )}
                                  </div>

                                  <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 flex-wrap">
                                    {user.department && (
                                      <span>Setor: <strong className="text-slate-700 dark:text-slate-300">{user.department}</strong> •</span>
                                    )}
                                    {user.createdBy && (
                                      <span>Criado por: <strong className="text-slate-700 dark:text-slate-300">{user.createdBy}</strong> •</span>
                                    )}
                                    <span>Criado em: {new Date(user.createdAt).toLocaleDateString('pt-BR')}</span>
                                    <span>•</span>
                                    <span>Último Acesso: {user.lastLogin ? new Date(user.lastLogin).toLocaleString('pt-BR') : 'Nunca acessou'}</span>
                                  </div>

                                  {/* Senha do Usuário (Visível para Master e Gerente) */}
                                  {(isMaster || isManager) && (
                                    <div className="flex items-center gap-2 pt-0.5">
                                      <div className="inline-flex items-center gap-1.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-200/80 dark:border-amber-900/60 px-2.5 py-1 rounded-xl shadow-2xs">
                                        <Lock className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                                        <span className="text-[11px] font-bold text-amber-900 dark:text-amber-300">Senha:</span>
                                        <span className="font-mono text-xs font-black text-slate-800 dark:text-slate-100 tracking-wider select-all px-1 bg-white/70 dark:bg-slate-900/60 rounded-md border border-amber-200/40 dark:border-amber-800/40">
                                          {revealedPasswords[user.id] ? user.password : '••••••••'}
                                        </span>
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            toggleRevealPassword(user.id);
                                          }}
                                          className="p-1 text-amber-700 dark:text-amber-300 hover:text-amber-950 dark:hover:text-white hover:bg-amber-200/60 dark:hover:bg-amber-900/60 rounded-lg transition-colors cursor-pointer ml-0.5"
                                          title={revealedPasswords[user.id] ? 'Ocultar senha' : 'Exibir senha deste usuário'}
                                        >
                                          {revealedPasswords[user.id] ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                                        </button>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </div>

                              <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto flex-wrap">
                                {/* Botão de Detalhes & Atividades */}
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSelectedUserDetail(user);
                                    setUserDetailTab('info');
                                  }}
                                  className="px-3 py-1.5 bg-blue-50 hover:bg-blue-600 hover:text-white dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-900 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                                  title="Ver histórico de atividades no site, logins gerados e status"
                                >
                                  <Activity className="w-3.5 h-3.5 text-blue-500" />
                                  <span>Atividades</span>
                                </button>

                                {/* Botão de Simulação Específica (Apenas Master) */}
                                {isMaster && !isUserMaster && onSimulateUser && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (typeof onClose === 'function') onClose();
                                      onSimulateUser(user.id, user.role);
                                    }}
                                    className="px-3 py-1.5 bg-amber-50 hover:bg-amber-600 hover:text-white dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-900 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                                    title={`Simular a visão exata deste usuário (@${user.username})`}
                                  >
                                    <Eye className="w-3.5 h-3.5 text-amber-600" />
                                    <span>Simular</span>
                                  </button>
                                )}

                                {/* Botão de Promoção / Rebaixamento (Apenas Master) */}
                                {isMaster && !isUserMaster && (
                                  <>
                                    {isUserManager ? (
                                      <button
                                        type="button"
                                        onClick={() => handleDemoteToUser(user.id)}
                                        className="px-3 py-1.5 bg-amber-50 hover:bg-amber-600 hover:text-white dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-900 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                                        title="Rebaixar Gerente para Usuário Comum"
                                      >
                                        <ArrowDownCircle className="w-3.5 h-3.5" />
                                        <span>Rebaixar</span>
                                      </button>
                                    ) : (
                                      <button
                                        type="button"
                                        onClick={() => handlePromoteToManager(user.id)}
                                        className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-600 hover:text-white dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-900 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                                        title="Promover usuário a Gerente"
                                      >
                                        <ArrowUpCircle className="w-3.5 h-3.5" />
                                        <span>Promover a Gerente</span>
                                      </button>
                                    )}
                                  </>
                                )}

                                {canManagerChangePasswords && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setResetPassUser(user);
                                      setResetPassInput('');
                                      setResetPassError(null);
                                    }}
                                    className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                                    title="Trocar ou redefinir a senha deste usuário"
                                  >
                                    <Key className="w-3.5 h-3.5 text-amber-600" />
                                    <span>Trocar Senha</span>
                                  </button>
                                )}

                                <button
                                  type="button"
                                  onClick={() => handleOpenEditUser(user)}
                                  className="px-3 py-1.5 bg-red-50 hover:bg-red-600 hover:text-white dark:bg-red-950/40 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-900 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                                  title="Editar dados e permissões personalizadas"
                                >
                                  <Sliders className="w-3.5 h-3.5" />
                                  <span>{isUserMaster ? 'Preferências' : 'Permissões'}</span>
                                </button>

                                {/* Bloquear / Desbloquear (não permitido no Master) */}
                                {!isUserMaster && (
                                  <button
                                    type="button"
                                    onClick={() => handleToggleRegisteredUserStatus(user.id)}
                                    className={`p-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                                      user.isActive
                                        ? 'bg-amber-50 hover:bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300'
                                        : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                                    }`}
                                    title={user.isActive ? 'Bloquear acesso do usuário' : 'Desbloquear e ativar usuário'}
                                  >
                                    {user.isActive ? <Ban className="w-4 h-4 text-red-500" /> : <Unlock className="w-4 h-4 text-emerald-600" />}
                                  </button>
                                )}

                                {/* Excluir (não permitido no Master) */}
                                {!isUserMaster && (
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteRegisteredUser(user.id)}
                                    className="p-2 text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-xl transition-colors cursor-pointer"
                                    title="Excluir usuário permanentemente"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="p-12 text-center text-slate-400 flex flex-col items-center justify-center gap-3">
                        <Users className="w-10 h-10 text-slate-300 dark:text-slate-600" />
                        <div>
                          <p className="font-bold text-sm text-slate-700 dark:text-slate-300">
                            {isManager ? 'Você ainda não gerou nenhum login.' : 'Nenhum login de usuário encontrado.'}
                          </p>
                          <p className="text-xs text-slate-400 mt-0.5">
                            {isManager
                              ? 'Clique no botão acima para gerar logins de acesso com a sua conta de Gerente.'
                              : 'Clique no botão acima para criar um login de usuário com permissões personalizadas.'}
                          </p>
                        </div>
                        {canManagerGenerateLogins && (
                          <button
                            type="button"
                            onClick={handleOpenCreateUser}
                            className={`mt-2 px-4 py-2 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 cursor-pointer shadow-md ${
                              isManager ? 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-600/30' : 'bg-red-600 hover:bg-red-700 shadow-red-600/30'
                            }`}
                          >
                            <UserPlus className="w-4 h-4" />
                            <span>{isManager ? 'Gerar Primeiro Login' : 'Criar Primeiro Login'}</span>
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* CONTEÚDO DO MODO SESSÕES DE VISITANTES */}
              {userViewMode === 'sessions' && (
                <div className="space-y-4">
                  {/* VISÃO DETALHADA / DOSSIÊ DE UM USUÁRIO SELECIONADO */}
                  {selectedSessionId ? (
                    <div className="space-y-5 animate-fadeIn">
                      {/* Barra de Retorno e Identificação do Usuário */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50 dark:bg-slate-800/80 p-4 rounded-2xl border border-slate-200 dark:border-slate-700">
                        <div className="flex items-center gap-3">
                          <button
                            type="button"
                            onClick={() => setSelectedSessionId(null)}
                            className="p-2 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-700 dark:text-slate-200 transition-colors cursor-pointer flex items-center gap-1.5 text-xs font-bold shadow-2xs"
                            title="Voltar para a lista de usuários"
                          >
                            <ArrowLeft className="w-4 h-4" />
                            <span>Voltar para a Lista</span>
                          </button>

                          <div className="flex items-center gap-2.5">
                            <div className="w-10 h-10 rounded-xl bg-red-100 dark:bg-red-950 text-red-600 dark:text-red-400 flex items-center justify-center font-black">
                              <User className="w-5 h-5" />
                            </div>
                            <div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <h3 className="text-base font-black text-slate-900 dark:text-slate-100">
                                  {editingUserName || `Visitante (${selectedSessionId})`}
                                </h3>
                                {userIsBlocked ? (
                                  <span className="bg-red-600 text-white text-[10px] font-black px-2 py-0.5 rounded-full flex items-center gap-1">
                                    <Ban className="w-3 h-3" /> BLOQUEADO
                                  </span>
                                ) : (
                                  <span className="bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 text-[10px] font-black px-2 py-0.5 rounded-full flex items-center gap-1 border border-emerald-300 dark:border-emerald-800">
                                    <Check className="w-3 h-3" /> ATIVO
                                  </span>
                                )}
                                {userSessions[selectedSessionId]?.password ? (
                                  <span className="bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 text-[10px] font-black px-2 py-0.5 rounded-full flex items-center gap-1 border border-amber-300 dark:border-amber-800">
                                    <Lock className="w-3 h-3" /> COM SENHA
                                  </span>
                                ) : (
                                  <span className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-[10px] font-black px-2 py-0.5 rounded-full flex items-center gap-1 border border-slate-200 dark:border-slate-700">
                                    <Unlock className="w-3 h-3" /> SEM SENHA
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-slate-500 font-mono">
                                ID: {selectedSessionId} • 1º Acesso: {userSessions[selectedSessionId]?.formattedFirstSeen || '-'}
                              </p>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                          {onSimulateUser && (
                            <button
                              type="button"
                              onClick={() => {
                                handleSaveUserConfig();
                                if (selectedSessionId) onSimulateUser(selectedSessionId);
                              }}
                              className="px-3.5 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-extrabold rounded-xl text-xs flex items-center gap-1.5 transition-all shadow-md shadow-amber-500/20 cursor-pointer"
                              title="Salva as alterações e ativa a visão exata deste usuário no mapa"
                            >
                              <Eye className="w-4 h-4" />
                              <span>Testar Visão do Usuário</span>
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={handleSaveUserConfig}
                            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 transition-all shadow-md shadow-red-600/30 cursor-pointer"
                          >
                            <Save className="w-4 h-4" />
                            <span>Salvar Alterações</span>
                          </button>
                        </div>
                      </div>

                      {/* CARD 1: 📊 MÉTRICAS DE ACESSO AO SITE (QUANTIDADE DE ENTRADAS) */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div className="bg-gradient-to-br from-red-50 to-rose-50 dark:from-red-950/40 dark:to-rose-950/20 p-4 rounded-2xl border border-red-200/80 dark:border-red-900/50 flex flex-col justify-between">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-extrabold uppercase tracking-wider text-red-700 dark:text-red-300">
                              Entradas no Site
                            </span>
                            <div className="p-1.5 rounded-lg bg-red-100 dark:bg-red-900/60 text-red-600 dark:text-red-300">
                              <Users className="w-4 h-4" />
                            </div>
                          </div>
                          <div className="mt-2 flex items-baseline gap-1.5">
                            <span className="text-2xl font-black text-slate-900 dark:text-white">
                              {userSessions[selectedSessionId]?.loginCount || 1}
                            </span>
                            <span className="text-xs font-bold text-slate-500 dark:text-slate-400">acesso(s)</span>
                          </div>
                          <p className="text-[10px] text-slate-400 mt-1">Total de vezes que entrou no WebGis</p>
                        </div>

                        <div className="bg-white dark:bg-slate-800/60 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 flex flex-col justify-between">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                              Primeiro Acesso
                            </span>
                            <Clock className="w-4 h-4 text-indigo-500" />
                          </div>
                          <div className="mt-2 font-mono text-xs font-black text-slate-800 dark:text-slate-200">
                            {userSessions[selectedSessionId]?.formattedFirstSeen || '-'}
                          </div>
                          <p className="text-[10px] text-slate-400 mt-1">Primeiro registro no sistema</p>
                        </div>

                        <div className="bg-white dark:bg-slate-800/60 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 flex flex-col justify-between">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                              Última Atividade
                            </span>
                            <Activity className="w-4 h-4 text-emerald-500" />
                          </div>
                          <div className="mt-2 font-mono text-xs font-black text-emerald-700 dark:text-emerald-400">
                            {userSessions[selectedSessionId]?.formattedLastSeen || '-'}
                          </div>
                          <p className="text-[10px] text-slate-400 mt-1">Visto online recentemente</p>
                        </div>
                      </div>

                      {/* CARD 2: 🔑 GERENCIAMENTO DE SENHA (EXCLUSIVO ADMINISTRADOR MASTER) */}
                      {isMaster && (
                        <div className="bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/60 p-4 rounded-2xl space-y-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <div className="p-1.5 rounded-lg bg-amber-100 dark:bg-amber-900/60 text-amber-700 dark:text-amber-300">
                                <Key className="w-4 h-4" />
                              </div>
                              <div>
                                <h4 className="text-xs font-black text-amber-950 dark:text-amber-200 flex items-center gap-1.5">
                                  <span>Controle de Senha do Visitante</span>
                                  <span className="text-[10px] font-black uppercase bg-amber-200 dark:bg-amber-800 text-amber-900 dark:text-amber-100 px-1.5 py-0.5 rounded">
                                    Apenas Master
                                  </span>
                                </h4>
                                <p className="text-[11px] text-amber-800/80 dark:text-amber-300/80">
                                  {userSessions[selectedSessionId]?.password
                                    ? 'Este visitante possui uma senha cadastrada. Você pode visualizá-la ou alterá-la.'
                                    : 'Este visitante entrou sem senha. Você pode definir uma senha para ele no banco de dados.'}
                                </p>
                              </div>
                            </div>
                          </div>

                          {userSessions[selectedSessionId]?.password ? (
                            <div className="space-y-3 pt-1">
                              {/* Visualização da Senha Atual */}
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-white dark:bg-slate-900 p-3 rounded-xl border border-amber-200/80 dark:border-amber-900/40">
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-bold text-slate-600 dark:text-slate-400">Senha Atual:</span>
                                  <span className="font-mono text-sm font-black text-slate-900 dark:text-white px-2.5 py-1 bg-slate-100 dark:bg-slate-800 rounded-lg select-all border border-slate-200 dark:border-slate-700">
                                    {showSelectedUserPassword ? userSessions[selectedSessionId]?.password : '••••••••••••'}
                                  </span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => setShowSelectedUserPassword(!showSelectedUserPassword)}
                                    className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 shadow-2xs"
                                  >
                                    {showSelectedUserPassword ? <EyeOff className="w-3.5 h-3.5 text-amber-600" /> : <Eye className="w-3.5 h-3.5 text-amber-600" />}
                                    <span>{showSelectedUserPassword ? 'Ocultar Senha' : 'Ver Senha'}</span>
                                  </button>
                                </div>
                              </div>

                              {/* Alterar Senha */}
                              <form onSubmit={handleSavePasswordForSession} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                                <input
                                  type="text"
                                  value={selectedUserPasswordInput}
                                  onChange={(e) => setSelectedUserPasswordInput(e.target.value)}
                                  placeholder="Digitar nova senha para este visitante..."
                                  className="flex-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-amber-500 font-mono"
                                />
                                <button
                                  type="submit"
                                  disabled={isUpdatingPassword}
                                  className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 transition-all shadow-xs cursor-pointer disabled:opacity-50"
                                >
                                  {isUpdatingPassword ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Key className="w-3.5 h-3.5" />}
                                  <span>Salvar Nova Senha no Supabase</span>
                                </button>
                              </form>
                            </div>
                          ) : (
                            <div className="space-y-3 pt-1">
                              <form onSubmit={handleSavePasswordForSession} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                                <input
                                  type="text"
                                  value={selectedUserPasswordInput}
                                  onChange={(e) => setSelectedUserPasswordInput(e.target.value)}
                                  placeholder="Definir uma senha para este visitante..."
                                  className="flex-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-amber-500 font-mono"
                                />
                                <button
                                  type="submit"
                                  disabled={isUpdatingPassword}
                                  className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 transition-all shadow-xs cursor-pointer disabled:opacity-50"
                                >
                                  {isUpdatingPassword ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                                  <span>Definir Senha no Supabase</span>
                                </button>
                              </form>
                            </div>
                          )}
                        </div>
                      )}

                      {/* CARD 3: ⚡ O QUE ELE FEZ NO SITE (ESTATÍSTICAS & HISTÓRICO COMPLETO) */}
                      <div className="bg-white dark:bg-slate-800/60 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-4">
                        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700/80 pb-3">
                          <div className="flex items-center gap-2">
                            <div className="p-1.5 rounded-lg bg-blue-100 dark:bg-blue-900/60 text-blue-600 dark:text-blue-300">
                              <Activity className="w-4 h-4" />
                            </div>
                            <div>
                              <h4 className="text-xs font-black text-slate-900 dark:text-slate-100">
                                O Que Ele Fez no Site (Resumo de Atividades)
                              </h4>
                              <p className="text-[11px] text-slate-500">
                                Ações e interações executadas por este visitante durante a navegação
                              </p>
                            </div>
                          </div>
                          <span className="text-xs font-black bg-slate-100 dark:bg-slate-700 px-2.5 py-1 rounded-xl text-slate-700 dark:text-slate-200">
                            {userActionStats.total} ações registradas
                          </span>
                        </div>

                        {/* Grade de Contadores de Ações */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2">
                          <div className="p-2.5 bg-blue-50 dark:bg-blue-950/40 rounded-xl border border-blue-100 dark:border-blue-900/40 text-center">
                            <span className="block text-base font-black text-blue-700 dark:text-blue-300">{userActionStats.searches}</span>
                            <span className="text-[10px] font-bold text-blue-900/70 dark:text-blue-300/70">🔍 Buscas</span>
                          </div>
                          <div className="p-2.5 bg-rose-50 dark:bg-rose-950/40 rounded-xl border border-rose-100 dark:border-rose-900/40 text-center">
                            <span className="block text-base font-black text-rose-700 dark:text-rose-300">{userActionStats.addresses}</span>
                            <span className="text-[10px] font-bold text-rose-900/70 dark:text-rose-300/70">📍 Endereços</span>
                          </div>
                          <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/40 rounded-xl border border-emerald-100 dark:border-emerald-900/40 text-center">
                            <span className="block text-base font-black text-emerald-700 dark:text-emerald-300">{userActionStats.layers}</span>
                            <span className="text-[10px] font-bold text-emerald-900/70 dark:text-emerald-300/70">🗺️ Camadas</span>
                          </div>
                          <div className="p-2.5 bg-amber-50 dark:bg-amber-950/40 rounded-xl border border-amber-100 dark:border-amber-900/40 text-center">
                            <span className="block text-base font-black text-amber-700 dark:text-amber-300">{userActionStats.features}</span>
                            <span className="text-[10px] font-bold text-amber-900/70 dark:text-amber-300/70">📌 Feições</span>
                          </div>
                          <div className="p-2.5 bg-purple-50 dark:bg-purple-950/40 rounded-xl border border-purple-100 dark:border-purple-900/40 text-center">
                            <span className="block text-base font-black text-purple-700 dark:text-purple-300">{userActionStats.exports}</span>
                            <span className="text-[10px] font-bold text-purple-900/70 dark:text-purple-300/70">📥 Exportações</span>
                          </div>
                          <div className="p-2.5 bg-cyan-50 dark:bg-cyan-950/40 rounded-xl border border-cyan-100 dark:border-cyan-900/40 text-center">
                            <span className="block text-base font-black text-cyan-700 dark:text-cyan-300">{userActionStats.measures}</span>
                            <span className="text-[10px] font-bold text-cyan-900/70 dark:text-cyan-300/70">📐 Medições</span>
                          </div>
                          <div className="p-2.5 bg-indigo-50 dark:bg-indigo-950/40 rounded-xl border border-indigo-100 dark:border-indigo-900/40 text-center">
                            <span className="block text-base font-black text-indigo-700 dark:text-indigo-300">{userActionStats.prints}</span>
                            <span className="text-[10px] font-bold text-indigo-900/70 dark:text-indigo-300/70">🖨️ Impressões</span>
                          </div>
                        </div>

                        {/* Timeline de Atividades */}
                        <div className="space-y-2 pt-2">
                          <span className="text-xs font-extrabold uppercase tracking-wider text-slate-700 dark:text-slate-300 block">
                            Histórico Cronológico de Ações:
                          </span>
                          {isLoadingUserLogs ? (
                            <div className="p-6 text-center text-slate-400 flex items-center justify-center gap-2">
                              <Loader2 className="w-4 h-4 animate-spin text-red-600" />
                              <span className="text-xs font-bold">Carregando histórico detalhado do banco...</span>
                            </div>
                          ) : selectedUserLogs.length > 0 ? (
                            <div className="max-h-56 overflow-y-auto custom-scrollbar divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50/50 dark:bg-slate-900/50">
                              {selectedUserLogs.map((log) => (
                                <div key={log.id} className="p-3 flex items-start gap-2.5 hover:bg-slate-100/50 dark:hover:bg-slate-800/40 transition-colors">
                                  {renderCategoryBadge(log.category)}
                                  <div className="flex-1 min-w-0 space-y-0.5">
                                    <p className="text-xs font-bold text-slate-800 dark:text-slate-200 leading-snug">{log.action}</p>
                                    {log.details && (
                                      <p className="text-[11px] text-slate-500 font-mono">{log.details}</p>
                                    )}
                                  </div>
                                  <span className="text-[10px] text-slate-400 font-mono shrink-0">{log.formattedDate}</span>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="p-6 text-center text-slate-400 border border-dashed border-slate-200 dark:border-slate-700 rounded-xl">
                              <p className="text-xs font-bold">Nenhuma ação detalhada registrada além do login inicial no mapa.</p>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Configurações Básicas do Usuário (Nome e Bloqueio) */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Atribuir Nome/Apelido */}
                        <div className="bg-white dark:bg-slate-800/60 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-2">
                          <label className="block text-xs font-extrabold text-slate-700 dark:text-slate-300">
                            Atribuir Nome / Identificação ao Usuário:
                          </label>
                          <div className="flex items-center gap-2">
                            <input
                              type="text"
                              value={editingUserName}
                              onChange={(e) => setEditingUserName(e.target.value)}
                              placeholder="Ex: Fiscal Teresina, Secretaria X, Pesquisador..."
                              className="flex-1 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-red-500"
                            />
                          </div>
                          <p className="text-[11px] text-slate-400">
                            Isso ajuda você a saber exatamente quem é o visitante nos registros e relatórios.
                          </p>
                        </div>

                        {/* Bloqueio / Desbloqueio de Acesso */}
                        <div className={`p-4 rounded-2xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${userIsBlocked
                            ? 'bg-red-50 dark:bg-red-950/40 border-red-300 dark:border-red-800'
                            : 'bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900/50'
                          }`}>
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <h4 className="text-xs font-black text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                                {userIsBlocked ? (
                                  <>
                                    <ShieldAlert className="w-4 h-4 text-red-600" />
                                    <span>Status: Visitante Bloqueado</span>
                                  </>
                                ) : (
                                  <>
                                    <Check className="w-4 h-4 text-emerald-600" />
                                    <span>Status: Acesso Autorizado</span>
                                  </>
                                )}
                              </h4>
                            </div>
                            <p className="text-[11px] text-slate-500">
                              {userIsBlocked ? 'Este visitante está impedido de carregar dados do WebGis.' : 'O visitante pode navegar de acordo com as permissões.'}
                            </p>
                          </div>

                          <button
                            type="button"
                            onClick={() => setUserIsBlocked(!userIsBlocked)}
                            className={`px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${userIsBlocked
                                ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs'
                                : 'bg-red-600 hover:bg-red-700 text-white shadow-xs'
                              }`}
                          >
                            {userIsBlocked ? 'Desbloquear Visitante' : 'Bloquear Acesso'}
                          </button>
                        </div>
                      </div>

                      {/* Configuração de Permissões Individuais */}
                      <div className="bg-slate-50 dark:bg-slate-800/40 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-4">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-700 pb-3">
                          <div>
                            <h4 className="text-xs font-black text-slate-900 dark:text-slate-100">
                              Tipo de Regra de Permissões para Esta Sessão:
                            </h4>
                            <p className="text-[11px] text-slate-500">
                              {userIsCustom
                                ? 'Permissões exclusivas configuradas para este visitante.'
                                : 'Herdando as permissões globais padrão definidas nas outras abas.'}
                            </p>
                          </div>

                          <div className="flex items-center gap-1 bg-slate-200 dark:bg-slate-700 p-1 rounded-xl">
                            <button
                              type="button"
                              onClick={() => setUserIsCustom(false)}
                              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${!userIsCustom
                                  ? 'bg-white dark:bg-slate-900 text-red-600 shadow-xs'
                                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                                }`}
                            >
                              Padrão Global
                            </button>
                            <button
                              type="button"
                              onClick={() => setUserIsCustom(true)}
                              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${userIsCustom
                                  ? 'bg-red-600 text-white shadow-xs'
                                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                                }`}
                            >
                              Personalizado (Exclusivo)
                            </button>
                          </div>
                        </div>

                        {userIsCustom && (
                          <div className="space-y-4 pt-2 animate-fadeIn">
                            {/* Camadas para esta sessão */}
                            <div>
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-xs font-extrabold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                                  Camadas Liberadas ({Object.values(userCustomLayers).filter(Boolean).length}/{dataSources.length})
                                </span>
                                <div className="flex items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const allOn: Record<string, boolean> = {};
                                      dataSources.forEach(s => allOn[s.name] = true);
                                      setUserCustomLayers(allOn);
                                    }}
                                    className="text-[11px] font-bold text-red-600 hover:underline cursor-pointer"
                                  >
                                    Liberar Todas
                                  </button>
                                  <span className="text-slate-300">•</span>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const allOff: Record<string, boolean> = {};
                                      dataSources.forEach(s => allOff[s.name] = false);
                                      setUserCustomLayers(allOff);
                                    }}
                                    className="text-[11px] font-bold text-slate-500 hover:underline cursor-pointer"
                                  >
                                    Bloquear Todas
                                  </button>
                                </div>
                              </div>

                              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                                {dataSources.map(source => {
                                  const isAllowed = userCustomLayers[source.name] !== false;
                                  return (
                                    <div
                                      key={source.name}
                                      onClick={() => handleToggleUserLayer(source.name)}
                                      className={`p-2.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${isAllowed
                                          ? 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 shadow-2xs'
                                          : 'bg-slate-100 dark:bg-slate-950 border-slate-200/50 dark:border-slate-800/50 opacity-50'
                                        }`}
                                    >
                                      <div className="flex items-center gap-2 pr-2 truncate">
                                        <div className={`w-3 h-3 rounded-full shrink-0 ${isAllowed ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                                        <span className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">{source.name}</span>
                                      </div>
                                      <input
                                        type="checkbox"
                                        checked={isAllowed}
                                        onChange={() => { }}
                                        className="w-4 h-4 rounded text-red-600 focus:ring-red-500 cursor-pointer"
                                      />
                                    </div>
                                  );
                                })}
                              </div>
                            </div>

                            {/* Ferramentas para esta sessão */}
                            <div>
                              <span className="text-xs font-extrabold uppercase tracking-wider text-slate-700 dark:text-slate-300 block mb-2">
                                Ferramentas & Recursos Liberados
                              </span>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                <div
                                  onClick={() => handleToggleUserFeature('allowCnefeSearch')}
                                  className={`p-2.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between text-xs ${userCustomFeatures.allowCnefeSearch !== false
                                      ? 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 font-bold text-slate-800 dark:text-slate-200'
                                      : 'bg-slate-100 dark:bg-slate-950 border-slate-200/50 opacity-50'
                                    }`}
                                >
                                  <span>Busca de Endereços CNEFE</span>
                                  <input type="checkbox" checked={userCustomFeatures.allowCnefeSearch !== false} onChange={() => { }} className="w-4 h-4 rounded text-red-600" />
                                </div>

                                <div
                                  onClick={() => handleToggleUserFeature('allowExportData')}
                                  className={`p-2.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between text-xs ${userCustomFeatures.allowExportData !== false
                                      ? 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 font-bold text-slate-800 dark:text-slate-200'
                                      : 'bg-slate-100 dark:bg-slate-950 border-slate-200/50 opacity-50'
                                    }`}
                                >
                                  <span>Exportação de Dados</span>
                                  <input type="checkbox" checked={userCustomFeatures.allowExportData !== false} onChange={() => { }} className="w-4 h-4 rounded text-red-600" />
                                </div>

                                <div
                                  onClick={() => handleToggleUserFeature('allowMeasureTool')}
                                  className={`p-2.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between text-xs ${userCustomFeatures.allowMeasureTool !== false
                                      ? 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 font-bold text-slate-800 dark:text-slate-200'
                                      : 'bg-slate-100 dark:bg-slate-950 border-slate-200/50 opacity-50'
                                    }`}
                                >
                                  <span>Ferramenta de Medição</span>
                                  <input type="checkbox" checked={userCustomFeatures.allowMeasureTool !== false} onChange={() => { }} className="w-4 h-4 rounded text-red-600" />
                                </div>

                                <div
                                  onClick={() => handleToggleUserFeature('allowPrintA4')}
                                  className={`p-2.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between text-xs ${userCustomFeatures.allowPrintA4 !== false
                                      ? 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 font-bold text-slate-800 dark:text-slate-200'
                                      : 'bg-slate-100 dark:bg-slate-950 border-slate-200/50 opacity-50'
                                    }`}
                                >
                                  <span>Impressão de Mapas</span>
                                  <input type="checkbox" checked={userCustomFeatures.allowPrintA4 !== false} onChange={() => { }} className="w-4 h-4 rounded text-red-600" />
                                </div>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    /* LISTA DE SESSÕES DE VISITANTES RECENTES (ORDENADAS PELO MAIS RECENTE) */
                    <div className="space-y-4">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50 dark:bg-slate-800/60 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800">
                        <div className="relative flex-1">
                          <input
                            type="text"
                            placeholder="Filtrar por nome ou ID de sessão..."
                            value={userSearchTerm}
                            onChange={(e) => setUserSearchTerm(e.target.value)}
                            className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl pl-8 pr-3 py-2 text-xs text-slate-800 dark:text-slate-100 outline-none focus:ring-1 focus:ring-red-500"
                          />
                          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                        </div>
                      </div>

                      <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden max-h-[440px] overflow-y-auto custom-scrollbar">
                        {filteredUserSessions.length > 0 ? (
                          <div className="divide-y divide-slate-100 dark:divide-slate-800/80 bg-white dark:bg-slate-900">
                            {filteredUserSessions.map(session => (
                              <div
                                key={session.sessionId}
                                onClick={() => handleSelectUser(session.sessionId)}
                                className="p-4 hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer group"
                              >
                                <div className="flex items-center gap-3.5 min-w-0">
                                  <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 flex items-center justify-center font-bold text-xs shrink-0 group-hover:bg-red-50 group-hover:text-red-600 dark:group-hover:bg-red-950/50 dark:group-hover:text-red-400 transition-colors">
                                    <User className="w-5 h-5" />
                                  </div>
                                  <div className="space-y-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <h4 className="text-sm font-black text-slate-900 dark:text-slate-100 truncate group-hover:text-red-600 dark:group-hover:text-red-400 transition-colors">
                                        {session.customName || `Visitante (${session.sessionId.substring(0, 10)}...)`}
                                      </h4>
                                      <span className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[10px] font-black px-2 py-0.5 rounded-full border border-slate-200 dark:border-slate-700 flex items-center gap-1">
                                        <Users className="w-3 h-3 text-red-500" />
                                        {session.loginCount || 1} acesso(s)
                                      </span>
                                      {session.isBlocked ? (
                                        <span className="bg-red-600 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full">
                                          BLOQUEADO
                                        </span>
                                      ) : (
                                        <span className="bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 text-[9px] font-black px-1.5 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
                                          ATIVO
                                        </span>
                                      )}
                                      {session.password ? (
                                        <span className="bg-amber-50 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 text-[9px] font-black px-1.5 py-0.5 rounded-full border border-amber-200 dark:border-amber-800 flex items-center gap-0.5">
                                          <Lock className="w-2.5 h-2.5" /> COM SENHA
                                        </span>
                                      ) : (
                                        <span className="bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400 text-[9px] font-bold px-1.5 py-0.5 rounded-full">
                                          SEM SENHA
                                        </span>
                                      )}
                                      {session.hasCustomPermissions && (
                                        <span className="bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 text-[9px] font-black px-1.5 py-0.5 rounded-full border border-amber-300 dark:border-amber-700">
                                          ⭐ PERMISSÕES INDIVIDUAIS
                                        </span>
                                      )}
                                    </div>
                                    <p className="text-xs text-slate-400 font-mono">
                                      ID: {session.sessionId} • Visto: {session.formattedLastSeen || session.formattedFirstSeen || '-'}
                                    </p>
                                  </div>
                                </div>

                                {isMaster && (
                                  <div className="flex items-center gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
                                    <button
                                      type="button"
                                      onClick={() => handleSelectUser(session.sessionId)}
                                      className="px-3.5 py-2 bg-red-50 hover:bg-red-600 hover:text-white dark:bg-red-950/40 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-900 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs"
                                    >
                                      <Sliders className="w-3.5 h-3.5" />
                                      <span>Ver Dossiê / Detalhes</span>
                                    </button>

                                    <button
                                      type="button"
                                      onClick={() => handleDeleteUser(session.sessionId)}
                                      className="p-2 text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-xl transition-colors cursor-pointer"
                                      title="Remover sessão"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  </div>
                                )}

                                {isManager && (
                                  <div className="flex items-center gap-2 shrink-0">
                                    <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-xl flex items-center gap-1.5 border border-slate-200 dark:border-slate-700">
                                      <Clock className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                                      <span>1º Acesso: {session.formattedFirstSeen || '-'}</span>
                                    </span>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="p-10 text-center text-slate-400">
                            <p className="font-bold text-sm">Nenhuma sessão encontrada.</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ================= ABA 2: PERMISSÕES GLOBAIS DE CAMADAS ================= */}
          {activeTab === 'layers' && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-200 dark:border-slate-800">
                <div>
                  <h3 className="text-sm font-black text-slate-800 dark:text-slate-100">
                    Visibilidade Global Padrão das Camadas
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Estas regras se aplicam a todos os visitantes comuns que não tiverem uma permissão individual customizada.
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleToggleAllGlobalLayers(true)}
                    className="px-3 py-1.5 text-xs font-bold bg-white dark:bg-slate-900 hover:bg-red-50 dark:hover:bg-red-950/50 text-red-700 dark:text-red-400 border border-slate-200 dark:border-slate-700 rounded-xl transition-all cursor-pointer"
                  >
                    Liberar Todas
                  </button>
                  <button
                    type="button"
                    onClick={() => handleToggleAllGlobalLayers(false)}
                    className="px-3 py-1.5 text-xs font-bold bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 rounded-xl transition-all cursor-pointer"
                  >
                    Bloquear Todas
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {dataSources.map(source => {
                  const isAllowed = localLayerPerms[source.name] !== false;
                  return (
                    <div
                      key={source.name}
                      onClick={() => handleToggleGlobalLayer(source.name)}
                      className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-center justify-between group ${isAllowed
                          ? 'bg-white dark:bg-slate-800/90 border-slate-200 dark:border-slate-700 hover:border-emerald-500 shadow-2xs'
                          : 'bg-slate-50 dark:bg-slate-950/60 border-slate-200/60 dark:border-slate-800/60 opacity-65 hover:opacity-100 hover:border-red-400'
                        }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-3 h-3 rounded-full transition-all ${isAllowed ? 'bg-emerald-500 shadow-xs ring-2 ring-emerald-500/20' : 'bg-slate-400'}`} />
                        <div>
                          <h4 className="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-100">{source.name}</h4>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="text-[10px] text-slate-400 font-mono">{(source as any).type ? (source as any).type.toUpperCase() : 'GEOJSON'}</span>
                            <span className="text-[10px] text-slate-300 dark:text-slate-600">•</span>
                            <span className={`text-[10px] font-bold ${isAllowed ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500 dark:text-rose-400'}`}>
                              {isAllowed ? 'Visível para Visitantes' : 'Oculta / Bloqueada'}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* iOS Style Switch Toggle */}
                      <div className="relative inline-flex items-center shrink-0">
                        <div className={`w-11 h-6 transition-colors rounded-full relative p-0.5 ${isAllowed ? 'bg-emerald-600' : 'bg-slate-300 dark:bg-slate-700'}`}>
                          <div className={`w-5 h-5 bg-white rounded-full shadow-md transition-transform transform ${isAllowed ? 'translate-x-5' : 'translate-x-0'}`} />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ================= ABA 3: PERMISSÕES GLOBAIS DE FERRAMENTAS ================= */}
          {activeTab === 'features' && (
            <div className="space-y-4">
              <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-200 dark:border-slate-800">
                <h3 className="text-sm font-black text-slate-800 dark:text-slate-100">
                  Módulos, Ferramentas e Dashboards Habilitados Globalmente
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Controle a visibilidade de painéis, dashboards, exportação e ferramentas para visitantes gerais.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {/* 1. Busca de Endereços CNEFE */}
                <div
                  onClick={() => handleToggleGlobalFeature('allowCnefeSearch')}
                  className={`p-4 rounded-2xl border transition-all cursor-pointer flex items-center justify-between group ${localFeaturePerms.allowCnefeSearch !== false
                      ? 'bg-white dark:bg-slate-800/90 border-slate-200 dark:border-slate-700 hover:border-emerald-500 shadow-2xs'
                      : 'bg-slate-50 dark:bg-slate-950/60 border-slate-200/60 dark:border-slate-800/60 opacity-65 hover:opacity-100 hover:border-red-400'
                    }`}
                >
                  <div className="pr-3">
                    <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                      <Search className="w-4 h-4 text-red-600" />
                      Busca de Endereços CNEFE (IBGE)
                    </h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      Permite consultar a base de milhões de endereços do Piauí via DuckDB.
                    </p>
                  </div>
                  <div className="relative inline-flex items-center shrink-0">
                    <div className={`w-11 h-6 transition-colors rounded-full relative p-0.5 ${localFeaturePerms.allowCnefeSearch !== false ? 'bg-emerald-600' : 'bg-slate-300 dark:bg-slate-700'}`}>
                      <div className={`w-5 h-5 bg-white rounded-full shadow-md transition-transform transform ${localFeaturePerms.allowCnefeSearch !== false ? 'translate-x-5' : 'translate-x-0'}`} />
                    </div>
                  </div>
                </div>

                {/* 2. Dashboard Raio-X Territorial */}
                <div
                  onClick={() => handleToggleGlobalFeature('allowDashboardRaioX')}
                  className={`p-4 rounded-2xl border transition-all cursor-pointer flex items-center justify-between group ${localFeaturePerms.allowDashboardRaioX !== false
                      ? 'bg-white dark:bg-slate-800/90 border-slate-200 dark:border-slate-700 hover:border-emerald-500 shadow-2xs'
                      : 'bg-slate-50 dark:bg-slate-950/60 border-slate-200/60 dark:border-slate-800/60 opacity-65 hover:opacity-100 hover:border-red-400'
                    }`}
                >
                  <div className="pr-3">
                    <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                      <BarChart3 className="w-4 h-4 text-red-600" />
                      Dashboard Raio-X Territorial e Domiciliar
                    </h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      Exibe o painel de estatísticas demográficas, domicílios, alfabetização e pirâmide etária.
                    </p>
                  </div>
                  <div className="relative inline-flex items-center shrink-0">
                    <div className={`w-11 h-6 transition-colors rounded-full relative p-0.5 ${localFeaturePerms.allowDashboardRaioX !== false ? 'bg-emerald-600' : 'bg-slate-300 dark:bg-slate-700'}`}>
                      <div className={`w-5 h-5 bg-white rounded-full shadow-md transition-transform transform ${localFeaturePerms.allowDashboardRaioX !== false ? 'translate-x-5' : 'translate-x-0'}`} />
                    </div>
                  </div>
                </div>

                {/* 3. Painel de Feições Selecionadas */}
                <div
                  onClick={() => handleToggleGlobalFeature('allowSelectedFeaturesPanel')}
                  className={`p-4 rounded-2xl border transition-all cursor-pointer flex items-center justify-between group ${localFeaturePerms.allowSelectedFeaturesPanel !== false
                      ? 'bg-white dark:bg-slate-800/90 border-slate-200 dark:border-slate-700 hover:border-emerald-500 shadow-2xs'
                      : 'bg-slate-50 dark:bg-slate-950/60 border-slate-200/60 dark:border-slate-800/60 opacity-65 hover:opacity-100 hover:border-red-400'
                    }`}
                >
                  <div className="pr-3">
                    <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                      <ListTree className="w-4 h-4 text-red-600" />
                      Painel de Feições Selecionadas
                    </h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      Exibe os chips e badges com as feições clicadas ou pesquisadas ativas.
                    </p>
                  </div>
                  <div className="relative inline-flex items-center shrink-0">
                    <div className={`w-11 h-6 transition-colors rounded-full relative p-0.5 ${localFeaturePerms.allowSelectedFeaturesPanel !== false ? 'bg-emerald-600' : 'bg-slate-300 dark:bg-slate-700'}`}>
                      <div className={`w-5 h-5 bg-white rounded-full shadow-md transition-transform transform ${localFeaturePerms.allowSelectedFeaturesPanel !== false ? 'translate-x-5' : 'translate-x-0'}`} />
                    </div>
                  </div>
                </div>

                {/* 4. Especificações das Feições */}
                <div
                  onClick={() => handleToggleGlobalFeature('allowFeatureSpecs')}
                  className={`p-4 rounded-2xl border transition-all cursor-pointer flex items-center justify-between group ${localFeaturePerms.allowFeatureSpecs !== false
                      ? 'bg-white dark:bg-slate-800/90 border-slate-200 dark:border-slate-700 hover:border-emerald-500 shadow-2xs'
                      : 'bg-slate-50 dark:bg-slate-950/60 border-slate-200/60 dark:border-slate-800/60 opacity-65 hover:opacity-100 hover:border-red-400'
                    }`}
                >
                  <div className="pr-3">
                    <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                      <FileCode className="w-4 h-4 text-red-600" />
                      Especificações das Feições (Atributos)
                    </h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      Tabela detalhada de atributos geográficos, área, perímetro, centróide e dados censitários.
                    </p>
                  </div>
                  <div className="relative inline-flex items-center shrink-0">
                    <div className={`w-11 h-6 transition-colors rounded-full relative p-0.5 ${localFeaturePerms.allowFeatureSpecs !== false ? 'bg-emerald-600' : 'bg-slate-300 dark:bg-slate-700'}`}>
                      <div className={`w-5 h-5 bg-white rounded-full shadow-md transition-transform transform ${localFeaturePerms.allowFeatureSpecs !== false ? 'translate-x-5' : 'translate-x-0'}`} />
                    </div>
                  </div>
                </div>

                {/* 5. Central de Exportação de Dados */}
                <div
                  onClick={() => handleToggleGlobalFeature('allowExportData')}
                  className={`p-4 rounded-2xl border transition-all cursor-pointer flex items-center justify-between group ${localFeaturePerms.allowExportData !== false
                      ? 'bg-white dark:bg-slate-800/90 border-slate-200 dark:border-slate-700 hover:border-emerald-500 shadow-2xs'
                      : 'bg-slate-50 dark:bg-slate-950/60 border-slate-200/60 dark:border-slate-800/60 opacity-65 hover:opacity-100 hover:border-red-400'
                    }`}
                >
                  <div className="pr-3">
                    <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                      <Download className="w-4 h-4 text-red-600" />
                      Central de Exportação de Dados
                    </h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      Dashboard dedicado para exportar feições em CSV (Excel), KML (Google Earth/QGIS) e GeoJSON.
                    </p>
                  </div>
                  <div className="relative inline-flex items-center shrink-0">
                    <div className={`w-11 h-6 transition-colors rounded-full relative p-0.5 ${localFeaturePerms.allowExportData !== false ? 'bg-emerald-600' : 'bg-slate-300 dark:bg-slate-700'}`}>
                      <div className={`w-5 h-5 bg-white rounded-full shadow-md transition-transform transform ${localFeaturePerms.allowExportData !== false ? 'translate-x-5' : 'translate-x-0'}`} />
                    </div>
                  </div>
                </div>

                {/* 6. Painel de Camadas */}
                <div
                  onClick={() => handleToggleGlobalFeature('allowLayerPanel')}
                  className={`p-4 rounded-2xl border transition-all cursor-pointer flex items-center justify-between group ${localFeaturePerms.allowLayerPanel !== false
                      ? 'bg-white dark:bg-slate-800/90 border-slate-200 dark:border-slate-700 hover:border-emerald-500 shadow-2xs'
                      : 'bg-slate-50 dark:bg-slate-950/60 border-slate-200/60 dark:border-slate-800/60 opacity-65 hover:opacity-100 hover:border-red-400'
                    }`}
                >
                  <div className="pr-3">
                    <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                      <Layers className="w-4 h-4 text-red-600" />
                      Acesso ao Painel de Camadas
                    </h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      Permite aos visitantes abrir o controle de camadas, reordenar e personalizar estilos.
                    </p>
                  </div>
                  <div className="relative inline-flex items-center shrink-0">
                    <div className={`w-11 h-6 transition-colors rounded-full relative p-0.5 ${localFeaturePerms.allowLayerPanel !== false ? 'bg-emerald-600' : 'bg-slate-300 dark:bg-slate-700'}`}>
                      <div className={`w-5 h-5 bg-white rounded-full shadow-md transition-transform transform ${localFeaturePerms.allowLayerPanel !== false ? 'translate-x-5' : 'translate-x-0'}`} />
                    </div>
                  </div>
                </div>

                {/* 7. Opção Pesquisar Apenas em Camadas Ativas */}
                <div
                  onClick={() => handleToggleGlobalFeature('allowSearchActiveLayersOnly')}
                  className={`p-4 rounded-2xl border transition-all cursor-pointer flex items-center justify-between group ${localFeaturePerms.allowSearchActiveLayersOnly !== false
                      ? 'bg-white dark:bg-slate-800/90 border-slate-200 dark:border-slate-700 hover:border-emerald-500 shadow-2xs'
                      : 'bg-slate-50 dark:bg-slate-950/60 border-slate-200/60 dark:border-slate-800/60 opacity-65 hover:opacity-100 hover:border-red-400'
                    }`}
                >
                  <div className="pr-3">
                    <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                      <Filter className="w-4 h-4 text-red-600" />
                      Opção "Apenas nas Camadas Ativas"
                    </h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      Permite filtrar a barra de pesquisa superior somente pelas camadas visíveis no mapa.
                    </p>
                  </div>
                  <div className="relative inline-flex items-center shrink-0">
                    <div className={`w-11 h-6 transition-colors rounded-full relative p-0.5 ${localFeaturePerms.allowSearchActiveLayersOnly !== false ? 'bg-emerald-600' : 'bg-slate-300 dark:bg-slate-700'}`}>
                      <div className={`w-5 h-5 bg-white rounded-full shadow-md transition-transform transform ${localFeaturePerms.allowSearchActiveLayersOnly !== false ? 'translate-x-5' : 'translate-x-0'}`} />
                    </div>
                  </div>
                </div>

                {/* 8. Fontes e Parceiros no Rodapé */}
                <div
                  onClick={() => handleToggleGlobalFeature('allowSourcesFooter')}
                  className={`p-4 rounded-2xl border transition-all cursor-pointer flex items-center justify-between group ${localFeaturePerms.allowSourcesFooter !== false
                      ? 'bg-white dark:bg-slate-800/90 border-slate-200 dark:border-slate-700 hover:border-emerald-500 shadow-2xs'
                      : 'bg-slate-50 dark:bg-slate-950/60 border-slate-200/60 dark:border-slate-800/60 opacity-65 hover:opacity-100 hover:border-red-400'
                    }`}
                >
                  <div className="pr-3">
                    <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                      <BookOpen className="w-4 h-4 text-red-600" />
                      Painel de Fontes e Dados (Rodapé)
                    </h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      Exibe o bloco de metadados, fontes oficiais (IBGE, SEPLAN, DER) e parceiros institucionais.
                    </p>
                  </div>
                  <div className="relative inline-flex items-center shrink-0">
                    <div className={`w-11 h-6 transition-colors rounded-full relative p-0.5 ${localFeaturePerms.allowSourcesFooter !== false ? 'bg-emerald-600' : 'bg-slate-300 dark:bg-slate-700'}`}>
                      <div className={`w-5 h-5 bg-white rounded-full shadow-md transition-transform transform ${localFeaturePerms.allowSourcesFooter !== false ? 'translate-x-5' : 'translate-x-0'}`} />
                    </div>
                  </div>
                </div>

                {/* 9. Ferramenta de Medição */}
                <div
                  onClick={() => handleToggleGlobalFeature('allowMeasureTool')}
                  className={`p-4 rounded-2xl border transition-all cursor-pointer flex items-center justify-between group ${localFeaturePerms.allowMeasureTool !== false
                      ? 'bg-white dark:bg-slate-800/90 border-slate-200 dark:border-slate-700 hover:border-emerald-500 shadow-2xs'
                      : 'bg-slate-50 dark:bg-slate-950/60 border-slate-200/60 dark:border-slate-800/60 opacity-65 hover:opacity-100 hover:border-red-400'
                    }`}
                >
                  <div className="pr-3">
                    <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                      <Ruler className="w-4 h-4 text-red-600" />
                      Ferramenta de Medição de Áreas
                    </h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      Permite medir distâncias em km/m e áreas em hectares no mapa.
                    </p>
                  </div>
                  <div className="relative inline-flex items-center shrink-0">
                    <div className={`w-11 h-6 transition-colors rounded-full relative p-0.5 ${localFeaturePerms.allowMeasureTool !== false ? 'bg-emerald-600' : 'bg-slate-300 dark:bg-slate-700'}`}>
                      <div className={`w-5 h-5 bg-white rounded-full shadow-md transition-transform transform ${localFeaturePerms.allowMeasureTool !== false ? 'translate-x-5' : 'translate-x-0'}`} />
                    </div>
                  </div>
                </div>

                {/* 10. Modo de Impressão A4 */}
                <div
                  onClick={() => handleToggleGlobalFeature('allowPrintA4')}
                  className={`p-4 rounded-2xl border transition-all cursor-pointer flex items-center justify-between group ${localFeaturePerms.allowPrintA4 !== false
                      ? 'bg-white dark:bg-slate-800/90 border-slate-200 dark:border-slate-700 hover:border-emerald-500 shadow-2xs'
                      : 'bg-slate-50 dark:bg-slate-950/60 border-slate-200/60 dark:border-slate-800/60 opacity-65 hover:opacity-100 hover:border-red-400'
                    }`}
                >
                  <div className="pr-3">
                    <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                      <Printer className="w-4 h-4 text-red-600" />
                      Modo de Impressão A4 / PDF
                    </h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      Permite gerar mapas formatados para relatórios técnicos impressos.
                    </p>
                  </div>
                  <div className="relative inline-flex items-center shrink-0">
                    <div className={`w-11 h-6 transition-colors rounded-full relative p-0.5 ${localFeaturePerms.allowPrintA4 !== false ? 'bg-emerald-600' : 'bg-slate-300 dark:bg-slate-700'}`}>
                      <div className={`w-5 h-5 bg-white rounded-full shadow-md transition-transform transform ${localFeaturePerms.allowPrintA4 !== false ? 'translate-x-5' : 'translate-x-0'}`} />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ================= ABA 4: CONTROLE DE COLUNAS E ATRIBUTOS ================= */}
          {activeTab === 'columns' && (
            <div className="space-y-6 animate-fadeIn">
              <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-200 dark:border-slate-800">
                <h3 className="text-sm font-black text-slate-800 dark:text-slate-100 flex items-center gap-2">
                  <TableProperties className="w-4 h-4 text-red-600" />
                  Controle de Visibilidade de Colunas e Linhas de Dados
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Restrinja ou libere informações confidenciais ocultando colunas específicas da busca de endereços CNEFE e atributos da tabela de especificações.
                </p>
              </div>

              {/* SEÇÃO 1: COLUNAS CNEFE */}
              <div className="bg-white dark:bg-slate-800/80 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-3.5 shadow-xs">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-700 pb-3">
                  <div>
                    <h4 className="text-sm font-black text-slate-800 dark:text-slate-100 flex items-center gap-2">
                      <FileSpreadsheet className="w-4 h-4 text-red-600" />
                      Colunas da Tabela de Endereços CNEFE (IBGE)
                    </h4>
                    <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                      {Object.values(localAddressColumns).filter(v => v !== false).length} de {ALL_ADDRESS_COLUMNS.length} colunas ativas para visitantes
                    </span>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleToggleAllGlobalAddressColumns(true)}
                      className="px-3 py-1.5 text-xs font-bold bg-slate-100 hover:bg-red-50 dark:bg-slate-700 dark:hover:bg-red-950/50 text-red-600 dark:text-red-400 rounded-xl transition-all cursor-pointer flex items-center gap-1.5"
                    >
                      <CheckSquare className="w-3.5 h-3.5" />
                      Ativar Todas
                    </button>
                    <button
                      type="button"
                      onClick={() => handleToggleAllGlobalAddressColumns(false)}
                      className="px-3 py-1.5 text-xs font-bold bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-300 rounded-xl transition-all cursor-pointer flex items-center gap-1.5"
                    >
                      <Square className="w-3.5 h-3.5" />
                      Desativar Todas
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                  {ALL_ADDRESS_COLUMNS.map(col => {
                    const isAllowed = localAddressColumns[col.key] !== false;
                    return (
                      <div
                        key={`global-col-${col.key}`}
                        onClick={() => handleToggleGlobalAddressColumn(col.key)}
                        className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between text-xs ${
                          isAllowed
                            ? 'bg-slate-50/80 dark:bg-slate-900/80 border-slate-200 dark:border-slate-700 hover:border-red-500 shadow-2xs'
                            : 'bg-slate-100/50 dark:bg-slate-950/60 border-slate-200/40 dark:border-slate-800/40 opacity-50'
                        }`}
                      >
                        <div className="pr-2 truncate">
                          <span className="font-bold text-slate-800 dark:text-slate-200 block truncate" title={col.label}>
                            {col.label}
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono">{col.key}</span>
                        </div>
                        <input
                          type="checkbox"
                          checked={isAllowed}
                          onChange={() => {}}
                          className="w-4 h-4 rounded text-red-600 focus:ring-red-500 cursor-pointer shrink-0"
                        />
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* SEÇÃO 2: PROPRIEDADES E ATRIBUTOS DAS FEIÇÕES */}
              <div className="bg-white dark:bg-slate-800/80 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-3.5 shadow-xs">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-700 pb-3">
                  <div>
                    <h4 className="text-sm font-black text-slate-800 dark:text-slate-100 flex items-center gap-2">
                      <FileText className="w-4 h-4 text-red-600" />
                      Propriedades e Linhas da Tabela de Especificações das Feições
                    </h4>
                    <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                      {Object.values(localFeatureProperties).filter(v => v !== false).length} de {ALL_FEATURE_PROPERTIES.length} atributos ativos para visitantes
                    </span>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleToggleAllGlobalFeatureProperties(true)}
                      className="px-3 py-1.5 text-xs font-bold bg-slate-100 hover:bg-red-50 dark:bg-slate-700 dark:hover:bg-red-950/50 text-red-600 dark:text-red-400 rounded-xl transition-all cursor-pointer flex items-center gap-1.5"
                    >
                      <CheckSquare className="w-3.5 h-3.5" />
                      Ativar Todas
                    </button>
                    <button
                      type="button"
                      onClick={() => handleToggleAllGlobalFeatureProperties(false)}
                      className="px-3 py-1.5 text-xs font-bold bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-300 rounded-xl transition-all cursor-pointer flex items-center gap-1.5"
                    >
                      <Square className="w-3.5 h-3.5" />
                      Desativar Todas
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                  {ALL_FEATURE_PROPERTIES.map(prop => {
                    const isAllowed = localFeatureProperties[prop.key] !== false;
                    return (
                      <div
                        key={`global-prop-${prop.key}`}
                        onClick={() => handleToggleGlobalFeatureProperty(prop.key)}
                        className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between text-xs ${
                          isAllowed
                            ? 'bg-slate-50/80 dark:bg-slate-900/80 border-slate-200 dark:border-slate-700 hover:border-red-500 shadow-2xs'
                            : 'bg-slate-100/50 dark:bg-slate-950/60 border-slate-200/40 dark:border-slate-800/40 opacity-50'
                        }`}
                      >
                        <div className="pr-2 truncate">
                          <span className="font-bold text-slate-800 dark:text-slate-200 block truncate" title={prop.label}>
                            {prop.label}
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono">{prop.key}</span>
                        </div>
                        <input
                          type="checkbox"
                          checked={isAllowed}
                          onChange={() => {}}
                          className="w-4 h-4 rounded text-red-600 focus:ring-red-500 cursor-pointer shrink-0"
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* ================= ABA 4: HISTÓRICO GERAL DE AUDITORIA ================= */}
          {activeTab === 'logs' && (
            <div className="space-y-4">

              {/* Barra de Filtros e Ações dos Logs */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 bg-slate-50 dark:bg-slate-800/60 p-3 rounded-2xl border border-slate-200 dark:border-slate-800">
                <div className="flex items-center gap-2 flex-1">
                  <div className="relative flex-1">
                    <input
                      type="text"
                      placeholder="Filtrar eventos por termo, ação ou sessão..."
                      value={logSearch}
                      onChange={(e) => setLogSearch(e.target.value)}
                      className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl pl-8 pr-3 py-1.5 text-xs text-slate-800 dark:text-slate-100 outline-none focus:ring-1 focus:ring-red-500"
                    />
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2" />
                  </div>

                  <select
                    value={logCategoryFilter}
                    onChange={(e) => setLogCategoryFilter(e.target.value)}
                    className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-1.5 text-xs font-bold text-slate-700 dark:text-slate-300 outline-none cursor-pointer"
                  >
                    <option value="TODOS">Todas Categorias</option>
                    <option value="ACESSO">Acessos</option>
                    <option value="BUSCA">Buscas Globais</option>
                    <option value="ENDERECO">Endereços IBGE</option>
                    <option value="CAMADA">Camadas</option>
                    <option value="FEICAO">Feições</option>
                    <option value="EXPORTACAO">Exportações</option>
                    <option value="MEDICAO">Medições</option>
                    <option value="IMPRESSAO">Impressões A4</option>
                    <option value="ADMIN">Administração</option>
                  </select>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={handleRefreshData}
                    className="p-1.5 bg-white dark:bg-slate-900 hover:bg-slate-100 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-600 dark:text-slate-300 transition-colors cursor-pointer"
                    title="Atualizar Logs"
                  >
                    <RefreshCw className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={exportActivityLogsToCSV}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 transition-all shadow-2xs cursor-pointer"
                    title="Exportar relatório CSV de auditoria"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5" />
                    Exportar CSV
                  </button>
                  <button
                    type="button"
                    onClick={handleClearLogs}
                    className="p-1.5 bg-red-50 hover:bg-red-100 dark:bg-red-950/40 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 rounded-xl transition-colors cursor-pointer"
                    title="Limpar Histórico de Logs"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Tabela de Logs */}
              <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden max-h-[380px] overflow-y-auto custom-scrollbar">
                {filteredLogs.length > 0 ? (
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-100/90 dark:bg-slate-800 text-slate-600 dark:text-slate-400 sticky top-0 z-10">
                      <tr>
                        <th className="px-3.5 py-2.5 font-bold uppercase text-[10px]">Data e Hora</th>
                        <th className="px-3 py-2.5 font-bold uppercase text-[10px]">Usuário</th>
                        <th className="px-3 py-2.5 font-bold uppercase text-[10px]">Categoria</th>
                        <th className="px-3 py-2.5 font-bold uppercase text-[10px]">Ação / Evento</th>
                        <th className="px-3 py-2.5 font-bold uppercase text-[10px]">Detalhes</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 bg-white dark:bg-slate-900">
                      {filteredLogs.map(log => {
                        const userConf = userSessions[log.sessionId];
                        const displayName = userConf?.customName || log.sessionId.substring(0, 12) + '...';

                        return (
                          <tr key={log.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                            <td className="px-3.5 py-2 whitespace-nowrap text-slate-500 dark:text-slate-400 font-mono text-[11px]">
                              {log.formattedDate}
                            </td>
                            <td className="px-3 py-2 whitespace-nowrap">
                              <span className="font-bold text-slate-700 dark:text-slate-300">
                                {displayName}
                              </span>
                            </td>
                            <td className="px-3 py-2 whitespace-nowrap">
                              {renderCategoryBadge(log.category)}
                            </td>
                            <td className="px-3 py-2 font-bold text-slate-800 dark:text-slate-200">
                              {log.action}
                            </td>
                            <td className="px-3 py-2 text-slate-500 dark:text-slate-400 max-w-[240px] truncate" title={log.details}>
                              {log.details || '-'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                ) : (
                  <div className="p-10 text-center text-slate-400 flex flex-col items-center justify-center gap-2">
                    <Activity className="w-8 h-8 text-slate-300 dark:text-slate-600" />
                    <p className="font-bold text-xs">Nenhum evento registrado com os filtros selecionados.</p>
                  </div>
                )}
              </div>
            </div>
          )}



        </div>
      </div>

      {/* ================= MODAL: CRIAR / EDITAR LOGIN DE USUÁRIO ================= */}
      {isUserModalOpen && (
        <div className="fixed inset-0 top-0 left-0 right-0 bottom-0 z-[10000] w-screen h-screen min-h-[100dvh] bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-fadeIn">
          <div
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl max-w-2xl w-full flex flex-col max-h-[92vh] overflow-hidden my-auto animate-scaleUp"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Cabeçalho do Modal */}
            <div className="bg-gradient-to-r from-red-700 to-rose-700 p-4 sm:p-5 text-white flex items-center justify-between shadow-md">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-white/20 flex items-center justify-center font-bold">
                  {userFormRole === 'master' ? <Crown className="w-5 h-5" /> : editingUserId ? <Sliders className="w-5 h-5" /> : <UserPlus className="w-5 h-5" />}
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-black tracking-tight">
                    {userFormRole === 'master' ? '👑 Preferências de Visualização do Master' : editingUserId ? 'Editar Usuário & Permissões' : 'Criar Novo Login de Usuário'}
                  </h3>
                  <p className="text-xs text-red-100 font-medium">
                    {userFormRole === 'master' 
                      ? 'Como Administrador Supremo, você tem acesso irrestrito a todos os recursos. Aqui você define suas preferências padrão.'
                      : editingUserId ? 'Atualize as credenciais e permissões personalizadas' : 'Defina as credenciais de acesso e permissões individuais'}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsUserModalOpen(false)}
                className="text-white/80 hover:text-white hover:bg-white/15 p-1.5 rounded-xl transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Formulário com Scroll */}
            <form onSubmit={handleSaveRegisteredUserForm} className="p-4 sm:p-6 overflow-y-auto custom-scrollbar space-y-4 flex-grow">
              {userFormError && (
                <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-300 dark:border-red-800 text-red-700 dark:text-red-300 rounded-xl text-xs font-bold flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                  <span>{userFormError}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {/* Seleção de Cargo para o Administrador Master ou Gerente autorizado */}
                {(isMaster || (isManager && currentActiveUser?.managerPermissions?.canCreateManagerRole === true)) && userFormRole !== 'master' && (
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                      Nível de Acesso (Cargo Hierárquico): *
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <button
                        type="button"
                        onClick={() => setUserFormRole('user')}
                        className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex items-center gap-3 ${
                          userFormRole === 'user'
                            ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-500 ring-2 ring-emerald-500/20 shadow-xs'
                            : 'bg-slate-50 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 opacity-70 hover:opacity-100'
                        }`}
                      >
                        <div className="w-8 h-8 rounded-xl bg-emerald-100 dark:bg-emerald-900/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-black shrink-0">
                          <User className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="text-xs font-black text-slate-900 dark:text-slate-100">👤 Usuário Comum</div>
                          <div className="text-[10px] text-slate-500">Acessa com permissões customizadas</div>
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => setUserFormRole('manager')}
                        className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex items-center gap-3 ${
                          userFormRole === 'manager'
                            ? 'bg-indigo-50 dark:bg-indigo-950/40 border-indigo-500 ring-2 ring-indigo-500/20 shadow-xs'
                            : 'bg-slate-50 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 opacity-70 hover:opacity-100'
                        }`}
                      >
                        <div className="w-8 h-8 rounded-xl bg-indigo-100 dark:bg-indigo-900/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-black shrink-0">
                          <Briefcase className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="text-xs font-black text-slate-900 dark:text-slate-100">👔 Gerente (Gestor)</div>
                          <div className="text-[10px] text-slate-500">Pode criar e gerenciar a equipe</div>
                        </div>
                      </button>
                    </div>
                  </div>
                )}

                {/* Seção Exclusiva de Autorizações do Gerente (Configurado pelo Master) */}
                {isMaster && userFormRole === 'manager' && (
                  <div className="sm:col-span-2 bg-indigo-50/80 dark:bg-indigo-950/40 p-4 rounded-2xl border border-indigo-200 dark:border-indigo-800/60 space-y-3">
                    <div className="flex items-center gap-2">
                      <Briefcase className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                      <h4 className="text-xs font-black text-indigo-950 dark:text-indigo-200 uppercase tracking-wider">
                        Autorizações e Poderes deste Gerente
                      </h4>
                    </div>
                    <p className="text-[11px] text-indigo-700 dark:text-indigo-300">
                      Como Administrador Master Supremo, defina quais ações este gerente está autorizado a realizar:
                    </p>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 pt-1">
                      <label className={`p-3 rounded-xl border flex flex-col justify-between gap-2 cursor-pointer transition-all ${
                        userFormManagerPerms.allowGenerateLogins !== false
                          ? 'bg-white dark:bg-slate-900 border-indigo-500 shadow-xs'
                          : 'bg-white/50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-700 opacity-60'
                      }`}>
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-xs text-slate-800 dark:text-slate-100">Gerar Logins</span>
                          <input
                            type="checkbox"
                            checked={userFormManagerPerms.allowGenerateLogins !== false}
                            onChange={(e) => setUserFormManagerPerms(prev => ({ ...prev, allowGenerateLogins: e.target.checked }))}
                            className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                          />
                        </div>
                        <span className="text-[10px] text-slate-500 dark:text-slate-400">Permitir cadastrar novos logins</span>
                      </label>

                      <label className={`p-3 rounded-xl border flex flex-col justify-between gap-2 cursor-pointer transition-all ${
                        userFormManagerPerms.allowViewAllVisitors === true
                          ? 'bg-white dark:bg-slate-900 border-indigo-500 shadow-xs'
                          : 'bg-white/50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-700 opacity-60'
                      }`}>
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-xs text-slate-800 dark:text-slate-100 flex items-center gap-1">
                            <Users className="w-3.5 h-3.5 text-blue-500" />
                            <span>Ver Visitantes</span>
                          </span>
                          <input
                            type="checkbox"
                            checked={userFormManagerPerms.allowViewAllVisitors === true}
                            onChange={(e) => setUserFormManagerPerms(prev => ({ ...prev, allowViewAllVisitors: e.target.checked }))}
                            className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                          />
                        </div>
                        <span className="text-[10px] text-slate-500 dark:text-slate-400">Ver todos os visitantes gerais do site</span>
                      </label>

                      <label className={`p-3 rounded-xl border flex flex-col justify-between gap-2 cursor-pointer transition-all ${
                        userFormManagerPerms.allowChangePasswords === true
                          ? 'bg-white dark:bg-slate-900 border-indigo-500 shadow-xs'
                          : 'bg-white/50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-700 opacity-60'
                      }`}>
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-xs text-slate-800 dark:text-slate-100">Trocar Senhas</span>
                          <input
                            type="checkbox"
                            checked={userFormManagerPerms.allowChangePasswords === true}
                            onChange={(e) => setUserFormManagerPerms(prev => ({ ...prev, allowChangePasswords: e.target.checked }))}
                            className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                          />
                        </div>
                        <span className="text-[10px] text-slate-500 dark:text-slate-400">Permitir alterar senhas da equipe</span>
                      </label>

                      <label className={`p-3 rounded-xl border flex flex-col justify-between gap-2 cursor-pointer transition-all ${
                        userFormManagerPerms.allowManageGlobalLayers === true
                          ? 'bg-white dark:bg-slate-900 border-indigo-500 shadow-xs'
                          : 'bg-white/50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-700 opacity-60'
                      }`}>
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-xs text-slate-800 dark:text-slate-100">Camadas Globais</span>
                          <input
                            type="checkbox"
                            checked={userFormManagerPerms.allowManageGlobalLayers === true}
                            onChange={(e) => setUserFormManagerPerms(prev => ({ ...prev, allowManageGlobalLayers: e.target.checked }))}
                            className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                          />
                        </div>
                        <span className="text-[10px] text-slate-500 dark:text-slate-400">Permitir gerenciar camadas globais</span>
                      </label>
                    </div>

                    {/* Sub-opção de Quais Logins o Gerente Pode Criar */}
                    {userFormManagerPerms.allowGenerateLogins !== false && (
                      <div className="bg-white dark:bg-slate-900 p-3 rounded-2xl border border-indigo-200 dark:border-indigo-800/80 space-y-2 animate-fadeIn">
                        <div className="text-[11px] font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                          <Key className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                          <span>Tipos de contas que este Gerente tem permissão para criar:</span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() => setUserFormManagerPerms(prev => ({ ...prev, canCreateManagerRole: false }))}
                            className={`p-2.5 rounded-xl border text-left flex items-center gap-2.5 transition-all cursor-pointer ${
                              !userFormManagerPerms.canCreateManagerRole
                                ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-500 text-emerald-900 dark:text-emerald-200 font-bold shadow-2xs ring-1 ring-emerald-500/20'
                                : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 opacity-70 hover:opacity-100'
                            }`}
                          >
                            <div className="w-7 h-7 rounded-lg bg-emerald-100 dark:bg-emerald-900/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold shrink-0">
                              <User className="w-3.5 h-3.5" />
                            </div>
                            <div className="text-xs">
                              <div>Apenas Usuário Comum 👤</div>
                              <div className="text-[10px] font-normal text-slate-500">Cria apenas contas operacionais</div>
                            </div>
                          </button>

                          <button
                            type="button"
                            onClick={() => setUserFormManagerPerms(prev => ({ ...prev, canCreateManagerRole: true }))}
                            className={`p-2.5 rounded-xl border text-left flex items-center gap-2.5 transition-all cursor-pointer ${
                              userFormManagerPerms.canCreateManagerRole === true
                                ? 'bg-indigo-50 dark:bg-indigo-950/40 border-indigo-500 text-indigo-900 dark:text-indigo-200 font-bold shadow-2xs ring-1 ring-indigo-500/20'
                                : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 opacity-70 hover:opacity-100'
                            }`}
                          >
                            <div className="w-7 h-7 rounded-lg bg-indigo-100 dark:bg-indigo-900/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold shrink-0">
                              <Briefcase className="w-3.5 h-3.5" />
                            </div>
                            <div className="text-xs">
                              <div>Usuários e Novos Gerentes 👔</div>
                              <div className="text-[10px] font-normal text-slate-500">Pode criar gerentes e usuários</div>
                            </div>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Nome Completo: *
                  </label>
                  <input
                    type="text"
                    required
                    value={userFormName}
                    onChange={(e) => setUserFormName(e.target.value)}
                    placeholder="Ex: João da Silva"
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3.5 py-2 text-xs text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-red-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Usuário / Login (@login): *
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-2 text-slate-400 font-mono text-xs font-bold">@</span>
                    <input
                      type="text"
                      required
                      value={userFormUsername}
                      onChange={(e) => setUserFormUsername(e.target.value)}
                      placeholder="joao.silva"
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl pl-7 pr-3.5 py-2 text-xs text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-red-500 font-mono"
                    />
                  </div>
                </div>

                {(!isManager || !editingUserId) ? (
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      {editingUserId ? 'Nova Senha (deixe em branco para manter):' : 'Senha de Acesso: *'}
                    </label>
                    <div className="relative">
                      <input
                        type={showUserFormPass ? "text" : "password"}
                        required={!editingUserId}
                        value={userFormPassword}
                        onChange={(e) => setUserFormPassword(e.target.value)}
                        placeholder={editingUserId ? '••••••••' : 'Mínimo 4 caracteres'}
                        className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl pl-3.5 pr-10 py-2 text-xs text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-red-500 font-mono"
                      />
                      <button
                        type="button"
                        onClick={() => setShowUserFormPass(prev => !prev)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-lg cursor-pointer"
                        title={showUserFormPass ? "Ocultar senha" : "Exibir senha"}
                      >
                        {showUserFormPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Senha de Acesso:
                    </label>
                    <div className="bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2 text-xs text-slate-500 font-mono flex items-center justify-between">
                      <span>•••••••• (Preservada)</span>
                      <span className="text-[10px] text-amber-600 font-bold bg-amber-50 dark:bg-amber-950/60 px-2 py-0.5 rounded-md border border-amber-200 dark:border-amber-900">
                        Apenas Master redefine
                      </span>
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Setor / Secretaria / Cargo (opcional):
                  </label>
                  <input
                    type="text"
                    value={userFormDepartment}
                    onChange={(e) => setUserFormDepartment(e.target.value)}
                    placeholder="Ex: Secretaria de Planejamento"
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3.5 py-2 text-xs text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-red-500"
                  />
                </div>
              </div>

              {/* Seção de Permissões Personalizadas */}
              <div className="pt-3 border-t border-slate-200 dark:border-slate-800 space-y-3">
                <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-800/60 p-3 rounded-2xl border border-slate-200 dark:border-slate-700">
                  <div>
                    <h4 className="text-xs font-black text-slate-900 dark:text-slate-100 flex items-center gap-2">
                      <Sliders className="w-4 h-4 text-red-600" />
                      {userFormRole === 'master' ? 'Preferências de Visualização do Master' : 'Permissões Exclusivas para este Usuário'}
                    </h4>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                      {userFormRole === 'master'
                        ? 'Defina suas preferências pessoais de exibição padrão no mapa.'
                        : 'Se desativado, o usuário seguirá as regras padrão globais definidas no painel.'}
                    </p>
                  </div>

                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={userFormHasCustom}
                      onChange={(e) => setUserFormHasCustom(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-600 peer-checked:bg-red-600"></div>
                  </label>
                </div>

                {userFormHasCustom && (
                  <div className="space-y-4 animate-fadeIn">
                    {/* Camadas Permitidas */}
                    <div className="bg-slate-50 dark:bg-slate-800/40 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-extrabold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                          <Layers className="w-3.5 h-3.5 text-red-600" />
                          Camadas Permitidas
                        </span>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              const all: Record<string, boolean> = {};
                              dataSources.forEach(s => { all[s.name] = true; });
                              setUserFormLayers(all);
                            }}
                            className="text-[10px] font-bold text-red-600 dark:text-red-400 hover:underline cursor-pointer"
                          >
                            Todas
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              const all: Record<string, boolean> = {};
                              dataSources.forEach(s => { all[s.name] = false; });
                              setUserFormLayers(all);
                            }}
                            className="text-[10px] font-bold text-slate-500 hover:underline cursor-pointer"
                          >
                            Nenhuma
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[160px] overflow-y-auto custom-scrollbar pr-1">
                        {dataSources.map(source => {
                          const isChecked = userFormLayers[source.name] !== false;
                          return (
                            <label
                              key={source.name}
                              className={`p-2 rounded-xl border flex items-center justify-between text-xs cursor-pointer transition-all ${
                                isChecked
                                  ? 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 font-bold text-slate-800 dark:text-slate-100'
                                  : 'bg-slate-100/60 dark:bg-slate-950/60 border-transparent text-slate-400 opacity-60'
                              }`}
                            >
                              <span className="truncate pr-2">{source.name}</span>
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => {
                                  setUserFormLayers(prev => ({
                                    ...prev,
                                    [source.name]: !isChecked
                                  }));
                                }}
                                className="w-4 h-4 rounded text-red-600 focus:ring-red-500 cursor-pointer shrink-0"
                              />
                            </label>
                          );
                        })}
                      </div>
                    </div>

                    {/* Ferramentas & Módulos Liberados */}
                    <div className="bg-slate-50 dark:bg-slate-800/40 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-2.5">
                      <span className="text-xs font-extrabold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                        <Wrench className="w-3.5 h-3.5 text-red-600" />
                        Ferramentas & Recursos Liberados
                      </span>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                        <label className={`p-2 rounded-xl border flex items-center justify-between cursor-pointer ${
                          userFormFeatures.allowCnefeSearch !== false ? 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 font-bold text-slate-800 dark:text-slate-100' : 'bg-slate-100/60 dark:bg-slate-950/60 border-transparent text-slate-400 opacity-60'
                        }`}>
                          <span>Busca de Endereços IBGE (DuckDB)</span>
                          <input
                            type="checkbox"
                            checked={userFormFeatures.allowCnefeSearch !== false}
                            onChange={() => setUserFormFeatures(prev => ({ ...prev, allowCnefeSearch: !prev.allowCnefeSearch }))}
                            className="w-4 h-4 rounded text-red-600 focus:ring-red-500 cursor-pointer"
                          />
                        </label>

                        <label className={`p-2 rounded-xl border flex items-center justify-between cursor-pointer ${
                          userFormFeatures.allowExportData !== false ? 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 font-bold text-slate-800 dark:text-slate-100' : 'bg-slate-100/60 dark:bg-slate-950/60 border-transparent text-slate-400 opacity-60'
                        }`}>
                          <span>Exportação de Dados (CSV / KML)</span>
                          <input
                            type="checkbox"
                            checked={userFormFeatures.allowExportData !== false}
                            onChange={() => setUserFormFeatures(prev => ({ ...prev, allowExportData: !prev.allowExportData }))}
                            className="w-4 h-4 rounded text-red-600 focus:ring-red-500 cursor-pointer"
                          />
                        </label>

                        <label className={`p-2 rounded-xl border flex items-center justify-between cursor-pointer ${
                          userFormFeatures.allowMeasureTool !== false ? 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 font-bold text-slate-800 dark:text-slate-100' : 'bg-slate-100/60 dark:bg-slate-950/60 border-transparent text-slate-400 opacity-60'
                        }`}>
                          <span>Ferramenta de Medição de Áreas</span>
                          <input
                            type="checkbox"
                            checked={userFormFeatures.allowMeasureTool !== false}
                            onChange={() => setUserFormFeatures(prev => ({ ...prev, allowMeasureTool: !prev.allowMeasureTool }))}
                            className="w-4 h-4 rounded text-red-600 focus:ring-red-500 cursor-pointer"
                          />
                        </label>

                        <label className={`p-2 rounded-xl border flex items-center justify-between cursor-pointer ${
                          userFormFeatures.allowPrintA4 !== false ? 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 font-bold text-slate-800 dark:text-slate-100' : 'bg-slate-100/60 dark:bg-slate-950/60 border-transparent text-slate-400 opacity-60'
                        }`}>
                          <span>Impressão & Geração de Mapas A4</span>
                          <input
                            type="checkbox"
                            checked={userFormFeatures.allowPrintA4 !== false}
                            onChange={() => setUserFormFeatures(prev => ({ ...prev, allowPrintA4: !prev.allowPrintA4 }))}
                            className="w-4 h-4 rounded text-red-600 focus:ring-red-500 cursor-pointer"
                          />
                        </label>

                        <label className={`p-2 rounded-xl border flex items-center justify-between cursor-pointer ${
                          userFormFeatures.allowDashboardRaioX !== false ? 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 font-bold text-slate-800 dark:text-slate-100' : 'bg-slate-100/60 dark:bg-slate-950/60 border-transparent text-slate-400 opacity-60'
                        }`}>
                          <span>Dashboard Raio-X Populacional (IBGE)</span>
                          <input
                            type="checkbox"
                            checked={userFormFeatures.allowDashboardRaioX !== false}
                            onChange={() => setUserFormFeatures(prev => ({ ...prev, allowDashboardRaioX: !prev.allowDashboardRaioX }))}
                            className="w-4 h-4 rounded text-red-600 focus:ring-red-500 cursor-pointer"
                          />
                        </label>

                        <label className={`p-2 rounded-xl border flex items-center justify-between cursor-pointer ${
                          userFormFeatures.allowSelectedFeaturesPanel !== false ? 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 font-bold text-slate-800 dark:text-slate-100' : 'bg-slate-100/60 dark:bg-slate-950/60 border-transparent text-slate-400 opacity-60'
                        }`}>
                          <span>Painel de Feições Selecionadas</span>
                          <input
                            type="checkbox"
                            checked={userFormFeatures.allowSelectedFeaturesPanel !== false}
                            onChange={() => setUserFormFeatures(prev => ({ ...prev, allowSelectedFeaturesPanel: !prev.allowSelectedFeaturesPanel }))}
                            className="w-4 h-4 rounded text-red-600 focus:ring-red-500 cursor-pointer"
                          />
                        </label>
                      </div>
                    </div>

                    {/* Colunas do CNEFE (DuckDB) */}
                    <div className="bg-slate-50 dark:bg-slate-800/40 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-extrabold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                          <FileSpreadsheet className="w-3.5 h-3.5 text-red-600" />
                          Colunas da Tabela de Endereços CNEFE (IBGE)
                        </span>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              const all: Record<string, boolean> = {};
                              ALL_ADDRESS_COLUMNS.forEach(c => { all[c.key] = true; });
                              setUserFormAddressColumns(all);
                            }}
                            className="text-[10px] font-bold text-red-600 dark:text-red-400 hover:underline cursor-pointer"
                          >
                            Todas
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              const all: Record<string, boolean> = {};
                              ALL_ADDRESS_COLUMNS.forEach(c => { all[c.key] = false; });
                              setUserFormAddressColumns(all);
                            }}
                            className="text-[10px] font-bold text-slate-500 hover:underline cursor-pointer"
                          >
                            Nenhuma
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[160px] overflow-y-auto custom-scrollbar pr-1">
                        {ALL_ADDRESS_COLUMNS.map(col => {
                          const isChecked = userFormAddressColumns[col.key] !== false;
                          return (
                            <label
                              key={`form-col-${col.key}`}
                              className={`p-2 rounded-xl border flex items-center justify-between text-xs cursor-pointer transition-all ${
                                isChecked
                                  ? 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 font-bold text-slate-800 dark:text-slate-100'
                                  : 'bg-slate-100/60 dark:bg-slate-950/60 border-transparent text-slate-400 opacity-60'
                              }`}
                            >
                              <span className="truncate pr-2">{col.label}</span>
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => {
                                  setUserFormAddressColumns(prev => ({
                                    ...prev,
                                    [col.key]: !isChecked
                                  }));
                                }}
                                className="w-4 h-4 rounded text-red-600 focus:ring-red-500 cursor-pointer shrink-0"
                              />
                            </label>
                          );
                        })}
                      </div>
                    </div>

                    {/* Propriedades Territoriais das Feições */}
                    <div className="bg-slate-50 dark:bg-slate-800/40 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-extrabold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                          <FileText className="w-3.5 h-3.5 text-red-600" />
                          Propriedades & Dados das Feições (Bairros, Setores, Favelas)
                        </span>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              const all: Record<string, boolean> = {};
                              ALL_FEATURE_PROPERTIES.forEach(p => { all[p.key] = true; });
                              setUserFormFeatureProperties(all);
                            }}
                            className="text-[10px] font-bold text-red-600 dark:text-red-400 hover:underline cursor-pointer"
                          >
                            Todas
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              const all: Record<string, boolean> = {};
                              ALL_FEATURE_PROPERTIES.forEach(p => { all[p.key] = false; });
                              setUserFormFeatureProperties(all);
                            }}
                            className="text-[10px] font-bold text-slate-500 hover:underline cursor-pointer"
                          >
                            Nenhuma
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[160px] overflow-y-auto custom-scrollbar pr-1">
                        {ALL_FEATURE_PROPERTIES.map(prop => {
                          const isChecked = userFormFeatureProperties[prop.key] !== false;
                          return (
                            <label
                              key={`form-prop-${prop.key}`}
                              className={`p-2 rounded-xl border flex items-center justify-between text-xs cursor-pointer transition-all ${
                                isChecked
                                  ? 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 font-bold text-slate-800 dark:text-slate-100'
                                  : 'bg-slate-100/60 dark:bg-slate-950/60 border-transparent text-slate-400 opacity-60'
                              }`}
                            >
                              <span className="truncate pr-2">{prop.label}</span>
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => {
                                  setUserFormFeatureProperties(prev => ({
                                    ...prev,
                                    [prop.key]: !isChecked
                                  }));
                                }}
                                className="w-4 h-4 rounded text-red-600 focus:ring-red-500 cursor-pointer shrink-0"
                              />
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Botões do Rodapé */}
              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsUserModalOpen(false)}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold rounded-xl text-xs transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl text-xs transition-all shadow-md shadow-red-600/30 cursor-pointer flex items-center gap-1.5"
                >
                  <Save className="w-4 h-4" />
                  <span>{editingUserId ? 'Salvar Alterações' : 'Cadastrar Usuário'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL: REDEFINIÇÃO RÁPIDA DE SENHA ================= */}
      {resetPassUser && (
        <div className="fixed inset-0 top-0 left-0 right-0 bottom-0 z-[10001] w-screen h-screen min-h-[100dvh] bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-fadeIn">
          <div
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl max-w-md w-full p-5 space-y-4 my-auto animate-scaleUp"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-100 dark:bg-amber-950/80 text-amber-700 dark:text-amber-400 flex items-center justify-center font-bold">
                  <Key className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900 dark:text-slate-100">
                    Redefinir Senha do Usuário
                  </h3>
                  <p className="text-xs text-slate-500 font-mono">
                    {resetPassUser.name} (@{resetPassUser.username})
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setResetPassUser(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleConfirmResetPassword} className="space-y-3.5">
              {resetPassError && (
                <div className="p-2.5 bg-red-50 dark:bg-red-950/40 border border-red-300 dark:border-red-800 text-red-700 dark:text-red-300 rounded-xl text-xs font-bold flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                  <span>{resetPassError}</span>
                </div>
              )}

              {/* Visualizador da Senha Atual (Disponível para o Master) */}
              {isMaster && resetPassUser.password && (
                <div className="p-3 bg-amber-50/90 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 rounded-2xl flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-xl bg-amber-200/60 dark:bg-amber-900/60 flex items-center justify-center shrink-0 text-amber-800 dark:text-amber-300">
                      <Lock className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <span className="text-[10px] uppercase tracking-wider font-extrabold text-amber-800 dark:text-amber-300 block">
                        Senha Atual Cadastrada
                      </span>
                      <span className="font-mono text-sm font-black text-slate-900 dark:text-slate-100 tracking-wider">
                        {showResetPassCurrent ? resetPassUser.password : '••••••••'}
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setShowResetPassCurrent(prev => !prev)}
                    className="p-1.5 bg-white dark:bg-slate-800 hover:bg-amber-100 dark:hover:bg-amber-900/50 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800 rounded-xl transition-all flex items-center gap-1 text-xs font-bold cursor-pointer shrink-0"
                    title={showResetPassCurrent ? 'Ocultar senha' : 'Ver senha atual'}
                  >
                    {showResetPassCurrent ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    <span>{showResetPassCurrent ? 'Ocultar' : 'Ver'}</span>
                  </button>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Nova Senha de Acesso:
                </label>
                <div className="relative">
                  <input
                    type={showResetPassNew ? "text" : "password"}
                    required
                    autoFocus
                    value={resetPassInput}
                    onChange={(e) => setResetPassInput(e.target.value)}
                    placeholder="Mínimo 4 caracteres..."
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl pl-3.5 pr-10 py-2 text-xs text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-amber-500 font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowResetPassNew(prev => !prev)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-lg cursor-pointer"
                    title={showResetPassNew ? "Ocultar senha digitada" : "Exibir senha digitada"}
                  >
                    {showResetPassNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setResetPassUser(null);
                    setShowResetPassCurrent(false);
                    setShowResetPassNew(false);
                  }}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold rounded-xl text-xs transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black rounded-xl text-xs transition-all shadow-md shadow-amber-500/20 cursor-pointer flex items-center gap-1.5"
                >
                  <Check className="w-4 h-4" />
                  <span>Salvar Nova Senha</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* ================= MODAL: DETALHES, ATIVIDADES E LOGINS DO USUÁRIO ================= */}
      {selectedUserDetail && (
        <div className="fixed inset-0 top-0 left-0 right-0 bottom-0 z-[10002] w-screen h-screen min-h-[100dvh] bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-fadeIn">
          <div
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl max-w-2xl w-full flex flex-col max-h-[90vh] overflow-hidden my-auto animate-scaleUp"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            {(() => {
              const isDetailMaster = selectedUserDetail.role === 'master';
              const isDetailManager = selectedUserDetail.role === 'manager';
              const isDetailOnline = !!(selectedUserDetail.lastLogin && (Date.now() - new Date(selectedUserDetail.lastLogin).getTime() < 10 * 60 * 1000));
              const teamMembers = registeredUsers.filter(u => u.createdBy?.toLowerCase() === selectedUserDetail.username.toLowerCase());
              
              const cleanUser = selectedUserDetail.username.toLowerCase().replace(/^@/, '');
              const cleanName = selectedUserDetail.name.toLowerCase();
              const cleanId = selectedUserDetail.id.toLowerCase();
              const allSourceLogs = userDetailLogs.length > 0 ? userDetailLogs : logs;
              const userLogs = allSourceLogs.filter(l => {
                const sId = (l.sessionId || '').toLowerCase().replace(/^@/, '');
                const act = (l.action || '').toLowerCase();
                const det = (l.details || '').toLowerCase();
                return (
                  sId === cleanUser ||
                  sId.includes(cleanUser) ||
                  sId === cleanId ||
                  act.includes(cleanUser) ||
                  det.includes(cleanUser) ||
                  act.includes(cleanName) ||
                  det.includes(cleanName)
                );
              });

              return (
                <>
                  <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 p-4 sm:p-5 text-white flex items-center justify-between border-b border-slate-700/80">
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black text-base shrink-0 shadow-inner ${
                        isDetailMaster
                          ? 'bg-gradient-to-br from-amber-400 to-rose-600 text-white'
                          : isDetailManager
                            ? 'bg-indigo-600 text-white'
                            : 'bg-red-600 text-white'
                      }`}>
                        {isDetailMaster ? <Crown className="w-6 h-6" /> : isDetailManager ? <Briefcase className="w-6 h-6" /> : selectedUserDetail.name.charAt(0).toUpperCase()}
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-base font-black text-white truncate">
                            {selectedUserDetail.name}
                          </h3>
                          <span className="font-mono text-xs font-bold text-red-400 bg-red-950/80 border border-red-800/60 px-2 py-0.5 rounded-lg">
                            @{selectedUserDetail.username}
                          </span>

                          {/* Status Online */}
                          {isDetailOnline ? (
                            <span className="bg-emerald-500/20 text-emerald-300 text-[10px] font-black px-2.5 py-0.5 rounded-full border border-emerald-500/40 flex items-center gap-1">
                              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                              ONLINE NO SITE
                            </span>
                          ) : (
                            <span className="bg-slate-800 text-slate-400 text-[10px] font-bold px-2 py-0.5 rounded-full border border-slate-700">
                              OFFLINE
                            </span>
                          )}

                          {isDetailMaster ? (
                            <span className="bg-gradient-to-r from-amber-500 to-rose-600 text-white text-[10px] font-black px-2.5 py-0.5 rounded-full shadow-xs">
                              👑 MASTER SUPREMO
                            </span>
                          ) : isDetailManager ? (
                            <span className="bg-indigo-600 text-white text-[10px] font-black px-2.5 py-0.5 rounded-full shadow-xs">
                              👔 GERENTE
                            </span>
                          ) : (
                            <span className="bg-slate-700 text-slate-200 text-[10px] font-bold px-2.5 py-0.5 rounded-full border border-slate-600">
                              👤 USUÁRIO COMUM
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-300 mt-0.5">
                          {selectedUserDetail.department ? `Setor: ${selectedUserDetail.department}` : 'Acesso Geral ao WebGIS'}
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setSelectedUserDetail(null)}
                      className="text-slate-400 hover:text-white hover:bg-slate-800 p-2 rounded-xl transition-colors cursor-pointer"
                      title="Fechar"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  {/* Sub-Tabs */}
                  <div className="bg-slate-100 dark:bg-slate-800/80 px-4 py-2 border-b border-slate-200 dark:border-slate-700 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setUserDetailTab('info')}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                        userDetailTab === 'info'
                          ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                      }`}
                    >
                      <User className="w-3.5 h-3.5 text-red-500" />
                      <span>Visão Geral & Cadastro</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setUserDetailTab('activity')}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                        userDetailTab === 'activity'
                          ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                      }`}
                    >
                      <Activity className="w-3.5 h-3.5 text-blue-500" />
                      <span>Histórico de Atividades ({userLogs.length})</span>
                    </button>

                    {isDetailManager && (
                      <button
                        type="button"
                        onClick={() => setUserDetailTab('team')}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                          userDetailTab === 'team'
                            ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                        }`}
                      >
                        <Users className="w-3.5 h-3.5 text-indigo-500" />
                        <span>Logins Gerados ({teamMembers.length})</span>
                      </button>
                    )}
                  </div>

                  {/* Body Content */}
                  <div className="p-5 overflow-y-auto custom-scrollbar space-y-4 flex-grow max-h-[60vh]">
                    {userDetailTab === 'info' && (
                      <div className="space-y-4 animate-fadeIn">
                        {/* Grid de Metadados */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div className="bg-slate-50 dark:bg-slate-800/50 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-700">
                            <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Status da Conta</span>
                            <div className="flex items-center gap-2">
                              {selectedUserDetail.isActive ? (
                                <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                                  <CheckCircle2 className="w-4 h-4" /> Conta Ativa e Liberada
                                </span>
                              ) : (
                                <span className="text-xs font-bold text-red-600 dark:text-red-400 flex items-center gap-1">
                                  <Ban className="w-4 h-4" /> Acesso Bloqueado
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="bg-slate-50 dark:bg-slate-800/50 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-700">
                            <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Último Acesso ao Site</span>
                            <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                              {selectedUserDetail.lastLogin ? new Date(selectedUserDetail.lastLogin).toLocaleString('pt-BR') : 'Nunca realizou login'}
                            </span>
                          </div>

                          <div className="bg-slate-50 dark:bg-slate-800/50 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-700">
                            <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Criado Por</span>
                            <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                              {selectedUserDetail.createdBy || 'Sistema'}
                            </span>
                          </div>

                          <div className="bg-slate-50 dark:bg-slate-800/50 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-700">
                            <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Data de Cadastro</span>
                            <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                              {new Date(selectedUserDetail.createdAt).toLocaleString('pt-BR')}
                            </span>
                          </div>
                        </div>

                        {/* Se for Gerente: Quadro de Autorizações */}
                        {isDetailManager && (
                          <div className="bg-indigo-50/80 dark:bg-indigo-950/40 p-4 rounded-2xl border border-indigo-200 dark:border-indigo-800/60 space-y-3">
                            <h4 className="text-xs font-black text-indigo-950 dark:text-indigo-200 uppercase tracking-wider flex items-center gap-1.5">
                              <Briefcase className="w-4 h-4 text-indigo-600" />
                              Autorizações Configuradas pelo Master
                            </h4>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                              <div className="bg-white dark:bg-slate-900 p-2.5 rounded-xl border border-indigo-200/60 dark:border-indigo-900/60 text-xs">
                                <span className="text-slate-500 dark:text-slate-400 block text-[10px]">Gerar Novos Logins</span>
                                <span className={`font-black ${selectedUserDetail.managerPermissions?.allowGenerateLogins !== false ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'}`}>
                                  {selectedUserDetail.managerPermissions?.allowGenerateLogins !== false ? '✅ Permitido' : '❌ Desativado'}
                                </span>
                              </div>

                              <div className="bg-white dark:bg-slate-900 p-2.5 rounded-xl border border-indigo-200/60 dark:border-indigo-900/60 text-xs">
                                <span className="text-slate-500 dark:text-slate-400 block text-[10px]">Alterar Senhas de Usuários</span>
                                <span className={`font-black ${selectedUserDetail.managerPermissions?.allowChangePasswords ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}`}>
                                  {selectedUserDetail.managerPermissions?.allowChangePasswords ? '✅ Permitido' : '❌ Desativado'}
                                </span>
                              </div>

                              <div className="bg-white dark:bg-slate-900 p-2.5 rounded-xl border border-indigo-200/60 dark:border-indigo-900/60 text-xs">
                                <span className="text-slate-500 dark:text-slate-400 block text-[10px]">Gerenciar Camadas Globais</span>
                                <span className={`font-black ${selectedUserDetail.managerPermissions?.allowManageGlobalLayers ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}`}>
                                  {selectedUserDetail.managerPermissions?.allowManageGlobalLayers ? '✅ Permitido' : '❌ Desativado'}
                                </span>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {userDetailTab === 'activity' && (
                      <div className="space-y-3 animate-fadeIn">
                        {isLoadingUserDetailLogs ? (
                          <div className="text-center py-8 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-200 dark:border-slate-700 flex flex-col items-center justify-center">
                            <Loader2 className="w-6 h-6 text-blue-500 animate-spin mb-2" />
                            <p className="text-xs text-slate-500 font-bold">Buscando atividades em tempo real no Supabase...</p>
                          </div>
                        ) : userLogs.length > 0 ? (
                          <div className="divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden max-h-[380px] overflow-y-auto custom-scrollbar">
                            {userLogs.map(log => (
                              <div key={log.id} className="p-3 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/40 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                <div className="space-y-0.5">
                                  <div className="flex items-center gap-2">
                                    <span className="font-mono text-[10px] font-bold text-slate-400 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                                      {log.formattedDate}
                                    </span>
                                    <span className="font-bold text-slate-800 dark:text-slate-100">
                                      {log.action}
                                    </span>
                                  </div>
                                  {log.details && (
                                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                                      {log.details}
                                    </p>
                                  )}
                                </div>
                                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 shrink-0 self-start sm:self-auto">
                                  {log.category}
                                </span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="text-center py-8 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700">
                            <Activity className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                            <p className="text-xs text-slate-500 font-bold">Nenhuma atividade recente registrada para @{selectedUserDetail.username}.</p>
                          </div>
                        )}
                      </div>
                    )}

                    {userDetailTab === 'team' && (
                      <div className="space-y-3 animate-fadeIn">
                        {teamMembers.length > 0 ? (
                          <div className="divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
                            {teamMembers.map(member => (
                              <div key={member.id} className="p-3 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/40 text-xs flex items-center justify-between gap-3">
                                <div>
                                  <div className="flex items-center gap-2">
                                    <span className="font-bold text-slate-800 dark:text-slate-100">{member.name}</span>
                                    <span className="font-mono text-[11px] text-red-500 font-bold">@{member.username}</span>
                                    {member.isActive ? (
                                      <span className="text-[9px] font-black px-1.5 py-0.2 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                                        ATIVO
                                      </span>
                                    ) : (
                                      <span className="text-[9px] font-black px-1.5 py-0.2 rounded-full bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300">
                                        BLOQUEADO
                                      </span>
                                    )}
                                  </div>
                                  <span className="text-[10px] text-slate-400">
                                    Cadastrado em {new Date(member.createdAt).toLocaleDateString('pt-BR')} • {member.department || 'Geral'}
                                  </span>
                                </div>
                                {isMaster && (
                                  <div className="font-mono text-xs bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 px-2 py-1 rounded-lg border border-amber-200 dark:border-amber-900">
                                    Senha: <strong>{member.password}</strong>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="text-center py-8 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700">
                            <Users className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                            <p className="text-xs text-slate-500 font-bold">Este gerente ainda não gerou logins para a equipe.</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Footer */}
                  <div className="bg-slate-50 dark:bg-slate-800/60 p-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end">
                    <button
                      type="button"
                      onClick={() => setSelectedUserDetail(null)}
                      className="px-4 py-2 bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-100 rounded-xl text-xs font-bold transition-all cursor-pointer"
                    >
                      Fechar
                    </button>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}
    </div>,
    document.body
  );
};
