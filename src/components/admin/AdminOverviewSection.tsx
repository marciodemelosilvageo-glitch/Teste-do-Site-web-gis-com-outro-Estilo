import React, { useMemo } from 'react';
import {
  Users,
  Clock,
  Activity,
  AlertTriangle,
  ArrowRight,
  Plus,
  Download,
  Smartphone,
  ShieldAlert
} from 'lucide-react';
import { RegisteredUser, UserSessionConfig, ActivityLog } from '../../services/adminService';
import { AdminSection } from './types';
import { AdminCard, StatusDot, Banner, Badge } from './ui';

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

export const filterVisibleActivityLogs = (
  logs: ActivityLog[],
  isMaster: boolean,
  registeredUsers: RegisteredUser[] = [],
  userSessions: Record<string, UserSessionConfig> = {}
): ActivityLog[] => {
  if (isMaster) return logs;

  const masterIds = new Set<string>();
  const masterUsernames = new Set<string>();

  registeredUsers.forEach((u) => {
    const r = (u.role || '').toLowerCase();
    if (r === 'master' || r === 'admin') {
      if (u.id) masterIds.add(u.id);
      if (u.username) masterUsernames.add(u.username.toLowerCase());
    }
  });

  Object.values(userSessions).forEach((s) => {
    const r = ((s.role as string) || '').toLowerCase();
    if (r === 'master' || r === 'admin') {
      if (s.authUid) masterIds.add(s.authUid);
      if (s.sessionId) masterIds.add(s.sessionId);
    }
  });

  return logs.filter((log) => {
    const role = (log.userRole || '').toLowerCase();
    if (role === 'master' || role === 'admin') return false;
    if (log.actorId && masterIds.has(log.actorId)) return false;
    if (log.sessionId && (masterIds.has(log.sessionId) || masterUsernames.has(log.sessionId.toLowerCase()))) return false;
    return true;
  });
};

export const AdminOverviewSection: React.FC<AdminOverviewSectionProps> = ({
  registeredUsers,
  userSessions,
  logs,
  isMaster,
  canManagerGenerateLogins,
  onNavigateToSection,
  onOpenCreateUser,
  onExportLogsCSV
}) => {
  const visibleUsers = useMemo(() => {
    if (isMaster) return registeredUsers;
    return registeredUsers.filter((u) => {
      const r = (u.role || '').toLowerCase();
      return r !== 'master' && r !== 'admin';
    });
  }, [registeredUsers, isMaster]);

  const visibleSessionsList = useMemo(() => {
    const all = Object.values(userSessions);
    if (isMaster) return all;
    const masterIds = new Set(
      registeredUsers
        .filter((u) => {
          const r = (u.role || '').toLowerCase();
          return r === 'master' || r === 'admin';
        })
        .map((u) => u.id)
    );
    return all.filter((s) => {
      const r = ((s.role as string) || '').toLowerCase();
      if (r === 'master' || r === 'admin') return false;
      if (s.authUid && masterIds.has(s.authUid)) return false;
      return true;
    });
  }, [userSessions, registeredUsers, isMaster]);

  const visibleLogs = useMemo(() => {
    return filterVisibleActivityLogs(logs, isMaster, registeredUsers, userSessions);
  }, [logs, isMaster, registeredUsers, userSessions]);

  // 1. Usuários ativos agora (telemetria confiável do servidor: isOnline === true ou sinal nos últimos 3 min)
  const activeNowCount = useMemo(() => {
    const threeMinAgo = Date.now() - 3 * 60 * 1000;
    const activeSessions = visibleSessionsList.filter(s => {
      if (s.isOnline !== undefined) return s.isOnline;
      const ts = new Date(s.lastSeen).getTime();
      return !isNaN(ts) && ts >= threeMinAgo;
    });
    return Math.max(1, activeSessions.length);
  }, [visibleSessionsList]);

  // 2. Total de visitas / acessos acumulados
  const totalVisitsCount = useMemo(() => {
    const sum = visibleSessionsList.reduce((acc, s) => acc + (s.loginCount || 1), 0);
    return Math.max(sum, visibleSessionsList.length, visibleUsers.length);
  }, [visibleSessionsList, visibleUsers]);

  // 3. Usuários bloqueados
  const blockedUsers = useMemo(() => {
    return visibleUsers.filter(u => u.isActive === false);
  }, [visibleUsers]);

  // 4. Usuários com troca obrigatória de senha pendente
  const pendingPasswordUsers = useMemo(() => {
    return visibleUsers.filter(u => u.mustChangePassword === true);
  }, [visibleUsers]);

  // 5. Total de alertas
  const totalAlerts = blockedUsers.length + pendingPasswordUsers.length;

  // 6. Distribuição de perfis
  const profileCounts = useMemo(() => {
    let masters = 0;
    let managers = 0;
    let users = 0;
    visibleUsers.forEach(u => {
      if (u.role === 'master' || (u.role as any) === 'admin') masters++;
      else if (u.role === 'manager') managers++;
      else users++;
    });
    return { masters, managers, users };
  }, [visibleUsers]);

  // 7. Últimas 5 atividades
  const recentLogs = useMemo(() => {
    return visibleLogs.slice(0, 5);
  }, [visibleLogs]);

  // 8. Lista de sessões com telemetria do servidor (ativas e recentes)
  const telemetrySessions = useMemo(() => {
    return [...visibleSessionsList]
      .sort((a, b) => {
        if (a.isOnline && !b.isOnline) return -1;
        if (!a.isOnline && b.isOnline) return 1;
        return new Date(b.lastSeen).getTime() - new Date(a.lastSeen).getTime();
      })
      .slice(0, 6);
  }, [visibleSessionsList]);

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Ações Rápidas alinhadas à direita no topo do conteúdo */}
      {(canManagerGenerateLogins && onOpenCreateUser) || onExportLogsCSV ? (
        <div className="flex items-center justify-end gap-2">
          {canManagerGenerateLogins && onOpenCreateUser && (
            <button
              type="button"
              onClick={onOpenCreateUser}
              className="min-h-[44px] px-4 py-2 rounded-xl bg-[#007AFF] hover:bg-[#0062CC] dark:bg-[#0A84FF] dark:hover:bg-[#409CFF] active:scale-[0.98] text-white text-xs font-medium flex items-center gap-1.5 transition-all shadow-xs cursor-pointer select-none"
            >
              <Plus className="w-4 h-4" strokeWidth={1.6} />
              <span>Novo Usuário</span>
            </button>
          )}

          {onExportLogsCSV && (
            <button
              type="button"
              onClick={onExportLogsCSV}
              className="min-h-[44px] px-3.5 py-2 rounded-xl bg-black/[0.05] dark:bg-white/[0.08] hover:bg-black/[0.08] dark:hover:bg-white/[0.12] active:scale-[0.98] text-slate-800 dark:text-slate-200 text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer select-none"
              title="Exportar registros de auditoria em CSV"
            >
              <Download className="w-4 h-4 text-[#8E8E93]" strokeWidth={1.6} />
              <span className="hidden sm:inline">Exportar CSV</span>
            </button>
          )}
        </div>
      ) : null}

      {/* Cartões de Métricas Apple (Números semibold, ícones monocromáticos cinza) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Cartão 1: Ativos Agora */}
        <AdminCard>
          <div className="flex items-center justify-between text-[#6C6C70] dark:text-[#98989D] mb-2 select-none">
            <span className="text-xs font-medium">Ativos Agora</span>
            <StatusDot status="online" ping />
          </div>
          <div className="text-[28px] font-semibold text-slate-900 dark:text-slate-100 tracking-tight leading-none">
            {activeNowCount}
          </div>
          <div className="text-xs text-[#8E8E93] dark:text-[#8E8E93] mt-2 flex items-center gap-1.5 select-none">
            <Clock className="w-3.5 h-3.5" strokeWidth={1.6} />
            <span>Últimos 3 minutos (sinal do servidor)</span>
          </div>
        </AdminCard>

        {/* Cartão 2: Acessos Totais */}
        <AdminCard>
          <div className="flex items-center justify-between text-[#6C6C70] dark:text-[#98989D] mb-2 select-none">
            <span className="text-xs font-medium">Acessos Totais</span>
            <Users className="w-4 h-4 text-[#8E8E93]" strokeWidth={1.6} />
          </div>
          <div className="text-[28px] font-semibold text-slate-900 dark:text-slate-100 tracking-tight leading-none">
            {totalVisitsCount}
          </div>
          <div className="text-xs text-[#8E8E93] dark:text-[#8E8E93] mt-2 flex items-center gap-1.5 select-none">
            <Smartphone className="w-3.5 h-3.5" strokeWidth={1.6} />
            <span>{visibleSessionsList.length} dispositivos</span>
          </div>
        </AdminCard>

        {/* Cartão 3: Atividades Registradas */}
        <AdminCard>
          <div className="flex items-center justify-between text-[#6C6C70] dark:text-[#98989D] mb-2 select-none">
            <span className="text-xs font-medium">Atividades</span>
            <Activity className="w-4 h-4 text-[#8E8E93]" strokeWidth={1.6} />
          </div>
          <div className="text-[28px] font-semibold text-slate-900 dark:text-slate-100 tracking-tight leading-none">
            {visibleLogs.length}
          </div>
          <div className="text-xs text-[#8E8E93] dark:text-[#8E8E93] mt-2 select-none">
            Eventos auditados
          </div>
        </AdminCard>

        {/* Cartão 4: Alertas e Pendências */}
        <AdminCard
          onClick={() => onNavigateToSection('users')}
          hoverable
        >
          <div className="flex items-center justify-between text-[#6C6C70] dark:text-[#98989D] mb-2 select-none">
            <span className="text-xs font-medium">Alertas</span>
            {totalAlerts > 0 ? (
              <StatusDot status="warning" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-[#8E8E93]" strokeWidth={1.6} />
            )}
          </div>
          <div className="text-[28px] font-semibold text-slate-900 dark:text-slate-100 tracking-tight leading-none">
            {totalAlerts}
          </div>
          <div className="text-xs text-[#8E8E93] dark:text-[#8E8E93] mt-2 flex items-center justify-between select-none">
            <span>{totalAlerts === 0 ? 'Tudo regularizado' : 'Ações necessárias'}</span>
            <ArrowRight className="w-3.5 h-3.5" strokeWidth={1.6} />
          </div>
        </AdminCard>
      </div>

      {/* Alerta Neutro Apple com Ponto Âmbar (Sem faixa colorida) */}
      {totalAlerts > 0 && (
        <Banner
          isWarning
          icon={ShieldAlert}
          title="Atenção da Equipe"
          message={
            <span>
              {blockedUsers.length > 0 && `${blockedUsers.length} conta(s) com acesso bloqueado. `}
              {pendingPasswordUsers.length > 0 && `${pendingPasswordUsers.length} usuário(s) com troca provisória de senha pendente.`}
            </span>
          }
          action={
            <button
              type="button"
              onClick={() => onNavigateToSection('users')}
              className="text-xs font-medium text-[#007AFF] dark:text-[#0A84FF] hover:underline cursor-pointer flex items-center gap-1 select-none"
            >
              <span>Verificar usuários</span>
              <ArrowRight className="w-3 h-3" strokeWidth={1.6} />
            </button>
          }
        />
      )}

      {/* Grid de 2 Colunas: Distribuição de Usuários & Atividades Recentes */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Bloco 1: Distribuição da Equipe */}
        <AdminCard className="space-y-4">
          <div className="flex items-center justify-between select-none">
            <h3 className="text-xs font-medium uppercase tracking-wider text-[#6C6C70] dark:text-[#98989D]">
              Distribuição de Usuários
            </h3>
            <button
              type="button"
              onClick={() => onNavigateToSection('users')}
              className="text-xs font-medium text-[#007AFF] dark:text-[#0A84FF] hover:underline cursor-pointer flex items-center gap-1"
            >
              <span>Gerenciar</span>
              <ArrowRight className="w-3 h-3" strokeWidth={1.6} />
            </button>
          </div>

          <div className={`grid ${isMaster ? 'grid-cols-3' : 'grid-cols-2'} gap-2.5`}>
            {isMaster && (
              <div className="p-3 bg-black/[0.03] dark:bg-white/[0.04] rounded-xl text-center border border-black/[0.03] dark:border-white/[0.04]">
                <div className="text-xs text-[#6C6C70] dark:text-[#98989D] font-medium">Master</div>
                <div className="text-xl font-semibold text-slate-900 dark:text-slate-100 mt-1">
                  {profileCounts.masters}
                </div>
              </div>
            )}
            <div className="p-3 bg-black/[0.03] dark:bg-white/[0.04] rounded-xl text-center border border-black/[0.03] dark:border-white/[0.04]">
              <div className="text-xs text-[#6C6C70] dark:text-[#98989D] font-medium">Gerentes</div>
              <div className="text-xl font-semibold text-slate-900 dark:text-slate-100 mt-1">
                {profileCounts.managers}
              </div>
            </div>
            <div className="p-3 bg-black/[0.03] dark:bg-white/[0.04] rounded-xl text-center border border-black/[0.03] dark:border-white/[0.04]">
              <div className="text-xs text-[#6C6C70] dark:text-[#98989D] font-medium">Comuns</div>
              <div className="text-xl font-semibold text-slate-900 dark:text-slate-100 mt-1">
                {profileCounts.users}
              </div>
            </div>
          </div>

          <div className="text-xs text-[#6C6C70] dark:text-[#98989D] pt-2 flex items-center justify-between border-t border-black/[0.05] dark:border-white/[0.06] select-none">
            <span>Total de contas cadastradas:</span>
            <span className="font-semibold text-slate-900 dark:text-slate-100">{visibleUsers.length}</span>
          </div>
        </AdminCard>

        {/* Bloco 2: Atividades Recentes */}
        <AdminCard className="space-y-4">
          <div className="flex items-center justify-between select-none">
            <h3 className="text-xs font-medium uppercase tracking-wider text-[#6C6C70] dark:text-[#98989D]">
              Atividade Recente
            </h3>
            <button
              type="button"
              onClick={() => onNavigateToSection('activity')}
              className="text-xs font-medium text-[#007AFF] dark:text-[#0A84FF] hover:underline cursor-pointer flex items-center gap-1"
            >
              <span>Ver todas</span>
              <ArrowRight className="w-3 h-3" strokeWidth={1.6} />
            </button>
          </div>

          {recentLogs.length === 0 ? (
            <div className="py-6 text-center text-xs text-[#8E8E93] dark:text-[#8E8E93]">
              Nenhuma atividade registrada até o momento.
            </div>
          ) : (
            <div className="space-y-2">
              {recentLogs.map((log) => (
                <div
                  key={log.id}
                  className="p-3 bg-black/[0.02] dark:bg-white/[0.03] rounded-xl flex items-center justify-between gap-3 text-xs border border-black/[0.03] dark:border-white/[0.04]"
                >
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-slate-900 dark:text-slate-100 truncate">
                      {log.action}
                    </div>
                    <div className="text-xs text-[#8E8E93] dark:text-[#8E8E93] mt-0.5 flex items-center gap-2">
                      <span>{log.formattedDate}</span>
                      {log.details && <span className="truncate">• {log.details}</span>}
                    </div>
                  </div>
                  <Badge variant="neutral">
                    {log.category}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </AdminCard>
      </div>

      {/* Bloco 3: Telemetria de Sessões & Dispositivos em Tempo Real (auth.sessions + servidor) */}
      <AdminCard className="space-y-4">
        <div className="flex items-center justify-between select-none">
          <div className="flex items-center gap-2">
            <h3 className="text-xs font-medium uppercase tracking-wider text-[#6C6C70] dark:text-[#98989D]">
              Telemetria de Sessões & Dispositivos
            </h3>
            <span className="text-[11px] text-[#8E8E93] dark:text-[#8E8E93] font-normal">
              (Servidor / auth.sessions)
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-[#8E8E93]">
            <StatusDot status="online" ping />
            <span>Sinal recente &lt; 3min</span>
          </div>
        </div>

        {telemetrySessions.length === 0 ? (
          <div className="py-6 text-center text-xs text-[#8E8E93] dark:text-[#8E8E93]">
            Nenhuma sessão registrada no servidor até o momento.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {telemetrySessions.map((s) => (
              <div
                key={s.sessionId}
                className="p-3 bg-black/[0.02] dark:bg-white/[0.03] rounded-xl border border-black/[0.03] dark:border-white/[0.04] space-y-2 text-xs"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <StatusDot status={s.isOnline ? 'online' : 'offline'} ping={s.isOnline} />
                    <span className="font-medium text-slate-900 dark:text-slate-100 truncate">
                      {s.customName || 'Visitante'}
                    </span>
                  </div>
                  <Badge variant={s.isAnonymous ? 'neutral' : 'accent'}>
                    {s.isAnonymous ? 'Anônimo' : s.role === 'master' ? 'Master' : s.role === 'manager' ? 'Gerente' : 'Conta'}
                  </Badge>
                </div>

                <div className="text-[11px] text-[#6C6C70] dark:text-[#98989D] space-y-0.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[#8E8E93]">Aparelho:</span>
                    <span className="font-medium text-slate-700 dark:text-slate-300 truncate max-w-[140px]">
                      {s.device || 'Navegador Web'}
                    </span>
                  </div>
                  {s.ipAddress && (
                    <div className="flex items-center justify-between">
                      <span className="text-[#8E8E93]">IP:</span>
                      <span className="font-mono text-slate-600 dark:text-slate-400">
                        {s.ipAddress}
                      </span>
                    </div>
                  )}
                  <div className="flex items-center justify-between pt-1 border-t border-black/[0.04] dark:border-white/[0.04]">
                    <span className="text-[#8E8E93]">Último sinal:</span>
                    <span className="font-mono text-[10px] text-slate-600 dark:text-slate-400">
                      {s.formattedLastSeen || s.lastSeen}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </AdminCard>
    </div>
  );
};
