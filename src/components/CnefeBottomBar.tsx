import React, { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { 
  Home, 
  Search, 
  ChevronUp, 
  ChevronDown, 
  Trash2, 
  MapPin, 
  Building2, 
  Maximize2, 
  Minimize2, 
  Sparkles,
  GripHorizontal,
  X,
  Loader2 
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { IbgeSearchPanel, ExternalPolygonSearchResult } from './IbgeSearchPanel';
import { MOBILE_Z_INDEX } from '../constants/mobileZIndex';
import { useAccess } from '../context/FeatureAccessContext';

export interface CnefeBottomBarProps {
  isOpen?: boolean;
  onOpen?: () => void;
  onClose?: () => void;
  isExpanded: boolean;
  onToggleExpand: () => void;
  isMaximized?: boolean;
  onToggleMaximize?: () => void;
  onPlotAddress: (address: any) => void;
  onPlotAllAddresses?: (addresses: any[]) => void;
  onClearPlot?: () => void;
  onUnplot?: () => void;
  onClearExternalResult?: () => void;
  externalPolygonResult?: ExternalPolygonSearchResult | null;
  allowedColumns?: Record<string, boolean>;
  hasPlottedMarkers?: boolean;
  isStage2Open?: boolean;
  isSearchingExternal?: boolean;
  isMobile?: boolean;
  onSearchStateChange?: (hasResults: boolean) => void;
}

export const CnefeBottomBar: React.FC<CnefeBottomBarProps> = React.memo(({
  isOpen = true,
  isExpanded,
  onToggleExpand,
  isMaximized: isMaximizedProp,
  onToggleMaximize,
  onPlotAddress,
  onPlotAllAddresses,
  onClearPlot,
  onUnplot,
  onClearExternalResult,
  externalPolygonResult,
  allowedColumns,
  hasPlottedMarkers = false,
  isStage2Open = false,
  isSearchingExternal = false,
  isMobile = false,
  onSearchStateChange,
}) => {
  const [internalMaximized, setInternalMaximized] = useState<boolean>(false);
  const isMaximized = isMaximizedProp !== undefined ? isMaximizedProp : internalMaximized;
  const { can, guardAction } = useAccess();

  // Fecha ou recolhe automaticamente a barra se a permissão de busca avançada for revogada
  useEffect(() => {
    if (isExpanded && !can('tool:advanced_search')) {
      onToggleExpand();
    }
  }, [isExpanded, can, onToggleExpand]);

  // Estados e Refs para gesto de arrasto da gaveta no mobile (< 768px) com dois pontos de parada (half ~55vh e full ~90vh)
  const [mobileSnap, setMobileSnap] = useState<'half' | 'full'>('half');
  const mobileSnapRef = useRef<'half' | 'full'>('half');
  mobileSnapRef.current = mobileSnap;
  const mobileSheetRef = useRef<HTMLDivElement>(null);

  const [isMobileDragging, setIsMobileDragging] = useState<boolean>(false);
  const isMobileDraggingRef = useRef<boolean>(false);
  const mobileStartYRef = useRef<number>(0);
  const mobileLastYRef = useRef<number>(0);
  const mobileLastTimeRef = useRef<number>(0);
  const mobileVelocityYRef = useRef<number>(0);
  const mobileTotalDeltaYRef = useRef<number>(0);
  const mobileRAFIdRef = useRef<number | null>(null);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState<boolean>(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mediaQuery.matches);
    const handler = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);

  // Evento customizado para permitir que outros componentes (ex: handlePlotAddress) solicitem ajuste de snap
  useEffect(() => {
    if (!isMobile) return;
    const handleSnapTo = (e: Event) => {
      const detail = (e as CustomEvent<{ snap: 'half' | 'full' }>).detail;
      if (detail?.snap && (detail.snap === 'half' || detail.snap === 'full')) {
        setMobileSnap(detail.snap);
        mobileSnapRef.current = detail.snap;
        if (!isExpandedRef.current && onToggleExpandRef.current && can('tool:advanced_search')) {
          onToggleExpandRef.current();
        }
      }
    };
    window.addEventListener('cnefe-snap-to', handleSnapTo);
    return () => window.removeEventListener('cnefe-snap-to', handleSnapTo);
  }, [isMobile, can]);

  // Fechar/minimizar gaveta mobile com tecla Escape
  useEffect(() => {
    if (!isMobile || !isExpanded) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (typeof document !== 'undefined' && mobileSheetRef.current) {
          if (document.activeElement && mobileSheetRef.current.contains(document.activeElement)) {
            (document.activeElement as HTMLElement)?.blur();
          }
        }
        if (onToggleMaximizeRef.current && isMaximizedRef.current) {
          onToggleMaximizeRef.current();
        }
        onToggleExpandRef.current();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isMobile, isExpanded]);

  // Evitar aviso de foco retido em elemento aria-hidden ao recolher gaveta no mobile
  useEffect(() => {
    if (!isMobile) return;
    if (!isExpanded || !isOpen) {
      if (typeof document !== 'undefined' && mobileSheetRef.current) {
        if (document.activeElement && mobileSheetRef.current.contains(document.activeElement)) {
          (document.activeElement as HTMLElement)?.blur();
        }
      }
    }
  }, [isMobile, isExpanded, isOpen]);

  const handleMobileDragPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    if ((e.target as HTMLElement).closest('button')) return;
    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {}
    isMobileDraggingRef.current = true;
    mobileStartYRef.current = e.clientY;
    mobileLastYRef.current = e.clientY;
    mobileLastTimeRef.current = performance.now();
    mobileVelocityYRef.current = 0;
    mobileTotalDeltaYRef.current = 0;
    setIsMobileDragging(true);
    document.documentElement.setAttribute('data-sheet-dragging', 'true');
    if (mobileSheetRef.current) {
      mobileSheetRef.current.style.transition = 'none';
      mobileSheetRef.current.style.willChange = 'transform';
    }
  };

  const handleMobileDragPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isMobileDraggingRef.current) return;
    const now = performance.now();
    const dt = now - mobileLastTimeRef.current;
    if (dt > 8) {
      mobileVelocityYRef.current = (e.clientY - mobileLastYRef.current) / dt;
      mobileLastYRef.current = e.clientY;
      mobileLastTimeRef.current = now;
    }
    const rawDeltaY = e.clientY - mobileStartYRef.current;
    mobileTotalDeltaYRef.current = rawDeltaY;

    // Resistência elástica ao tentar puxar para cima além do limite 'full' (90vh)
    const windowH = window.innerHeight || 800;
    const currentSnapH = ((mobileSnapRef.current === 'full' ? 90 : 55) / 100) * windowH;
    const maxSnapH = 0.90 * windowH;
    const maxDeltaUp = -(maxSnapH - currentSnapH);

    let appliedDeltaY = rawDeltaY;
    if (rawDeltaY < maxDeltaUp) {
      const overscroll = maxDeltaUp - rawDeltaY;
      appliedDeltaY = maxDeltaUp - Math.pow(overscroll, 0.72) * 2.5;
    }

    if (mobileRAFIdRef.current) cancelAnimationFrame(mobileRAFIdRef.current);
    mobileRAFIdRef.current = requestAnimationFrame(() => {
      if (mobileSheetRef.current && isMobileDraggingRef.current) {
        mobileSheetRef.current.style.transform = `translate3d(0, ${appliedDeltaY}px, 0)`;
      }
    });
  };

  const handleMobileDragPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isMobileDraggingRef.current) return;
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {}
    if (mobileRAFIdRef.current) cancelAnimationFrame(mobileRAFIdRef.current);
    isMobileDraggingRef.current = false;
    setIsMobileDragging(false);
    document.documentElement.removeAttribute('data-sheet-dragging');

    const totalDeltaY = mobileTotalDeltaYRef.current;
    const velocity = mobileVelocityYRef.current; // positivo = arrastando para baixo
    const windowH = window.innerHeight || 800;
    const startHPx = ((mobileSnapRef.current === 'full' ? 90 : 55) / 100) * windowH;
    const actualHPx = Math.max(0, startHPx - totalDeltaY);
    const actualHVh = (actualHPx / windowH) * 100;

    // Se arrastou muito para baixo (abaixo de 25vh) ou flick para baixo a partir de half, minimiza a gaveta
    const isDismissing =
      (mobileSnapRef.current === 'half' && (totalDeltaY > 80 || velocity > 0.4)) ||
      actualHVh < 25;

    if (isDismissing) {
      if (mobileSheetRef.current) {
        mobileSheetRef.current.style.transition = 'transform 0.28s cubic-bezier(0.32, 1, 0.23, 1)';
        mobileSheetRef.current.style.transform = 'translate3d(0, 105%, 0)';
      }
      setTimeout(() => {
        if (mobileSheetRef.current) {
          mobileSheetRef.current.style.transform = '';
          mobileSheetRef.current.style.transition = '';
          mobileSheetRef.current.style.willChange = 'auto';
        }
        onToggleExpandRef.current();
      }, 280);
      return;
    }

    // Determina o snap point de destino considerando inércia e proximidade
    let targetSnap: 'half' | 'full' = mobileSnapRef.current;
    if (velocity < -0.35) {
      targetSnap = 'full';
    } else if (velocity > 0.35) {
      targetSnap = 'half';
    } else {
      targetSnap = actualHVh > 72 ? 'full' : 'half';
    }

    // Animação FLIP no snap final: compensa a nova altura via transform para transição suave
    const targetHPx = ((targetSnap === 'full' ? 90 : 55) / 100) * windowH;
    const initialTranslateY = targetHPx - actualHPx;

    setMobileSnap(targetSnap);
    mobileSnapRef.current = targetSnap;

    if (mobileSheetRef.current) {
      const el = mobileSheetRef.current;
      el.style.transition = 'none';
      el.style.transform = `translate3d(0, ${initialTranslateY}px, 0)`;

      void el.offsetHeight;

      el.style.transition = 'transform 0.32s cubic-bezier(0.2, 0.9, 0.4, 1.0)';
      el.style.transform = 'translate3d(0, 0, 0)';

      const cleanup = () => {
        if (mobileSheetRef.current) {
          mobileSheetRef.current.style.transition = '';
          mobileSheetRef.current.style.transform = '';
          mobileSheetRef.current.style.willChange = 'auto';
        }
        el.removeEventListener('transitionend', cleanup);
      };
      el.addEventListener('transitionend', cleanup, { once: true });
    }
  };

  // Altura personalizada definida pelo usuário via arrasto
  const [customHeight, setCustomHeight] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const isDraggingRef = useRef<boolean>(false);
  const rafIdRef = useRef<number | null>(null);
  const currentClampedHeightRef = useRef<number>(0);
  const barContainerRef = useRef<HTMLDivElement>(null);
  const dragStartYRef = useRef<number>(0);
  const dragStartHeightRef = useRef<number>(0);

  // Refs atualizadas para evitar stale closures em eventos e timeouts
  const isExpandedRef = useRef<boolean>(isExpanded);
  isExpandedRef.current = isExpanded;
  const isMaximizedRef = useRef<boolean>(isMaximized);
  isMaximizedRef.current = isMaximized;
  const onToggleMaximizeRef = useRef(onToggleMaximize);
  onToggleMaximizeRef.current = onToggleMaximize;
  const onToggleExpandRef = useRef(onToggleExpand);
  onToggleExpandRef.current = onToggleExpand;

  const isInitialMountRef = useRef<boolean>(true);
  const prevHeightRef = useRef<number>(46);
  const animTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Transição fluida de abertura/recolhimento/maximização via técnica FLIP (transform: translateY)
  // Aplica a altura final imediatamente (evitando recálculo de layout a cada frame de height)
  // e anima GPU-accelerated translateY do delta até 0.
  useLayoutEffect(() => {
    if (isInitialMountRef.current) {
      isInitialMountRef.current = false;
      prevHeightRef.current = barContainerRef.current?.getBoundingClientRect().height || 46;
      return;
    }

    // Se estiver em arrasto manual, o arrasto já atualiza em tempo real
    if (isDraggingRef.current) {
      prevHeightRef.current = barContainerRef.current?.getBoundingClientRect().height || 46;
      return;
    }

    const container = barContainerRef.current;
    if (!container) return;

    const prevHeight = prevHeightRef.current;
    const currentRect = container.getBoundingClientRect();
    const currentHeight = currentRect.height;
    prevHeightRef.current = currentHeight;

    const deltaY = currentHeight - prevHeight;
    if (Math.abs(deltaY) < 2) return;

    // Marcação síncrona antes da pintura para desligar backdrop-filter durante a animação
    document.documentElement.setAttribute('data-cnefe-animating', 'true');

    const prefersReducedMotion = typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (prefersReducedMotion) {
      document.documentElement.removeAttribute('data-cnefe-animating');
      return;
    }

    // 1. Invert: desloca a barra para que o topo aparente fique exatamente onde estava
    container.style.transition = 'none';
    container.style.transform = `translateY(${deltaY}px)`;

    // Forçar reflow local mínimo para computar a posição inicial
    void container.offsetHeight;

    // 2. Play: anima transform para translateY(0) usando GPU compositor
    requestAnimationFrame(() => {
      if (!barContainerRef.current) return;
      barContainerRef.current.style.transition = 'transform 250ms cubic-bezier(0.16, 1, 0.3, 1), left 300ms ease-out';
      barContainerRef.current.style.transform = 'translateY(0)';
    });

    if (animTimeoutRef.current) clearTimeout(animTimeoutRef.current);
    animTimeoutRef.current = setTimeout(() => {
      document.documentElement.removeAttribute('data-cnefe-animating');
      if (barContainerRef.current) {
        barContainerRef.current.style.transform = '';
        barContainerRef.current.style.transition = '';
      }
    }, 320);
  }, [isExpanded, isMaximized, customHeight]);

  const handleTransitionEnd = (e: React.TransitionEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget) return;
    if (e.propertyName === 'transform') {
      document.documentElement.removeAttribute('data-cnefe-animating');
      if (animTimeoutRef.current) {
        clearTimeout(animTimeoutRef.current);
        animTimeoutRef.current = null;
      }
      if (barContainerRef.current) {
        barContainerRef.current.style.transform = '';
        barContainerRef.current.style.transition = '';
      }
    }
  };

  // Sincronizar variável CSS global --cnefe-bottom-height para que elementos do mapa (legenda/legal) acompanhem
  useEffect(() => {
    if (isDraggingRef.current) return;

    if (!isOpen || (isMobile && !isExpanded)) {
      document.documentElement.style.setProperty('--cnefe-bottom-height', '0px');
    } else if (!isExpanded) {
      document.documentElement.style.setProperty('--cnefe-bottom-height', '46px');
    } else if (customHeight != null) {
      document.documentElement.style.setProperty('--cnefe-bottom-height', `${customHeight}px`);
    } else if (isMaximized) {
      document.documentElement.style.setProperty('--cnefe-bottom-height', '82vh');
    } else {
      document.documentElement.style.setProperty('--cnefe-bottom-height', '46vh');
    }
  }, [isOpen, isExpanded, customHeight, isMaximized, isMobile]);

  // Sincronização mobile para mobile-sheet-resize quando o painel CNEFE é expandido como gaveta
  useEffect(() => {
    if (!isMobile) return;
    if (isExpanded) {
      const snapVh = mobileSnap === 'full' ? 90 : 55;
      const h = Math.round(((window.innerHeight || 800) * snapVh) / 100);
      window.dispatchEvent(new CustomEvent('mobile-sheet-resize', { detail: { height: h, snap: mobileSnap } }));
    } else {
      window.dispatchEvent(new CustomEvent('mobile-sheet-resize', { detail: { height: 0, snap: null } }));
    }
  }, [isMobile, isExpanded, mobileSnap]);

  // Sincronizar variável CSS --cnefe-sheet-h e atributo data-cnefe-snap para cálculo exato de altura no mobile
  useEffect(() => {
    if (!isMobile) {
      document.documentElement.style.removeProperty('--cnefe-sheet-h');
      document.documentElement.removeAttribute('data-cnefe-snap');
      return;
    }
    if (isExpanded) {
      const snapVal = mobileSnap === 'full' ? '90dvh' : '55dvh';
      document.documentElement.style.setProperty('--cnefe-sheet-h', snapVal);
      document.documentElement.setAttribute('data-cnefe-snap', mobileSnap);
    } else {
      document.documentElement.style.setProperty('--cnefe-sheet-h', '0px');
      document.documentElement.removeAttribute('data-cnefe-snap');
    }
    return () => {
      document.documentElement.style.removeProperty('--cnefe-sheet-h');
      document.documentElement.removeAttribute('data-cnefe-snap');
    };
  }, [isMobile, isExpanded, mobileSnap]);

  // Sincronizar data-cnefe-expanded no html e evento customizado para controle limpo de minimização da legenda
  useEffect(() => {
    if (isExpanded) {
      document.documentElement.setAttribute('data-cnefe-expanded', 'true');
    } else {
      document.documentElement.removeAttribute('data-cnefe-expanded');
    }
    window.dispatchEvent(new CustomEvent('cnefe-bar-expanded-change', { detail: { isExpanded } }));
    return () => {
      document.documentElement.removeAttribute('data-cnefe-expanded');
    };
  }, [isExpanded]);

  useEffect(() => {
    return () => {
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
      }
      if (animTimeoutRef.current) {
        clearTimeout(animTimeoutRef.current);
      }
      document.documentElement.removeAttribute('data-cnefe-dragging');
      document.documentElement.removeAttribute('data-cnefe-animating');
      document.documentElement.removeAttribute('data-cnefe-expanded');
      document.documentElement.removeAttribute('data-cnefe-snap');
      document.documentElement.style.removeProperty('--cnefe-bottom-height');
      document.documentElement.style.removeProperty('--cnefe-sheet-h');
    };
  }, []);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    // Permite apenas clique com botão principal do mouse ou toque/stylus
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    e.preventDefault();
    e.stopPropagation();

    const targetEl = e.currentTarget;
    try {
      targetEl.setPointerCapture(e.pointerId);
    } catch {}

    const rect = barContainerRef.current?.getBoundingClientRect();
    const currentHeight = rect ? rect.height : (customHeight || (isMaximized ? window.innerHeight * 0.82 : window.innerHeight * 0.46));

    dragStartYRef.current = e.clientY;
    dragStartHeightRef.current = currentHeight;
    currentClampedHeightRef.current = currentHeight;
    isDraggingRef.current = true;
    setIsDragging(true);
    document.documentElement.setAttribute('data-cnefe-dragging', 'true');

    const updateHeightDirect = () => {
      const heightVal = `${currentClampedHeightRef.current}px`;
      if (barContainerRef.current) {
        barContainerRef.current.style.height = heightVal;
        barContainerRef.current.style.setProperty('--cnefe-bottom-height', heightVal);
      }
      // Não escreve no documentElement durante o arrasto a cada frame para evitar relayout global
      rafIdRef.current = null;
    };

    const onPointerMove = (moveEvent: PointerEvent) => {
      moveEvent.preventDefault();
      // Arrastar para CIMA aumenta a altura; arrastar para BAIXO diminui
      const deltaY = dragStartYRef.current - moveEvent.clientY;
      const rawHeight = dragStartHeightRef.current + deltaY;

      // Limitar entre altura mínima (180px) e máxima (92vh)
      const minHeight = 180;
      const maxHeight = Math.min(window.innerHeight * 0.92, window.innerHeight - 50);
      const clampedHeight = Math.max(minHeight, Math.min(maxHeight, rawHeight));
      currentClampedHeightRef.current = clampedHeight;

      // Agrupar atualizações com requestAnimationFrame (no máximo uma por frame)
      if (rafIdRef.current === null) {
        rafIdRef.current = requestAnimationFrame(updateHeightDirect);
      }
    };

    const cleanupDrag = () => {
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
      isDraggingRef.current = false;
      document.documentElement.removeAttribute('data-cnefe-dragging');
      setIsDragging(false);

      try {
        if (targetEl && targetEl.hasPointerCapture(e.pointerId)) {
          targetEl.releasePointerCapture(e.pointerId);
        }
      } catch {}

      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerCancel);
    };

    const onPointerUp = (upEvent: PointerEvent) => {
      upEvent.preventDefault();
      const deltaY = dragStartYRef.current - upEvent.clientY;
      const finalHeight = dragStartHeightRef.current + deltaY;

      cleanupDrag();

      // Se arrastar muito para baixo (menos de 130px), recolhe a barra
      if (finalHeight < 130) {
        setCustomHeight(null);
        if (barContainerRef.current) {
          barContainerRef.current.style.height = '46px';
          barContainerRef.current.style.removeProperty('--cnefe-bottom-height');
        }
        document.documentElement.style.setProperty('--cnefe-bottom-height', '46px');
        if (isMaximizedRef.current && onToggleMaximizeRef.current) {
          onToggleMaximizeRef.current();
        }
        setInternalMaximized(false);
        onToggleExpandRef.current();
      } else {
        const minHeight = 180;
        const maxHeight = Math.min(window.innerHeight * 0.92, window.innerHeight - 50);
        const finalClampedHeight = Math.max(minHeight, Math.min(maxHeight, finalHeight));

        // Se estiver perto do topo (> 78vh), sincroniza maximizado
        if (finalHeight >= window.innerHeight * 0.78) {
          if (!isMaximizedRef.current && onToggleMaximizeRef.current) {
            onToggleMaximizeRef.current();
          }
          setCustomHeight(null);
          if (barContainerRef.current) {
            barContainerRef.current.style.height = '82vh';
            barContainerRef.current.style.removeProperty('--cnefe-bottom-height');
          }
          document.documentElement.style.setProperty('--cnefe-bottom-height', '82vh');
        } else {
          if (isMaximizedRef.current && onToggleMaximizeRef.current) {
            onToggleMaximizeRef.current();
          }
          setCustomHeight(finalClampedHeight);
          if (barContainerRef.current) {
            barContainerRef.current.style.height = `${finalClampedHeight}px`;
            barContainerRef.current.style.removeProperty('--cnefe-bottom-height');
          }
          document.documentElement.style.setProperty('--cnefe-bottom-height', `${finalClampedHeight}px`);
        }
      }
    };

    const onPointerCancel = () => {
      cleanupDrag();
    };

    window.addEventListener('pointermove', onPointerMove, { passive: false });
    window.addEventListener('pointerup', onPointerUp, { passive: false });
    window.addEventListener('pointercancel', onPointerCancel, { passive: false });
  };

  const handleToggleMaximize = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setCustomHeight(null);
    if (onToggleMaximize) {
      onToggleMaximize();
    } else {
      setInternalMaximized(prev => !prev);
    }
  };

  const handleToggleExpand = (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (!isExpanded && !can('tool:advanced_search')) {
      guardAction('tool:advanced_search', 'Busca Avançada de Endereços', () => {});
      return;
    }
    if (isExpanded) {
      // Ao recolher, reseta estado maximizado e altura customizada
      if (isMaximized && onToggleMaximize) {
        onToggleMaximize();
      }
      setInternalMaximized(false);
      setCustomHeight(null);
    }
    onToggleExpand();
  };

  // ==============================================================
  // RENDERIZAÇÃO MOBILE: NÃO MOSTRA FAIXA DE 46PX, ABRE COMO GAVETA
  // ==============================================================
  if (isMobile) {
    const isVisible = isOpen && isExpanded;
    const snapVh = mobileSnap === 'full' ? 90 : 55;

    return (
      <div 
        className={`fixed inset-0 flex flex-col justify-end select-none transition-[visibility] duration-300 pointer-events-none ${
          isVisible ? '' : 'invisible'
        }`}
        style={{ zIndex: MOBILE_Z_INDEX.SHEET }}
        role="dialog"
        aria-modal={isVisible && mobileSnap === 'full' ? 'true' : 'false'}
        aria-label="Busca de Endereços Avançada"
        aria-hidden={!isVisible ? 'true' : undefined}
        inert={!isVisible}
      >
        {/* Backdrop Translúcido: Apenas ativo/clicável quando em tela cheia (em meia tela o mapa fica livre) */}
        <div 
          className={`fixed inset-0 bg-black/40 dark:bg-black/60 backdrop-blur-sm transition-opacity duration-300 z-0 ${
            isVisible && mobileSnap === 'full' ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
          }`}
          onClick={() => {
            if (isMobileDragging) return;
            onToggleExpand();
          }}
          aria-hidden="true"
        />

        {/* Conteúdo da Gaveta com snap dinâmico (half / full) e GPU transform direto */}
        <div 
          ref={mobileSheetRef}
          data-snap={mobileSnap}
          style={{
            height: `${snapVh}dvh`,
            maxHeight: `${snapVh}dvh`,
            transform: !isVisible ? 'translate3d(0, 105%, 0)' : undefined,
            transition: isMobileDragging
              ? 'none'
              : 'transform 0.28s cubic-bezier(0.32, 0.72, 0, 1), height 0.28s cubic-bezier(0.32, 0.72, 0, 1)',
            ['--cnefe-sheet-h' as any]: `${snapVh}dvh`,
          }}
          className="relative z-10 w-full max-w-lg mx-auto bg-white/95 dark:bg-[#1c1c1e]/95 backdrop-blur-3xl border-t border-black/10 dark:border-white/10 rounded-t-3xl shadow-2xl flex flex-col overflow-hidden pointer-events-auto"
        >
          {/* Fundo estendido abaixo da gaveta para não deixar vão durante puxada para cima */}
          <div
            aria-hidden="true"
            className="absolute top-full left-0 right-0 h-[60vh] bg-white/95 dark:bg-[#1c1c1e]/95 pointer-events-none border-x border-black/10 dark:border-white/10"
          />

          {/* Barra de Progresso Indeterminada durante Busca Externa */}
          {isSearchingExternal && (
            <div className="absolute top-0 left-0 right-0 h-[2.5px] bg-[#007AFF]/20 overflow-hidden z-40">
              <div className="h-full bg-gradient-to-r from-[#007AFF] via-[#5856D6] to-[#007AFF] cnefe-progress-indeterminate" />
            </div>
          )}

          {/* Zona de Arraste Superior: Alça + Cabeçalho (touch-action: none) */}
          <div
            onPointerDown={handleMobileDragPointerDown}
            onPointerMove={handleMobileDragPointerMove}
            onPointerUp={handleMobileDragPointerUp}
            onPointerCancel={handleMobileDragPointerUp}
            className="touch-none select-none shrink-0 cursor-grab active:cursor-grabbing"
          >
            {/* Alça de Arraste Superior */}
            <div className="w-12 h-1.5 bg-slate-300 dark:bg-slate-700 rounded-full mx-auto shrink-0 mt-3 mb-1" />

            {/* Cabeçalho Limpo */}
            <div className="w-full px-4 py-2.5 flex items-center justify-between gap-3 border-b border-black/5 dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.02]">
              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                <div className="w-7 h-7 rounded-xl bg-gradient-to-tr from-[#007AFF] to-[#5856D6] text-white flex items-center justify-center shrink-0 shadow-sm">
                  <Home className="w-4 h-4" />
                </div>
                <div className="flex items-center gap-2 min-w-0 flex-wrap">
                  <span className="font-black text-slate-900 dark:text-white truncate text-xs sm:text-sm tracking-tight">
                    Busca de Endereços Avançada
                  </span>
                  {!isSearchingExternal && externalPolygonResult && (
                    <span className="inline-flex items-center gap-1.5 text-[11px] font-bold bg-emerald-50 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 pl-2 pr-1.5 py-0.5 rounded-full border border-emerald-200/80 dark:border-emerald-800/60 truncate max-w-[170px] shadow-2xs">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                      <span className="truncate">{externalPolygonResult.title}</span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (onClearExternalResult) onClearExternalResult();
                          if (onClearPlot) onClearPlot();
                        }}
                        className="p-0.5 hover:bg-emerald-200/70 dark:hover:bg-emerald-800/60 rounded-full text-emerald-700 dark:text-emerald-200 transition-colors cursor-pointer shrink-0"
                        title="Limpar pesquisa desta feição"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  )}
                </div>
              </div>

              {/* Ações: Limpar */}
              <div className="flex items-center gap-2 shrink-0">
                {(hasPlottedMarkers || externalPolygonResult) && onClearPlot && (
                  <button
                    type="button"
                    onClick={() => {
                      onClearPlot();
                      if (onClearExternalResult) onClearExternalResult();
                    }}
                    className="px-2.5 py-1.5 rounded-xl bg-black/5 dark:bg-white/10 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/50 dark:hover:text-red-400 text-slate-600 dark:text-slate-300 font-bold text-xs transition-colors cursor-pointer flex items-center gap-1.5 active:scale-95"
                    title="Limpar pesquisa e marcadores do mapa"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span className="hidden xs:inline">Limpar</span>
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Painel Interno: Mantido montado na mesma árvore React para preservar filtros/buscas/plotagem */}
          <div className="flex-1 overflow-y-auto custom-scrollbar px-3 sm:px-6 py-2 min-h-0 flex flex-col pb-[max(12px,env(safe-area-inset-bottom,0px))]">
            <IbgeSearchPanel
              embedded={true}
              isMaximized={true}
              isMobile={true}
              onPlotAddress={onPlotAddress}
              onPlotAllAddresses={onPlotAllAddresses}
              onClearPlot={onClearPlot}
              onUnplot={onUnplot}
              onClearExternalResult={onClearExternalResult}
              externalPolygonResult={externalPolygonResult}
              allowedColumns={allowedColumns}
              hasPlottedMarkers={hasPlottedMarkers}
              isExternalSearching={isSearchingExternal}
              onSearchStateChange={onSearchStateChange}
            />
          </div>
        </div>
      </div>
    );
  }

  // ==============================================================
  // RENDERIZAÇÃO ORIGINAL DESKTOP (INALTERADA)
  // ==============================================================
  return (
    <div 
      ref={barContainerRef}
      onTransitionEnd={handleTransitionEnd}
      style={
        !isOpen
          ? { display: 'none' }
          : {
              height: !isExpanded
                ? '46px'
                : customHeight
                ? `${customHeight}px`
                : isMaximized
                ? '82vh'
                : '46vh',
              maxHeight: isExpanded ? '92vh' : '46px',
              minHeight: isExpanded ? '180px' : '46px',
              left: isStage2Open && typeof window !== 'undefined' && window.innerWidth >= 768 ? '390px' : '0px'
            }
      }
      className={`cnefe-bottom-bar-container absolute bottom-0 left-0 right-0 z-[1100] pointer-events-auto flex flex-col bg-white/95 dark:bg-[#1c1c1e]/95 backdrop-blur-3xl border-t border-black/10 dark:border-white/10 shadow-[0_-8px_30px_rgba(0,0,0,0.15)] rounded-t-2xl sm:rounded-t-3xl overflow-hidden ${
        !isOpen ? 'hidden' : ''
      } ${
        isDragging ? 'transition-none select-none' : 'transition-[left] duration-300 ease-out'
      }`}
    >
      {/* ============================================================== */}
      {/* ZONA DE ARRASTAR DE BORDA SUPERIOR (HITBOX DE TOPO AMPLIADA) */}
      {/* ============================================================== */}
      {isExpanded && (
        <div 
          onPointerDown={handlePointerDown}
          className="absolute -top-2 left-0 right-0 h-6 z-30 cursor-ns-resize flex items-center justify-center hover:bg-[#007AFF]/10 transition-colors group/topdrag touch-none"
          style={{ touchAction: 'none' }}
          title="Clique e arraste para cima ou para baixo para ajustar a altura"
        />
      )}

      {/* Barra de Progresso Indeterminada durante Busca Externa */}
      {isSearchingExternal && (
        <div className="absolute top-0 left-0 right-0 h-[2.5px] bg-[#007AFF]/20 overflow-hidden z-40">
          <div className="h-full bg-gradient-to-r from-[#007AFF] via-[#5856D6] to-[#007AFF] cnefe-progress-indeterminate" />
        </div>
      )}

      {/* ============================================================== */}
      {/* CABEÇALHO / BARRA DOCK FIXA (SEMPRE VISÍVEL NA BASE DO MAPA) */}
      {/* ============================================================== */}
      <div 
        onClick={(e) => {
          if (!isExpanded) handleToggleExpand(e);
        }}
        className={`w-full px-3.5 sm:px-6 flex items-center justify-between gap-3 shrink-0 select-none cursor-pointer border-b transition-colors relative z-20 ${
          isExpanded 
            ? 'h-12 border-black/5 dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.02]' 
            : 'h-[46px] border-transparent hover:bg-black/[0.03] dark:hover:bg-white/[0.05]'
        }`}
        title={isExpanded ? "Clique no botão Recolher para fechar" : "Clique para abrir a busca de endereços"}
      >
        {/* Esquerda: Identificação da Ferramenta */}
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          <div className="w-7 h-7 rounded-xl bg-gradient-to-tr from-[#007AFF] to-[#5856D6] text-white flex items-center justify-center shrink-0 shadow-sm">
            <Home className="w-4 h-4" />
          </div>

          <div className="flex items-center gap-2 min-w-0 flex-wrap">
            <span className="font-black text-slate-900 dark:text-white truncate text-xs sm:text-sm tracking-tight">
              Busca de Endereços Avançado
            </span>

            {/* Indicação de Busca em Andamento */}
            {isSearchingExternal && (
              <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-[#007AFF] dark:text-blue-400 bg-blue-500/10 px-2.5 py-0.5 rounded-full animate-pulse shrink-0">
                <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
                <span>Buscando endereços...</span>
              </span>
            )}

            {/* Indicação de Polígono Ativo */}
            {!isSearchingExternal && externalPolygonResult && (
              <span className="inline-flex items-center gap-1.5 text-[11px] font-bold bg-emerald-50 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 pl-2 pr-1.5 py-0.5 rounded-full border border-emerald-200/80 dark:border-emerald-800/60 truncate max-w-[220px] sm:max-w-xs shadow-2xs">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                <span className="truncate">{externalPolygonResult.title}</span>
                <span className="text-[10px] opacity-75 shrink-0">({externalPolygonResult.totalEncontrado})</span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (onClearExternalResult) onClearExternalResult();
                    if (onClearPlot) onClearPlot();
                  }}
                  className="p-0.5 hover:bg-emerald-200/70 dark:hover:bg-emerald-800/60 rounded-full text-emerald-700 dark:text-emerald-200 transition-colors cursor-pointer shrink-0"
                  title="Limpar pesquisa desta feição"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
          </div>
        </div>

        {/* Centro: Alça de Arrastar Apple Maps (Drag Handle Interativo) */}
        <div 
          onPointerDown={isExpanded ? handlePointerDown : undefined}
          onDoubleClick={isExpanded ? handleToggleMaximize : undefined}
          className={`flex flex-col items-center justify-center py-1 select-none px-4 rounded-xl transition-all touch-none ${
            isExpanded 
              ? 'cursor-ns-resize hover:bg-black/5 dark:hover:bg-white/10 active:bg-blue-50 dark:active:bg-blue-950/40 group' 
              : 'pointer-events-none'
          }`}
          style={{ touchAction: 'none' }}
          title={isExpanded ? "Clique e arraste para ajustar a altura (ou duplo clique para maximizar)" : undefined}
        >
          <div className="flex items-center gap-1">
            <div className={`h-1.5 rounded-full transition-all duration-150 ${
              isDragging 
                ? 'bg-[#007AFF] w-16 scale-110 shadow-sm shadow-blue-500/50' 
                : 'bg-black/25 dark:bg-white/30 group-hover:bg-[#007AFF] dark:group-hover:bg-[#007AFF] w-12 group-hover:w-16'
            }`} />
          </div>
          {isExpanded && (
            <div className="flex items-center gap-1 text-[9px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 opacity-60 group-hover:opacity-100 group-hover:text-[#007AFF] transition-all">
              <GripHorizontal className="w-3 h-3" />
              <span className="hidden sm:inline">Arrastar</span>
            </div>
          )}
        </div>

        {/* Direita: Ações Rápidas & Toggle de Expandir/Recolher */}
        <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
          {/* Botão de Limpar Marcadores no Mapa / Pesquisa */}
          {(hasPlottedMarkers || externalPolygonResult) && onClearPlot && (
            <button
              type="button"
              onClick={() => {
                onClearPlot();
                if (onClearExternalResult) onClearExternalResult();
              }}
              className="px-2.5 py-1.5 rounded-xl bg-black/5 dark:bg-white/10 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/50 dark:hover:text-red-400 text-slate-600 dark:text-slate-300 font-bold text-xs transition-colors cursor-pointer flex items-center gap-1.5 active:scale-95"
              title="Limpar pesquisa e marcadores do mapa"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Limpar Pesquisa</span>
            </button>
          )}

          {/* Quando expandido: botão de tela cheia/restaurar */}
          {isExpanded && (
            <button
              type="button"
              onClick={handleToggleMaximize}
              className={`px-2.5 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-xs active:scale-95 ${
                isMaximized
                  ? 'bg-[#007AFF] text-white hover:bg-[#0066d6] shadow-blue-500/25'
                  : 'bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/15 text-slate-700 dark:text-slate-300'
              }`}
              title={isMaximized ? "Restaurar altura normal (ver mais mapa)" : "Expandir painel (ver mais tabela)"}
            >
              {isMaximized ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
              <span className="hidden md:inline">{isMaximized ? 'Restaurar' : 'Expandir'}</span>
            </button>
          )}

          {/* Botão Principal de Abrir / Recolher */}
          {can('tool:advanced_search') && (
            <button
              type="button"
              onClick={handleToggleExpand}
              className={`px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-xs active:scale-95 ${
                isExpanded
                  ? 'bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/15 text-slate-700 dark:text-slate-300'
                  : `bg-[#007AFF] hover:bg-[#0066d6] text-white shadow-blue-500/25 ${isSearchingExternal ? 'animate-pulse cnefe-btn-searching' : ''}`
              }`}
              title={isExpanded ? "Recolher barra para ver o mapa completo" : "Abrir busca de endereços de baixo para cima"}
            >
              <span>{isExpanded ? 'Recolher' : 'Abrir Busca'}</span>
              {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4 cnefe-bounce-limited" />}
            </button>
          )}
        </div>
      </div>

      {/* ============================================================== */}
      {/* CONTEÚDO EXPANDIDO (PRESERVADO NO LAYOUT, VISIVELMENTE OCULTO QUANDO RECOLHIDO) */}
      {/* ============================================================== */}
      <div 
        aria-hidden={!isExpanded}
        // @ts-expect-error inert is standard HTML5 attribute supported in React 19
        inert={!isExpanded ? '' : undefined}
        style={{
          visibility: isExpanded ? 'visible' : 'hidden',
          pointerEvents: isExpanded ? 'auto' : 'none',
          contentVisibility: isExpanded ? 'visible' : 'auto'
        }}
        className="flex-1 overflow-y-auto custom-scrollbar px-3 sm:px-6 py-2 min-h-0"
      >
        {can('tool:advanced_search') && (
          <IbgeSearchPanel
            embedded={true}
            isMaximized={isMaximized}
            onPlotAddress={onPlotAddress}
            onPlotAllAddresses={onPlotAllAddresses}
            onClearPlot={onClearPlot}
            onUnplot={onUnplot}
            onClearExternalResult={onClearExternalResult}
            externalPolygonResult={externalPolygonResult}
            allowedColumns={allowedColumns}
            hasPlottedMarkers={hasPlottedMarkers}
            isExternalSearching={isSearchingExternal}
            onSearchStateChange={onSearchStateChange}
          />
        )}
      </div>
    </div>
  );
});

CnefeBottomBar.displayName = 'CnefeBottomBar';
