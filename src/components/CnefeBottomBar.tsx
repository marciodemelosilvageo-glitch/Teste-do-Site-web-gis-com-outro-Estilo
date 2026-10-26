import React, { useState } from 'react';
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
  Sparkles 
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
  externalPolygonResult?: ExternalPolygonSearchResult | null;
  allowedColumns?: Record<string, boolean>;
  hasPlottedMarkers?: boolean;
}

export const CnefeBottomBar: React.FC<CnefeBottomBarProps> = ({
  isExpanded,
  onToggleExpand,
  isMaximized: isMaximizedProp,
  onToggleMaximize,
  onPlotAddress,
  onPlotAllAddresses,
  onClearPlot,
  externalPolygonResult,
  allowedColumns,
  hasPlottedMarkers = false,
}) => {
  const [internalMaximized, setInternalMaximized] = useState<boolean>(false);
  const isMaximized = isMaximizedProp !== undefined ? isMaximizedProp : internalMaximized;

  const handleToggleMaximize = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
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
      // Ao recolher, reseta o estado de maximizado para o padrão normal
      if (isMaximized && onToggleMaximize) {
        onToggleMaximize();
      }
      setInternalMaximized(false);
    }
    onToggleExpand();
  };

  return (
    <div 
      className={`absolute bottom-0 left-0 right-0 z-[1100] pointer-events-auto transition-all duration-300 ease-out flex flex-col bg-white/95 dark:bg-[#1c1c1e]/95 backdrop-blur-3xl border-t border-black/10 dark:border-white/10 shadow-[0_-8px_30px_rgba(0,0,0,0.15)] rounded-t-2xl sm:rounded-t-3xl overflow-hidden ${
        isExpanded 
          ? (isMaximized ? 'h-[82vh] max-h-[82vh] min-h-[480px]' : 'h-[46vh] max-h-[460px] min-h-[320px]')
          : 'h-[46px]'
      }`}
    >
      {/* ============================================================== */}
      {/* CABEÇALHO / BARRA DOCK FIXA (SEMPRE VISÍVEL NA BASE DO MAPA) */}
      {/* ============================================================== */}
      <div 
        onClick={(e) => {
          if (!isExpanded) handleToggleExpand(e);
        }}
        className={`w-full px-3.5 sm:px-6 flex items-center justify-between gap-3 shrink-0 select-none cursor-pointer border-b transition-colors ${
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
              <span className="inline-flex items-center gap-1 text-[11px] font-bold bg-emerald-50 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 px-2 py-0.5 rounded-full border border-emerald-200/80 dark:border-emerald-800/60 truncate max-w-[200px] sm:max-w-xs">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                <span className="truncate">{externalPolygonResult.title}</span>
                <span className="text-[10px] opacity-75">({externalPolygonResult.totalEncontrado})</span>
              </span>
            )}
          </div>
        </div>

        {/* Centro / Indicador visual (Alça de puxar estilo gaveta Apple) */}
        <div className="hidden md:flex flex-col items-center justify-center py-1">
          <div className="w-10 h-1 bg-black/20 dark:bg-white/20 rounded-full hover:bg-black/40 dark:hover:bg-white/40 transition-colors" />
        </div>

        {/* Direita: Ações Rápidas & Toggle de Expandir/Recolher */}
        <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
          {/* Botão de Limpar Marcadores no Mapa */}
          {hasPlottedMarkers && onClearPlot && (
            <button
              type="button"
              onClick={onClearPlot}
              className="px-2.5 py-1.5 rounded-xl bg-black/5 dark:bg-white/10 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/50 dark:hover:text-red-400 text-slate-600 dark:text-slate-300 font-bold text-xs transition-colors cursor-pointer flex items-center gap-1.5 active:scale-95"
              title="Limpar marcadores de endereço do mapa"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Limpar Mapa</span>
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
      {/* CONTEÚDO EXPANDIDO (SLIDE UP DE BAIXO PARA CIMA) */}
      {/* ============================================================== */}
      {isExpanded && (
        <div className="flex-1 overflow-y-auto custom-scrollbar px-3 sm:px-6 py-2 animate-fadeIn">
          <IbgeSearchPanel
            embedded={true}
            isMaximized={isMaximized}
            onPlotAddress={onPlotAddress}
            onPlotAllAddresses={onPlotAllAddresses}
            onClearPlot={onClearPlot}
            externalPolygonResult={externalPolygonResult}
            allowedColumns={allowedColumns}
          />
        </div>
      )}
    </div>
  );
};
