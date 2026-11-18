import React, { useState, useMemo } from 'react';
import {
  Users,
  Search,
  Plus,
  Crown,
  Briefcase,
  User,
  ShieldCheck,
  Key,
  Ban,
  CheckCircle2,
  Trash2,
  Sliders,
  Eye,
  Smartphone,
  Clock,
  AlertTriangle,
  ArrowUpCircle,
  ArrowDownCircle,
  Filter
} from 'lucide-react';
import { RegisteredUser, UserSessionConfig, UserRole } from '../../services/adminService';

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
  onPromoteUser,
  onDemoteUser,
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
      {/* Barra de Topo da Seção: Modos e Botão Novo Usuário */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-2 border-b border-black/[0.04] dark:border-white/[0.06]">
        {/* Seletor Segmentado Apple: Contas vs Visitantes */}
        <div className="flex items-center gap-1 p-1 bg-black/[0.04] dark:bg-white/[0.06] rounded-xl w-full sm:w-fit">
          <button
            type="button"
            onClick={() => setViewMode('registered')}
            className={`min-h-[36px] px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer flex-1 sm:flex-initial ${
              viewMode === 'registered'
                ? 'bg-white dark:bg-[#252528] text-[#007AFF] dark:text-[#0a84ff] shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Contas Cadastradas</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-black/5 dark:bg-white/10 font-bold ml-0.5">
              {registeredUsers.length}
            </span>
          </button>

          {(isMaster || canManagerViewAllVisitors) && (
            <button
              type="button"
              onClick={() => setViewMode('sessions')}
              className={`min-h-[36px] px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer flex-1 sm:flex-initial ${
                viewMode === 'sessions'
                  ? 'bg-white dark:bg-[#252528] text-[#007AFF] dark:text-[#0a84ff] shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span>Visitantes</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-black/5 dark:bg-white/10 font-bold ml-0.5">
                {Object.keys(userSessions).length}
              </span>
            </button>
          )}
        </div>

        {/* Botão Novo Usuário */}
        {canManagerGenerateLogins && (
          <button
            type="button"
            onClick={onOpenCreateUser}
            className="min-h-[40px] px-4 py-2 rounded-xl bg-[#007AFF] hover:bg-[#0066d6] active:scale-95 text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-all shadow-xs cursor-pointer shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Novo Usuário</span>
          </button>
        )}
      </div>

      {/* Barra de Filtros e Busca Estilo iOS Search */}
      <div className="space-y-2.5">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={viewMode === 'registered' ? "Buscar por nome, @login ou departamento..." : "Buscar visitante por ID, nome ou dispositivo..."}
            className="w-full min-h-[44px] pl-10 pr-4 py-2 rounded-xl bg-white dark:bg-[#1c1c1e] border border-black/[0.06] dark:border-white/[0.08] text-xs sm:text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 outline-none focus:ring-2 focus:ring-[#007AFF]/30 transition-all"
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => setSearchTerm('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer p-1"
            >
              Limpar
            </button>
          )}
        </div>

        {/* Filtros por Pill (se no modo de usuários cadastrados) */}
        {viewMode === 'registered' && (
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
            <span className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 mr-1 shrink-0 flex items-center gap-1">
              <Filter className="w-3 h-3" /> Papel:
            </span>
            <button
              type="button"
              onClick={() => setRoleFilter('ALL')}
              className={`min-h-[32px] px-3 py-1 rounded-lg text-xs font-medium cursor-pointer shrink-0 transition-colors ${
                roleFilter === 'ALL'
                  ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold'
                  : 'bg-black/[0.03] dark:bg-white/[0.04] text-slate-600 dark:text-slate-400 hover:bg-black/[0.06] dark:hover:bg-white/[0.08]'
              }`}
            >
              Todos
            </button>
            {isMaster && (
              <>
                <button
                  type="button"
                  onClick={() => setRoleFilter('MASTER')}
                  className={`min-h-[32px] px-3 py-1 rounded-lg text-xs font-medium cursor-pointer shrink-0 transition-colors ${
                    roleFilter === 'MASTER'
                      ? 'bg-indigo-600 text-white font-bold'
                      : 'bg-black/[0.03] dark:bg-white/[0.04] text-slate-600 dark:text-slate-400 hover:bg-black/[0.06] dark:hover:bg-white/[0.08]'
                  }`}
                >
                  Masters
                </button>
                <button
                  type="button"
                  onClick={() => setRoleFilter('MANAGER')}
                  className={`min-h-[32px] px-3 py-1 rounded-lg text-xs font-medium cursor-pointer shrink-0 transition-colors ${
                    roleFilter === 'MANAGER'
                      ? 'bg-teal-600 text-white font-bold'
                      : 'bg-black/[0.03] dark:bg-white/[0.04] text-slate-600 dark:text-slate-400 hover:bg-black/[0.06] dark:hover:bg-white/[0.08]'
                  }`}
                >
                  Gerentes
                </button>
              </>
            )}
            <button
              type="button"
              onClick={() => setRoleFilter('USER')}
              className={`min-h-[32px] px-3 py-1 rounded-lg text-xs font-medium cursor-pointer shrink-0 transition-colors ${
                roleFilter === 'USER'
                  ? 'bg-slate-700 text-white font-bold'
                  : 'bg-black/[0.03] dark:bg-white/[0.04] text-slate-600 dark:text-slate-400 hover:bg-black/[0.06] dark:hover:bg-white/[0.08]'
              }`}
            >
              Comuns
            </button>
            {isManager && !isMaster && (
              <button
                type="button"
                onClick={() => setRoleFilter('MY_TEAM')}
                className={`min-h-[32px] px-3 py-1 rounded-lg text-xs font-medium cursor-pointer shrink-0 transition-colors ${
                  roleFilter === 'MY_TEAM'
                    ? 'bg-teal-600 text-white font-bold'
                    : 'bg-black/[0.03] dark:bg-white/[0.04] text-slate-600 dark:text-slate-400 hover:bg-black/[0.06] dark:hover:bg-white/[0.08]'
                }`}
              >
                Minha Equipe
              </button>
            )}

            <div className="h-4 w-px bg-black/[0.08] dark:bg-white/[0.08] mx-1 shrink-0" />

            <span className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 mr-1 shrink-0">
              Status:
            </span>
            <button
              type="button"
              onClick={() => setStatusFilter(statusFilter === 'BLOCKED' ? 'ALL' : 'BLOCKED')}
              className={`min-h-[32px] px-2.5 py-1 rounded-lg text-xs font-medium cursor-pointer shrink-0 transition-colors flex items-center gap-1 ${
                statusFilter === 'BLOCKED'
                  ? 'bg-rose-600 text-white font-bold'
                  : 'bg-black/[0.03] dark:bg-white/[0.04] text-slate-600 dark:text-slate-400 hover:bg-black/[0.06] dark:hover:bg-white/[0.08]'
              }`}
            >
              <Ban className="w-3 h-3" /> Bloqueados
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter(statusFilter === 'MUST_CHANGE' ? 'ALL' : 'MUST_CHANGE')}
              className={`min-h-[32px] px-2.5 py-1 rounded-lg text-xs font-medium cursor-pointer shrink-0 transition-colors flex items-center gap-1 ${
                statusFilter === 'MUST_CHANGE'
                  ? 'bg-amber-600 text-white font-bold'
                  : 'bg-black/[0.03] dark:bg-white/[0.04] text-slate-600 dark:text-slate-400 hover:bg-black/[0.06] dark:hover:bg-white/[0.08]'
              }`}
            >
              <Key className="w-3 h-3" /> Troca Pendente
            </button>
          </div>
        )}
      </div>

      {/* ========================================================
          VISÃO 1: LISTA DE USUÁRIOS CADASTRADOS
         ======================================================== */}
      {viewMode === 'registered' && (
        <div className="space-y-2.5">
          {filteredUsers.length === 0 ? (
            <div className="p-8 text-center bg-white dark:bg-[#1c1c1e] rounded-2xl border border-black/[0.05] dark:border-white/[0.06] text-slate-400 space-y-2">
              <Users className="w-8 h-8 mx-auto text-slate-300 dark:text-slate-600" />
              <p className="text-xs font-semibold">Nenhum usuário encontrado com os filtros atuais.</p>
            </div>
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
                  className={`p-3.5 bg-white dark:bg-[#1c1c1e] rounded-2xl border transition-all ${
                    user.isActive === false
                      ? 'border-rose-200 dark:border-rose-900/50 bg-rose-50/20 dark:bg-rose-950/10'
                      : 'border-black/[0.05] dark:border-white/[0.06] hover:border-black/10 dark:hover:border-white/10'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    {/* Dados Básicos */}
                    <div className="flex items-start gap-3 min-w-0">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm shrink-0 shadow-xs ${
                        isUserMaster
                          ? 'bg-indigo-600 text-white'
                          : isUserManager
                            ? 'bg-teal-600 text-white'
                            : 'bg-slate-700 text-white'
                      }`}>
                        {isUserMaster ? <Crown className="w-5 h-5" /> : isUserManager ? <Briefcase className="w-5 h-5" /> : user.name.charAt(0).toUpperCase()}
                      </div>

                      <div className="min-w-0 space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">
                            {user.name}
                          </span>
                          <span className="text-xs font-mono text-slate-500 dark:text-slate-400">
                            @{user.username}
                          </span>

                          {/* Badge de Papel */}
                          {isUserMaster ? (
                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase bg-indigo-100 text-indigo-700 dark:bg-indigo-950/80 dark:text-indigo-300">
                              Master
                            </span>
                          ) : isUserManager ? (
                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase bg-teal-100 text-teal-700 dark:bg-teal-950/80 dark:text-teal-300">
                              Gerente
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                              Comum
                            </span>
                          )}

                          {/* Status */}
                          {user.isActive === false ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-600 dark:text-rose-400">
                              • Bloqueado
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                              • Ativo
                            </span>
                          )}

                          {user.mustChangePassword && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300">
                              Troca pendente
                            </span>
                          )}
                        </div>

                        <div className="text-[11px] text-slate-400 dark:text-slate-500 flex items-center gap-2 flex-wrap">
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

                    {/* Ações do Usuário (Toque mínimo 44px em mobile) */}
                    <div className="flex items-center gap-1 sm:gap-1.5 self-end sm:self-center shrink-0 flex-wrap">
                      {/* 1. Ver Detalhes / Ficha */}
                      <button
                        type="button"
                        onClick={() => onSelectUserDetail(user)}
                        className="min-h-[36px] min-w-[36px] p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer"
                        title="Ver ficha completa do usuário"
                      >
                        <Eye className="w-4 h-4" />
                      </button>

                      {/* 2. Simular Usuário */}
                      {onSimulateUser && !isUserMaster && (
                        <button
                          type="button"
                          onClick={() => onSimulateUser(user)}
                          className="min-h-[36px] min-w-[36px] p-2 rounded-xl text-[#007AFF] hover:bg-[#007AFF]/10 transition-colors cursor-pointer"
                          title="Simular visualização deste usuário"
                        >
                          <Sliders className="w-4 h-4" />
                        </button>
                      )}

                      {/* 3. Redefinir Senha */}
                      {canResetPass && (
                        <button
                          type="button"
                          onClick={() => onOpenResetPassword(user)}
                          className="min-h-[36px] min-w-[36px] p-2 rounded-xl text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/40 transition-colors cursor-pointer"
                          title="Redefinir senha de acesso"
                        >
                          <Key className="w-4 h-4" />
                        </button>
                      )}

                      {/* 4. Editar (Master) */}
                      {isMaster && (
                        <button
                          type="button"
                          onClick={() => onOpenEditUser(user)}
                          className="min-h-[36px] min-w-[36px] p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer"
                          title="Editar permissões customizadas"
                        >
                          <Sliders className="w-4 h-4" />
                        </button>
                      )}

                      {/* 5. Bloquear / Desbloquear (Master) */}
                      {isMaster && !isUserMaster && !isSelf && (
                        <button
                          type="button"
                          onClick={() => onToggleUserStatus(user)}
                          className={`min-h-[36px] min-w-[36px] p-2 rounded-xl transition-colors cursor-pointer ${
                            user.isActive === false
                              ? 'text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40'
                              : 'text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40'
                          }`}
                          title={user.isActive === false ? "Reativar conta" : "Bloquear conta"}
                        >
                          {user.isActive === false ? <CheckCircle2 className="w-4 h-4" /> : <Ban className="w-4 h-4" />}
                        </button>
                      )}

                      {/* 6. Promover a Gerente / Rebaixar (Master) */}
                      {isMaster && !isUserMaster && (
                        user.role === 'manager' ? (
                          <button
                            type="button"
                            onClick={() => onDemoteUser(user)}
                            className="min-h-[36px] min-w-[36px] p-2 rounded-xl text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/40 transition-colors cursor-pointer"
                            title="Rebaixar para Usuário Comum"
                          >
                            <ArrowDownCircle className="w-4 h-4" />
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => onPromoteUser(user)}
                            className="min-h-[36px] min-w-[36px] p-2 rounded-xl text-teal-600 hover:bg-teal-50 dark:hover:bg-teal-950/40 transition-colors cursor-pointer"
                            title="Promover para Gerente"
                          >
                            <ArrowUpCircle className="w-4 h-4" />
                          </button>
                        )
                      )}

                      {/* 7. Excluir (Master) */}
                      {isMaster && !isUserMaster && !isSelf && (
                        <button
                          type="button"
                          onClick={() => onDeleteUser(user)}
                          className="min-h-[36px] min-w-[36px] p-2 rounded-xl text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                          title="Excluir conta permanentemente"
                        >
                          <Trash2 className="w-4 h-4" />
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
            <div className="p-8 text-center bg-white dark:bg-[#1c1c1e] rounded-2xl border border-black/[0.05] dark:border-white/[0.06] text-slate-400 space-y-2">
              <Smartphone className="w-8 h-8 mx-auto text-slate-300 dark:text-slate-600" />
              <p className="text-xs font-semibold">Nenhuma sessão de visitante registrada no momento.</p>
            </div>
          ) : (
            sessionList.map((session) => {
              const fifteenMinAgo = Date.now() - 15 * 60 * 1000;
              const isOnline = new Date(session.lastSeen).getTime() >= fifteenMinAgo;

              return (
                <div
                  key={session.sessionId}
                  className="p-3.5 bg-white dark:bg-[#1c1c1e] rounded-2xl border border-black/[0.05] dark:border-white/[0.06] flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-300 flex items-center justify-center shrink-0">
                      <Smartphone className="w-4 h-4" />
                    </div>

                    <div className="min-w-0 space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-900 dark:text-slate-100 font-mono truncate">
                          {session.sessionId.slice(0, 16)}...
                        </span>

                        {isOnline ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> Ativo Agora
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-400">Inativo</span>
                        )}

                        {session.device && (
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-black/5 dark:bg-white/10 text-slate-600 dark:text-slate-400 font-semibold">
                            {session.device}
                          </span>
                        )}
                      </div>

                      <div className="text-[11px] text-slate-400 dark:text-slate-500 flex items-center gap-2">
                        <span>Acessos: {session.loginCount || 1}</span>
                        <span>• Última visualização: {session.formattedLastSeen}</span>
                      </div>
                    </div>
                  </div>

                  {/* Ação de Bloqueio de Sessão */}
                  {isMaster && onToggleSessionBlocked && (
                    <button
                      type="button"
                      onClick={() => onToggleSessionBlocked(session.sessionId, !!session.isBlocked)}
                      className={`min-h-[36px] px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
                        session.isBlocked
                          ? 'bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400 border border-rose-200'
                          : 'bg-black/[0.03] dark:bg-white/[0.04] text-slate-600 dark:text-slate-400 hover:bg-black/[0.06]'
                      }`}
                    >
                      <Ban className="w-3.5 h-3.5" />
                      <span>{session.isBlocked ? 'Bloqueado' : 'Bloquear'}</span>
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
