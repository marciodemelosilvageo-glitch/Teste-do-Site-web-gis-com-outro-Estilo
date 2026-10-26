import React from 'react';
import { 
  Home, 
  Search, 
  ChevronUp, 
  ChevronDown, 
  X, 
  Trash2, 
  MapPin, 
  Building2, 
  Sparkles 
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { IbgeSearchPanel, ExternalPolygonSearchResult } from './IbgeSearchPanel';

export interface CnefeBottomBarProps {
  isOpen: boolean;
  onOpen: () => void;
  onClose: () => void;
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
  isOpen,
  onOpen,
  onClose,
  isExpanded,
  onToggleExpand,
  onPlotAddress,
  onPlotAllAddresses,
  onClearPlot,
  externalPolygonResult,
  allowedColumns,
  hasPlottedMarkers = false,
}) => {
  // Se estiver fechado completamente, exibir um botão flutuante discreto no canto inferior
  if (!isOpen) {
    return (
      <div className="absolute bottom-4 right-4 z-20 animate-fadeIn">
        <button
          type="button"
          onClick={() => {
            onOpen();
            if (!isExpanded) onToggleExpand();
          }}
          className="px-4 py-2.5 bg-white/90 dark:bg-[#1c1c1e]/90 hover:bg-white dark:hover:bg-[#2c2c2e] text-slate-800 dark:text-slate-100 backdrop-blur-2xl border border-black/10 dark:border-white/10 rounded-2xl shadow-xl hover:shadow-2xl flex items-center gap-2.5 text-xs font-bold transition-all hover:scale-105 active:scale-95 cursor-pointer group"
          title="Abrir Busca de Endereços CNEFE (IBGE)"
        >
          <div className="w-6 h-6 rounded-xl bg-[#007AFF] text-white flex items-center justify-center shrink-0 shadow-sm group-hover:scale-110 transition-transform">
            <Home className="w-3.5 h-3.5" />
          </div>
          <span>Endereços CNEFE</span>
          {externalPolygonResult && (
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
          )}
        </button>
      </div>
    );
  }

  return (
    <div className="absolute bottom-0 left-0 right-0 z-20 pointer-events-none p-2 sm:p-4 flex flex-col items-center">
      <div className="w-full max-w-6xl pointer-events-auto transition-all duration-300 ease-out">
        
        {/* ============================================================== */}
        {/* ESTADO 1: BARRA INFERIOR RECOLHIDA (DOCK COMPACTO ESTILO APPLE) */}
        {/* ============================================================== */}
        {!isExpanded && (
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 20, opacity: 0 }}
            className="w-full bg-white/90 dark:bg-[#1c1c1e]/90 backdrop-blur-2xl border border-black/10 dark:border-white/10 rounded-2xl sm:rounded-3xl shadow-2xl p-2.5 sm:px-4 sm:py-3 flex items-center justify-between gap-3 text-xs"
          >
            {/* Esquerda: Identificação da Ferramenta */}
            <div 
              onClick={onToggleExpand} 
              className="flex items-center gap-3 min-w-0 cursor-pointer flex-1 group"
              title="Clique para expandir a busca de endereços"
            >
              <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-[#007AFF] to-[#5856D6] text-white flex items-center justify-center shrink-0 shadow-md shadow-blue-500/20 group-hover:scale-105 transition-transform">
                <Home className="w-4 h-4" />
              </div>
              
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-black text-slate-900 dark:text-white truncate text-xs sm:text-sm tracking-tight">
                    Busca de Endereços CNEFE
                  </span>
                  <span className="text-[10px] font-extrabold uppercase bg-blue-50 dark:bg-blue-950/80 text-[#007AFF] dark:text-[#0a84ff] px-2 py-0.5 rounded-full border border-blue-200/80 dark:border-blue-800/60">
                    IBGE DuckDB
                  </span>
                </div>
                
                <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium truncate mt-0.5">
                  {externalPolygonResult ? (
                    <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                      📍 Polígono: {externalPolygonResult.title} ({externalPolygonResult.totalEncontrado} endereços encontrados)
                    </span>
                  ) : (
                    "1.3M+ domicílios e logradouros catalogados • Clique para expandir"
                  )}
                </p>
              </div>
            </div>

            {/* Direita: Ações Rápidas */}
            <div className="flex items-center gap-1.5 shrink-0">
              {hasPlottedMarkers && onClearPlot && (
                <button
                  type="button"
                  onClick={onClearPlot}
                  className="px-2.5 py-1.5 rounded-xl bg-black/5 dark:bg-white/10 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/50 dark:hover:text-red-400 text-slate-600 dark:text-slate-300 font-bold text-xs transition-colors cursor-pointer flex items-center gap-1.5"
                  title="Limpar marcadores de endereço do mapa"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Limpar Mapa</span>
                </button>
              )}

              <button
                type="button"
                onClick={onToggleExpand}
                className="px-3.5 py-1.5 rounded-xl bg-[#007AFF] hover:bg-[#0066d6] text-white font-bold text-xs flex items-center gap-1.5 shadow-sm shadow-blue-500/25 transition-all cursor-pointer"
                title="Expandir painel de busca"
              >
                <span>Expandir Busca</span>
                <ChevronUp className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={onClose}
                className="w-8 h-8 rounded-xl bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/15 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 flex items-center justify-center transition-colors cursor-pointer"
                title="Minimizar barra"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        )}

        {/* ============================================================== */}
        {/* ESTADO 2: BARRA INFERIOR EXPANDIDA (BOTTOM SHEET ESTILO APPLE) */}
        {/* ============================================================== */}
        {isExpanded && (
          <motion.div
            initial={{ y: 50, opacity: 0, scale: 0.98 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 50, opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="w-full h-[62vh] max-h-[600px] min-h-[380px] bg-white/95 dark:bg-[#1c1c1e]/95 backdrop-blur-3xl border border-black/10 dark:border-white/10 rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden"
          >
            {/* Barra de Arraste / Header Estilo Apple Sheet */}
            <div className="pt-2 pb-2 px-4 border-b border-black/5 dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.02] shrink-0">
              {/* Alça visual de arrasto */}
              <div 
                onClick={onToggleExpand} 
                className="w-12 h-1 bg-black/20 dark:bg-white/20 rounded-full mx-auto mb-2 cursor-pointer hover:bg-black/40 dark:hover:bg-white/40 transition-colors"
                title="Recolher barra"
              />

              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-[#007AFF] to-[#5856D6] text-white flex items-center justify-center shrink-0 shadow-sm">
                    <Home className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-sm font-black text-slate-900 dark:text-white truncate tracking-tight">
                        Busca de Endereços CNEFE
                      </h3>
                      <span className="text-[10px] font-extrabold uppercase bg-blue-50 dark:bg-blue-950/80 text-[#007AFF] dark:text-[#0a84ff] px-2 py-0.2 rounded-full border border-blue-200/80 dark:border-blue-800/60">
                        IBGE DuckDB
                      </span>
                      {externalPolygonResult && (
                        <span className="text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 px-2 py-0.2 rounded-full border border-emerald-200/80 dark:border-emerald-800/60 truncate">
                          Área: {externalPolygonResult.title}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Botões de Controle da Barra */}
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={onToggleExpand}
                    className="p-1.5 rounded-xl bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/15 text-slate-600 dark:text-slate-300 font-bold text-xs flex items-center gap-1 transition-colors cursor-pointer"
                    title="Minimizar para barra compacta"
                  >
                    <ChevronDown className="w-4 h-4" />
                    <span className="hidden sm:inline">Minimizar</span>
                  </button>

                  <button
                    type="button"
                    onClick={onClose}
                    className="p-1.5 rounded-xl bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/15 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors cursor-pointer"
                    title="Fechar barra"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            {/* Corpo Rolável com o Painel CNEFE DuckDB */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-3 sm:p-5">
              <IbgeSearchPanel
                embedded={true}
                onPlotAddress={onPlotAddress}
                onPlotAllAddresses={onPlotAllAddresses}
                onClearPlot={onClearPlot}
                externalPolygonResult={externalPolygonResult}
                allowedColumns={allowedColumns}
              />
            </div>
          </motion.div>
        )}

      </div>
    </div>
  );
};
