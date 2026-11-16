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
}

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
  navRef
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
          className={`flex-1 min-w-[48px] min-h-[48px] flex flex-col items-center justify-center py-1 px-1 rounded-[20px] relative transition-colors cursor-pointer ${
            activeTab === 'dashboard'
              ? 'text-[#007AFF] dark:text-[#0A84FF]'
              : 'text-[#8E8E93] dark:text-[#98989D] hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          {activeTab === 'dashboard' && (
            <motion.div
              layoutId={prefersReducedMotion ? undefined : 'mobile-nav-active-pill'}
              transition={{ type: 'spring', stiffness: 420, damping: 30 }}
              className="absolute inset-0 bg-black/[0.06] dark:bg-white/[0.10] rounded-[20px] pointer-events-none"
            />
          )}
          <motion.div
            key={activeTab === 'dashboard' ? 'active' : 'inactive'}
            animate={activeTab === 'dashboard' && !prefersReducedMotion ? { scale: [1, 1.12, 1] } : { scale: 1 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className="relative z-10 flex items-center justify-center"
          >
            <DashboardIcon size={22} active={activeTab === 'dashboard'} />
          </motion.div>
          <span className="relative z-10 text-[12px] font-semibold tracking-tight mt-0.5">
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
          className={`flex-1 min-w-[48px] min-h-[48px] flex flex-col items-center justify-center py-1 px-1 rounded-[20px] relative transition-colors cursor-pointer ${
            activeTab === 'details'
              ? 'text-[#007AFF] dark:text-[#0A84FF]'
              : 'text-[#8E8E93] dark:text-[#98989D] hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          {activeTab === 'details' && (
            <motion.div
              layoutId={prefersReducedMotion ? undefined : 'mobile-nav-active-pill'}
              transition={{ type: 'spring', stiffness: 420, damping: 30 }}
              className="absolute inset-0 bg-black/[0.06] dark:bg-white/[0.10] rounded-[20px] pointer-events-none"
            />
          )}
          <div className="relative z-10">
            <motion.div
              key={activeTab === 'details' ? 'active' : 'inactive'}
              animate={activeTab === 'details' && !prefersReducedMotion ? { scale: [1, 1.12, 1] } : { scale: 1 }}
              transition={{ duration: 0.25, ease: 'easeOut' }}
              className="flex items-center justify-center"
            >
              <DetailsIcon size={22} active={activeTab === 'details'} />
            </motion.div>
            <AnimatePresence>
              {selectedFeaturesCount > 0 && (
                <motion.span
                  initial={prefersReducedMotion ? { opacity: 1 } : { scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0, opacity: 0 }}
                  transition={{ type: 'spring', stiffness: 500, damping: 28 }}
                  className="absolute -top-1.5 -right-2.5 min-w-[18px] h-[18px] px-1 rounded-full bg-[#FF3B30] text-white text-[11px] font-bold flex items-center justify-center border-2 border-white/90 dark:border-[#1c1c1e]/90 shadow-sm leading-none"
                >
                  {selectedFeaturesCount > 99 ? '99+' : selectedFeaturesCount}
                </motion.span>
              )}
            </AnimatePresence>
          </div>
          <span className="relative z-10 text-[12px] font-semibold tracking-tight mt-0.5">
            Detalhes
          </span>
        </motion.button>

        {/* 3. BUSCAR (Central, Círculo Azul Sólido Apple, Elevado) */}
        <div className="flex-1 flex flex-col items-center justify-center -translate-y-2.5 relative">
          <motion.button
            type="button"
            whileTap={prefersReducedMotion ? undefined : { scale: 0.92 }}
            transition={{ type: 'spring', stiffness: 450, damping: 25 }}
            onClick={() => handleTabClick('search')}
            aria-label="Buscar feições e endereços"
            aria-current={activeTab === 'search' ? 'page' : undefined}
            className={`w-14 h-14 rounded-full flex items-center justify-center transition-all duration-200 cursor-pointer shadow-[0_4px_14px_rgba(0,122,255,0.28)] ${
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
              <SearchIcon size={24} active={activeTab === 'search'} />
            </motion.div>
          </motion.button>
          <span
            className={`text-[12px] font-bold tracking-tight mt-0.5 ${
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
          className={`flex-1 min-w-[48px] min-h-[48px] flex flex-col items-center justify-center py-1 px-1 rounded-[20px] relative transition-colors cursor-pointer ${
            activeTab === 'export'
              ? 'text-[#007AFF] dark:text-[#0A84FF]'
              : 'text-[#8E8E93] dark:text-[#98989D] hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          {activeTab === 'export' && (
            <motion.div
              layoutId={prefersReducedMotion ? undefined : 'mobile-nav-active-pill'}
              transition={{ type: 'spring', stiffness: 420, damping: 30 }}
              className="absolute inset-0 bg-black/[0.06] dark:bg-white/[0.10] rounded-[20px] pointer-events-none"
            />
          )}
          <motion.div
            key={activeTab === 'export' ? 'active' : 'inactive'}
            animate={activeTab === 'export' && !prefersReducedMotion ? { scale: [1, 1.12, 1] } : { scale: 1 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className="relative z-10 flex items-center justify-center"
          >
            <ExportIcon size={22} active={activeTab === 'export'} />
          </motion.div>
          <span className="relative z-10 text-[12px] font-semibold tracking-tight mt-0.5">
            Exportar
          </span>
        </motion.button>

        {/* 5. PERFIL */}
        <motion.button
          type="button"
          whileTap={prefersReducedMotion ? undefined : { scale: 0.92 }}
          transition={{ type: 'spring', stiffness: 450, damping: 25 }}
          onClick={() => handleTabClick('profile')}
          aria-label="Perfil do usuário e configurações"
          aria-current={activeTab === 'profile' ? 'page' : undefined}
          className={`flex-1 min-w-[48px] min-h-[48px] flex flex-col items-center justify-center py-1 px-1 rounded-[20px] relative transition-colors cursor-pointer ${
            activeTab === 'profile'
              ? 'text-[#007AFF] dark:text-[#0A84FF]'
              : 'text-[#8E8E93] dark:text-[#98989D] hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          {activeTab === 'profile' && (
            <motion.div
              layoutId={prefersReducedMotion ? undefined : 'mobile-nav-active-pill'}
              transition={{ type: 'spring', stiffness: 420, damping: 30 }}
              className="absolute inset-0 bg-black/[0.06] dark:bg-white/[0.10] rounded-[20px] pointer-events-none"
            />
          )}
          <motion.div
            key={activeTab === 'profile' ? 'active' : 'inactive'}
            animate={activeTab === 'profile' && !prefersReducedMotion ? { scale: [1, 1.12, 1] } : { scale: 1 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className="relative z-10 flex items-center justify-center"
          >
            <ProfileNavIcon
              size={22}
              active={activeTab === 'profile'}
              isMaster={isMaster}
              isManager={isManager}
            />
          </motion.div>
          <span className="relative z-10 text-[12px] font-semibold tracking-tight mt-0.5">
            Perfil
          </span>
        </motion.button>
      </div>
    </nav>
  );
};
