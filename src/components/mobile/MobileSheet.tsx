import React, { useRef, useState, useEffect, useCallback } from 'react';
import { X, ChevronDown, ChevronUp, Maximize2, Minimize2 } from 'lucide-react';
import { SidebarTab } from '../AppleSidebar';
import { MOBILE_Z_INDEX } from '../../constants/mobileZIndex';

export type SnapPoint = 'peek' | 'half' | 'full';

export interface MobileSheetProps {
  isOpen: boolean;
  activeTab: SidebarTab;
  onClose: () => void;
  snapPoint?: SnapPoint;
  onSnapChange?: (snap: SnapPoint) => void;
  title?: string;
  icon?: React.ReactNode;
  hideHeader?: boolean;
  noPadding?: boolean;
  children: React.ReactNode;
}

const SNAP_HEIGHTS: Record<SnapPoint, number> = {
  peek: 28, // 28vh
  half: 60, // 60vh
  full: 92  // 92vh
};

/**
 * MobileSheet - Bottom Sheet com 3 alturas (peek ~28%, meia ~60%, cheia ~92%).
 * Suporta arrasto suave via Pointer Events, alça dedicada, botão de recolher
 * e preserva a rolagem natural dos conteúdos internos.
 */
export const MobileSheet: React.FC<MobileSheetProps> = ({
  isOpen,
  activeTab: _activeTab,
  onClose,
  snapPoint = 'half',
  onSnapChange,
  title,
  icon,
  hideHeader = false,
  noPadding = false,
  children
}) => {
  const [currentSnap, setCurrentSnap] = useState<SnapPoint>(snapPoint);
  const [isDragging, setIsDragging] = useState(false);
  const [dragCurrentHeightVh, setDragCurrentHeightVh] = useState<number | null>(null);

  const startYRef = useRef<number>(0);
  const startHeightVhRef = useRef<number>(SNAP_HEIGHTS[snapPoint]);
  const sheetRef = useRef<HTMLDivElement>(null);

  // Sincroniza com a prop externa se ela mudar
  useEffect(() => {
    setCurrentSnap(snapPoint);
  }, [snapPoint]);

  const setSnap = useCallback((nextSnap: SnapPoint) => {
    setCurrentSnap(nextSnap);
    onSnapChange?.(nextSnap);
  }, [onSnapChange]);

  // Gestão de arrasto com Pointer Events na alça superior
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    // Apenas clique principal / toque
    if (e.button !== 0) return;
    
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    startYRef.current = e.clientY;
    startHeightVhRef.current = SNAP_HEIGHTS[currentSnap];
    setIsDragging(true);
    setDragCurrentHeightVh(SNAP_HEIGHTS[currentSnap]);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    
    const deltaY = e.clientY - startYRef.current;
    const windowHeight = window.innerHeight || 800;
    const deltaVh = (deltaY / windowHeight) * 100;
    
    // Como a gaveta é fixada embaixo, deltaY para baixo diminui a altura
    const newHeightVh = Math.max(15, Math.min(95, startHeightVhRef.current - deltaVh));
    setDragCurrentHeightVh(newHeightVh);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    try {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      // Ignora erro se pointer já foi liberado
    }
    setIsDragging(false);

    const currentH = dragCurrentHeightVh ?? SNAP_HEIGHTS[currentSnap];
    setDragCurrentHeightVh(null);

    // Se arrastou muito para baixo (abaixo de 20vh), fecha
    if (currentH < 20) {
      onClose();
      return;
    }

    // Encontra o snap point mais próximo
    const snaps: SnapPoint[] = ['peek', 'half', 'full'];
    let closestSnap: SnapPoint = 'half';
    let minDiff = Infinity;

    snaps.forEach(s => {
      const diff = Math.abs(currentH - SNAP_HEIGHTS[s]);
      if (diff < minDiff) {
        minDiff = diff;
        closestSnap = s;
      }
    });

    setSnap(closestSnap);
  };

  const currentHeightVh = dragCurrentHeightVh !== null ? dragCurrentHeightVh : SNAP_HEIGHTS[currentSnap];

  // Sincroniza a altura visível e snap point da gaveta nas variáveis globais
  useEffect(() => {
    if (!isOpen) {
      document.documentElement.removeAttribute('data-mobile-sheet-snap');
      document.documentElement.style.setProperty('--mobile-sheet-visible-height', '0px');
      window.dispatchEvent(new CustomEvent('mobile-sheet-resize', { detail: { height: 0, snap: null } }));
      return;
    }
    document.documentElement.setAttribute('data-mobile-sheet-snap', currentSnap);
    const windowH = window.innerHeight || 800;
    const px = Math.round((currentHeightVh / 100) * windowH);
    document.documentElement.style.setProperty('--mobile-sheet-visible-height', `${px}px`);
    window.dispatchEvent(new CustomEvent('mobile-sheet-resize', { detail: { height: px, snap: currentSnap } }));

    return () => {
      document.documentElement.removeAttribute('data-mobile-sheet-snap');
      document.documentElement.style.setProperty('--mobile-sheet-visible-height', '0px');
      window.dispatchEvent(new CustomEvent('mobile-sheet-resize', { detail: { height: 0, snap: null } }));
    };
  }, [isOpen, currentHeightVh, currentSnap]);

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop transparente ou semitransparente em modo tela cheia (92%) */}
      {currentSnap === 'full' && (
        <div 
          className="fixed inset-0 bg-black/25 backdrop-blur-[2px] transition-opacity duration-300 md:hidden"
          style={{ zIndex: MOBILE_Z_INDEX.SHEET_BACKDROP }}
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Gaveta Principal (Bottom Sheet) */}
      <section
        ref={sheetRef}
        role="dialog"
        aria-modal={currentSnap === 'full'}
        aria-label={title || "Painel de informações"}
        style={{
          zIndex: MOBILE_Z_INDEX.SHEET,
          height: `${currentHeightVh}dvh`,
          transition: isDragging ? 'none' : 'height 0.32s cubic-bezier(0.2, 0.9, 0.4, 1.0)'
        }}
        className="fixed bottom-0 inset-x-0 max-w-lg mx-auto bg-white/95 dark:bg-[#1c1c1e]/95 backdrop-blur-3xl border-t border-black/10 dark:border-white/10 rounded-t-[28px] shadow-[0_-8px_32px_rgba(0,0,0,0.18)] dark:shadow-[0_-8px_32px_rgba(0,0,0,0.6)] flex flex-col overflow-hidden select-none"
      >
        {/* Alça de Arraste (Handle) com Pointer Events */}
        <div
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          className="w-full pt-2.5 pb-2 flex flex-col items-center justify-center cursor-grab active:cursor-grabbing touch-none select-none shrink-0"
        >
          <div className="w-12 h-1.5 rounded-full bg-slate-300 dark:bg-slate-600 transition-colors" />
        </div>

        {/* Cabeçalho do Sheet */}
        {!hideHeader && (
          <div className="px-4 pb-2.5 flex items-center justify-between border-b border-black/5 dark:border-white/10 shrink-0">
            <div className="flex items-center gap-2 min-w-0">
              {icon && <span className="text-[#007AFF] shrink-0">{icon}</span>}
              <h2 className="text-base font-black text-slate-900 dark:text-white truncate tracking-tight">
                {title}
              </h2>
            </div>

            <div className="flex items-center gap-1">
              {/* Alternador de Altura Rápido (Minimizar / Maximizar) */}
              {currentSnap === 'peek' && (
                <button
                  type="button"
                  onClick={() => setSnap('half')}
                  className="w-8 h-8 rounded-full bg-black/5 dark:bg-white/10 hover:bg-black/10 text-slate-600 dark:text-slate-300 flex items-center justify-center cursor-pointer transition-transform active:scale-90"
                  title="Expandir para metade"
                  aria-label="Expandir gaveta"
                >
                  <ChevronUp className="w-4 h-4" />
                </button>
              )}

              {currentSnap === 'half' && (
                <>
                  <button
                    type="button"
                    onClick={() => setSnap('peek')}
                    className="w-8 h-8 rounded-full bg-black/5 dark:bg-white/10 hover:bg-black/10 text-slate-600 dark:text-slate-300 flex items-center justify-center cursor-pointer transition-transform active:scale-90"
                    title="Recolher para barra compacta"
                    aria-label="Compactar gaveta"
                  >
                    <ChevronDown className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setSnap('full')}
                    className="w-8 h-8 rounded-full bg-black/5 dark:bg-white/10 hover:bg-black/10 text-slate-600 dark:text-slate-300 flex items-center justify-center cursor-pointer transition-transform active:scale-90"
                    title="Expandir em tela quase cheia"
                    aria-label="Expandir em tela cheia"
                  >
                    <Maximize2 className="w-3.5 h-3.5" />
                  </button>
                </>
              )}

              {currentSnap === 'full' && (
                <button
                  type="button"
                  onClick={() => setSnap('half')}
                  className="w-8 h-8 rounded-full bg-black/5 dark:bg-white/10 hover:bg-black/10 text-slate-600 dark:text-slate-300 flex items-center justify-center cursor-pointer transition-transform active:scale-90"
                  title="Reduzir para metade"
                  aria-label="Restaurar tamanho da gaveta"
                >
                  <Minimize2 className="w-3.5 h-3.5" />
                </button>
              )}

              {/* Botão Recolher / Fechar */}
              <button
                type="button"
                onClick={onClose}
                className="w-8 h-8 rounded-full bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/15 text-slate-600 dark:text-slate-300 flex items-center justify-center cursor-pointer transition-transform active:scale-90 ml-1"
                title="Recolher gaveta"
                aria-label="Recolher gaveta"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Conteúdo Rolável do Sheet */}
        <div className={noPadding ? "flex-1 min-h-0 overflow-hidden flex flex-col" : "flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 py-3 select-text pb-[calc(env(safe-area-inset-bottom,0px)+72px)]"}>
          {children}
        </div>
      </section>
    </>
  );
};
