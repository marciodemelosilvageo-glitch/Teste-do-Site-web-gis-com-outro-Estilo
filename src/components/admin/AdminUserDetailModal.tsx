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
  Check,
  Ban,
  History,
  AlertTriangle
} from 'lucide-react';
import {
  RegisteredUser,
  ActivityLog,
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
import {
  Badge,
  StatusDot,
  SegmentedControl,
  SearchField,
  Banner,
  AdminCard
} from './ui';

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
    if (!user || !isUserManager) return [];
    const myName = (user.username || '').toLowerCase();
    return allUsers.filter(u => (u.createdBy || '').toLowerCase() === myName);
  }, [user, isUserManager, allUsers]);

  // Logs específicos deste usuário
  const userLogs = useMemo(() => {
    if (!user) return [];
    const myName = (user.username || '').toLowerCase();
    return logs.filter(l => (l.details || '').toLowerCase().includes(myName) || (l.action || '').toLowerCase().includes(myName)).slice(0, 8);
  }, [user, logs]);

  // Capacidades filtradas
  const filteredCapabilities = useMemo(() => {
    return catalog.filter(c => {
      if (selectedGroup !== 'TODOS' && c.group !== selectedGroup) return false;
      if (permSearch.trim()) {
        const term = permSearch.toLowerCase();
        return c.name.toLowerCase().includes(term) || c.key.toLowerCase().includes(term) || c.description.toLowerCase().includes(term);
      }
      return true;
    });
  }, [catalog, selectedGroup, permSearch]);

  // Handler para definir exceção individual (Herdar / Permitir / Negar)
  const handleSetOverride = useCallback(async (capKey: string, overrideType: OverrideSetting) => {
    if (!user) return;
    if (!isMaster && !canGrant(capKey)) {
      showToast?.('⚠️ Você não possui permissão delegada pelo Master para alterar este poder.');
      return;
    }

    const currentEntry = overrides[capKey];
    const canGrantVal = currentEntry?.can_grant === true;

    await saveUserOverride(user.id, capKey, overrideType, canGrantVal);

    const updated = {
      ...overrides,
      [capKey]: {
        override_type: overrideType,
        can_grant: canGrantVal
      }
    };
    setOverrides(updated);

    await logCapabilityAudit({
      performedByName: isMaster ? 'Administrador Master' : 'Gerente Autorizado',
      targetType: 'user',
      targetId: user.username,
      targetName: user.name,
      capabilityKey: capKey,
      action: overrideType === 'inherit' ? 'remove_override' : overrideType === 'allow' ? 'grant_use' : 'set_deny',
      beforeState: currentEntry || { override_type: 'inherit', can_grant: false },
      afterState: { override_type: overrideType, can_grant: canGrantVal },
      reason: `Exceção individual para @${user.username} em "${capKey}" definida como ${overrideType.toUpperCase()}`
    });

    showToast?.(`Poder "${capKey}" atualizado para: ${overrideType === 'inherit' ? 'Herdar perfil' : overrideType === 'allow' ? 'Permitido' : 'Negado'}.`);
  }, [user, isMaster, canGrant, overrides, showToast]);

  // Handler para alternar permissão de repasse do gerente ("pode repassar")
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
    <div className="fixed inset-0 z-[10000] bg-black/60 dark:bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 animate-fadeIn select-none">
      <div
        className="w-full max-w-2xl bg-white dark:bg-[#1C1C1E] rounded-3xl border border-black/[0.08] dark:border-white/[0.08] shadow-2xl overflow-hidden flex flex-col max-h-[92vh] animate-scaleUp"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabeçalho da Ficha Estilo Apple */}
        <div className="p-4 sm:p-5 border-b border-black/[0.06] dark:border-white/[0.06] flex items-center justify-between">
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="w-12 h-12 rounded-2xl bg-black/[0.04] dark:bg-white/[0.06] text-[#6C6C70] dark:text-[#98989D] flex items-center justify-center font-semibold text-base shrink-0 shadow-xs">
              {isUserMaster ? <Crown className="w-6 h-6 text-[#007AFF] dark:text-[#0A84FF]" strokeWidth={1.6} /> : isUserManager ? <Briefcase className="w-6 h-6" strokeWidth={1.6} /> : user.name.charAt(0).toUpperCase()}
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-[17px] font-semibold text-slate-900 dark:text-slate-100 truncate">
                  {user.name}
                </h3>
                {isUserMaster ? (
                  <Badge icon={Crown} variant="neutral">
                    Master (Intocável)
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
              </div>
              <p className="text-xs font-mono text-[#8E8E93] dark:text-[#8E8E93] mt-0.5">
                @{user.username}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="text-[#8E8E93] hover:text-slate-900 dark:hover:text-white p-2 rounded-xl hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center"
            title="Fechar ficha"
            aria-label="Fechar Ficha"
          >
            <X className="w-5 h-5" strokeWidth={1.6} />
          </button>
        </div>

        {/* Seletor Segmentado de Abas Apple */}
        <div className="px-5 py-2.5 border-b border-black/[0.06] dark:border-white/[0.06] bg-black/[0.02] dark:bg-white/[0.02]">
          <SegmentedControl
            options={[
              { id: 'general', label: 'Informações & Atividade', icon: User },
              {
                id: 'permissions',
                label: 'Poderes & Exceções',
                count: Object.keys(overrides).length > 0 ? Object.keys(overrides).length : undefined,
                icon: Sliders
              }
            ]}
            value={activeTab}
            onChange={(v) => setActiveTab(v as 'general' | 'permissions')}
          />
        </div>

        {/* Corpo com Rolagem */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 text-xs flex-1">
          {activeTab === 'general' ? (
            <>
              {/* Se for Master: Banner Neutro com Cadeado */}
              {isUserMaster && (
                <Banner
                  icon={Lock}
                  title="Conta Blindada pelo Banco de Dados"
                  message="O Master possui controle total e imunidade estrita. Nenhum usuário ou gatilho de terceiros tem permissão para alterar seus poderes, bloqueá-lo ou excluí-lo."
                />
              )}

              {/* Informações Cadastrais */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div className="p-3 bg-black/[0.03] dark:bg-white/[0.04] rounded-xl space-y-1 border border-black/[0.03] dark:border-white/[0.04]">
                  <span className="text-xs text-[#8E8E93] font-medium">Departamento</span>
                  <div className="font-semibold text-slate-900 dark:text-slate-100 truncate text-xs">
                    {user.department || 'Geral'}
                  </div>
                </div>

                <div className="p-3 bg-black/[0.03] dark:bg-white/[0.04] rounded-xl space-y-1 border border-black/[0.03] dark:border-white/[0.04]">
                  <span className="text-xs text-[#8E8E93] font-medium">Status</span>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    {user.isActive === false ? (
                      <StatusDot status="destructive" label="Bloqueado" />
                    ) : (
                      <StatusDot status="online" label="Ativo" />
                    )}
                  </div>
                </div>

                <div className="p-3 bg-black/[0.03] dark:bg-white/[0.04] rounded-xl space-y-1 border border-black/[0.03] dark:border-white/[0.04]">
                  <span className="text-xs text-[#8E8E93] font-medium">Cadastrado por</span>
                  <div className="font-semibold text-slate-900 dark:text-slate-100 truncate text-xs">
                    @{user.createdBy || 'Sistema'}
                  </div>
                </div>

                <div className="p-3 bg-black/[0.03] dark:bg-white/[0.04] rounded-xl space-y-1 border border-black/[0.03] dark:border-white/[0.04]">
                  <span className="text-xs text-[#8E8E93] font-medium">Último Acesso</span>
                  <div className="font-semibold text-slate-900 dark:text-slate-100 truncate text-xs">
                    {user.lastLogin ? new Date(user.lastLogin).toLocaleDateString('pt-BR') : 'Nunca acessou'}
                  </div>
                </div>
              </div>

              {/* Segurança de Senha */}
              <Banner
                icon={Lock}
                title="Credenciais Blindadas"
                message="Senhas são protegidas por hash no Supabase Auth e nunca são reveladas ou transmitidas ao cliente."
              />

              {/* Se for Gerente: Alcance e Membros da Equipe */}
              {isUserManager && (
                <div className="space-y-3 pt-2 border-t border-black/[0.05] dark:border-white/[0.06]">
                  <div className="flex items-center justify-between">
                    <span className="font-medium uppercase tracking-wider text-xs text-[#6C6C70] dark:text-[#98989D] flex items-center gap-1.5">
                      <Briefcase className="w-3.5 h-3.5" strokeWidth={1.6} />
                      Alcance de Gerência
                    </span>
                    {isMaster && (
                      <SegmentedControl
                        size="sm"
                        options={[
                          { id: 'team_only', label: 'Somente Equipe' },
                          { id: 'all_users', label: 'Todos Usuários' }
                        ]}
                        value={userScope.scope_type}
                        onChange={handleScopeChange}
                      />
                    )}
                  </div>

                  <div className="p-3 bg-black/[0.03] dark:bg-white/[0.04] rounded-xl text-xs text-[#6C6C70] dark:text-[#98989D]">
                    Alcance atual: <strong className="text-slate-900 dark:text-slate-100 font-semibold">{userScope.scope_type === 'team_only' ? 'Equipe Própria (usuários criados por este gerente)' : 'Global (todos os usuários comuns)'}</strong>.
                  </div>

                  {/* Lista de Membros da Equipe */}
                  <div className="space-y-2">
                    <div className="text-xs font-medium text-[#6C6C70] dark:text-[#98989D]">
                      Membros Criados ({teamMembers.length})
                    </div>
                    {teamMembers.length === 0 ? (
                      <div className="p-3 text-center text-xs text-[#8E8E93] bg-black/[0.02] dark:bg-white/[0.03] rounded-xl">
                        Nenhum usuário subordinado cadastrado até o momento.
                      </div>
                    ) : (
                      <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                        {teamMembers.map(m => (
                          <div key={m.id} className="p-2.5 bg-black/[0.03] dark:bg-white/[0.04] rounded-xl flex items-center justify-between text-xs border border-black/[0.03] dark:border-white/[0.04]">
                            <div>
                              <span className="font-semibold text-slate-900 dark:text-slate-100">{m.name}</span>
                              <span className="text-[#8E8E93] ml-1.5 font-mono">@{m.username}</span>
                            </div>
                            <span className="text-xs text-[#8E8E93]">{m.department || 'Geral'}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Atividades Recentes do Usuário */}
              <div className="space-y-2.5 pt-2 border-t border-black/[0.05] dark:border-white/[0.06]">
                <span className="font-medium uppercase tracking-wider text-xs text-[#6C6C70] dark:text-[#98989D] flex items-center gap-1.5">
                  <Activity className="w-3.5 h-3.5 text-[#8E8E93]" strokeWidth={1.6} />
                  Histórico Recente de Atividades
                </span>

                {userLogs.length === 0 ? (
                  <div className="p-3 text-center text-xs text-[#8E8E93] bg-black/[0.02] dark:bg-white/[0.03] rounded-xl">
                    Nenhuma atividade registrada para esta conta.
                  </div>
                ) : (
                  <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                    {userLogs.map(l => (
                      <div key={l.id} className="p-2.5 bg-black/[0.03] dark:bg-white/[0.04] rounded-xl text-xs flex items-center justify-between gap-2 border border-black/[0.03] dark:border-white/[0.04]">
                        <div className="min-w-0">
                          <div className="font-medium text-slate-900 dark:text-slate-100 truncate">{l.action}</div>
                          <div className="text-xs text-[#8E8E93] mt-0.5">{l.formattedDate} {l.details && `• ${l.details}`}</div>
                        </div>
                        <Badge variant="neutral">
                          {l.category}
                        </Badge>
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
                <div className="p-8 text-center space-y-2 bg-black/[0.02] dark:bg-white/[0.03] rounded-2xl border border-black/[0.06] dark:border-white/[0.08]">
                  <Crown className="w-10 h-10 text-[#007AFF] dark:text-[#0A84FF] mx-auto" strokeWidth={1.6} />
                  <div className="font-semibold text-slate-900 dark:text-slate-100 text-[15px]">
                    Administrador Master com Acesso Total
                  </div>
                  <p className="text-xs text-[#6C6C70] dark:text-[#98989D] max-w-md mx-auto leading-relaxed">
                    A conta Master executa 100% dos poderes do sistema sem possibilidade de revogação ou bloqueio.
                  </p>
                </div>
              ) : (
                <div className="space-y-3.5">
                  <Banner
                    message="A exceção individual sobrepõe o perfil base. Em caso de conflito, o bloqueio (Negar) tem prioridade sobre Permitir."
                  />

                  {/* Barra de Busca e Filtro de Grupo */}
                  <div className="space-y-2.5">
                    <SearchField
                      value={permSearch}
                      onChange={setPermSearch}
                      placeholder="Buscar por poder ou camada..."
                    />

                    <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
                      {(['TODOS', 'camadas', 'ferramentas', 'dados', 'conta', 'administracao'] as const).map(grp => (
                        <button
                          key={grp}
                          type="button"
                          onClick={() => setSelectedGroup(grp as any)}
                          className={`min-h-[32px] px-3 py-1 rounded-xl text-xs font-medium cursor-pointer shrink-0 transition-colors ${
                            selectedGroup === grp
                              ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-semibold'
                              : 'bg-black/[0.04] dark:bg-white/[0.06] text-[#6C6C70] dark:text-[#98989D] hover:text-slate-900 dark:hover:text-white'
                          }`}
                        >
                          {grp === 'TODOS' ? 'Todos' : grp.toUpperCase()}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Lista de Poderes e Controles de Exceção */}
                  <div className="space-y-2.5 max-h-[50vh] overflow-y-auto pr-1">
                    {filteredCapabilities.map(cap => {
                      const overrideEntry = overrides[cap.key];
                      const overrideType: OverrideSetting = overrideEntry ? overrideEntry.override_type : 'inherit';
                      const canGrantCurrent = overrideEntry?.can_grant === true;
                      const isEditableByRequester = isMaster || canGrant(cap.key);

                      return (
                        <div
                          key={cap.key}
                          className="p-3.5 bg-white dark:bg-[#1C1C1E] rounded-2xl border border-black/[0.06] dark:border-white/[0.08] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs shadow-xs"
                        >
                          <div className="space-y-1 min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-semibold text-slate-900 dark:text-slate-100 text-[13px]">
                                {cap.name}
                              </span>

                              {/* SELO DE ORIGEM */}
                              {overrideType === 'inherit' ? (
                                <Badge variant="neutral">vem do perfil</Badge>
                              ) : overrideType === 'allow' ? (
                                <Badge variant="accent">individual (permitido)</Badge>
                              ) : (
                                <Badge variant="destructive">individual (negado)</Badge>
                              )}
                            </div>

                            <div className="text-xs text-[#6C6C70] dark:text-[#98989D] line-clamp-1">
                              {cap.description}
                            </div>

                            {!isEditableByRequester && !isMaster && (
                              <div className="text-xs text-[#FF9500] dark:text-[#FF9F0A] font-medium flex items-center gap-1 mt-0.5">
                                <StatusDot status="warning" />
                                <span>Poder não delegado pelo Master</span>
                              </div>
                            )}
                          </div>

                          {/* Controles de 3 Estados: Herdar | Permitir | Negar */}
                          <div className="flex items-center gap-2 shrink-0">
                            <SegmentedControl
                              size="sm"
                              options={[
                                { id: 'inherit', label: 'Herdar' },
                                { id: 'allow', label: 'Permitir', icon: Check },
                                { id: 'deny', label: 'Negar', icon: Ban }
                              ]}
                              value={overrideType}
                              onChange={(v) => isEditableByRequester && handleSetOverride(cap.key, v as OverrideSetting)}
                            />

                            {/* Se o usuário for Gerente: controle de "Pode Repassar" */}
                            {isUserManager && isMaster && (
                              <button
                                type="button"
                                onClick={() => handleToggleCanGrant(cap.key)}
                                className={`min-h-[32px] px-3 py-1 rounded-xl text-xs font-medium border transition-all cursor-pointer flex items-center gap-1.5 ${
                                  canGrantCurrent
                                    ? 'bg-[#007AFF]/10 border-[#007AFF]/30 text-[#007AFF] dark:bg-[#0A84FF]/15 dark:text-[#0A84FF]'
                                    : 'bg-black/[0.03] dark:bg-white/[0.04] border-black/[0.06] dark:border-white/[0.08] text-[#8E8E93] hover:text-slate-900 dark:hover:text-white'
                                }`}
                                title="Autorizar este gerente a repassar este poder para sua equipe"
                              >
                                <Crown className="w-3.5 h-3.5" strokeWidth={1.6} />
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
        <div className="p-3.5 sm:p-4 border-t border-black/[0.06] dark:border-white/[0.06] flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            {onSimulateUser && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onSimulateUser(user);
                }}
                className="min-h-[44px] px-4 py-2 rounded-xl bg-[#007AFF] hover:bg-[#0062CC] dark:bg-[#0A84FF] dark:hover:bg-[#409CFF] active:scale-[0.98] text-white text-xs font-semibold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
                title={`Ver a aplicação com a exata visão e poderes de @${user.username}`}
              >
                <Eye className="w-3.5 h-3.5" strokeWidth={1.6} />
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
                className="min-h-[44px] px-3.5 py-2 rounded-xl bg-black/[0.04] dark:bg-white/[0.06] hover:bg-black/[0.08] dark:hover:bg-white/[0.1] text-slate-800 dark:text-slate-200 text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
                title="Ver alterações na trilha de auditoria"
              >
                <History className="w-3.5 h-3.5 text-[#007AFF] dark:text-[#0A84FF]" strokeWidth={1.6} />
                <span className="hidden sm:inline">Trilha de Alterações</span>
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] px-5 py-2 rounded-xl bg-black/[0.05] hover:bg-black/[0.08] dark:bg-white/[0.08] dark:hover:bg-white/[0.12] text-slate-800 dark:text-slate-200 text-xs font-medium cursor-pointer transition-colors"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
