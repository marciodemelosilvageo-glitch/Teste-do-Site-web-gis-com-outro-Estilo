import React, { useMemo } from 'react';
import {
  Users,
  Clock,
  Activity,
  AlertTriangle,
  UserCheck,
  ShieldAlert,
  ArrowRight,
  Plus,
  Download,
  Smartphone
} from 'lucide-react';
import { RegisteredUser, UserSessionConfig, ActivityLog } from '../../services/adminService';
import { AdminSection } from './types';

interface AdminOverviewSectionProps {
  registeredUsers: RegisteredUser[];
  userSessions: Record<string, UserSessionConfig>;
  logs: ActivityLog[];
  isMaster: boolean;
  isManager: boolean;
  canManagerGenerateLogins: boolean;
  onNavigateToSection: (section: AdminSection) => void;
  onOpenCreateUser?: () => void;
  onExportLogsCSV?: () => void;
}

export const AdminOverviewSection: React.FC<AdminOverviewSectionProps> = ({
  registeredUsers,
  userSessions,
  logs,
  canManagerGenerateLogins,
  onNavigateToSection,
  onOpenCreateUser,
  onExportLogsCSV
}) => {
  // 1. Usuários ativos agora (sessões com lastSeen nos últimos 15 min ou logins recentes)
  const activeNowCount = useMemo(() => {
    const fifteenMinAgo = Date.now() - 15 * 60 * 1000;
    const activeSessions = Object.values(userSessions).filter(s => {
      const ts = new Date(s.lastSeen).getTime();
      return !isNaN(ts) && ts >= fifteenMinAgo;
    });
    return Math.max(1, activeSessions.length);
  }, [userSessions]);

  // 2. Total de visitas / acessos acumulados
  const totalVisitsCount = useMemo(() => {
    const sessionList = Object.values(userSessions);
    const sum = sessionList.reduce((acc, s) => acc + (s.loginCount || 1), 0);
    return Math.max(sum, sessionList.length, registeredUsers.length);
  }, [userSessions, registeredUsers]);

  // 3. Usuários bloqueados
  const blockedUsers = useMemo(() => {
    return registeredUsers.filter(u => u.isActive === false);
  }, [registeredUsers]);

  // 4. Usuários com troca obrigatória de senha pendente
  const pendingPasswordUsers = useMemo(() => {
    return registeredUsers.filter(u => u.mustChangePassword === true);
  }, [registeredUsers]);

  // 5. Total de alertas
  const totalAlerts = blockedUsers.length + pendingPasswordUsers.length;

  // 6. Distribuição de perfis
  const profileCounts = useMemo(() => {
    let masters = 0;
    let managers = 0;
    let users = 0;
    registeredUsers.forEach(u => {
      if (u.role === 'master' || (u.role as any) === 'admin') masters++;
      else if (u.role === 'manager') managers++;
      else users++;
    });
    return { masters, managers, users };
  }, [registeredUsers]);

  // 7. Últimas 5 atividades
  const recentLogs = useMemo(() => {
    return logs.slice(0, 5);
  }, [logs]);

  return (
    <div className="space-y-5 animate-fadeIn">
      {/* Cabeçalho da Seção */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-1 border-b border-black/[0.04] dark:border-white/[0.06]">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 tracking-tight">
            Visão Geral
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Resumo do estado da equipe, sessões de visitantes e atividades no WebGIS.
          </p>
        </div>

        {/* Ações Rápidas */}
        <div className="flex items-center gap-2">
          {canManagerGenerateLogins && onOpenCreateUser && (
            <button
              type="button"
              onClick={onOpenCreateUser}
              className="min-h-[36px] px-3.5 py-1.5 rounded-xl bg-[#007AFF] hover:bg-[#0066d6] active:scale-95 text-white text-xs font-semibold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Novo Usuário</span>
            </button>
          )}

          {onExportLogsCSV && (
            <button
              type="button"
              onClick={onExportLogsCSV}
              className="min-h-[36px] px-3 py-1.5 rounded-xl bg-black/[0.04] dark:bg-white/[0.06] hover:bg-black/[0.08] dark:hover:bg-white/[0.1] active:scale-95 text-slate-700 dark:text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
              title="Exportar registros de auditoria em CSV"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Exportar CSV</span>
            </button>
          )}
        </div>
      </div>

      {/* Cartões de Métricas Estilo Apple */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Cartão 1: Ativos Agora */}
        <div className="p-4 bg-white dark:bg-[#1c1c1e] rounded-2xl border border-black/[0.05] dark:border-white/[0.06] shadow-xs">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
            <span className="text-xs font-semibold">Ativos Agora</span>
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          </div>
          <div className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
            {activeNowCount}
          </div>
          <div className="text-[11px] text-slate-400 dark:text-slate-500 mt-1 flex items-center gap-1">
            <Clock className="w-3 h-3" />
            <span>Últimos 15 minutos</span>
          </div>
        </div>

        {/* Cartão 2: Últimos Acessos / Total */}
        <div className="p-4 bg-white dark:bg-[#1c1c1e] rounded-2xl border border-black/[0.05] dark:border-white/[0.06] shadow-xs">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
            <span className="text-xs font-semibold">Acessos Totais</span>
            <Users className="w-4 h-4 text-blue-500" />
          </div>
          <div className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
            {totalVisitsCount}
          </div>
          <div className="text-[11px] text-slate-400 dark:text-slate-500 mt-1 flex items-center gap-1">
            <Smartphone className="w-3 h-3" />
            <span>{Object.keys(userSessions).length} dispositivos únicos</span>
          </div>
        </div>

        {/* Cartão 3: Atividades Registradas */}
        <div className="p-4 bg-white dark:bg-[#1c1c1e] rounded-2xl border border-black/[0.05] dark:border-white/[0.06] shadow-xs">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
            <span className="text-xs font-semibold">Atividades</span>
            <Activity className="w-4 h-4 text-indigo-500" />
          </div>
          <div className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
            {logs.length}
          </div>
          <div className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">
            Eventos auditados
          </div>
        </div>

        {/* Cartão 4: Alertas e Pendências */}
        <div 
          onClick={() => onNavigateToSection('users')}
          className="p-4 bg-white dark:bg-[#1c1c1e] rounded-2xl border border-black/[0.05] dark:border-white/[0.06] shadow-xs cursor-pointer hover:border-black/10 dark:hover:border-white/10 transition-colors group"
        >
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
            <span className="text-xs font-semibold">Alertas</span>
            <AlertTriangle className={`w-4 h-4 ${totalAlerts > 0 ? 'text-amber-500' : 'text-slate-400'}`} />
          </div>
          <div className={`text-2xl font-bold tracking-tight ${totalAlerts > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-slate-900 dark:text-slate-100'}`}>
            {totalAlerts}
          </div>
          <div className="text-[11px] text-slate-400 dark:text-slate-500 mt-1 flex items-center justify-between">
            <span>{totalAlerts === 0 ? 'Tudo regularizado' : 'Ações necessárias'}</span>
            <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
          </div>
        </div>
      </div>

      {/* Se houver alertas, exibir banner de alerta */}
      {totalAlerts > 0 && (
        <div className="p-3.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-200/80 dark:border-amber-900/60 rounded-2xl text-xs flex items-start justify-between gap-3">
          <div className="flex items-start gap-2.5">
            <ShieldAlert className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <span className="font-bold text-amber-900 dark:text-amber-200">
                Atenção da Equipe:
              </span>
              <p className="text-amber-800 dark:text-amber-300">
                {blockedUsers.length > 0 && `${blockedUsers.length} conta(s) com acesso bloqueado. `}
                {pendingPasswordUsers.length > 0 && `${pendingPasswordUsers.length} usuário(s) precisam redefinir a senha no primeiro acesso.`}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onNavigateToSection('users')}
            className="text-xs font-bold text-amber-700 dark:text-amber-400 hover:underline shrink-0 cursor-pointer pt-0.5"
          >
            Verificar
          </button>
        </div>
      )}

      {/* Grid de 2 Colunas: Resumo de Equipe & Atividades Recentes */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Bloco 1: Distribuição da Equipe */}
        <div className="bg-white dark:bg-[#1c1c1e] rounded-2xl border border-black/[0.05] dark:border-white/[0.06] p-4 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Distribuição de Usuários
            </h3>
            <button
              type="button"
              onClick={() => onNavigateToSection('users')}
              className="text-xs font-semibold text-[#007AFF] hover:underline cursor-pointer flex items-center gap-0.5"
            >
              <span>Gerenciar</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div className="p-3 bg-black/[0.02] dark:bg-white/[0.02] rounded-xl text-center">
              <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">Master</div>
              <div className="text-lg font-bold text-slate-900 dark:text-slate-100 mt-0.5">{profileCounts.masters}</div>
            </div>
            <div className="p-3 bg-black/[0.02] dark:bg-white/[0.02] rounded-xl text-center">
              <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">Gerentes</div>
              <div className="text-lg font-bold text-slate-900 dark:text-slate-100 mt-0.5">{profileCounts.managers}</div>
            </div>
            <div className="p-3 bg-black/[0.02] dark:bg-white/[0.02] rounded-xl text-center">
              <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">Comuns</div>
              <div className="text-lg font-bold text-slate-900 dark:text-slate-100 mt-0.5">{profileCounts.users}</div>
            </div>
          </div>

          <div className="text-[11px] text-slate-400 dark:text-slate-500 pt-1 flex items-center justify-between border-t border-black/[0.04] dark:border-white/[0.04]">
            <span>Total de contas cadastradas:</span>
            <span className="font-bold text-slate-700 dark:text-slate-300">{registeredUsers.length}</span>
          </div>
        </div>

        {/* Bloco 2: Atividades Recentes */}
        <div className="bg-white dark:bg-[#1c1c1e] rounded-2xl border border-black/[0.05] dark:border-white/[0.06] p-4 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Atividade Recente
            </h3>
            <button
              type="button"
              onClick={() => onNavigateToSection('activity')}
              className="text-xs font-semibold text-[#007AFF] hover:underline cursor-pointer flex items-center gap-0.5"
            >
              <span>Ver todas</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>

          {recentLogs.length === 0 ? (
            <div className="py-6 text-center text-xs text-slate-400 dark:text-slate-500">
              Nenhuma atividade registrada até o momento.
            </div>
          ) : (
            <div className="space-y-2">
              {recentLogs.map((log) => (
                <div
                  key={log.id}
                  className="p-2.5 bg-black/[0.02] dark:bg-white/[0.02] rounded-xl flex items-center justify-between gap-3 text-xs"
                >
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-slate-800 dark:text-slate-200 truncate">
                      {log.action}
                    </div>
                    <div className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5 flex items-center gap-2">
                      <span>{log.formattedDate}</span>
                      {log.details && <span className="truncate">• {log.details}</span>}
                    </div>
                  </div>
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-slate-200/80 dark:bg-slate-800 text-slate-600 dark:text-slate-300 shrink-0">
                    {log.category}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
