import React, { useRef, useState, useEffect, useCallback } from 'react';
import { SelectedFeature } from '../../types';
import { SidebarTab } from '../AppleSidebar';
import { MobileBottomNav } from './MobileBottomNav';
import { MobileProfileDrawer } from './MobileProfileDrawer';
import { AppLogo } from '../AppLogo';
import { MOBILE_Z_INDEX } from '../../constants/mobileZIndex';

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
  onOpenCnefeAddressSearch?: () => void;
  isAddressSearchOpen?: boolean;
  hasCnefeSearch?: boolean;
}

/**
 * MobileShell - Fundação da interface móvel (largura < 768px).
 * Ocupa 100dvh respeitando safe-areas, sem scroll horizontal e sem aside desktop.
 * Publica as variáveis dinâmicas globais --mobile-top-inset e --mobile-bottom-inset.
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
  onOpenAdminPanel,
  onOpenCnefeAddressSearch,
  isAddressSearchOpen = false,
  hasCnefeSearch = false
}) => {
  const navRef = useRef<HTMLElement>(null);
  const [navHeight, setNavHeight] = useState<number>(68);
  const [sheetHeight, setSheetHeight] = useState<number>(0);
  const [sheetSnap, setSheetSnap] = useState<string | null>(null);
  const [topInset, setTopInset] = useState<number>(0);

  const calculateInsets = useCallback(() => {
    let safeTop = 0;
    if (typeof window !== 'undefined') {
      const computed = getComputedStyle(document.documentElement);
      const satVal = computed.getPropertyValue('--sat');
      if (satVal) {
        safeTop = parseInt(satVal, 10) || 0;
      }
      if (window.visualViewport) {
        const vpTop = window.visualViewport.offsetTop;
        if (vpTop > safeTop) safeTop = vpTop;
      }
    }
    setTopInset(safeTop);

    let measuredNavH = 68;
    if (navRef.current) {
      measuredNavH = navRef.current.offsetHeight || 68;
    }
    setNavHeight(measuredNavH);

    const totalBottom = Math.max(measuredNavH, sheetHeight);
    document.documentElement.style.setProperty('--mobile-top-inset', `${safeTop}px`);
    document.documentElement.style.setProperty('--mobile-bottom-inset', `${totalBottom}px`);
  }, [sheetHeight]);

  // Observer de redimensionamento na barra inferior
  useEffect(() => {
    if (!navRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const h = entry.borderBoxSize?.[0]?.blockSize ?? entry.contentRect.height;
        if (h > 0) {
          setNavHeight(Math.round(h));
        }
      }
    });
    observer.observe(navRef.current);
    return () => observer.disconnect();
  }, []);

  // Monitora alterações na gaveta, giro de tela e teclado virtual
  useEffect(() => {
    const handleSheetResize = (e: Event) => {
      const detail = (e as CustomEvent<{ height: number; snap: string | null }>).detail;
      setSheetHeight(detail?.height ?? 0);
      setSheetSnap(detail?.snap ?? null);
    };

    window.addEventListener('mobile-sheet-resize', handleSheetResize);
    window.addEventListener('resize', calculateInsets);
    window.addEventListener('orientationchange', calculateInsets);

    const vv = window.visualViewport;
    if (vv) {
      vv.addEventListener('resize', calculateInsets);
    }

    calculateInsets();

    return () => {
      window.removeEventListener('mobile-sheet-resize', handleSheetResize);
      window.removeEventListener('resize', calculateInsets);
      window.removeEventListener('orientationchange', calculateInsets);
      if (vv) {
        vv.removeEventListener('resize', calculateInsets);
      }
    };
  }, [calculateInsets]);

  const bottomInset = Math.max(navHeight, sheetHeight);
  const isSheetFullscreen = sheetSnap === 'full' || (sheetHeight > (typeof window !== 'undefined' ? window.innerHeight * 0.75 : 600));

  return (
    <div 
      style={{
        '--mobile-top-inset': `${topInset}px`,
        '--mobile-bottom-inset': `${bottomInset}px`
      } as React.CSSProperties}
      className="relative w-full h-full h-screen-dynamic overflow-hidden flex flex-col bg-slate-100 dark:bg-slate-950 select-none"
    >
      {/* Contêiner Principal do Mapa em Tela Cheia */}
      <main className="relative flex-1 w-full h-full overflow-hidden">
        {children}

        {/* Logo Institucional no Canto Superior Esquerdo (Apenas Mobile) */}
        <div 
          style={{
            top: 'calc(var(--mobile-top-inset, 0px) + 10px)',
            left: '12px',
            zIndex: MOBILE_Z_INDEX.MAP_CONTROLS + 5,
          }}
          className={`fixed pointer-events-none transition-all duration-300 print:hidden ${
            isSheetFullscreen ? 'opacity-0 scale-95 pointer-events-none' : 'opacity-100 scale-100'
          }`}
          aria-hidden="true"
        >
          <div className="bg-white/80 dark:bg-[#1c1c1e]/80 backdrop-blur-md border border-black/10 dark:border-white/10 shadow-xs px-2.5 py-1 rounded-2xl max-w-[120px] flex items-center justify-center">
            <AppLogo
              variant="sidebar"
              isDarkMode={isDarkMode}
              className="h-6 sm:h-7 w-auto max-w-[100px] object-contain pointer-events-none"
            />
          </div>
        </div>
      </main>

      {/* Barra Inferior Fixa Flutuante */}
      <MobileBottomNav
        navRef={navRef}
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        selectedFeaturesCount={selectedFeatures.length}
        userRole={userRole}
        isMaster={isMaster}
        isManager={isManager}
        onOpenAddressSearch={onOpenCnefeAddressSearch}
        isAddressSearchOpen={isAddressSearchOpen}
        hasCnefeSearch={hasCnefeSearch}
      />

      {/* Gaveta de Perfil / Configurações Rápidas */}
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
        onOpenAddressSearch={onOpenCnefeAddressSearch}
        onOpenHelp={onOpenHelp}
        onOpenProfileModal={onOpenProfileModal}
        onOpenAdminPanel={onOpenAdminPanel}
        onLogout={onLogout}
      />
    </div>
  );
};
