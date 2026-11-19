import React from 'react';
import {
  LayoutDashboard,
  Users,
  ShieldCheck,
  Activity,
  Settings,
  X,
  Crown,
  Briefcase
} from 'lucide-react';
import { AdminSection } from './types';
import { RegisteredUser, UserRole } from '../../services/adminService';
import { Badge, StatusDot } from './ui';

interface AdminSidebarProps {
  currentSection: AdminSection;
  onSelectSection: (section: AdminSection) => void;
  isMaster: boolean;
  isManager: boolean;
  currentUserRole: UserRole;
  currentActiveUser: RegisteredUser | null;
  onClose: () => void;
  pendingAlertsCount?: number;
  totalUsersCount?: number;
}

export const AdminSidebar: React.FC<AdminSidebarProps> = ({
  currentSection,
  onSelectSection,
  isMaster,
  isManager,
  currentActiveUser,
  onClose,
  pendingAlertsCount = 0,
  totalUsersCount = 0
}) => {
  const navItems: Array<{
    id: AdminSection;
    label: string;
    icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
    badge?: string | number | null;
    hasAlert?: boolean;
  }> = [
    {
      id: 'overview',
      label: 'Visão Geral',
      icon: LayoutDashboard
    },
    {
      id: 'users',
      label: 'Usuários e Equipe',
      icon: Users,
      badge: pendingAlertsCount > 0 ? pendingAlertsCount : (totalUsersCount > 0 ? totalUsersCount : null),
      hasAlert: pendingAlertsCount > 0
    },
    {
      id: 'access',
      label: 'Acesso e Permissões',
      icon: ShieldCheck
    },
    {
      id: 'activity',
      label: 'Atividade e Auditoria',
      icon: Activity
    }
  ];

  if (isMaster) {
    navItems.push({
      id: 'system',
      label: 'Sistema',
      icon: Settings
    });
  }

  return (
    <aside className="w-64 shrink-0 flex flex-col h-full bg-[#F2F2F7] dark:bg-[#161618] border-r border-black/[0.06] dark:border-white/[0.08] select-none">
      {/* Cabeçalho da Sidebar Estilo Ajustes macOS */}
      <div className="p-4 pb-3 border-b border-black/[0.06] dark:border-white/[0.06]">
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 flex items-center justify-center shrink-0 shadow-xs">
              <ShieldCheck className="w-4 h-4" strokeWidth={1.6} />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate tracking-tight">
                Painel de Controle
              </h2>
              <div className="flex items-center gap-1.5 mt-0.5">
                {isMaster ? (
                  <Badge icon={Crown} variant="neutral">
                    Master
                  </Badge>
                ) : (
                  <Badge icon={Briefcase} variant="neutral">
                    Gerente
                  </Badge>
                )}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="md:hidden text-[#8E8E93] hover:text-slate-900 dark:hover:text-white p-2 rounded-xl hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center"
            title="Fechar"
            aria-label="Fechar Painel"
          >
            <X className="w-5 h-5" strokeWidth={1.6} />
          </button>
        </div>

        {/* Identificação do Usuário Logado */}
        {currentActiveUser && (
          <div className="mt-2.5 px-3 py-2 bg-black/[0.03] dark:bg-white/[0.04] rounded-xl text-xs text-[#6C6C70] dark:text-[#98989D] truncate flex items-center justify-between border border-black/[0.03] dark:border-white/[0.04]">
            <span className="truncate font-medium">@{currentActiveUser.username}</span>
            <StatusDot status="online" />
          </div>
        )}
      </div>

      {/* Lista de Navegação */}
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        <div className="text-xs font-medium uppercase tracking-wider text-[#6C6C70] dark:text-[#98989D] px-3 py-1.5">
          Administração
        </div>
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentSection === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelectSection(item.id)}
              className={`w-full min-h-[44px] px-3 py-2.5 rounded-xl text-[13px] font-medium flex items-center justify-between transition-all duration-150 cursor-pointer ${
                isActive
                  ? 'bg-white dark:bg-[#1C1C1E] text-[#007AFF] dark:text-[#0A84FF] shadow-xs border border-black/[0.04] dark:border-white/[0.06]'
                  : 'text-[#6C6C70] dark:text-[#98989D] hover:text-slate-900 dark:hover:text-slate-100 hover:bg-black/[0.03] dark:hover:bg-white/[0.04]'
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <Icon
                  className={`w-4 h-4 shrink-0 ${
                    isActive ? 'text-[#007AFF] dark:text-[#0A84FF]' : 'text-[#8E8E93] dark:text-[#8E8E93]'
                  }`}
                  strokeWidth={1.6}
                />
                <span className="truncate">{item.label}</span>
              </div>
              <div className="flex items-center gap-1.5 shrink-0 ml-2">
                {item.hasAlert && <StatusDot status="warning" />}
                {item.badge !== undefined && item.badge !== null && (
                  <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-black/[0.05] dark:bg-white/[0.08] text-[#6C6C70] dark:text-[#98989D]">
                    {item.badge}
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </nav>

      {/* Rodapé da Sidebar */}
      <div className="p-3.5 border-t border-black/[0.06] dark:border-white/[0.06] text-xs text-[#6C6C70] dark:text-[#98989D] flex items-center justify-between select-none">
        <span className="truncate">WebGIS • Painel</span>
        <span className="font-mono text-xs opacity-75">v1.0</span>
      </div>
    </aside>
  );
};
