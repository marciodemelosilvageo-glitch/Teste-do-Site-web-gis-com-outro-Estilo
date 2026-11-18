import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { X, Eye } from 'lucide-react';
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
  getUserSessions,
  getUserSessionsAsync,
  getRegisteredUsers,
  getRegisteredUsersAsync,
  saveRegisteredUser,
  deleteRegisteredUser,
  toggleRegisteredUserStatus,
  promoteUserToManager,
  demoteManagerToUser,
  changeUserPassword,
  saveUserSessionConfig,
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
import { useAccess } from '../context/FeatureAccessContext';
import { AdminSection } from './admin/types';
import { AdminSidebar } from './admin/AdminSidebar';
import { AdminMobileNavigation } from './admin/AdminMobileNavigation';
import { AdminOverviewSection } from './admin/AdminOverviewSection';
import { AdminSystemSection } from './admin/AdminSystemSection';
import { AdminUsersSection } from './admin/AdminUsersSection';
import { AdminAccessSection } from './admin/AdminAccessSection';
import { AdminActivitySection } from './admin/AdminActivitySection';
import { AdminUserFormModal } from './admin/AdminUserFormModal';
import { AdminUserDetailModal } from './admin/AdminUserDetailModal';
import { AdminResetPasswordModal, AdminDeleteUserModal } from './admin/AdminUserConfirmModals';

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

  // Seção ativa do Painel
  const [currentSection, setCurrentSection] = useState<AdminSection>('overview');
  const [mobileSection, setMobileSection] = useState<AdminSection | null>(null);

  // Estados locais de permissões de Camadas, Ferramentas e Colunas
  const [localLayerPerms, setLocalLayerPerms] = useState<Record<string, boolean>>(layerPermissions);
  const [localFeaturePerms, setLocalFeaturePerms] = useState<FeaturePermissions>(featurePermissions);
  const [localAddressColumns, setLocalAddressColumns] = useState<Record<string, boolean>>(() => getAddressColumnsPermissions());
  const [localFeatureProperties, setLocalFeatureProperties] = useState<Record<string, boolean>>(() => getFeaturePropertiesPermissions());

  // Estados de Usuários Cadastrados, Sessões e Logs
  const [registeredUsers, setRegisteredUsers] = useState<RegisteredUser[]>(() => getRegisteredUsers());
  const [userSessions, setUserSessions] = useState<Record<string, UserSessionConfig>>(() => getUserSessions());
  const [logs, setLogs] = useState<ActivityLog[]>(() => getActivityLogs());

  // Busca a versão mais atualizada do usuário logado na lista de registeredUsers
  const activeManagerUser = useMemo(() => {
    if (!currentActiveUser) return null;
    const found = registeredUsers.find(u => 
      u.id === currentActiveUser.id || 
      (u.username && currentActiveUser.username && u.username.toLowerCase() === currentActiveUser.username.toLowerCase())
    );
    return found || currentActiveUser;
  }, [registeredUsers, currentActiveUser]);

  // Privilégios efetivos do Gerente via provedor universal de capacidades
  const { can } = useAccess();
  const canManagerGenerateLogins = can('admin:users:create');
  const canManagerCreateManagerRole = can('admin:users:promote_manager');
  const canManagerChangePasswords = can('admin:users:reset_password');
  const canManagerViewAllVisitors = can('admin:users:view');

  // Estados do Modal de Criação / Edição de Usuário
  const [isUserModalOpen, setIsUserModalOpen] = useState<boolean>(false);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [userFormName, setUserFormName] = useState<string>('');
  const [userFormUsername, setUserFormUsername] = useState<string>('');
  const [userFormPassword, setUserFormPassword] = useState<string>('');
  const [userFormRole, setUserFormRole] = useState<'master' | 'manager' | 'user'>('user');
  const [userFormDepartment, setUserFormDepartment] = useState<string>('');
  const [userFormManagerPerms, setUserFormManagerPerms] = useState<ManagerPermissions>({
    allowGenerateLogins: true,
    canCreateManagerRole: false,
    allowChangePasswords: false,
    allowViewAllVisitors: false
  });
  const [userFormHasCustom, setUserFormHasCustom] = useState<boolean>(false);
  const [userFormLayers, setUserFormLayers] = useState<Record<string, boolean>>({});
  const [userFormFeatures, setUserFormFeatures] = useState<FeaturePermissions>(featurePermissions);
  const [userFormError, setUserFormError] = useState<string | null>(null);
  const [isUserFormSaving, setIsUserFormSaving] = useState<boolean>(false);

  // Estados dos Modais de Ação e Detalhes
  const [selectedUserDetail, setSelectedUserDetail] = useState<RegisteredUser | null>(null);
  const [resetPassUser, setResetPassUser] = useState<RegisteredUser | null>(null);
  const [deleteConfirmUser, setDeleteConfirmUser] = useState<RegisteredUser | null>(null);

  // Contagem de alertas pendentes (usuários bloqueados ou com troca de senha obrigatória pendente)
  const pendingAlertsCount = useMemo(() => {
    const blocked = registeredUsers.filter(u => u.isActive === false).length;
    const pwdPending = registeredUsers.filter(u => u.mustChangePassword === true).length;
    return blocked + pwdPending;
  }, [registeredUsers]);

  // Sincronização e travamento do scroll ao abrir o modal
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      document.documentElement.style.overflow = 'hidden';
      setLocalLayerPerms(layerPermissions);
      setLocalFeaturePerms(featurePermissions);
      setLocalAddressColumns(addressColumnsPermissions || getAddressColumnsPermissions());
      setLocalFeatureProperties(featurePropertiesPermissions || getFeaturePropertiesPermissions());
      setLogs(getActivityLogs());
      setUserSessions(getUserSessions());
      setRegisteredUsers(getRegisteredUsers());

      // Atualização em background via Supabase
      getActivityLogsAsync().then(liveLogs => {
        if (liveLogs && liveLogs.length > 0) setLogs(liveLogs);
      }).catch(() => {});

      getUserSessionsAsync().then(s => {
        if (s && Object.keys(s).length > 0) setUserSessions(s);
      }).catch(() => {});

      getRegisteredUsersAsync().then(users => {
        if (users && users.length > 0) setRegisteredUsers(users);
      }).catch(() => {});
    }

    return () => {
      document.body.style.overflow = '';
      document.documentElement.style.overflow = '';
    };
  }, [isOpen, layerPermissions, featurePermissions, addressColumnsPermissions, featurePropertiesPermissions]);

  // Ouvinte de evento customizado para sincronização em tempo real entre abas/janelas
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

  // Handlers de Criação / Edição de Usuário
  const handleOpenCreateUser = useCallback(() => {
    if (!canManagerGenerateLogins) {
      showToast('⚠️ Apenas o Administrador Master ou gerentes autorizados podem criar novos usuários.');
      return;
    }
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
      allowViewAllVisitors: false
    });
    setUserFormHasCustom(false);
    setUserFormLayers(localLayerPerms);
    setUserFormFeatures(localFeaturePerms);
    setUserFormError(null);
    setIsUserModalOpen(true);
  }, [canManagerGenerateLogins, localLayerPerms, localFeaturePerms, showToast]);

  const handleOpenEditUser = useCallback((user: RegisteredUser) => {
    if (!isMaster) {
      showToast('⚠️ Apenas o Administrador Master pode editar permissões e cargos de usuários.');
      return;
    }
    setEditingUserId(user.id);
    setUserFormName(user.name);
    setUserFormUsername(user.username);
    setUserFormPassword('');
    const rawRole = user.role === 'admin' ? 'master' : (user.role || 'user');
    const safeRole: 'master' | 'manager' | 'user' = (rawRole === 'master' || rawRole === 'manager') ? rawRole : 'user';
    setUserFormRole(safeRole);
    setUserFormDepartment(user.department || '');
    setUserFormManagerPerms(user.managerPermissions || {
      allowGenerateLogins: true,
      canCreateManagerRole: false,
      allowChangePasswords: false,
      allowViewAllVisitors: false
    });
    setUserFormHasCustom(!!user.hasCustomPermissions);
    setUserFormLayers(user.customLayerPermissions || localLayerPerms);
    setUserFormFeatures(user.customFeaturePermissions || localFeaturePerms);
    setUserFormError(null);
    setIsUserModalOpen(true);
  }, [isMaster, localLayerPerms, localFeaturePerms, showToast]);

  const handleSaveRegisteredUserForm = async (e: React.FormEvent) => {
    e.preventDefault();
    setUserFormError(null);
    setIsUserFormSaving(true);

    try {
      const requester = currentActiveUser || (isMaster ? 'master' : null);
      const effectiveRole = canManagerCreateManagerRole ? userFormRole : 'user';

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
      }, requester);

      if (result.success) {
        setRegisteredUsers(result.users);
        logActivity(
          'ADMIN',
          editingUserId 
            ? `Atualizou configurações da conta de @${userFormUsername}` 
            : `Criou nova conta para @${userFormUsername} (${userFormName}) [${effectiveRole.toUpperCase()}]`,
          isMaster ? 'master' : 'manager'
        );
        setIsUserModalOpen(false);
        showToast(editingUserId ? 'Usuário atualizado com sucesso!' : 'Novo login salvo com sucesso!');
      } else {
        setUserFormError(result.error || 'Erro ao salvar usuário.');
      }
    } catch (err: unknown) {
      setUserFormError(err instanceof Error ? err.message : 'Erro ao processar formulário.');
    } finally {
      setIsUserFormSaving(false);
    }
  };

  const handleToggleRegisteredUserStatus = async (userId: string) => {
    if (!isMaster) {
      showToast('⚠️ Apenas o Administrador Master pode ativar ou desativar contas.');
      return;
    }
    const targetUser = registeredUsers.find(u => u.id === userId);
    const requester = currentActiveUser || (isMaster ? 'master' : null);
    const result = await toggleRegisteredUserStatus(userId, requester);
    if (result.success) {
      setRegisteredUsers(result.users);
      logActivity('ADMIN', `${targetUser?.isActive ? 'Bloqueou' : 'Ativou'} o acesso do usuário @${targetUser?.username || userId}`, 'master');
      showToast(`Status do usuário @${targetUser?.username} alterado com sucesso.`);
    } else {
      showToast(result.error || 'Erro ao alterar status.');
    }
  };

  const handlePromoteToManager = async (userId: string) => {
    if (window.confirm('Deseja promover este usuário ao cargo de GERENTE? Ele poderá gerenciar os membros da sua equipe.')) {
      const result = await promoteUserToManager(userId, currentActiveUser || 'master');
      if (result.success) {
        setRegisteredUsers(result.users);
        showToast('Usuário promovido a GERENTE com sucesso!');
      } else {
        showToast(result.error || 'Erro ao promover usuário.');
      }
    }
  };

  const handleDemoteToUser = async (userId: string) => {
    if (window.confirm('Deseja rebaixar este Gerente para USUÁRIO COMUM? Ele perderá o acesso ao painel administrativo.')) {
      const result = await demoteManagerToUser(userId, currentActiveUser || 'master');
      if (result.success) {
        setRegisteredUsers(result.users);
        showToast('Gerente rebaixado para Usuário Comum.');
      } else {
        showToast(result.error || 'Erro ao rebaixar gerente.');
      }
    }
  };

  const handleToggleSessionBlocked = (sessionId: string, currentBlocked: boolean) => {
    if (!isMaster) return;
    saveUserSessionConfig(sessionId, {
      isBlocked: !currentBlocked
    });
    logActivity('ADMIN', `${!currentBlocked ? 'Bloqueou' : 'Desbloqueou'} sessão de visitante (${sessionId})`, 'master');
    setUserSessions(getUserSessions());
    notifyPermissionsUpdated();
    showToast(`Sessão de visitante ${!currentBlocked ? 'bloqueada' : 'desbloqueada'} com sucesso!`);
  };

  // Handlers de Permissões Globais
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
      showToast('⚠️ Não foi possível salvar a alteração da camada.');
    } else {
      showToast(nextState ? `Camada "${layerName}" ativada!` : `Camada "${layerName}" desativada!`);
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
      showToast('⚠️ Não foi possível salvar as alterações.');
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
      showToast('⚠️ Não foi possível salvar a alteração.');
    } else {
      showToast(nextState ? 'Ferramenta ativada!' : 'Ferramenta desativada!');
    }
  };

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
    showToast(allow ? 'Todas as colunas de endereços ativadas!' : 'Todas as colunas de endereços desativadas!');
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
    showToast(allow ? 'Todas as propriedades ativadas!' : 'Todas as propriedades desativadas!');
  };

  const handleApplyPreset = async (preset: 'visitor' | 'user' | 'manager') => {
    if (!isMaster) return;

    let newFeatures: FeaturePermissions;

    if (preset === 'visitor') {
      newFeatures = {
        allowCnefeSearch: true,
        allowExportData: false,
        allowExportCsv: false,
        allowExportKml: false,
        allowExportKmz: false,
        allowExportGeoJson: false,
        allowExportShapefile: false,
        allowExportGeoPackage: false,
        allowMeasureTool: false,
        allowPrintA4: false,
        allowLayerPanel: true,
        allowDashboardRaioX: true,
        allowSelectedFeaturesPanel: true,
        allowFeatureSpecs: true,
        allowSourcesFooter: true,
        allowSearchActiveLayersOnly: true,
        allowDissolveFeatures: false,
        allowMultiSelect: false,
        allowSearchByType: true,
        allowSearchAreaAddresses: false,
        allowCustomizeUsefulInfo: false,
        allowBasemapSelector: true,
        allowMapLegend: true
      };
      showToast('Predefinição "Visitante / Cidadão Público" aplicada!');
    } else if (preset === 'user') {
      newFeatures = {
        allowCnefeSearch: true,
        allowExportData: true,
        allowExportCsv: true,
        allowExportKml: true,
        allowExportKmz: false,
        allowExportGeoJson: true,
        allowExportShapefile: false,
        allowExportGeoPackage: false,
        allowMeasureTool: true,
        allowPrintA4: true,
        allowLayerPanel: true,
        allowDashboardRaioX: true,
        allowSelectedFeaturesPanel: true,
        allowFeatureSpecs: true,
        allowSourcesFooter: true,
        allowSearchActiveLayersOnly: true,
        allowDissolveFeatures: false,
        allowMultiSelect: true,
        allowSearchByType: true,
        allowSearchAreaAddresses: true,
        allowCustomizeUsefulInfo: true,
        allowBasemapSelector: true,
        allowMapLegend: true
      };
      showToast('Predefinição "Usuário Cadastrado" aplicada!');
    } else {
      newFeatures = {
        allowCnefeSearch: true,
        allowExportData: true,
        allowExportCsv: true,
        allowExportKml: true,
        allowExportKmz: true,
        allowExportGeoJson: true,
        allowExportShapefile: true,
        allowExportGeoPackage: true,
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
        allowBasemapSelector: true,
        allowMapLegend: true
      };
      showToast('Predefinição "Gerente" aplicada!');
    }

    setLocalFeaturePerms(newFeatures);
    localStorage.setItem('webgis_feature_permissions', JSON.stringify(newFeatures));
    await saveFeaturePermissions(newFeatures);
    if (onUpdateFeaturePermissions) onUpdateFeaturePermissions(newFeatures);
    notifyPermissionsUpdated();
  };

  const handleClearLogs = () => {
    if (window.confirm('Tem certeza que deseja limpar todo o histórico de logs de auditoria?')) {
      clearActivityLogs();
      setLogs([]);
      showToast('Histórico de logs foi limpo com sucesso!');
    }
  };

  // Renderizador de Seções Apple Style
  const renderSectionContent = (section: AdminSection) => {
    switch (section) {
      case 'overview':
        return (
          <AdminOverviewSection
            registeredUsers={registeredUsers}
            userSessions={userSessions}
            logs={logs}
            isMaster={isMaster}
            isManager={isManager}
            canManagerGenerateLogins={canManagerGenerateLogins}
            onNavigateToSection={(s) => {
              setCurrentSection(s);
              setMobileSection(s);
            }}
            onOpenCreateUser={handleOpenCreateUser}
            onExportLogsCSV={() => {
              const visible = isMaster ? logs : logs.filter(l => (l.userRole || '').toLowerCase() !== 'master');
              exportActivityLogsToCSV(visible);
            }}
          />
        );

      case 'system':
        return isMaster ? (
          <AdminSystemSection
            onRefreshData={async () => {
              const users = await getRegisteredUsersAsync();
              setRegisteredUsers(users);
              const s = await getUserSessionsAsync();
              setUserSessions(s);
              const l = await getActivityLogsAsync();
              setLogs(l);
            }}
            onClearLogs={handleClearLogs}
            showToast={showToast}
            totalLogsCount={logs.length}
            totalSessionsCount={Object.keys(userSessions).length}
            totalUsersCount={registeredUsers.length}
          />
        ) : null;

      case 'users':
        return (
          <AdminUsersSection
            registeredUsers={registeredUsers}
            userSessions={userSessions}
            isMaster={isMaster}
            isManager={isManager}
            canManagerGenerateLogins={canManagerGenerateLogins}
            canManagerChangePasswords={canManagerChangePasswords}
            canManagerViewAllVisitors={canManagerViewAllVisitors}
            currentActiveUser={activeManagerUser}
            onOpenCreateUser={handleOpenCreateUser}
            onOpenEditUser={handleOpenEditUser}
            onOpenResetPassword={(u) => setResetPassUser(u)}
            onToggleUserStatus={(u) => handleToggleRegisteredUserStatus(u.id)}
            onPromoteUser={(u) => handlePromoteToManager(u.id)}
            onDemoteUser={(u) => handleDemoteToUser(u.id)}
            onDeleteUser={(u) => setDeleteConfirmUser(u)}
            onSelectUserDetail={(u) => setSelectedUserDetail(u)}
            onToggleSessionBlocked={handleToggleSessionBlocked}
            onSimulateUser={(u) => {
              if (typeof onClose === 'function') onClose();
              if (onSimulateUser) onSimulateUser(u.id, u.role);
            }}
          />
        );

      case 'access':
        return (
          <AdminAccessSection
            isMaster={isMaster}
            isManager={isManager}
            localLayerPerms={localLayerPerms}
            onToggleLayer={handleToggleGlobalLayer}
            onToggleAllLayers={handleToggleAllGlobalLayers}
            localFeaturePerms={localFeaturePerms}
            onToggleFeature={handleToggleGlobalFeature}
            onApplyPreset={handleApplyPreset}
            localAddressColumns={localAddressColumns}
            onToggleAddressColumn={handleToggleGlobalAddressColumn}
            onToggleAllAddressColumns={handleToggleAllGlobalAddressColumns}
            localFeatureProperties={localFeatureProperties}
            onToggleFeatureProperty={handleToggleGlobalFeatureProperty}
            onToggleAllFeatureProperties={handleToggleAllGlobalFeatureProperties}
          />
        );

      case 'activity':
        return (
          <AdminActivitySection
            logs={logs}
            userSessions={userSessions}
            isMaster={isMaster}
            onExportCSV={(logsToExport) => exportActivityLogsToCSV(logsToExport)}
            onClearLogs={handleClearLogs}
          />
        );

      default:
        return null;
    }
  };

  if (!isOpen) return null;

  return createPortal(
    <div 
      className="fixed inset-0 top-0 left-0 right-0 bottom-0 z-[9999] w-screen h-screen min-h-[100dvh] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-0 sm:p-4 overflow-hidden animate-fadeIn select-none"
      onWheel={(e) => e.stopPropagation()}
    >
      {/* ========================================================
          DESKTOP (>= md): Janela Apple com Barra Lateral macOS
         ======================================================== */}
      <div
        className="hidden md:flex bg-white dark:bg-[#161618] border border-black/[0.08] dark:border-white/[0.08] rounded-3xl shadow-2xl max-w-6xl w-full h-[88vh] max-h-[860px] overflow-hidden my-auto overscroll-contain"
        onClick={(e) => e.stopPropagation()}
        onWheel={(e) => e.stopPropagation()}
      >
        <AdminSidebar
          currentSection={currentSection}
          onSelectSection={setCurrentSection}
          isMaster={isMaster}
          isManager={isManager}
          currentUserRole={currentUserRole}
          currentActiveUser={activeManagerUser}
          onClose={onClose}
          pendingAlertsCount={pendingAlertsCount}
          totalUsersCount={registeredUsers.length}
        />

        <div className="flex-1 flex flex-col h-full overflow-hidden bg-[#f8f8fa] dark:bg-[#000000]">
          {/* Topbar Desktop Sóbria */}
          <div className="h-14 px-6 border-b border-black/[0.05] dark:border-white/[0.06] flex items-center justify-between shrink-0 bg-white/70 dark:bg-[#161618]/70 backdrop-blur-md">
            <div>
              <h1 className="text-sm font-bold text-slate-900 dark:text-slate-100 tracking-tight">
                {currentSection === 'overview' && 'Visão Geral do WebGIS'}
                {currentSection === 'users' && 'Gestão de Usuários & Equipe'}
                {currentSection === 'access' && 'Políticas de Acesso & Permissões'}
                {currentSection === 'activity' && 'Auditoria e Histórico de Logs'}
                {currentSection === 'system' && 'Configurações do Sistema'}
              </h1>
            </div>

            <div className="flex items-center gap-2">
              {isMaster && onOpenSimulationChoice && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenSimulationChoice();
                  }}
                  className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-black/[0.04] dark:bg-white/[0.06] hover:bg-black/[0.08] dark:hover:bg-white/[0.1] text-slate-700 dark:text-slate-200 transition-colors flex items-center gap-1.5 cursor-pointer"
                  title="Simular a visão de Visitante ou Gerente"
                >
                  <Eye className="w-3.5 h-3.5 text-[#007AFF]" />
                  <span>Simular Visão</span>
                </button>
              )}

              <button
                type="button"
                onClick={onClose}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1.5 rounded-xl hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer"
                title="Fechar Painel"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Área de Conteúdo Desktop */}
          <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
            {renderSectionContent(currentSection)}
          </div>
        </div>
      </div>

      {/* ========================================================
          MOBILE (< md): Tela Cheia Empilhada estilo Ajustes iOS
         ======================================================== */}
      <div 
        className="md:hidden w-full h-full min-h-[100dvh] flex flex-col bg-[#f2f2f7] dark:bg-[#000000] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        onWheel={(e) => e.stopPropagation()}
      >
        <AdminMobileNavigation
          currentSection={mobileSection}
          onSelectSection={setMobileSection}
          isMaster={isMaster}
          isManager={isManager}
          currentUserRole={currentUserRole}
          currentActiveUser={activeManagerUser}
          onClose={onClose}
          pendingAlertsCount={pendingAlertsCount}
          totalUsersCount={registeredUsers.length}
        >
          {mobileSection && renderSectionContent(mobileSection)}
        </AdminMobileNavigation>
      </div>

      {/* Modal de Criação / Edição de Usuário */}
      <AdminUserFormModal
        isOpen={isUserModalOpen}
        onClose={() => setIsUserModalOpen(false)}
        isMaster={isMaster}
        isManager={isManager}
        canManagerCreateManagerRole={canManagerCreateManagerRole}
        editingUserId={editingUserId}
        userFormName={userFormName}
        setUserFormName={setUserFormName}
        userFormUsername={userFormUsername}
        setUserFormUsername={setUserFormUsername}
        userFormPassword={userFormPassword}
        setUserFormPassword={setUserFormPassword}
        userFormRole={userFormRole}
        setUserFormRole={setUserFormRole}
        userFormDepartment={userFormDepartment}
        setUserFormDepartment={setUserFormDepartment}
        userFormManagerPerms={userFormManagerPerms}
        setUserFormManagerPerms={setUserFormManagerPerms}
        userFormHasCustom={userFormHasCustom}
        setUserFormHasCustom={setUserFormHasCustom}
        userFormLayers={userFormLayers}
        setUserFormLayers={setUserFormLayers}
        userFormFeatures={userFormFeatures}
        setUserFormFeatures={setUserFormFeatures}
        userFormError={userFormError}
        onSave={handleSaveRegisteredUserForm}
        isSaving={isUserFormSaving}
      />

      {/* Modal de Redefinição de Senha */}
      {resetPassUser && (
        <AdminResetPasswordModal
          user={resetPassUser}
          onClose={() => setResetPassUser(null)}
          onConfirm={async (userId, newPass) => {
            const requester = currentActiveUser || (isMaster ? 'master' : null);
            const result = await changeUserPassword(userId, newPass, requester);
            if (!result.success) {
              throw new Error(result.error || 'Erro ao redefinir senha.');
            }
            if (!result.syncedToServer) {
              throw new Error(result.syncError || 'Não foi possível sincronizar com o servidor.');
            }
            setRegisteredUsers(result.users);
            logActivity('ADMIN', `Redefiniu a senha de acesso provisória do usuário @${resetPassUser.username}`, isMaster ? 'master' : 'manager');
            showToast(`Senha de "${resetPassUser.name}" atualizada com sucesso!`);
          }}
        />
      )}

      {/* Modal de Confirmação Segura de Exclusão */}
      {deleteConfirmUser && (
        <AdminDeleteUserModal
          user={deleteConfirmUser}
          onClose={() => setDeleteConfirmUser(null)}
          onConfirm={async (userId) => {
            const requester = currentActiveUser || (isMaster ? 'master' : null);
            const result = await deleteRegisteredUser(userId, requester);
            if (!result.success) {
              throw new Error(result.error || 'Erro ao excluir usuário.');
            }
            setRegisteredUsers(result.users);
            logActivity('ADMIN', `Excluiu permanentemente a conta do usuário @${deleteConfirmUser.username}`, 'master');
            showToast('Login de usuário excluído com sucesso.');
          }}
        />
      )}

      {/* Modal de Ficha Cadastral e Histórico */}
      {selectedUserDetail && (
        <AdminUserDetailModal
          user={selectedUserDetail}
          onClose={() => setSelectedUserDetail(null)}
          allUsers={registeredUsers}
          logs={logs}
          isMaster={isMaster}
        />
      )}
    </div>,
    document.body
  );
};
