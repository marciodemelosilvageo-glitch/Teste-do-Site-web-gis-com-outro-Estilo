import React from 'react';
import { SelectedFeature } from '../../types';
import { SidebarTab } from '../AppleSidebar';

export interface MobileShellProps {
  children?: React.ReactNode;
  activeTab: SidebarTab | 'profile';
  setActiveTab: (tab: SidebarTab | 'profile' | null) => void;
  selectedFeatures: SelectedFeature[];
  isDarkMode: boolean;
  onToggleDarkMode: (event?: React.MouseEvent) => void;
  currentActiveUser: any;
  onLogout: () => void;
  onOpenHelp: () => void;
}

/**
 * MobileShell - Fundação da interface móvel (largura < 768px).
 * Ocupa 100dvh respeitando safe-areas, sem scroll horizontal e sem aside desktop.
 */
export const MobileShell: React.FC<MobileShellProps> = ({
  children,
  activeTab: _activeTab,
  setActiveTab: _setActiveTab,
  selectedFeatures: _selectedFeatures,
  isDarkMode: _isDarkMode,
  onToggleDarkMode: _onToggleDarkMode,
  currentActiveUser: _currentActiveUser,
  onLogout: _onLogout,
  onOpenHelp: _onOpenHelp
}) => {
  return (
    <div className="relative w-full h-full h-screen-dynamic overflow-hidden flex flex-col bg-slate-100 dark:bg-slate-950 select-none">
      {/* Contêiner Principal do Mapa em Tela Cheia */}
      <main className="relative flex-1 w-full h-full overflow-hidden">
        {children}
      </main>

      {/* Espaço reservado para MobileBottomNav (Etapa 2) e MobileSheet (Etapa 3) */}
    </div>
  );
};
