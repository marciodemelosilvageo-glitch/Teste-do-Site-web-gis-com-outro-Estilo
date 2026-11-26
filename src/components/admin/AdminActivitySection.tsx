import React, { useState, useMemo } from 'react';
import {
  Activity,
  Download,
  Filter,
  Calendar,
  Trash2,
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  CheckCircle2,
  Ban,
  Crown,
  Sliders,
  Key,
  Users,
  Globe
} from 'lucide-react';
import {
  ActivityLog,
  UserSessionConfig,
  RegisteredUser,
  CapabilityAuditLog,
  CapabilityAuditAction,
  exportCapabilityAuditLogsToCSV
} from '../../services/adminService';
import { filterVisibleActivityLogs } from './AdminOverviewSection';
import {
  SegmentedControl,
  SearchField,
  Badge
} from './ui';

interface AdminActivitySectionProps {
  logs: ActivityLog[];
  capabilityAuditLogs?: CapabilityAuditLog[];
  registeredUsers?: RegisteredUser[];
  userSessions: Record<string, UserSessionConfig>;
  isMaster: boolean;
  canExportLogs?: boolean;
  onExportCSV: (logsToExport: ActivityLog[]) => void;
  onExportCapabilityAuditCSV?: (logsToExport: CapabilityAuditLog[]) => void;
  onClearLogs?: () => void;
}

export const filterVisibleCapabilityAuditLogs = (
  entries: CapabilityAuditLog[],
  isMaster: boolean,
  registeredUsers: RegisteredUser[] = [],
  userSessions: Record<string, UserSessionConfig> = {}
): CapabilityAuditLog[] => {
  if (isMaster) return entries;

  const masterIds = new Set<string>();
  const masterUsernames = new Set<string>();
  const teamUsernames = new Set<string>();
  const teamIds = new Set<string>();

  registeredUsers.forEach((u) => {
    const r = (u.role || '').toLowerCase();
    if (r === 'master' || r === 'admin') {
      if (u.id) masterIds.add(u.id);
      if (u.username) masterUsernames.add(u.username.toLowerCase());
    } else {
      if (u.id) teamIds.add(u.id);
      if (u.username) teamUsernames.add(u.username.toLowerCase());
    }
  });

  Object.values(userSessions).forEach((s) => {
    const r = ((s.role as string) || '').toLowerCase();
    if (r === 'master' || r === 'admin') {
      if (s.authUid) masterIds.add(s.authUid);
    }
  });

  return entries
    .filter((entry) => {
      const tId = (entry.targetId || '').toLowerCase();
      if (
        tId === 'master' ||
        tId === 'role:master' ||
        tId === 'admin' ||
        tId === 'role:admin' ||
        masterIds.has(entry.targetId) ||
        masterUsernames.has(tId)
      ) {
        return false;
      }

      const performedByMaster =
        (entry.performedBy ? masterIds.has(entry.performedBy) : false) ||
        (entry.performedByName || '').toLowerCase().includes('master');

      if (performedByMaster) {
        if (entry.targetType !== 'user') return false;
        if (registeredUsers.length > 0 && !teamIds.has(entry.targetId) && !teamUsernames.has(tId)) {
          return false;
        }
      }

      return true;
    })
    .map((entry) => {
      const performedByMaster =
        (entry.performedBy ? masterIds.has(entry.performedBy) : false) ||
        (entry.performedByName || '').toLowerCase().includes('master');
      if (!performedByMaster) return entry;
      return {
        ...entry,
        performedBy: undefined,
        performedByName: 'Alteração de permissão'
      };
    });
};

const CAPABILITY_LABELS: Record<string, string> = {
  'tool:cnefe_search': 'Busca CNEFE de Endereços',
  'tool:measure': 'Ferramenta de Medição',
  'tool:print_a4': 'Impressão de Mapa em A4',
  'tool:layer_panel': 'Painel de Camadas',
  'tool:raio_x': 'Painel Raio-X Territorial',
  'tool:selected_features': 'Painel de Feições Selecionadas',
  'tool:feature_specs': 'Detalhes Técnicos da Feição',
  'tool:sources_footer': 'Rodapé de Fontes e Dados',
  'tool:search_active_layers_only': 'Buscar Apenas em Camadas Ativas',
  'tool:dissolve_features': 'Dissolver Feições Poligonais',
  'tool:multi_select': 'Multiseleção de Áreas no Mapa',
  'tool:search_by_type': 'Buscar por Categoria / Tipo',
  'tool:search_area_addresses': 'Buscar Endereços na Área',
  'tool:customize_useful_info': 'Personalizar Informações Úteis',
  'tool:basemap_selector': 'Seletor de Mapa Base',
  'tool:map_legend': 'Legenda de Camadas',
  'tool:export_data': 'Exportação Geral de Dados',
  'data:export:csv': 'Exportar Planilha (CSV)',
  'data:export:kml': 'Exportar Google Earth (KML)',
  'data:export:kmz': 'Exportar Google Earth Compactado (KMZ)',
  'data:export:geojson': 'Exportar GeoJSON',
  'data:export:shapefile': 'Exportar Shapefile (ZIP)',
  'data:export:geopackage': 'Exportar GeoPackage (GPKG)',
  'admin:panel:access': 'Acesso ao Painel de Controle',
  'admin:users:view': 'Visualizar Usuários e Equipe',
  'admin:users:create': 'Criar Novos Usuários',
  'admin:users:reset_password': 'Redefinir Senhas de Usuários',
  'admin:users:block': 'Bloquear / Desbloquear Usuários',
  'admin:users:delete': 'Excluir Usuários',
  'admin:users:promote_manager': 'Promover Usuário a Gerente',
  'admin:capabilities:manage': 'Gerenciar Catálogo e Exceções de Poderes',
  'admin:logs:view': 'Visualizar Trilha de Auditoria',
  'admin:logs:export': 'Exportar Trilha de Auditoria'
};

export const AdminActivitySection: React.FC<AdminActivitySectionProps> = ({
  logs,
  capabilityAuditLogs = [],
  registeredUsers = [],
  userSessions,
  isMaster,
  canExportLogs = true,
  onExportCSV,
  onExportCapabilityAuditCSV,
  onClearLogs
}) => {
  // Seletor de Modo: Atividades Gerais vs Trilha de Mudança de Poderes
  const [sectionMode, setSectionMode] = useState<'activity' | 'capability_audit'>('activity');

  // Estados de Filtro para Atividades Gerais
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('TODOS');
  const [userFilter] = useState<string>('TODOS');
  const [periodFilter, setPeriodFilter] = useState<'TODOS' | 'HOJE' | '7DIAS' | '30DIAS'>('TODOS');

  // Estados de Filtro para Trilha de Mudança de Poderes
  const [auditSearchTerm, setAuditSearchTerm] = useState('');
  const [auditTargetFilter, setAuditTargetFilter] = useState<'TODOS' | 'user' | 'base_role' | 'global'>('TODOS');
  const [auditActionFilter, setAuditActionFilter] = useState<string>('TODOS');
  const [auditPeriodFilter, setAuditPeriodFilter] = useState<'TODOS' | 'HOJE' | '7DIAS' | '30DIAS'>('TODOS');

  const baseVisibleLogs = useMemo(
    () => filterVisibleActivityLogs(logs, isMaster, registeredUsers, userSessions),
    [logs, isMaster, registeredUsers, userSessions]
  );

  const baseVisibleAuditLogs = useMemo(
    () => filterVisibleCapabilityAuditLogs(capabilityAuditLogs, isMaster, registeredUsers, userSessions),
    [capabilityAuditLogs, isMaster, registeredUsers, userSessions]
  );

  // Filtragem dos logs de atividade geral
  const filteredLogs = useMemo(() => {
    const now = Date.now();
    const oneDay = 24 * 60 * 60 * 1000;

    return baseVisibleLogs.filter(log => {
      // 1. Filtro de Categoria
      if (categoryFilter !== 'TODOS' && log.category !== categoryFilter) {
        return false;
      }

      // 2. Filtro de Usuário
      if (userFilter !== 'TODOS' && log.sessionId !== userFilter) {
        return false;
      }

      // 3. Filtro de Período
      if (periodFilter !== 'TODOS') {
        const logTime = new Date(log.timestamp).getTime();
        if (isNaN(logTime)) return true;
        const diff = now - logTime;
        if (periodFilter === 'HOJE' && diff > oneDay) return false;
        if (periodFilter === '7DIAS' && diff > 7 * oneDay) return false;
        if (periodFilter === '30DIAS' && diff > 30 * oneDay) return false;
      }

      // 4. Filtro de Busca
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase();
        const matchAct = (log.action || '').toLowerCase().includes(term);
        const matchDet = (log.details || '').toLowerCase().includes(term);
        const matchUser = (log.sessionId || '').toLowerCase().includes(term);
        if (!matchAct && !matchDet && !matchUser) return false;
      }

      return true;
    });
  }, [baseVisibleLogs, categoryFilter, userFilter, periodFilter, searchTerm]);

  // Filtragem da Trilha de Mudança de Poderes
  const filteredCapabilityAudit = useMemo(() => {
    const now = Date.now();
    const oneDay = 24 * 60 * 60 * 1000;

    return baseVisibleAuditLogs.filter(entry => {
      // 1. Filtro por tipo de alvo
      if (auditTargetFilter !== 'TODOS' && entry.targetType !== auditTargetFilter) {
        return false;
      }

      // 2. Filtro por ação
      if (auditActionFilter !== 'TODOS' && entry.action !== auditActionFilter) {
        return false;
      }

      // 3. Filtro de Período
      if (auditPeriodFilter !== 'TODOS') {
        const entryTime = new Date(entry.timestamp).getTime();
        if (isNaN(entryTime)) return true;
        const diff = now - entryTime;
        if (auditPeriodFilter === 'HOJE' && diff > oneDay) return false;
        if (auditPeriodFilter === '7DIAS' && diff > 7 * oneDay) return false;
        if (auditPeriodFilter === '30DIAS' && diff > 30 * oneDay) return false;
      }

      // 4. Filtro de Busca
      if (auditSearchTerm.trim()) {
        const term = auditSearchTerm.toLowerCase();
        const capLabel = (CAPABILITY_LABELS[entry.capabilityKey] || '').toLowerCase();
        const capKey = (entry.capabilityKey || '').toLowerCase();
        const target = (entry.targetName || entry.targetId || '').toLowerCase();
        const who = (entry.performedByName || '').toLowerCase();
        const reason = (entry.reason || '').toLowerCase();
        if (
          !capLabel.includes(term) &&
          !capKey.includes(term) &&
          !target.includes(term) &&
          !who.includes(term) &&
          !reason.includes(term)
        ) {
          return false;
        }
      }

      return true;
    });
  }, [baseVisibleAuditLogs, auditTargetFilter, auditActionFilter, auditPeriodFilter, auditSearchTerm]);

  const renderCategoryBadge = (cat: string) => {
    return <Badge>{cat}</Badge>;
  };

  const renderAuditActionBadge = (action: CapabilityAuditAction) => {
    switch (action) {
      case 'grant_use':
        return (
          <Badge variant="accent" icon={CheckCircle2}>
            Conceder Uso
          </Badge>
        );
      case 'revoke_use':
        return (
          <Badge icon={Ban}>
            Revogar Uso
          </Badge>
        );
      case 'grant_delegate':
        return (
          <Badge variant="accent" icon={Crown}>
            Conceder Repasse
          </Badge>
        );
      case 'revoke_delegate':
        return (
          <Badge icon={AlertTriangle}>
            Revogar Repasse
          </Badge>
        );
      case 'set_deny':
        return (
          <Badge variant="destructive" icon={ShieldAlert}>
            Negado Expressamente
          </Badge>
        );
      case 'remove_override':
        return (
          <Badge icon={Sliders}>
            Remover Exceção
          </Badge>
        );
      default:
        return (
          <Badge>
            {action}
          </Badge>
        );
    }
  };

  const renderTargetBadge = (targetType: 'user' | 'base_role' | 'global', targetName?: string) => {
    switch (targetType) {
      case 'base_role':
        return (
          <Badge icon={ShieldCheck}>
            {targetName || 'Perfil Base'}
          </Badge>
        );
      case 'user':
        return (
          <Badge icon={Users}>
            {targetName || 'Usuário'}
          </Badge>
        );
      case 'global':
        return (
          <Badge icon={Globe}>
            Global
          </Badge>
        );
    }
  };

  return (
    <div className="space-y-4">
      {/* Seletor de Modo Segmentado Estilo iOS */}
      <div className="w-full sm:w-auto">
        <SegmentedControl
          value={sectionMode}
          onChange={(val) => setSectionMode(val as 'activity' | 'capability_audit')}
          options={[
            {
              id: 'activity',
              label: 'Atividades Gerais',
              count: baseVisibleLogs.length,
              icon: Activity
            },
            {
              id: 'capability_audit',
              label: 'Trilha de Poderes',
              count: baseVisibleAuditLogs.length,
              icon: ShieldCheck
            }
          ]}
        />
      </div>

      {sectionMode === 'activity' ? (
        <>
          {/* Barra de Topo: Atividades Gerais */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-black/[0.08] dark:border-white/[0.08]">
            <div>
              <h2 className="text-[17px] font-semibold text-slate-900 dark:text-white">
                Registros de Atividade ({filteredLogs.length} de {baseVisibleLogs.length})
              </h2>
              <p className="text-xs text-[#6C6C70] dark:text-[#98989D] mt-0.5">
                Histórico completo de acessos, eventos espaciais e operações no WebGIS.
              </p>
            </div>

            <div className="flex items-center gap-2">
              {(isMaster || canExportLogs) && (
                <button
                  type="button"
                  onClick={() => onExportCSV(filteredLogs)}
                  disabled={filteredLogs.length === 0}
                  className="min-h-[44px] px-4 py-2 rounded-xl bg-[#007AFF] hover:bg-[#007AFF]/90 active:scale-95 text-white text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-40"
                  title="Exportar logs filtrados em arquivo CSV"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Exportar CSV</span>
                </button>
              )}

              {isMaster && onClearLogs && (
                <button
                  type="button"
                  onClick={onClearLogs}
                  className="min-h-[44px] px-3.5 py-2 rounded-xl bg-black/[0.04] dark:bg-white/[0.06] hover:bg-black/[0.08] dark:hover:bg-white/[0.1] text-[#FF3B30] text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                  title="Limpar histórico de atividades"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Limpar</span>
                </button>
              )}
            </div>
          </div>

          {/* Barra de Filtros e Busca de Atividades */}
          <div className="space-y-3">
            <SearchField
              value={searchTerm}
              onChange={setSearchTerm}
              onClear={() => setSearchTerm('')}
              placeholder="Buscar por ação, detalhes ou usuário..."
            />

            {/* Linha de Controles: Categoria e Período */}
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <div className="flex items-center gap-1 overflow-x-auto pb-1 max-w-full">
                <span className="text-xs font-semibold text-[#6C6C70] dark:text-[#98989D] mr-1 shrink-0 flex items-center gap-1">
                  <Filter className="w-3.5 h-3.5" /> Categoria:
                </span>
                {['TODOS', 'ACESSO', 'ADMIN', 'BUSCA', 'FEICAO', 'EXPORTACAO', 'MEDICAO'].map(cat => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setCategoryFilter(cat)}
                    className={`min-h-[32px] px-3 py-1 rounded-full text-xs font-semibold cursor-pointer shrink-0 transition-colors ${
                      categoryFilter === cat
                        ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900'
                        : 'bg-black/[0.04] dark:bg-white/[0.06] text-[#6C6C70] dark:text-[#98989D] hover:bg-black/[0.08] dark:hover:bg-white/[0.1]'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              <div className="h-4 w-px bg-black/[0.08] dark:bg-white/[0.08] mx-1 hidden sm:block shrink-0" />

              <div className="flex items-center gap-1 overflow-x-auto pb-1">
                <span className="text-xs font-semibold text-[#6C6C70] dark:text-[#98989D] mr-1 shrink-0 flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5" /> Período:
                </span>
                {(['TODOS', 'HOJE', '7DIAS', '30DIAS'] as const).map(p => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPeriodFilter(p)}
                    className={`min-h-[32px] px-3 py-1 rounded-full text-xs font-semibold cursor-pointer shrink-0 transition-colors ${
                      periodFilter === p
                        ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900'
                        : 'bg-black/[0.04] dark:bg-white/[0.06] text-[#6C6C70] dark:text-[#98989D] hover:bg-black/[0.08] dark:hover:bg-white/[0.1]'
                    }`}
                  >
                    {p === 'TODOS' ? 'Todos' : p === 'HOJE' ? 'Hoje' : p === '7DIAS' ? '7 dias' : '30 dias'}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Lista de Registros de Atividade Estilo Apple Inset Grouped */}
          <div className="space-y-2">
            {filteredLogs.length === 0 ? (
              <div className="p-8 text-center bg-white dark:bg-[#1C1C1E] rounded-2xl border border-black/[0.08] dark:border-white/[0.08] text-[#6C6C70] dark:text-[#98989D] space-y-2">
                <Activity className="w-8 h-8 mx-auto text-[#8E8E93]" />
                <p className="text-xs font-semibold">Nenhum evento registrado com os filtros selecionados.</p>
              </div>
            ) : (
              filteredLogs.map(log => {
                const userConf = userSessions[log.sessionId];
                const displayName = userConf?.customName || log.sessionId;

                return (
                  <div
                    key={log.id}
                    className="p-3.5 bg-white dark:bg-[#1C1C1E] rounded-2xl border border-black/[0.08] dark:border-white/[0.08] flex items-center justify-between gap-3 text-xs"
                  >
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-slate-900 dark:text-white">
                          {log.action}
                        </span>
                        {renderCategoryBadge(log.category)}
                        {log.actorId && (
                          <Badge variant="neutral">
                            {userConf?.isAnonymous ? 'Visitante' : isMaster && log.userRole === 'master' ? 'Master' : log.userRole === 'manager' ? 'Gerente' : 'Conta'}
                          </Badge>
                        )}
                      </div>

                      <div className="text-xs text-[#6C6C70] dark:text-[#98989D] flex items-center gap-2 flex-wrap">
                        <span className="font-mono">{log.formattedDate}</span>
                        <span>• @{displayName}</span>
                        {log.details && (
                          <span className="truncate max-w-xs sm:max-w-md text-slate-700 dark:text-slate-300">
                            • {log.details}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </>
      ) : (
        <>
          {/* Barra de Topo: Trilha de Mudança de Poderes */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-black/[0.08] dark:border-white/[0.08]">
            <div>
              <h2 className="text-[17px] font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                <span>Auditoria de Mudança de Poderes</span>
                <span className="text-xs font-normal text-[#6C6C70] dark:text-[#98989D]">
                  ({filteredCapabilityAudit.length} de {baseVisibleAuditLogs.length})
                </span>
              </h2>
              <p className="text-xs text-[#6C6C70] dark:text-[#98989D] mt-0.5">
                Trilha auditada e imutável de concessões, revogações, repasses e exceções individuais.
              </p>
            </div>

            <div className="flex items-center gap-2">
              {(isMaster || canExportLogs) && (
                <button
                  type="button"
                  onClick={() => {
                    if (onExportCapabilityAuditCSV) {
                      onExportCapabilityAuditCSV(filteredCapabilityAudit);
                    } else {
                      exportCapabilityAuditLogsToCSV(filteredCapabilityAudit);
                    }
                  }}
                  disabled={filteredCapabilityAudit.length === 0}
                  className="min-h-[44px] px-4 py-2 rounded-xl bg-[#007AFF] hover:bg-[#007AFF]/90 active:scale-95 text-white text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-40"
                  title="Exportar trilha de mudança de poderes em arquivo CSV"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Exportar CSV</span>
                </button>
              )}
            </div>
          </div>

          {/* Barra de Busca e Filtros da Trilha de Poderes */}
          <div className="space-y-3">
            <SearchField
              value={auditSearchTerm}
              onChange={setAuditSearchTerm}
              onClear={() => setAuditSearchTerm('')}
              placeholder="Buscar por poder, usuário, perfil ou justificativa..."
            />

            {/* Linha de Filtros: Alvo, Ação e Período */}
            <div className="flex flex-wrap items-center gap-2 text-xs">
              {/* Alvo */}
              <div className="flex items-center gap-1 overflow-x-auto pb-1 max-w-full">
                <span className="text-xs font-semibold text-[#6C6C70] dark:text-[#98989D] mr-1 shrink-0 flex items-center gap-1">
                  <Filter className="w-3.5 h-3.5" /> Alvo:
                </span>
                {[
                  { id: 'TODOS', label: 'Todos' },
                  { id: 'base_role', label: 'Perfis Base' },
                  { id: 'user', label: 'Usuários' },
                  { id: 'global', label: 'Global' }
                ].map(item => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setAuditTargetFilter(item.id as any)}
                    className={`min-h-[32px] px-3 py-1 rounded-full text-xs font-semibold cursor-pointer shrink-0 transition-colors ${
                      auditTargetFilter === item.id
                        ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900'
                        : 'bg-black/[0.04] dark:bg-white/[0.06] text-[#6C6C70] dark:text-[#98989D] hover:bg-black/[0.08] dark:hover:bg-white/[0.1]'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>

              <div className="h-4 w-px bg-black/[0.08] dark:bg-white/[0.08] mx-1 hidden sm:block shrink-0" />

              {/* Ação */}
              <div className="flex items-center gap-1 overflow-x-auto pb-1 max-w-full">
                <span className="text-xs font-semibold text-[#6C6C70] dark:text-[#98989D] mr-1 shrink-0 flex items-center gap-1">
                  <Key className="w-3.5 h-3.5" /> Ação:
                </span>
                {[
                  { id: 'TODOS', label: 'Todas' },
                  { id: 'grant_use', label: 'Uso (+)' },
                  { id: 'revoke_use', label: 'Uso (-)' },
                  { id: 'grant_delegate', label: 'Repasse (+)' },
                  { id: 'revoke_delegate', label: 'Repasse (-)' },
                  { id: 'set_deny', label: 'Negado' },
                  { id: 'remove_override', label: 'Padrão' }
                ].map(item => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setAuditActionFilter(item.id)}
                    className={`min-h-[32px] px-3 py-1 rounded-full text-xs font-semibold cursor-pointer shrink-0 transition-colors ${
                      auditActionFilter === item.id
                        ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900'
                        : 'bg-black/[0.04] dark:bg-white/[0.06] text-[#6C6C70] dark:text-[#98989D] hover:bg-black/[0.08] dark:hover:bg-white/[0.1]'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>

              <div className="h-4 w-px bg-black/[0.08] dark:bg-white/[0.08] mx-1 hidden sm:block shrink-0" />

              {/* Período */}
              <div className="flex items-center gap-1 overflow-x-auto pb-1">
                <span className="text-xs font-semibold text-[#6C6C70] dark:text-[#98989D] mr-1 shrink-0 flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5" /> Período:
                </span>
                {(['TODOS', 'HOJE', '7DIAS', '30DIAS'] as const).map(p => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setAuditPeriodFilter(p)}
                    className={`min-h-[32px] px-3 py-1 rounded-full text-xs font-semibold cursor-pointer shrink-0 transition-colors ${
                      auditPeriodFilter === p
                        ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900'
                        : 'bg-black/[0.04] dark:bg-white/[0.06] text-[#6C6C70] dark:text-[#98989D] hover:bg-black/[0.08] dark:hover:bg-white/[0.1]'
                    }`}
                  >
                    {p === 'TODOS' ? 'Todos' : p === 'HOJE' ? 'Hoje' : p === '7DIAS' ? '7 dias' : '30 dias'}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Lista de Registros da Trilha de Poderes Estilo Apple */}
          <div className="space-y-2.5">
            {filteredCapabilityAudit.length === 0 ? (
              <div className="p-8 text-center bg-white dark:bg-[#1C1C1E] rounded-2xl border border-black/[0.08] dark:border-white/[0.08] text-[#6C6C70] dark:text-[#98989D] space-y-2">
                <ShieldCheck className="w-8 h-8 mx-auto text-[#8E8E93]" />
                <p className="text-xs font-semibold">Nenhuma alteração de poderes registrada com os filtros selecionados.</p>
              </div>
            ) : (
              filteredCapabilityAudit.map(entry => {
                const readableCapability = CAPABILITY_LABELS[entry.capabilityKey] || entry.capabilityKey;

                return (
                  <div
                    key={entry.id}
                    className="p-3.5 bg-white dark:bg-[#1C1C1E] rounded-2xl border border-black/[0.08] dark:border-white/[0.08] text-xs space-y-2 transition-all"
                  >
                    {/* Linha Superior: Ação, Alvo e Data */}
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        {renderAuditActionBadge(entry.action)}
                        {renderTargetBadge(entry.targetType, entry.targetName)}
                      </div>

                      <div className="text-xs text-[#6C6C70] dark:text-[#98989D] font-mono">
                        {entry.formattedDate || new Date(entry.timestamp).toLocaleString('pt-BR')}
                      </div>
                    </div>

                    {/* Linha Principal: Poder afetado e Autor */}
                    <div className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-1 pt-0.5">
                      <div className="space-y-0.5">
                        <div className="font-semibold text-slate-900 dark:text-white text-xs sm:text-sm flex items-center gap-2">
                          <span>{readableCapability}</span>
                          <span className="font-mono text-xs text-[#6C6C70] dark:text-[#98989D] font-normal">
                            ({entry.capabilityKey})
                          </span>
                        </div>
                        <div className="text-xs text-[#6C6C70] dark:text-[#98989D]">
                          {entry.performedByName && entry.performedByName !== 'Alteração de permissão' ? (
                            <>
                              Operação executada por:{' '}
                              <strong className="text-slate-900 dark:text-white font-semibold">
                                {entry.performedByName}
                              </strong>
                            </>
                          ) : (
                            <span>Alteração de permissão</span>
                          )}
                        </div>
                      </div>

                      {/* Estado: Antes -> Depois */}
                      {(entry.beforeState || entry.afterState) && (
                        <div className="flex items-center gap-1.5 text-xs font-mono text-[#6C6C70] dark:text-[#98989D] bg-black/[0.03] dark:bg-white/[0.04] px-2.5 py-1 rounded-lg border border-black/[0.06] dark:border-white/[0.08]">
                          <span>
                            {entry.beforeState
                              ? (entry.beforeState.can_use !== undefined ? `Uso:${entry.beforeState.can_use ? 'Sim' : 'Não'}` : '') +
                                (entry.beforeState.can_grant !== undefined ? ` Repasse:${entry.beforeState.can_grant ? 'Sim' : 'Não'}` : '')
                              : 'Sem anterior'}
                          </span>
                          <span className="text-[#8E8E93] font-semibold">&rarr;</span>
                          <span className="text-[#007AFF] dark:text-[#0A84FF] font-semibold">
                            {entry.afterState
                              ? (entry.afterState.can_use !== undefined ? `Uso:${entry.afterState.can_use ? 'Sim' : 'Não'}` : '') +
                                (entry.afterState.can_grant !== undefined ? ` Repasse:${entry.afterState.can_grant ? 'Sim' : 'Não'}` : '') +
                                (entry.afterState.is_denied ? ' [Negado]' : '')
                              : 'Padrão'}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Justificativa / Motivo */}
                    {entry.reason && (
                      <div className="pt-1.5 border-t border-black/[0.06] dark:border-white/[0.08] text-xs text-[#6C6C70] dark:text-[#98989D] flex items-start gap-1.5">
                        <span className="italic">Motivo:</span>
                        <span>{entry.reason}</span>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </>
      )}
    </div>
  );
};
