import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { MotionConfig } from 'motion/react';
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
  logActivity,
  CapabilityAuditLog,
  getCapabilityAuditLogs,
  getCapabilityAuditLogsAsync,
  logCapabilityAudit,
  exportCapabilityAuditLogsToCSV,
  getAllCapabilitiesCatalog,
  saveUserOverride,
  saveManagerScope
} from '../services/adminService';
import { dataSources } from '../data';
import { useAccess } from '../context/FeatureAccessContext';
import { AdminSection } from './admin/types';
import { AdminSidebar } from './admin/AdminSidebar';
import { AdminMobileNavigation } from './admin/AdminMobileNavigation';
import { AdminOverviewSection, filterVisibleActivityLogs } from './admin/AdminOverviewSection';
import { AdminSystemSection } from './admin/AdminSystemSection';
import { AdminUsersSection } from './admin/AdminUsersSection';
import { AdminAccessSection } from './admin/AdminAccessSection';
import { AdminActivitySection, filterVisibleCapabilityAuditLogs } from './admin/AdminActivitySection';
import { AdminUserFormModal } from './admin/AdminUserFormModal';
import { AdminUserDetailModal } from './admin/AdminUserDetailModal';
import { AdminResetPasswordModal, AdminDeleteUserModal } from './admin/AdminUserConfirmModals';
import './admin/ui/admin-theme.css';

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
  onSimulateUser?: (sessionId: string | null, role?: UserRole) => void;
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
  const [capabilityAuditLogs, setCapabilityAuditLogs] = useState<CapabilityAuditLog[]>(() => getCapabilityAuditLogs());

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
  const { can, canGrant, refreshAccess } = useAccess();
  const canManagerGenerateLogins = isMaster || can('admin:users:create');
  const canManagerCreateManagerRole = isMaster || can('admin:users:promote_manager');
  const canManagerChangePasswords = isMaster || can('admin:users:reset_password');
  const canManagerViewAllVisitors = isMaster || can('admin:users:view');
  const canViewUsers = isMaster || can('admin:users:view');
  const canBlockUsers = isMaster || can('admin:users:block');
  const canDeleteUsers = isMaster || can('admin:users:delete');
  const canViewLogs = isMaster || can('admin:logs:view');
  const canExportLogs = isMaster || can('admin:logs:export');
  const canSimulateProfile = isMaster || can('admin:simulate:profile');
  const canManageRoles =
    isMaster ||
    can('admin:roles:manage_visitor') ||
    can('admin:roles:manage_site_account') ||
    can('admin:roles:manage_user');
  const hasAnyGrantCap = useMemo(
    () => getAllCapabilitiesCatalog(dataSources.map(ds => ds.name)).some(c => canGrant(c.key)),
    [canGrant]
  );
  const canViewAccess = isMaster || canManageRoles || hasAnyGrantCap;

  const visibleSections = useMemo<AdminSection[]>(() => {
    const list: AdminSection[] = ['overview'];
    if (canViewUsers) list.push('users');
    if (canViewAccess) list.push('access');
    if (canViewLogs) list.push('activity');
    if (isMaster || isManager) list.push('system');
    return list;
  }, [canViewUsers, canViewAccess, canViewLogs, isMaster]);

  useEffect(() => {
    if (!visibleSections.includes(currentSection)) {
      setCurrentSection(visibleSections[0] || 'overview');
    }
    if (mobileSection && !visibleSections.includes(mobileSection)) {
      setMobileSection(visibleSections[0] || null);
    }
  }, [visibleSections, currentSection, mobileSection]);

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

  const visibleLogs = useMemo(
    () => filterVisibleActivityLogs(logs, isMaster, registeredUsers, userSessions),
    [logs, isMaster, registeredUsers, userSessions]
  );

  const visibleCapabilityAuditLogs = useMemo(
    () => filterVisibleCapabilityAuditLogs(capabilityAuditLogs, isMaster, registeredUsers, userSessions),
    [capabilityAuditLogs, isMaster, registeredUsers, userSessions]
  );

  // Contagem de alertas pendentes (usuários bloqueados ou com troca de senha obrigatória pendente)
  const pendingAlertsCount = useMemo(() => {
    const visibleUsers = isMaster
      ? registeredUsers
      : registeredUsers.filter(u => u.role !== 'master' && (u.role as string) !== 'admin');
    const blocked = visibleUsers.filter(u => u.isActive === false).length;
    const pwdPending = visibleUsers.filter(u => u.mustChangePassword === true).length;
    return blocked + pwdPending;
  }, [registeredUsers, isMaster]);

  // Sincronização e travamento do scroll ao abrir o modal
  const wasOpenRef = useRef(false);
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

      // Atualização em background via Supabase APENAS na transição de abertura (não a cada render/toggle)
      if (!wasOpenRef.current) {
        wasOpenRef.current = true;
        getActivityLogsAsync().then(liveLogs => {
          if (liveLogs && liveLogs.length > 0) setLogs(liveLogs);
        }).catch(() => { });

        getUserSessionsAsync().then(s => {
          if (s && Object.keys(s).length > 0) setUserSessions(s);
        }).catch(() => { });

        getRegisteredUsersAsync().then(users => {
          if (users && users.length > 0) setRegisteredUsers(users);
        }).catch(() => { });

        getCapabilityAuditLogsAsync().then(auditList => {
          if (auditList && auditList.length > 0) setCapabilityAuditLogs(auditList);
        }).catch(() => { });
      }
    } else {
      wasOpenRef.current = false;
    }

    return () => {
      document.body.style.overflow = '';
      document.documentElement.style.overflow = '';
    };
  }, [isOpen]);

  // Ouvinte de evento customizado para sincronização em tempo real entre abas/janelas
  useEffect(() => {
    const handlePermissionsUpdated = () => {
      setRegisteredUsers(getRegisteredUsers());
      setUserSessions(getUserSessions());
      setLocalLayerPerms(getLayerPermissions([]));
      setLocalFeaturePerms(getFeaturePermissions());
      setLocalAddressColumns(getAddressColumnsPermissions());
      setLocalFeatureProperties(getFeaturePropertiesPermissions());
      setCapabilityAuditLogs(getCapabilityAuditLogs());
    };
    window.addEventListener('webgis_permissions_updated', handlePermissionsUpdated);
    return () => {
      window.removeEventListener('webgis_permissions_updated', handlePermissionsUpdated);
    };
  }, []);

  // Handlers de Criação / Edição de Usuário
  const handleOpenCreateUser = useCallback(() => {
    if (!canManagerGenerateLogins) {
      showToast(
        isMaster
          ? '⚠️ Apenas o Administrador Master ou gerentes autorizados podem criar novos usuários.'
          : '⚠️ Você não tem permissão para esta ação.'
      );
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
      showToast('⚠️ Você não tem permissão para esta ação.');
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
        if (isMaster && effectiveRole === 'manager') {
          const savedMgr = result.users.find(
            u => (editingUserId && u.id === editingUserId) || u.username.toLowerCase() === userFormUsername.trim().toLowerCase()
          );
          if (savedMgr?.id) {
            const capPairs: Array<[string, boolean]> = [
              ['admin:users:create', userFormManagerPerms.allowGenerateLogins !== false],
              ['admin:users:reset_password', userFormManagerPerms.allowChangePasswords === true],
              ['admin:users:block', userFormManagerPerms.allowBlockUsers === true],
              ['admin:users:delete', userFormManagerPerms.allowDeleteUsers === true],
              ['admin:users:promote_manager', userFormManagerPerms.canCreateManagerRole === true],
              ['admin:roles:manage_visitor', userFormManagerPerms.allowManageRolesVisitor === true],
              ['admin:roles:manage_site_account', userFormManagerPerms.allowManageRolesSiteAccount === true],
              ['admin:roles:manage_user', userFormManagerPerms.allowManageRolesUser === true],
              ['admin:logs:view', userFormManagerPerms.allowViewLogs !== false],
              ['admin:logs:export', userFormManagerPerms.allowExportLogs !== false],
              ['admin:simulate:profile', userFormManagerPerms.allowSimulateProfile !== false],
            ];
            await Promise.all([
              ...capPairs.map(([key, enabled]) =>
                saveUserOverride(savedMgr.id, key, enabled ? 'allow' : 'deny', false, { targetRole: 'manager' })
              ),
              saveManagerScope(savedMgr.id, {
                scope_type: userFormManagerPerms.scopeType || 'team_only',
                can_manage_visitors: userFormManagerPerms.allowManageVisitors === true,
                can_manage_site_accounts: userFormManagerPerms.allowManageSiteAccounts === true
              })
            ]);
          }
        }
        logActivity(
          'ADMIN',
          editingUserId
            ? `Atualizou configurações da conta de @${userFormUsername}`
            : `Criou nova conta para @${userFormUsername} (${userFormName}) [${effectiveRole.toUpperCase()}]`,
          isMaster ? 'master' : 'manager'
        );
        logCapabilityAudit({
          performedByName: currentActiveUser?.name || (isMaster ? 'Administrador Master' : 'Gerente'),
          targetType: 'user',
          targetId: userFormUsername,
          targetName: userFormName,
          capabilityKey: editingUserId ? 'admin:users:update' : 'admin:users:create',
          action: 'grant_use',
          afterState: { role: effectiveRole, hasCustom: userFormHasCustom },
          reason: editingUserId ? `Atualização cadastral e poderes de @${userFormUsername}` : `Criação de conta @${userFormUsername} (${effectiveRole})`
        });
        setCapabilityAuditLogs(getCapabilityAuditLogs());
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
    if (!canBlockUsers) {
      showToast('⚠️ Você não tem permissão para esta ação.');
      return;
    }
    const targetUser = registeredUsers.find(u => u.id === userId);
    const requester = currentActiveUser || (isMaster ? 'master' : null);
    const result = await toggleRegisteredUserStatus(userId, requester);
    if (result.success) {
      setRegisteredUsers(result.users);
      logActivity('ADMIN', `${targetUser?.isActive ? 'Bloqueou' : 'Ativou'} o acesso do usuário @${targetUser?.username || userId}`, 'master');
      logCapabilityAudit({
        performedByName: currentActiveUser?.name || 'Administrador Master',
        targetType: 'user',
        targetId: targetUser?.username || userId,
        targetName: targetUser?.name,
        capabilityKey: 'admin:users:block',
        action: targetUser?.isActive ? 'set_deny' : 'remove_override',
        beforeState: { isActive: targetUser?.isActive },
        afterState: { isActive: !targetUser?.isActive },
        reason: targetUser?.isActive ? 'Bloqueio administrativo de acesso à conta' : 'Desbloqueio e reativação da conta'
      });
      setCapabilityAuditLogs(getCapabilityAuditLogs());
      showToast(`Status do usuário @${targetUser?.username} alterado com sucesso.`);
    } else {
      showToast(result.error || 'Erro ao alterar status.');
    }
  };

  const handlePromoteToManager = async (userId: string) => {
    if (!canManagerCreateManagerRole) {
      showToast('⚠️ Você não tem permissão para esta ação.');
      return;
    }
    if (window.confirm('Deseja promover este usuário ao cargo de GERENTE? Ele poderá gerenciar os membros da sua equipe.')) {
      const result = await promoteUserToManager(userId, currentActiveUser || 'master');
      if (result.success) {
        setRegisteredUsers(result.users);
        logCapabilityAudit({
          performedByName: currentActiveUser?.name || 'Administrador Master',
          targetType: 'user',
          targetId: userId,
          capabilityKey: 'admin:users:promote_manager',
          action: 'grant_delegate',
          beforeState: { role: 'user' },
          afterState: { role: 'manager' },
          reason: 'Promoção para cargo de Gerente com poderes delegados'
        });
        setCapabilityAuditLogs(getCapabilityAuditLogs());
        showToast('Usuário promovido a GERENTE com sucesso!');
      } else {
        showToast(result.error || 'Erro ao promover usuário.');
      }
    }
  };

  const handleDemoteToUser = async (userId: string) => {
    if (!canManagerCreateManagerRole) {
      showToast('⚠️ Você não tem permissão para esta ação.');
      return;
    }
    if (window.confirm('Deseja rebaixar este Gerente para USUÁRIO COMUM? Ele perderá o acesso ao painel administrativo.')) {
      const result = await demoteManagerToUser(userId, currentActiveUser || 'master');
      if (result.success) {
        setRegisteredUsers(result.users);
        logCapabilityAudit({
          performedByName: currentActiveUser?.name || 'Administrador Master',
          targetType: 'user',
          targetId: userId,
          capabilityKey: 'admin:users:promote_manager',
          action: 'revoke_delegate',
          beforeState: { role: 'manager' },
          afterState: { role: 'user' },
          reason: 'Rebaixamento de Gerente para Usuário Comum'
        });
        setCapabilityAuditLogs(getCapabilityAuditLogs());
        showToast('Gerente rebaixado para Usuário Comum.');
      } else {
        showToast(result.error || 'Erro ao rebaixar gerente.');
      }
    }
  };

  const handleToggleSessionBlocked = (sessionId: string, currentBlocked: boolean) => {
    if (!canBlockUsers) return;
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
            logs={visibleLogs}
            isMaster={isMaster}
            isManager={isManager}
            canManagerGenerateLogins={canManagerGenerateLogins}
            onNavigateToSection={(s) => {
              setCurrentSection(s);
              setMobileSection(s);
            }}
            onOpenCreateUser={handleOpenCreateUser}
            onExportLogsCSV={canExportLogs ? () => {
              exportActivityLogsToCSV(visibleLogs);
            } : undefined}
          />
        );

      case 'system':
        return (isMaster || isManager) ? (
          <AdminSystemSection
            isMaster={isMaster}
            isManager={isManager}
            onRefreshData={async () => {
              const [users, s, l, al] = await Promise.all([
                getRegisteredUsersAsync(),
                getUserSessionsAsync(),
                getActivityLogsAsync(),
                getCapabilityAuditLogsAsync()
              ]);
              setRegisteredUsers(users);
              setUserSessions(s);
              setLogs(l);
              setCapabilityAuditLogs(al);
              notifyPermissionsUpdated();
              await refreshAccess();
            }}
            onClearLogs={handleClearLogs}
            showToast={showToast}
            totalLogsCount={visibleLogs.length}
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
            canBlockUsers={canBlockUsers}
            canDeleteUsers={canDeleteUsers}
            canSimulateUsers={canSimulateProfile}
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
            registeredUsers={registeredUsers}
            currentActiveUser={activeManagerUser}
            onSimulateRole={(role) => {
              if (typeof onClose === 'function') onClose();
              if (onSimulateUser) onSimulateUser(null, role === 'visitor' ? 'user' : (role as any));
            }}
            onNavigateToAudit={canViewLogs ? () => {
              setCurrentSection('activity');
              setMobileSection('activity');
            } : undefined}
            showToast={showToast}
          />
        );

      case 'activity':
        return (
          <AdminActivitySection
            logs={visibleLogs}
            capabilityAuditLogs={visibleCapabilityAuditLogs}
            registeredUsers={registeredUsers}
            userSessions={userSessions}
            isMaster={isMaster}
            canExportLogs={canExportLogs}
            onExportCSV={(logsToExport) =>
              exportActivityLogsToCSV(
                filterVisibleActivityLogs(logsToExport, isMaster, registeredUsers, userSessions)
              )
            }
            onExportCapabilityAuditCSV={(al) =>
              exportCapabilityAuditLogsToCSV(
                filterVisibleCapabilityAuditLogs(al, isMaster, registeredUsers, userSessions)
              )
            }
            onClearLogs={handleClearLogs}
          />
        );

      default:
        return null;
    }
  };

  if (!isOpen) return null;

  return createPortal(
    <MotionConfig reducedMotion="user">
    <div
      className="admin-panel fixed inset-0 top-0 left-0 right-0 bottom-0 z-[9999] w-screen h-screen min-h-[100dvh] bg-[#F2F2F7] dark:bg-[#000000] flex overflow-hidden animate-fadeIn select-none p-0"
      onWheel={(e) => e.stopPropagation()}
    >
      {/* ========================================================
          DESKTOP (>= md): Janela Apple com Barra Lateral macOS
         ======================================================== */}
      <div
        className="hidden md:flex w-full h-full min-h-[100dvh] overflow-hidden overscroll-contain bg-[#F2F2F7] dark:bg-[#000000]"
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
          visibleSections={visibleSections}
        />

        <div className="flex-1 flex flex-col h-full overflow-hidden bg-[#F2F2F7] dark:bg-[#000000]">
          {/* Topbar Desktop Sóbria (sem título repetido, apenas ações) */}
          <div className="h-14 px-6 border-b border-black/[0.06] dark:border-white/[0.08] flex items-center justify-end shrink-0 bg-white/85 dark:bg-[#1C1C1E]/85 backdrop-blur-md select-none">
            <div className="flex items-center gap-2">
              {(isMaster || canSimulateProfile) && onOpenSimulationChoice && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenSimulationChoice();
                  }}
                  className="px-3.5 py-1.5 rounded-xl text-xs font-medium bg-black/[0.05] dark:bg-white/[0.08] hover:bg-black/[0.08] dark:hover:bg-white/[0.12] text-slate-800 dark:text-slate-200 transition-colors flex items-center gap-1.5 cursor-pointer min-h-[36px]"
                  title="Simular a visão de Visitante ou Gerente"
                >
                  <Eye className="w-3.5 h-3.5 text-[#007AFF] dark:text-[#0A84FF]" strokeWidth={1.6} />
                  <span>Simular Visão</span>
                </button>
              )}

              <button
                type="button"
                onClick={onClose}
                className="text-[#8E8E93] hover:text-slate-900 dark:hover:text-white p-2 rounded-xl hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center"
                title="Fechar Painel"
                aria-label="Fechar Painel"
              >
                <X className="w-5 h-5" strokeWidth={1.6} />
              </button>
            </div>
          </div>

          {/* Área de Conteúdo Desktop */}
          <div className="flex-1 overflow-y-auto p-6 custom-scrollbar bg-[#F2F2F7] dark:bg-[#000000]">
            <div className="max-w-[1500px] mx-auto w-full">
              {renderSectionContent(currentSection)}
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================
          MOBILE (< md): Tela Cheia Empilhada estilo Ajustes iOS
         ======================================================== */}
      <div
        className="md:hidden w-full h-full min-h-[100dvh] flex flex-col bg-[#F2F2F7] dark:bg-[#000000] overflow-hidden"
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
          visibleSections={visibleSections}
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
          isManager={isManager}
          currentActiveUser={activeManagerUser}
          onSimulateUser={canSimulateProfile ? (u) => {
            setSelectedUserDetail(null);
            if (typeof onClose === 'function') onClose();
            if (onSimulateUser) onSimulateUser(u.id, u.role);
          } : undefined}
          onNavigateToAudit={canViewLogs ? () => {
            setSelectedUserDetail(null);
            setCurrentSection('activity');
            setMobileSection('activity');
          } : undefined}
          showToast={showToast}
        />
      )}
    </div>
    </MotionConfig>,
    document.body
  );
};
