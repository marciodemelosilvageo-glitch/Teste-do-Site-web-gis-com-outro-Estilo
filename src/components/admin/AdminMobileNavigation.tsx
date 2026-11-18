import React from 'react';
import {
  ChevronLeft,
  ChevronRight,
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

interface AdminMobileNavigationProps {
  currentSection: AdminSection | null;
  onSelectSection: (section: AdminSection | null) => void;
  isMaster: boolean;
  isManager: boolean;
  currentUserRole: UserRole;
  currentActiveUser: RegisteredUser | null;
  onClose: () => void;
  pendingAlertsCount?: number;
  totalUsersCount?: number;
  children?: React.ReactNode;
}

export const AdminMobileNavigation: React.FC<AdminMobileNavigationProps> = ({
  currentSection,
  onSelectSection,
  isMaster,
  isManager,
  currentActiveUser,
  onClose,
  pendingAlertsCount = 0,
  totalUsersCount = 0,
  children
}) => {
  const sections: Array<{
    id: AdminSection;
    label: string;
    description: string;
    icon: React.ComponentType<{ className?: string }>;
    badge?: string | number | null;
  }> = [
    {
      id: 'overview',
      label: 'Visão Geral',
      description: 'Métricas ativas, alertas e resumo',
      icon: LayoutDashboard
    },
    {
      id: 'users',
      label: 'Usuários e Equipe',
      description: 'Logins cadastrados e visitantes',
      icon: Users,
      badge: pendingAlertsCount > 0 ? `${pendingAlertsCount} pendentes` : (totalUsersCount > 0 ? `${totalUsersCount}` : null)
    },
    {
      id: 'access',
      label: 'Acesso e Permissões',
      description: 'Camadas, ferramentas e colunas',
      icon: ShieldCheck
    },
    {
      id: 'activity',
      label: 'Atividade e Auditoria',
      description: 'Histórico de eventos e exportação CSV',
      icon: Activity
    }
  ];

  if (isMaster) {
    sections.push({
      id: 'system',
      label: 'Sistema',
      description: 'Configurações de ambiente e manutenção',
      icon: Settings
    });
  }

  // Título amigável da seção ativa
  const currentSectionMeta = sections.find(s => s.id === currentSection);

  // Se uma subseção estiver aberta, renderiza a tela empilhada com botão voltar (‹)
  if (currentSection !== null) {
    return (
      <div className="flex flex-col h-full w-full bg-[#f2f2f7] dark:bg-[#000000] text-slate-900 dark:text-slate-100">
        {/* Barra de Topo iOS com Voltar */}
        <header className="h-12 min-h-[48px] px-3 bg-white/80 dark:bg-[#1c1c1e]/80 backdrop-blur-md border-b border-black/[0.06] dark:border-white/[0.08] flex items-center justify-between shrink-0 sticky top-0 z-20">
          <button
            type="button"
            onClick={() => onSelectSection(null)}
            className="min-h-[44px] min-w-[44px] flex items-center gap-0.5 text-[#007AFF] dark:text-[#0a84ff] font-medium text-sm active:opacity-60 transition-opacity cursor-pointer -ml-1 px-1"
          >
            <ChevronLeft className="w-5 h-5 stroke-[2.5]" />
            <span>Ajustes</span>
          </button>

          <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate text-center flex-1 px-2">
            {currentSectionMeta?.label || 'Painel'}
          </h2>

          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] min-w-[44px] flex items-center justify-end text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer pr-1"
            title="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </header>

        {/* Conteúdo da Subseção */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {children}
        </div>
      </div>
    );
  }

  // Tela Raiz Mobile: Lista estilo Ajustes do iPhone
  return (
    <div className="flex flex-col h-full w-full bg-[#f2f2f7] dark:bg-[#000000] text-slate-900 dark:text-slate-100">
      {/* Barra de Topo Raiz */}
      <header className="h-14 min-h-[56px] px-4 bg-white/80 dark:bg-[#1c1c1e]/80 backdrop-blur-md border-b border-black/[0.06] dark:border-white/[0.08] flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-lg font-extrabold text-slate-900 dark:text-slate-100 tracking-tight">
            Painel de Controle
          </h1>
          <div className="flex items-center gap-1.5 mt-0.5">
            {isMaster ? (
              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-600 dark:text-indigo-400">
                <Crown className="w-3 h-3" /> Master
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-teal-600 dark:text-teal-400">
                <Briefcase className="w-3 h-3" /> Gerente
              </span>
            )}
            {currentActiveUser && (
              <span className="text-[11px] text-slate-400 dark:text-slate-500">
                • @{currentActiveUser.username}
              </span>
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="min-h-[44px] min-w-[44px] flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
          title="Fechar"
        >
          <X className="w-5 h-5" />
        </button>
      </header>

      {/* Lista de Seções Estilo iOS Grouped Table */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <div className="bg-white dark:bg-[#1c1c1e] rounded-2xl shadow-xs border border-black/[0.05] dark:border-white/[0.06] overflow-hidden divide-y divide-black/[0.04] dark:divide-white/[0.06]">
          {sections.map((section) => {
            const Icon = section.icon;
            return (
              <button
                key={section.id}
                type="button"
                onClick={() => onSelectSection(section.id)}
                className="w-full min-h-[56px] px-4 py-3 flex items-center justify-between gap-3 text-left active:bg-black/[0.04] dark:active:bg-white/[0.06] transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-white/10 text-[#007AFF] dark:text-[#0a84ff] flex items-center justify-center shrink-0">
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
                      {section.label}
                    </div>
                    <div className="text-xs text-slate-400 dark:text-slate-500 truncate">
                      {section.description}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {section.badge && (
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-300">
                      {section.badge}
                    </span>
                  )}
                  <ChevronRight className="w-4 h-4 text-slate-400" />
                </div>
              </button>
            );
          })}
        </div>

        <div className="px-2 text-center text-xs text-slate-400 dark:text-slate-600">
          WebGIS Antigravity • Gestão de Permissões e Auditoria
        </div>
      </div>
    </div>
  );
};
