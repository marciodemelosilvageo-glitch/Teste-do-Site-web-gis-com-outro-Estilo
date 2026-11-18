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
    icon: React.ComponentType<{ className?: string }>;
    badge?: string | number | null;
    badgeColor?: string;
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
      badgeColor: pendingAlertsCount > 0 ? 'bg-amber-500 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200'
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
    <aside className="w-64 shrink-0 flex flex-col h-full bg-[#f2f2f7] dark:bg-[#161618] border-r border-black/[0.06] dark:border-white/[0.08] select-none">
      {/* Cabeçalho da Sidebar Estilo Ajustes macOS */}
      <div className="p-4 pb-3 border-b border-black/[0.04] dark:border-white/[0.04]">
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 flex items-center justify-center shrink-0 shadow-xs">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate tracking-tight">
                Painel de Controle
              </h2>
              <div className="flex items-center gap-1.5 mt-0.5">
                {isMaster ? (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-extrabold uppercase tracking-wide bg-indigo-100 text-indigo-700 dark:bg-indigo-950/80 dark:text-indigo-300">
                    <Crown className="w-3 h-3" /> Master
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-extrabold uppercase tracking-wide bg-teal-100 text-teal-700 dark:bg-teal-950/80 dark:text-teal-300">
                    <Briefcase className="w-3 h-3" /> Gerente
                  </span>
                )}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="md:hidden text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1.5 rounded-xl hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer"
            title="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Identificação do Usuário Logado */}
        {currentActiveUser && (
          <div className="mt-2 px-2.5 py-1.5 bg-black/[0.03] dark:bg-white/[0.03] rounded-lg text-[11px] text-slate-600 dark:text-slate-400 truncate flex items-center justify-between">
            <span className="truncate">@{currentActiveUser.username}</span>
            <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" title="Sessão ativa" />
          </div>
        )}
      </div>

      {/* Lista de Navegação */}
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 px-3 py-1">
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
              className={`w-full min-h-[40px] px-3 py-2 rounded-xl text-xs font-semibold flex items-center justify-between transition-all cursor-pointer ${
                isActive
                  ? 'bg-white dark:bg-[#252528] text-[#007AFF] dark:text-[#0a84ff] shadow-xs border border-black/[0.04] dark:border-white/[0.08]'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-black/[0.03] dark:hover:bg-white/[0.04]'
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-[#007AFF] dark:text-[#0a84ff]' : 'text-slate-400 dark:text-slate-500'}`} />
                <span className="truncate">{item.label}</span>
              </div>
              {item.badge !== undefined && item.badge !== null && (
                <span className={`text-[10px] font-extrabold px-1.5 py-0.2 rounded-full shrink-0 ml-1.5 ${item.badgeColor || 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200'}`}>
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Rodapé da Sidebar */}
      <div className="p-3 border-t border-black/[0.04] dark:border-white/[0.04] text-[11px] text-slate-400 dark:text-slate-500 flex items-center justify-between">
        <span className="truncate">WebGIS • Ajustes</span>
        <span className="text-[10px] font-mono opacity-80">v1.0</span>
      </div>
    </aside>
  );
};
