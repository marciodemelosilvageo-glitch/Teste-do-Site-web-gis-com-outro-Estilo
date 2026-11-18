import React, { useState, useMemo, useCallback } from 'react';
import {
  Layers,
  Wrench,
  TableProperties,
  User,
  ShieldCheck,
  Search,
  Eye,
  Crown,
  Briefcase,
  Globe,
  Sliders,
  History,
  Info,
  Check,
  Lock,
  ChevronDown,
  ChevronRight,
  RotateCcw,
  Sparkles
} from 'lucide-react';
import {
  CapabilityItem,
  CapabilityGroup,
  BaseRoleKey,
  RoleCapabilitiesMatrix,
  getAllCapabilitiesCatalog,
  getBaseRolesMatrix,
  saveBaseRolesMatrix,
  logCapabilityAudit,
  getManagerScope,
  saveManagerScope,
  ManagerScopeConfig
} from '../../services/adminService';
import { useAccess } from '../../context/FeatureAccessContext';
import { dataSources } from '../../data';

interface AdminAccessSectionProps {
  isMaster: boolean;
  isManager: boolean;
  onSimulateRole?: (role: 'user' | 'manager' | 'site_account' | 'visitor') => void;
  onNavigateToAudit?: () => void;
  showToast?: (msg: string) => void;
}

const GROUP_CONFIG: Record<CapabilityGroup, { label: string; icon: React.ComponentType<{ className?: string }>; desc: string }> = {
  camadas: { label: 'Camadas Territoriais', icon: Layers, desc: 'Visibilidade e acesso espacial a camadas vetoriais no mapa' },
  ferramentas: { label: 'Ferramentas de Análise', icon: Wrench, desc: 'Instrumentos de geocodificação, polígonos, medição e buffer' },
  dados: { label: 'Dados e Exportações', icon: TableProperties, desc: 'Colunas censitárias, formatos de arquivos e cotas de download' },
  conta: { label: 'Conta e Credenciais', icon: User, desc: 'Regras de autocadastro e gerenciamento da própria senha' },
  administracao: { label: 'Administração do Sistema', icon: ShieldCheck, desc: 'Poderes de governança, auditoria e gestão de usuários' }
};

/**
 * Interruptor no estilo iOS com alvo de toque >= 44px
 */
const IosSwitch: React.FC<{
  checked: boolean;
  onChange: () => void;
  disabled?: boolean;
  ariaLabel: string;
  tint?: 'green' | 'blue';
}> = ({ checked, onChange, disabled = false, ariaLabel, tint = 'green' }) => {
  const activeBg = tint === 'blue' ? 'bg-[#007AFF]' : 'bg-[#34C759]';

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={onChange}
      className={`relative inline-flex items-center h-7 w-12 shrink-0 cursor-pointer rounded-full p-0.5 transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-[#007AFF]/30 disabled:opacity-35 disabled:cursor-not-allowed ${
        checked ? activeBg : 'bg-black/15 dark:bg-white/20'
      }`}
    >
      <span
        aria-hidden="true"
        className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
          checked ? 'translate-x-5' : 'translate-x-0'
        }`}
      />
    </button>
  );
};

export const AdminAccessSection: React.FC<AdminAccessSectionProps> = ({
  isMaster,
  isManager,
  onSimulateRole,
  onNavigateToAudit,
  showToast
}) => {
  const { canGrant } = useAccess();

  // Catálogo completo de capacidades
  const catalog = useMemo(() => {
    const layerNames = dataSources.map(ds => ds.name);
    return getAllCapabilitiesCatalog(layerNames);
  }, []);

  // Matriz de Poderes dos Perfis Base
  const [matrix, setMatrix] = useState<RoleCapabilitiesMatrix>(() => {
    const layerNames = dataSources.map(ds => ds.name);
    return getBaseRolesMatrix(layerNames);
  });

  // Escopo Padrão de Gerente
  const [managerScope, setManagerScope] = useState<ManagerScopeConfig>(() => getManagerScope('default_manager'));

  // Estados de Filtro e Busca
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedGroup, setSelectedGroup] = useState<CapabilityGroup | 'TODOS'>('TODOS');

  // Grupos expandidos/recolhidos
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});

  const toggleGroupCollapse = (group: string) => {
    setCollapsedGroups(prev => ({ ...prev, [group]: !prev[group] }));
  };

  // Filtragem dos itens do catálogo
  const filteredCatalog = useMemo(() => {
    return catalog.filter(item => {
      if (selectedGroup !== 'TODOS' && item.group !== selectedGroup) {
        return false;
      }
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase();
        const matchName = item.name.toLowerCase().includes(term);
        const matchKey = item.key.toLowerCase().includes(term);
        const matchDesc = item.description.toLowerCase().includes(term);
        if (!matchName && !matchKey && !matchDesc) return false;
      }
      return true;
    });
  }, [catalog, selectedGroup, searchTerm]);

  // Agrupamento dos itens filtrados
  const groupedCatalog = useMemo(() => {
    const groups: Partial<Record<CapabilityGroup, CapabilityItem[]>> = {};
    const order: CapabilityGroup[] = ['camadas', 'ferramentas', 'dados', 'conta', 'administracao'];

    order.forEach(g => {
      const items = filteredCatalog.filter(c => c.group === g);
      if (items.length > 0) {
        groups[g] = items;
      }
    });

    return groups;
  }, [filteredCatalog]);

  // Handler para alternar poder em um perfil base
  const handleToggleCapability = useCallback(async (
    role: BaseRoleKey,
    capKey: string,
    field: 'can_use' | 'can_grant'
  ) => {
    // Validação estrita para Gerentes: o gerente só altera o que o master lhe concedeu can_grant
    if (!isMaster) {
      const canManageThis = canGrant(capKey);
      if (!canManageThis) {
        showToast?.('⚠️ Você não possui permissão concedida pelo Master para repassar ou alterar este poder.');
        return;
      }
      // Gerente nunca pode editar o papel de Gerente nem conceder novos poderes administrativos
      if (role === 'manager' && !isMaster) {
        showToast?.('⚠️ Apenas o Administrador Master pode editar a matriz do papel de Gerente.');
        return;
      }
    }

    const currentRolePerms = matrix[role] || {};
    const currentEntry = currentRolePerms[capKey] || { can_use: false, can_grant: false };
    const nextVal = !currentEntry[field];

    const updatedRolePerms = {
      ...currentRolePerms,
      [capKey]: {
        ...currentEntry,
        [field]: nextVal,
        // Se desativar 'can_use', desativa 'can_grant' automaticamente
        ...(field === 'can_use' && !nextVal ? { can_grant: false } : {})
      }
    };

    const nextMatrix: RoleCapabilitiesMatrix = {
      ...matrix,
      [role]: updatedRolePerms
    };

    setMatrix(nextMatrix);
    await saveBaseRolesMatrix(nextMatrix);

    // Auditoria da Mudança de Poder no Perfil Base
    await logCapabilityAudit({
      performedByName: isMaster ? 'Administrador Master' : 'Gerente Autorizado',
      targetType: 'base_role',
      targetId: `role:${role}`,
      targetName: role === 'visitor' ? 'Visitante' : role === 'site_account' ? 'Conta do Site' : role === 'user' ? 'Usuário Comum' : 'Gerente',
      capabilityKey: capKey,
      action: field === 'can_use' ? (nextVal ? 'grant_use' : 'revoke_use') : (nextVal ? 'grant_delegate' : 'revoke_delegate'),
      beforeState: currentEntry,
      afterState: updatedRolePerms[capKey],
      reason: `Alteração na matriz do perfil base ${role.toUpperCase()} (${field === 'can_use' ? 'Uso' : 'Repasse'})`
    });

    showToast?.(`Perfil ${role.toUpperCase()}: ${field === 'can_use' ? 'Uso' : 'Repasse'} ${nextVal ? 'ativado' : 'desativado'}.`);
  }, [matrix, isMaster, canGrant, showToast]);

  // Handler para alterar o escopo padrão de gerentes
  const handleToggleScope = useCallback(async (newScope: 'team_only' | 'all_users') => {
    if (!isMaster) {
      showToast?.('⚠️ Apenas o Administrador Master pode alterar o alcance de gerentes.');
      return;
    }
    const updated = { ...managerScope, scope_type: newScope };
    setManagerScope(updated);
    await saveManagerScope('default_manager', updated);
    showToast?.(`Alcance padrão dos gerentes alterado para: ${newScope === 'team_only' ? 'Somente sua Equipe' : 'Todos os Usuários'}.`);
  }, [managerScope, isMaster, showToast]);

  return (
    <div className="space-y-4 animate-fadeIn pb-8">
      {/* Barra de Topo: Título, Blindagem do Master e Ações */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-2 border-b border-black/[0.04] dark:border-white/[0.06]">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              Matriz de Poderes & Perfis Base
            </h2>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#007AFF]/10 text-[#007AFF]">
              Catálogo Único
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Defina os poderes padrão de cada perfil. Exceções por usuário podem ser atribuídas na ficha individual.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {onNavigateToAudit && (
            <button
              type="button"
              onClick={onNavigateToAudit}
              className="min-h-[40px] px-3.5 py-1.5 rounded-xl bg-black/[0.03] dark:bg-white/[0.05] hover:bg-black/[0.06] dark:hover:bg-white/[0.08] active:scale-95 text-slate-700 dark:text-slate-300 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
              title="Abrir trilha de auditoria de mudanças de poder"
            >
              <History className="w-3.5 h-3.5 text-[#007AFF]" />
              <span>Trilha de Alterações</span>
            </button>
          )}

          {isMaster && (
            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200/50 dark:border-indigo-800/40 text-indigo-700 dark:text-indigo-300 text-xs font-semibold shadow-xs">
              <Crown className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
              <span>Master: Intocável e Total</span>
            </div>
          )}
        </div>
      </div>

      {/* Cartão Informativo de Blindagem do Master */}
      <div className="p-3.5 bg-gradient-to-r from-indigo-50/60 to-purple-50/40 dark:from-indigo-950/20 dark:to-purple-950/10 border border-indigo-200/60 dark:border-indigo-900/40 rounded-2xl flex items-start gap-3 text-xs">
        <Crown className="w-5 h-5 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <div className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <span>Blindagem Absoluta do Administrador Master</span>
            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-indigo-100 dark:bg-indigo-900/60 text-indigo-800 dark:text-indigo-200">
              Imune
            </span>
          </div>
          <p className="text-[11.5px] text-slate-600 dark:text-slate-400 leading-relaxed">
            O Administrador Master possui acesso universal irrestrito a todas as camadas, ferramentas e configurações. Por regra estrita no banco de dados e gatilhos SQL, nenhuma conta pode alterar, bloquear ou rebaixar o Master.
          </p>
        </div>
      </div>

      {/* Barra de Filtros e Busca de Capacidades */}
      <div className="space-y-2.5">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar por poder, camada, ferramenta ou chave (ex: dissolver, csv, medir)..."
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

        {/* Pílulas de Categoria */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 max-w-full text-xs">
          <button
            type="button"
            onClick={() => setSelectedGroup('TODOS')}
            className={`min-h-[32px] px-3 py-1 rounded-xl font-semibold cursor-pointer shrink-0 transition-colors ${
              selectedGroup === 'TODOS'
                ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold'
                : 'bg-black/[0.03] dark:bg-white/[0.04] text-slate-600 dark:text-slate-400 hover:bg-black/[0.06]'
            }`}
          >
            Todos os Poderes ({catalog.length})
          </button>

          {(['camadas', 'ferramentas', 'dados', 'conta', 'administracao'] as CapabilityGroup[]).map(grp => {
            const cfg = GROUP_CONFIG[grp];
            const Icon = cfg.icon;
            const count = catalog.filter(c => c.group === grp).length;

            return (
              <button
                key={grp}
                type="button"
                onClick={() => setSelectedGroup(grp)}
                className={`min-h-[32px] px-3 py-1 rounded-xl font-semibold cursor-pointer shrink-0 flex items-center gap-1.5 transition-colors ${
                  selectedGroup === grp
                    ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold'
                    : 'bg-black/[0.03] dark:bg-white/[0.04] text-slate-600 dark:text-slate-400 hover:bg-black/[0.06]'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{cfg.label} ({count})</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* MATRIZ DE PODERES: Tabela Responsiva Estilo Apple */}
      <div className="overflow-x-auto rounded-3xl border border-black/[0.06] dark:border-white/[0.08] bg-white dark:bg-[#1c1c1e] shadow-xs">
        <table className="w-full text-left border-collapse min-w-[760px]">
          {/* Cabeçalho da Matriz */}
          <thead>
            <tr className="border-b border-black/[0.06] dark:border-white/[0.08] bg-black/[0.02] dark:bg-white/[0.02]">
              <th className="p-3.5 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider w-[280px]">
                Poder / Capacidade
              </th>

              {/* Coluna 1: Visitante */}
              <th className="p-3.5 text-center w-[120px]">
                <div className="space-y-1.5 flex flex-col items-center">
                  <div className="flex items-center gap-1 text-xs font-bold text-slate-900 dark:text-slate-100">
                    <Globe className="w-3.5 h-3.5 text-slate-400" />
                    <span>Visitante</span>
                  </div>
                  {onSimulateRole && (
                    <button
                      type="button"
                      onClick={() => onSimulateRole('visitor')}
                      className="px-2 py-0.5 rounded-lg bg-black/[0.04] dark:bg-white/[0.08] hover:bg-[#007AFF] hover:text-white text-[10.5px] font-semibold text-slate-600 dark:text-slate-300 transition-colors flex items-center gap-1 cursor-pointer"
                      title="Simular visualização como Visitante anônimo"
                    >
                      <Eye className="w-3 h-3" />
                      <span>Ver como</span>
                    </button>
                  )}
                </div>
              </th>

              {/* Coluna 2: Conta do Site */}
              <th className="p-3.5 text-center w-[130px]">
                <div className="space-y-1.5 flex flex-col items-center">
                  <div className="flex items-center gap-1 text-xs font-bold text-slate-900 dark:text-slate-100">
                    <User className="w-3.5 h-3.5 text-blue-500" />
                    <span>Conta do Site</span>
                  </div>
                  {onSimulateRole && (
                    <button
                      type="button"
                      onClick={() => onSimulateRole('site_account')}
                      className="px-2 py-0.5 rounded-lg bg-black/[0.04] dark:bg-white/[0.08] hover:bg-[#007AFF] hover:text-white text-[10.5px] font-semibold text-slate-600 dark:text-slate-300 transition-colors flex items-center gap-1 cursor-pointer"
                      title="Simular visualização como Conta cadastrada no Site"
                    >
                      <Eye className="w-3 h-3" />
                      <span>Ver como</span>
                    </button>
                  )}
                </div>
              </th>

              {/* Coluna 3: Usuário */}
              <th className="p-3.5 text-center w-[120px]">
                <div className="space-y-1.5 flex flex-col items-center">
                  <div className="flex items-center gap-1 text-xs font-bold text-slate-900 dark:text-slate-100">
                    <User className="w-3.5 h-3.5 text-teal-600" />
                    <span>Usuário</span>
                  </div>
                  {onSimulateRole && (
                    <button
                      type="button"
                      onClick={() => onSimulateRole('user')}
                      className="px-2 py-0.5 rounded-lg bg-black/[0.04] dark:bg-white/[0.08] hover:bg-[#007AFF] hover:text-white text-[10.5px] font-semibold text-slate-600 dark:text-slate-300 transition-colors flex items-center gap-1 cursor-pointer"
                      title="Simular visualização como Usuário comum de equipe"
                    >
                      <Eye className="w-3 h-3" />
                      <span>Ver como</span>
                    </button>
                  )}
                </div>
              </th>

              {/* Coluna 4: Gerente */}
              <th className="p-3.5 text-center w-[170px] bg-teal-50/30 dark:bg-teal-950/10">
                <div className="space-y-1.5 flex flex-col items-center">
                  <div className="flex items-center gap-1 text-xs font-bold text-teal-800 dark:text-teal-300">
                    <Briefcase className="w-3.5 h-3.5 text-teal-600" />
                    <span>Gerente</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {onSimulateRole && (
                      <button
                        type="button"
                        onClick={() => onSimulateRole('manager')}
                        className="px-2 py-0.5 rounded-lg bg-teal-100 dark:bg-teal-900/60 hover:bg-[#007AFF] hover:text-white text-[10.5px] font-semibold text-teal-800 dark:text-teal-200 transition-colors flex items-center gap-1 cursor-pointer"
                        title="Simular visualização como Gerente"
                      >
                        <Eye className="w-3 h-3" />
                        <span>Ver como</span>
                      </button>
                    )}
                    {isMaster && (
                      <button
                        type="button"
                        onClick={() => handleToggleScope(managerScope.scope_type === 'team_only' ? 'all_users' : 'team_only')}
                        className="px-2 py-0.5 rounded-lg border border-teal-500/30 text-[10px] font-bold text-teal-700 dark:text-teal-300 hover:bg-teal-50 dark:hover:bg-teal-950/40 transition-colors cursor-pointer"
                        title="Alternar alcance padrão dos gerentes"
                      >
                        Alcance: {managerScope.scope_type === 'team_only' ? 'Equipe' : 'Todos'}
                      </button>
                    )}
                  </div>
                  <div className="text-[10px] font-semibold text-teal-600 dark:text-teal-400 flex items-center gap-2">
                    <span>Uso</span>
                    <span>•</span>
                    <span className="flex items-center gap-0.5">
                      <Crown className="w-2.5 h-2.5" /> Repasse
                    </span>
                  </div>
                </div>
              </th>
            </tr>
          </thead>

          {/* Corpo da Matriz por Grupos */}
          <tbody className="divide-y divide-black/[0.04] dark:divide-white/[0.06] text-xs">
            {Object.keys(groupedCatalog).length === 0 ? (
              <tr>
                <td colSpan={5} className="p-8 text-center text-slate-400">
                  Nenhum poder encontrado com o termo "{searchTerm}".
                </td>
              </tr>
            ) : (
              (Object.keys(groupedCatalog) as CapabilityGroup[]).map(groupKey => {
                const items = groupedCatalog[groupKey] || [];
                const cfg = GROUP_CONFIG[groupKey];
                const Icon = cfg.icon;
                const isCollapsed = collapsedGroups[groupKey] === true;

                return (
                  <React.Fragment key={groupKey}>
                    {/* Linha de Cabeçalho do Grupo */}
                    <tr
                      onClick={() => toggleGroupCollapse(groupKey)}
                      className="bg-black/[0.015] dark:bg-white/[0.015] hover:bg-black/[0.03] dark:hover:bg-white/[0.03] cursor-pointer transition-colors"
                    >
                      <td colSpan={5} className="p-3 font-bold text-slate-800 dark:text-slate-200">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            {isCollapsed ? <ChevronRight className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                            <Icon className="w-4 h-4 text-[#007AFF]" />
                            <span className="text-xs uppercase tracking-wider">{cfg.label}</span>
                            <span className="text-[11px] font-normal text-slate-400">({items.length} itens)</span>
                          </div>
                          <span className="text-[11px] font-normal text-slate-400 hidden sm:inline">
                            {cfg.desc}
                          </span>
                        </div>
                      </td>
                    </tr>

                    {/* Linhas de Itens do Grupo */}
                    {!isCollapsed &&
                      items.map(item => {
                        const visitorEntry = matrix.visitor?.[item.key] || { can_use: false, can_grant: false };
                        const siteEntry = matrix.site_account?.[item.key] || { can_use: false, can_grant: false };
                        const userEntry = matrix.user?.[item.key] || { can_use: false, can_grant: false };
                        const managerEntry = matrix.manager?.[item.key] || { can_use: false, can_grant: false };

                        // Restrição de delegação para quem está editando
                        const isEditableByRequester = isMaster || canGrant(item.key);

                        return (
                          <tr
                            key={item.key}
                            className="hover:bg-black/[0.01] dark:hover:bg-white/[0.01] transition-colors"
                          >
                            {/* Nome e Chave do Poder */}
                            <td className="p-3.5 space-y-0.5">
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-slate-900 dark:text-slate-100">
                                  {item.name}
                                </span>
                                {item.riskLevel === 'high' && (
                                  <span className="px-1.5 py-0.2 rounded text-[9px] font-bold uppercase bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
                                    Alto
                                  </span>
                                )}
                                {item.riskLevel === 'critical' && (
                                  <span className="px-1.5 py-0.2 rounded text-[9px] font-bold uppercase bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300">
                                    Crítico
                                  </span>
                                )}
                              </div>
                              <div className="text-[11px] text-slate-400 dark:text-slate-500 font-mono">
                                {item.key}
                              </div>
                              <div className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-1">
                                {item.description}
                              </div>
                              {!isEditableByRequester && !isMaster && (
                                <span className="inline-block text-[9.5px] font-bold text-amber-600 dark:text-amber-400">
                                  ⚠️ Repasse não delegado pelo Master
                                </span>
                              )}
                            </td>

                            {/* Coluna Visitante */}
                            <td className="p-3.5 text-center">
                              <div className="flex items-center justify-center">
                                <IosSwitch
                                  checked={visitorEntry.can_use}
                                  onChange={() => handleToggleCapability('visitor', item.key, 'can_use')}
                                  disabled={!isEditableByRequester}
                                  ariaLabel={`Permitir uso de ${item.name} para Visitante`}
                                />
                              </div>
                            </td>

                            {/* Coluna Conta do Site */}
                            <td className="p-3.5 text-center">
                              <div className="flex items-center justify-center">
                                <IosSwitch
                                  checked={siteEntry.can_use}
                                  onChange={() => handleToggleCapability('site_account', item.key, 'can_use')}
                                  disabled={!isEditableByRequester}
                                  ariaLabel={`Permitir uso de ${item.name} para Conta do Site`}
                                />
                              </div>
                            </td>

                            {/* Coluna Usuário Comum */}
                            <td className="p-3.5 text-center">
                              <div className="flex items-center justify-center">
                                <IosSwitch
                                  checked={userEntry.can_use}
                                  onChange={() => handleToggleCapability('user', item.key, 'can_use')}
                                  disabled={!isEditableByRequester}
                                  ariaLabel={`Permitir uso de ${item.name} para Usuário Comum`}
                                />
                              </div>
                            </td>

                            {/* Coluna Gerente: DUAS MARCAS (Pode Usar e Pode Repassar) */}
                            <td className="p-3.5 text-center bg-teal-50/20 dark:bg-teal-950/05">
                              <div className="flex items-center justify-center gap-2">
                                {/* Marca 1: Pode Usar (Verde) */}
                                <div className="flex flex-col items-center">
                                  <IosSwitch
                                    checked={managerEntry.can_use}
                                    onChange={() => handleToggleCapability('manager', item.key, 'can_use')}
                                    disabled={!isMaster}
                                    tint="green"
                                    ariaLabel={`Gerente pode usar ${item.name}`}
                                  />
                                </div>

                                <div className="w-[1px] h-5 bg-black/10 dark:bg-white/10" />

                                {/* Marca 2: Pode Repassar (Azul) */}
                                <div className="flex flex-col items-center">
                                  <IosSwitch
                                    checked={managerEntry.can_grant}
                                    onChange={() => handleToggleCapability('manager', item.key, 'can_grant')}
                                    disabled={!isMaster || !managerEntry.can_use}
                                    tint="blue"
                                    ariaLabel={`Gerente pode repassar/delegar ${item.name}`}
                                  />
                                </div>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                  </React.Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
