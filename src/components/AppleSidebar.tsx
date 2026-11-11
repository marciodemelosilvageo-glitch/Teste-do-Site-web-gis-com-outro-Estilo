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
import { ExportDashboard } from './ExportDashboard';
import { HospitalSidebarPanel, CategorySearchType, CATEGORY_UI_META } from './HospitalSidebarPanel';
import { ExternalPolygonSearchResult } from './IbgeSearchPanel';
import { FeatureInfoCustomizerModal, CustomCardOption } from './FeatureInfoCustomizerModal';

export type SidebarTab = 'search' | 'details' | 'dashboard' | 'help' | 'export' | null;

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
  onSearchLocalidadeAddresses?: (localidade: string, municipio: string) => void;
  onSearchHospitais?: () => void;
  onSearchHospitaisByMunicipio?: (municipio: string) => void;
  onSearchCategoryByMunicipio?: (categoryId: string, municipio: string) => void;
  onSearchHospitaisByRadius?: (raioMetros: number) => void;
  cnefeMunicipios?: string[];
  isHospitalSearching?: boolean;
  
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

const DEFAULT_USEFUL_CARD_IDS = ['popTotal', 'domTotal', 'mediaMoradores', 'areaKm2'];

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
  onSearchLocalidadeAddresses,
  onSearchHospitais,
  onSearchHospitaisByMunicipio,
  onSearchCategoryByMunicipio,
  onSearchHospitaisByRadius,
  cnefeMunicipios,
  isHospitalSearching,
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

  // Controlar se a feição exibida em detalhes foi aberta a partir de um clique no resultado da busca lateral
  const [openedFromSearch, setOpenedFromSearch] = useState<boolean>(false);
  const [activeCategorySearchId, setActiveCategorySearchId] = useState<CategorySearchType | null>(null);
  const lastSearchClickTimeRef = useRef<number>(0);

  // Estado e persistência de Informações Úteis personalizáveis no localStorage
  const [isCustomizerModalOpen, setIsCustomizerModalOpen] = useState<boolean>(false);
  const usefulCardsStorageKey = useMemo(() => {
    return currentActiveUser?.username ? `useful_cards_${currentActiveUser.username}` : 'useful_cards_default';
  }, [currentActiveUser?.username]);

  const [usefulCardIds, setUsefulCardIds] = useState<string[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const key = currentActiveUser?.username ? `useful_cards_${currentActiveUser.username}` : 'useful_cards_default';
        const saved = localStorage.getItem(key);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        }
      } catch (e) {}
    }
    return DEFAULT_USEFUL_CARD_IDS;
  });

  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem(usefulCardsStorageKey);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setUsefulCardIds(parsed);
            return;
          }
        }
      } catch (e) {}
    }
    setUsefulCardIds(DEFAULT_USEFUL_CARD_IDS);
  }, [usefulCardsStorageKey]);

  const handleSaveUsefulCards = (newIds: string[]) => {
    setUsefulCardIds(newIds);
    try {
      localStorage.setItem(usefulCardsStorageKey, JSON.stringify(newIds));
    } catch (e) {}
    showToast('Informações úteis personalizadas com sucesso!');
  };

  const handleResetUsefulCards = () => {
    setUsefulCardIds(DEFAULT_USEFUL_CARD_IDS);
    try {
      localStorage.removeItem(usefulCardsStorageKey);
    } catch (e) {}
    showToast('Restaurado o padrão das informações úteis.');
  };

  // Feição ativa detalhada (última selecionada)
  const activeDetailFeature = useMemo(() => {
    if (selectedFeatures.length === 0) return null;
    return selectedFeatures[selectedFeatures.length - 1];
  }, [selectedFeatures]);

  // Identificar se a feição selecionada pertence à camada de Localidades
  const isLocalidade = useMemo(() => {
    if (!activeDetailFeature) return false;
    const src = (activeDetailFeature.sourceName || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    if (src.includes('localidade')) return true;
    const props = activeDetailFeature.properties || {};
    if (props.id_Localidades != null || props.id_localidades != null || (props.Localidade && !props.NM_BAIRRO && !props.NM_MUN)) {
      return true;
    }
    return false;
  }, [activeDetailFeature]);

  // Identificar se a feição selecionada pertence à camada de Comunidades Rurais de Teresina
  const isComunidadeRural = useMemo(() => {
    if (!activeDetailFeature) return false;
    const src = (activeDetailFeature.sourceName || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    return src.includes('comunidades rurais') || src.includes('comunidade rural');
  }, [activeDetailFeature]);

  // Identificar se a feição selecionada é uma pesquisa de coordenada/ponto no mapa
  const isCoordenadaSearch = useMemo(() => {
    if (!activeDetailFeature) return false;
    const src = (activeDetailFeature.sourceName || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    return (
      activeDetailFeature.id === 'coord-search' ||
      activeDetailFeature.id?.startsWith('plot-') ||
      src === 'coordenadas' ||
      src.includes('coordenada') ||
      src.includes('enderecos plotados') ||
      src.includes('endereco') ||
      !!activeDetailFeature.properties?._details
    );
  }, [activeDetailFeature]);

  // Lista de feições identificadas no ponto pesquisado
  const coordDetailsList = useMemo(() => {
    if (!activeDetailFeature) return [];
    const raw = activeDetailFeature.properties?._details;
    let list: string[] = [];
    if (Array.isArray(raw)) list = [...raw] as string[];
    else if (typeof raw === 'string' && raw.trim()) list = [raw];

    // Se o ponto veio de qualquer busca por tipo (hospitais, farmácias, restaurantes, postos, hotéis), oculta:
    // "Identificação do Estabelecimento", "Espécie", "Cód. CNEFE"
    const isBuscaPorTipo = Boolean(activeDetailFeature.properties?.origem?.startsWith('tipo-'));
    if (isBuscaPorTipo && list.length > 0) {
      list = list.filter(item => {
        const colonIdx = item.indexOf(':');
        const label = (colonIdx !== -1 ? item.slice(0, colonIdx) : item)
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .trim();
        if (label.includes('identificacao do estabelecimento') || label === 'estabelecimento') return false;
        if (label.includes('especie')) return false;
        if (label.includes('cnefe') || label.includes('codigo unico')) return false;
        return true;
      });
    }

    return list;
  }, [activeDetailFeature]);


  // Coordenadas geográficas rigorosamente formatadas
  const featureCoords = useMemo(() => {
    if (!activeDetailFeature) return null;
    const props = activeDetailFeature.properties || {};
    const rawLat = props.LATITUDE ?? props.Latitude ?? props.latitude ?? props.lat ?? props.LAT;
    const rawLng = props.LONGITUDE ?? props.Longitude ?? props.longitude ?? props.lng ?? props.lon ?? props.LON;
    if (rawLat != null && rawLng != null && String(rawLat).trim() !== '' && String(rawLng).trim() !== '') {
      const lat = parseFloat(String(rawLat).replace(',', '.'));
      const lng = parseFloat(String(rawLng).replace(',', '.'));
      if (!isNaN(lat) && !isNaN(lng)) {
        return { lat, lng };
      }
    }
    if (activeDetailFeature.layer) {
      const lyr = activeDetailFeature.layer as any;
      if (typeof lyr.getLatLng === 'function') {
        const ll = lyr.getLatLng();
        if (ll && !isNaN(ll.lat) && !isNaN(ll.lng)) {
          return { lat: ll.lat, lng: ll.lng };
        }
      }
      if (typeof lyr.getBounds === 'function') {
        const b = lyr.getBounds();
        if (b && typeof b.isValid === 'function' && b.isValid()) {
          const c = b.getCenter();
          if (c && !isNaN(c.lat) && !isNaN(c.lng)) {
            return { lat: c.lat, lng: c.lng };
          }
        }
      }
    }
    return null;
  }, [activeDetailFeature]);

  // Metadados específicos e limpos para a camada de Localidades
  const localidadeMetadata = useMemo(() => {
    if (!isLocalidade || !activeDetailFeature?.properties) return null;
    const props = activeDetailFeature.properties;
    const rawNome = props.Localidade || props.NM_LOCALIDA || props.Nome || activeDetailFeature.name || '';
    const nome = toTitleCase(String(getTranslatedValue('Localidade', rawNome) || rawNome || '').trim());
    const rawMun = props['Nome do município'] || props.MUNICIPIO || props.Municipio || props.NM_MUN || '';
    const municipio = toTitleCase(String(rawMun).trim());
    const rawCep = props.CEP || props.cep || '';
    const cleanCep = String(rawCep).replace(/\D/g, '');
    const cep = cleanCep.length === 8 ? `${cleanCep.slice(0, 5)}-${cleanCep.slice(5)}` : (rawCep ? String(rawCep) : '');
    const idLoc = props.id_Localidades ?? props.id_localidades ?? props.ID ?? props.id ?? null;
    const rawAglom = props.Agromerado || props.AGROMERADO || props.Aglomerado || '';
    const aglomerado = rawAglom ? toTitleCase(String(rawAglom).trim()) : null;
    return {
      nome,
      municipio,
      cep,
      id: idLoc != null ? String(idLoc) : null,
      aglomerado
    };
  }, [isLocalidade, activeDetailFeature]);

  // Sincronizar origem da seleção: se a feição mudou por clique no mapa ou outra via fora do resultado de busca, resetar openedFromSearch
  useEffect(() => {
    const isFromSearchClick = Date.now() - lastSearchClickTimeRef.current < 2500;
    if (isFromSearchClick) {
      lastSearchClickTimeRef.current = 0; // Consumido com sucesso
    } else {
      setOpenedFromSearch(false);
    }
  }, [activeDetailFeature]);

  // Não fecha a aba 'details' automaticamente para permitir visualização permanente do estado explicativo

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

  // Catálogo completo de opções e valores formatados para a seção Informações Úteis
  const usefulCardsCatalog = useMemo(() => {
    if (!activeDetailFeature || !structuredDetails) return { options: [], valuesMap: {} as Record<string, { label: string; value: string }> };
    const d = structuredDetails;
    const props = activeDetailFeature.properties || {};

    // Helper de permissão: bloqueia campos proibidos pelo admin para usuário comum
    const isAllowed = (k?: string) => {
      if (!k) return true;
      if (isAdmin) return true;
      if (!allowedProperties) return true;
      return allowedProperties[k] !== false;
    };

    const rawAreaNum = props.AREA_KM2 != null ? Number(props.AREA_KM2) : (props.Area != null ? Number(props.Area) : (props.area_km2 != null ? Number(props.area_km2) : null));
    const densidadeCalculada = (d.popTotal > 0 && rawAreaNum && rawAreaNum > 0)
      ? `${(d.popTotal / rawAreaNum).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} hab/km²`
      : null;

    const baseItems: Array<{ id: string; label: string; value: string; propertyKey?: string; category?: any }> = [
      { id: 'popTotal', label: 'População', value: d.popTotal ? `${d.popTotal.toLocaleString('pt-BR')} hab` : '—', propertyKey: 'V0001', category: 'demografia' },
      { id: 'domTotal', label: 'Domicílios', value: d.domTotal ? d.domTotal.toLocaleString('pt-BR') : '—', propertyKey: 'V0002', category: 'demografia' },
      { id: 'mediaMoradores', label: 'Média de Moradores', value: d.mediaMoradores ? `${d.mediaMoradores} /dom.` : '—', propertyKey: 'V0005', category: 'demografia' },
      { id: 'areaKm2', label: 'Área Territorial', value: d.areaKm2 || '—', propertyKey: 'AREA_KM2', category: 'territorio' },
      { id: 'densidade', label: 'Densidade Demográfica', value: densidadeCalculada || '—', propertyKey: 'DENSIDADE', category: 'demografia' },
      { id: 'domParticulares', label: 'Dom. Particulares', value: d.domParticulares ? d.domParticulares.toLocaleString('pt-BR') : '—', propertyKey: 'V0003', category: 'demografia' },
      { id: 'domOcupados', label: 'Dom. Ocupados', value: d.domOcupados ? d.domOcupados.toLocaleString('pt-BR') : '—', propertyKey: 'V0007', category: 'demografia' },
      { id: 'domVagos', label: 'Dom. Vagos', value: d.domVagos ? d.domVagos.toLocaleString('pt-BR') : '—', category: 'demografia' },
      { id: 'taxaVacancia', label: 'Taxa de Vacância', value: d.taxaVacancia || '—', category: 'demografia' },
      { id: 'domColetivos', label: 'Dom. Coletivos', value: d.domColetivos ? d.domColetivos.toLocaleString('pt-BR') : '—', propertyKey: 'V0004', category: 'demografia' },
      { id: 'situacao', label: 'Situação', value: d.situacao || '—', propertyKey: 'SITUACAO', category: 'territorio' },
      { id: 'tipoDescritivo', label: 'Tipo do Setor/Feição', value: d.tipoDescritivo || '—', propertyKey: 'Tipo do Setor', category: 'territorio' },
      { id: 'areaDesenvolvimento', label: 'Área de Desenvolvimento', value: d.areaDesenvolvimento || '—', propertyKey: 'Area de desenvolvimento', category: 'territorio' },
      { id: 'risp', label: 'RISP (Segurança)', value: d.risp || '—', propertyKey: 'Risp', category: 'seguranca' },
      { id: 'aisp', label: 'AISP (Segurança)', value: d.aisp || '—', propertyKey: 'Aisp', category: 'seguranca' },
      { id: 'nomeMunicipio', label: 'Município', value: d.nomeMunicipio || '—', propertyKey: 'NM_MUN', category: 'localizacao' },
      { id: 'nomeBairro', label: 'Bairro', value: d.nomeBairro || '—', propertyKey: 'NM_BAIRRO', category: 'localizacao' },
      { id: 'nomeDistrito', label: 'Distrito', value: d.nomeDistrito || '—', propertyKey: 'NM_DIST', category: 'localizacao' },
      { id: 'nomeSubdistrito', label: 'Subdistrito / Zona', value: d.nomeSubdistrito || '—', propertyKey: 'NM_SUBDIST', category: 'localizacao' },
      { id: 'nomeRgInt', label: 'Região Intermediária', value: d.nomeRgInt || '—', propertyKey: 'NM_RGINT', category: 'localizacao' },
      { id: 'nomeRgI', label: 'Região Imediata', value: d.nomeRgI || '—', propertyKey: 'NM_RGI', category: 'localizacao' },
      { id: 'nomeUf', label: 'Estado / UF', value: d.nomeUf || '—', propertyKey: 'NM_UF', category: 'localizacao' },
    ];

    const options: CustomCardOption[] = [];
    const valuesMap: Record<string, { label: string; value: string }> = {};

    baseItems.forEach(item => {
      if (!isAllowed(item.propertyKey)) return;
      options.push({ id: item.id, label: item.label, propertyKey: item.propertyKey, category: item.category });
      valuesMap[item.id] = { label: item.label, value: item.value };
    });

    // Incluir atributos da feição que não estejam nos itens base
    Object.keys(props).forEach(k => {
      if (k.startsWith('_') || ['id', 'geometry', 'layer', 'name', 'sourceName', 'lat', 'lng', 'latitude', 'longitude'].includes(k.toLowerCase())) return;
      if (!isAllowed(k)) return;
      const attrId = `attr_${k}`;
      if (!valuesMap[attrId]) {
        const label = propertyNames[k] || toTitleCase(k.replace(/_/g, ' '));
        const rawVal = props[k];
        const valStr = (rawVal != null && String(rawVal).trim() !== '') ? String(rawVal) : '—';
        options.push({ id: attrId, label, propertyKey: k, category: 'atributo' });
        valuesMap[attrId] = { label, value: valStr };
      }
    });

    return { options, valuesMap };
  }, [activeDetailFeature, structuredDetails, allowedProperties, isAdmin]);

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
      items.push({ key: 'NM_FCU', label: isComunidadeRural ? 'Comunidade Rural' : 'Favela / Comunidade', value: d.nomeComunidade });
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
    // Nome da UF: Ocultado estritamente na camada de Localidades conforme solicitado
    if (!isLocalidade && d.nomeUf && isAllowed('NM_UF')) {
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
        // Não exibir Nome da UF nem IDs técnicos redundantes especificamente na camada de Localidades
        if (isLocalidade && (lowK === 'nm_uf' || lowK === 'nome uf' || lowK === 'nome_uf' || lowK === 'uf')) return;
        if (isLocalidade && (lowK === 'id_localidades' || lowK === 'id localidades' || lowK === 'id localidade')) return;

        let displayVal = getTranslatedValue(k, val);
        if (typeof val === 'string') {
          displayVal = toTitleCase(displayVal);
        }
        // Se for latitude ou longitude, sempre formatar com 6 dígitos após a vírgula
        if ((lowK === 'latitude' || lowK === 'longitude' || lowK === 'lat' || lowK === 'lng' || lowK === 'lon') && val != null) {
          const num = parseFloat(String(val).replace(',', '.'));
          if (!isNaN(num)) {
            displayVal = num.toFixed(6);
          }
        }
        // Formatar CEP brasileiro
        if (lowK === 'cep' && val != null) {
          const c = String(val).replace(/\D/g, '');
          if (c.length === 8) displayVal = `${c.slice(0, 5)}-${c.slice(5)}`;
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
      className="relative z-[1050] h-full flex shrink-0 select-none font-sans"
    >
      {/* ============================================================== */}
      {/* ESTÁGIO 1: BARRA / RAIL DE NAVEGAÇÃO LATERAL (APPLE SIDEBAR)   */}
      {/* ============================================================== */}
      <nav
        className={`h-full flex flex-col transition-all duration-300 ease-out bg-white/90 dark:bg-[#1c1c1e]/90 backdrop-blur-3xl border-r border-black/10 dark:border-white/10 shadow-xl overflow-hidden overflow-x-hidden select-none shrink-0 ${
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
        <div className="flex flex-col gap-2 w-full flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar">
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


          </div>

          {/* 3. Detalhes (Permanente na barra lateral) */}
          <div className="relative group w-full flex items-center">
            <button
              type="button"
              onClick={() => {
                setOpenedFromSearch(false);
                setActiveTab(activeTab === 'details' ? null : 'details');
              }}
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
                  {hasFeature && (
                    <span className="ml-auto w-2 h-2 rounded-full bg-[#FF9500] animate-ping" />
                  )}
                </>
              )}
            </button>
          </div>

          {/* 4. Exportar (Permanente na barra lateral) */}
          <div className="relative group w-full flex items-center">
            <button
              type="button"
              onClick={() => {
                setOpenedFromSearch(false);
                setActiveTab(activeTab === 'export' ? null : 'export');
              }}
              className={`w-full flex items-center gap-3 rounded-2xl font-bold transition-all cursor-pointer ${
                isCollapsed 
                  ? 'w-11 h-11 justify-center p-0 mx-auto' 
                  : 'px-3 py-2.5 text-sm'
              } ${
                activeTab === 'export'
                  ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-sm'
                  : 'text-slate-800 dark:text-slate-200 hover:bg-black/5 dark:hover:bg-white/10'
              }`}
              title={isCollapsed ? "Exportar Dados" : undefined}
            >
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
                activeTab === 'export'
                  ? (isCollapsed ? '' : 'bg-white/20 text-white dark:bg-slate-900/20 dark:text-slate-900')
                  : 'bg-black/5 dark:bg-white/10 text-slate-700 dark:text-slate-200'
              }`}>
                <Download className={isCollapsed ? "w-5 h-5" : "w-4 h-4"} />
              </div>
              {!isCollapsed && <span className="truncate">Exportar</span>}
            </button>
          </div>
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
              <a 
                href="https://www.linkedin.com/in/m%C3%A1rcio-de-melo-silva-299297382/"
                target="_blank"
                rel="noopener noreferrer"
                className="truncate hover:text-slate-600 dark:hover:text-slate-200 hover:underline transition-colors cursor-pointer"
                title="Desenvolvido por Márcio de Melo Silva (LinkedIn)"
              >
                WebGIS
              </a>
              <button 
                type="button"
                onClick={() => setActiveTab(activeTab === 'help' ? null : 'help')}
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
          className="absolute left-full top-0 bottom-0 h-full w-[360px] sm:w-[390px] max-w-[calc(100vw-72px)] flex flex-col transition-all duration-300 ease-out bg-white/95 dark:bg-[#1c1c1e]/95 backdrop-blur-3xl border-r border-black/10 dark:border-white/10 shadow-2xl overflow-hidden z-40 animate-fadeIn"
        >
          {/* Cabeçalho do Segundo Estágio (Título + Botão X redondo de fechar) */}
          <div className="h-14 px-4 border-b border-black/5 dark:border-white/10 flex items-center justify-between shrink-0">
            <h2 className="text-lg font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
              {activeTab === 'search' && (activeCategorySearchId ? (CATEGORY_UI_META[activeCategorySearchId]?.title || 'Buscar') : 'Buscar')}
              {activeTab === 'dashboard' && 'Raio-X Territorial e Domiciliar'}
              {activeTab === 'details' && 'Detalhes da Feição'}
              {activeTab === 'export' && (
                <>
                  <Download className="w-5 h-5 text-slate-700 dark:text-slate-200" />
                  <span>Exportar Feições</span>
                </>
              )}
              {activeTab === 'help' && (
                <>
                  <HelpCircle className="w-5 h-5 text-[#007AFF]" />
                  <span>Guia de Uso & Ajuda</span>
                </>
              )}
            </h2>

            <button
              type="button"
              onClick={() => {
                setOpenedFromSearch(false);
                setActiveCategorySearchId(null);
                setActiveTab(null);
              }}
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
        {activeTab === 'details' && (
          activeDetailFeature ? (
          <div className="space-y-4 animate-fadeIn">
            {/* Header do Cartão do Local */}
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                {openedFromSearch && (
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab('search');
                      setOpenedFromSearch(false);
                    }}
                    className="text-xs font-bold text-[#007AFF] hover:underline flex items-center gap-1 mb-1 cursor-pointer"
                  >
                    <span>&larr; Voltar para busca</span>
                  </button>
                )}
                <h2 className="text-xl font-black text-slate-900 dark:text-white truncate tracking-tight">
                  {isCoordenadaSearch ? (activeDetailFeature.name || 'Coordenada Pesquisada') : (structuredDetails?.nomeOficial || activeDetailFeature.name || 'Local Selecionado')}
                </h2>
                {!activeDetailFeature.id?.startsWith('plot-') && (
                  <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 truncate">
                    {isCoordenadaSearch ? (
                      activeDetailFeature.sourceName && activeDetailFeature.sourceName !== 'Coordenadas'
                        ? `${activeDetailFeature.sourceName} • Piauí`
                        : 'Ponto de Pesquisa no Mapa • Piauí'
                    ) : (
                      `${activeDetailFeature.sourceName} • ${
                        (activeDetailFeature.sourceName?.toLowerCase().includes('municipio') ||
                         (structuredDetails?.nomeMunicipio && (structuredDetails.nomeOficial || activeDetailFeature.name) &&
                          structuredDetails.nomeMunicipio.toLowerCase().trim() === (structuredDetails.nomeOficial || activeDetailFeature.name).toLowerCase().trim()))
                          ? (structuredDetails?.nomeUf || 'Piauí')
                          : (structuredDetails?.nomeMunicipio ? `${structuredDetails.nomeMunicipio}, PI` : (structuredDetails?.nomeUf || 'Piauí'))
                      }`
                    )}
                  </p>
                )}
              </div>

              <button
                type="button"
                onClick={() => {
                  setOpenedFromSearch(false);
                  onRemoveFromSelection(activeDetailFeature.id);
                  setActiveTab(null);
                }}
                className="w-8 h-8 rounded-full bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/15 flex items-center justify-center text-slate-500 dark:text-slate-400 cursor-pointer"
                title="Fechar detalhes"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Linha de Botões de Ação Apple */}
            {isLocalidade ? (
              /* Ações exclusivas para Localidades: sem Raio-X e sem CNEFE Polígono, com Busca Direta no CNEFE */
              <div className="space-y-2 pt-1">
                {/* Botão Principal: Busca Direta de Endereços por Localidade no CNEFE */}
                <button
                  type="button"
                  onClick={() => {
                    const loc = localidadeMetadata?.nome || structuredDetails?.nomeLocalidade || activeDetailFeature.name || '';
                    const mun = localidadeMetadata?.municipio || structuredDetails?.nomeMunicipio || '';
                    if (onSearchLocalidadeAddresses) {
                      onSearchLocalidadeAddresses(loc, mun);
                    }
                  }}
                  className="w-full py-3 px-3.5 bg-gradient-to-r from-[#FF9500] to-[#FF5E3A] hover:brightness-105 active:scale-[0.98] text-white rounded-2xl flex items-center justify-center gap-2.5 shadow-lg shadow-orange-500/25 transition-all cursor-pointer font-bold text-xs sm:text-sm"
                  title={`Buscar endereços cadastrados no CNEFE para a localidade "${localidadeMetadata?.nome || activeDetailFeature.name}" no município de ${localidadeMetadata?.municipio || structuredDetails?.nomeMunicipio || 'Piauí'}`}
                >
                  <Home className="w-4 h-4 shrink-0" />
                  <span className="truncate">Buscar Endereços desta Localidade</span>
                </button>

                <div className="grid grid-cols-2 gap-2">
                  {/* Botão Focar */}
                  <button
                    type="button"
                    onClick={() => onZoomToFeature(activeDetailFeature)}
                    className="py-2.5 px-2 bg-[#007AFF] hover:bg-[#0066d6] active:scale-95 text-white rounded-2xl flex items-center justify-center gap-1.5 text-xs font-bold shadow-md shadow-blue-500/25 transition-all cursor-pointer"
                  >
                    <Navigation className="w-4 h-4 fill-white text-white" />
                    <span>Focar no Ponto</span>
                  </button>

                  {/* Botão Exportar */}
                  <button
                    type="button"
                    onClick={() => setActiveTab('export')}
                    className="py-2.5 px-2 bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/15 active:scale-95 text-slate-800 dark:text-slate-200 rounded-2xl flex items-center justify-center gap-1.5 text-xs font-bold transition-all cursor-pointer"
                  >
                    <Download className="w-4 h-4 text-slate-700 dark:text-slate-200" />
                    <span>Exportar</span>
                  </button>
                </div>
              </div>
            ) : isCoordenadaSearch ? (
              /* Para Coordenadas pesquisadas: não exibir as ferramentas do topo (focar, raio x, exportar, cnefe), pois já existem na primeira barra lateral */
              null
            ) : (
              /* Ações padrão para camadas poligonais / territoriais: 3 colunas (Focar, Buscar endereços, Exportar) */
              <div className="grid grid-cols-3 gap-2 pt-1">
                {/* Botão Trajetos / Focar (Azul Apple #007AFF) */}
                <button
                  type="button"
                  onClick={() => onZoomToFeature(activeDetailFeature)}
                  className="py-2.5 px-2 bg-[#007AFF] hover:bg-[#0066d6] active:scale-95 text-white rounded-2xl flex flex-col items-center justify-center gap-1 text-[11px] font-bold shadow-sm transition-all cursor-pointer"
                >
                  <Navigation className="w-5 h-5 fill-white text-white" />
                  <span>Focar</span>
                </button>

                {/* Botão Buscar Endereços no Polígono */}
                <button
                  type="button"
                  onClick={() => {
                    onSearchPolygonAddresses(activeDetailFeature);
                    onOpenCnefeBottomBar?.();
                  }}
                  className="py-2.5 px-1 bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/15 active:scale-95 text-slate-800 dark:text-slate-200 rounded-2xl flex flex-col items-center justify-center gap-1 text-[10.5px] font-bold transition-all cursor-pointer text-center"
                  title={isComunidadeRural ? "Abrir Busca de Endereços desta área na barra inferior" : "Abrir Busca de Endereços Avançado desta área na barra inferior"}
                >
                  <Home className="w-5 h-5 text-slate-700 dark:text-slate-300" />
                  <span className="leading-tight px-0.5">Buscar endereços</span>
                </button>

                {/* Botão Exportar */}
                <button
                  type="button"
                  onClick={() => setActiveTab('export')}
                  className="py-2.5 px-2 bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/15 active:scale-95 text-slate-800 dark:text-slate-200 rounded-2xl flex flex-col items-center justify-center gap-1 text-[11px] font-bold transition-all cursor-pointer"
                >
                  <Download className="w-5 h-5 text-slate-700 dark:text-slate-300" />
                  <span>Exportar</span>
                </button>
              </div>
            )}

            {/* Informações Específicas / Dados da Feição */}
            {isLocalidade ? (
              /* Card Exclusivo de Dados Úteis da Localidade */
              <div className="bg-black/5 dark:bg-white/5 rounded-2xl p-3.5 space-y-2.5">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Dados da Localidade
                  </h3>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#FF3B30]/10 text-[#FF3B30] dark:bg-[#FF3B30]/20 dark:text-[#FF453A] border border-[#FF3B30]/20">
                    Ponto Geográfico
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="p-2.5 bg-white dark:bg-[#2c2c2e] rounded-xl shadow-xs border border-black/5 dark:border-white/5">
                    <span className="text-[10px] text-slate-400 dark:text-slate-500 font-bold block">Município</span>
                    <span className="text-xs font-black text-slate-800 dark:text-slate-100 truncate block" title={localidadeMetadata?.municipio || structuredDetails?.nomeMunicipio || 'Piauí'}>
                      {localidadeMetadata?.municipio || structuredDetails?.nomeMunicipio || 'Piauí'}
                    </span>
                  </div>

                  <div className="p-2.5 bg-white dark:bg-[#2c2c2e] rounded-xl shadow-xs border border-black/5 dark:border-white/5">
                    <span className="text-[10px] text-slate-400 dark:text-slate-500 font-bold block">CEP</span>
                    <span className="text-xs font-black text-slate-800 dark:text-slate-100">
                      {localidadeMetadata?.cep || '—'}
                    </span>
                  </div>

                  {localidadeMetadata?.aglomerado && (
                    <div className="p-2.5 bg-white dark:bg-[#2c2c2e] rounded-xl shadow-xs border border-black/5 dark:border-white/5 col-span-2">
                      <span className="text-[10px] text-slate-400 dark:text-slate-500 font-bold block">Aglomerado</span>
                      <span className="text-xs font-black text-slate-800 dark:text-slate-100 truncate block" title={localidadeMetadata.aglomerado}>
                        {localidadeMetadata.aglomerado}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            ) : isCoordenadaSearch ? (
              /* Card Exclusivo de Feições Encontradas no Ponto da Coordenada / Endereço Plotado */
              <div className="bg-black/5 dark:bg-white/5 rounded-2xl p-3.5 space-y-2.5">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    {activeDetailFeature.id?.startsWith('plot-') ? 'Dados do Endereço' : 'Feições no Local'}
                  </h3>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#007AFF]/10 text-[#007AFF] dark:bg-[#007AFF]/20 border border-[#007AFF]/20">
                    {activeDetailFeature.id?.startsWith('plot-')
                      ? (activeDetailFeature.properties?.origem === 'tipo-saude'
                          ? 'CNEFE Saúde'
                          : activeDetailFeature.properties?.origem === 'tipo-farmacias'
                          ? 'CNEFE Farmácia • por nome'
                          : activeDetailFeature.properties?.origem === 'tipo-restaurantes'
                          ? 'CNEFE Restaurante • por nome'
                          : activeDetailFeature.properties?.origem === 'tipo-postos'
                          ? 'CNEFE Posto • por nome'
                          : activeDetailFeature.properties?.origem === 'tipo-hoteis'
                          ? 'CNEFE Hotelaria • por nome'
                          : (activeDetailFeature.properties?.especie || activeDetailFeature.properties?.ESPECIE
                              ? toTitleCase(String(activeDetailFeature.properties?.especie || activeDetailFeature.properties?.ESPECIE))
                              : 'CNEFE • IBGE'))
                      : 'Ponto Pesquisado'}
                  </span>
                </div>

                {activeDetailFeature.properties?.origem?.startsWith('tipo-') && activeDetailFeature.properties?.origem !== 'tipo-saude' && (
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 italic bg-amber-500/10 dark:bg-amber-400/10 p-2 rounded-xl border border-amber-500/20">
                    * Exibe locais com nome registrado no CNEFE. Estabelecimentos sem identificação na fachada podem não constar.
                  </p>
                )}

                {coordDetailsList.length > 0 ? (
                  <div className="space-y-1.5">
                    {coordDetailsList.map((item, idx) => {
                      const colonIdx = item.indexOf(':');
                      const label = colonIdx !== -1 ? item.slice(0, colonIdx).trim() : 'Informação';
                      const val = colonIdx !== -1 ? item.slice(colonIdx + 1).trim() : item;
                      return (
                        <div key={idx} className="p-2.5 bg-white dark:bg-[#2c2c2e] rounded-xl shadow-xs border border-black/5 dark:border-white/5 flex items-center justify-between gap-2">
                          <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 truncate shrink-0">
                            {label}
                          </span>
                          <div className="flex items-center gap-1.5 min-w-0 justify-end">
                            <span className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate text-right">
                              {val}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleCopy(val, label)}
                              className="p-1 hover:bg-black/10 dark:hover:bg-white/10 rounded cursor-pointer text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors shrink-0"
                              title={`Copiar ${label}`}
                            >
                              <Copy className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 dark:text-slate-500 py-1 text-center">
                    Nenhuma camada sobreposta nesta coordenada.
                  </p>
                )}
              </div>
            ) : !isComunidadeRural ? (
              /* Informações Úteis Demográficas para Feições Poligonais (Personalizáveis) */
              <div className="bg-black/5 dark:bg-white/5 rounded-2xl p-3.5 space-y-2.5">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Informações Úteis
                  </h3>
                  <button
                    type="button"
                    onClick={() => setIsCustomizerModalOpen(true)}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-black/5 dark:hover:bg-white/10 transition-colors cursor-pointer"
                    title="Personalizar quais informações aparecem nos cartões"
                  >
                    <SlidersHorizontal className="w-3 h-3" />
                    <span>Personalizar</span>
                  </button>
                </div>
                
                <div className="grid grid-cols-2 gap-2">
                  {usefulCardIds.slice(0, 8).map(id => {
                    const cardItem = usefulCardsCatalog.valuesMap[id];
                    if (!cardItem) return null;
                    return (
                      <div key={id} className="p-2.5 bg-white dark:bg-[#2c2c2e] rounded-xl shadow-xs border border-black/5 dark:border-white/5">
                        <span className="text-[10px] text-slate-400 dark:text-slate-500 font-bold block truncate" title={cardItem.label}>
                          {cardItem.label}
                        </span>
                        <span className="text-sm font-black text-slate-800 dark:text-slate-100 truncate block mt-0.5" title={cardItem.value}>
                          {cardItem.value}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : null}

            {/* Seção de Coordenadas Geográficas com 6 dígitos decimais exatos */}
            {featureCoords && (
              <div className="bg-black/5 dark:bg-white/5 rounded-2xl p-3.5 space-y-2.5">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                    <Compass className="w-3.5 h-3.5 text-[#007AFF]" />
                    <span>Coordenadas Geográficas</span>
                  </h3>
                  <button
                    type="button"
                    onClick={() => handleCopy(`${featureCoords.lat.toFixed(6)}, ${featureCoords.lng.toFixed(6)}`, 'Coordenadas completas')}
                    className="text-[11px] font-bold text-[#007AFF] hover:underline flex items-center gap-1 cursor-pointer"
                    title="Copiar par de coordenadas com 6 dígitos"
                  >
                    <Copy className="w-3 h-3" />
                    <span>Copiar Par</span>
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  {/* Latitude (6 dígitos) */}
                  <div className="p-2.5 bg-white dark:bg-[#2c2c2e] rounded-xl shadow-xs flex items-center justify-between border border-black/5 dark:border-white/5">
                    <div className="min-w-0 flex-1">
                      <span className="text-[10px] text-slate-400 dark:text-slate-500 font-bold block">Latitude</span>
                      <span className="text-xs font-mono font-bold text-slate-800 dark:text-slate-100 block truncate">
                        {featureCoords.lat.toFixed(6)}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleCopy(featureCoords.lat.toFixed(6), 'Latitude')}
                      className="p-1 hover:bg-black/10 dark:hover:bg-white/10 rounded cursor-pointer text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors shrink-0"
                      title="Copiar Latitude"
                    >
                      <Copy className="w-3 h-3" />
                    </button>
                  </div>

                  {/* Longitude (6 dígitos) */}
                  <div className="p-2.5 bg-white dark:bg-[#2c2c2e] rounded-xl shadow-xs flex items-center justify-between border border-black/5 dark:border-white/5">
                    <div className="min-w-0 flex-1">
                      <span className="text-[10px] text-slate-400 dark:text-slate-500 font-bold block">Longitude</span>
                      <span className="text-xs font-mono font-bold text-slate-800 dark:text-slate-100 block truncate">
                        {featureCoords.lng.toFixed(6)}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleCopy(featureCoords.lng.toFixed(6), 'Longitude')}
                      className="p-1 hover:bg-black/10 dark:hover:bg-white/10 rounded cursor-pointer text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors shrink-0"
                      title="Copiar Longitude"
                    >
                      <Copy className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Detalhes e Atributos da Feição (ocultado para Localidades, pois repete os dados já exibidos acima) */}
            {!isLocalidade && !isCoordenadaSearch && (
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
            )}
          </div>
          ) : (
            <div className="space-y-4 py-8 text-center animate-fadeIn px-2">
              <div className="w-14 h-14 rounded-3xl bg-amber-500/10 text-[#FF9500] flex items-center justify-center mx-auto mb-3 shadow-inner">
                <MapPin className="w-7 h-7" />
              </div>
              <h3 className="text-base font-black text-slate-900 dark:text-white">
                Nenhuma feição selecionada
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-[280px] mx-auto leading-relaxed font-medium">
                Clique em qualquer elemento no mapa (bairros, municípios, setores, favelas ou localidades) para inspecionar seus atributos, limites e dados territoriais.
              </p>
              <div className="p-3.5 bg-black/[0.02] dark:bg-white/[0.04] border border-black/5 dark:border-white/10 rounded-2xl text-left space-y-1.5 mt-4">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500">
                  Dica de Navegação
                </span>
                <p className="text-[11px] text-slate-600 dark:text-slate-300 font-medium leading-snug">
                  Você também pode usar a ferramenta <strong>Buscar</strong> para localizar um endereço, bairro ou município específico e focar diretamente no local.
                </p>
              </div>
            </div>
          )
        )}

        {/* ============================================================== */}
        {/* ABA: BUSCAR (Screenshot 4 do Apple Maps) */}
        {/* ============================================================== */}
        {activeTab === 'search' && (
          activeCategorySearchId ? (
            <HospitalSidebarPanel
              category={activeCategorySearchId}
              onBack={() => setActiveCategorySearchId(null)}
              onSearchByMunicipio={(mun) => {
                if (activeCategorySearchId === 'hospitais') {
                  onSearchHospitaisByMunicipio?.(mun);
                } else {
                  onSearchCategoryByMunicipio?.(activeCategorySearchId, mun);
                }
              }}
              onSearchByRadius={activeCategorySearchId === 'hospitais' ? ((raio) => onSearchHospitaisByRadius?.(raio)) : undefined}
              availableMunicipios={cnefeMunicipios}
              isLoading={isHospitalSearching}
            />
          ) : (
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
                          setActiveCategorySearchId(cat.id as CategorySearchType);
                        }}
                        className="w-full px-3.5 py-2.5 rounded-2xl bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 active:scale-[0.98] transition-all cursor-pointer flex items-center justify-between text-left border border-black/5 dark:border-white/5 group"
                      >
                        <div className="flex items-center gap-3.5 min-w-0">
                          <div className={`w-8 h-8 rounded-full ${cat.color} text-white flex items-center justify-center shrink-0 shadow-sm`}>
                            <Icon className="w-4 h-4" />
                          </div>
                          <span className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">
                            {cat.name}
                          </span>
                        </div>
                        {cat.id === 'hospitais' ? (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20 shrink-0">
                            CNEFE Saúde
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-500/10 text-slate-600 dark:text-slate-400 border border-slate-500/20 shrink-0">
                            Por nome
                          </span>
                        )}
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
                                  lastSearchClickTimeRef.current = Date.now();
                                  setOpenedFromSearch(true);
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
          )
        )}

        {/* ============================================================== */}
        {/* ABA: EXPORTAR FEIÇÕES (DOCKADO DIRETAMENTE NA BARRA LATERAL)    */}
        {/* ============================================================== */}
        {activeTab === 'export' && (
          <ExportDashboard
            selectedFeatures={selectedFeatures}
            showToast={showToast}
            onBackToDetails={hasFeature ? () => setActiveTab('details') : undefined}
          />
        )}

        {/* ============================================================== */}
        {/* ABA: RAIO-X TERRITORIAL E DOMICILIAR */}
        {/* ============================================================== */}
        {activeTab === 'dashboard' && (
          <div className="animate-fadeIn">
            <Dashboard selectedFeatures={selectedFeatures} />
          </div>
        )}

        {/* ============================================================== */}
        {/* ABA: GUIA DE USO E AJUDA (DOCKADO DIRETAMENTE NA BARRA LATERAL) */}
        {/* ============================================================== */}
        {activeTab === 'help' && (
          <div className="animate-fadeIn space-y-3.5 pb-6">
            {/* Header / Apresentação do Guia */}
            <div className="p-4 rounded-3xl bg-gradient-to-br from-[#007AFF]/10 via-[#5856D6]/5 to-transparent border border-[#007AFF]/20 shadow-xs">
              <div className="flex items-center gap-2.5 mb-1.5">
                <div className="w-8 h-8 rounded-xl bg-[#007AFF] text-white flex items-center justify-center shadow-md shadow-blue-500/20 shrink-0">
                  <Sparkles className="w-4 h-4" />
                </div>
                <h3 className="font-black text-sm text-slate-900 dark:text-white">
                  Central de Ajuda WebGIS
                </h3>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed font-medium">
                Consulte as instruções rápidas de navegação, seleção de áreas, análise CNEFE e atalhos de produtividade sem sair do mapa.
              </p>
            </div>

            {/* 1. NAVEGAÇÃO E CAMADAS */}
            <div className="p-3.5 rounded-2xl bg-black/[0.02] dark:bg-white/[0.04] border border-black/5 dark:border-white/10 space-y-2 hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition-colors">
              <div className="flex items-center gap-2 text-xs font-black text-slate-900 dark:text-white">
                <div className="w-6 h-6 rounded-lg bg-[#007AFF]/15 text-[#007AFF] dark:text-[#64D2FF] flex items-center justify-center shrink-0">
                  <Layers className="w-3.5 h-3.5" />
                </div>
                <span>1. Navegação & Camadas</span>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed font-medium">
                Controle camadas oficiais (Municípios, Bairros, Setores, Favelas/Comunidades e Localidades).
              </p>
              <ul className="text-xs space-y-1.5 text-slate-600 dark:text-slate-300 font-medium pl-1">
                <li className="flex items-start gap-1.5">
                  <span className="text-[#007AFF] font-bold">•</span>
                  <span><strong>Painel de Camadas:</strong> No canto superior direito, ligue/desligue mapas e ajuste opacidade, preenchimento e bordas.</span>
                </li>
                <li className="flex items-start gap-1.5">
                  <span className="text-[#007AFF] font-bold">•</span>
                  <span><strong>Mapas de Fundo:</strong> Alterne entre <em>Apple Maps</em> (Claro/Escuro), <em>Google Satélite/Híbrido</em>, <em>OSM</em> e <em>Esri</em>.</span>
                </li>
                <li className="flex items-start gap-1.5">
                  <span className="text-[#007AFF] font-bold">•</span>
                  <span><strong>Ações Rápidas:</strong> Use <em>"Ligar Tudo"</em> ou <em>"Desligar Tudo"</em> no topo do mapa para controle instantâneo.</span>
                </li>
              </ul>
            </div>

            {/* 2. SELEÇÃO DE ÁREAS E RAIO-X */}
            <div className="p-3.5 rounded-2xl bg-black/[0.02] dark:bg-white/[0.04] border border-black/5 dark:border-white/10 space-y-2 hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition-colors">
              <div className="flex items-center gap-2 text-xs font-black text-slate-900 dark:text-white">
                <div className="w-6 h-6 rounded-lg bg-[#34C759]/15 text-[#34C759] flex items-center justify-center shrink-0">
                  <Users className="w-3.5 h-3.5" />
                </div>
                <span>2. Seleção de Áreas & Raio-X Territorial</span>
              </div>
              <ul className="text-xs space-y-1.5 text-slate-600 dark:text-slate-300 font-medium pl-1">
                <li className="flex items-start gap-1.5">
                  <span className="text-[#34C759] font-bold">•</span>
                  <span><strong>Clique Simples:</strong> Clique em qualquer região do mapa para gerar o <em>Raio-X Territorial</em> com População, Domicílios e Taxa de Vacância.</span>
                </li>
                <li className="flex items-start gap-1.5">
                  <span className="text-[#34C759] font-bold">•</span>
                  <span><strong>Multiseleção:</strong> Ative o botão <em>"Multiseleção: ON"</em> acima do mapa (ou segure <kbd className="px-1.5 py-0.5 rounded bg-black/5 dark:bg-white/10 border border-black/10 dark:border-white/10 font-mono text-[10px]">Ctrl</kbd>) para somar estatísticas de múltiplos bairros ou setores ao mesmo tempo.</span>
                </li>
              </ul>
            </div>

            {/* 3. BUSCA DE ENDEREÇOS E CNEFE IBGE */}
            <div className="p-3.5 rounded-2xl bg-black/[0.02] dark:bg-white/[0.04] border border-black/5 dark:border-white/10 space-y-2 hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition-colors">
              <div className="flex items-center gap-2 text-xs font-black text-slate-900 dark:text-white">
                <div className="w-6 h-6 rounded-lg bg-[#AF52DE]/15 text-[#AF52DE] flex items-center justify-center shrink-0">
                  <Search className="w-3.5 h-3.5" />
                </div>
                <span>3. Busca Avançada de Endereços (CNEFE)</span>
              </div>
              <ul className="text-xs space-y-1.5 text-slate-600 dark:text-slate-300 font-medium pl-1">
                <li className="flex items-start gap-1.5">
                  <span className="text-[#AF52DE] font-bold">•</span>
                  <span><strong>Milhões de Endereços:</strong> Consulta ultra-rápida no banco DuckDB em todos os municípios do Piauí.</span>
                </li>
                <li className="flex items-start gap-1.5">
                  <span className="text-[#AF52DE] font-bold">•</span>
                  <span><strong>Sem Problema de Acentos:</strong> Pesquisas com ou sem acentos (ex: <em>"São Benedito"</em> ou <em>"sao benedito"</em>) encontram tudo com 100% de precisão.</span>
                </li>
                <li className="flex items-start gap-1.5">
                  <span className="text-[#AF52DE] font-bold">•</span>
                  <span><strong>Lupinha por Coluna:</strong> Clique no ícone de lupa no cabeçalho de qualquer coluna para pesquisar nela diretamente.</span>
                </li>
                <li className="flex items-start gap-1.5">
                  <span className="text-[#AF52DE] font-bold">•</span>
                  <span><strong>Ordenação Inteligente:</strong> Ao ordenar por Endereço, ruas de mesmo nome são agrupadas juntas em ordem numérica contínua.</span>
                </li>
              </ul>
            </div>

            {/* 4. MEDIÇÃO, COORDENADAS E BOTÃO DIREITO */}
            <div className="p-3.5 rounded-2xl bg-black/[0.02] dark:bg-white/[0.04] border border-black/5 dark:border-white/10 space-y-2 hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition-colors">
              <div className="flex items-center gap-2 text-xs font-black text-slate-900 dark:text-white">
                <div className="w-6 h-6 rounded-lg bg-[#FF9500]/15 text-[#FF9500] flex items-center justify-center shrink-0">
                  <Compass className="w-3.5 h-3.5" />
                </div>
                <span>4. Coordenadas, Medição & Botão Direito</span>
              </div>
              <ul className="text-xs space-y-1.5 text-slate-600 dark:text-slate-300 font-medium pl-1">
                <li className="flex items-start gap-1.5">
                  <span className="text-[#FF9500] font-bold">•</span>
                  <span><strong>Busca por Coordenadas:</strong> Digite <code>-5.089, -42.801</code> na barra de busca para localizar e marcar qualquer coordenada.</span>
                </li>
                <li className="flex items-start gap-1.5">
                  <span className="text-[#FF9500] font-bold">•</span>
                  <span><strong>Botão Direito no Mapa:</strong> Clique com o botão direito para copiar coordenadas precisas, identificar o local ou abrir diretamente no <em>Google Street View</em>.</span>
                </li>
                <li className="flex items-start gap-1.5">
                  <span className="text-[#FF9500] font-bold">•</span>
                  <span><strong>Régua de Medição:</strong> Meça distâncias e áreas com cálculo geodésico no mapa.</span>
                </li>
              </ul>
            </div>

            {/* 5. EXPORTAÇÃO DE DADOS */}
            <div className="p-3.5 rounded-2xl bg-black/[0.02] dark:bg-white/[0.04] border border-black/5 dark:border-white/10 space-y-2 hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition-colors">
              <div className="flex items-center gap-2 text-xs font-black text-slate-900 dark:text-white">
                <div className="w-6 h-6 rounded-lg bg-[#30B0C7]/15 text-[#30B0C7] flex items-center justify-center shrink-0">
                  <Download className="w-3.5 h-3.5" />
                </div>
                <span>5. Exportação (Excel, CSV e KML)</span>
              </div>
              <ul className="text-xs space-y-1.5 text-slate-600 dark:text-slate-300 font-medium pl-1">
                <li className="flex items-start gap-1.5">
                  <span className="text-[#30B0C7] font-bold">•</span>
                  <span><strong>Planilha CSV (Excel):</strong> Baixe tabelas com todos os indicadores das regiões selecionadas ou dos endereços consultados.</span>
                </li>
                <li className="flex items-start gap-1.5">
                  <span className="text-[#30B0C7] font-bold">•</span>
                  <span><strong>KML (Google Earth / QGIS):</strong> Exporte as geometrias dos polígonos selecionados para uso em softwares GIS profissionais.</span>
                </li>
              </ul>
            </div>

            {/* 6. ATALHOS DE TECLADO */}
            <div className="p-3.5 rounded-2xl bg-black/[0.02] dark:bg-white/[0.04] border border-black/5 dark:border-white/10 space-y-2.5">
              <div className="flex items-center gap-2 text-xs font-black text-slate-900 dark:text-white">
                <div className="w-6 h-6 rounded-lg bg-slate-500/15 text-slate-700 dark:text-slate-300 flex items-center justify-center shrink-0">
                  <Sparkles className="w-3.5 h-3.5" />
                </div>
                <span>6. Atalhos Rápidos de Produtividade</span>
              </div>
              <div className="grid grid-cols-1 gap-2 text-xs">
                <div className="flex items-center justify-between p-2 rounded-xl bg-white/70 dark:bg-slate-800/70 border border-black/5 dark:border-white/10">
                  <span className="font-semibold text-slate-700 dark:text-slate-300">Focar no campo de busca</span>
                  <div className="flex items-center gap-1">
                    <kbd className="px-2 py-0.5 rounded-md bg-black/5 dark:bg-white/10 font-mono text-[10px] font-bold border border-black/10 dark:border-white/10">Ctrl + F</kbd>
                    <span className="text-[10px] text-slate-400">ou</span>
                    <kbd className="px-2 py-0.5 rounded-md bg-black/5 dark:bg-white/10 font-mono text-[10px] font-bold border border-black/10 dark:border-white/10">/</kbd>
                  </div>
                </div>

                <div className="flex items-center justify-between p-2 rounded-xl bg-white/70 dark:bg-slate-800/70 border border-black/5 dark:border-white/10">
                  <span className="font-semibold text-slate-700 dark:text-slate-300">Limpar seleções / Fechar painéis</span>
                  <kbd className="px-2 py-0.5 rounded-md bg-black/5 dark:bg-white/10 font-mono text-[10px] font-bold border border-black/10 dark:border-white/10">Esc</kbd>
                </div>

                <div className="flex items-center justify-between p-2 rounded-xl bg-white/70 dark:bg-slate-800/70 border border-black/5 dark:border-white/10">
                  <span className="font-semibold text-slate-700 dark:text-slate-300">Ativar / Desativar Régua de Medição</span>
                  <kbd className="px-2 py-0.5 rounded-md bg-black/5 dark:bg-white/10 font-mono text-[10px] font-bold border border-black/10 dark:border-white/10">M</kbd>
                </div>
              </div>
            </div>

            {/* Botão de Fechar Ajuda */}
            <div className="pt-2">
              <button
                type="button"
                onClick={() => setActiveTab(null)}
                className="w-full py-2.5 px-4 rounded-2xl bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/15 text-slate-700 dark:text-slate-200 font-bold text-xs transition-colors cursor-pointer text-center"
              >
                Fechar Guia de Ajuda
              </button>
            </div>
          </div>
        )}
          </div>
        </div>
      )}

      {/* Modal de Personalização de Informações Úteis */}
      <FeatureInfoCustomizerModal
        isOpen={isCustomizerModalOpen}
        onClose={() => setIsCustomizerModalOpen(false)}
        availableOptions={usefulCardsCatalog.options}
        selectedIds={usefulCardIds}
        onSave={handleSaveUsefulCards}
        onReset={handleResetUsefulCards}
        maxItems={8}
      />
    </aside>
  );
};
