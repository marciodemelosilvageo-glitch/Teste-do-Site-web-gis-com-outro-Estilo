import React from 'react';
import { motion } from 'motion/react';
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
import { Badge, StatusDot } from './ui';

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
  visibleSections?: AdminSection[];
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
  visibleSections,
  children
}) => {
  const allSections: Array<{
    id: AdminSection;
    label: string;
    description: string;
    icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
    badge?: string | number | null;
    hasAlert?: boolean;
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
      badge: pendingAlertsCount > 0 ? `${pendingAlertsCount} pendentes` : (totalUsersCount > 0 ? `${totalUsersCount}` : null),
      hasAlert: pendingAlertsCount > 0
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

  if (isMaster || isManager) {
    allSections.push({
      id: 'system',
      label: isMaster ? 'Sistema' : 'Sincronizar',
      description: isMaster ? 'Configurações de ambiente e manutenção' : 'Sincronizar dados e permissões',
      icon: Settings
    });
  }

  const sections = visibleSections
    ? allSections.filter(s => visibleSections.includes(s.id))
    : allSections;

  // Título amigável da seção ativa
  const currentSectionMeta = sections.find(s => s.id === currentSection);

  const shortTabLabel = (id: AdminSection, fallback: string) => {
    switch (id) {
      case 'overview': return 'Resumo';
      case 'users': return 'Equipe';
      case 'access': return 'Acessos';
      case 'activity': return 'Atividade';
      case 'system': return 'Sincronizar';
      default: return fallback;
    }
  };

  const renderIosBottomTabBar = () => {
    if (isMaster) return null;
    const activeTab = currentSection || sections[0]?.id;
    return (
      <nav
        aria-label="Navegação por abas"
        className="shrink-0 bg-white/85 dark:bg-[#1C1C1E]/85 backdrop-blur-xl border-t border-black/[0.08] dark:border-white/[0.1] px-1 pt-1 pb-2 flex items-center justify-around select-none"
      >
        {sections.map((sec) => {
          const TabIcon = sec.icon;
          const isActive = activeTab === sec.id && currentSection !== null;
          return (
            <button
              key={sec.id}
              type="button"
              onClick={() => onSelectSection(sec.id)}
              className={`min-h-[44px] min-w-[44px] flex-1 flex flex-col items-center justify-center gap-0.5 rounded-xl transition-transform active:scale-95 cursor-pointer ${
                isActive
                  ? 'text-[#007AFF] dark:text-[#0A84FF]'
                  : 'text-[#8E8E93] dark:text-[#8E8E93]'
              }`}
            >
              <TabIcon className="w-5 h-5" strokeWidth={isActive ? 2 : 1.6} />
              <span className="text-[10px] font-medium leading-none truncate max-w-[68px]">
                {shortTabLabel(sec.id, sec.label)}
              </span>
            </button>
          );
        })}
      </nav>
    );
  };

  // Se uma subseção estiver aberta, renderiza a tela empilhada com botão voltar (‹) e deslize
  if (currentSection !== null) {
    return (
      <div className="flex flex-col h-full w-full bg-[#F2F2F7] dark:bg-[#000000] text-slate-900 dark:text-slate-100">
        {/* Barra de Topo iOS com Voltar */}
        <header className="h-12 min-h-[48px] px-3 bg-white/85 dark:bg-[#1C1C1E]/85 backdrop-blur-md border-b border-black/[0.06] dark:border-white/[0.08] flex items-center justify-between shrink-0 sticky top-0 z-20 select-none">
          <button
            type="button"
            onClick={() => onSelectSection(null)}
            className="min-h-[44px] min-w-[44px] flex items-center gap-1 text-[#007AFF] dark:text-[#0A84FF] font-medium text-[15px] active:opacity-60 transition-opacity cursor-pointer -ml-1 px-1"
          >
            <ChevronLeft className="w-5 h-5 stroke-[2.2]" />
            <span>Ajustes</span>
          </button>

          <h2 className="text-[17px] font-semibold text-slate-900 dark:text-slate-100 truncate text-center flex-1 px-2">
            {currentSectionMeta?.label || 'Painel'}
          </h2>

          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] min-w-[44px] flex items-center justify-end text-[#8E8E93] hover:text-slate-900 dark:hover:text-white cursor-pointer pr-1"
            title="Fechar"
            aria-label="Fechar Painel"
          >
            <X className="w-5 h-5" strokeWidth={1.6} />
          </button>
        </header>

        {/* Conteúdo da Subseção com transição de pilha iOS e voltar por deslize para Gerente */}
        <motion.div
          key={currentSection}
          initial={isMaster ? false : { opacity: 0.4, x: 24 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ type: 'spring', stiffness: 380, damping: 34 }}
          drag={!isMaster ? 'x' : false}
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={{ left: 0, right: 0.25 }}
          onDragEnd={(_, info) => {
            if (!isMaster && info.offset.x > 90 && info.velocity.x > 100) {
              onSelectSection(null);
            }
          }}
          className="flex-1 overflow-y-auto p-4 space-y-4"
        >
          {children}
        </motion.div>

        {renderIosBottomTabBar()}
      </div>
    );
  }

  // Tela Raiz Mobile: Lista estilo Ajustes do iPhone
  return (
    <div className="flex flex-col h-full w-full bg-[#F2F2F7] dark:bg-[#000000] text-slate-900 dark:text-slate-100 select-none">
      {/* Barra de Topo Raiz */}
      <header className="h-14 min-h-[56px] px-4 bg-white/85 dark:bg-[#1C1C1E]/85 backdrop-blur-md border-b border-black/[0.06] dark:border-white/[0.08] flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100 tracking-tight">
            Painel de Controle
          </h1>
          <div className="flex items-center gap-2 mt-0.5">
            {isMaster ? (
              <Badge icon={Crown} variant="neutral">
                Master
              </Badge>
            ) : (
              <Badge icon={Briefcase} variant="neutral">
                Gerente
              </Badge>
            )}
            {currentActiveUser && (
              <span className="text-xs text-[#6C6C70] dark:text-[#98989D]">
                • @{currentActiveUser.username}
              </span>
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="min-h-[44px] min-w-[44px] flex items-center justify-center text-[#8E8E93] hover:text-slate-900 dark:hover:text-white cursor-pointer"
          title="Fechar"
          aria-label="Fechar Painel"
        >
          <X className="w-5 h-5" strokeWidth={1.6} />
        </button>
      </header>

      {/* Lista de Seções Estilo iOS Inset Grouped */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <div className="bg-white dark:bg-[#1C1C1E] rounded-2xl shadow-xs border border-black/[0.06] dark:border-white/[0.08] overflow-hidden divide-y divide-black/[0.05] dark:divide-white/[0.06]">
          {sections.map((section) => {
            const Icon = section.icon;
            return (
              <button
                key={section.id}
                type="button"
                onClick={() => onSelectSection(section.id)}
                className="w-full min-h-[54px] px-4 py-3 flex items-center justify-between gap-3 text-left active:bg-black/[0.03] dark:active:bg-white/[0.05] transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="w-8 h-8 rounded-xl bg-black/[0.04] dark:bg-white/[0.06] text-[#6C6C70] dark:text-[#98989D] flex items-center justify-center shrink-0">
                    <Icon className="w-4 h-4" strokeWidth={1.6} />
                  </div>
                  <div className="min-w-0">
                    <div className="text-[15px] font-medium text-slate-900 dark:text-slate-100 truncate">
                      {section.label}
                    </div>
                    <div className="text-xs text-[#6C6C70] dark:text-[#98989D] truncate mt-0.5">
                      {section.description}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {section.hasAlert && <StatusDot status="warning" />}
                  {section.badge && (
                    <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-black/[0.05] dark:bg-white/[0.08] text-[#6C6C70] dark:text-[#98989D]">
                      {section.badge}
                    </span>
                  )}
                  <ChevronRight className="w-4 h-4 text-[#8E8E93]" strokeWidth={1.6} />
                </div>
              </button>
            );
          })}
        </div>

        <div className="px-2 text-center text-xs text-[#8E8E93] dark:text-[#636366]">
          WebGIS • Ajustes e Políticas
        </div>
      </div>
      {renderIosBottomTabBar()}
    </div>
  );
};
