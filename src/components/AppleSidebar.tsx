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
import { dataSources, propertyNames, situationMap, typeMap } from '../data';
import { getIdentifier, getTranslatedValue, getFeatureCenter, toTitleCase, isCodeOrSystemProperty } from '../utils';
import { Dashboard } from './Dashboard';

export type SidebarTab = 'search' | 'details' | 'dashboard' | null;

interface AppleSidebarProps {
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  activeTab: SidebarTab;
  setActiveTab: (tab: SidebarTab) => void;
  onOpenCnefeBottomBar?: () => void;
  
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
  { id: 'farmacias', name: 'Farmácias', icon: Pill, color: 'bg-rose-500', query: 'Farmácia' },
  { id: 'restaurantes', name: 'Restaurantes', icon: UtensilsCrossed, color: 'bg-orange-500', query: 'Restaurante' },
  { id: 'postos', name: 'Postos de Gasolina', icon: Fuel, color: 'bg-blue-600', query: 'Posto' },
  { id: 'hoteis', name: 'Hotéis', icon: Hotel, color: 'bg-indigo-500', query: 'Hotel' },
  { id: 'hospitais', name: 'Hospitais', icon: Hospital, color: 'bg-red-600', query: 'Hospital' }
];

export const AppleSidebar: React.FC<AppleSidebarProps> = ({
  isCollapsed,
  onToggleCollapse,
  activeTab,
  setActiveTab,
  onOpenCnefeBottomBar,
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

  // Extração estruturada de informações amigáveis e descritivas (Nomes, Demografia, Área, Situação e Tipo)
  const structuredDetails = useMemo(() => {
    if (!activeDetailFeature || !activeDetailFeature.properties) return null;
    const props = activeDetailFeature.properties;

    // 1. Nomes Oficiais formatados em Title Case (Caixa alta/baixa legível)
    const rawOficial = activeDetailFeature.name || props.Nome || props.Localidade || props.NM_MUN || props.NM_BAIRRO || '';
    const nomeOficial = toTitleCase(rawOficial);
    const nomeMunicipio = toTitleCase(props.NM_MUN || props['Nome do município'] || props.Municipio || props.MUNICIPIO || '');
    const nomeBairro = toTitleCase(props.NM_BAIRRO || props.Bairro || props.BAIRRO || '');
    const nomeDistrito = toTitleCase(props.NM_DIST || props.Distrito || props.DISTRITO || '');
    const nomeSubdistrito = toTitleCase(props.NM_SUBDIST || props.Subdistrito || props.subdistrito || props.Zona || props['Nome do subdistrito'] || '');
    const nomeComunidade = toTitleCase(props.NM_FCU || (activeDetailFeature.sourceName === 'Comunidades Rurais de Teresina' ? props.Nome : '') || '');
    const nomeNucleo = toTitleCase(props.NM_NU || '');
    const nomeAglomerado = toTitleCase(props.NM_AGLOM || '');
    const nomeLocalidade = toTitleCase(props.Localidade || '');
    const nomeUf = toTitleCase(props.NM_UF || props.UF || 'Piauí');
    const nomeRgInt = toTitleCase(props.NM_RGINT || '');
    const nomeRgI = toTitleCase(props.NM_RGI || '');

    // 2. Área territorial em km²
    let areaKm2: string | null = null;
    const rawArea = props.AREA_KM2 != null ? Number(props.AREA_KM2) : (props.Area != null ? Number(props.Area) : (props.area_km2 != null ? Number(props.area_km2) : null));
    if (rawArea != null && !isNaN(rawArea) && rawArea > 0) {
      areaKm2 = `${rawArea.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: rawArea < 1 ? 3 : 2 })} km²`;
    }

    // 3. Situação e Tipo descritivos
    let situacao = props.SITUACAO || props['Situação detalhada'] || props.NM_SIT || '';
    if (props.CD_SIT && situationMap[String(props.CD_SIT)]) {
      situacao = situationMap[String(props.CD_SIT)];
    }
    situacao = situacao ? toTitleCase(String(situacao)) : '';

    let tipoDescritivo = props['Tipo do Setor'] || props.tipo || props.NM_TIPO || '';
    if (props.CD_TIPO && typeMap[String(props.CD_TIPO)]) {
      tipoDescritivo = typeMap[String(props.CD_TIPO)];
    }
    tipoDescritivo = tipoDescritivo ? toTitleCase(String(tipoDescritivo)) : '';

    // 4. Regionalização & Segurança
    const areaDesenvolvimento = toTitleCase(props['Area de desenvolvimento'] || props['Área de desenvolvimento'] || '');
    const risp = toTitleCase(props.Risp || props.RISP || '');
    const aisp = toTitleCase(props.Aisp || props.AISP || '');

    // 5. Métricas Demográficas
    const popTotal = Number(props['V0001'] || props['Total de pessoas'] || 0);
    const domTotal = Number(props['V0002'] || props['Total de Domicílios'] || 0);
    const domParticulares = Number(props['V0003'] || props['Total de Domicílios Particulares'] || 0);
    const domOcupados = Number(props['V0007'] || props['Total de Domicílios Particulares Ocupados'] || 0);
    const domColetivos = Number(props['V0004'] || props['Total de Domicílios Coletivos'] || 0);

    const domVagos = domParticulares > 0 && domOcupados > 0 ? Math.max(0, domParticulares - domOcupados) : 0;
    const taxaVacancia = domParticulares > 0 && domVagos > 0 ? `${((domVagos / domParticulares) * 100).toFixed(1)}%` : null;

    let mediaMoradores: string | null = null;
    if (props['V0005']) {
      mediaMoradores = Number(props['V0005']).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 2 });
    } else if (domOcupados > 0 && popTotal > 0) {
      mediaMoradores = (popTotal / domOcupados).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 2 });
    }

    return {
      nomeOficial,
      nomeMunicipio,
      nomeBairro,
      nomeDistrito,
      nomeSubdistrito,
      nomeComunidade,
      nomeNucleo,
      nomeAglomerado,
      nomeLocalidade,
      nomeUf,
      nomeRgInt,
      nomeRgI,
      areaKm2,
      situacao,
      tipoDescritivo,
      areaDesenvolvimento,
      risp,
      aisp,
      popTotal,
      domTotal,
      domParticulares,
      domOcupados,
      domColetivos,
      domVagos,
      taxaVacancia,
      mediaMoradores
    };
  }, [activeDetailFeature]);

  // Lista ordenada de propriedades amigáveis e descritivas para a seção Detalhes & Propriedades
  const detailProperties = useMemo(() => {
    if (!structuredDetails) return [];
    const d = structuredDetails;
    const items: Array<{ key: string; label: string; value: string }> = [];

    // Helper de permissão: apenas restringe se expressamente configurado como false
    const isAllowed = (k: string) => {
      if (isAdmin) return true;
      if (!allowedProperties) return true;
      return allowedProperties[k] !== false;
    };

    // --- GRUPO 1: NOMES OFICIAIS FORMATADOS EM TITLE CASE ---
    if (d.nomeMunicipio && isAllowed('NM_MUN')) {
      items.push({ key: 'NM_MUN', label: 'Nome do Município', value: d.nomeMunicipio });
    }
    if (d.nomeBairro && isAllowed('NM_BAIRRO')) {
      items.push({ key: 'NM_BAIRRO', label: 'Nome do Bairro', value: d.nomeBairro });
    }
    if (d.nomeDistrito && isAllowed('NM_DIST')) {
      items.push({ key: 'NM_DIST', label: 'Nome do Distrito', value: d.nomeDistrito });
    }
    if (d.nomeSubdistrito && isAllowed('NM_SUBDIST')) {
      items.push({ key: 'NM_SUBDIST', label: 'Zona / Subdistrito', value: d.nomeSubdistrito });
    }
    if (d.nomeComunidade && isAllowed('NM_FCU')) {
      items.push({ key: 'NM_FCU', label: 'Favela / Comunidade', value: d.nomeComunidade });
    }
    if (d.nomeNucleo && isAllowed('NM_NU')) {
      items.push({ key: 'NM_NU', label: 'Núcleo Urbano', value: d.nomeNucleo });
    }
    if (d.nomeAglomerado && isAllowed('NM_AGLOM')) {
      items.push({ key: 'NM_AGLOM', label: 'Aglomerado Rural', value: d.nomeAglomerado });
    }
    if (d.nomeLocalidade && isAllowed('Localidade')) {
      items.push({ key: 'Localidade', label: 'Localidade / Povoado', value: d.nomeLocalidade });
    }
    if (d.nomeRgInt && isAllowed('NM_RGINT')) {
      items.push({ key: 'NM_RGINT', label: 'Região Intermediária', value: d.nomeRgInt });
    }
    if (d.nomeRgI && isAllowed('NM_RGI')) {
      items.push({ key: 'NM_RGI', label: 'Região Imediata', value: d.nomeRgI });
    }
    if (d.nomeUf && isAllowed('NM_UF')) {
      items.push({ key: 'NM_UF', label: 'Nome da UF', value: `${d.nomeUf} (PI)` });
    }

    // --- GRUPO 2: ÁREA TERRITORIAL EM KM² ---
    if (d.areaKm2 && isAllowed('AREA_KM2')) {
      items.push({ key: 'AREA_KM2', label: 'Área Territorial', value: d.areaKm2 });
    }

    // --- GRUPO 3: SITUAÇÃO E TIPO DESCRITIVOS ---
    if (d.situacao && isAllowed('SITUACAO')) {
      items.push({ key: 'SITUACAO', label: 'Situação', value: d.situacao });
    }
    if (d.tipoDescritivo && isAllowed('CD_TIPO')) {
      items.push({ key: 'CD_TIPO', label: 'Tipo do Setor / Feição', value: d.tipoDescritivo });
    }

    // --- GRUPO 4: REGIONALIZAÇÃO E SEGURANÇA ---
    if (d.areaDesenvolvimento && isAllowed('Area de desenvolvimento')) {
      items.push({ key: 'Area de desenvolvimento', label: 'Área de Desenvolvimento', value: d.areaDesenvolvimento });
    }
    if (d.risp && isAllowed('Risp')) {
      items.push({ key: 'Risp', label: 'RISP', value: d.risp });
    }
    if (d.aisp && isAllowed('Aisp')) {
      items.push({ key: 'Aisp', label: 'AISP', value: d.aisp });
    }

    // --- GRUPO 5: MÉTRICAS DEMOGRÁFICAS DETALHADAS ---
    if (d.popTotal > 0 && isAllowed('V0001')) {
      items.push({ key: 'V0001', label: 'População Total', value: `${d.popTotal.toLocaleString('pt-BR')} hab` });
    }
    if (d.domTotal > 0 && isAllowed('V0002')) {
      items.push({ key: 'V0002', label: 'Total de Domicílios', value: d.domTotal.toLocaleString('pt-BR') });
    }
    if (d.domParticulares > 0 && isAllowed('V0003')) {
      items.push({ key: 'V0003', label: 'Domicílios Particulares', value: d.domParticulares.toLocaleString('pt-BR') });
    }
    if (d.domOcupados > 0 && isAllowed('V0007')) {
      items.push({ key: 'V0007', label: 'Domicílios Particulares Ocupados', value: d.domOcupados.toLocaleString('pt-BR') });
    }
    if (d.domColetivos > 0 && isAllowed('V0004')) {
      items.push({ key: 'V0004', label: 'Domicílios Coletivos', value: d.domColetivos.toLocaleString('pt-BR') });
    }
    if (d.domVagos > 0) {
      items.push({ key: 'dom_vagos', label: 'Domicílios Vagos / Ocasional', value: d.domVagos.toLocaleString('pt-BR') });
    }
    if (d.taxaVacancia) {
      items.push({ key: 'taxa_vacancia', label: 'Taxa de Vacância', value: d.taxaVacancia });
    }
    if (d.mediaMoradores && isAllowed('V0005')) {
      items.push({ key: 'V0005', label: 'Média de Moradores', value: `${d.mediaMoradores} moradores/dom.` });
    }

    // --- OUTROS ATRIBUTOS PERSONALIZADOS (filtrando estritamente fid e códigos) ---
    if (activeDetailFeature?.properties) {
      const alreadyHandled = new Set(items.map(i => i.key.toLowerCase()));
      const standardExcluded = new Set([
        'fid', 'ogc_fid', 'id', 'gid', 'geom', 'geometry',
        'cd_mun', 'cd_bairro', 'cd_dist', 'cd_subdist', 'cd_setor', 'cd_fcu', 'cd_nu', 'cd_aglom', 'cd_rgint', 'cd_rgi', 'cd_concurb', 'cd_uf', 'cd_regiao',
        'cod_risp', 'cod_aisp', 'cod_area de desenvolvimento', 'id_localidades',
        'nm_mun', 'nm_bairro', 'nm_dist', 'nm_subdist', 'nm_fcu', 'nm_nu', 'nm_aglom', 'nm_rgint', 'nm_rgi', 'nm_uf',
        'nome', 'municipio', 'bairro', 'subdistrito', 'distrito', 'zona', 'localidade',
        'area_km2', 'area',
        'situacao', 'cd_sit', 'cd_tipo', 'situação detalhada', 'tipo do setor', 'tipo', 'nm_sit', 'nm_tipo',
        'risp', 'aisp', 'area de desenvolvimento', 'área de desenvolvimento',
        'v0001', 'v0002', 'v0003', 'v0004', 'v0005', 'v0006', 'v0007',
        'total de pessoas', 'total de domicílios', 'total de domicílios particulares', 'total de domicílios coletivos', 'total de domicílios particulares ocupados'
      ]);

      Object.entries(activeDetailFeature.properties).forEach(([k, val]) => {
        const lowK = k.toLowerCase().trim();
        if (alreadyHandled.has(lowK) || standardExcluded.has(lowK) || isCodeOrSystemProperty(k)) return;
        if (val == null || String(val).trim() === '') return;
        if (!isAllowed(k)) return;

        let displayVal = getTranslatedValue(k, val);
        if (typeof val === 'string') {
          displayVal = toTitleCase(displayVal);
        }
        const label = propertyNames[k] || k;
        items.push({
          key: k,
          label,
          value: String(displayVal)
        });
      });
    }

    return items;
  }, [structuredDetails, activeDetailFeature, allowedProperties, isAdmin]);

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

  return (
    <aside 
      aria-label="Barra de Ferramentas Estilo Apple Maps"
      className="relative z-30 h-full flex shrink-0 select-none font-sans"
    >
      {/* ============================================================== */}
      {/* ESTÁGIO 1: BARRA / RAIL DE NAVEGAÇÃO LATERAL (APPLE SIDEBAR)   */}
      {/* ============================================================== */}
      <nav
        className={`h-full flex flex-col transition-all duration-300 ease-out bg-white/90 dark:bg-[#1c1c1e]/90 backdrop-blur-3xl border-r border-black/10 dark:border-white/10 shadow-xl overflow-hidden shrink-0 ${
          isCollapsed ? 'w-[68px] items-center py-3.5 px-2' : 'w-[205px] sm:w-[215px] p-3'
        }`}
      >
        {/* Topo / Header da Barra de Navegação */}
        {!isCollapsed ? (
          <div className="flex items-center justify-between pb-3 mb-2 border-b border-black/5 dark:border-white/10 w-full shrink-0">
            <div 
              className="flex items-center cursor-pointer select-none group"
              onDoubleClick={onOpenAdminPanel}
              title="WebGis SSP-PI • Clique duplo para login de Administrador"
            >
              <img 
                src="https://raw.githubusercontent.com/marciodemelosilvageo-glitch/GeoCode/main/logo/Nova%20logo.png" 
                alt="Logo"
                className="h-9 sm:h-10 w-auto max-w-[135px] object-contain transition-transform group-hover:scale-105 pointer-events-none drop-shadow-xs"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = 'https://raw.githubusercontent.com/marciodemelosilvageo-glitch/GeoCode/main/logo/image-removebg-preview.png';
                }}
              />
            </div>

            {/* Botão de Minimizar para ícones (como na Imagem 1 -> Imagem 3) */}
            <button
              type="button"
              onClick={onToggleCollapse}
              className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10 active:scale-95 transition-all cursor-pointer"
              title="Minimizar barra lateral para ícones"
              aria-label="Minimizar barra lateral"
            >
              <PanelLeft className="w-5 h-5 text-[#007AFF]" />
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 pb-3 mb-2 border-b border-black/5 dark:border-white/10 w-full shrink-0">
            {/* Botão de Expandir para texto (como na Imagem 3 -> Imagem 1) */}
            <button
              type="button"
              onClick={onToggleCollapse}
              className="w-10 h-10 rounded-2xl flex items-center justify-center text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10 active:scale-95 transition-all cursor-pointer"
              title="Expandir barra lateral"
              aria-label="Expandir barra lateral"
            >
              <PanelLeft className="w-5 h-5 text-[#007AFF]" />
            </button>
          </div>
        )}

        {/* Lista de Ferramentas (Estágio 1 - Imagem 1 e Imagem 3) */}
        <div className="flex flex-col gap-2 w-full flex-1 overflow-y-auto custom-scrollbar">
          {/* 1. Buscar */}
          <div className="relative group w-full flex items-center">
            <button
              type="button"
              onClick={() => setActiveTab(activeTab === 'search' ? null : 'search')}
              className={`w-full flex items-center gap-3 rounded-2xl font-bold transition-all cursor-pointer ${
                isCollapsed 
                  ? 'w-11 h-11 justify-center p-0 mx-auto' 
                  : 'px-3 py-2.5 text-sm'
              } ${
                activeTab === 'search'
                  ? 'bg-[#007AFF] text-white shadow-lg shadow-blue-500/25'
                  : 'text-slate-800 dark:text-slate-200 hover:bg-black/5 dark:hover:bg-white/10'
              }`}
              title={isCollapsed ? "Buscar" : undefined}
            >
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
                activeTab === 'search' 
                  ? (isCollapsed ? '' : 'bg-white/20 text-white') 
                  : 'bg-black/5 dark:bg-white/10 text-slate-700 dark:text-slate-300 group-hover:text-[#007AFF]'
              }`}>
                <Search className={isCollapsed ? "w-5 h-5" : "w-4 h-4"} />
              </div>
              {!isCollapsed && <span className="truncate">Buscar</span>}
            </button>

            {/* Tooltip Apple Maps estilo balão flutuante (Imagem 3) */}
            {isCollapsed && (
              <div className="absolute left-full ml-2.5 px-2.5 py-1 bg-slate-800/95 dark:bg-slate-700/95 text-white text-xs font-bold rounded-xl shadow-xl pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity z-50 whitespace-nowrap flex items-center">
                <div className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-slate-800/95 dark:border-r-slate-700/95" />
                <span>Buscar</span>
              </div>
            )}
          </div>

          {/* 2. Raio-X */}
          <div className="relative group w-full flex items-center">
            <button
              type="button"
              onClick={() => setActiveTab(activeTab === 'dashboard' ? null : 'dashboard')}
              className={`w-full flex items-center gap-3 rounded-2xl font-bold transition-all cursor-pointer ${
                isCollapsed 
                  ? 'w-11 h-11 justify-center p-0 mx-auto' 
                  : 'px-3 py-2.5 text-sm'
              } ${
                activeTab === 'dashboard'
                  ? 'bg-[#007AFF] text-white shadow-lg shadow-blue-500/25'
                  : 'text-slate-800 dark:text-slate-200 hover:bg-black/5 dark:hover:bg-white/10'
              }`}
              title={isCollapsed ? "Raio-X Territorial e Domiciliar" : undefined}
            >
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
                activeTab === 'dashboard' 
                  ? (isCollapsed ? '' : 'bg-white/20 text-white') 
                  : 'bg-black/5 dark:bg-white/10 text-slate-700 dark:text-slate-300 group-hover:text-[#34C759]'
              }`}>
                <Users className={isCollapsed ? "w-5 h-5" : "w-4 h-4"} />
              </div>
              {!isCollapsed && <span className="truncate">Raio-X</span>}
            </button>

            {/* Tooltip */}
            {isCollapsed && (
              <div className="absolute left-full ml-2.5 px-2.5 py-1 bg-slate-800/95 dark:bg-slate-700/95 text-white text-xs font-bold rounded-xl shadow-xl pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity z-50 whitespace-nowrap flex items-center">
                <div className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-slate-800/95 dark:border-r-slate-700/95" />
                <span>Raio-X Territorial e Domiciliar</span>
              </div>
            )}
          </div>

          {/* 3. Detalhes (Apenas quando feição selecionada) */}
          {hasFeature && (
            <div className="relative group w-full flex items-center">
              <button
                type="button"
                onClick={() => setActiveTab(activeTab === 'details' ? null : 'details')}
                className={`w-full flex items-center gap-3 rounded-2xl font-bold transition-all cursor-pointer ${
                  isCollapsed 
                    ? 'w-11 h-11 justify-center p-0 mx-auto' 
                    : 'px-3 py-2.5 text-sm'
                } ${
                  activeTab === 'details'
                    ? 'bg-[#007AFF] text-white shadow-lg shadow-blue-500/25'
                    : 'text-slate-800 dark:text-slate-200 hover:bg-black/5 dark:hover:bg-white/10'
                }`}
                title={isCollapsed ? "Detalhes da Feição" : undefined}
              >
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
                  activeTab === 'details' ? (isCollapsed ? '' : 'bg-white/20 text-white') : 'bg-amber-500/10 text-[#FF9500]'
                }`}>
                  <MapPin className={isCollapsed ? "w-5 h-5" : "w-4 h-4"} />
                </div>
                {!isCollapsed && (
                  <>
                    <span className="truncate">Detalhes</span>
                    <span className="ml-auto w-2 h-2 rounded-full bg-[#FF9500] animate-ping" />
                  </>
                )}
              </button>

              {/* Tooltip */}
              {isCollapsed && (
                <div className="absolute left-full ml-2.5 px-2.5 py-1 bg-slate-800/95 dark:bg-slate-700/95 text-white text-xs font-bold rounded-xl shadow-xl pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity z-50 whitespace-nowrap flex items-center">
                  <div className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-slate-800/95 dark:border-r-slate-700/95" />
                  <span>Detalhes</span>
                </div>
              )}
            </div>
          )}

        </div>

        {/* Rodapé do Estágio 1 */}
        {!isCollapsed ? (
          <div className="pt-3 border-t border-black/5 dark:border-white/10 shrink-0 space-y-2 w-full">
            <div className="flex items-center justify-between gap-2 p-2 rounded-2xl bg-black/5 dark:bg-white/5">
              <button
                type="button"
                onClick={onOpenProfileModal}
                className="flex items-center gap-2 min-w-0 text-left cursor-pointer group flex-1"
              >
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                  isMaster ? 'bg-amber-500 text-white' : isManager ? 'bg-indigo-600 text-white' : 'bg-slate-300 dark:bg-slate-700 text-slate-800 dark:text-slate-200'
                }`}>
                  {isMaster ? <Crown className="w-4 h-4" /> : isManager ? <Briefcase className="w-4 h-4" /> : <User className="w-4 h-4" />}
                </div>
                <div className="min-w-0 flex-1">
                  <span className="text-xs font-bold text-slate-900 dark:text-white truncate block group-hover:text-[#007AFF] transition-colors">
                    {currentActiveUser ? currentActiveUser.name : 'Visitante'}
                  </span>
                  <span className="text-[10px] text-slate-400 font-medium truncate block">
                    {isMaster ? 'Master' : isManager ? 'Gerente' : 'Conta Padrão'}
                  </span>
                </div>
              </button>

              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={onToggleDarkMode}
                  className="p-1.5 rounded-xl bg-black/5 dark:bg-white/10 hover:bg-black/10 text-slate-700 dark:text-slate-300 cursor-pointer"
                  title={isDarkMode ? "Modo Claro" : "Modo Escuro"}
                >
                  {isDarkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4" />}
                </button>

                {currentActiveUser && (
                  <button
                    type="button"
                    onClick={onLogout}
                    className="p-1.5 rounded-xl bg-black/5 dark:bg-white/10 hover:bg-red-50 hover:text-red-600 text-slate-400 cursor-pointer transition-colors"
                    title="Sair"
                  >
                    <LogOut className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between text-[11px] text-slate-400 px-1">
              <span className="truncate">WebGIS</span>
              <button 
                type="button"
                onClick={onOpenHelp}
                className="text-[#007AFF] hover:underline font-bold cursor-pointer"
              >
                Ajuda ↗
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 pt-3 border-t border-black/10 dark:border-white/10 w-full shrink-0">
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
        )}
      </nav>

      {/* ============================================================== */}
      {/* ESTÁGIO 2: PAINEL DA FERRAMENTA SELECIONADA (SEGUNDO ESTÁGIO)  */}
      {/* ============================================================== */}
      {activeTab && (
        <div
          className="h-full w-[360px] sm:w-[390px] max-w-[calc(100vw-72px)] flex flex-col transition-all duration-300 ease-out bg-white/95 dark:bg-[#1c1c1e]/95 backdrop-blur-3xl border-r border-black/10 dark:border-white/10 shadow-2xl overflow-hidden shrink-0 animate-fadeIn"
        >
          {/* Cabeçalho do Segundo Estágio (Título + Botão X redondo de fechar) */}
          <div className="h-14 px-4 border-b border-black/5 dark:border-white/10 flex items-center justify-between shrink-0">
            <h2 className="text-lg font-black text-slate-900 dark:text-white tracking-tight">
              {activeTab === 'search' && 'Buscar'}
              {activeTab === 'dashboard' && 'Raio-X Territorial e Domiciliar'}
              {activeTab === 'details' && 'Detalhes da Feição'}
            </h2>

            <button
              type="button"
              onClick={() => setActiveTab(null)}
              className="w-8 h-8 rounded-full bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/20 text-slate-600 dark:text-slate-300 flex items-center justify-center transition-all cursor-pointer active:scale-90"
              title="Fechar painel"
              aria-label="Fechar painel"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Conteúdo rolável do painel */}
          <div className="flex-1 overflow-y-auto custom-scrollbar p-3 sm:p-4 space-y-4">
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
                  {structuredDetails?.nomeOficial || activeDetailFeature.name || 'Local Selecionado'}
                </h2>
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 truncate">
                  {activeDetailFeature.sourceName} • {
                    (activeDetailFeature.sourceName?.toLowerCase().includes('municipio') ||
                     (structuredDetails?.nomeMunicipio && (structuredDetails.nomeOficial || activeDetailFeature.name) &&
                      structuredDetails.nomeMunicipio.toLowerCase().trim() === (structuredDetails.nomeOficial || activeDetailFeature.name).toLowerCase().trim()))
                      ? (structuredDetails?.nomeUf || 'Piauí')
                      : (structuredDetails?.nomeMunicipio ? `${structuredDetails.nomeMunicipio}, PI` : (structuredDetails?.nomeUf || 'Piauí'))
                  }
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
                onClick={() => {
                  onSearchPolygonAddresses(activeDetailFeature);
                  onOpenCnefeBottomBar?.();
                }}
                className="py-2.5 px-2 bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/15 active:scale-95 text-slate-800 dark:text-slate-200 rounded-2xl flex flex-col items-center justify-center gap-1 text-[11px] font-bold transition-all cursor-pointer"
                title="Abrir Busca de Endereços Avançado desta área na barra inferior"
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
                    {structuredDetails?.popTotal ? `${structuredDetails.popTotal.toLocaleString('pt-BR')} hab` : '—'}
                  </span>
                </div>

                <div className="p-2.5 bg-white dark:bg-[#2c2c2e] rounded-xl shadow-xs">
                  <span className="text-[10px] text-slate-400 dark:text-slate-500 font-bold block">Domicílios</span>
                  <span className="text-sm font-black text-slate-800 dark:text-slate-100">
                    {structuredDetails?.domTotal ? structuredDetails.domTotal.toLocaleString('pt-BR') : '—'}
                  </span>
                </div>

                {structuredDetails?.mediaMoradores && (
                  <div className="p-2.5 bg-white dark:bg-[#2c2c2e] rounded-xl shadow-xs">
                    <span className="text-[10px] text-slate-400 dark:text-slate-500 font-bold block">Média de Moradores</span>
                    <span className="text-sm font-black text-slate-800 dark:text-slate-100">
                      {structuredDetails.mediaMoradores} /dom.
                    </span>
                  </div>
                )}

                {structuredDetails?.areaKm2 && (
                  <div className="p-2.5 bg-white dark:bg-[#2c2c2e] rounded-xl shadow-xs">
                    <span className="text-[10px] text-slate-400 dark:text-slate-500 font-bold block">Área Territorial</span>
                    <span className="text-sm font-black text-slate-800 dark:text-slate-100">
                      {structuredDetails.areaKm2}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Detalhes e Atributos da Feição */}
            <div className="bg-black/5 dark:bg-white/5 rounded-2xl p-3.5 space-y-2">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Detalhes & Propriedades
              </h3>

              {detailProperties.length > 0 ? (
                <div className="divide-y divide-black/5 dark:divide-white/10 text-xs">
                  {detailProperties.map((prop) => (
                    <div key={prop.key} className="py-2 flex items-center justify-between gap-2">
                      <span className="font-semibold text-slate-500 dark:text-slate-400 truncate max-w-[140px]" title={prop.label}>
                        {prop.label}
                      </span>
                      <div className="flex items-center gap-1.5 shrink-0 font-bold text-slate-800 dark:text-slate-200">
                        <span className="truncate max-w-[170px]" title={prop.value}>{prop.value}</span>
                        <button
                          type="button"
                          onClick={() => handleCopy(prop.value, prop.label)}
                          className="p-1 hover:bg-black/10 dark:hover:bg-white/10 rounded cursor-pointer text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
                          title="Copiar valor"
                        >
                          <Copy className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-400 dark:text-slate-500 py-2 text-center">
                  Nenhum atributo adicional a exibir.
                </p>
              )}
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

                <div className="flex flex-col gap-2">
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
                        className="w-full px-3.5 py-2.5 rounded-2xl bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 active:scale-[0.98] transition-all cursor-pointer flex items-center gap-3.5 text-left border border-black/5 dark:border-white/5"
                      >
                        <div className={`w-8 h-8 rounded-full ${cat.color} text-white flex items-center justify-center shrink-0 shadow-sm`}>
                          <Icon className="w-4 h-4" />
                        </div>
                        <span className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">
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
        {/* ABA: RAIO-X TERRITORIAL E DOMICILIAR */}
        {/* ============================================================== */}
        {activeTab === 'dashboard' && (
          <div className="animate-fadeIn">
            <Dashboard selectedFeatures={selectedFeatures} />
          </div>
        )}
          </div>
        </div>
      )}
    </aside>
  );
};
