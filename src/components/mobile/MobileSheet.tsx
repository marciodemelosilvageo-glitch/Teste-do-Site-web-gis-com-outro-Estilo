import React, { useRef, useState, useEffect, useCallback } from 'react';
import { X } from 'lucide-react';
import { SidebarTab } from '../AppleSidebar';
import { MOBILE_Z_INDEX } from '../../constants/mobileZIndex';

export type SnapPoint = 'peek' | 'half' | 'full';

export interface MobileSheetProps {
  isOpen: boolean;
  activeTab: SidebarTab;
  onClose: () => void;
  onDismiss?: () => void;
  headerActions?: React.ReactNode;
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
 * Arraste fluido acelerado por hardware (GPU via translateY + rAF), sem re-renders React
 * no movimento. Ajuste de altura exclusivo via alça de arrasto.
 */
export const MobileSheet: React.FC<MobileSheetProps> = ({
  isOpen,
  activeTab: _activeTab,
  onClose,
  onDismiss,
  headerActions,
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

  const isDraggingRef = useRef(false);
  const startYRef = useRef<number>(0);
  const lastYRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);
  const velocityYRef = useRef<number>(0);
  const totalDeltaYRef = useRef<number>(0);
  const rAFIdRef = useRef<number | null>(null);
  const currentSnapRef = useRef<SnapPoint>(snapPoint);
  const sheetRef = useRef<HTMLDivElement>(null);

  // Sincroniza ref e estado com a prop externa se ela mudar
  useEffect(() => {
    setCurrentSnap(snapPoint);
    currentSnapRef.current = snapPoint;
  }, [snapPoint]);

  useEffect(() => {
    currentSnapRef.current = currentSnap;
  }, [currentSnap]);

  const setSnap = useCallback((nextSnap: SnapPoint) => {
    setCurrentSnap(nextSnap);
    currentSnapRef.current = nextSnap;
    onSnapChange?.(nextSnap);
  }, [onSnapChange]);

  // Gestão de arrasto com Pointer Events na alça superior (GPU transform, zero setState por quadro)
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    
    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {
      // Ignora erro se pointer não puder ser capturado
    }

    isDraggingRef.current = true;
    startYRef.current = e.clientY;
    lastYRef.current = e.clientY;
    lastTimeRef.current = performance.now();
    velocityYRef.current = 0;
    totalDeltaYRef.current = 0;

    setIsDragging(true);
    document.documentElement.setAttribute('data-sheet-dragging', 'true');

    if (sheetRef.current) {
      sheetRef.current.style.transition = 'none';
      sheetRef.current.style.willChange = 'transform';
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current) return;
    
    const now = performance.now();
    const dt = now - lastTimeRef.current;
    if (dt > 8) {
      velocityYRef.current = (e.clientY - lastYRef.current) / dt;
      lastYRef.current = e.clientY;
      lastTimeRef.current = now;
    }

    const rawDeltaY = e.clientY - startYRef.current;
    totalDeltaYRef.current = rawDeltaY;

    // Resistência elástica ao tentar puxar para cima além do limite 'full' (92vh)
    const windowH = window.innerHeight || 800;
    const currentSnapH = (SNAP_HEIGHTS[currentSnapRef.current] / 100) * windowH;
    const maxSnapH = (SNAP_HEIGHTS['full'] / 100) * windowH;
    const maxDeltaUp = -(maxSnapH - currentSnapH);

    let appliedDeltaY = rawDeltaY;
    if (rawDeltaY < maxDeltaUp) {
      const overscroll = maxDeltaUp - rawDeltaY;
      appliedDeltaY = maxDeltaUp - Math.pow(overscroll, 0.72) * 2.5;
    }

    if (rAFIdRef.current) cancelAnimationFrame(rAFIdRef.current);
    rAFIdRef.current = requestAnimationFrame(() => {
      if (sheetRef.current && isDraggingRef.current) {
        sheetRef.current.style.transform = `translate3d(0, ${appliedDeltaY}px, 0)`;
      }
    });
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current) return;
    
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      // Ignora erro se pointer já foi liberado
    }

    if (rAFIdRef.current) cancelAnimationFrame(rAFIdRef.current);
    isDraggingRef.current = false;
    setIsDragging(false);
    document.documentElement.removeAttribute('data-sheet-dragging');

    const totalDeltaY = totalDeltaYRef.current;
    const velocity = velocityYRef.current; // positivo = arrastando para baixo
    const windowH = window.innerHeight || 800;
    const startHeightPx = (SNAP_HEIGHTS[currentSnapRef.current] / 100) * windowH;
    const actualHeightPx = Math.max(0, startHeightPx - totalDeltaY);
    const actualHeightVh = (actualHeightPx / windowH) * 100;

    // Se arrastou muito para baixo (abaixo de ~18vh) ou flick rápido para baixo, fecha/recolhe
    const isDismissing =
      actualHeightVh < 18 ||
      (totalDeltaY > 100 && velocity > 0.45) ||
      (currentSnapRef.current === 'peek' && totalDeltaY > 50 && velocity > 0.2);

    if (isDismissing) {
      if (sheetRef.current) {
        sheetRef.current.style.transition = 'transform 0.28s cubic-bezier(0.32, 1, 0.23, 1)';
        sheetRef.current.style.transform = 'translate3d(0, 105%, 0)';
      }
      setTimeout(() => {
        if (sheetRef.current) {
          sheetRef.current.style.transform = '';
          sheetRef.current.style.transition = '';
          sheetRef.current.style.willChange = 'auto';
        }
        if (onDismiss) {
          onDismiss();
        } else {
          onClose();
        }
      }, 280);
      return;
    }

    // Determina o snap point de destino considerando inércia e proximidade
    let targetSnap: SnapPoint = currentSnapRef.current;
    if (velocity < -0.4) {
      // Flick para cima
      if (currentSnapRef.current === 'peek') targetSnap = 'half';
      else if (currentSnapRef.current === 'half') targetSnap = 'full';
      else targetSnap = 'full';
    } else if (velocity > 0.4) {
      // Flick para baixo
      if (currentSnapRef.current === 'full') targetSnap = 'half';
      else if (currentSnapRef.current === 'half') targetSnap = 'peek';
      else targetSnap = 'peek';
    } else {
      // Por proximidade de altura
      if (actualHeightVh < 44) {
        targetSnap = 'peek';
      } else if (actualHeightVh < 76) {
        targetSnap = 'half';
      } else {
        targetSnap = 'full';
      }
    }

    // Animação FLIP no snap final: compensa a nova altura via transform para transição 100% contínua
    const targetHeightPx = (SNAP_HEIGHTS[targetSnap] / 100) * windowH;
    const initialTranslateY = targetHeightPx - actualHeightPx;

    setSnap(targetSnap);

    if (sheetRef.current) {
      const el = sheetRef.current;
      el.style.transition = 'none';
      el.style.transform = `translate3d(0, ${initialTranslateY}px, 0)`;

      // Força layout síncrono no elemento antes de engatar a curva cúbica suave
      void el.offsetHeight;

      el.style.transition = 'transform 0.32s cubic-bezier(0.2, 0.9, 0.4, 1.0)';
      el.style.transform = 'translate3d(0, 0, 0)';

      const cleanup = () => {
        if (sheetRef.current) {
          sheetRef.current.style.transition = '';
          sheetRef.current.style.transform = '';
          sheetRef.current.style.willChange = 'auto';
        }
        el.removeEventListener('transitionend', cleanup);
      };
      el.addEventListener('transitionend', cleanup, { once: true });
    }
  };

  // Sincroniza a altura visível e snap point nas variáveis globais APENAS quando troca de snap ou abre/fecha
  useEffect(() => {
    if (!isOpen) {
      document.documentElement.removeAttribute('data-mobile-sheet-snap');
      document.documentElement.style.setProperty('--mobile-sheet-visible-height', '0px');
      window.dispatchEvent(new CustomEvent('mobile-sheet-resize', { detail: { height: 0, snap: null } }));
      return;
    }

    document.documentElement.setAttribute('data-mobile-sheet-snap', currentSnap);
    const windowH = window.innerHeight || 800;
    const px = Math.round((SNAP_HEIGHTS[currentSnap] / 100) * windowH);
    document.documentElement.style.setProperty('--mobile-sheet-visible-height', `${px}px`);
    window.dispatchEvent(new CustomEvent('mobile-sheet-resize', { detail: { height: px, snap: currentSnap } }));

    return () => {
      document.documentElement.removeAttribute('data-mobile-sheet-snap');
      document.documentElement.style.setProperty('--mobile-sheet-visible-height', '0px');
      window.dispatchEvent(new CustomEvent('mobile-sheet-resize', { detail: { height: 0, snap: null } }));
    };
  }, [isOpen, currentSnap]);

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop transparente ou semitransparente em modo tela cheia (92%) */}
      {currentSnap === 'full' && (
        <div 
          className="fixed inset-0 bg-black/25 backdrop-blur-[2px] transition-opacity duration-300 md:hidden"
          style={{ zIndex: MOBILE_Z_INDEX.SHEET_BACKDROP }}
          onClick={onDismiss || onClose}
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
          height: `${SNAP_HEIGHTS[currentSnap]}dvh`,
          contain: 'content'
        }}
        className={`fixed bottom-0 inset-x-0 max-w-lg mx-auto border-t border-black/10 dark:border-white/10 rounded-t-[28px] shadow-[0_-8px_32px_rgba(0,0,0,0.18)] dark:shadow-[0_-8px_32px_rgba(0,0,0,0.6)] flex flex-col overflow-hidden select-none ${
          isDragging
            ? 'bg-white dark:bg-[#1c1c1e]'
            : 'bg-white/95 dark:bg-[#1c1c1e]/95 backdrop-blur-3xl'
        }`}
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

            <div className="flex items-center gap-1.5 shrink-0">
              {headerActions}

              {/* Botão Fechar (X) com alvo de toque iOS de 44px */}
              <button
                type="button"
                onClick={onClose}
                className="w-11 h-11 min-w-[44px] min-h-[44px] -mr-1.5 flex items-center justify-center cursor-pointer active:scale-90 transition-transform"
                title="Fechar"
                aria-label="Fechar gaveta"
              >
                <div className="w-8 h-8 rounded-full bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/15 text-slate-600 dark:text-slate-300 flex items-center justify-center">
                  <X className="w-4 h-4 stroke-[2.5]" />
                </div>
              </button>
            </div>
          </div>
        )}

        {/* Conteúdo Rolável do Sheet */}
        <div className={noPadding ? "flex-1 min-h-0 overflow-hidden flex flex-col pb-[max(12px,env(safe-area-inset-bottom,0px))]" : "flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 py-3 select-text pb-[calc(env(safe-area-inset-bottom,0px)+72px)]"}>
          {children}
        </div>
      </section>
    </>
  );
};
