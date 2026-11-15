import React from 'react';
import { Users, MapPin, Search, Download, User, Crown, Briefcase } from 'lucide-react';
import { SidebarTab } from '../AppleSidebar';

export interface MobileBottomNavProps {
  activeTab: SidebarTab;
  onSelectTab: (tab: SidebarTab) => void;
  selectedFeaturesCount: number;
  userRole?: string;
  isMaster?: boolean;
  isManager?: boolean;
}

/**
 * MobileBottomNav - Barra inferior flutuante translúcida estilo Apple Maps.
 * Oferece alvos de toque >= 44px, botão de busca proeminente e badge de feições.
 */
export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  activeTab,
  onSelectTab,
  selectedFeaturesCount,
  isMaster = false,
  isManager = false
}) => {
  const ProfileIcon = isMaster ? Crown : isManager ? Briefcase : User;

  return (
    <nav
      role="navigation"
      aria-label="Navegação móvel"
      className="fixed bottom-0 inset-x-0 z-40 px-3 pb-[calc(env(safe-area-inset-bottom,0px)+8px)] pt-1.5 bg-white/85 dark:bg-slate-900/85 backdrop-blur-2xl border-t border-black/5 dark:border-white/10 shadow-[0_-4px_20px_rgba(0,0,0,0.08)] dark:shadow-[0_-4px_20px_rgba(0,0,0,0.45)] select-none pointer-events-auto transition-transform duration-300"
    >
      <div className="max-w-md mx-auto flex items-center justify-around relative">
        {/* 1. Raio-X */}
        <button
          type="button"
          onClick={() => onSelectTab(activeTab === 'dashboard' ? null : 'dashboard')}
          aria-label="Raio-X Territorial"
          aria-current={activeTab === 'dashboard' ? 'page' : undefined}
          className={`flex-1 min-w-[48px] min-h-[48px] flex flex-col items-center justify-center py-1 px-1 rounded-2xl transition-all cursor-pointer active:scale-95 ${
            activeTab === 'dashboard'
              ? 'text-[#007AFF] dark:text-[#3898FF]'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <div className={`p-1.5 rounded-xl transition-colors ${
            activeTab === 'dashboard' ? 'bg-[#007AFF]/15 dark:bg-[#007AFF]/25' : ''
          }`}>
            <Users className="w-5 h-5 stroke-[2]" />
          </div>
          <span className="text-[11px] font-semibold tracking-tight mt-0.5">Raio-X</span>
        </button>

        {/* 2. Detalhes */}
        <button
          type="button"
          onClick={() => onSelectTab(activeTab === 'details' ? null : 'details')}
          aria-label={selectedFeaturesCount > 0 ? `Detalhes da feição (${selectedFeaturesCount} selecionadas)` : "Detalhes da feição"}
          aria-current={activeTab === 'details' ? 'page' : undefined}
          className={`flex-1 min-w-[48px] min-h-[48px] flex flex-col items-center justify-center py-1 px-1 rounded-2xl transition-all cursor-pointer active:scale-95 relative ${
            activeTab === 'details'
              ? 'text-[#007AFF] dark:text-[#3898FF]'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <div className="relative">
            <div className={`p-1.5 rounded-xl transition-colors ${
              activeTab === 'details' ? 'bg-[#007AFF]/15 dark:bg-[#007AFF]/25' : ''
            }`}>
              <MapPin className={`w-5 h-5 stroke-[2] ${selectedFeaturesCount > 0 && activeTab !== 'details' ? 'text-[#FF9500]' : ''}`} />
            </div>
            {selectedFeaturesCount > 0 && (
              <span className="absolute -top-1 -right-2 min-w-[18px] h-[18px] px-1 rounded-full bg-[#FF9500] text-white text-[10px] font-black flex items-center justify-center shadow-md animate-scaleIn">
                {selectedFeaturesCount > 99 ? '99+' : selectedFeaturesCount}
              </span>
            )}
          </div>
          <span className="text-[11px] font-semibold tracking-tight mt-0.5">Detalhes</span>
        </button>

        {/* 3. BUSCAR (Central, Proeminente, Destacado) */}
        <div className="flex-1 flex flex-col items-center justify-center -translate-y-2">
          <button
            type="button"
            onClick={() => onSelectTab(activeTab === 'search' ? null : 'search')}
            aria-label="Buscar feições e endereços"
            aria-current={activeTab === 'search' ? 'page' : undefined}
            className={`w-13 h-13 rounded-2xl flex items-center justify-center shadow-lg transition-all duration-200 cursor-pointer active:scale-90 ${
              activeTab === 'search'
                ? 'bg-[#007AFF] text-white shadow-blue-500/40 ring-4 ring-blue-500/25 scale-105'
                : 'bg-gradient-to-tr from-[#007AFF] to-[#0091FF] text-white shadow-blue-500/35 hover:shadow-blue-500/45'
            }`}
          >
            <Search className="w-6 h-6 stroke-[2.3]" />
          </button>
          <span className={`text-[11px] font-bold tracking-tight mt-1 ${
            activeTab === 'search' ? 'text-[#007AFF] dark:text-[#3898FF]' : 'text-slate-700 dark:text-slate-300'
          }`}>
            Buscar
          </span>
        </div>

        {/* 4. Exportar */}
        <button
          type="button"
          onClick={() => onSelectTab(activeTab === 'export' ? null : 'export')}
          aria-label="Exportar dados territoriais"
          aria-current={activeTab === 'export' ? 'page' : undefined}
          className={`flex-1 min-w-[48px] min-h-[48px] flex flex-col items-center justify-center py-1 px-1 rounded-2xl transition-all cursor-pointer active:scale-95 ${
            activeTab === 'export'
              ? 'text-[#007AFF] dark:text-[#3898FF]'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <div className={`p-1.5 rounded-xl transition-colors ${
            activeTab === 'export' ? 'bg-[#007AFF]/15 dark:bg-[#007AFF]/25' : ''
          }`}>
            <Download className="w-5 h-5 stroke-[2]" />
          </div>
          <span className="text-[11px] font-semibold tracking-tight mt-0.5">Exportar</span>
        </button>

        {/* 5. Perfil */}
        <button
          type="button"
          onClick={() => onSelectTab(activeTab === 'profile' ? null : 'profile')}
          aria-label="Perfil do usuário e configurações"
          aria-current={activeTab === 'profile' ? 'page' : undefined}
          className={`flex-1 min-w-[48px] min-h-[48px] flex flex-col items-center justify-center py-1 px-1 rounded-2xl transition-all cursor-pointer active:scale-95 ${
            activeTab === 'profile'
              ? 'text-[#007AFF] dark:text-[#3898FF]'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <div className={`p-1.5 rounded-xl transition-colors ${
            activeTab === 'profile' ? 'bg-[#007AFF]/15 dark:bg-[#007AFF]/25' : ''
          }`}>
            <ProfileIcon className="w-5 h-5 stroke-[2]" />
          </div>
          <span className="text-[11px] font-semibold tracking-tight mt-0.5">Perfil</span>
        </button>
      </div>
    </nav>
  );
};
