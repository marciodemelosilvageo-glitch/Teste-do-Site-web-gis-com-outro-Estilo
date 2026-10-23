import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Search, 
  Layers, 
  MapPin, 
  X, 
  ChevronRight, 
  ChevronDown, 
  ChevronUp, 
  Star, 
  History, 
  Navigation, 
  Compass, 
  Share2, 
  Copy, 
  Download, 
  SlidersHorizontal, 
  Eye, 
  EyeOff, 
  Crown, 
  Briefcase, 
  User, 
  LogOut, 
  Sun, 
  Moon, 
  HelpCircle, 
  Check, 
  PanelLeftClose, 
  PanelLeft, 
  Plus, 
  Minus, 
  Home, 
  Users, 
  Building2, 
  Trash2, 
  ZoomIn, 
  MousePointerClick, 
  Table2, 
  FileSpreadsheet, 
  ExternalLink,
  Sparkles,
  Store,
  Pill,
  UtensilsCrossed,
  Bus,
  Fuel,
  Hotel,
  Wine,
  Hospital
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { SelectedFeature, GroupedSearchResults, SearchResultItem } from '../types';
import { dataSources, propertyNames } from '../data';
import { getIdentifier, getTranslatedValue, getFeatureCenter, toTitleCase } from '../utils';
import { IbgeSearchPanel, ExternalPolygonSearchResult } from './IbgeSearchPanel';
import { Dashboard } from './Dashboard';
import { PropertyTable } from './PropertyTable';

export type SidebarTab = 'search' | 'layers' | 'cnefe' | 'dashboard' | 'table' | 'details';

interface AppleSidebarProps {
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  activeTab: SidebarTab;
  setActiveTab: (tab: SidebarTab) => void;
  
  // Busca
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  onSearch: (term?: string) => void;
  onAbandonSearch: () => void;
  isSearchLoading: boolean;
  searchActiveLayersOnly: boolean;
  setSearchActiveLayersOnly: (v: boolean) => void;
  recentSearches: string[];
  savedSearches: string[];
  onToggleSaveSearch: (term: string) => void;
  searchResults: GroupedSearchResults;
  totalResultsCount: number;
  isSearchResultsVisible: boolean;
  collapsedGroups: Record<string, boolean>;
  setCollapsedGroups: (v: any) => void;
  onResultItemClick: (groupName: string, item: SearchResultItem) => void;
  
  // Seleção e Feições
  selectedFeatures: SelectedFeature[];
  onZoomToFeature: (feat: SelectedFeature) => void;
  onRemoveFromSelection: (id: string) => void;
  onClearSelection: () => void;
  isMultiSelectMode: boolean;
  onToggleMultiSelect: () => void;
  onSearchPolygonAddresses: (feat: SelectedFeature) => void;
  
  // Camadas
  activeLayers: string[];
  setActiveLayers: (layers: any) => void;
  allowedLayerNames: string[];
  
  // Usuário e Sistema
  currentActiveUser: any;
  userRole: string;
  isMaster: boolean;
  isManager: boolean;
  isAdmin: boolean;
  isDarkMode: boolean;
  onToggleDarkMode: () => void;
  onOpenAdminPanel: () => void;
  onOpenProfileModal: () => void;
  onLogout: () => void;
  onOpenHelp: () => void;
  showToast: (msg: string) => void;
  
  // DuckDB CNEFE
  onPlotAddress: (address: any) => void;
  onPlotAllAddresses: (addresses: any[]) => void;
  onClearPlot: () => void;
  cnefeExternalResult: ExternalPolygonSearchResult | null;
  allowedColumns?: Record<string, boolean>;
  allowedProperties?: Record<string, boolean>;
  featurePermissions: any;
  effectiveSession: any;
  
  // Simulação Master
  isSimulatingUser: boolean;
  simulatedRole: string;
  onExitSimulation: () => void;
  onOpenSimulationChoice: () => void;
  
  // Modais de Tabela e Exportação
  onOpenFullTableModal: () => void;
  onOpenExportModal: () => void;
}

// Categorias Apple estilo maps.apple.com com cores e ícones de alta fidelidade
const APPLE_CATEGORIES = [
  { id: 'bairros', name: 'Bairros', icon: Store, color: 'bg-amber-500', query: 'Bairro' },
  { id: 'municipios', name: 'Municípios', icon: Building2, color: 'bg-blue-500', query: 'Teresina' },
  { id: 'favelas', name: 'Comunidades', icon: Home, color: 'bg-emerald-500', query: 'Comunidade' },
  { id: 'setores', name: 'Setores IBGE', icon: Layers, color: 'bg-purple-500', query: 'Setor' },
  { id: 'farmacias', name: 'Farmácias', icon: Pill, color: 'bg-rose-500', query: 'Farmácia' },
  { id: 'restaurantes', name: 'Restaurantes', icon: UtensilsCrossed, color: 'bg-orange-500', query: 'Restaurante' },
  { id: 'transporte', name: 'Transporte', icon: Bus, color: 'bg-sky-500', query: 'Terminal' },
  { id: 'postos', name: 'Postos Gasolina', icon: Fuel, color: 'bg-blue-600', query: 'Posto' },
  { id: 'hoteis', name: 'Hotéis', icon: Hotel, color: 'bg-indigo-500', query: 'Hotel' },
  { id: 'hospitais', name: 'Hospitais', icon: Hospital, color: 'bg-red-600', query: 'Hospital' }
];

export const AppleSidebar: React.FC<AppleSidebarProps> = ({
  isCollapsed,
  onToggleCollapse,
  activeTab,
  setActiveTab,
  searchQuery,
  setSearchQuery,
  onSearch,
  onAbandonSearch,
  isSearchLoading,
  searchActiveLayersOnly,
  setSearchActiveLayersOnly,
  recentSearches,
  savedSearches,
  onToggleSaveSearch,
  searchResults,
  totalResultsCount,
  isSearchResultsVisible,
  collapsedGroups,
  setCollapsedGroups,
  onResultItemClick,
  selectedFeatures,
  onZoomToFeature,
  onRemoveFromSelection,
  onClearSelection,
  isMultiSelectMode,
  onToggleMultiSelect,
  onSearchPolygonAddresses,
  activeLayers,
  setActiveLayers,
  allowedLayerNames,
  currentActiveUser,
  userRole,
  isMaster,
  isManager,
  isAdmin,
  isDarkMode,
  onToggleDarkMode,
  onOpenAdminPanel,
  onOpenProfileModal,
  onLogout,
  onOpenHelp,
  showToast,
  onPlotAddress,
  onPlotAllAddresses,
  onClearPlot,
  cnefeExternalResult,
  allowedColumns,
  allowedProperties,
  featurePermissions,
  effectiveSession,
  isSimulatingUser,
  simulatedRole,
  onExitSimulation,
  onOpenSimulationChoice,
  onOpenFullTableModal,
  onOpenExportModal
}) => {
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Feição ativa detalhada (última selecionada)
  const activeDetailFeature = useMemo(() => {
    if (selectedFeatures.length === 0) return null;
    return selectedFeatures[selectedFeatures.length - 1];
  }, [selectedFeatures]);

  // Se uma feição foi selecionada e o usuário ainda não está na aba de detalhes, permitir alternar suavemente
  const hasFeature = !!activeDetailFeature;

  const handleCopy = (text: string, label: string) => {
    try {
      if (navigator?.clipboard?.writeText) {
        navigator.clipboard.writeText(text).catch(() => {});
      }
      showToast(`${label} copiado!`);
    } catch {
      showToast(`${label} copiado!`);
    }
  };

  // Se a barra estiver colapsada (Narrow Rail - Screenshot 2 de maps.apple.com)
  if (isCollapsed) {
    return (
      <aside 
        aria-label="Barra Lateral Compacta Apple Maps"
        className="relative z-30 h-full w-[68px] flex flex-col items-center py-4 px-2 select-none shrink-0 transition-all duration-300 bg-white/80 dark:bg-[#1c1c1e]/85 backdrop-blur-3xl border-r border-black/10 dark:border-white/10 shadow-2xl"
      >
        {/* Logo oficial no modo recolhido */}
        <div 
          className="w-11 h-11 mb-2 rounded-2xl flex items-center justify-center cursor-pointer transition-transform hover:scale-105 select-none"
          onClick={onToggleCollapse}
          onDoubleClick={onOpenAdminPanel}
          title="WebGis - Clique para expandir"
        >
          <img 
            src="https://raw.githubusercontent.com/marciodemelosilvageo-glitch/GeoCode/main/logo/Nova%20logo.png" 
            alt="Logo WebGis"
            className="h-8 w-auto object-contain drop-shadow-xs pointer-events-none"
            onError={(e) => {
              (e.target as HTMLImageElement).src = 'https://raw.githubusercontent.com/marciodemelosilvageo-glitch/GeoCode/main/logo/image-removebg-preview.png';
            }}
          />
        </div>

        {/* Botão de Expandir a Barra (Apple Sidebar Toggle) */}
        <button
          type="button"
          onClick={onToggleCollapse}
          className="w-11 h-11 rounded-2xl flex items-center justify-center text-slate-700 dark:text-slate-200 hover:bg-black/5 dark:hover:bg-white/10 active:scale-95 transition-all cursor-pointer mb-3"
          title="Expandir barra lateral"
        >
          <PanelLeft className="w-5 h-5 text-[#007AFF]" />
        </button>

        {/* Ícones de Navegação Rápida */}
        <div className="flex flex-col items-center gap-2.5 w-full flex-1">
          <button
            type="button"
            onClick={() => {
              onToggleCollapse();
              setActiveTab('search');
            }}
            className={`w-11 h-11 rounded-2xl flex items-center justify-center transition-all cursor-pointer ${
              activeTab === 'search'
                ? 'bg-[#007AFF] text-white shadow-lg shadow-blue-500/30'
                : 'text-slate-600 dark:text-slate-300 hover:bg-black/5 dark:hover:bg-white/10'
            }`}
            title="Buscar"
          >
            <Search className="w-5 h-5" />
          </button>

          <button
            type="button"
            onClick={() => {
              onToggleCollapse();
              setActiveTab('layers');
            }}
            className={`w-11 h-11 rounded-2xl flex items-center justify-center transition-all cursor-pointer relative ${
              activeTab === 'layers'
                ? 'bg-[#007AFF] text-white shadow-lg shadow-blue-500/30'
                : 'text-slate-600 dark:text-slate-300 hover:bg-black/5 dark:hover:bg-white/10'
            }`}
            title="Camadas"
          >
            <Layers className="w-5 h-5" />
            {activeLayers.length > 0 && (
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[#007AFF]" />
            )}
          </button>

          {hasFeature && (
            <button
              type="button"
              onClick={() => {
                onToggleCollapse();
                setActiveTab('details');
              }}
              className={`w-11 h-11 rounded-2xl flex items-center justify-center transition-all cursor-pointer relative ${
                activeTab === 'details'
                  ? 'bg-[#007AFF] text-white shadow-lg shadow-blue-500/30'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-black/5 dark:hover:bg-white/10'
              }`}
              title="Detalhes da Feição Selecionada"
            >
              <MapPin className="w-5 h-5 text-[#FF9500]" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[#FF9500] animate-ping" />
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              onToggleCollapse();
              setActiveTab('cnefe');
            }}
            className={`w-11 h-11 rounded-2xl flex items-center justify-center transition-all cursor-pointer ${
              activeTab === 'cnefe'
                ? 'bg-[#007AFF] text-white shadow-lg shadow-blue-500/30'
                : 'text-slate-600 dark:text-slate-300 hover:bg-black/5 dark:hover:bg-white/10'
            }`}
            title="Endereços CNEFE (IBGE)"
          >
            <Home className="w-5 h-5" />
          </button>

          <button
            type="button"
            onClick={() => {
              onToggleCollapse();
              setActiveTab('dashboard');
            }}
            className={`w-11 h-11 rounded-2xl flex items-center justify-center transition-all cursor-pointer ${
              activeTab === 'dashboard'
                ? 'bg-[#007AFF] text-white shadow-lg shadow-blue-500/30'
                : 'text-slate-600 dark:text-slate-300 hover:bg-black/5 dark:hover:bg-white/10'
            }`}
            title="Raio-X Demográfico"
          >
            <Users className="w-5 h-5" />
          </button>

          <button
            type="button"
            onClick={() => {
              onToggleCollapse();
              setActiveTab('table');
            }}
            className={`w-11 h-11 rounded-2xl flex items-center justify-center transition-all cursor-pointer ${
              activeTab === 'table'
                ? 'bg-[#007AFF] text-white shadow-lg shadow-blue-500/30'
                : 'text-slate-600 dark:text-slate-300 hover:bg-black/5 dark:hover:bg-white/10'
            }`}
            title="Tabela de Dados"
          >
            <Table2 className="w-5 h-5" />
          </button>
        </div>

        {/* Rodapé compacto */}
        <div className="flex flex-col items-center gap-2 mt-auto pt-3 border-t border-black/10 dark:border-white/10 w-full">
          <button
            type="button"
            onClick={onToggleDarkMode}
            className="w-10 h-10 rounded-2xl flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-black/5 dark:hover:bg-white/10 transition-colors cursor-pointer"
            title={isDarkMode ? "Modo Claro" : "Modo Escuro"}
          >
            {isDarkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4" />}
          </button>

          <button
            type="button"
            onClick={onOpenProfileModal}
            className="w-10 h-10 rounded-2xl flex items-center justify-center bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/15 text-slate-800 dark:text-slate-200 transition-colors cursor-pointer"
            title="Perfil de Usuário"
          >
            {isMaster ? <Crown className="w-4 h-4 text-amber-400" /> : <User className="w-4 h-4" />}
          </button>
        </div>
      </aside>
    );
  }

  // Barra Lateral Expandida (Apple Maps Web / macOS Maps)
  return (
    <aside 
      aria-label="Painel Principal Apple Maps"
      className="relative z-30 h-full w-[380px] sm:w-[420px] flex flex-col select-none shrink-0 transition-all duration-300 bg-white/85 dark:bg-[#1c1c1e]/90 backdrop-blur-3xl border-r border-black/10 dark:border-white/10 shadow-2xl overflow-hidden font-sans"
    >
      {/* 1. TOPO DA BARRA LATERAL (Apenas a Logo Oficial + Botão de Colapsar) */}
      <div className="p-3 px-4 border-b border-black/5 dark:border-white/10 flex items-center justify-between shrink-0">
        <div 
          className="flex items-center cursor-pointer select-none group"
          onDoubleClick={onOpenAdminPanel}
          title="Clique duplo para login de Administrador"
        >
          <img 
            src="https://raw.githubusercontent.com/marciodemelosilvageo-glitch/GeoCode/main/logo/Nova%20logo.png" 
            alt="Logo"
            className="h-11 sm:h-12 w-auto max-w-[200px] object-contain transition-transform group-hover:scale-105 pointer-events-none drop-shadow-xs"
            onError={(e) => {
              (e.target as HTMLImageElement).src = 'https://raw.githubusercontent.com/marciodemelosilvageo-glitch/GeoCode/main/logo/image-removebg-preview.png';
            }}
          />
        </div>

        <button
          type="button"
          onClick={onToggleCollapse}
          className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10 active:scale-95 transition-all cursor-pointer"
          title="Recolher barra lateral"
        >
          <PanelLeftClose className="w-5 h-5" />
        </button>
      </div>

      {/* 2. BARRA DE NAVEGAÇÃO SEGMENTADA (Apple Segmented Navigation) */}
      <div className="px-3 pt-3 pb-2 border-b border-black/5 dark:border-white/10 shrink-0">
        <div className="flex items-center gap-1 p-1 bg-black/5 dark:bg-white/5 rounded-2xl">
          <button
            type="button"
            onClick={() => setActiveTab('search')}
            className={`flex-1 py-1.5 px-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'search'
                ? 'bg-white dark:bg-[#2c2c2e] text-[#007AFF] dark:text-[#0a84ff] shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-black dark:hover:text-white'
            }`}
          >
            <Search className="w-3.5 h-3.5" />
            <span>Buscar</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('layers')}
            className={`flex-1 py-1.5 px-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'layers'
                ? 'bg-white dark:bg-[#2c2c2e] text-[#007AFF] dark:text-[#0a84ff] shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-black dark:hover:text-white'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Camadas</span>
            {activeLayers.length > 0 && (
              <span className="text-[10px] bg-blue-100 dark:bg-blue-900/60 text-[#007AFF] dark:text-[#0a84ff] px-1.5 py-0.2 rounded-full font-black">
                {activeLayers.length}
              </span>
            )}
          </button>

          {hasFeature && (
            <button
              type="button"
              onClick={() => setActiveTab('details')}
              className={`flex-1 py-1.5 px-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                activeTab === 'details'
                  ? 'bg-white dark:bg-[#2c2c2e] text-[#FF9500] shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-black dark:hover:text-white'
              }`}
            >
              <MapPin className="w-3.5 h-3.5 text-[#FF9500]" />
              <span>Detalhes</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setActiveTab('cnefe')}
            className={`flex-1 py-1.5 px-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'cnefe'
                ? 'bg-white dark:bg-[#2c2c2e] text-[#007AFF] dark:text-[#0a84ff] shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-black dark:hover:text-white'
            }`}
          >
            <Home className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">IBGE</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('dashboard')}
            className={`flex-1 py-1.5 px-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'dashboard'
                ? 'bg-white dark:bg-[#2c2c2e] text-[#007AFF] dark:text-[#0a84ff] shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-black dark:hover:text-white'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Raio-X</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('table')}
            className={`flex-1 py-1.5 px-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'table'
                ? 'bg-white dark:bg-[#2c2c2e] text-[#007AFF] dark:text-[#0a84ff] shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-black dark:hover:text-white'
            }`}
          >
            <Table2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Tabela</span>
          </button>
        </div>
      </div>

      {/* 3. CONTEÚDO PRINCIPAL ROLÁVEL (Apple Scroll View) */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-3 sm:p-4 space-y-4">
        
        {/* ============================================================== */}
        {/* ABA: DETALHES DA FEIÇÃO / PLACE CARD (Screenshot 3 do Apple Maps) */}
        {/* ============================================================== */}
        {activeTab === 'details' && activeDetailFeature && (
          <div className="space-y-4 animate-fadeIn">
            {/* Header do Cartão do Local */}
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <button
                  type="button"
                  onClick={() => setActiveTab('search')}
                  className="text-xs font-bold text-[#007AFF] hover:underline flex items-center gap-1 mb-1 cursor-pointer"
                >
                  <span>&larr; Voltar para busca</span>
                </button>
                <h2 className="text-xl font-black text-slate-900 dark:text-white truncate tracking-tight">
                  {activeDetailFeature.name || 'Local Selecionado'}
                </h2>
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 truncate">
                  {activeDetailFeature.sourceName} • Teresina, PI
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  onRemoveFromSelection(activeDetailFeature.id);
                  setActiveTab('search');
                }}
                className="w-8 h-8 rounded-full bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/15 flex items-center justify-center text-slate-500 dark:text-slate-400 cursor-pointer"
                title="Fechar detalhes"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Linha de Botões de Ação Apple (Screenshot 3: Trajetos, Info, etc.) */}
            <div className="grid grid-cols-4 gap-2 pt-1">
              {/* Botão Trajetos / Focar (Azul Apple #007AFF) */}
              <button
                type="button"
                onClick={() => onZoomToFeature(activeDetailFeature)}
                className="py-2.5 px-2 bg-[#007AFF] hover:bg-[#0066d6] active:scale-95 text-white rounded-2xl flex flex-col items-center justify-center gap-1 text-[11px] font-bold shadow-lg shadow-blue-500/25 transition-all cursor-pointer"
              >
                <Navigation className="w-5 h-5 fill-white text-white" />
                <span>Focar</span>
              </button>

              {/* Botão Raio-X */}
              <button
                type="button"
                onClick={() => setActiveTab('dashboard')}
                className="py-2.5 px-2 bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/15 active:scale-95 text-slate-800 dark:text-slate-200 rounded-2xl flex flex-col items-center justify-center gap-1 text-[11px] font-bold transition-all cursor-pointer"
              >
                <Users className="w-5 h-5 text-[#34C759]" />
                <span>Raio-X</span>
              </button>

              {/* Botão Buscar Endereços CNEFE no Polígono */}
              <button
                type="button"
                onClick={() => onSearchPolygonAddresses(activeDetailFeature)}
                className="py-2.5 px-2 bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/15 active:scale-95 text-slate-800 dark:text-slate-200 rounded-2xl flex flex-col items-center justify-center gap-1 text-[11px] font-bold transition-all cursor-pointer"
              >
                <Home className="w-5 h-5 text-[#FF9500]" />
                <span>CNEFE</span>
              </button>

              {/* Botão Exportar */}
              <button
                type="button"
                onClick={onOpenExportModal}
                className="py-2.5 px-2 bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/15 active:scale-95 text-slate-800 dark:text-slate-200 rounded-2xl flex flex-col items-center justify-center gap-1 text-[11px] font-bold transition-all cursor-pointer"
              >
                <Download className="w-5 h-5 text-[#AF52DE]" />
                <span>Exportar</span>
              </button>
            </div>

            {/* Informações Úteis (KPIs Demográficos Apple) */}
            <div className="bg-black/5 dark:bg-white/5 rounded-2xl p-3.5 space-y-2.5">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Informações Úteis
              </h3>
              
              <div className="grid grid-cols-2 gap-2">
                <div className="p-2.5 bg-white dark:bg-[#2c2c2e] rounded-xl shadow-xs">
                  <span className="text-[10px] text-slate-400 dark:text-slate-500 font-bold block">População</span>
                  <span className="text-sm font-black text-slate-800 dark:text-slate-100">
                    {Number(activeDetailFeature.properties?.['V0001'] || activeDetailFeature.properties?.['Total de pessoas'] || 0).toLocaleString('pt-BR')} hab
                  </span>
                </div>

                <div className="p-2.5 bg-white dark:bg-[#2c2c2e] rounded-xl shadow-xs">
                  <span className="text-[10px] text-slate-400 dark:text-slate-500 font-bold block">Domicílios</span>
                  <span className="text-sm font-black text-slate-800 dark:text-slate-100">
                    {Number(activeDetailFeature.properties?.['V0002'] || activeDetailFeature.properties?.['Total de Domicílios'] || 0).toLocaleString('pt-BR')}
                  </span>
                </div>
              </div>
            </div>

            {/* Detalhes e Atributos da Feição */}
            <div className="bg-black/5 dark:bg-white/5 rounded-2xl p-3.5 space-y-2">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Detalhes & Propriedades
              </h3>

              <div className="divide-y divide-black/5 dark:divide-white/10 text-xs">
                {Object.entries(activeDetailFeature.properties || {})
                  .slice(0, 15)
                  .map(([key, val]) => (
                    <div key={key} className="py-2 flex items-center justify-between gap-2">
                      <span className="font-semibold text-slate-500 dark:text-slate-400 truncate max-w-[140px]">
                        {propertyNames[key] || key}
                      </span>
                      <div className="flex items-center gap-1.5 shrink-0 font-bold text-slate-800 dark:text-slate-200">
                        <span className="truncate max-w-[170px]">{String(val)}</span>
                        <button
                          type="button"
                          onClick={() => handleCopy(String(val), key)}
                          className="p-1 hover:bg-black/10 dark:hover:bg-white/10 rounded cursor-pointer text-slate-400 hover:text-slate-700"
                          title="Copiar valor"
                        >
                          <Copy className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* ABA: BUSCAR (Screenshot 4 do Apple Maps) */}
        {/* ============================================================== */}
        {activeTab === 'search' && (
          <div className="space-y-4 animate-fadeIn">
            {/* Campo de Entrada de Busca Apple */}
            <div className="space-y-2">
              <div className="relative flex items-center bg-black/5 dark:bg-white/10 rounded-2xl px-3 py-2.5 border border-black/5 dark:border-white/10 focus-within:ring-2 focus-within:ring-[#007AFF] transition-all">
                <Search className="w-4 h-4 text-slate-400 mr-2 shrink-0" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') onSearch(searchQuery);
                  }}
                  placeholder="Buscar no Geocodificando..."
                  className="w-full bg-transparent outline-none text-sm font-semibold text-slate-900 dark:text-white placeholder-slate-400"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={onAbandonSearch}
                    className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Opção: Pesquisar apenas nas camadas ativas */}
              <div className="flex items-center justify-between px-1 text-xs text-slate-500">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={searchActiveLayersOnly}
                    onChange={(e) => setSearchActiveLayersOnly(e.target.checked)}
                    className="rounded text-[#007AFF] focus:ring-[#007AFF]"
                  />
                  <span>Pesquisar somente nas camadas ativas</span>
                </label>
              </div>
            </div>

            {/* Categorias Apple: "Encontrar por tipo" (Screenshot 4) */}
            {!isSearchResultsVisible && (
              <div className="space-y-2.5">
                <div className="text-xs font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 px-1">
                  Encontrar por tipo
                </div>

                <div className="grid grid-cols-2 gap-2">
                  {APPLE_CATEGORIES.map(cat => {
                    const Icon = cat.icon;
                    return (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => {
                          setSearchQuery(cat.query);
                          onSearch(cat.query);
                        }}
                        className="p-2.5 rounded-2xl bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 active:scale-95 transition-all cursor-pointer flex items-center gap-2.5 text-left border border-black/5 dark:border-white/5"
                      >
                        <div className={`w-8 h-8 rounded-xl ${cat.color} text-white flex items-center justify-center shrink-0 shadow-sm`}>
                          <Icon className="w-4 h-4" />
                        </div>
                        <span className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">
                          {cat.name}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Seção Recentes (Screenshot 1 & 4 do Apple Maps) */}
            {!isSearchResultsVisible && recentSearches.length > 0 && (
              <div className="space-y-2">
                <div className="text-xs font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 px-1 flex items-center justify-between">
                  <span>Recentes</span>
                  <History className="w-3.5 h-3.5 text-slate-400" />
                </div>

                <div className="space-y-1">
                  {recentSearches.map((term, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        setSearchQuery(term);
                        onSearch(term);
                      }}
                      className="w-full p-2 rounded-xl bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 transition-all flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-slate-200 cursor-pointer"
                    >
                      <div className="flex items-center gap-2 truncate">
                        <div className="w-6 h-6 rounded-full bg-amber-500/20 text-amber-500 flex items-center justify-center shrink-0">
                          <Store className="w-3.5 h-3.5" />
                        </div>
                        <span className="truncate">{term}</span>
                      </div>
                      <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Resultados da Busca ao Vivo */}
            {isSearchResultsVisible && (
              <div className="space-y-3">
                <div className="flex items-center justify-between border-b border-black/5 dark:border-white/10 pb-2">
                  <span className="text-xs font-black text-slate-800 dark:text-slate-200">
                    {isSearchLoading ? 'Buscando...' : `${totalResultsCount} resultados encontrados`}
                  </span>
                  <button
                    type="button"
                    onClick={onAbandonSearch}
                    className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                  >
                    Limpar
                  </button>
                </div>

                {Object.keys(searchResults).length === 0 && !isSearchLoading && (
                  <p className="text-xs text-slate-500 p-4 text-center">
                    Nenhum resultado correspondente encontrado.
                  </p>
                )}

                {Object.entries(searchResults).map(([groupName, items]) => {
                  const typedItems = items as SearchResultItem[];
                  const isCollapsedGroup = !!collapsedGroups[groupName];

                  return (
                    <div key={groupName} className="rounded-2xl border border-black/5 dark:border-white/10 overflow-hidden bg-black/[0.02] dark:bg-white/[0.02]">
                      <button
                        type="button"
                        onClick={() => setCollapsedGroups({ ...collapsedGroups, [groupName]: !isCollapsedGroup })}
                        className="w-full p-2.5 flex items-center justify-between text-xs font-black text-slate-800 dark:text-slate-200 hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer"
                      >
                        <span className="truncate">{groupName} ({typedItems.length})</span>
                        {isCollapsedGroup ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
                      </button>

                      {!isCollapsedGroup && (
                        <div className="divide-y divide-black/5 dark:divide-white/10">
                          {typedItems.map((item, idx) => {
                            const props = item.polygonLayer.feature.properties;
                            const identifier = getIdentifier(props, groupName);
                            return (
                              <button
                                key={idx}
                                type="button"
                                onClick={() => {
                                  onResultItemClick(groupName, item);
                                  setActiveTab('details');
                                }}
                                className="w-full p-2.5 text-left hover:bg-[#007AFF]/10 flex items-center gap-2 transition-colors cursor-pointer"
                              >
                                <MapPin className="w-4 h-4 text-[#007AFF] shrink-0" />
                                <div className="min-w-0 flex-1">
                                  <p className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">
                                    {identifier}
                                  </p>
                                </div>
                                <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ============================================================== */}
        {/* ABA: CAMADAS (GUIAS) */}
        {/* ============================================================== */}
        {activeTab === 'layers' && (
          <div className="space-y-4 animate-fadeIn">
            {/* Ações Rápidas */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  const all = dataSources.filter(s => allowedLayerNames.includes(s.name)).map(s => s.name);
                  setActiveLayers(all);
                  showToast('Todas as camadas foram ativadas.');
                }}
                className="flex-1 py-2 px-3 rounded-xl bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/15 text-xs font-bold text-slate-800 dark:text-slate-200 transition-colors cursor-pointer"
              >
                Ligar Tudo
              </button>

              <button
                type="button"
                onClick={() => {
                  setActiveLayers([]);
                  showToast('Todas as camadas foram desligadas.');
                }}
                className="flex-1 py-2 px-3 rounded-xl bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/15 text-xs font-bold text-slate-800 dark:text-slate-200 transition-colors cursor-pointer"
              >
                Desligar Tudo
              </button>

              <button
                type="button"
                onClick={onToggleMultiSelect}
                className={`py-2 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  isMultiSelectMode 
                    ? 'bg-[#007AFF] text-white shadow-sm' 
                    : 'bg-black/5 dark:bg-white/10 text-slate-700 dark:text-slate-300'
                }`}
                title="Multiseleção de áreas no mapa"
              >
                Multiseleção: {isMultiSelectMode ? 'ON' : 'OFF'}
              </button>
            </div>

            {/* Lista de Camadas com Toggles Apple */}
            <div className="space-y-2">
              {dataSources
                .filter(source => allowedLayerNames.includes(source.name))
                .map(source => {
                  const isActive = activeLayers.includes(source.name);
                  return (
                    <div
                      key={source.name}
                      className="p-3 rounded-2xl bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/5 flex items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div 
                          className="w-3.5 h-3.5 rounded-full shrink-0 shadow-xs" 
                          style={{ backgroundColor: source.color || '#007AFF' }} 
                        />
                        <span className={`text-xs font-bold truncate ${isActive ? 'text-slate-900 dark:text-white' : 'text-slate-400'}`}>
                          {source.name}
                        </span>
                      </div>

                      {/* Apple Switch Toggle */}
                      <button
                        type="button"
                        onClick={() => {
                          if (isActive) {
                            setActiveLayers(activeLayers.filter((l: string) => l !== source.name));
                          } else {
                            setActiveLayers([...activeLayers, source.name]);
                          }
                        }}
                        className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${
                          isActive ? 'bg-[#34C759]' : 'bg-slate-300 dark:bg-slate-700'
                        }`}
                      >
                        <span
                          className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-md transition-transform ${
                            isActive ? 'right-0.5' : 'left-0.5'
                          }`}
                        />
                      </button>
                    </div>
                  );
                })}
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* ABA: ENDEREÇOS IBGE CNEFE (DUCKDB) */}
        {/* ============================================================== */}
        {activeTab === 'cnefe' && (
          <div className="animate-fadeIn">
            <IbgeSearchPanel
              onPlotAddress={onPlotAddress}
              onPlotAllAddresses={onPlotAllAddresses}
              onClearPlot={onClearPlot}
              externalPolygonResult={cnefeExternalResult}
              allowedColumns={allowedColumns}
            />
          </div>
        )}

        {/* ============================================================== */}
        {/* ABA: RAIO-X TERRITORIAL E DOMICILIAR */}
        {/* ============================================================== */}
        {activeTab === 'dashboard' && (
          <div className="space-y-4 animate-fadeIn">
            {selectedFeatures.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-xs space-y-2">
                <Users className="w-8 h-8 mx-auto text-slate-300 dark:text-slate-600" />
                <p className="font-bold text-slate-600 dark:text-slate-300">
                  Nenhuma região selecionada
                </p>
                <p>Toque em um bairro, município ou setor censitário no mapa para gerar o Raio-X populacional.</p>
              </div>
            ) : (
              <Dashboard selectedFeatures={selectedFeatures} />
            )}
          </div>
        )}

        {/* ============================================================== */}
        {/* ABA: TABELA DE ESPECIFICAÇÕES & EXPORTAÇÃO */}
        {/* ============================================================== */}
        {activeTab === 'table' && (
          <div className="space-y-4 animate-fadeIn">
            {selectedFeatures.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-xs space-y-2">
                <Table2 className="w-8 h-8 mx-auto text-slate-300 dark:text-slate-600" />
                <p className="font-bold text-slate-600 dark:text-slate-300">
                  Nenhuma feição selecionada
                </p>
                <p>Selecione uma ou mais áreas no mapa para visualizar a tabela de atributos ou exportar.</p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={onOpenFullTableModal}
                    className="flex-1 py-2.5 px-3 bg-[#007AFF] hover:bg-[#0066d6] text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm transition-all cursor-pointer"
                  >
                    <ExternalLink className="w-4 h-4" />
                    <span>Expandir Tabela Completa</span>
                  </button>

                  <button
                    type="button"
                    onClick={onOpenExportModal}
                    className="py-2.5 px-3 bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/15 text-slate-800 dark:text-slate-200 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
                  >
                    <Download className="w-4 h-4" />
                    <span>Exportar</span>
                  </button>
                </div>

                <PropertyTable
                  selectedFeatures={selectedFeatures}
                  showToast={showToast}
                  allowedProperties={allowedProperties}
                  onSearchPolygonAddresses={onSearchPolygonAddresses}
                />
              </div>
            )}
          </div>
        )}
      </div>

      {/* 4. RODAPÉ DA BARRA LATERAL (Card Apple: Usuário + Info) */}
      <div className="p-3 border-t border-black/5 dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.02] shrink-0 space-y-2">
        {/* Card do Usuário */}
        <div className="flex items-center justify-between gap-2 p-2 rounded-2xl bg-black/5 dark:bg-white/5">
          <button
            type="button"
            onClick={onOpenProfileModal}
            className="flex items-center gap-2 min-w-0 text-left cursor-pointer group"
          >
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
              isMaster ? 'bg-amber-500 text-white' : isManager ? 'bg-indigo-600 text-white' : 'bg-slate-300 dark:bg-slate-700 text-slate-800 dark:text-slate-200'
            }`}>
              {isMaster ? <Crown className="w-4 h-4" /> : isManager ? <Briefcase className="w-4 h-4" /> : <User className="w-4 h-4" />}
            </div>
            <div className="min-w-0">
              <span className="text-xs font-bold text-slate-900 dark:text-white truncate block group-hover:text-[#007AFF] transition-colors">
                {currentActiveUser ? currentActiveUser.name : 'Visitante'}
              </span>
              <span className="text-[10px] text-slate-400 font-medium truncate block">
                {isMaster ? 'Master • Gestor Supremo' : isManager ? 'Gerente' : 'Conta Padrão'}
              </span>
            </div>
          </button>

          <div className="flex items-center gap-1">
            {isMaster && (
              <button
                type="button"
                onClick={onOpenAdminPanel}
                className="p-1.5 rounded-xl bg-black/5 dark:bg-white/10 hover:bg-black/10 text-slate-700 dark:text-slate-300 cursor-pointer"
                title="Painel Master"
              >
                <SlidersHorizontal className="w-4 h-4" />
              </button>
            )}

            <button
              type="button"
              onClick={onToggleDarkMode}
              className="p-1.5 rounded-xl bg-black/5 dark:bg-white/10 hover:bg-black/10 text-slate-700 dark:text-slate-300 cursor-pointer"
              title={isDarkMode ? "Ativar Modo Claro" : "Ativar Modo Escuro"}
            >
              {isDarkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4" />}
            </button>

            <button
              type="button"
              onClick={onLogout}
              className="p-1.5 rounded-xl bg-black/5 dark:bg-white/10 hover:bg-red-50 hover:text-red-600 text-slate-400 cursor-pointer transition-colors"
              title="Sair do sistema"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Sub-rodapé estilo Apple (Gerencie sua empresa / Geocodificando) */}
        <div className="flex items-center justify-between text-[11px] text-slate-400 px-1 pt-1">
          <span className="truncate">WebGIS Geocodificando</span>
          <button 
            type="button"
            onClick={onOpenHelp}
            className="text-[#007AFF] hover:underline font-bold cursor-pointer"
          >
            Ajuda ↗
          </button>
        </div>
      </div>
    </aside>
  );
};
