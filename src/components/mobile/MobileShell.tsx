import React from 'react';
import { SelectedFeature } from '../../types';
import { SidebarTab } from '../AppleSidebar';
import { MobileBottomNav } from './MobileBottomNav';
import { MobileProfileDrawer } from './MobileProfileDrawer';

export interface MobileShellProps {
  children?: React.ReactNode;
  activeTab: SidebarTab;
  setActiveTab: (tab: SidebarTab) => void;
  selectedFeatures: SelectedFeature[];
  isDarkMode: boolean;
  onToggleDarkMode: (event?: React.MouseEvent) => void;
  currentActiveUser: any;
  userRole?: string;
  isMaster?: boolean;
  isManager?: boolean;
  isAdmin?: boolean;
  onLogout: () => void;
  onOpenHelp: () => void;
  onOpenProfileModal?: () => void;
  onOpenAdminPanel?: () => void;
}

/**
 * MobileShell - Fundação da interface móvel (largura < 768px).
 * Ocupa 100dvh respeitando safe-areas, sem scroll horizontal e sem aside desktop.
 */
export const MobileShell: React.FC<MobileShellProps> = ({
  children,
  activeTab,
  setActiveTab,
  selectedFeatures,
  isDarkMode,
  onToggleDarkMode,
  currentActiveUser,
  userRole,
  isMaster = false,
  isManager = false,
  isAdmin = false,
  onLogout,
  onOpenHelp,
  onOpenProfileModal,
  onOpenAdminPanel
}) => {
  return (
    <div className="relative w-full h-full h-screen-dynamic overflow-hidden flex flex-col bg-slate-100 dark:bg-slate-950 select-none">
      {/* Contêiner Principal do Mapa em Tela Cheia */}
      <main className="relative flex-1 w-full h-full overflow-hidden">
        {children}
      </main>

      {/* Barra Inferior Fixa Flutuante (Etapa 2) */}
      <MobileBottomNav
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        selectedFeaturesCount={selectedFeatures.length}
        userRole={userRole}
        isMaster={isMaster}
        isManager={isManager}
      />

      {/* Gaveta de Perfil / Configurações Rápidas (Etapa 2) */}
      <MobileProfileDrawer
        isOpen={activeTab === 'profile'}
        onClose={() => setActiveTab(null)}
        currentActiveUser={currentActiveUser}
        userRole={userRole}
        isMaster={isMaster}
        isManager={isManager}
        isAdmin={isAdmin}
        isDarkMode={isDarkMode}
        onToggleDarkMode={onToggleDarkMode}
        onOpenHelp={onOpenHelp}
        onOpenProfileModal={onOpenProfileModal}
        onOpenAdminPanel={onOpenAdminPanel}
        onLogout={onLogout}
      />
    </div>
  );
};
