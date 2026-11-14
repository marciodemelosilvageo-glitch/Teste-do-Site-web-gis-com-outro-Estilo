import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Loader2 } from 'lucide-react';
import { APPLE_CATEGORIES } from '../categories';

interface CategorySearchMenuProps {
  onSelectCategory: (categoryId: string) => void;
  disabled?: boolean;
  isLoading?: boolean;
  align?: 'left' | 'right' | 'center';
  className?: string;
  buttonClassName?: string;
  title?: string;
}

export const CategorySearchMenu: React.FC<CategorySearchMenuProps> = ({
  onSelectCategory,
  disabled = false,
  isLoading = false,
  align = 'center',
  className = '',
  buttonClassName = '',
  title = 'Buscar por tipo de estabelecimento neste polígono'
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const portalRef = useRef<HTMLDivElement>(null);
  const [portalPos, setPortalPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });

  const handleClose = useCallback(() => {
    setIsOpen(false);
  }, []);

  const handleToggle = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (disabled || isLoading) return;
    setIsOpen(prev => !prev);
  }, [disabled, isLoading]);

  const handleSelect = useCallback((catId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    handleClose();
    onSelectCategory(catId);
  }, [handleClose, onSelectCategory]);

  const updatePortalPos = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const menuWidth = 208; // w-52 = 208px
    const estimatedHeight = portalRef.current?.offsetHeight || 320;
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;

    // Se houver menos espaço abaixo do que a altura estimada e mais espaço acima, abre para cima do botão
    const openUpwards = spaceBelow < estimatedHeight && spaceAbove > spaceBelow;

    const margin = 8;
    const top = openUpwards 
      ? Math.max(margin, rect.top - estimatedHeight - 6)
      : Math.min(window.innerHeight - estimatedHeight - margin, rect.bottom + 6);

    // Alinhamento horizontal baseado na prop 'align'
    let left: number;
    if (align === 'right') {
      left = rect.right - menuWidth;
    } else if (align === 'left') {
      left = rect.left;
    } else {
      // center
      left = rect.left + (rect.width / 2) - (menuWidth / 2);
    }

    // Limites de segurança da tela
    if (left < margin) {
      left = margin;
    } else if (left + menuWidth > window.innerWidth - margin) {
      left = Math.max(margin, window.innerWidth - menuWidth - margin);
    }

    setPortalPos({ top, left });
  }, [align]);

  // Fechar ao clicar fora, ao pressionar Escape ou ao rolar/redimensionar
  useEffect(() => {
    if (!isOpen) return;

    updatePortalPos();
    const rafId = requestAnimationFrame(updatePortalPos);

    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node;
      if (triggerRef.current && triggerRef.current.contains(target)) {
        return;
      }
      if (portalRef.current && portalRef.current.contains(target)) {
        return;
      }
      handleClose();
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        handleClose();
        triggerRef.current?.focus();
      }
    };

    const handleScrollOrResize = () => {
      if (!triggerRef.current) {
        handleClose();
        return;
      }
      const rect = triggerRef.current.getBoundingClientRect();
      if (rect.bottom < 0 || rect.top > window.innerHeight) {
        handleClose();
      } else {
        updatePortalPos();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    window.addEventListener('resize', handleScrollOrResize);
    window.addEventListener('scroll', handleScrollOrResize, true);

    return () => {
      cancelAnimationFrame(rafId);
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('resize', handleScrollOrResize);
      window.removeEventListener('scroll', handleScrollOrResize, true);
    };
  }, [isOpen, handleClose, updatePortalPos]);

  return (
    <div className={`relative flex items-center shrink-0 ${className}`}>
      <button
        ref={triggerRef}
        type="button"
        onClick={handleToggle}
        disabled={disabled || isLoading}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-label="Opções de busca por tipo de estabelecimento"
        title={title}
        className={`px-2 py-2 flex items-center justify-center text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10 active:scale-95 transition-all cursor-pointer rounded-r-2xl disabled:opacity-50 disabled:cursor-not-allowed ${buttonClassName}`}
      >
        {isLoading ? (
          <Loader2 className="w-4 h-4 animate-spin text-[#007AFF]" />
        ) : (
          <ChevronDown 
            className={`w-4 h-4 transition-transform duration-200 ${isOpen ? 'rotate-180 text-[#007AFF]' : ''}`} 
          />
        )}
      </button>

      {isOpen && typeof document !== 'undefined' && createPortal(
        <div
          ref={portalRef}
          role="menu"
          aria-orientation="vertical"
          aria-label="Tipos de estabelecimentos"
          style={{
            position: 'fixed',
            top: `${portalPos.top}px`,
            left: `${portalPos.left}px`,
            zIndex: 1200,
          }}
          className="w-52 max-h-[min(380px,calc(100vh-24px))] overflow-y-auto custom-scrollbar py-1.5 bg-white/95 dark:bg-[#1c1c1e]/95 backdrop-blur-2xl border border-black/10 dark:border-white/10 rounded-2xl shadow-2xl space-y-0.5 animate-fadeIn"
        >
          <div className="sticky top-0 z-10 bg-white/95 dark:bg-[#1c1c1e]/95 backdrop-blur-md px-3 py-1 text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 border-b border-black/5 dark:border-white/5 mb-1">
            Buscar por Tipo
          </div>

          {APPLE_CATEGORIES.map((cat) => {
            const Icon = cat.icon;
            return (
              <button
                key={cat.id}
                role="menuitem"
                type="button"
                onClick={(e) => handleSelect(cat.id, e)}
                className="w-full px-3 py-2 text-left flex items-center gap-2.5 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-black/5 dark:hover:bg-white/10 active:scale-[0.98] transition-all cursor-pointer group"
              >
                <div 
                  className={`w-6 h-6 rounded-lg ${cat.color} text-white flex items-center justify-center shadow-xs shrink-0 group-hover:scale-105 transition-transform`}
                >
                  <Icon className="w-3.5 h-3.5" />
                </div>
                <span className="truncate flex-1 font-medium group-hover:text-slate-900 dark:group-hover:text-white">
                  {cat.name}
                </span>
              </button>
            );
          })}
        </div>,
        document.body
      )}
    </div>
  );
};
