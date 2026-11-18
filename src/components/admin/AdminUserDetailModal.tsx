import React, { useState, useMemo, useCallback, useEffect } from 'react';
import {
  X,
  Crown,
  Briefcase,
  User,
  ShieldCheck,
  Calendar,
  Clock,
  Activity,
  Lock,
  Users,
  Eye,
  Sliders,
  Search,
  Check,
  Ban,
  Filter,
  History,
  AlertTriangle
} from 'lucide-react';
import {
  RegisteredUser,
  ActivityLog,
  CapabilityItem,
  CapabilityGroup,
  OverrideSetting,
  UserCapabilityOverrideEntry,
  getAllCapabilitiesCatalog,
  getUserOverrides,
  saveUserOverride,
  getManagerScope,
  saveManagerScope,
  ManagerScopeConfig,
  logCapabilityAudit
} from '../../services/adminService';
import { useAccess } from '../../context/FeatureAccessContext';
import { dataSources } from '../../data';

interface AdminUserDetailModalProps {
  user: RegisteredUser | null;
  onClose: () => void;
  allUsers: RegisteredUser[];
  logs: ActivityLog[];
  isMaster: boolean;
  isManager?: boolean;
  onSimulateUser?: (user: RegisteredUser) => void;
  onNavigateToAudit?: () => void;
  showToast?: (msg: string) => void;
}

export const AdminUserDetailModal: React.FC<AdminUserDetailModalProps> = ({
  user,
  onClose,
  allUsers,
  logs,
  isMaster,
  isManager = false,
  onSimulateUser,
  onNavigateToAudit,
  showToast
}) => {
  const { canGrant } = useAccess();

  // Aba ativa na ficha: 'general' (dados e atividade) ou 'permissions' (exceções e poderes)
  const [activeTab, setActiveTab] = useState<'general' | 'permissions'>('general');

  // Catálogo completo de capacidades
  const catalog = useMemo(() => {
    const layerNames = dataSources.map(ds => ds.name);
    return getAllCapabilitiesCatalog(layerNames);
  }, []);

  // Exceções individuais do usuário
  const [overrides, setOverrides] = useState<Record<string, UserCapabilityOverrideEntry>>({});

  // Escopo de delegação do usuário (se for gerente)
  const [userScope, setUserScope] = useState<ManagerScopeConfig>({
    scope_type: 'team_only',
    can_manage_site_accounts: true,
    can_manage_visitors: false
  });

  // Filtros na aba de poderes
  const [permSearch, setPermSearch] = useState('');
  const [selectedGroup, setSelectedGroup] = useState<CapabilityGroup | 'TODOS'>('TODOS');

  // Carregar dados de exceções e escopo ao abrir o modal
  useEffect(() => {
    if (user?.id) {
      setOverrides(getUserOverrides(user.id));
      setUserScope(getManagerScope(user.id));
    }
  }, [user]);

  const isUserMaster = user?.role === 'master' || (user?.role as any) === 'admin';
  const isUserManager = user?.role === 'manager';

  // Membros criados por este gerente (se for gerente)
  const teamMembers = useMemo(() => {
    if (!user) return [];
    return allUsers.filter(u =>
      (u.createdBy || '').toLowerCase() === user.username.toLowerCase()
    );
  }, [allUsers, user]);

  // Histórico de atividades recentes deste usuário
  const userLogs = useMemo(() => {
    if (!user) return [];
    const cleanUser = user.username.toLowerCase().replace(/^@/, '');
    const cleanName = user.name.toLowerCase();
    const cleanId = user.id.toLowerCase();

    return logs.filter(l => {
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
    }).slice(0, 8);
  }, [logs, user]);

  // Filtragem dos itens de poderes na aba de exceções
  const filteredCapabilities = useMemo(() => {
    return catalog.filter(item => {
      if (selectedGroup !== 'TODOS' && item.group !== selectedGroup) return false;
      if (permSearch.trim()) {
        const term = permSearch.toLowerCase();
        const mName = item.name.toLowerCase().includes(term);
        const mKey = item.key.toLowerCase().includes(term);
        const mDesc = item.description.toLowerCase().includes(term);
        if (!mName && !mKey && !mDesc) return false;
      }
      return true;
    });
  }, [catalog, selectedGroup, permSearch]);

  // Handler para definir exceção individual (Herdar / Permitir / Negar)
  const handleSetOverride = useCallback(async (
    capKey: string,
    overrideType: OverrideSetting
  ) => {
    if (!user) return;
    if (isUserMaster) {
      showToast?.('⚠️ O Administrador Master possui poderes integrais imutáveis.');
      return;
    }

    if (!isMaster) {
      const allowedToGrant = canGrant(capKey);
      if (!allowedToGrant) {
        showToast?.('⚠️ Você não possui permissão concedida pelo Master para alterar ou repassar este poder.');
        return;
      }
    }

    const currentEntry = overrides[capKey];
    await saveUserOverride(user.id, capKey, overrideType, currentEntry?.can_grant || false);

    const updated = { ...overrides };
    if (overrideType === 'inherit') {
      delete updated[capKey];
    } else {
      updated[capKey] = {
        override_type: overrideType,
        can_grant: currentEntry?.can_grant || false
      };
    }
    setOverrides(updated);

    // Registrar na Trilha de Auditoria Granular
    await logCapabilityAudit({
      performedByName: isMaster ? 'Administrador Master' : 'Gerente Autorizado',
      targetType: 'user',
      targetId: user.username,
      targetName: user.name,
      capabilityKey: capKey,
      action: overrideType === 'allow' ? 'grant_use' : overrideType === 'deny' ? 'set_deny' : 'remove_override',
      beforeState: currentEntry || { override_type: 'inherit' },
      afterState: updated[capKey] || { override_type: 'inherit' },
      reason: `Exceção individual para @${user.username}: ${overrideType.toUpperCase()}`
    });

    showToast?.(`Exceção de "${capKey}" para @${user.username}: ${overrideType.toUpperCase()}`);
  }, [user, isUserMaster, isMaster, canGrant, overrides, showToast]);

  // Handler para alternar "pode repassar" (se o usuário for gerente)
  const handleToggleCanGrant = useCallback(async (capKey: string) => {
    if (!user) return;
    if (!isMaster) {
      showToast?.('⚠️ Apenas o Administrador Master pode autorizar repasse de poderes para gerentes.');
      return;
    }

    const currentEntry = overrides[capKey] || { override_type: 'inherit', can_grant: false };
    const nextGrant = !currentEntry.can_grant;

    const updatedEntry: UserCapabilityOverrideEntry = {
      override_type: currentEntry.override_type === 'inherit' ? 'allow' : currentEntry.override_type,
      can_grant: nextGrant
    };

    await saveUserOverride(user.id, capKey, updatedEntry.override_type, nextGrant);

    const updated = {
      ...overrides,
      [capKey]: updatedEntry
    };
    setOverrides(updated);

    await logCapabilityAudit({
      performedByName: 'Administrador Master',
      targetType: 'user',
      targetId: user.username,
      targetName: user.name,
      capabilityKey: capKey,
      action: nextGrant ? 'grant_delegate' : 'revoke_delegate',
      beforeState: currentEntry,
      afterState: updatedEntry,
      reason: `Permissão de repasse de "${capKey}" para Gerente @${user.username}: ${nextGrant ? 'AUTORIZADO' : 'REVOGADO'}`
    });

    showToast?.(`Repasse de "${capKey}" ${nextGrant ? 'autorizado' : 'revogado'} para @${user.username}.`);
  }, [user, isMaster, overrides, showToast]);

  // Handler para alterar escopo de delegação do gerente
  const handleScopeChange = useCallback(async (scopeType: 'team_only' | 'all_users') => {
    if (!user) return;
    if (!isMaster) {
      showToast?.('⚠️ Apenas o Administrador Master pode alterar o alcance de gerentes.');
      return;
    }

    const updated = { ...userScope, scope_type: scopeType };
    setUserScope(updated);
    await saveManagerScope(user.id, updated);

    await logCapabilityAudit({
      performedByName: 'Administrador Master',
      targetType: 'user',
      targetId: user.username,
      targetName: user.name,
      capabilityKey: 'admin:users:scope',
      action: 'grant_delegate',
      beforeState: { scope_type: userScope.scope_type },
      afterState: { scope_type: scopeType },
      reason: `Alteração do alcance de gerência de @${user.username} para ${scopeType === 'team_only' ? 'Somente sua Equipe' : 'Todos os Usuários'}`
    });

    showToast?.(`Alcance de @${user.username} alterado para: ${scopeType === 'team_only' ? 'Somente sua Equipe' : 'Todos os Usuários'}.`);
  }, [user, isMaster, userScope, showToast]);

  if (!user) return null;

  return (
    <div className="fixed inset-0 z-[10000] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 animate-fadeIn">
      <div
        className="w-full max-w-2xl bg-white dark:bg-[#1c1c1e] rounded-3xl border border-black/10 dark:border-white/10 shadow-2xl overflow-hidden flex flex-col max-h-[92vh] animate-scaleUp"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabeçalho da Ficha com Foto/Ícone e Dados Básicos */}
        <div className="p-4 sm:p-5 border-b border-black/[0.05] dark:border-white/[0.06] flex items-center justify-between">
          <div className="flex items-center gap-3.5 min-w-0">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-bold text-base shrink-0 shadow-xs ${
              isUserMaster
                ? 'bg-indigo-600 text-white'
                : isUserManager
                  ? 'bg-teal-600 text-white'
                  : 'bg-slate-700 text-white'
            }`}>
              {isUserMaster ? <Crown className="w-6 h-6" /> : isUserManager ? <Briefcase className="w-6 h-6" /> : user.name.charAt(0).toUpperCase()}
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 truncate">
                  {user.name}
                </h3>
                {isUserMaster ? (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-indigo-100 text-indigo-700 dark:bg-indigo-950/80 dark:text-indigo-300 flex items-center gap-1">
                    <Crown className="w-3 h-3 text-indigo-600" />
                    <span>Master (Intocável)</span>
                  </span>
                ) : isUserManager ? (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-teal-100 text-teal-700 dark:bg-teal-950/80 dark:text-teal-300 flex items-center gap-1">
                    <Briefcase className="w-3 h-3 text-teal-600" />
                    <span>Gerente</span>
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                    Usuário Comum
                  </span>
                )}
              </div>
              <p className="text-xs font-mono text-slate-400 dark:text-slate-500">
                @{user.username}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-2 rounded-xl hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer"
            title="Fechar ficha"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Barra de Abas da Ficha: Geral vs Poderes e Exceções */}
        <div className="px-5 pt-2 pb-0 border-b border-black/[0.04] dark:border-white/[0.06] flex items-center gap-2 bg-black/[0.015] dark:bg-white/[0.015]">
          <button
            type="button"
            onClick={() => setActiveTab('general')}
            className={`pb-2 px-3 text-xs font-bold border-b-2 transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'general'
                ? 'border-[#007AFF] text-[#007AFF]'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
            }`}
          >
            <User className="w-3.5 h-3.5" />
            <span>Informações & Atividade</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('permissions')}
            className={`pb-2 px-3 text-xs font-bold border-b-2 transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'permissions'
                ? 'border-[#007AFF] text-[#007AFF]'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>Poderes & Exceções Individuais</span>
            {Object.keys(overrides).length > 0 && (
              <span className="ml-1 px-1.5 py-0.2 rounded-full text-[9px] font-bold bg-[#007AFF] text-white leading-none">
                {Object.keys(overrides).length}
              </span>
            )}
          </button>
        </div>

        {/* Corpo com Rolagem */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 text-xs flex-1">
          {activeTab === 'general' ? (
            <>
              {/* Se for Master: Mensagem de Intocável */}
              {isUserMaster && (
                <div className="p-3.5 bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800/50 rounded-2xl flex items-start gap-3 text-indigo-900 dark:text-indigo-200">
                  <Crown className="w-5 h-5 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <div className="font-bold">Conta Blindada pelo Banco de Dados</div>
                    <p className="text-[11.5px] leading-relaxed text-indigo-800/80 dark:text-indigo-300/80">
                      O Master possui controle absoluto e imunidade estrita. Nenhum usuário ou gatilho de terceiros tem permissão para alterar seus poderes, bloqueá-lo ou excluí-lo.
                    </p>
                  </div>
                </div>
              )}

              {/* Informações Cadastrais */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div className="p-3 bg-black/[0.02] dark:bg-white/[0.02] rounded-xl space-y-0.5">
                  <span className="text-[10px] text-slate-400 font-medium">Departamento</span>
                  <div className="font-semibold text-slate-800 dark:text-slate-200 truncate">{user.department || 'Geral'}</div>
                </div>

                <div className="p-3 bg-black/[0.02] dark:bg-white/[0.02] rounded-xl space-y-0.5">
                  <span className="text-[10px] text-slate-400 font-medium">Status da Conta</span>
                  <div className="font-semibold flex items-center gap-1.5">
                    {user.isActive === false ? (
                      <span className="text-rose-600 dark:text-rose-400 font-bold">• Bloqueado</span>
                    ) : (
                      <span className="text-emerald-600 dark:text-emerald-400 font-bold">• Ativo</span>
                    )}
                  </div>
                </div>

                <div className="p-3 bg-black/[0.02] dark:bg-white/[0.02] rounded-xl space-y-0.5">
                  <span className="text-[10px] text-slate-400 font-medium">Cadastrado por</span>
                  <div className="font-semibold text-slate-800 dark:text-slate-200 truncate">@{user.createdBy || 'Sistema'}</div>
                </div>

                <div className="p-3 bg-black/[0.02] dark:bg-white/[0.02] rounded-xl space-y-0.5">
                  <span className="text-[10px] text-slate-400 font-medium">Último Acesso</span>
                  <div className="font-semibold text-slate-800 dark:text-slate-200 truncate">
                    {user.lastLogin ? new Date(user.lastLogin).toLocaleString('pt-BR') : 'Nunca acessou'}
                  </div>
                </div>
              </div>

              {/* Segurança de Senha */}
              <div className="p-3 bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200/60 dark:border-emerald-900/40 rounded-xl flex items-center gap-2.5 text-emerald-800 dark:text-emerald-300">
                <Lock className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <div className="text-[11px] leading-relaxed">
                  <span className="font-bold">Credenciais Blindadas: </span>
                  Senhas são protegidas por bcrypt/Argon2 no Supabase Auth e nunca são reveladas ou transmitidas ao cliente.
                </div>
              </div>

              {/* Se for Gerente: Alcance e Membros da Equipe */}
              {isUserManager && (
                <div className="space-y-2.5 pt-2 border-t border-black/[0.04] dark:border-white/[0.04]">
                  <div className="flex items-center justify-between">
                    <span className="font-bold uppercase tracking-wider text-[11px] text-slate-400 flex items-center gap-1.5">
                      <Briefcase className="w-3.5 h-3.5 text-teal-600" />
                      Alcance de Gerência
                    </span>
                    {isMaster && (
                      <div className="flex items-center gap-1 bg-black/[0.04] dark:bg-white/[0.06] p-0.5 rounded-lg">
                        <button
                          type="button"
                          onClick={() => handleScopeChange('team_only')}
                          className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all cursor-pointer ${
                            userScope.scope_type === 'team_only'
                              ? 'bg-teal-600 text-white shadow-xs'
                              : 'text-slate-600 dark:text-slate-400'
                          }`}
                        >
                          Somente sua Equipe
                        </button>
                        <button
                          type="button"
                          onClick={() => handleScopeChange('all_users')}
                          className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all cursor-pointer ${
                            userScope.scope_type === 'all_users'
                              ? 'bg-teal-600 text-white shadow-xs'
                              : 'text-slate-600 dark:text-slate-400'
                          }`}
                        >
                          Todos os Usuários
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="p-3 bg-black/[0.02] dark:bg-white/[0.02] rounded-xl text-[11px] text-slate-600 dark:text-slate-400">
                    Alcance atual: <strong className="text-slate-900 dark:text-slate-100">{userScope.scope_type === 'team_only' ? 'Equipe Própria (usuários criados por este gerente)' : 'Global (todos os usuários comuns)'}</strong>.
                  </div>

                  {/* Lista de Membros da Equipe */}
                  <div className="space-y-1.5">
                    <div className="text-[11px] font-semibold text-slate-400">
                      Membros Criados ({teamMembers.length})
                    </div>
                    {teamMembers.length === 0 ? (
                      <div className="p-3 text-center text-slate-400 bg-black/[0.02] dark:bg-white/[0.02] rounded-xl">
                        Nenhum usuário subordinado cadastrado até o momento.
                      </div>
                    ) : (
                      <div className="space-y-1 max-h-32 overflow-y-auto">
                        {teamMembers.map(m => (
                          <div key={m.id} className="p-2 bg-black/[0.02] dark:bg-white/[0.02] rounded-lg flex items-center justify-between text-xs">
                            <div>
                              <span className="font-semibold text-slate-800 dark:text-slate-200">{m.name}</span>
                              <span className="text-slate-400 text-[11px] ml-1.5">@{m.username}</span>
                            </div>
                            <span className="text-[10px] text-slate-400">{m.department || 'Geral'}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Atividades Recentes do Usuário */}
              <div className="space-y-2 pt-2 border-t border-black/[0.04] dark:border-white/[0.04]">
                <span className="font-bold uppercase tracking-wider text-[11px] text-slate-400 flex items-center gap-1.5">
                  <Activity className="w-3.5 h-3.5 text-blue-500" />
                  Histórico Recente de Atividades
                </span>

                {userLogs.length === 0 ? (
                  <div className="p-3 text-center text-slate-400 bg-black/[0.02] dark:bg-white/[0.02] rounded-xl">
                    Nenhuma atividade registrada para esta conta.
                  </div>
                ) : (
                  <div className="space-y-1.5 max-h-36 overflow-y-auto">
                    {userLogs.map(l => (
                      <div key={l.id} className="p-2 bg-black/[0.02] dark:bg-white/[0.02] rounded-lg text-xs flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <div className="font-medium text-slate-800 dark:text-slate-200 truncate">{l.action}</div>
                          <div className="text-[10px] text-slate-400 mt-0.5">{l.formattedDate} {l.details && `• ${l.details}`}</div>
                        </div>
                        <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-black/5 dark:bg-white/10 text-slate-600 dark:text-slate-300 shrink-0">
                          {l.category}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          ) : (
            <>
              {/* ABA DE PODERES & EXCEÇÕES INDIVIDUAIS */}
              {isUserMaster ? (
                <div className="p-8 text-center space-y-2 bg-indigo-50/40 dark:bg-indigo-950/20 rounded-2xl border border-indigo-200/50 dark:border-indigo-800/40">
                  <Crown className="w-10 h-10 text-indigo-600 dark:text-indigo-400 mx-auto" />
                  <div className="font-bold text-slate-900 dark:text-slate-100 text-sm">
                    Administrador Master com Acesso Total
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-400 max-w-md mx-auto leading-relaxed">
                    A conta Master herda e executa 100% dos poderes do sistema sem possibilidade de revogação ou exceções individuais.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {/* Explicação da regra de exceções */}
                  <div className="p-3 bg-black/[0.02] dark:bg-white/[0.02] border border-black/[0.04] dark:border-white/[0.06] rounded-xl text-[11.5px] text-slate-600 dark:text-slate-400 leading-relaxed">
                    <strong className="text-slate-800 dark:text-slate-200">Regra de Resolução de Poderes: </strong>
                    A exceção individual sobrepõe o perfil base. Em caso de conflito, o bloqueio <em>Negar</em> tem prioridade máxima sobre <em>Permitir</em>.
                  </div>

                  {/* Barra de Busca e Filtro de Grupo */}
                  <div className="space-y-2">
                    <div className="relative">
                      <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        type="text"
                        value={permSearch}
                        onChange={(e) => setPermSearch(e.target.value)}
                        placeholder="Buscar por poder ou camada..."
                        className="w-full min-h-[38px] pl-9 pr-3 py-1.5 rounded-xl bg-white dark:bg-[#1c1c1e] border border-black/[0.08] dark:border-white/[0.1] text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 outline-none focus:ring-2 focus:ring-[#007AFF]/30"
                      />
                    </div>

                    <div className="flex items-center gap-1 overflow-x-auto pb-1 text-xs">
                      {(['TODOS', 'camadas', 'ferramentas', 'dados', 'conta', 'administracao'] as const).map(grp => (
                        <button
                          key={grp}
                          type="button"
                          onClick={() => setSelectedGroup(grp as any)}
                          className={`min-h-[28px] px-2.5 py-0.5 rounded-lg text-[10.5px] font-semibold cursor-pointer shrink-0 transition-colors ${
                            selectedGroup === grp
                              ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold'
                              : 'bg-black/[0.03] dark:bg-white/[0.04] text-slate-600 dark:text-slate-400 hover:bg-black/[0.06]'
                          }`}
                        >
                          {grp === 'TODOS' ? 'Todos' : grp.toUpperCase()}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Lista de Poderes e Controles de Exceção */}
                  <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-1">
                    {filteredCapabilities.map(cap => {
                      const overrideEntry = overrides[cap.key];
                      const overrideType: OverrideSetting = overrideEntry ? overrideEntry.override_type : 'inherit';
                      const canGrantCurrent = overrideEntry?.can_grant === true;
                      const isEditableByRequester = isMaster || canGrant(cap.key);

                      return (
                        <div
                          key={cap.key}
                          className="p-3 bg-white dark:bg-[#1c1c1e] rounded-xl border border-black/[0.05] dark:border-white/[0.06] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 text-xs"
                        >
                          <div className="space-y-0.5 min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-bold text-slate-900 dark:text-slate-100">
                                {cap.name}
                              </span>

                              {/* SELO DE ORIGEM */}
                              {overrideType === 'inherit' ? (
                                <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                                  vem do perfil
                                </span>
                              ) : overrideType === 'allow' ? (
                                <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 border border-emerald-500/20">
                                  individual (permitido)
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-rose-100 text-rose-800 dark:bg-rose-950/80 dark:text-rose-300 border border-rose-500/20">
                                  individual (negado)
                                </span>
                              )}
                            </div>

                            <div className="text-[10.5px] text-slate-400 font-mono">
                              {cap.key}
                            </div>
                            <div className="text-[11px] text-slate-500 line-clamp-1">
                              {cap.description}
                            </div>

                            {!isEditableByRequester && !isMaster && (
                              <div className="text-[10px] text-amber-600 dark:text-amber-400 font-semibold">
                                ⚠️ Poder não delegado pelo Master
                              </div>
                            )}
                          </div>

                          {/* Controles de 3 Estados: Herdar | Permitir | Negar */}
                          <div className="flex items-center gap-2 shrink-0">
                            <div className="inline-flex rounded-xl bg-black/[0.04] dark:bg-white/[0.06] p-0.5">
                              <button
                                type="button"
                                disabled={!isEditableByRequester}
                                onClick={() => handleSetOverride(cap.key, 'inherit')}
                                className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all cursor-pointer disabled:opacity-30 ${
                                  overrideType === 'inherit'
                                    ? 'bg-white dark:bg-[#2c2c2e] text-slate-900 dark:text-white shadow-xs font-bold'
                                    : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
                                }`}
                                title="Herdar valor padrão do perfil do usuário"
                              >
                                Herdar
                              </button>

                              <button
                                type="button"
                                disabled={!isEditableByRequester}
                                onClick={() => handleSetOverride(cap.key, 'allow')}
                                className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all cursor-pointer disabled:opacity-30 flex items-center gap-1 ${
                                  overrideType === 'allow'
                                    ? 'bg-emerald-600 text-white shadow-xs font-bold'
                                    : 'text-slate-500 hover:text-emerald-600'
                                }`}
                                title="Conceder exceção individual permitindo o uso"
                              >
                                <Check className="w-3 h-3" />
                                <span>Permitir</span>
                              </button>

                              <button
                                type="button"
                                disabled={!isEditableByRequester}
                                onClick={() => handleSetOverride(cap.key, 'deny')}
                                className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all cursor-pointer disabled:opacity-30 flex items-center gap-1 ${
                                  overrideType === 'deny'
                                    ? 'bg-rose-600 text-white shadow-xs font-bold'
                                    : 'text-slate-500 hover:text-rose-600'
                                }`}
                                title="Conceder exceção individual bloqueando expressamente"
                              >
                                <Ban className="w-3 h-3" />
                                <span>Negar</span>
                              </button>
                            </div>

                            {/* Se o usuário for Gerente: controle de "Pode Repassar" */}
                            {isUserManager && isMaster && (
                              <button
                                type="button"
                                onClick={() => handleToggleCanGrant(cap.key)}
                                className={`px-2.5 py-1 rounded-xl text-[10.5px] font-bold border transition-all cursor-pointer flex items-center gap-1 ${
                                  canGrantCurrent
                                    ? 'bg-blue-50 border-blue-400 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300'
                                    : 'bg-black/[0.02] border-black/10 dark:border-white/10 text-slate-400 hover:text-slate-600'
                                }`}
                                title="Autorizar este gerente a repassar/delegar este poder para sua equipe"
                              >
                                <Crown className="w-3 h-3" />
                                <span>{canGrantCurrent ? 'Pode Repassar' : 'Sem Repasse'}</span>
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Rodapé da Ficha: Ver como este usuário, Auditoria e Fechar */}
        <div className="p-3.5 sm:p-4 border-t border-black/[0.05] dark:border-white/[0.06] flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            {onSimulateUser && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onSimulateUser(user);
                }}
                className="min-h-[40px] px-3.5 py-1.5 rounded-xl bg-[#007AFF] hover:bg-[#0066d6] active:scale-95 text-white text-xs font-semibold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
                title={`Ver a aplicação com a exata visão e poderes de @${user.username}`}
              >
                <Eye className="w-3.5 h-3.5" />
                <span>Ver como este usuário</span>
              </button>
            )}

            {onNavigateToAudit && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onNavigateToAudit();
                }}
                className="min-h-[40px] px-3 py-1.5 rounded-xl bg-black/[0.03] dark:bg-white/[0.05] hover:bg-black/[0.06] dark:hover:bg-white/[0.08] text-slate-700 dark:text-slate-300 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                title="Ver alterações na trilha de auditoria"
              >
                <History className="w-3.5 h-3.5 text-[#007AFF]" />
                <span className="hidden sm:inline">Trilha de Alterações</span>
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="min-h-[40px] px-4 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-white/10 dark:hover:bg-white/15 text-slate-700 dark:text-slate-200 text-xs font-semibold cursor-pointer transition-colors"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
