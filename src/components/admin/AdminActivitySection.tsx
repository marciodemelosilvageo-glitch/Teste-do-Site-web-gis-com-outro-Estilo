import React, { useState, useMemo } from 'react';
import {
  Activity,
  Search,
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
  CapabilityAuditLog,
  CapabilityAuditAction,
  exportCapabilityAuditLogsToCSV
} from '../../services/adminService';

interface AdminActivitySectionProps {
  logs: ActivityLog[];
  capabilityAuditLogs?: CapabilityAuditLog[];
  userSessions: Record<string, UserSessionConfig>;
  isMaster: boolean;
  onExportCSV: (logsToExport: ActivityLog[]) => void;
  onExportCapabilityAuditCSV?: (logsToExport: CapabilityAuditLog[]) => void;
  onClearLogs?: () => void;
}

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
  userSessions,
  isMaster,
  onExportCSV,
  onExportCapabilityAuditCSV,
  onClearLogs
}) => {
  // Seletor de Modo: Atividades Gerais vs Trilha de Mudança de Poderes
  const [sectionMode, setSectionMode] = useState<'activity' | 'capability_audit'>('activity');

  // Estados de Filtro para Atividades Gerais
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('TODOS');
  const [userFilter, setUserFilter] = useState<string>('TODOS');
  const [periodFilter, setPeriodFilter] = useState<'TODOS' | 'HOJE' | '7DIAS' | '30DIAS'>('TODOS');

  // Estados de Filtro para Trilha de Mudança de Poderes
  const [auditSearchTerm, setAuditSearchTerm] = useState('');
  const [auditTargetFilter, setAuditTargetFilter] = useState<'TODOS' | 'user' | 'base_role' | 'global'>('TODOS');
  const [auditActionFilter, setAuditActionFilter] = useState<string>('TODOS');
  const [auditPeriodFilter, setAuditPeriodFilter] = useState<'TODOS' | 'HOJE' | '7DIAS' | '30DIAS'>('TODOS');

  // Filtragem dos logs de atividade geral
  const filteredLogs = useMemo(() => {
    const now = Date.now();
    const oneDay = 24 * 60 * 60 * 1000;

    return logs.filter(log => {
      // 1. Ocultar dados do master para gerentes (master é 100% anônimo para gerentes)
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
      }

      // 2. Filtro de Categoria
      if (categoryFilter !== 'TODOS' && log.category !== categoryFilter) {
        return false;
      }

      // 3. Filtro de Usuário
      if (userFilter !== 'TODOS' && log.sessionId !== userFilter) {
        return false;
      }

      // 4. Filtro de Período
      if (periodFilter !== 'TODOS') {
        const logTime = new Date(log.timestamp).getTime();
        if (isNaN(logTime)) return true;
        const diff = now - logTime;
        if (periodFilter === 'HOJE' && diff > oneDay) return false;
        if (periodFilter === '7DIAS' && diff > 7 * oneDay) return false;
        if (periodFilter === '30DIAS' && diff > 30 * oneDay) return false;
      }

      // 5. Filtro de Busca
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase();
        const matchAct = (log.action || '').toLowerCase().includes(term);
        const matchDet = (log.details || '').toLowerCase().includes(term);
        const matchUser = (log.sessionId || '').toLowerCase().includes(term);
        if (!matchAct && !matchDet && !matchUser) return false;
      }

      return true;
    });
  }, [logs, isMaster, categoryFilter, userFilter, periodFilter, searchTerm]);

  // Filtragem da Trilha de Mudança de Poderes
  const filteredCapabilityAudit = useMemo(() => {
    const now = Date.now();
    const oneDay = 24 * 60 * 60 * 1000;

    return capabilityAuditLogs.filter(entry => {
      // 1. Ocultar registros do Master para gerentes (Master é imutável e anônimo para terceiros)
      if (!isMaster) {
        const performed = (entry.performedByName || '').toLowerCase();
        const tId = (entry.targetId || '').toLowerCase();
        if (performed.includes('master') && !performed.includes('gerente')) {
          // Permite ver se o alvo for o próprio gerente ou equipe dele, mas oculta se o alvo for outro master
          if (tId === 'master' || tId === 'role:master') return false;
        }
      }

      // 2. Filtro por tipo de alvo
      if (auditTargetFilter !== 'TODOS' && entry.targetType !== auditTargetFilter) {
        return false;
      }

      // 3. Filtro por ação
      if (auditActionFilter !== 'TODOS' && entry.action !== auditActionFilter) {
        return false;
      }

      // 4. Filtro de Período
      if (auditPeriodFilter !== 'TODOS') {
        const entryTime = new Date(entry.timestamp).getTime();
        if (isNaN(entryTime)) return true;
        const diff = now - entryTime;
        if (auditPeriodFilter === 'HOJE' && diff > oneDay) return false;
        if (auditPeriodFilter === '7DIAS' && diff > 7 * oneDay) return false;
        if (auditPeriodFilter === '30DIAS' && diff > 30 * oneDay) return false;
      }

      // 5. Filtro de Busca
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
  }, [capabilityAuditLogs, isMaster, auditTargetFilter, auditActionFilter, auditPeriodFilter, auditSearchTerm]);

  const renderCategoryBadge = (cat: string) => {
    switch (cat) {
      case 'ADMIN':
        return <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-purple-100 text-purple-700 dark:bg-purple-950/80 dark:text-purple-300">ADMIN</span>;
      case 'ACESSO':
        return <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-blue-100 text-blue-700 dark:bg-blue-950/80 dark:text-blue-300">ACESSO</span>;
      case 'BUSCA':
        return <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300">BUSCA</span>;
      case 'FEICAO':
        return <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-teal-100 text-teal-800 dark:bg-teal-950/80 dark:text-teal-300">FEIÇÃO</span>;
      case 'EXPORTACAO':
        return <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300">EXPORTAÇÃO</span>;
      case 'MEDICAO':
        return <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-indigo-100 text-indigo-700 dark:bg-indigo-950/80 dark:text-indigo-300">MEDIÇÃO</span>;
      case 'CAMADA':
        return <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-cyan-100 text-cyan-800 dark:bg-cyan-950/80 dark:text-cyan-300">CAMADA</span>;
      case 'IMPRESSAO':
        return <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-rose-100 text-rose-700 dark:bg-rose-950/80 dark:text-rose-300">IMPRESSÃO</span>;
      default:
        return <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">{cat}</span>;
    }
  };

  const renderAuditActionBadge = (action: CapabilityAuditAction) => {
    switch (action) {
      case 'grant_use':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 border border-emerald-500/20">
            <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
            <span>Conceder Uso</span>
          </span>
        );
      case 'revoke_use':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-100 text-rose-800 dark:bg-rose-950/80 dark:text-rose-300 border border-rose-500/20">
            <Ban className="w-3 h-3 text-rose-600 dark:text-rose-400" />
            <span>Revogar Uso</span>
          </span>
        );
      case 'grant_delegate':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-100 text-blue-800 dark:bg-blue-950/80 dark:text-blue-300 border border-blue-500/20">
            <Crown className="w-3 h-3 text-blue-600 dark:text-blue-400" />
            <span>Conceder Repasse</span>
          </span>
        );
      case 'revoke_delegate':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300 border border-amber-500/20">
            <AlertTriangle className="w-3 h-3 text-amber-600 dark:text-amber-400" />
            <span>Revogar Repasse</span>
          </span>
        );
      case 'set_deny':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-red-100 text-red-800 dark:bg-red-950/80 dark:text-red-300 border border-red-500/20">
            <ShieldAlert className="w-3 h-3 text-red-600 dark:text-red-400" />
            <span>Negado Expressamente</span>
          </span>
        );
      case 'remove_override':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300 border border-slate-500/20">
            <Sliders className="w-3 h-3 text-slate-600 dark:text-slate-400" />
            <span>Remover Exceção</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
            {action}
          </span>
        );
    }
  };

  const renderTargetBadge = (targetType: 'user' | 'base_role' | 'global', targetName?: string) => {
    switch (targetType) {
      case 'base_role':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10.5px] font-semibold bg-purple-50 text-purple-700 dark:bg-purple-950/50 dark:text-purple-300 border border-purple-500/10">
            <ShieldCheck className="w-3 h-3 text-purple-500" />
            <span>{targetName || 'Perfil Base'}</span>
          </span>
        );
      case 'user':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10.5px] font-semibold bg-indigo-50 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300 border border-indigo-500/10">
            <Users className="w-3 h-3 text-indigo-500" />
            <span>{targetName || 'Usuário'}</span>
          </span>
        );
      case 'global':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10.5px] font-semibold bg-sky-50 text-sky-700 dark:bg-sky-950/50 dark:text-sky-300 border border-sky-500/10">
            <Globe className="w-3 h-3 text-sky-500" />
            <span>Global</span>
          </span>
        );
    }
  };

  return (
    <div className="space-y-4 animate-fadeIn">
      {/* Seletor de Modo Segmentado Estilo iOS */}
      <div className="flex items-center gap-1 p-1 bg-black/[0.04] dark:bg-white/[0.06] rounded-xl self-start w-fit">
        <button
          type="button"
          onClick={() => setSectionMode('activity')}
          className={`min-h-[36px] px-3.5 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all flex items-center gap-1.5 ${
            sectionMode === 'activity'
              ? 'bg-white dark:bg-[#2c2c2e] text-slate-900 dark:text-white shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
        >
          <Activity className="w-3.5 h-3.5" />
          <span>Atividades Gerais ({logs.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setSectionMode('capability_audit')}
          className={`min-h-[36px] px-3.5 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all flex items-center gap-1.5 ${
            sectionMode === 'capability_audit'
              ? 'bg-white dark:bg-[#2c2c2e] text-slate-900 dark:text-white shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
        >
          <ShieldCheck className="w-3.5 h-3.5 text-[#007AFF]" />
          <span>Trilha de Mudança de Poderes ({capabilityAuditLogs.length})</span>
        </button>
      </div>

      {sectionMode === 'activity' ? (
        <>
          {/* Barra de Topo: Atividades Gerais */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-2 border-b border-black/[0.04] dark:border-white/[0.06]">
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                Registros de Atividade ({filteredLogs.length} de {logs.length})
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Histórico completo de acessos, eventos espaciais e operações no WebGIS.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onExportCSV(filteredLogs)}
                disabled={filteredLogs.length === 0}
                className="min-h-[40px] px-3.5 py-1.5 rounded-xl bg-[#007AFF] hover:bg-[#0066d6] active:scale-95 text-white text-xs font-semibold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer disabled:opacity-50"
                title="Exportar logs filtrados em arquivo CSV"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Exportar CSV</span>
              </button>

              {isMaster && onClearLogs && (
                <button
                  type="button"
                  onClick={onClearLogs}
                  className="min-h-[40px] px-3 py-1.5 rounded-xl bg-black/[0.03] dark:bg-white/[0.04] hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/40 dark:hover:text-rose-400 text-slate-600 dark:text-slate-400 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                  title="Limpar histórico de atividades"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Limpar</span>
                </button>
              )}
            </div>
          </div>

          {/* Barra de Filtros e Busca de Atividades */}
          <div className="space-y-2.5">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar por ação, detalhes ou usuário..."
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

            {/* Linha de Controles: Categoria e Período */}
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <div className="flex items-center gap-1 overflow-x-auto pb-1 max-w-full">
                <span className="text-[11px] font-semibold text-slate-400 mr-1 shrink-0 flex items-center gap-1">
                  <Filter className="w-3 h-3" /> Categoria:
                </span>
                {['TODOS', 'ACESSO', 'ADMIN', 'BUSCA', 'FEICAO', 'EXPORTACAO', 'MEDICAO'].map(cat => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setCategoryFilter(cat)}
                    className={`min-h-[30px] px-2.5 py-0.5 rounded-lg text-[11px] font-semibold cursor-pointer shrink-0 transition-colors ${
                      categoryFilter === cat
                        ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold'
                        : 'bg-black/[0.03] dark:bg-white/[0.04] text-slate-600 dark:text-slate-400 hover:bg-black/[0.06]'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              <div className="h-4 w-px bg-black/[0.08] dark:bg-white/[0.08] mx-1 hidden sm:block shrink-0" />

              <div className="flex items-center gap-1 overflow-x-auto pb-1">
                <span className="text-[11px] font-semibold text-slate-400 mr-1 shrink-0 flex items-center gap-1">
                  <Calendar className="w-3 h-3" /> Período:
                </span>
                {(['TODOS', 'HOJE', '7DIAS', '30DIAS'] as const).map(p => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPeriodFilter(p)}
                    className={`min-h-[30px] px-2.5 py-0.5 rounded-lg text-[11px] font-semibold cursor-pointer shrink-0 transition-colors ${
                      periodFilter === p
                        ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold'
                        : 'bg-black/[0.03] dark:bg-white/[0.04] text-slate-600 dark:text-slate-400 hover:bg-black/[0.06]'
                    }`}
                  >
                    {p === 'TODOS' ? 'Todos' : p === 'HOJE' ? 'Hoje' : p === '7DIAS' ? '7 dias' : '30 dias'}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Lista de Registros de Atividade Estilo Apple Grouped */}
          <div className="space-y-2">
            {filteredLogs.length === 0 ? (
              <div className="p-8 text-center bg-white dark:bg-[#1c1c1e] rounded-2xl border border-black/[0.05] dark:border-white/[0.06] text-slate-400 space-y-2">
                <Activity className="w-8 h-8 mx-auto text-slate-300 dark:text-slate-600" />
                <p className="text-xs font-semibold">Nenhum evento registrado com os filtros selecionados.</p>
              </div>
            ) : (
              filteredLogs.map(log => {
                const userConf = userSessions[log.sessionId];
                const displayName = userConf?.customName || log.sessionId;

                return (
                  <div
                    key={log.id}
                    className="p-3.5 bg-white dark:bg-[#1c1c1e] rounded-2xl border border-black/[0.05] dark:border-white/[0.06] flex items-center justify-between gap-3 text-xs"
                  >
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-slate-900 dark:text-slate-100">
                          {log.action}
                        </span>
                        {renderCategoryBadge(log.category)}
                      </div>

                      <div className="text-[11px] text-slate-400 dark:text-slate-500 flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-[10px]">{log.formattedDate}</span>
                        <span>• @{displayName}</span>
                        {log.details && (
                          <span className="truncate max-w-xs sm:max-w-md text-slate-600 dark:text-slate-400">
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
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-2 border-b border-black/[0.04] dark:border-white/[0.06]">
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <span>Auditoria de Mudança de Poderes</span>
                <span className="text-xs font-normal text-slate-400">
                  ({filteredCapabilityAudit.length} de {capabilityAuditLogs.length})
                </span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Trilha auditada e imutável de concessões, revogações, repasses e exceções individuais.
              </p>
            </div>

            <div className="flex items-center gap-2">
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
                className="min-h-[40px] px-3.5 py-1.5 rounded-xl bg-[#007AFF] hover:bg-[#0066d6] active:scale-95 text-white text-xs font-semibold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer disabled:opacity-50"
                title="Exportar trilha de mudança de poderes em arquivo CSV"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Exportar CSV</span>
              </button>
            </div>
          </div>

          {/* Barra de Busca e Filtros da Trilha de Poderes */}
          <div className="space-y-2.5">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={auditSearchTerm}
                onChange={(e) => setAuditSearchTerm(e.target.value)}
                placeholder="Buscar por poder, usuário, perfil ou justificativa..."
                className="w-full min-h-[44px] pl-10 pr-4 py-2 rounded-xl bg-white dark:bg-[#1c1c1e] border border-black/[0.06] dark:border-white/[0.08] text-xs sm:text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 outline-none focus:ring-2 focus:ring-[#007AFF]/30 transition-all"
              />
              {auditSearchTerm && (
                <button
                  type="button"
                  onClick={() => setAuditSearchTerm('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer p-1"
                >
                  Limpar
                </button>
              )}
            </div>

            {/* Linha de Filtros: Alvo, Ação e Período */}
            <div className="flex flex-wrap items-center gap-2 text-xs">
              {/* Alvo */}
              <div className="flex items-center gap-1 overflow-x-auto pb-1 max-w-full">
                <span className="text-[11px] font-semibold text-slate-400 mr-1 shrink-0 flex items-center gap-1">
                  <Filter className="w-3 h-3" /> Alvo:
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
                    className={`min-h-[30px] px-2.5 py-0.5 rounded-lg text-[11px] font-semibold cursor-pointer shrink-0 transition-colors ${
                      auditTargetFilter === item.id
                        ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold'
                        : 'bg-black/[0.03] dark:bg-white/[0.04] text-slate-600 dark:text-slate-400 hover:bg-black/[0.06]'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>

              <div className="h-4 w-px bg-black/[0.08] dark:bg-white/[0.08] mx-1 hidden sm:block shrink-0" />

              {/* Ação */}
              <div className="flex items-center gap-1 overflow-x-auto pb-1 max-w-full">
                <span className="text-[11px] font-semibold text-slate-400 mr-1 shrink-0 flex items-center gap-1">
                  <Key className="w-3 h-3" /> Ação:
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
                    className={`min-h-[30px] px-2.5 py-0.5 rounded-lg text-[11px] font-semibold cursor-pointer shrink-0 transition-colors ${
                      auditActionFilter === item.id
                        ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold'
                        : 'bg-black/[0.03] dark:bg-white/[0.04] text-slate-600 dark:text-slate-400 hover:bg-black/[0.06]'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>

              <div className="h-4 w-px bg-black/[0.08] dark:bg-white/[0.08] mx-1 hidden sm:block shrink-0" />

              {/* Período */}
              <div className="flex items-center gap-1 overflow-x-auto pb-1">
                <span className="text-[11px] font-semibold text-slate-400 mr-1 shrink-0 flex items-center gap-1">
                  <Calendar className="w-3 h-3" /> Período:
                </span>
                {(['TODOS', 'HOJE', '7DIAS', '30DIAS'] as const).map(p => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setAuditPeriodFilter(p)}
                    className={`min-h-[30px] px-2.5 py-0.5 rounded-lg text-[11px] font-semibold cursor-pointer shrink-0 transition-colors ${
                      auditPeriodFilter === p
                        ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold'
                        : 'bg-black/[0.03] dark:bg-white/[0.04] text-slate-600 dark:text-slate-400 hover:bg-black/[0.06]'
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
              <div className="p-8 text-center bg-white dark:bg-[#1c1c1e] rounded-2xl border border-black/[0.05] dark:border-white/[0.06] text-slate-400 space-y-2">
                <ShieldCheck className="w-8 h-8 mx-auto text-slate-300 dark:text-slate-600" />
                <p className="text-xs font-semibold">Nenhuma alteração de poderes registrada com os filtros selecionados.</p>
              </div>
            ) : (
              filteredCapabilityAudit.map(entry => {
                const readableCapability = CAPABILITY_LABELS[entry.capabilityKey] || entry.capabilityKey;

                return (
                  <div
                    key={entry.id}
                    className="p-3.5 bg-white dark:bg-[#1c1c1e] rounded-2xl border border-black/[0.05] dark:border-white/[0.06] text-xs space-y-2 transition-all hover:border-black/[0.1] dark:hover:border-white/[0.12]"
                  >
                    {/* Linha Superior: Ação, Alvo e Data */}
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        {renderAuditActionBadge(entry.action)}
                        {renderTargetBadge(entry.targetType, entry.targetName)}
                      </div>

                      <div className="text-[11px] text-slate-400 dark:text-slate-500 font-mono">
                        {entry.formattedDate || new Date(entry.timestamp).toLocaleString('pt-BR')}
                      </div>
                    </div>

                    {/* Linha Principal: Poder afetado e Autor */}
                    <div className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-1 pt-0.5">
                      <div className="space-y-0.5">
                        <div className="font-bold text-slate-900 dark:text-slate-100 text-xs sm:text-sm flex items-center gap-2">
                          <span>{readableCapability}</span>
                          <span className="font-mono text-[10px] text-slate-400 font-normal">
                            ({entry.capabilityKey})
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400">
                          Operação executada por: <strong className="text-slate-700 dark:text-slate-300 font-semibold">{entry.performedByName || 'Sistema'}</strong>
                        </div>
                      </div>

                      {/* Estado: Antes -> Depois */}
                      {(entry.beforeState || entry.afterState) && (
                        <div className="flex items-center gap-1.5 text-[10.5px] font-mono text-slate-500 dark:text-slate-400 bg-black/[0.02] dark:bg-white/[0.03] px-2.5 py-1 rounded-lg border border-black/[0.04] dark:border-white/[0.06]">
                          <span>
                            {entry.beforeState
                              ? (entry.beforeState.can_use !== undefined ? `Uso:${entry.beforeState.can_use ? 'Sim' : 'Não'}` : '') +
                                (entry.beforeState.can_grant !== undefined ? ` Repasse:${entry.beforeState.can_grant ? 'Sim' : 'Não'}` : '')
                              : 'Sem anterior'}
                          </span>
                          <span className="text-slate-400 font-bold">&rarr;</span>
                          <span className="text-[#007AFF] font-bold">
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
                      <div className="pt-1 border-t border-black/[0.03] dark:border-white/[0.04] text-[11px] text-slate-600 dark:text-slate-300 flex items-start gap-1.5">
                        <span className="text-slate-400 italic">Motivo:</span>
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
