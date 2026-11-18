import React, { useState, useMemo } from 'react';
import {
  Activity,
  Search,
  Download,
  Filter,
  Calendar,
  User,
  Trash2,
  Clock,
  ShieldCheck,
  AlertTriangle
} from 'lucide-react';
import { ActivityLog, UserSessionConfig } from '../../services/adminService';

interface AdminActivitySectionProps {
  logs: ActivityLog[];
  userSessions: Record<string, UserSessionConfig>;
  isMaster: boolean;
  onExportCSV: (logsToExport: ActivityLog[]) => void;
  onClearLogs?: () => void;
}

export const AdminActivitySection: React.FC<AdminActivitySectionProps> = ({
  logs,
  userSessions,
  isMaster,
  onExportCSV,
  onClearLogs
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('TODOS');
  const [userFilter, setUserFilter] = useState<string>('TODOS');
  const [periodFilter, setPeriodFilter] = useState<'TODOS' | 'HOJE' | '7DIAS' | '30DIAS'>('TODOS');

  // Lista única de usuários presentes nos logs para o select
  const distinctUsers = useMemo(() => {
    const set = new Set<string>();
    logs.forEach(l => {
      if (l.sessionId) set.add(l.sessionId);
    });
    return Array.from(set);
  }, [logs]);

  // Filtragem dos logs
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

  return (
    <div className="space-y-4 animate-fadeIn">
      {/* Barra de Topo: Título e Ação CSV */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-2 border-b border-black/[0.04] dark:border-white/[0.06]">
        <div>
          <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
            Registros de Auditoria ({filteredLogs.length} de {logs.length})
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Histórico completo de acessos, eventos espaciais e operações administrativas.
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
              title="Limpar histórico de auditoria"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Limpar</span>
            </button>
          )}
        </div>
      </div>

      {/* Barra de Filtros e Busca */}
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

        {/* Linha de Controles: Categoria, Usuário e Período */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {/* Categoria */}
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

          {/* Período */}
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

      {/* Lista de Registros de Auditoria Estilo Apple Grouped */}
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
    </div>
  );
};
