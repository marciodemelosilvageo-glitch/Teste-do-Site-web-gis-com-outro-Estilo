import React, { useState } from 'react';
import {
  LayoutDashboard,
  Users,
  ShieldCheck,
  Activity,
  Settings,
  X,
  Crown,
  Briefcase,
  PanelLeftClose,
  PanelLeft
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
  visibleSections?: AdminSection[];
}

export const AdminSidebar: React.FC<AdminSidebarProps> = ({
  currentSection,
  onSelectSection,
  isMaster,
  currentActiveUser,
  onClose,
  pendingAlertsCount = 0,
  totalUsersCount = 0,
  visibleSections
}) => {
  const allNavItems: Array<{
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
    allNavItems.push({
      id: 'system',
      label: 'Sistema',
      icon: Settings
    });
  }

  const navItems = visibleSections
    ? allNavItems.filter(item => visibleSections.includes(item.id))
    : allNavItems;

  const [isCollapsed, setIsCollapsed] = useState(false);

  return (
    <aside className={`${isCollapsed ? 'w-[76px]' : 'w-64'} shrink-0 flex flex-col h-full bg-white/80 dark:bg-[#1C1C1E]/85 backdrop-blur-2xl border-r border-black/[0.06] dark:border-white/[0.08] select-none transition-all duration-300 ease-out`}>
      {/* Cabeçalho da Sidebar Estilo Apple / Site */}
      <div className="p-3.5 pb-3 border-b border-black/[0.06] dark:border-white/[0.06]">
        <div className={`flex items-center ${isCollapsed ? 'justify-center' : 'justify-between'} gap-2`}>
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 flex items-center justify-center shrink-0 shadow-xs">
              <ShieldCheck className="w-4 h-4" strokeWidth={1.6} />
            </div>
            {!isCollapsed && (
              <div className="min-w-0">
                <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate tracking-tight">
                  {isMaster ? 'Painel Master' : 'Painel do Gerente'}
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
            )}
          </div>
          {!isCollapsed && (
            <button
              type="button"
              onClick={() => setIsCollapsed(true)}
              className="hidden md:flex text-[#8E8E93] hover:text-slate-900 dark:hover:text-white p-1.5 rounded-xl hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer"
              title="Recolher barra lateral"
              aria-label="Recolher barra lateral"
            >
              <PanelLeftClose className="w-4 h-4" />
            </button>
          )}
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

        {isCollapsed && (
          <button
            type="button"
            onClick={() => setIsCollapsed(false)}
            className="mt-2.5 w-full flex items-center justify-center p-2 rounded-xl text-[#8E8E93] hover:text-slate-900 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer"
            title="Expandir barra lateral"
            aria-label="Expandir barra lateral"
          >
            <PanelLeft className="w-4 h-4" />
          </button>
        )}

        {/* Identificação do Usuário Logado */}
        {!isCollapsed && currentActiveUser && (
          <div className="mt-2.5 px-3 py-2 bg-black/[0.03] dark:bg-white/[0.04] rounded-xl text-xs text-[#6C6C70] dark:text-[#98989D] truncate flex items-center justify-between border border-black/[0.03] dark:border-white/[0.04]">
            <span className="truncate font-medium">@{currentActiveUser.username}</span>
            <StatusDot status="online" />
          </div>
        )}
      </div>

      {/* Lista de Navegação */}
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {!isCollapsed && (
          <div className="text-xs font-medium uppercase tracking-wider text-[#6C6C70] dark:text-[#98989D] px-3 py-1.5">
            Administração
          </div>
        )}
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentSection === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelectSection(item.id)}
              title={item.label}
              className={`w-full min-h-[44px] ${isCollapsed ? 'px-0 justify-center' : 'px-3 justify-between'} py-2.5 rounded-xl text-[13px] font-medium flex items-center transition-all duration-150 cursor-pointer relative ${
                isActive
                  ? 'bg-[#007AFF] text-white shadow-xs'
                  : 'text-[#6C6C70] dark:text-[#98989D] hover:text-slate-900 dark:hover:text-slate-100 hover:bg-black/[0.04] dark:hover:bg-white/[0.06]'
              }`}
            >
              <div className={`flex items-center ${isCollapsed ? 'justify-center' : 'gap-3 min-w-0'}`}>
                <Icon
                  className={`w-4 h-4 shrink-0 ${
                    isActive ? 'text-white' : 'text-[#8E8E93] dark:text-[#8E8E93]'
                  }`}
                  strokeWidth={1.8}
                />
                {!isCollapsed && <span className="truncate">{item.label}</span>}
              </div>
              {!isCollapsed && (
                <div className="flex items-center gap-1.5 shrink-0 ml-2">
                  {item.hasAlert && <StatusDot status="warning" />}
                  {item.badge !== undefined && item.badge !== null && (
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                      isActive ? 'bg-white/20 text-white' : 'bg-black/[0.05] dark:bg-white/[0.08] text-[#6C6C70] dark:text-[#98989D]'
                    }`}>
                      {item.badge}
                    </span>
                  )}
                </div>
              )}
            </button>
          );
        })}
      </nav>

      {/* Rodapé da Sidebar */}
      <div className={`p-3.5 border-t border-black/[0.06] dark:border-white/[0.06] text-xs text-[#6C6C70] dark:text-[#98989D] flex items-center ${isCollapsed ? 'justify-center' : 'justify-between'} select-none`}>
        {!isCollapsed && <span className="truncate">WebGIS • Painel</span>}
        <span className="font-mono text-xs opacity-75">v1.0</span>
      </div>
    </aside>
  );
};
