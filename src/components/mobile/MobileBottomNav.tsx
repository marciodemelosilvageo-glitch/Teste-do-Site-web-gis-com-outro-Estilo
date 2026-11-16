import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { SidebarTab } from '../AppleSidebar';
import { MOBILE_Z_INDEX } from '../../constants/mobileZIndex';
import {
  DashboardIcon,
  DetailsIcon,
  SearchIcon,
  ExportIcon,
  ProfileNavIcon
} from './NavIcons';

export interface MobileBottomNavProps {
  activeTab: SidebarTab;
  onSelectTab: (tab: SidebarTab) => void;
  selectedFeaturesCount: number;
  userRole?: string;
  isMaster?: boolean;
  isManager?: boolean;
  navRef?: React.Ref<HTMLElement>;
  onOpenAddressSearch?: () => void;
  isAddressSearchOpen?: boolean;
}

/**
 * Ícone SVG para Busca de Endereços CNEFE no estilo iOS/SF Symbols
 */
const AddressNavIcon: React.FC<{ size?: number; active?: boolean }> = ({ size = 22, active = false }) => {
  if (active) {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z" />
      </svg>
    );
  }
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  );
};

/**
 * MobileBottomNav - Cápsula flutuante translúcida estilo iPhone / Apple iOS 26.
 * Utiliza vidro fosco refinado (sem gradientes), ícones inspirados no SF Symbols,
 * indicador deslizante fluido com mola, feedback háptico e alvo de toque >= 44px.
 */
export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  activeTab,
  onSelectTab,
  selectedFeaturesCount,
  isMaster = false,
  isManager = false,
  navRef,
  onOpenAddressSearch,
  isAddressSearchOpen = false
}) => {
  // Detecção de prefers-reduced-motion
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mediaQuery.matches);

    const handler = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);

  // Feedback tátil háptico de 8ms ao alternar de aba
  const triggerHaptic = () => {
    try {
      if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
        navigator.vibrate(8);
      }
    } catch {
      // Ignorar silenciosamente caso não haja suporte
    }
  };

  const handleTabClick = (tab: SidebarTab) => {
    triggerHaptic();
    onSelectTab(activeTab === tab ? null : tab);
  };

  return (
    <nav
      ref={navRef}
      role="navigation"
      aria-label="Navegação móvel"
      style={{ zIndex: MOBILE_Z_INDEX.BOTTOM_NAV }}
      className="fixed bottom-0 inset-x-0 pb-[calc(env(safe-area-inset-bottom,0px)+8px)] px-3 pointer-events-none select-none flex justify-center transition-transform duration-300"
    >
      <div className="w-full max-w-[420px] pointer-events-auto rounded-[28px] bg-white/70 dark:bg-[#1c1c1e]/70 backdrop-blur-2xl backdrop-saturate-150 border border-black/[0.08] dark:border-white/[0.12] shadow-[0_8px_32px_rgba(0,0,0,0.12),0_2px_8px_rgba(0,0,0,0.06)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.5),0_2px_8px_rgba(0,0,0,0.3)] px-1.5 py-1.5 flex items-center justify-around relative">
        {/* 1. RAIO-X TERRITORIAL */}
        <motion.button
          type="button"
          whileTap={prefersReducedMotion ? undefined : { scale: 0.92 }}
          transition={{ type: 'spring', stiffness: 450, damping: 25 }}
          onClick={() => handleTabClick('dashboard')}
          aria-label="Raio-X Territorial"
          aria-current={activeTab === 'dashboard' ? 'page' : undefined}
          className={`flex-1 min-w-[44px] min-h-[44px] flex flex-col items-center justify-center py-1 px-0.5 rounded-[18px] relative transition-colors cursor-pointer ${
            activeTab === 'dashboard'
              ? 'text-[#007AFF] dark:text-[#0A84FF]'
              : 'text-[#8E8E93] dark:text-[#98989D] hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          {activeTab === 'dashboard' && (
            <motion.div
              layoutId={prefersReducedMotion ? undefined : 'mobile-nav-active-pill'}
              transition={{ type: 'spring', stiffness: 420, damping: 30 }}
              className="absolute inset-0 bg-black/[0.06] dark:bg-white/[0.10] rounded-[18px] pointer-events-none"
            />
          )}
          <motion.div
            key={activeTab === 'dashboard' ? 'active' : 'inactive'}
            animate={activeTab === 'dashboard' && !prefersReducedMotion ? { scale: [1, 1.12, 1] } : { scale: 1 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className="relative z-10 flex items-center justify-center"
          >
            <DashboardIcon size={21} active={activeTab === 'dashboard'} />
          </motion.div>
          <span className="relative z-10 text-[10.5px] xs:text-[11px] font-semibold tracking-tight mt-0.5 truncate max-w-full text-center">
            Raio-X
          </span>
        </motion.button>

        {/* 2. DETALHES DA FEIÇÃO */}
        <motion.button
          type="button"
          whileTap={prefersReducedMotion ? undefined : { scale: 0.92 }}
          transition={{ type: 'spring', stiffness: 450, damping: 25 }}
          onClick={() => handleTabClick('details')}
          aria-label={selectedFeaturesCount > 0 ? `Detalhes da feição (${selectedFeaturesCount} selecionadas)` : 'Detalhes da feição'}
          aria-current={activeTab === 'details' ? 'page' : undefined}
          className={`flex-1 min-w-[44px] min-h-[44px] flex flex-col items-center justify-center py-1 px-0.5 rounded-[18px] relative transition-colors cursor-pointer ${
            activeTab === 'details'
              ? 'text-[#007AFF] dark:text-[#0A84FF]'
              : 'text-[#8E8E93] dark:text-[#98989D] hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          {activeTab === 'details' && (
            <motion.div
              layoutId={prefersReducedMotion ? undefined : 'mobile-nav-active-pill'}
              transition={{ type: 'spring', stiffness: 420, damping: 30 }}
              className="absolute inset-0 bg-black/[0.06] dark:bg-white/[0.10] rounded-[18px] pointer-events-none"
            />
          )}
          <div className="relative z-10">
            <motion.div
              key={activeTab === 'details' ? 'active' : 'inactive'}
              animate={activeTab === 'details' && !prefersReducedMotion ? { scale: [1, 1.12, 1] } : { scale: 1 }}
              transition={{ duration: 0.25, ease: 'easeOut' }}
              className="flex items-center justify-center"
            >
              <DetailsIcon size={21} active={activeTab === 'details'} />
            </motion.div>
            <AnimatePresence>
              {selectedFeaturesCount > 0 && (
                <motion.span
                  initial={prefersReducedMotion ? { opacity: 1 } : { scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0, opacity: 0 }}
                  transition={{ type: 'spring', stiffness: 500, damping: 28 }}
                  className="absolute -top-1.5 -right-2.5 min-w-[17px] h-[17px] px-1 rounded-full bg-[#FF3B30] text-white text-[10px] font-bold flex items-center justify-center border-2 border-white/90 dark:border-[#1c1c1e]/90 shadow-sm leading-none"
                >
                  {selectedFeaturesCount > 99 ? '99+' : selectedFeaturesCount}
                </motion.span>
              )}
            </AnimatePresence>
          </div>
          <span className="relative z-10 text-[10.5px] xs:text-[11px] font-semibold tracking-tight mt-0.5 truncate max-w-full text-center">
            Detalhes
          </span>
        </motion.button>

        {/* 3. BUSCAR (Central, Círculo Azul Sólido Apple, Elevado) */}
        <div className="flex-1 flex flex-col items-center justify-center -translate-y-2 relative">
          <motion.button
            type="button"
            whileTap={prefersReducedMotion ? undefined : { scale: 0.92 }}
            transition={{ type: 'spring', stiffness: 450, damping: 25 }}
            onClick={() => handleTabClick('search')}
            aria-label="Buscar feições e endereços"
            aria-current={activeTab === 'search' ? 'page' : undefined}
            className={`w-12 h-12 xs:w-13 xs:h-13 rounded-full flex items-center justify-center transition-all duration-200 cursor-pointer shadow-[0_4px_14px_rgba(0,122,255,0.28)] ${
              activeTab === 'search'
                ? 'bg-[#007AFF] text-white ring-4 ring-[#007AFF]/25 scale-105'
                : 'bg-[#007AFF] text-white hover:bg-[#0071E3]'
            }`}
          >
            <motion.div
              animate={activeTab === 'search' && !prefersReducedMotion ? { scale: [1, 1.12, 1] } : { scale: 1 }}
              transition={{ duration: 0.25, ease: 'easeOut' }}
              className="flex items-center justify-center"
            >
              <SearchIcon size={22} active={activeTab === 'search'} />
            </motion.div>
          </motion.button>
          <span
            className={`text-[10.5px] xs:text-[11px] font-bold tracking-tight mt-0.5 ${
              activeTab === 'search'
                ? 'text-[#007AFF] dark:text-[#0A84FF]'
                : 'text-slate-700 dark:text-slate-300'
            }`}
          >
            Buscar
          </span>
        </div>

        {/* 4. EXPORTAR */}
        <motion.button
          type="button"
          whileTap={prefersReducedMotion ? undefined : { scale: 0.92 }}
          transition={{ type: 'spring', stiffness: 450, damping: 25 }}
          onClick={() => handleTabClick('export')}
          aria-label="Exportar dados territoriais"
          aria-current={activeTab === 'export' ? 'page' : undefined}
          className={`flex-1 min-w-[44px] min-h-[44px] flex flex-col items-center justify-center py-1 px-0.5 rounded-[18px] relative transition-colors cursor-pointer ${
            activeTab === 'export'
              ? 'text-[#007AFF] dark:text-[#0A84FF]'
              : 'text-[#8E8E93] dark:text-[#98989D] hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          {activeTab === 'export' && (
            <motion.div
              layoutId={prefersReducedMotion ? undefined : 'mobile-nav-active-pill'}
              transition={{ type: 'spring', stiffness: 420, damping: 30 }}
              className="absolute inset-0 bg-black/[0.06] dark:bg-white/[0.10] rounded-[18px] pointer-events-none"
            />
          )}
          <motion.div
            key={activeTab === 'export' ? 'active' : 'inactive'}
            animate={activeTab === 'export' && !prefersReducedMotion ? { scale: [1, 1.12, 1] } : { scale: 1 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className="relative z-10 flex items-center justify-center"
          >
            <ExportIcon size={21} active={activeTab === 'export'} />
          </motion.div>
          <span className="relative z-10 text-[10.5px] xs:text-[11px] font-semibold tracking-tight mt-0.5 truncate max-w-full text-center">
            Exportar
          </span>
        </motion.button>

        {/* 5. BUSCA AVANÇADA DE ENDEREÇOS (CNEFE) */}
        <motion.button
          type="button"
          whileTap={prefersReducedMotion ? undefined : { scale: 0.92 }}
          transition={{ type: 'spring', stiffness: 450, damping: 25 }}
          onClick={() => {
            triggerHaptic();
            onOpenAddressSearch?.();
          }}
          aria-label="Busca de endereços avançada"
          aria-current={isAddressSearchOpen ? 'page' : undefined}
          className={`flex-1 min-w-[44px] min-h-[44px] flex flex-col items-center justify-center py-1 px-0.5 rounded-[18px] relative transition-colors cursor-pointer ${
            isAddressSearchOpen
              ? 'text-[#007AFF] dark:text-[#0A84FF]'
              : 'text-[#8E8E93] dark:text-[#98989D] hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          {isAddressSearchOpen && (
            <motion.div
              layoutId={prefersReducedMotion ? undefined : 'mobile-nav-active-pill'}
              transition={{ type: 'spring', stiffness: 420, damping: 30 }}
              className="absolute inset-0 bg-black/[0.06] dark:bg-white/[0.10] rounded-[18px] pointer-events-none"
            />
          )}
          <motion.div
            key={isAddressSearchOpen ? 'active' : 'inactive'}
            animate={isAddressSearchOpen && !prefersReducedMotion ? { scale: [1, 1.12, 1] } : { scale: 1 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className="relative z-10 flex items-center justify-center"
          >
            <AddressNavIcon size={21} active={isAddressSearchOpen} />
          </motion.div>
          <span className="relative z-10 text-[10.5px] xs:text-[11px] font-semibold tracking-tight mt-0.5 truncate max-w-full text-center">
            Endereços
          </span>
        </motion.button>

        {/* 6. PERFIL */}
        <motion.button
          type="button"
          whileTap={prefersReducedMotion ? undefined : { scale: 0.92 }}
          transition={{ type: 'spring', stiffness: 450, damping: 25 }}
          onClick={() => handleTabClick('profile')}
          aria-label="Perfil do usuário e configurações"
          aria-current={activeTab === 'profile' ? 'page' : undefined}
          className={`flex-1 min-w-[44px] min-h-[44px] flex flex-col items-center justify-center py-1 px-0.5 rounded-[18px] relative transition-colors cursor-pointer ${
            activeTab === 'profile'
              ? 'text-[#007AFF] dark:text-[#0A84FF]'
              : 'text-[#8E8E93] dark:text-[#98989D] hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          {activeTab === 'profile' && (
            <motion.div
              layoutId={prefersReducedMotion ? undefined : 'mobile-nav-active-pill'}
              transition={{ type: 'spring', stiffness: 420, damping: 30 }}
              className="absolute inset-0 bg-black/[0.06] dark:bg-white/[0.10] rounded-[18px] pointer-events-none"
            />
          )}
          <motion.div
            key={activeTab === 'profile' ? 'active' : 'inactive'}
            animate={activeTab === 'profile' && !prefersReducedMotion ? { scale: [1, 1.12, 1] } : { scale: 1 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className="relative z-10 flex items-center justify-center"
          >
            <ProfileNavIcon
              size={21}
              active={activeTab === 'profile'}
              isMaster={isMaster}
              isManager={isManager}
            />
          </motion.div>
          <span className="relative z-10 text-[10.5px] xs:text-[11px] font-semibold tracking-tight mt-0.5 truncate max-w-full text-center">
            Perfil
          </span>
        </motion.button>
      </div>
    </nav>
  );
};
