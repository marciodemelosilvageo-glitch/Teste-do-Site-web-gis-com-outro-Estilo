import React, { useState, useMemo } from 'react';
import {
  Users,
  Plus,
  Crown,
  Briefcase,
  User,
  Key,
  Ban,
  CheckCircle2,
  Trash2,
  Sliders,
  Eye,
  Smartphone,
  Clock,
  Filter
} from 'lucide-react';
import { RegisteredUser, UserSessionConfig } from '../../services/adminService';
import {
  Badge,
  StatusDot,
  SegmentedControl,
  SearchField,
  AdminCard
} from './ui';

interface AdminUsersSectionProps {
  registeredUsers: RegisteredUser[];
  userSessions: Record<string, UserSessionConfig>;
  isMaster: boolean;
  isManager: boolean;
  canManagerGenerateLogins: boolean;
  canManagerChangePasswords: boolean;
  canManagerViewAllVisitors: boolean;
  currentActiveUser: RegisteredUser | null;
  onOpenCreateUser: () => void;
  onOpenEditUser: (user: RegisteredUser) => void;
  onOpenResetPassword: (user: RegisteredUser) => void;
  onToggleUserStatus: (user: RegisteredUser) => void;
  onPromoteUser: (user: RegisteredUser) => void;
  onDemoteUser: (user: RegisteredUser) => void;
  onDeleteUser: (user: RegisteredUser) => void;
  onSelectUserDetail: (user: RegisteredUser) => void;
  onSelectSessionDetail?: (session: UserSessionConfig) => void;
  onToggleSessionBlocked?: (sessionId: string, currentBlocked: boolean) => void;
  onSimulateUser?: (user: RegisteredUser) => void;
}

export const AdminUsersSection: React.FC<AdminUsersSectionProps> = ({
  registeredUsers,
  userSessions,
  isMaster,
  isManager,
  canManagerGenerateLogins,
  canManagerChangePasswords,
  canManagerViewAllVisitors,
  currentActiveUser,
  onOpenCreateUser,
  onOpenEditUser,
  onOpenResetPassword,
  onToggleUserStatus,
  onDeleteUser,
  onSelectUserDetail,
  onToggleSessionBlocked,
  onSimulateUser
}) => {
  // Aba ativa: 'registered' (contas cadastradas) ou 'sessions' (visitantes anônimos)
  const [viewMode, setViewMode] = useState<'registered' | 'sessions'>('registered');
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<'ALL' | 'MASTER' | 'MANAGER' | 'USER' | 'MY_TEAM'>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'BLOCKED' | 'MUST_CHANGE'>('ALL');

  // Filtragem dos usuários cadastrados
  const filteredUsers = useMemo(() => {
    return registeredUsers.filter(u => {
      // 1. Visibilidade de gerentes (apenas membros da sua equipe, a menos que seja master)
      if (isManager && !isMaster) {
        const myName = (currentActiveUser?.username || '').toLowerCase();
        const isMyCreation = (u.createdBy || '').toLowerCase() === myName;
        const isSelf = u.id === currentActiveUser?.id || (u.username || '').toLowerCase() === myName;
        if (!isMyCreation && !isSelf) return false;
      }

      // 2. Filtro de papel
      if (roleFilter === 'MASTER' && u.role !== 'master') return false;
      if (roleFilter === 'MANAGER' && u.role !== 'manager') return false;
      if (roleFilter === 'USER' && u.role !== 'user') return false;
      if (roleFilter === 'MY_TEAM') {
        const myName = (currentActiveUser?.username || '').toLowerCase();
        if ((u.createdBy || '').toLowerCase() !== myName) return false;
      }

      // 3. Filtro de status
      if (statusFilter === 'ACTIVE' && u.isActive === false) return false;
      if (statusFilter === 'BLOCKED' && u.isActive !== false) return false;
      if (statusFilter === 'MUST_CHANGE' && !u.mustChangePassword) return false;

      // 4. Termo de busca
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase();
        const matchesName = u.name?.toLowerCase().includes(term);
        const matchesUser = u.username?.toLowerCase().includes(term);
        const matchesDept = u.department?.toLowerCase().includes(term);
        if (!matchesName && !matchesUser && !matchesDept) return false;
      }

      return true;
    });
  }, [registeredUsers, isMaster, isManager, currentActiveUser, roleFilter, statusFilter, searchTerm]);

  // Lista de sessões de visitantes anônimos
  const sessionList = useMemo(() => {
    const list = Object.values(userSessions);
    if (!searchTerm.trim()) return list;
    const term = searchTerm.toLowerCase();
    return list.filter(s => 
      (s.customName || '').toLowerCase().includes(term) ||
      (s.sessionId || '').toLowerCase().includes(term) ||
      (s.device || '').toLowerCase().includes(term)
    );
  }, [userSessions, searchTerm]);

  return (
    <div className="space-y-4 animate-fadeIn">
      {/* Barra de Topo da Seção com SegmentedControl e Botão Novo Usuário */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-2 border-b border-black/[0.06] dark:border-white/[0.06]">
        <SegmentedControl
          options={[
            { id: 'registered', label: 'Contas Cadastradas', count: registeredUsers.length, icon: Users },
            ...((isMaster || canManagerViewAllVisitors)
              ? [{ id: 'sessions', label: 'Visitantes', count: Object.keys(userSessions).length, icon: Smartphone }]
              : [])
          ]}
          value={viewMode}
          onChange={(v) => setViewMode(v as 'registered' | 'sessions')}
        />

        {/* Botão Novo Usuário */}
        {canManagerGenerateLogins && (
          <button
            type="button"
            onClick={onOpenCreateUser}
            className="min-h-[44px] px-4 py-2 rounded-xl bg-[#007AFF] hover:bg-[#0062CC] dark:bg-[#0A84FF] dark:hover:bg-[#409CFF] active:scale-[0.98] text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-all shadow-xs cursor-pointer shrink-0 select-none"
          >
            <Plus className="w-4 h-4" strokeWidth={1.6} />
            <span>Novo Usuário</span>
          </button>
        )}
      </div>

      {/* Busca em Cápsula e Filtros */}
      <div className="space-y-3">
        <SearchField
          value={searchTerm}
          onChange={setSearchTerm}
          placeholder={viewMode === 'registered' ? "Buscar por nome, @login ou setor..." : "Buscar visitante por ID ou dispositivo..."}
        />

        {/* Filtros por Segmentos Sutis (modo de usuários cadastrados) */}
        {viewMode === 'registered' && (
          <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs select-none">
            <span className="text-xs text-[#8E8E93] mr-1 shrink-0 flex items-center gap-1 font-medium">
              <Filter className="w-3.5 h-3.5" strokeWidth={1.6} /> Papel:
            </span>
            <button
              type="button"
              onClick={() => setRoleFilter('ALL')}
              className={`min-h-[32px] px-3 py-1 rounded-xl text-xs font-medium cursor-pointer shrink-0 transition-colors ${
                roleFilter === 'ALL'
                  ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-semibold'
                  : 'bg-black/[0.04] dark:bg-white/[0.06] text-[#6C6C70] dark:text-[#98989D] hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Todos
            </button>
            {isMaster && (
              <>
                <button
                  type="button"
                  onClick={() => setRoleFilter('MASTER')}
                  className={`min-h-[32px] px-3 py-1 rounded-xl text-xs font-medium cursor-pointer shrink-0 transition-colors ${
                    roleFilter === 'MASTER'
                      ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-semibold'
                      : 'bg-black/[0.04] dark:bg-white/[0.06] text-[#6C6C70] dark:text-[#98989D] hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  Masters
                </button>
                <button
                  type="button"
                  onClick={() => setRoleFilter('MANAGER')}
                  className={`min-h-[32px] px-3 py-1 rounded-xl text-xs font-medium cursor-pointer shrink-0 transition-colors ${
                    roleFilter === 'MANAGER'
                      ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-semibold'
                      : 'bg-black/[0.04] dark:bg-white/[0.06] text-[#6C6C70] dark:text-[#98989D] hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  Gerentes
                </button>
              </>
            )}
            <button
              type="button"
              onClick={() => setRoleFilter('USER')}
              className={`min-h-[32px] px-3 py-1 rounded-xl text-xs font-medium cursor-pointer shrink-0 transition-colors ${
                roleFilter === 'USER'
                  ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-semibold'
                  : 'bg-black/[0.04] dark:bg-white/[0.06] text-[#6C6C70] dark:text-[#98989D] hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Comuns
            </button>
            {isManager && !isMaster && (
              <button
                type="button"
                onClick={() => setRoleFilter('MY_TEAM')}
                className={`min-h-[32px] px-3 py-1 rounded-xl text-xs font-medium cursor-pointer shrink-0 transition-colors ${
                  roleFilter === 'MY_TEAM'
                    ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-semibold'
                    : 'bg-black/[0.04] dark:bg-white/[0.06] text-[#6C6C70] dark:text-[#98989D] hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Minha Equipe
              </button>
            )}

            <div className="h-4 w-px bg-black/[0.08] dark:bg-white/[0.08] mx-1 shrink-0" />

            <span className="text-xs text-[#8E8E93] mr-1 shrink-0 font-medium">
              Status:
            </span>
            <button
              type="button"
              onClick={() => setStatusFilter(statusFilter === 'BLOCKED' ? 'ALL' : 'BLOCKED')}
              className={`min-h-[32px] px-3 py-1 rounded-xl text-xs font-medium cursor-pointer shrink-0 transition-colors flex items-center gap-1.5 ${
                statusFilter === 'BLOCKED'
                  ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-semibold'
                  : 'bg-black/[0.04] dark:bg-white/[0.06] text-[#6C6C70] dark:text-[#98989D] hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <StatusDot status="destructive" />
              <span>Bloqueados</span>
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter(statusFilter === 'MUST_CHANGE' ? 'ALL' : 'MUST_CHANGE')}
              className={`min-h-[32px] px-3 py-1 rounded-xl text-xs font-medium cursor-pointer shrink-0 transition-colors flex items-center gap-1.5 ${
                statusFilter === 'MUST_CHANGE'
                  ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-semibold'
                  : 'bg-black/[0.04] dark:bg-white/[0.06] text-[#6C6C70] dark:text-[#98989D] hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <StatusDot status="warning" />
              <span>Troca Pendente</span>
            </button>
          </div>
        )}
      </div>

      {/* ========================================================
          VISÃO 1: LISTA DE USUÁRIOS CADASTRADOS (APPLE INSET)
         ======================================================== */}
      {viewMode === 'registered' && (
        <div className="space-y-2.5">
          {filteredUsers.length === 0 ? (
            <AdminCard className="text-center py-10 space-y-2">
              <Users className="w-8 h-8 mx-auto text-[#8E8E93]" strokeWidth={1.6} />
              <p className="text-xs font-medium text-[#6C6C70] dark:text-[#98989D]">
                Nenhum usuário encontrado com os filtros atuais.
              </p>
            </AdminCard>
          ) : (
            filteredUsers.map((user) => {
              const isUserMaster = user.role === 'master' || (user.role as any) === 'admin';
              const isUserManager = user.role === 'manager';
              const isSelf = user.id === currentActiveUser?.id || (user.username && currentActiveUser?.username && user.username.toLowerCase() === currentActiveUser.username.toLowerCase());
              const isMyCreation = user.createdBy && currentActiveUser?.username && user.createdBy.toLowerCase() === currentActiveUser.username.toLowerCase();
              const canResetPass = isMaster || (isManager && canManagerChangePasswords && isMyCreation && user.role === 'user');

              return (
                <div
                  key={user.id}
                  className={`p-3.5 bg-white dark:bg-[#1C1C1E] rounded-2xl border transition-all ${
                    user.isActive === false
                      ? 'border-[#FF3B30]/30 bg-[#FF3B30]/[0.02]'
                      : 'border-black/[0.06] dark:border-white/[0.08] hover:border-black/[0.12] dark:hover:border-white/[0.12]'
                  } shadow-xs`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    {/* Dados Básicos */}
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-2xl bg-black/[0.04] dark:bg-white/[0.06] flex items-center justify-center font-semibold text-sm shrink-0 text-[#6C6C70] dark:text-[#98989D] shadow-xs">
                        {isUserMaster ? (
                          <Crown className="w-5 h-5 text-[#007AFF] dark:text-[#0A84FF]" strokeWidth={1.6} />
                        ) : isUserManager ? (
                          <Briefcase className="w-5 h-5 text-[#6C6C70] dark:text-[#98989D]" strokeWidth={1.6} />
                        ) : (
                          user.name.charAt(0).toUpperCase()
                        )}
                      </div>

                      <div className="min-w-0 space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
                            {user.name}
                          </span>
                          <span className="text-xs font-mono text-[#8E8E93]">
                            @{user.username}
                          </span>

                          {/* Badge de Papel */}
                          {isUserMaster ? (
                            <Badge icon={Crown} variant="neutral">
                              Master
                            </Badge>
                          ) : isUserManager ? (
                            <Badge icon={Briefcase} variant="neutral">
                              Gerente
                            </Badge>
                          ) : (
                            <Badge icon={User} variant="neutral">
                              Comum
                            </Badge>
                          )}

                          {/* Status */}
                          {user.isActive === false ? (
                            <StatusDot status="destructive" label="Bloqueado" />
                          ) : (
                            <StatusDot status="online" label="Ativo" />
                          )}

                          {user.mustChangePassword && (
                            <StatusDot status="warning" label="Troca pendente" />
                          )}
                        </div>

                        <div className="text-xs text-[#8E8E93] flex items-center gap-2 flex-wrap">
                          {user.department && <span>{user.department}</span>}
                          {user.createdBy && <span>• Criado por @{user.createdBy}</span>}
                          {user.lastLogin ? (
                            <span>• Último acesso: {new Date(user.lastLogin).toLocaleDateString('pt-BR')}</span>
                          ) : (
                            <span>• Nunca acessou</span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Ações do Usuário (Toque mínimo 44px) */}
                    <div className="flex items-center gap-1 sm:gap-1.5 self-end sm:self-center shrink-0 flex-wrap">
                      {/* 1. Ver Detalhes / Ficha */}
                      <button
                        type="button"
                        onClick={() => onSelectUserDetail(user)}
                        className="min-h-[44px] min-w-[44px] p-2.5 rounded-xl text-[#6C6C70] dark:text-[#98989D] hover:text-slate-900 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer flex items-center justify-center"
                        title="Ver ficha completa do usuário"
                        aria-label="Ver ficha"
                      >
                        <Eye className="w-4 h-4" strokeWidth={1.6} />
                      </button>

                      {/* 2. Simular Usuário */}
                      {onSimulateUser && !isUserMaster && (
                        <button
                          type="button"
                          onClick={() => onSimulateUser(user)}
                          className="min-h-[44px] min-w-[44px] p-2.5 rounded-xl text-[#007AFF] dark:text-[#0A84FF] hover:bg-[#007AFF]/10 transition-colors cursor-pointer flex items-center justify-center"
                          title="Simular visualização deste usuário"
                          aria-label="Simular usuário"
                        >
                          <Sliders className="w-4 h-4" strokeWidth={1.6} />
                        </button>
                      )}

                      {/* 3. Redefinir Senha */}
                      {canResetPass && (
                        <button
                          type="button"
                          onClick={() => onOpenResetPassword(user)}
                          className="min-h-[44px] min-w-[44px] p-2.5 rounded-xl text-[#6C6C70] dark:text-[#98989D] hover:text-slate-900 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer flex items-center justify-center"
                          title="Redefinir senha provisória"
                          aria-label="Redefinir senha"
                        >
                          <Key className="w-4 h-4" strokeWidth={1.6} />
                        </button>
                      )}

                      {/* 4. Editar (Master) */}
                      {isMaster && (
                        <button
                          type="button"
                          onClick={() => onOpenEditUser(user)}
                          className="min-h-[44px] min-w-[44px] p-2.5 rounded-xl text-[#6C6C70] dark:text-[#98989D] hover:text-slate-900 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer flex items-center justify-center"
                          title="Editar permissões customizadas"
                          aria-label="Editar permissões"
                        >
                          <Sliders className="w-4 h-4" strokeWidth={1.6} />
                        </button>
                      )}

                      {/* 5. Bloquear / Desbloquear (Master) */}
                      {isMaster && !isUserMaster && !isSelf && (
                        <button
                          type="button"
                          onClick={() => onToggleUserStatus(user)}
                          className={`min-h-[44px] min-w-[44px] p-2.5 rounded-xl transition-colors cursor-pointer flex items-center justify-center ${
                            user.isActive === false
                              ? 'text-[#007AFF] hover:bg-[#007AFF]/10'
                              : 'text-[#FF3B30] dark:text-[#FF453A] hover:bg-[#FF3B30]/10'
                          }`}
                          title={user.isActive === false ? "Reativar conta" : "Bloquear conta"}
                          aria-label={user.isActive === false ? "Reativar conta" : "Bloquear conta"}
                        >
                          {user.isActive === false ? (
                            <CheckCircle2 className="w-4 h-4" strokeWidth={1.6} />
                          ) : (
                            <Ban className="w-4 h-4" strokeWidth={1.6} />
                          )}
                        </button>
                      )}

                      {/* 6. Excluir Conta (Master) */}
                      {isMaster && !isUserMaster && !isSelf && (
                        <button
                          type="button"
                          onClick={() => onDeleteUser(user)}
                          className="min-h-[44px] min-w-[44px] p-2.5 rounded-xl text-[#FF3B30] dark:text-[#FF453A] hover:bg-[#FF3B30]/10 transition-colors cursor-pointer flex items-center justify-center"
                          title="Excluir usuário permanentemente"
                          aria-label="Excluir usuário"
                        >
                          <Trash2 className="w-4 h-4" strokeWidth={1.6} />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* ========================================================
          VISÃO 2: LISTA DE SESSÕES DE VISITANTES ANÔNIMOS
         ======================================================== */}
      {viewMode === 'sessions' && (
        <div className="space-y-2.5">
          {sessionList.length === 0 ? (
            <AdminCard className="text-center py-10 space-y-2">
              <Smartphone className="w-8 h-8 mx-auto text-[#8E8E93]" strokeWidth={1.6} />
              <p className="text-xs font-medium text-[#6C6C70] dark:text-[#98989D]">
                Nenhuma sessão anônima encontrada.
              </p>
            </AdminCard>
          ) : (
            sessionList.map((session) => {
              const isBlocked = session.isBlocked === true;
              return (
                <div
                  key={session.sessionId}
                  className={`p-3.5 bg-white dark:bg-[#1C1C1E] rounded-2xl border transition-all ${
                    isBlocked
                      ? 'border-[#FF3B30]/30 bg-[#FF3B30]/[0.02]'
                      : 'border-black/[0.06] dark:border-white/[0.08]'
                  } shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs`}
                >
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-2xl bg-black/[0.04] dark:bg-white/[0.06] flex items-center justify-center text-[#8E8E93] shrink-0">
                      <Smartphone className="w-5 h-5" strokeWidth={1.6} />
                    </div>

                    <div className="space-y-0.5 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-slate-900 dark:text-slate-100 text-sm truncate">
                          {session.customName || `Visitante #${session.sessionId.slice(-6)}`}
                        </span>
                        {isBlocked ? (
                          <StatusDot status="destructive" label="Bloqueado" />
                        ) : (
                          <StatusDot status="online" label="Online" />
                        )}
                      </div>

                      <div className="text-xs font-mono text-[#8E8E93] truncate">
                        ID: {session.sessionId}
                      </div>

                      <div className="text-xs text-[#6C6C70] dark:text-[#98989D] flex items-center gap-2 flex-wrap">
                        {session.device && <span>Dispositivo: {session.device}</span>}
                        {session.lastSeen && <span>• Visto em: {new Date(session.lastSeen).toLocaleString('pt-BR')}</span>}
                        {session.loginCount && <span>• Acessos: {session.loginCount}</span>}
                      </div>
                    </div>
                  </div>

                  {isMaster && onToggleSessionBlocked && (
                    <button
                      type="button"
                      onClick={() => onToggleSessionBlocked(session.sessionId, isBlocked)}
                      className={`min-h-[44px] px-4 py-2 rounded-xl text-xs font-medium cursor-pointer transition-colors self-end sm:self-center shrink-0 flex items-center gap-1.5 ${
                        isBlocked
                          ? 'text-[#007AFF] hover:bg-[#007AFF]/10'
                          : 'text-[#FF3B30] dark:text-[#FF453A] hover:bg-[#FF3B30]/10'
                      }`}
                    >
                      {isBlocked ? (
                        <>
                          <CheckCircle2 className="w-4 h-4" strokeWidth={1.6} />
                          <span>Desbloquear</span>
                        </>
                      ) : (
                        <>
                          <Ban className="w-4 h-4" strokeWidth={1.6} />
                          <span>Bloquear Sessão</span>
                        </>
                      )}
                    </button>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
};
