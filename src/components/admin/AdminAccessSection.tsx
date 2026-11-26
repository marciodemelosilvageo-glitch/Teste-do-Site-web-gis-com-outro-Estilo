import React, { useState, useMemo, useCallback } from 'react';
import {
  Layers,
  Wrench,
  TableProperties,
  User,
  ShieldCheck,
  Eye,
  Crown,
  Briefcase,
  Globe,
  History,
  Info,
  ChevronDown,
  ChevronRight
} from 'lucide-react';
import {
  CapabilityItem,
  CapabilityGroup,
  BaseRoleKey,
  RoleCapabilitiesMatrix,
  getAllCapabilitiesCatalog,
  getBaseRolesMatrix,
  saveBaseRolesMatrix,
  saveRoleCapability,
  logCapabilityAudit,
  getManagerScope,
  saveManagerScope,
  ManagerScopeConfig
} from '../../services/adminService';
import { useAccess } from '../../context/FeatureAccessContext';
import { dataSources } from '../../data';
import {
  Badge,
  StatusDot,
  Toggle,
  SearchField,
  SegmentedControl
} from './ui';

interface AdminAccessSectionProps {
  isMaster: boolean;
  isManager: boolean;
  onSimulateRole?: (role: 'user' | 'manager_user' | 'manager' | 'site_account' | 'visitor') => void;
  onNavigateToAudit?: () => void;
  showToast?: (msg: string) => void;
}

const GROUP_CONFIG: Record<CapabilityGroup, { label: string; icon: React.ComponentType<{ className?: string; strokeWidth?: number }>; desc: string }> = {
  camadas: { label: 'Camadas Territoriais', icon: Layers, desc: 'Visibilidade e acesso espacial a camadas vetoriais no mapa' },
  ferramentas: { label: 'Ferramentas de Análise', icon: Wrench, desc: 'Instrumentos de geocodificação, polígonos, medição e buffer' },
  dados: { label: 'Dados e Exportações', icon: TableProperties, desc: 'Colunas censitárias, formatos de arquivos e cotas de download' },
  conta: { label: 'Conta e Credenciais', icon: User, desc: 'Regras de autocadastro e gerenciamento da própria senha' },
  administracao: { label: 'Administração do Sistema', icon: ShieldCheck, desc: 'Poderes de governança, auditoria e gestão de usuários' }
};

export const AdminAccessSection: React.FC<AdminAccessSectionProps> = ({
  isMaster,
  onSimulateRole,
  onNavigateToAudit,
  showToast
}) => {
  const { can, canGrant } = useAccess();
  const canManageRoles = isMaster || can('admin:roles:manage');
  const canSimulateProfile = isMaster || can('admin:simulate:profile');

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
  const [showProfileGuide, setShowProfileGuide] = useState(true);

  // Grupos expandidos/recolhidos
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});

  const toggleGroupCollapse = (group: string) => {
    setCollapsedGroups(prev => ({ ...prev, [group]: !prev[group] }));
  };

  // Catálogo visível para o papel atual (Gerente vê apenas poderes que pode repassar)
  const visibleCatalog = useMemo(() => {
    if (isMaster) return catalog;
    return catalog.filter(item => canGrant(item.key));
  }, [catalog, isMaster, canGrant]);

  // Filtragem dos itens do catálogo
  const filteredCatalog = useMemo(() => {
    return visibleCatalog.filter(item => {
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
  }, [visibleCatalog, selectedGroup, searchTerm]);

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
    // Validação estrita para Gerentes: precisa de admin:roles:manage e can_grant na capacidade
    if (!isMaster) {
      if (!canManageRoles) {
        showToast?.('⚠️ Você não tem permissão para editar os perfis padrão.');
        return;
      }
      const canManageThis = canGrant(capKey);
      if (!canManageThis) {
        showToast?.('⚠️ Você não tem permissão para esta ação.');
        return;
      }
      if (role === 'manager') {
        showToast?.('⚠️ Você não tem permissão para esta ação.');
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
    const saveRes = await saveRoleCapability(role, capKey, updatedRolePerms[capKey], { canManageRoles });
    if (!saveRes.success) {
      setMatrix(matrix);
      showToast?.(`⚠️ ${saveRes.error || 'Não foi possível salvar a alteração no servidor.'}`);
      return;
    }

    // Auditoria da Mudança de Poder no Perfil Base
    await logCapabilityAudit({
      performedByName: isMaster ? 'Administrador Master' : 'Gerente Autorizado',
      targetType: 'base_role',
      targetId: `role:${role}`,
      targetName: role === 'visitor' ? 'Visitante' : role === 'site_account' ? 'Conta do Site' : role === 'user' ? 'Usuário Comum' : role === 'manager_user' ? 'Login gerado por Gerente' : 'Gerente',
      capabilityKey: capKey,
      action: field === 'can_use' ? (nextVal ? 'grant_use' : 'revoke_use') : (nextVal ? 'grant_delegate' : 'revoke_delegate'),
      beforeState: currentEntry,
      afterState: updatedRolePerms[capKey],
      reason: `Alteração na matriz do perfil base ${role.toUpperCase()} (${field === 'can_use' ? 'Uso' : 'Repasse'})`
    });

    showToast?.(`Perfil ${role.toUpperCase()}: ${field === 'can_use' ? 'Uso' : 'Repasse'} ${nextVal ? 'ativado' : 'desativado'}.`);
  }, [matrix, isMaster, canManageRoles, canGrant, showToast]);

  // Handler para alterar o escopo padrão de gerentes
  const handleToggleScope = useCallback(async (newScope: 'team_only' | 'all_users') => {
    if (!isMaster) {
      showToast?.('⚠️ Você não tem permissão para esta ação.');
      return;
    }
    const updated = { ...managerScope, scope_type: newScope };
    setManagerScope(updated);
    await saveManagerScope('default_manager', updated);
    showToast?.(`Alcance padrão dos gerentes alterado para: ${newScope === 'team_only' ? 'Somente sua Equipe' : 'Todos os Usuários'}.`);
  }, [managerScope, isMaster, showToast]);

  return (
    <div className="space-y-5 animate-fadeIn pb-8 select-none">
      {/* Barra de Topo: Título e Ações */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-2 border-b border-black/[0.06] dark:border-white/[0.06]">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-[28px] font-semibold text-slate-900 dark:text-slate-100 tracking-tight leading-8">
              Acesso & Permissões
            </h2>
            <Badge variant="accent">Catálogo Central</Badge>
          </div>
          <p className="text-xs text-[#6C6C70] dark:text-[#98989D] mt-1">
            Matriz de poderes padrão por perfil. Exceções por usuário são atribuídas na ficha individual.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {onNavigateToAudit && (
            <button
              type="button"
              onClick={onNavigateToAudit}
              className="min-h-[44px] px-3.5 py-2 rounded-xl bg-black/[0.04] dark:bg-white/[0.06] hover:bg-black/[0.08] dark:hover:bg-white/[0.1] active:scale-[0.98] text-slate-800 dark:text-slate-200 text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer"
              title="Abrir trilha de auditoria de mudanças de poder"
            >
              <History className="w-4 h-4 text-[#007AFF] dark:text-[#0A84FF]" strokeWidth={1.6} />
              <span>Trilha de Alterações</span>
            </button>
          )}
        </div>
      </div>

      {/* Guia Rápido Recolhível dos Perfis */}
      <div className="rounded-2xl border border-black/[0.06] dark:border-white/[0.08] bg-white dark:bg-[#1C1C1E] shadow-xs overflow-hidden">
        <button
          type="button"
          onClick={() => setShowProfileGuide(prev => !prev)}
          className="w-full px-4 py-3 flex items-center justify-between gap-2 text-left hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition-colors cursor-pointer"
        >
          <div className="flex items-center gap-2 min-w-0">
            <Info className="w-4 h-4 text-[#007AFF] dark:text-[#0A84FF] shrink-0" strokeWidth={1.6} />
            <span className="text-xs font-semibold text-slate-900 dark:text-slate-100">
              Como funcionam os perfis e permissões
            </span>
          </div>
          {showProfileGuide ? (
            <ChevronDown className="w-4 h-4 text-[#8E8E93] shrink-0" strokeWidth={1.6} />
          ) : (
            <ChevronRight className="w-4 h-4 text-[#8E8E93] shrink-0" strokeWidth={1.6} />
          )}
        </button>

        {showProfileGuide && (
          <div className="px-4 pb-3.5 pt-1 border-t border-black/[0.05] dark:border-white/[0.06] space-y-2.5 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2 pt-1.5">
              <div className="p-2.5 rounded-xl bg-black/[0.025] dark:bg-white/[0.03] border border-black/[0.04] dark:border-white/[0.05]">
                <div className="font-semibold text-slate-900 dark:text-slate-100">Visitante</div>
                <p className="text-[11px] text-[#6C6C70] dark:text-[#98989D] mt-0.5 leading-relaxed">
                  Entra sem senha nem conta, apenas navega e usa o site.
                </p>
              </div>
              <div className="p-2.5 rounded-xl bg-black/[0.025] dark:bg-white/[0.03] border border-black/[0.04] dark:border-white/[0.05]">
                <div className="font-semibold text-slate-900 dark:text-slate-100">Conta do Site</div>
                <p className="text-[11px] text-[#6C6C70] dark:text-[#98989D] mt-0.5 leading-relaxed">
                  Pessoa que criou a própria conta pelo formulário público do site.
                </p>
              </div>
              <div className="p-2.5 rounded-xl bg-black/[0.025] dark:bg-white/[0.03] border border-black/[0.04] dark:border-white/[0.05]">
                <div className="font-semibold text-slate-900 dark:text-slate-100">Usuário</div>
                <p className="text-[11px] text-[#6C6C70] dark:text-[#98989D] mt-0.5 leading-relaxed">
                  Login criado pela gestão diretamente no painel administrativo.
                </p>
              </div>
              <div className="p-2.5 rounded-xl bg-black/[0.025] dark:bg-white/[0.03] border border-black/[0.04] dark:border-white/[0.05]">
                <div className="font-semibold text-slate-900 dark:text-slate-100">Login gerado por Gerente</div>
                <p className="text-[11px] text-[#6C6C70] dark:text-[#98989D] mt-0.5 leading-relaxed">
                  Contas criadas por um gerente no painel para sua equipe.
                </p>
              </div>
              <div className="p-2.5 rounded-xl bg-black/[0.025] dark:bg-white/[0.03] border border-black/[0.04] dark:border-white/[0.05]">
                <div className="font-semibold text-slate-900 dark:text-slate-100">Gerente</div>
                <p className="text-[11px] text-[#6C6C70] dark:text-[#98989D] mt-0.5 leading-relaxed">
                  Gestor de equipe. <strong>Uso</strong> = pode usar o poder; <strong>Repasse</strong> = pode passar esse poder adiante.
                </p>
              </div>
            </div>
            <p className="text-[11px] text-[#6C6C70] dark:text-[#98989D]">
              Estes são os poderes padrão de cada perfil. Você pode ajustar exceções individuais a qualquer momento abrindo a ficha de cada usuário.
            </p>
          </div>
        )}
      </div>

      {/* Busca em Cápsula e Categorias */}
      <div className="space-y-3">
        <SearchField
          value={searchTerm}
          onChange={setSearchTerm}
          placeholder="Buscar por poder, camada, ferramenta ou chave..."
        />

        {/* Pílulas de Categoria */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 max-w-full text-xs">
          <button
            type="button"
            onClick={() => setSelectedGroup('TODOS')}
            className={`min-h-[32px] px-3.5 py-1 rounded-xl text-xs font-medium cursor-pointer shrink-0 transition-colors ${
              selectedGroup === 'TODOS'
                ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-semibold'
                : 'bg-black/[0.04] dark:bg-white/[0.06] text-[#6C6C70] dark:text-[#98989D] hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Todos ({visibleCatalog.length})
          </button>

          {(['camadas', 'ferramentas', 'dados', 'conta', 'administracao'] as CapabilityGroup[]).map(grp => {
            const cfg = GROUP_CONFIG[grp];
            const Icon = cfg.icon;
            const count = visibleCatalog.filter(c => c.group === grp).length;
            if (!isMaster && count === 0) return null;

            return (
              <button
                key={grp}
                type="button"
                onClick={() => setSelectedGroup(grp)}
                className={`min-h-[32px] px-3.5 py-1 rounded-xl text-xs font-medium cursor-pointer shrink-0 flex items-center gap-1.5 transition-colors ${
                  selectedGroup === grp
                    ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-semibold'
                    : 'bg-black/[0.04] dark:bg-white/[0.06] text-[#6C6C70] dark:text-[#98989D] hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Icon className="w-3.5 h-3.5" strokeWidth={1.6} />
                <span>{cfg.label} ({count})</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* MATRIZ DE PODERES: Tabela Responsiva Apple com Cabeçalho Congelado */}
      <div className="overflow-x-auto md:overflow-x-visible rounded-3xl border border-black/[0.06] dark:border-white/[0.08] bg-white dark:bg-[#1C1C1E] shadow-xs">
        <table className="w-full text-left border-collapse min-w-[760px]">
          {/* Cabeçalho da Matriz (Sticky no topo durante rolagem vertical) */}
          <thead>
            <tr>
              <th className="sticky top-0 z-20 bg-[#FAFAFB] dark:bg-[#242426] md:rounded-tl-3xl shadow-[0_1px_0_0_rgba(0,0,0,0.08)] dark:shadow-[0_1px_0_0_rgba(255,255,255,0.08)] p-4 text-xs font-medium text-[#6C6C70] dark:text-[#98989D] uppercase tracking-wider w-[280px] align-bottom">
                <div>Poder / Capacidade</div>
                <div className="text-[11px] normal-case tracking-normal font-normal text-[#8E8E93] mt-0.5">
                  Padrão aplicado por perfil
                </div>
              </th>

              {/* Coluna 1: Visitante */}
              <th className="sticky top-0 z-20 bg-[#FAFAFB] dark:bg-[#242426] shadow-[0_1px_0_0_rgba(0,0,0,0.08)] dark:shadow-[0_1px_0_0_rgba(255,255,255,0.08)] p-4 text-center w-[125px] align-bottom">
                <div className="space-y-1 flex flex-col items-center">
                  <div className="flex items-center gap-1 text-xs font-semibold text-slate-900 dark:text-slate-100">
                    <Globe className="w-3.5 h-3.5 text-[#8E8E93]" strokeWidth={1.6} />
                    <span>Visitante</span>
                  </div>
                  <span className="text-[10px] font-normal text-[#8E8E93]">Sem login</span>
                  {canSimulateProfile && onSimulateRole && (
                    <button
                      type="button"
                      onClick={() => onSimulateRole('visitor')}
                      className="px-2.5 py-1 rounded-lg bg-black/[0.04] dark:bg-white/[0.08] hover:bg-[#007AFF] hover:text-white dark:hover:bg-[#0A84FF] text-xs font-medium text-[#6C6C70] dark:text-[#98989D] transition-colors flex items-center gap-1 cursor-pointer min-h-[28px]"
                      title="Simular visualização como Visitante"
                    >
                      <Eye className="w-3 h-3" strokeWidth={1.6} />
                      <span>Ver como</span>
                    </button>
                  )}
                </div>
              </th>

              {/* Coluna 2: Conta do Site */}
              <th className="sticky top-0 z-20 bg-[#FAFAFB] dark:bg-[#242426] shadow-[0_1px_0_0_rgba(0,0,0,0.08)] dark:shadow-[0_1px_0_0_rgba(255,255,255,0.08)] p-4 text-center w-[135px] align-bottom">
                <div className="space-y-1 flex flex-col items-center">
                  <div className="flex items-center gap-1 text-xs font-semibold text-slate-900 dark:text-slate-100">
                    <User className="w-3.5 h-3.5 text-[#8E8E93]" strokeWidth={1.6} />
                    <span>Conta Site</span>
                  </div>
                  <span className="text-[10px] font-normal text-[#8E8E93]">Autocadastro</span>
                  {canSimulateProfile && onSimulateRole && (
                    <button
                      type="button"
                      onClick={() => onSimulateRole('site_account')}
                      className="px-2.5 py-1 rounded-lg bg-black/[0.04] dark:bg-white/[0.08] hover:bg-[#007AFF] hover:text-white dark:hover:bg-[#0A84FF] text-xs font-medium text-[#6C6C70] dark:text-[#98989D] transition-colors flex items-center gap-1 cursor-pointer min-h-[28px]"
                      title="Simular visualização como Conta do Site"
                    >
                      <Eye className="w-3 h-3" strokeWidth={1.6} />
                      <span>Ver como</span>
                    </button>
                  )}
                </div>
              </th>

              {/* Coluna 3: Usuário */}
              <th className="sticky top-0 z-20 bg-[#FAFAFB] dark:bg-[#242426] shadow-[0_1px_0_0_rgba(0,0,0,0.08)] dark:shadow-[0_1px_0_0_rgba(255,255,255,0.08)] p-4 text-center w-[125px] align-bottom">
                <div className="space-y-1 flex flex-col items-center">
                  <div className="flex items-center gap-1 text-xs font-semibold text-slate-900 dark:text-slate-100">
                    <User className="w-3.5 h-3.5 text-[#8E8E93]" strokeWidth={1.6} />
                    <span>Usuário</span>
                  </div>
                  <span className="text-[10px] font-normal text-[#8E8E93]">Criado no painel</span>
                  {canSimulateProfile && onSimulateRole && (
                    <button
                      type="button"
                      onClick={() => onSimulateRole('user')}
                      className="px-2.5 py-1 rounded-lg bg-black/[0.04] dark:bg-white/[0.08] hover:bg-[#007AFF] hover:text-white dark:hover:bg-[#0A84FF] text-xs font-medium text-[#6C6C70] dark:text-[#98989D] transition-colors flex items-center gap-1 cursor-pointer min-h-[28px]"
                      title="Simular visualização como Usuário"
                    >
                      <Eye className="w-3 h-3" strokeWidth={1.6} />
                      <span>Ver como</span>
                    </button>
                  )}
                </div>
              </th>

              {/* Coluna 4: Login gerado por Gerente */}
              <th className="sticky top-0 z-20 bg-[#FAFAFB] dark:bg-[#242426] shadow-[0_1px_0_0_rgba(0,0,0,0.08)] dark:shadow-[0_1px_0_0_rgba(255,255,255,0.08)] p-4 text-center w-[155px] align-bottom">
                <div className="space-y-1 flex flex-col items-center">
                  <div className="flex items-center gap-1 text-xs font-semibold text-slate-900 dark:text-slate-100 leading-tight">
                    <User className="w-3.5 h-3.5 text-[#8E8E93] shrink-0" strokeWidth={1.6} />
                    <span>Login gerado por Gerente</span>
                  </div>
                  <span className="text-[10px] font-normal text-[#8E8E93]">Logins que um gerente cria</span>
                  {canSimulateProfile && onSimulateRole && (
                    <button
                      type="button"
                      onClick={() => onSimulateRole('manager_user')}
                      className="px-2.5 py-1 rounded-lg bg-black/[0.04] dark:bg-white/[0.08] hover:bg-[#007AFF] hover:text-white dark:hover:bg-[#0A84FF] text-xs font-medium text-[#6C6C70] dark:text-[#98989D] transition-colors flex items-center gap-1 cursor-pointer min-h-[28px]"
                      title="Simular visualização como Login gerado por Gerente"
                    >
                      <Eye className="w-3 h-3" strokeWidth={1.6} />
                      <span>Ver como</span>
                    </button>
                  )}
                </div>
              </th>

              {/* Coluna 4: Gerente */}
              <th className="sticky top-0 z-20 bg-[#F4F4F6] dark:bg-[#2A2A2D] md:rounded-tr-3xl shadow-[0_1px_0_0_rgba(0,0,0,0.08)] dark:shadow-[0_1px_0_0_rgba(255,255,255,0.08)] p-4 text-center w-[170px] align-bottom">
                <div className="space-y-1 flex flex-col items-center">
                  <div className="flex items-center gap-1 text-xs font-semibold text-slate-900 dark:text-slate-100">
                    <Briefcase className="w-3.5 h-3.5 text-[#8E8E93]" strokeWidth={1.6} />
                    <span>Gerente</span>
                  </div>
                  <span className="text-[10px] font-normal text-[#8E8E93]">Gestor de equipe</span>
                  <div className="flex items-center gap-2">
                    {canSimulateProfile && onSimulateRole && (
                      <button
                        type="button"
                        onClick={() => onSimulateRole('manager')}
                        className="px-2.5 py-1 rounded-lg bg-black/[0.04] dark:bg-white/[0.08] hover:bg-[#007AFF] hover:text-white dark:hover:bg-[#0A84FF] text-xs font-medium text-[#6C6C70] dark:text-[#98989D] transition-colors flex items-center gap-1 cursor-pointer min-h-[28px]"
                        title="Simular visualização como Gerente"
                      >
                        <Eye className="w-3 h-3" strokeWidth={1.6} />
                        <span>Ver como</span>
                      </button>
                    )}
                    {isMaster && (
                      <button
                        type="button"
                        onClick={() => handleToggleScope(managerScope.scope_type === 'team_only' ? 'all_users' : 'team_only')}
                        className="px-2.5 py-1 rounded-lg border border-black/[0.08] dark:border-white/[0.1] text-xs font-medium text-[#6C6C70] dark:text-[#98989D] hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer min-h-[28px]"
                        title="Alternar alcance padrão dos gerentes"
                      >
                        {managerScope.scope_type === 'team_only' ? 'Equipe' : 'Todos'}
                      </button>
                    )}
                  </div>
                  <div className="text-xs text-[#8E8E93] flex items-center gap-2 font-medium">
                    <span title="Pode usar este poder">Uso</span>
                    <span>•</span>
                    <span title="Pode repassar este poder">Repasse</span>
                  </div>
                </div>
              </th>
            </tr>
          </thead>

          {/* Corpo da Matriz por Grupos */}
          <tbody className="divide-y divide-black/[0.05] dark:divide-white/[0.06] text-xs">
            {Object.keys(groupedCatalog).length === 0 ? (
              <tr>
                <td colSpan={6} className="p-8 text-center text-[#8E8E93]">
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
                      className="bg-black/[0.02] dark:bg-white/[0.03] hover:bg-black/[0.04] dark:hover:bg-white/[0.05] cursor-pointer transition-colors"
                    >
                      <td colSpan={6} className="p-3.5 font-semibold text-slate-900 dark:text-slate-100">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            {isCollapsed ? <ChevronRight className="w-4 h-4 text-[#8E8E93]" strokeWidth={1.6} /> : <ChevronDown className="w-4 h-4 text-[#8E8E93]" strokeWidth={1.6} />}
                            <Icon className="w-4 h-4 text-[#007AFF] dark:text-[#0A84FF]" strokeWidth={1.6} />
                            <span className="text-xs uppercase tracking-wider">{cfg.label}</span>
                            <span className="text-xs font-normal text-[#8E8E93]">({items.length})</span>
                          </div>
                          <span className="text-xs font-normal text-[#8E8E93] hidden sm:inline">
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
                        const managerUserEntry = matrix.manager_user?.[item.key] || userEntry;
                        const managerEntry = matrix.manager?.[item.key] || { can_use: false, can_grant: false };

                        const isEditableByRequester = isMaster || canGrant(item.key);

                        return (
                          <tr
                            key={item.key}
                            className="hover:bg-black/[0.01] dark:hover:bg-white/[0.01] transition-colors"
                          >
                            {/* Nome e Chave do Poder */}
                            <td className="p-4 space-y-0.5">
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-slate-900 dark:text-slate-100 text-[13px]">
                                  {item.name}
                                </span>
                                {item.riskLevel === 'high' && (
                                  <StatusDot status="warning" label="Atenção" />
                                )}
                                {item.riskLevel === 'critical' && (
                                  <StatusDot status="destructive" label="Crítico" />
                                )}
                              </div>
                              <div className="text-xs text-[#6C6C70] dark:text-[#98989D] line-clamp-1">
                                {item.description}
                              </div>
                            </td>

                            {/* Coluna Visitante */}
                            <td className="p-4 text-center">
                              <div className="flex items-center justify-center">
                                {canManageRoles ? (
                                  <Toggle
                                    checked={visitorEntry.can_use}
                                    onChange={() => handleToggleCapability('visitor', item.key, 'can_use')}
                                    disabled={!isEditableByRequester}
                                  />
                                ) : (
                                  <span className={`text-[11px] font-medium ${visitorEntry.can_use ? 'text-[#007AFF] dark:text-[#0A84FF]' : 'text-[#8E8E93]'}`}>
                                    {visitorEntry.can_use ? 'Sim' : 'Não'}
                                  </span>
                                )}
                              </div>
                            </td>

                            {/* Coluna Conta do Site */}
                            <td className="p-4 text-center">
                              <div className="flex items-center justify-center">
                                {canManageRoles ? (
                                  <Toggle
                                    checked={siteEntry.can_use}
                                    onChange={() => handleToggleCapability('site_account', item.key, 'can_use')}
                                    disabled={!isEditableByRequester}
                                  />
                                ) : (
                                  <span className={`text-[11px] font-medium ${siteEntry.can_use ? 'text-[#007AFF] dark:text-[#0A84FF]' : 'text-[#8E8E93]'}`}>
                                    {siteEntry.can_use ? 'Sim' : 'Não'}
                                  </span>
                                )}
                              </div>
                            </td>

                            {/* Coluna Usuário Comum */}
                            <td className="p-4 text-center">
                              <div className="flex items-center justify-center">
                                {canManageRoles ? (
                                  <Toggle
                                    checked={userEntry.can_use}
                                    onChange={() => handleToggleCapability('user', item.key, 'can_use')}
                                    disabled={!isEditableByRequester}
                                  />
                                ) : (
                                  <span className={`text-[11px] font-medium ${userEntry.can_use ? 'text-[#007AFF] dark:text-[#0A84FF]' : 'text-[#8E8E93]'}`}>
                                    {userEntry.can_use ? 'Sim' : 'Não'}
                                  </span>
                                )}
                              </div>
                            </td>

                            {/* Coluna Login gerado por Gerente */}
                            <td className="p-4 text-center">
                              <div className="flex items-center justify-center">
                                {canManageRoles ? (
                                  <Toggle
                                    checked={managerUserEntry.can_use}
                                    onChange={() => handleToggleCapability('manager_user', item.key, 'can_use')}
                                    disabled={!isEditableByRequester}
                                  />
                                ) : (
                                  <span className={`text-[11px] font-medium ${managerUserEntry.can_use ? 'text-[#007AFF] dark:text-[#0A84FF]' : 'text-[#8E8E93]'}`}>
                                    {managerUserEntry.can_use ? 'Sim' : 'Não'}
                                  </span>
                                )}
                              </div>
                            </td>

                            {/* Coluna Gerente: DUAS MARCAS (Pode Usar e Pode Repassar) */}
                            <td className="p-4 text-center bg-black/[0.015] dark:bg-white/[0.02]">
                              {isMaster ? (
                                <div className="flex items-center justify-center gap-3">
                                  <Toggle
                                    checked={managerEntry.can_use}
                                    onChange={() => handleToggleCapability('manager', item.key, 'can_use')}
                                    disabled={!isMaster}
                                  />
                                  <div className="w-[1px] h-5 bg-black/[0.08] dark:bg-white/[0.08]" />
                                  <Toggle
                                    checked={managerEntry.can_grant}
                                    onChange={() => handleToggleCapability('manager', item.key, 'can_grant')}
                                    disabled={!isMaster || !managerEntry.can_use}
                                  />
                                </div>
                              ) : (
                                <div className="flex items-center justify-center gap-3 text-[11px] font-medium">
                                  <span className={managerEntry.can_use ? 'text-[#007AFF] dark:text-[#0A84FF]' : 'text-[#8E8E93]'}>
                                    {managerEntry.can_use ? 'Sim' : 'Não'}
                                  </span>
                                  <span className="text-[#8E8E93]">•</span>
                                  <span className={managerEntry.can_grant ? 'text-[#007AFF] dark:text-[#0A84FF]' : 'text-[#8E8E93]'}>
                                    {managerEntry.can_grant ? 'Sim' : 'Não'}
                                  </span>
                                </div>
                              )}
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
