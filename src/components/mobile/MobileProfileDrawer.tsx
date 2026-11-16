import React, { useEffect, useRef } from 'react';
import { 
  X, 
  Crown, 
  Briefcase, 
  User, 
  Home,
  Sun, 
  Moon, 
  HelpCircle, 
  LogOut, 
  ShieldCheck, 
  ChevronRight,
  UserCheck
} from 'lucide-react';
import { MOBILE_Z_INDEX } from '../../constants/mobileZIndex';

export interface MobileProfileDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  currentActiveUser: any;
  userRole?: string;
  isMaster?: boolean;
  isManager?: boolean;
  isAdmin?: boolean;
  isDarkMode?: boolean;
  onToggleDarkMode?: (event?: React.MouseEvent) => void;
  onOpenAddressSearch?: () => void;
  onOpenHelp: () => void;
  onOpenProfileModal?: () => void;
  onOpenAdminPanel?: () => void;
  onLogout: () => void;
}

/**
 * MobileProfileDrawer - Gaveta de perfil e configurações rápidas no mobile.
 * Permite acessar busca avançada de endereços, guia de ajuda, ver dados da conta e sair.
 */
export const MobileProfileDrawer: React.FC<MobileProfileDrawerProps> = ({
  isOpen,
  onClose,
  currentActiveUser,
  isMaster = false,
  isManager = false,
  isAdmin = false,
  onOpenAddressSearch,
  onOpenHelp,
  onOpenProfileModal,
  onOpenAdminPanel,
  onLogout
}) => {
  const drawerRef = useRef<HTMLDivElement>(null);

  // Fecha ao pressionar Escape
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const displayName = currentActiveUser?.name || 'Visitante';
  const roleLabel = isMaster ? 'Master • Acesso Total' : isManager ? 'Gerente' : 'Conta Padrão';
  const ProfileIcon = isMaster ? Crown : isManager ? Briefcase : User;

  return (
    <div 
      className="fixed inset-0 flex flex-col justify-end pointer-events-auto select-none"
      style={{ zIndex: MOBILE_Z_INDEX.SHEET }}
      role="dialog"
      aria-modal="true"
      aria-label="Perfil do Usuário e Configurações"
    >
      {/* Backdrop Translúcido (z-0 dentro do contêiner SHEET z-1200) */}
      <div 
        className="fixed inset-0 bg-black/40 dark:bg-black/60 backdrop-blur-sm transition-opacity duration-300 z-0"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Conteúdo da Gaveta */}
      <div 
        ref={drawerRef}
        className="relative z-10 w-full max-w-lg mx-auto bg-white/95 dark:bg-slate-900/95 backdrop-blur-2xl border-t border-black/10 dark:border-white/10 rounded-t-3xl shadow-2xl px-5 pt-3 pb-[calc(env(safe-area-inset-bottom,0px)+16px)] flex flex-col gap-4 max-h-[85vh] overflow-y-auto animate-slideUp"
      >
        {/* Alça de Arraste Superior */}
        <div className="w-12 h-1.5 bg-slate-300 dark:bg-slate-700 rounded-full mx-auto shrink-0" />

        {/* Cabeçalho do Perfil */}
        <div className="flex items-center justify-between gap-3 pb-2 border-b border-black/5 dark:border-white/10">
          <div className="flex items-center gap-3 min-w-0">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-sm ${
              isMaster 
                ? 'bg-amber-500 text-white' 
                : isManager 
                ? 'bg-indigo-600 text-white' 
                : 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
            }`}>
              <ProfileIcon className="w-6 h-6" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base font-bold text-slate-900 dark:text-white truncate">
                {displayName}
              </h2>
              <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full mt-0.5 ${
                isMaster 
                  ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400' 
                  : isManager 
                  ? 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-400' 
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
              }`}>
                {roleLabel}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/15 text-slate-500 dark:text-slate-400 flex items-center justify-center cursor-pointer transition-colors"
            aria-label="Fechar gaveta de perfil"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Lista de Ações Rápidas */}
        <div className="flex flex-col gap-2">
          {/* Busca de Endereços Avançada (IBGE CNEFE) */}
          {onOpenAddressSearch && (
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenAddressSearch();
              }}
              className="w-full flex items-center justify-between p-3.5 rounded-2xl bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 transition-colors cursor-pointer text-left active:scale-[0.99]"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#007AFF] to-[#5856D6] text-white flex items-center justify-center shrink-0 shadow-xs">
                  <Home className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-sm font-bold text-slate-900 dark:text-white block">
                    Busca de Endereços Avançada
                  </span>
                  <span className="text-xs text-slate-500 dark:text-slate-400 block">
                    Consultar base CNEFE do IBGE
                  </span>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-slate-400" />
            </button>
          )}

          {/* Guia de Uso & Ajuda */}
          <button
            type="button"
            onClick={() => {
              onClose();
              onOpenHelp();
            }}
            className="w-full flex items-center justify-between p-3.5 rounded-2xl bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 transition-colors cursor-pointer text-left active:scale-[0.99]"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-500/15 text-[#007AFF] flex items-center justify-center shrink-0">
                <HelpCircle className="w-5 h-5" />
              </div>
              <div>
                <span className="text-sm font-bold text-slate-900 dark:text-white block">
                  Guia de Uso &amp; Ajuda
                </span>
                <span className="text-xs text-slate-500 dark:text-slate-400 block">
                  Instruções do mapa, camadas e filtros
                </span>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-slate-400" />
          </button>

          {/* Minha Conta / Detalhes do Perfil */}
          {onOpenProfileModal && (
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenProfileModal();
              }}
              className="w-full flex items-center justify-between p-3.5 rounded-2xl bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 transition-colors cursor-pointer text-left active:scale-[0.99]"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                  <UserCheck className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-sm font-bold text-slate-900 dark:text-white block">
                    Detalhes da Conta
                  </span>
                  <span className="text-xs text-slate-500 dark:text-slate-400 block">
                    Nome de exibição e credenciais
                  </span>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-slate-400" />
            </button>
          )}

          {/* Painel Administrativo (Master/Gerente) */}
          {(isAdmin || isManager) && onOpenAdminPanel && (
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenAdminPanel();
              }}
              className="w-full flex items-center justify-between p-3.5 rounded-2xl bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 transition-colors cursor-pointer text-left active:scale-[0.99]"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-purple-500/15 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-sm font-bold text-slate-900 dark:text-white block">
                    Painel do Administrador
                  </span>
                  <span className="text-xs text-slate-500 dark:text-slate-400 block">
                    Gerenciar usuários, camadas e logs
                  </span>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-slate-400" />
            </button>
          )}

          {/* Sair da Conta */}
          <button
            type="button"
            onClick={() => {
              onClose();
              onLogout();
            }}
            className="w-full flex items-center justify-between p-3.5 rounded-2xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 transition-colors cursor-pointer text-left mt-2 active:scale-[0.99]"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-500/20 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
                <LogOut className="w-5 h-5" />
              </div>
              <div>
                <span className="text-sm font-bold block">
                  Sair da Conta
                </span>
                <span className="text-xs text-rose-500/80 block">
                  Encerrar sessão neste dispositivo
                </span>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-rose-400" />
          </button>
        </div>
      </div>
    </div>
  );
};
