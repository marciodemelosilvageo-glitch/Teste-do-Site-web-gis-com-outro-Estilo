import React, { useState, useRef, useEffect, useCallback } from 'react';
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
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

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

  // Fechar ao clicar fora ou ao pressionar Escape
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        handleClose();
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        handleClose();
        triggerRef.current?.focus();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, handleClose]);

  // Alinhamento do popup
  const alignClass = 
    align === 'right' 
      ? 'right-0' 
      : align === 'left' 
        ? 'left-0' 
        : 'left-1/2 -translate-x-1/2';

  return (
    <div ref={containerRef} className={`relative flex items-center shrink-0 ${className}`}>
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

      {isOpen && (
        <div
          role="menu"
          aria-orientation="vertical"
          aria-label="Tipos de estabelecimentos"
          className={`absolute top-full mt-1.5 z-50 ${alignClass} w-52 py-1.5 bg-white/95 dark:bg-[#1c1c1e]/95 backdrop-blur-2xl border border-black/10 dark:border-white/10 rounded-2xl shadow-2xl space-y-0.5 animate-fadeIn`}
        >
          <div className="px-3 py-1 text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 border-b border-black/5 dark:border-white/5 mb-1">
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
        </div>
      )}
    </div>
  );
};
