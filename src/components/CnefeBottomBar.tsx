import React, { useState, useRef, useEffect } from 'react';
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
  X 
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { IbgeSearchPanel, ExternalPolygonSearchResult } from './IbgeSearchPanel';

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
  onClearExternalResult?: () => void;
  externalPolygonResult?: ExternalPolygonSearchResult | null;
  allowedColumns?: Record<string, boolean>;
  hasPlottedMarkers?: boolean;
  isStage2Open?: boolean;
}

export const CnefeBottomBar: React.FC<CnefeBottomBarProps> = ({
  isOpen = true,
  isExpanded,
  onToggleExpand,
  isMaximized: isMaximizedProp,
  onToggleMaximize,
  onPlotAddress,
  onPlotAllAddresses,
  onClearPlot,
  onClearExternalResult,
  externalPolygonResult,
  allowedColumns,
  hasPlottedMarkers = false,
  isStage2Open = false,
}) => {
  const [internalMaximized, setInternalMaximized] = useState<boolean>(false);
  const isMaximized = isMaximizedProp !== undefined ? isMaximizedProp : internalMaximized;

  // Altura personalizada definida pelo usuário via arrasto
  const [customHeight, setCustomHeight] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const barContainerRef = useRef<HTMLDivElement>(null);
  const dragStartYRef = useRef<number>(0);
  const dragStartHeightRef = useRef<number>(0);

  // Sincronizar variável CSS global --cnefe-bottom-height para que elementos do mapa (legenda/legal) e tabela acompanhem o arrasto
  useEffect(() => {
    if (!isOpen) {
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
  }, [isOpen, isExpanded, customHeight, isMaximized]);

  useEffect(() => {
    return () => {
      document.documentElement.style.removeProperty('--cnefe-bottom-height');
    };
  }, []);

  const handlePointerDown = (e: React.PointerEvent) => {
    // Permite apenas clique com botão principal do mouse ou toque/stylus
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    e.preventDefault();
    e.stopPropagation();

    const rect = barContainerRef.current?.getBoundingClientRect();
    const currentHeight = rect ? rect.height : (customHeight || (isMaximized ? window.innerHeight * 0.82 : window.innerHeight * 0.46));

    dragStartYRef.current = e.clientY;
    dragStartHeightRef.current = currentHeight;
    setIsDragging(true);

    const onPointerMove = (moveEvent: PointerEvent) => {
      moveEvent.preventDefault();
      // Arrastar para CIMA aumenta a altura; arrastar para BAIXO diminui
      const deltaY = dragStartYRef.current - moveEvent.clientY;
      const rawHeight = dragStartHeightRef.current + deltaY;

      // Limitar entre altura mínima (180px) e máxima (92vh)
      const minHeight = 180;
      const maxHeight = Math.min(window.innerHeight * 0.92, window.innerHeight - 50);
      const clampedHeight = Math.max(minHeight, Math.min(maxHeight, rawHeight));

      setCustomHeight(clampedHeight);
      document.documentElement.style.setProperty('--cnefe-bottom-height', `${clampedHeight}px`);
    };

    const onPointerUp = (upEvent: PointerEvent) => {
      upEvent.preventDefault();
      setIsDragging(false);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);

      const deltaY = dragStartYRef.current - upEvent.clientY;
      const finalHeight = dragStartHeightRef.current + deltaY;

      // Se arrastar muito para baixo (menos de 130px), recolhe a barra
      if (finalHeight < 130) {
        setCustomHeight(null);
        handleToggleExpand();
      } else {
        // Se estiver perto do topo (> 78vh), sincroniza maximizado
        if (finalHeight >= window.innerHeight * 0.78) {
          if (!isMaximized && onToggleMaximize) onToggleMaximize();
        } else if (isMaximized && onToggleMaximize) {
          onToggleMaximize();
        }
      }
    };

    window.addEventListener('pointermove', onPointerMove, { passive: false });
    window.addEventListener('pointerup', onPointerUp, { passive: false });
  };

  const handleToggleMaximize = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setCustomHeight(null); // Limpa altura manual ao alternar botão Maximizar/Restaurar
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

  return (
    <div 
      ref={barContainerRef}
      style={
        !isOpen
          ? { display: 'none' }
          : isExpanded
          ? {
              height: customHeight ? `${customHeight}px` : (isMaximized ? '82vh' : '46vh'),
              maxHeight: '92vh',
              minHeight: '180px',
              left: isStage2Open && typeof window !== 'undefined' && window.innerWidth >= 768 ? '390px' : '0px'
            }
          : {
              height: '46px',
              left: isStage2Open && typeof window !== 'undefined' && window.innerWidth >= 768 ? '390px' : '0px'
            }
      }
      className={`absolute bottom-0 left-0 right-0 z-[1100] pointer-events-auto flex flex-col bg-white/95 dark:bg-[#1c1c1e]/95 backdrop-blur-3xl border-t border-black/10 dark:border-white/10 shadow-[0_-8px_30px_rgba(0,0,0,0.15)] rounded-t-2xl sm:rounded-t-3xl overflow-hidden ${
        !isOpen ? 'hidden' : ''
      } ${
        isDragging ? 'transition-none select-none' : 'transition-[height,left] duration-300 ease-out'
      }`}
    >
      {/* ============================================================== */}
      {/* ZONA DE ARRASTAR DE BORDA SUPERIOR (HITBOX DE TOPO) */}
      {/* ============================================================== */}
      {isExpanded && (
        <div 
          onPointerDown={handlePointerDown}
          className="absolute top-0 left-0 right-0 h-3 z-30 cursor-ns-resize flex items-center justify-center hover:bg-[#007AFF]/10 transition-colors group/topdrag"
          title="Clique e arraste para cima ou para baixo para ajustar a altura"
        />
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

            {/* Indicação de Polígono Ativo */}
            {externalPolygonResult && (
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
          className={`flex flex-col items-center justify-center py-1 select-none px-4 rounded-xl transition-all ${
            isExpanded 
              ? 'cursor-ns-resize hover:bg-black/5 dark:hover:bg-white/10 active:bg-blue-50 dark:active:bg-blue-950/40 group' 
              : 'pointer-events-none'
          }`}
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
          <button
            type="button"
            onClick={handleToggleExpand}
            className={`px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-xs active:scale-95 ${
              isExpanded
                ? 'bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/15 text-slate-700 dark:text-slate-300'
                : 'bg-[#007AFF] hover:bg-[#0066d6] text-white shadow-blue-500/25'
            }`}
            title={isExpanded ? "Recolher barra para ver o mapa completo" : "Abrir busca de endereços de baixo para cima"}
          >
            <span>{isExpanded ? 'Recolher' : 'Abrir Busca'}</span>
            {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4 animate-bounce" />}
          </button>
        </div>
      </div>

      {/* ============================================================== */}
      {/* CONTEÚDO EXPANDIDO (SLIDE UP DE BAIXO PARA CIMA - SEMPRE MONTADO) */}
      {/* ============================================================== */}
      <div className={`flex-1 overflow-y-auto custom-scrollbar px-3 sm:px-6 py-2 min-h-0 ${isExpanded ? 'animate-fadeIn' : 'hidden'}`}>
        <IbgeSearchPanel
          embedded={true}
          isMaximized={isMaximized}
          onPlotAddress={onPlotAddress}
          onPlotAllAddresses={onPlotAllAddresses}
          onClearPlot={onClearPlot}
          onClearExternalResult={onClearExternalResult}
          externalPolygonResult={externalPolygonResult}
          allowedColumns={allowedColumns}
          hasPlottedMarkers={hasPlottedMarkers}
        />
      </div>
    </div>
  );
};
