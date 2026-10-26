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
  onPlotAddress,
  onPlotAllAddresses,
  onClearPlot,
  externalPolygonResult,
  allowedColumns,
  hasPlottedMarkers = false,
}) => {
  const [isMaximized, setIsMaximized] = useState<boolean>(false);

  return (
    <div 
      className={`absolute bottom-0 left-0 right-0 z-20 pointer-events-auto transition-all duration-300 ease-out flex flex-col bg-white/95 dark:bg-[#1c1c1e]/95 backdrop-blur-3xl border-t border-black/10 dark:border-white/10 shadow-[0_-8px_30px_rgba(0,0,0,0.15)] rounded-t-2xl sm:rounded-t-3xl overflow-hidden ${
        isExpanded 
          ? (isMaximized ? 'h-[75vh] max-h-[75vh]' : 'h-[46vh] max-h-[440px] min-h-[320px]')
          : 'h-[46px]'
      }`}
    >
      {/* ============================================================== */}
      {/* CABEÇALHO / BARRA DOCK FIXA (SEMPRE VISÍVEL NA BASE DO MAPA) */}
      {/* ============================================================== */}
      <div 
        onClick={() => {
          if (!isExpanded) onToggleExpand();
        }}
        className={`w-full px-3.5 sm:px-6 flex items-center justify-between gap-3 shrink-0 select-none cursor-pointer border-b transition-colors ${
          isExpanded 
            ? 'h-12 border-black/5 dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.02]' 
            : 'h-[46px] border-transparent hover:bg-black/[0.03] dark:hover:bg-white/[0.05]'
        }`}
        title={isExpanded ? "Clique para recolher para a parte inferior" : "Clique para abrir a busca de baixo para cima"}
      >
        {/* Esquerda: Identificação da Ferramenta */}
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          <div className="w-7 h-7 rounded-xl bg-gradient-to-tr from-[#007AFF] to-[#5856D6] text-white flex items-center justify-center shrink-0 shadow-sm">
            <Home className="w-4 h-4" />
          </div>

          <div className="flex items-center gap-2 min-w-0 flex-wrap">
            <span className="font-black text-slate-900 dark:text-white truncate text-xs sm:text-sm tracking-tight">
              Busca de Endereços CNEFE
            </span>
            <span className="hidden sm:inline-flex text-[10px] font-extrabold uppercase bg-blue-50 dark:bg-blue-950/80 text-[#007AFF] dark:text-[#0a84ff] px-2 py-0.5 rounded-full border border-blue-200/80 dark:border-blue-800/60">
              IBGE DuckDB
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
              className="px-2.5 py-1 rounded-xl bg-black/5 dark:bg-white/10 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/50 dark:hover:text-red-400 text-slate-600 dark:text-slate-300 font-bold text-xs transition-colors cursor-pointer flex items-center gap-1.5"
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
              onClick={() => setIsMaximized(prev => !prev)}
              className="p-1.5 rounded-xl bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/15 text-slate-600 dark:text-slate-300 text-xs transition-colors cursor-pointer"
              title={isMaximized ? "Reduzir altura para ver mais o mapa" : "Expandir painel"}
            >
              {isMaximized ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
            </button>
          )}

          {/* Botão Principal de Abrir / Recolher */}
          <button
            type="button"
            onClick={onToggleExpand}
            className={`px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-xs ${
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
