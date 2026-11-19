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
    <div className="space-y-6 animate-fadeIn">
      {/* Cabeçalho da Seção com Título Grande Apple */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-2 border-b border-black/[0.06] dark:border-white/[0.06]">
        <div>
          <h2 className="text-[28px] font-semibold text-slate-900 dark:text-slate-100 tracking-tight leading-8">
            Visão Geral
          </h2>
          <p className="text-xs text-[#6C6C70] dark:text-[#98989D] mt-1">
            Resumo do estado da equipe, dispositivos e atividades do WebGIS.
          </p>
        </div>

        {/* Ações Rápidas em Azul do Sistema ou Neutro */}
        <div className="flex items-center gap-2">
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
      </div>

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
            <span>Últimos 15 minutos</span>
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
            <span>{Object.keys(userSessions).length} dispositivos</span>
          </div>
        </AdminCard>

        {/* Cartão 3: Atividades Registradas */}
        <AdminCard>
          <div className="flex items-center justify-between text-[#6C6C70] dark:text-[#98989D] mb-2 select-none">
            <span className="text-xs font-medium">Atividades</span>
            <Activity className="w-4 h-4 text-[#8E8E93]" strokeWidth={1.6} />
          </div>
          <div className="text-[28px] font-semibold text-slate-900 dark:text-slate-100 tracking-tight leading-none">
            {logs.length}
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

          <div className="grid grid-cols-3 gap-2.5">
            <div className="p-3 bg-black/[0.03] dark:bg-white/[0.04] rounded-xl text-center border border-black/[0.03] dark:border-white/[0.04]">
              <div className="text-xs text-[#6C6C70] dark:text-[#98989D] font-medium">Master</div>
              <div className="text-xl font-semibold text-slate-900 dark:text-slate-100 mt-1">
                {profileCounts.masters}
              </div>
            </div>
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
            <span className="font-semibold text-slate-900 dark:text-slate-100">{registeredUsers.length}</span>
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
    </div>
  );
};
