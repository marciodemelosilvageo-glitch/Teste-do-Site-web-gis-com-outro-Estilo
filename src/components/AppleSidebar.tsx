import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
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
  Hospital,
  Loader2,
  AlertTriangle,
  LifeBuoy,
  Phone,
  Mail,
  MessageCircle,
  Settings
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { SelectedFeature, GroupedSearchResults, SearchResultItem } from '../types';
import { dataSources, propertyNames, situationMap, typeMap } from '../data';
import { getIdentifier, getTranslatedValue, getFeatureCenter, toTitleCase, isCodeOrSystemProperty, isEligiblePolygonFeature, getGeometryKind } from '../utils';
import { Dashboard } from './Dashboard';
import { CopyableText } from './CopyableText';
import { ExportDashboard } from './ExportDashboard';
import { useExportPreferences, exportSelectedFeatures, ExportFormat } from '../exportActions';
import { HospitalSidebarPanel, CategorySearchType, CATEGORY_UI_META } from './HospitalSidebarPanel';
import { ExternalPolygonSearchResult } from './IbgeSearchPanel';
import { FeatureInfoCustomizerModal, CustomCardOption } from './FeatureInfoCustomizerModal';
import { MobileFeatureInfoCustomizer } from './mobile/MobileFeatureInfoCustomizer';
import { RecentSearchItem, getCategoryConfig } from '../categories';
import { CategorySearchMenu } from './CategorySearchMenu';
import { AppLogo } from './AppLogo';
import { MobileSheet } from './mobile/MobileSheet';
import { HelpTabContent } from './tabs/HelpTabContent';
import { useFeatureAccess } from '../context/FeatureAccessContext';
import { logActivity, UserRole } from '../services/adminService';

export type SidebarTab = 'search' | 'details' | 'dashboard' | 'help' | 'export' | 'profile' | null;

interface AppleSidebarProps {
  isMobile?: boolean;
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
  recentSearches: RecentSearchItem[];
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
  onSearchCategoryInFeatures?: (categoryId: string, features: SelectedFeature[] | SelectedFeature) => void;
  onSearchLocalidadeAddresses?: (localidade: string, municipio: string) => void;
  onSearchHospitais?: () => void;
  onSearchHospitaisByMunicipio?: (municipio: string) => void;
  onSearchCategoryByMunicipio?: (categoryId: string, municipio: string) => void;
  onSearchHospitaisByRadius?: (raioMetros: number) => void;
  onSearchCategoryByRadius?: (categoryId: string, raioMetros: number) => void;
  cnefeMunicipios?: string[];
  onEnsureMunicipiosLoaded?: () => void;
  isHospitalSearching?: boolean;
  isAddressSearching?: boolean;
  
  // Camadas
  activeLayers: string[];
  setActiveLayers: (layers: any) => void;
  allowedLayerNames: string[];
  
  // Usuário e Sistema
  currentActiveUser: any;
  userRole: UserRole;
  isMaster: boolean;
  isManager: boolean;
  isAdmin: boolean;
  isDarkMode: boolean;
  onToggleDarkMode: (event?: React.MouseEvent) => void;
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

const normalizeLayerName = (name?: string): string => {
  return (name || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
};

const LAYER_DEFAULT_CARD_IDS: Record<string, string[]> = {
  'municipios': ['aisp', 'risp', 'areaDesenvolvimento', 'popTotal'],
  'bairros': ['aisp', 'risp', 'areaDesenvolvimento', 'nomeMunicipio'],
  'favelas e comunidades': ['aisp', 'risp', 'areaDesenvolvimento', 'nomeMunicipio'],
  'nucleos urbanos': ['aisp', 'risp', 'areaDesenvolvimento', 'nomeMunicipio'],
  'aglomerados rurais': ['aisp', 'risp', 'areaDesenvolvimento', 'nomeMunicipio'],
  'comunidades rurais de teresina': ['zona', 'tipoDescritivo'],
};

const AppleSidebarInner: React.FC<AppleSidebarProps> = ({
  isMobile = false,
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
  onSearchCategoryInFeatures,
  onSearchLocalidadeAddresses,
  onSearchHospitais,
  onSearchHospitaisByMunicipio,
  onSearchCategoryByMunicipio,
  onSearchHospitaisByRadius,
  onSearchCategoryByRadius,
  cnefeMunicipios,
  onEnsureMunicipiosLoaded,
  isHospitalSearching,
  isAddressSearching = false,
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
  const { can, canExport, guardAction } = useFeatureAccess();
  const isSearchingAddresses = isAddressSearching || !!isHospitalSearching;
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Controlar se a feição exibida em detalhes foi aberta a partir de um clique no resultado da busca lateral
  const [openedFromSearch, setOpenedFromSearch] = useState<boolean>(false);
  const [activeCategorySearchId, setActiveCategorySearchId] = useState<CategorySearchType | null>(null);
  const lastSearchClickTimeRef = useRef<number>(0);


  // Estado e temporizador para suavização da animação da barra lateral Apple (reduz blur temporariamente)
  const [isAnimating, setIsAnimating] = useState<boolean>(false);
  const animTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setIsAnimating(true);
    if (animTimeoutRef.current) clearTimeout(animTimeoutRef.current);
    animTimeoutRef.current = setTimeout(() => {
      setIsAnimating(false);
    }, 320);
    return () => {
      if (animTimeoutRef.current) clearTimeout(animTimeoutRef.current);
    };
  }, [isCollapsed]);

  // Carregar lista de municípios sob demanda apenas ao abrir busca por categoria
  useEffect(() => {
    if (activeCategorySearchId) {
      onEnsureMunicipiosLoaded?.();
    }
  }, [activeCategorySearchId, onEnsureMunicipiosLoaded]);

  // Feição ativa detalhada (última selecionada)
  const activeDetailFeature = useMemo(() => {
    if (selectedFeatures.length === 0) return null;
    return selectedFeatures[selectedFeatures.length - 1];
  }, [selectedFeatures]);

  const activeLayerName = activeDetailFeature?.sourceName || '';
  const normalizedLayer = useMemo(() => normalizeLayerName(activeLayerName), [activeLayerName]);
  const userKey = useMemo(() => currentActiveUser?.username || 'default', [currentActiveUser?.username]);

  // Preferências de exportação e download rápido do usuário
  const { preferences: exportPrefs, updatePreferences: updateExportPrefs } = useExportPreferences(userKey);
  const [exportButtonState, setExportButtonState] = useState<'idle' | 'preparing' | 'success' | 'error'>('idle');
  const isExportingRef = useRef<boolean>(false);
  const [showFormatPrompt, setShowFormatPrompt] = useState<boolean>(false);
  const [exportLiveStatus, setExportLiveStatus] = useState<string>('');
  const prefersReducedMotion = typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Fechar prompt de formato se a feição ou aba mudar
  useEffect(() => {
    setShowFormatPrompt(false);
  }, [activeDetailFeature?.id, activeTab]);

  // Fechar abas restritas caso a permissão seja revogada
  useEffect(() => {
    if (activeTab === 'details' && !can('tool:feature_specs')) {
      setActiveTab(null);
    } else if (activeTab === 'dashboard' && !can('tool:raio_x')) {
      setActiveTab(null);
    } else if (activeTab === 'export' && !can('tool:export_data')) {
      setActiveTab(null);
    }
  }, [activeTab, can, setActiveTab]);

  // Fechar prompt de formato ao pressionar Escape
  useEffect(() => {
    if (!showFormatPrompt) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setShowFormatPrompt(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showFormatPrompt]);

  // Executa o download rápido da seleção com garantia de fluidez de renderização (2 frames)
  const executeQuickDownload = useCallback(async (format: ExportFormat) => {
    if (isExportingRef.current) return;
    if (!can('allowExportData') || !canExport(format)) {
      guardAction(`data:export:${format}`, `exportar em formato ${format.toUpperCase()}`, () => {});
      return;
    }
    isExportingRef.current = true;
    setShowFormatPrompt(false);
    setExportButtonState('preparing');
    setExportLiveStatus('Preparando download...');

    // Se o formato salvo for CSV e a seleção for polígono, fallback seguro para geojson
    const geomKind = getGeometryKind(selectedFeatures);
    let targetFormat = format;
    if (targetFormat === 'csv' && geomKind === 'polygon') {
      targetFormat = 'geojson';
    }

    // Aguardar 2 frames para a interface pintar o estado "preparando" antes da serialização
    await new Promise<void>(resolve => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          resolve();
        });
      });
    });

    try {
      const res = await exportSelectedFeatures(targetFormat, selectedFeatures, userRole);
      if (!res.ok) {
        setExportButtonState('error');
        setExportLiveStatus(res.error || 'Erro ao exportar feições');
        setTimeout(() => {
          setExportButtonState('idle');
          isExportingRef.current = false;
        }, 1800);
        return;
      }

      setExportButtonState('success');
      setExportLiveStatus('Download iniciado com sucesso');
      setTimeout(() => {
        setExportButtonState('idle');
        isExportingRef.current = false;
      }, 1600);
    } catch {
      setExportButtonState('error');
      setExportLiveStatus('Erro ao gerar arquivo');
      setTimeout(() => {
        setExportButtonState('idle');
        isExportingRef.current = false;
      }, 1800);
    }
  }, [selectedFeatures, userRole, can, canExport, guardAction]);

  // Ação de clique no botão "Exportar" dos detalhes
  const handleExportButtonClick = useCallback(() => {
    if (isExportingRef.current) return;
    if (!can('allowExportData')) {
      guardAction('tool:export_data', 'exportar dados da feição', () => {});
      return;
    }

    // Se o download rápido estiver ativo e com formato definido, baixa na hora
    if (exportPrefs.quickDownload === true && exportPrefs.format) {
      const geomKind = getGeometryKind(selectedFeatures);
      let targetFormat = exportPrefs.format;
      if (targetFormat === 'csv' && geomKind === 'polygon') {
        targetFormat = 'geojson';
      }
      executeQuickDownload(targetFormat);
      return;
    }

    // Se o usuário optou por "Prefiro escolher sempre", abre a aba
    if (exportPrefs.quickDownload === false) {
      setActiveTab('export');
      return;
    }

    // Se a preferência ainda não estiver definida, alterna exibição da pergunta embutida
    setShowFormatPrompt(prev => !prev);
  }, [exportPrefs, executeQuickDownload, setActiveTab, selectedFeatures, can, guardAction]);

  const handleSelectDefaultFormatAndDownload = useCallback((fmt: ExportFormat) => {
    updateExportPrefs({ quickDownload: true, format: fmt });
    executeQuickDownload(fmt);
  }, [updateExportPrefs, executeQuickDownload]);

  const handleChooseAlways = useCallback(() => {
    updateExportPrefs({ quickDownload: false });
    setShowFormatPrompt(false);
    setActiveTab('export');
  }, [updateExportPrefs, setActiveTab]);

  // Helper de resolução de cartões padrão para uma camada
  const getLayerDefaultIds = useCallback((normLayer: string) => {
    return (normLayer && LAYER_DEFAULT_CARD_IDS[normLayer]) || DEFAULT_USEFUL_CARD_IDS;
  }, []);

  // Helper de carregamento de histórico por camada (com fallback inicial para histórico legado global)
  const getLayerHistoryIds = useCallback((uKey: string, normLayer: string): string[] => {
    if (typeof window === 'undefined') return [];
    try {
      if (normLayer) {
        const rawLayer = localStorage.getItem(`useful_cards_history_${uKey}_${normLayer}`);
        if (rawLayer) {
          const parsed = JSON.parse(rawLayer);
          if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        }
      }
      // Ponto de partida inicial se não existir histórico próprio da camada (sem apagar nem modificar)
      const rawGlobal = localStorage.getItem(`useful_cards_history_${uKey}`);
      if (rawGlobal) {
        const parsed = JSON.parse(rawGlobal);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {}
    return [];
  }, []);

  // Helper para carregar a configuração efetiva (prioridade: camada salva > padrão camada > padrão geral; NUNCA herda escolha de outra camada da chave global)
  const getEffectiveCardIds = useCallback((uKey: string, normLayer: string) => {
    if (typeof window === 'undefined') {
      return (normLayer && LAYER_DEFAULT_CARD_IDS[normLayer]) || DEFAULT_USEFUL_CARD_IDS;
    }
    try {
      // 1. Escolha salva para esta camada específica
      if (normLayer) {
        const layerSaved = localStorage.getItem(`useful_cards_${uKey}_${normLayer}`);
        if (layerSaved) {
          const parsed = JSON.parse(layerSaved);
          if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        }

        // 2. Se a camada possui um padrão pré-definido, adota o padrão da camada
        if (LAYER_DEFAULT_CARD_IDS[normLayer]) {
          return LAYER_DEFAULT_CARD_IDS[normLayer];
        }

        // 3. Camada sem padrão pré-definido: usa padrão geral (NUNCA herda escolha de outra camada da chave global)
        return DEFAULT_USEFUL_CARD_IDS;
      }

      // 4. Só para feições sem nenhuma camada identificada: verificar escolha global legada antiga
      const globalSaved = localStorage.getItem(`useful_cards_${uKey}`);
      if (globalSaved) {
        const parsed = JSON.parse(globalSaved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {}

    // 5. Padrão atual genérico
    return DEFAULT_USEFUL_CARD_IDS;
  }, []);

  // Estado e persistência de Informações Úteis personalizáveis no localStorage
  const [isCustomizerModalOpen, setIsCustomizerModalOpen] = useState<boolean>(false);
  const [customizerLayer, setCustomizerLayer] = useState<{ norm: string; name: string } | null>(null);
  const [usefulCardIds, setUsefulCardIds] = useState<string[]>(() => {
    return getEffectiveCardIds(userKey, normalizedLayer);
  });

  // Histórico de cartões personalizados pelo usuário por camada (persistido em localStorage)
  const [historyIds, setHistoryIds] = useState<string[]>(() => {
    return getLayerHistoryIds(userKey, normalizedLayer);
  });

  // Atualizar histórico quando o usuário ativo ou a camada ativa mudar
  useEffect(() => {
    setHistoryIds(getLayerHistoryIds(userKey, normalizedLayer));
  }, [userKey, normalizedLayer, getLayerHistoryIds]);

  // Atualizar cartões quando mudar o usuário ou a camada da feição ativa
  useEffect(() => {
    setUsefulCardIds(getEffectiveCardIds(userKey, normalizedLayer));
  }, [userKey, normalizedLayer, getEffectiveCardIds]);

  // Se a camada ativa mudar com o modal aberto, fechar o modal (sem salvar) e avisar com toast curto
  useEffect(() => {
    if (isCustomizerModalOpen && customizerLayer) {
      if (normalizedLayer !== customizerLayer.norm) {
        setIsCustomizerModalOpen(false);
        setCustomizerLayer(null);
        showToast('Personalização cancelada: a camada selecionada foi alterada.');
      }
    }
  }, [normalizedLayer, isCustomizerModalOpen, customizerLayer, showToast]);

  // Fechar o modal de personalização se a aba de detalhes for fechada ou alterada, ou permissão revogada
  useEffect(() => {
    if ((activeTab !== 'details' || !can('tool:customize_useful_info')) && isCustomizerModalOpen) {
      setIsCustomizerModalOpen(false);
      setCustomizerLayer(null);
    }
  }, [activeTab, isCustomizerModalOpen, can]);

  const handleSaveUsefulCards = (newIds: string[]) => {
    const targetNorm = customizerLayer ? customizerLayer.norm : normalizedLayer;
    const targetName = customizerLayer ? customizerLayer.name : activeLayerName;

    // Atualizar estado em tela se a camada gravada for a camada atualmente ativa
    if (targetNorm === normalizedLayer) {
      setUsefulCardIds(newIds);
    }

    try {
      if (targetNorm) {
        localStorage.setItem(`useful_cards_${userKey}_${targetNorm}`, JSON.stringify(newIds));
      } else {
        localStorage.setItem(`useful_cards_${userKey}`, JSON.stringify(newIds));
      }
    } catch (e) {}

    // Atualizar histórico de escolhas do usuário daquela camada específica
    try {
      const historyKey = targetNorm
        ? `useful_cards_history_${userKey}_${targetNorm}`
        : `useful_cards_history_${userKey}`;

      const currentHistory = getLayerHistoryIds(userKey, targetNorm);
      const combined = [...newIds, ...currentHistory];
      const deduplicated: string[] = [];
      const seen = new Set<string>();
      for (const id of combined) {
        if (!seen.has(id)) {
          seen.add(id);
          deduplicated.push(id);
        }
        if (deduplicated.length >= 30) break;
      }
      localStorage.setItem(historyKey, JSON.stringify(deduplicated));
      if (targetNorm === normalizedLayer) {
        setHistoryIds(deduplicated);
      }
    } catch (e) {}

    logActivity('FEICAO', `Personalizou informações úteis da camada "${targetName || 'Camada'}"`, userRole);
    showToast(targetName ? `Informações úteis de ${targetName} salvas com sucesso!` : 'Informações úteis personalizadas com sucesso!');
  };

  const handleResetUsefulCards = () => {
    const targetNorm = customizerLayer ? customizerLayer.norm : normalizedLayer;
    const targetName = customizerLayer ? customizerLayer.name : activeLayerName;
    const defaultIds = getLayerDefaultIds(targetNorm);

    if (targetNorm === normalizedLayer) {
      setUsefulCardIds(defaultIds);
    }

    try {
      if (targetNorm) {
        localStorage.removeItem(`useful_cards_${userKey}_${targetNorm}`);
      } else {
        localStorage.removeItem(`useful_cards_${userKey}`);
      }
    } catch (e) {}
    logActivity('FEICAO', `Restaurou padrão de informações úteis da camada "${targetName || 'Camada'}"`, userRole);
    showToast(targetName ? `Restaurado o padrão de ${targetName}.` : 'Restaurado o padrão das informações úteis.');
  };

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
    const zona = toTitleCase(props.Zona || props.zona || props.ZONA || props.NM_SUBDIST || props.Subdistrito || props['Nome do subdistrito'] || '');
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
      zona,
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

  // Nome exibido no título da feição e valor para cópia na área de transferência
  const { featureDisplayName, featureCopyValue } = useMemo(() => {
    if (!activeDetailFeature) {
      return { featureDisplayName: '', featureCopyValue: '' };
    }
    const raw = isCoordenadaSearch
      ? (activeDetailFeature.name || '')
      : (structuredDetails?.nomeOficial || activeDetailFeature.name || '');

    const isPlaceholder = !raw || raw === 'Local Selecionado' || raw === 'Coordenada Pesquisada';
    const display = isPlaceholder
      ? (isCoordenadaSearch ? 'Coordenada Pesquisada' : 'Local Selecionado')
      : raw;

    return {
      featureDisplayName: display,
      featureCopyValue: isPlaceholder ? '' : display
    };
  }, [activeDetailFeature, isCoordenadaSearch, structuredDetails]);

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

    // Helper para verificar se um ou mais campos existem na feição com conteúdo real não vazio
    const hasField = (...keys: string[]) => {
      return keys.some(k => {
        const val = props[k];
        return val != null && String(val).trim() !== '' && String(val).trim() !== '—';
      });
    };

    const rawAreaNum = props.AREA_KM2 != null ? Number(props.AREA_KM2) : (props.Area != null ? Number(props.Area) : (props.area_km2 != null ? Number(props.area_km2) : null));
    const densidadeCalculada = (d.popTotal > 0 && rawAreaNum && rawAreaNum > 0)
      ? `${(d.popTotal / rawAreaNum).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} hab/km²`
      : null;

    const baseItems: Array<{ id: string; label: string; value: string; isAvailable: boolean; propertyKey?: string; category?: any }> = [
      { id: 'popTotal', label: 'População', value: d.popTotal ? `${d.popTotal.toLocaleString('pt-BR')} hab` : '—', isAvailable: hasField('V0001', 'Total de pessoas'), propertyKey: 'V0001', category: 'demografia' },
      { id: 'domTotal', label: 'Domicílios', value: d.domTotal ? d.domTotal.toLocaleString('pt-BR') : '—', isAvailable: hasField('V0002', 'Total de Domicílios'), propertyKey: 'V0002', category: 'demografia' },
      { id: 'mediaMoradores', label: 'Média de Moradores', value: d.mediaMoradores ? `${d.mediaMoradores} /dom.` : '—', isAvailable: d.mediaMoradores !== null, propertyKey: 'V0005', category: 'demografia' },
      { id: 'areaKm2', label: 'Área Territorial', value: d.areaKm2 || '—', isAvailable: hasField('AREA_KM2', 'Area', 'area_km2') && d.areaKm2 !== null, propertyKey: 'AREA_KM2', category: 'territorio' },
      { id: 'densidade', label: 'Densidade Demográfica', value: densidadeCalculada || '—', isAvailable: densidadeCalculada !== null, propertyKey: 'DENSIDADE', category: 'demografia' },
      { id: 'domParticulares', label: 'Dom. Particulares', value: d.domParticulares ? d.domParticulares.toLocaleString('pt-BR') : '—', isAvailable: hasField('V0003', 'Total de Domicílios Particulares'), propertyKey: 'V0003', category: 'demografia' },
      { id: 'domOcupados', label: 'Dom. Ocupados', value: d.domOcupados ? d.domOcupados.toLocaleString('pt-BR') : '—', isAvailable: hasField('V0007', 'Total de Domicílios Particulares Ocupados'), propertyKey: 'V0007', category: 'demografia' },
      { id: 'domVagos', label: 'Dom. Vagos', value: d.domVagos ? d.domVagos.toLocaleString('pt-BR') : '—', isAvailable: d.domParticulares > 0 && d.domOcupados > 0, category: 'demografia' },
      { id: 'taxaVacancia', label: 'Taxa de Vacância', value: d.taxaVacancia || '—', isAvailable: d.taxaVacancia !== null, category: 'demografia' },
      { id: 'domColetivos', label: 'Dom. Coletivos', value: d.domColetivos ? d.domColetivos.toLocaleString('pt-BR') : '—', isAvailable: hasField('V0004', 'Total de Domicílios Coletivos'), propertyKey: 'V0004', category: 'demografia' },
      { id: 'situacao', label: 'Situação', value: d.situacao || '—', isAvailable: hasField('SITUACAO', 'Situação detalhada', 'NM_SIT', 'CD_SIT') && Boolean(d.situacao), propertyKey: 'SITUACAO', category: 'territorio' },
      { id: 'tipoDescritivo', label: 'Tipo do Setor', value: d.tipoDescritivo || '—', isAvailable: hasField('Tipo do Setor', 'tipo', 'NM_TIPO', 'CD_TIPO') && Boolean(d.tipoDescritivo), propertyKey: 'Tipo do Setor', category: 'territorio' },
      { id: 'areaDesenvolvimento', label: 'Área de Desenvolvimento', value: d.areaDesenvolvimento || '—', isAvailable: hasField('Area de desenvolvimento', 'Área de desenvolvimento') && Boolean(d.areaDesenvolvimento), propertyKey: 'Area de desenvolvimento', category: 'territorio' },
      { id: 'risp', label: 'RISP (Segurança)', value: d.risp || '—', isAvailable: hasField('Risp', 'RISP') && Boolean(d.risp), propertyKey: 'Risp', category: 'seguranca' },
      { id: 'aisp', label: 'AISP (Segurança)', value: d.aisp || '—', isAvailable: hasField('Aisp', 'AISP') && Boolean(d.aisp), propertyKey: 'Aisp', category: 'seguranca' },
      { id: 'nomeMunicipio', label: 'Município', value: d.nomeMunicipio || '—', isAvailable: hasField('NM_MUN', 'Nome do município', 'Municipio', 'MUNICIPIO') && Boolean(d.nomeMunicipio), propertyKey: 'NM_MUN', category: 'localizacao' },
      { id: 'nomeBairro', label: 'Bairro', value: d.nomeBairro || '—', isAvailable: hasField('NM_BAIRRO', 'Bairro', 'BAIRRO') && Boolean(d.nomeBairro), propertyKey: 'NM_BAIRRO', category: 'localizacao' },
      { id: 'nomeDistrito', label: 'Distrito', value: d.nomeDistrito || '—', isAvailable: hasField('NM_DIST', 'Distrito', 'DISTRITO') && Boolean(d.nomeDistrito), propertyKey: 'NM_DIST', category: 'localizacao' },
      { id: 'zona', label: 'Zona', value: d.zona || d.nomeSubdistrito || '—', isAvailable: hasField('Zona', 'zona', 'ZONA', 'NM_SUBDIST', 'Subdistrito', 'subdistrito', 'Nome do subdistrito') && Boolean(d.zona || d.nomeSubdistrito), propertyKey: 'Zona', category: 'localizacao' },
      { id: 'nomeSubdistrito', label: 'Subdistrito / Zona', value: d.nomeSubdistrito || '—', isAvailable: hasField('NM_SUBDIST', 'Subdistrito', 'subdistrito', 'Nome do subdistrito') && Boolean(d.nomeSubdistrito), propertyKey: 'NM_SUBDIST', category: 'localizacao' },
      { id: 'nomeRgInt', label: 'Região Intermediária', value: d.nomeRgInt || '—', isAvailable: hasField('NM_RGINT') && Boolean(d.nomeRgInt), propertyKey: 'NM_RGINT', category: 'localizacao' },
      { id: 'nomeRgI', label: 'Região Imediata', value: d.nomeRgI || '—', isAvailable: hasField('NM_RGI') && Boolean(d.nomeRgI), propertyKey: 'NM_RGI', category: 'localizacao' },
      { id: 'nomeUf', label: 'Estado / UF', value: d.nomeUf || '—', isAvailable: hasField('NM_UF', 'UF', 'uf', 'nm_uf'), propertyKey: 'NM_UF', category: 'localizacao' },
    ];

    const options: CustomCardOption[] = [];
    const valuesMap: Record<string, { label: string; value: string }> = {};

    baseItems.forEach(item => {
      valuesMap[item.id] = { label: item.label, value: item.value };
      if (item.isAvailable && isAllowed(item.propertyKey)) {
        options.push({ id: item.id, label: item.label, propertyKey: item.propertyKey, category: item.category });
      }
    });

    // Mapeamento de chaves já cobertas pelos itens base para não duplicar no catálogo
    const basePropertyKeys = new Set([
      'v0001', 'total de pessoas',
      'v0002', 'total de domicílios',
      'v0003', 'total de domicílios particulares',
      'v0004', 'total de domicílios coletivos',
      'v0005',
      'v0007', 'total de domicílios particulares ocupados',
      'area_km2', 'area',
      'densidade',
      'situacao', 'situação detalhada', 'nm_sit', 'cd_sit',
      'tipo do setor', 'tipo', 'nm_tipo', 'cd_tipo',
      'area de desenvolvimento', 'área de desenvolvimento',
      'risp', 'aisp',
      'nm_mun', 'nome do município', 'municipio',
      'nm_bairro', 'bairro',
      'nm_dist', 'distrito',
      'zona',
      'nm_subdist', 'subdistrito', 'nome do subdistrito',
      'nm_rgint', 'nm_rgi',
      'nm_uf', 'uf',
      'nome', 'localidade', 'nm_fcu', 'nm_nu', 'nm_aglom'
    ]);

    const systemKeys = new Set([
      'id', 'geometry', 'layer', 'name', 'sourcename', 'lat', 'lng', 'latitude', 'longitude'
    ]);

    // Incluir atributos da feição que não estejam nos itens base e não sejam vazios
    Object.keys(props).forEach(k => {
      const lower = k.toLowerCase();
      if (lower.startsWith('_') || systemKeys.has(lower)) return;
      if (!isAllowed(k)) return;
      const rawVal = props[k];
      const hasVal = rawVal != null && String(rawVal).trim() !== '' && String(rawVal).trim() !== '—';
      const attrId = `attr_${k}`;
      const label = propertyNames[k] || toTitleCase(k.replace(/_/g, ' '));
      const valStr = hasVal ? String(rawVal) : '—';

      if (!valuesMap[attrId]) {
        valuesMap[attrId] = { label, value: valStr };
      }

      if (hasVal && !basePropertyKeys.has(lower)) {
        options.push({ id: attrId, label, propertyKey: k, category: 'atributo' });
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

    // Ocultar qualquer campo que já esteja escolhido nos cards de "Informações Úteis"
    const hiddenKeys = new Set<string>();
    const activeCardIds = usefulCardIds.slice(0, 8);
    activeCardIds.forEach(id => {
      if (id === 'domVagos') hiddenKeys.add('dom_vagos');
      if (id === 'taxaVacancia') hiddenKeys.add('taxa_vacancia');
      if (id === 'tipoDescritivo') {
        hiddenKeys.add('cd_tipo');
        hiddenKeys.add('tipo do setor');
        hiddenKeys.add('tipo');
      }
      if (id === 'zona') {
        hiddenKeys.add('zona');
        hiddenKeys.add('nm_subdist');
        hiddenKeys.add('subdistrito');
      }
      if (id === 'nomeSubdistrito') {
        hiddenKeys.add('nm_subdist');
        hiddenKeys.add('subdistrito');
        hiddenKeys.add('zona');
      }
      const opt = usefulCardsCatalog.options.find(o => o.id === id);
      if (opt?.propertyKey) {
        hiddenKeys.add(opt.propertyKey.toLowerCase().trim());
      }
    });

    return items.filter(item => {
      const k = item.key.toLowerCase().trim();
      return !hiddenKeys.has(k);
    });
  }, [structuredDetails, activeDetailFeature, allowedProperties, isAdmin, usefulCardIds, usefulCardsCatalog]);

  // Se uma feição foi selecionada e o usuário ainda não está na aba de detalhes, permitir alternar suavemente
  const hasFeature = !!activeDetailFeature;

  // Helper resiliente para cópia com Clipboard API e fallback para textarea + execCommand
  const copyToClipboard = async (text: string): Promise<boolean> => {
    if (!text || text === '—') return false;
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch {
      // Falha silenciosa para fallback
    }

    try {
      if (typeof document !== 'undefined') {
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        textArea.style.top = '-999999px';
        textArea.setAttribute('readonly', '');
        document.body.appendChild(textArea);
        textArea.select();
        const successful = document.execCommand('copy');
        document.body.removeChild(textArea);
        return successful;
      }
    } catch {
      return false;
    }

    return false;
  };

  const handleCopy = async (text: string, label: string): Promise<boolean> => {
    const success = await copyToClipboard(text);
    if (success) {
      showToast(`${label} copiado!`);
    } else {
      showToast(`Não foi possível copiar ${label}`);
    }
    return success;
  };

  // Estados e controle de timer para animação dos cartões de Informações Úteis
  const [copiedCardId, setCopiedCardId] = useState<string | null>(null);
  const [ripplePos, setRipplePos] = useState<{ id: string; x: number; y: number } | null>(null);
  const copyTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (copyTimeoutRef.current) {
        clearTimeout(copyTimeoutRef.current);
      }
    };
  }, []);

  const handleCardClick = async (
    e: React.MouseEvent<HTMLButtonElement>, 
    id: string, 
    value: string, 
    label: string
  ) => {
    if (!value || value === '—') return;

    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const success = await handleCopy(value, label);
    if (!success) return;

    // Se clicar repetidamente, cancela o timer anterior para reiniciar
    if (copyTimeoutRef.current) {
      clearTimeout(copyTimeoutRef.current);
      copyTimeoutRef.current = null;
    }

    setRipplePos({ id, x, y });
    setCopiedCardId(id);

    copyTimeoutRef.current = setTimeout(() => {
      setCopiedCardId(prev => (prev === id ? null : prev));
      setRipplePos(prev => (prev?.id === id ? null : prev));
      copyTimeoutRef.current = null;
    }, 1200);
  };

  const renderStage2Body = () => (
    <>
            {/* ABA: DETALHES DA FEIÇÃO / PLACE CARD (Screenshot 3 do Apple Maps) */}
        {/* ============================================================== */}
        {activeTab === 'details' && can('tool:feature_specs') && (
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
                  <CopyableText
                    value={featureCopyValue}
                    label="nome da feição"
                    showToast={showToast}
                    className="w-full min-w-0 max-w-full -ml-1 px-1 rounded-lg text-xl font-black text-slate-900 dark:text-white tracking-tight"
                    title={featureCopyValue ? `Clique para copiar: ${featureDisplayName}` : featureDisplayName}
                  >
                    <span className="truncate block">{featureDisplayName}</span>
                  </CopyableText>
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
                className="shrink-0 hidden md:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/5 hover:bg-black/10 dark:bg-white/10 dark:hover:bg-white/15 text-slate-600 dark:text-slate-300 text-xs font-semibold transition-all cursor-pointer border border-black/5 dark:border-white/10 active:scale-95 focus-visible:ring-2 focus-visible:ring-[#007AFF] outline-none"
                title="Remove esta feição da seleção e tira o destaque do mapa"
                aria-label={selectedFeatures.length >= 2 ? "Desmarcar esta feição da seleção" : "Desmarcar feição"}
              >
                <span>Desmarcar</span>
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Aviso discreto quando houver 2+ feições selecionadas */}
            {can('allowSelectedFeaturesPanel') && selectedFeatures.length >= 2 && (
              <div className="flex items-center justify-between gap-2 px-3 py-2 bg-slate-100/90 dark:bg-white/5 border border-black/5 dark:border-white/10 rounded-xl text-xs text-slate-700 dark:text-slate-300 animate-fadeIn">
                <span className="truncate">
                  <strong className="font-semibold text-slate-900 dark:text-white">{selectedFeatures.length}</strong> feições selecionadas. Exibindo a última.
                </span>
                <button
                  type="button"
                  onClick={() => setActiveTab('dashboard')}
                  className="text-[#007AFF] dark:text-[#64D2FF] font-semibold hover:underline shrink-0 cursor-pointer text-[11px] flex items-center gap-1"
                >
                  <span>Veja o total no Raio-X</span>
                  <span>&rarr;</span>
                </button>
              </div>
            )}

            {/* Linha de Botões de Ação Apple */}
            {isLocalidade ? (
              /* Ações exclusivas para Localidades: sem Raio-X e sem CNEFE Polígono, com Busca Direta no CNEFE */
              <div className="space-y-2 pt-1">
                {/* Botão Principal: Busca Direta de Endereços por Localidade no CNEFE */}
                <button
                  type="button"
                  disabled={isSearchingAddresses}
                  aria-busy={isSearchingAddresses}
                  onClick={() => {
                    if (isSearchingAddresses) return;
                    const loc = localidadeMetadata?.nome || structuredDetails?.nomeLocalidade || activeDetailFeature.name || '';
                    const mun = localidadeMetadata?.municipio || structuredDetails?.nomeMunicipio || '';
                    if (onSearchLocalidadeAddresses) {
                      onSearchLocalidadeAddresses(loc, mun);
                    }
                  }}
                  className={`w-full py-3 px-3.5 bg-gradient-to-r from-[#FF9500] to-[#FF5E3A] hover:brightness-105 active:scale-[0.98] text-white rounded-2xl flex items-center justify-center gap-2.5 shadow-lg shadow-orange-500/25 transition-all cursor-pointer font-bold text-xs sm:text-sm disabled:opacity-60 disabled:cursor-not-allowed ${isSearchingAddresses ? 'cnefe-btn-searching' : ''}`}
                  title={`Buscar endereços cadastrados no CNEFE para a localidade "${localidadeMetadata?.nome || activeDetailFeature.name}" no município de ${localidadeMetadata?.municipio || structuredDetails?.nomeMunicipio || 'Piauí'}`}
                >
                  {isSearchingAddresses ? (
                    <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                  ) : (
                    <Home className="w-4 h-4 shrink-0" />
                  )}
                  <span className="truncate">Buscar Endereços desta Localidade</span>
                </button>

                <div className={isMobile ? "w-full" : "grid grid-cols-2 gap-2"}>
                  {/* Botão Focar */}
                  <button
                    type="button"
                    onClick={() => onZoomToFeature(activeDetailFeature)}
                    className="w-full py-2.5 px-2 bg-[#007AFF] hover:bg-[#0066d6] active:scale-95 text-white rounded-2xl flex items-center justify-center gap-1.5 text-xs font-bold shadow-md shadow-blue-500/25 transition-all cursor-pointer"
                  >
                    <Navigation className="w-4 h-4 fill-white text-white" />
                    <span>Focar no Ponto</span>
                  </button>

                  {/* Botão Exportar com Download Rápido e Feedback Inline (apenas desktop; no mobile fica no cabeçalho) */}
                  {!isMobile && (
                    <button
                      type="button"
                      disabled={exportButtonState !== 'idle'}
                      onClick={handleExportButtonClick}
                      className={`py-2.5 px-2 rounded-2xl flex items-center justify-center gap-1.5 text-xs font-bold transition-all cursor-pointer ${
                        exportButtonState === 'success'
                          ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                          : exportButtonState === 'error'
                          ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30'
                          : 'bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/15 active:scale-95 text-slate-800 dark:text-slate-200'
                      }`}
                      title={exportPrefs.quickDownload && exportPrefs.format ? `Baixar seleção em ${(exportPrefs.format === 'csv' && getGeometryKind(selectedFeatures) === 'polygon' ? 'geojson' : exportPrefs.format).toUpperCase()}` : "Exportar feição"}
                    >
                      {exportButtonState === 'preparing' ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin text-[#007AFF]" />
                          <span>Baixando...</span>
                        </>
                      ) : exportButtonState === 'success' ? (
                        <>
                          <svg className="w-4 h-4 stroke-emerald-600 dark:stroke-emerald-400 shrink-0" viewBox="0 0 24 24" fill="none" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                            <motion.path
                              d="M20 6L9 17L4 12"
                              initial={prefersReducedMotion ? { pathLength: 1 } : { pathLength: 0 }}
                              animate={{ pathLength: 1 }}
                              transition={{ duration: 0.35, ease: "easeOut" }}
                            />
                          </svg>
                          <span>Baixado</span>
                        </>
                      ) : exportButtonState === 'error' ? (
                        <>
                          <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0" />
                          <span>Erro</span>
                        </>
                      ) : (
                        <>
                          <Download className="w-4 h-4 text-slate-700 dark:text-slate-200" />
                          <span>Exportar</span>
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>
            ) : isCoordenadaSearch ? (
              /* Para Coordenadas pesquisadas: não exibir as ferramentas do topo (focar, raio x, exportar, cnefe), pois já existem na primeira barra lateral */
              null
            ) : (
              /* Ações padrão para camadas poligonais / territoriais: 2 colunas no mobile (Focar, Buscar endereços), 3 colunas no desktop (+ Exportar) */
              <div className={`${isMobile ? 'grid grid-cols-2' : 'grid grid-cols-3'} gap-2 pt-1`}>
                {/* Botão Trajetos / Focar (Azul Apple #007AFF) */}
                <button
                  type="button"
                  onClick={() => onZoomToFeature(activeDetailFeature)}
                  className="py-2.5 px-2 bg-[#007AFF] hover:bg-[#0066d6] active:scale-95 text-white rounded-2xl flex flex-col items-center justify-center gap-1 text-[11px] font-bold shadow-sm transition-all cursor-pointer"
                >
                  <Navigation className="w-5 h-5 fill-white text-white" />
                  <span>Focar</span>
                </button>

                {/* Botão Buscar Endereços no Polígono (com Seta de Categorias se for polígono territorial elegível) */}
                {can('allowSearchAreaAddresses') && (
                  isEligiblePolygonFeature(activeDetailFeature) && onSearchCategoryInFeatures && can('allowSearchByType') ? (
                    <div className="relative flex rounded-2xl bg-black/5 dark:bg-white/10 text-slate-800 dark:text-slate-200 transition-all overflow-visible">
                      <button
                        type="button"
                        disabled={isSearchingAddresses}
                        aria-busy={isSearchingAddresses}
                        onClick={() => {
                          onSearchPolygonAddresses(activeDetailFeature);
                          if (can('tool:advanced_search')) {
                            onOpenCnefeBottomBar?.();
                          }
                        }}
                        className={`flex-1 py-2.5 pl-1.5 pr-0.5 hover:bg-black/5 dark:hover:bg-white/5 active:scale-[0.98] rounded-l-2xl flex flex-col items-center justify-center gap-1 text-[10.5px] font-bold transition-all cursor-pointer text-center disabled:opacity-50 ${isSearchingAddresses ? 'cnefe-btn-searching' : ''}`}
                        title={isComunidadeRural ? "Abrir Busca de Endereços desta área na barra inferior" : "Abrir Busca de Endereços Avançado desta área na barra inferior"}
                      >
                        {isSearchingAddresses ? (
                          <Loader2 className="w-5 h-5 animate-spin text-[#007AFF]" />
                        ) : (
                          <Home className="w-5 h-5 text-slate-700 dark:text-slate-300" />
                        )}
                        <span className="leading-tight px-0.5">Buscar endereços</span>
                      </button>

                      <div className="w-[1px] my-2 bg-black/10 dark:bg-white/10 shrink-0" />

                      <CategorySearchMenu
                        disabled={isSearchingAddresses}
                        isLoading={isSearchingAddresses}
                        onSelectCategory={(catId) => onSearchCategoryInFeatures(catId, activeDetailFeature)}
                        align="center"
                      />
                    </div>
                  ) : (
                    <button
                      type="button"
                      disabled={isSearchingAddresses}
                      aria-busy={isSearchingAddresses}
                      onClick={() => {
                        onSearchPolygonAddresses(activeDetailFeature);
                        if (can('tool:advanced_search')) {
                          onOpenCnefeBottomBar?.();
                        }
                      }}
                      className={`py-2.5 px-1 bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/15 active:scale-95 text-slate-800 dark:text-slate-200 rounded-2xl flex flex-col items-center justify-center gap-1 text-[10.5px] font-bold transition-all cursor-pointer text-center disabled:opacity-50 ${isSearchingAddresses ? 'cnefe-btn-searching' : ''}`}
                      title={isComunidadeRural ? "Abrir Busca de Endereços desta área na barra inferior" : "Abrir Busca de Endereços Avançado desta área na barra inferior"}
                    >
                      {isSearchingAddresses ? (
                        <Loader2 className="w-5 h-5 animate-spin text-[#007AFF]" />
                      ) : (
                        <Home className="w-5 h-5 text-slate-700 dark:text-slate-300" />
                      )}
                      <span className="leading-tight px-0.5">Buscar endereços</span>
                    </button>
                  )
                )}

                {/* Botão Exportar com Download Rápido e Feedback Inline (apenas desktop; no mobile fica no cabeçalho) */}
                {!isMobile && (
                  <button
                    type="button"
                    disabled={exportButtonState !== 'idle'}
                    onClick={handleExportButtonClick}
                    className={`py-2.5 px-2 rounded-2xl flex flex-col items-center justify-center gap-1 text-[11px] font-bold transition-all cursor-pointer ${
                      exportButtonState === 'success'
                        ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                        : exportButtonState === 'error'
                        ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30'
                        : 'bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/15 active:scale-95 text-slate-800 dark:text-slate-200'
                    }`}
                    title={exportPrefs.quickDownload && exportPrefs.format ? `Baixar seleção em ${(exportPrefs.format === 'csv' && getGeometryKind(selectedFeatures) === 'polygon' ? 'geojson' : exportPrefs.format).toUpperCase()}` : "Exportar feição"}
                  >
                    {exportButtonState === 'preparing' ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin text-[#007AFF]" />
                        <span className="truncate">Baixando...</span>
                      </>
                    ) : exportButtonState === 'success' ? (
                      <>
                        <svg className="w-5 h-5 stroke-emerald-600 dark:stroke-emerald-400 shrink-0" viewBox="0 0 24 24" fill="none" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                          <motion.path
                            d="M20 6L9 17L4 12"
                            initial={prefersReducedMotion ? { pathLength: 1 } : { pathLength: 0 }}
                            animate={{ pathLength: 1 }}
                            transition={{ duration: 0.35, ease: "easeOut" }}
                          />
                        </svg>
                        <span>Baixado</span>
                      </>
                    ) : exportButtonState === 'error' ? (
                      <>
                        <AlertTriangle className="w-5 h-5 text-rose-500 shrink-0" />
                        <span>Erro</span>
                      </>
                    ) : (
                      <>
                        <Download className="w-5 h-5 text-slate-700 dark:text-slate-300" />
                        <span>Exportar</span>
                      </>
                    )}
                  </button>
                )}
              </div>
            )}

            {/* Região Acessível aria-live para Status de Exportação */}
            <div className="sr-only" aria-live="polite" aria-atomic="true">
              {exportLiveStatus}
            </div>

            {/* Pergunta Embutida: Escolha do Formato Padrão para Download Rápido */}
            <AnimatePresence>
              {showFormatPrompt && (
                <motion.div
                  initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, height: 0, scale: 0.96 }}
                  animate={{ opacity: 1, height: 'auto', scale: 1 }}
                  exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, height: 0, scale: 0.96 }}
                  transition={{ duration: 0.2, ease: "easeOut" }}
                  className="p-3 bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200/80 dark:border-blue-800/50 rounded-2xl space-y-2.5 overflow-hidden"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                      <Download className="w-3.5 h-3.5 text-[#007AFF]" />
                      <span>Qual formato padrão para baixar?</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowFormatPrompt(false)}
                      className="w-5 h-5 rounded-full hover:bg-black/5 dark:hover:bg-white/10 flex items-center justify-center text-slate-400 cursor-pointer touch-target-44"
                      aria-label="Fechar"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>

                  <div className={`grid ${getGeometryKind(selectedFeatures) === 'point' ? 'grid-cols-4' : 'grid-cols-3'} gap-1.5`}>
                    {(getGeometryKind(selectedFeatures) === 'point'
                      ? (['csv', 'gpkg', 'geojson', 'kml'] as const)
                      : (['gpkg', 'geojson', 'kml'] as const)
                    ).map(fmt => (
                      <button
                        key={fmt}
                        type="button"
                        onClick={() => handleSelectDefaultFormatAndDownload(fmt)}
                        className="py-1.5 px-2 bg-white dark:bg-[#1c1c1e] hover:bg-[#007AFF] hover:text-white dark:hover:bg-[#007AFF] text-slate-800 dark:text-slate-200 rounded-xl text-xs font-black shadow-xs border border-black/5 dark:border-white/10 transition-colors uppercase cursor-pointer text-center"
                      >
                        {fmt}
                      </button>
                    ))}
                  </div>

                  <div className="pt-0.5 text-center">
                    <button
                      type="button"
                      onClick={handleChooseAlways}
                      className="text-[11px] font-semibold text-[#007AFF] hover:underline cursor-pointer"
                    >
                      Prefiro escolher sempre na aba de exportação
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

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

                {/* Região acessível para anúncio em leitores de tela das Localidades */}
                <div className="sr-only" aria-live="polite" aria-atomic="true">
                  {copiedCardId === 'loc-municipio' && 'Município copiado'}
                  {copiedCardId === 'loc-cep' && 'CEP copiado'}
                  {copiedCardId === 'loc-aglomerado' && 'Aglomerado copiado'}
                </div>

                <div className="grid grid-cols-2 gap-2">
                  {(() => {
                    const munRaw = localidadeMetadata?.municipio || structuredDetails?.nomeMunicipio || '';
                    const isMunInteractive = Boolean(
                      munRaw && 
                      munRaw !== '—' && 
                      munRaw.toLowerCase() !== 'piaui' && 
                      munRaw.toLowerCase() !== 'piauí'
                    );
                    const munDisplay = munRaw || 'Piauí';

                    const cepRaw = localidadeMetadata?.cep || '';
                    const isCepInteractive = Boolean(cepRaw && cepRaw !== '—');
                    const cepDisplay = cepRaw || '—';

                    const aglomRaw = localidadeMetadata?.aglomerado || '';
                    const isAglomInteractive = Boolean(aglomRaw && aglomRaw !== '—');

                    const locCards = [
                      {
                        id: 'loc-municipio',
                        label: 'Município',
                        value: munDisplay,
                        copyValue: munDisplay,
                        isInteractive: isMunInteractive,
                        colSpan: false
                      },
                      {
                        id: 'loc-cep',
                        label: 'CEP',
                        value: cepDisplay,
                        copyValue: cepRaw,
                        isInteractive: isCepInteractive,
                        colSpan: false
                      },
                      ...(aglomRaw ? [{
                        id: 'loc-aglomerado',
                        label: 'Aglomerado',
                        value: aglomRaw,
                        copyValue: aglomRaw,
                        isInteractive: isAglomInteractive,
                        colSpan: true
                      }] : [])
                    ];

                    return locCards.map(card => {
                      const isCopied = copiedCardId === card.id;

                      return (
                        <motion.button 
                          key={card.id}
                          type="button"
                          onClick={(e) => handleCardClick(e, card.id, card.copyValue, card.label)}
                          disabled={!card.isInteractive}
                          whileTap={!prefersReducedMotion && card.isInteractive ? { scale: 0.96 } : undefined}
                          transition={{ type: "spring", stiffness: 500, damping: 30 }}
                          className={`relative overflow-hidden p-2.5 bg-white dark:bg-[#2c2c2e] rounded-xl shadow-xs border border-black/5 dark:border-white/5 text-left w-full transition-colors outline-none focus-visible:ring-2 focus-visible:ring-[#007AFF] ${
                            card.colSpan ? 'col-span-2' : ''
                          } ${
                            card.isInteractive
                              ? 'cursor-pointer hover:bg-slate-50 dark:hover:bg-white/5 active:bg-slate-100 dark:active:bg-white/10' 
                              : 'cursor-default opacity-85'
                          }`}
                          title={card.isInteractive ? `Clique para copiar ${card.label}` : card.label}
                        >
                          {/* Pulso / Onda discreta originada do ponto de clique */}
                          {!prefersReducedMotion && ripplePos?.id === card.id && (
                            <motion.span
                              key={`ripple-${card.id}-${ripplePos.x}-${ripplePos.y}`}
                              initial={{ scale: 0, opacity: 0.45 }}
                              animate={{ scale: 4.5, opacity: 0 }}
                              transition={{ duration: 0.6, ease: "easeOut" }}
                              className="absolute pointer-events-none rounded-full bg-[#007AFF]/20 dark:bg-[#007AFF]/30"
                              style={{
                                left: ripplePos.x - 20,
                                top: ripplePos.y - 20,
                                width: 40,
                                height: 40,
                              }}
                            />
                          )}

                          <span className="text-[10px] text-slate-400 dark:text-slate-500 font-bold block truncate" title={card.label}>
                            {card.label}
                          </span>

                          {/* Contêiner de altura fixa com sobreposição dos dois estados (valor original vs 'Copiado') */}
                          <div className="relative h-5 mt-0.5 w-full overflow-hidden">
                            <AnimatePresence mode="wait" initial={false}>
                              {isCopied ? (
                                <motion.div
                                  key="copied"
                                  initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 5 }}
                                  animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
                                  exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: -5 }}
                                  transition={{ duration: 0.16, ease: "easeOut" }}
                                  className="absolute inset-0 flex items-center gap-1.5 text-xs font-black text-[#007AFF] dark:text-[#64D2FF]"
                                >
                                  <motion.span
                                    initial={prefersReducedMotion ? undefined : { scale: 0.5, rotate: -25 }}
                                    animate={prefersReducedMotion ? undefined : { scale: 1, rotate: 0 }}
                                    transition={{ type: "spring", stiffness: 600, damping: 24 }}
                                    className="inline-flex items-center justify-center shrink-0"
                                  >
                                    <Check className="w-3.5 h-3.5 stroke-[3]" />
                                  </motion.span>
                                  <span className="truncate tracking-tight font-black">Copiado</span>
                                </motion.div>
                              ) : (
                                <motion.div
                                  key="value"
                                  initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: -5 }}
                                  animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
                                  exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 5 }}
                                  transition={{ duration: 0.16, ease: "easeOut" }}
                                  className="absolute inset-0 flex items-center"
                                >
                                  <span className="text-xs font-black text-slate-800 dark:text-slate-100 truncate block w-full" title={card.value}>
                                    {card.value}
                                  </span>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>
                        </motion.button>
                      );
                    });
                  })()}
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
                          ? 'Saúde'
                          : activeDetailFeature.properties?.origem === 'tipo-farmacias'
                          ? 'Farmácia'
                          : activeDetailFeature.properties?.origem === 'tipo-restaurantes'
                          ? 'Restaurante'
                          : activeDetailFeature.properties?.origem === 'tipo-postos'
                          ? 'Posto de Gasolina'
                          : activeDetailFeature.properties?.origem === 'tipo-hoteis'
                          ? 'Hotel'
                          : (activeDetailFeature.properties?.especie || activeDetailFeature.properties?.ESPECIE
                              ? toTitleCase(String(activeDetailFeature.properties?.especie || activeDetailFeature.properties?.ESPECIE))
                              : 'Endereço'))
                      : 'Ponto Pesquisado'}
                  </span>
                </div>

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
                            <CopyableText
                              value={val}
                              label={label}
                              showToast={showToast}
                              className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate text-right px-1.5 py-0.5"
                            />
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
            ) : (
              /* Informações Úteis Demográficas para Feições Poligonais (Personalizáveis) */
              <div className="bg-black/5 dark:bg-white/5 rounded-2xl p-3.5 space-y-2.5">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Informações Úteis
                  </h3>
                  {can('allowCustomizeUsefulInfo') && (
                    <button
                      type="button"
                      onClick={() => {
                        setCustomizerLayer({ norm: normalizedLayer, name: activeLayerName });
                        setIsCustomizerModalOpen(true);
                      }}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-black/5 dark:hover:bg-white/10 transition-colors cursor-pointer"
                      title="Personalizar quais informações aparecem nos cartões"
                    >
                      <SlidersHorizontal className="w-3 h-3" />
                      <span>Personalizar</span>
                    </button>
                  )}
                </div>
                
                {/* Região acessível para anúncio em leitores de tela */}
                <div className="sr-only" aria-live="polite" aria-atomic="true">
                  {copiedCardId && usefulCardsCatalog.valuesMap[copiedCardId] 
                    ? `${usefulCardsCatalog.valuesMap[copiedCardId].label} copiado` 
                    : ''}
                </div>

                <div className="grid grid-cols-2 gap-2">
                  {usefulCardIds.slice(0, 8).map(id => {
                    const cardItem = usefulCardsCatalog.valuesMap[id];
                    if (!cardItem) return null;
                    const isCopied = copiedCardId === id;
                    const isInteractive = cardItem.value && cardItem.value !== '—';

                    return (
                      <motion.button 
                        key={id}
                        type="button"
                        onClick={(e) => handleCardClick(e, id, cardItem.value, cardItem.label)}
                        disabled={!isInteractive}
                        whileTap={!prefersReducedMotion && isInteractive ? { scale: 0.96 } : undefined}
                        transition={{ type: "spring", stiffness: 500, damping: 30 }}
                        className={`relative overflow-hidden p-2.5 bg-white dark:bg-[#2c2c2e] rounded-xl shadow-xs border border-black/5 dark:border-white/5 text-left w-full transition-colors outline-none focus-visible:ring-2 focus-visible:ring-[#007AFF] ${
                          isInteractive
                            ? 'cursor-pointer hover:bg-slate-50 dark:hover:bg-white/5 active:bg-slate-100 dark:active:bg-white/10' 
                            : 'cursor-default opacity-85'
                        }`}
                        title={isInteractive ? `Clique para copiar ${cardItem.label}` : cardItem.label}
                      >
                        {/* Pulso / Onda discreta originada do ponto de clique */}
                        {!prefersReducedMotion && ripplePos?.id === id && (
                          <motion.span
                            key={`ripple-${id}-${ripplePos.x}-${ripplePos.y}`}
                            initial={{ scale: 0, opacity: 0.45 }}
                            animate={{ scale: 4.5, opacity: 0 }}
                            transition={{ duration: 0.6, ease: "easeOut" }}
                            className="absolute pointer-events-none rounded-full bg-[#007AFF]/20 dark:bg-[#007AFF]/30"
                            style={{
                              left: ripplePos.x - 20,
                              top: ripplePos.y - 20,
                              width: 40,
                              height: 40,
                            }}
                          />
                        )}

                        <span className="text-[10px] text-slate-400 dark:text-slate-500 font-bold block truncate" title={cardItem.label}>
                          {cardItem.label}
                        </span>

                        {/* Contêiner de altura fixa com sobreposição dos dois estados (valor original vs 'Copiado') */}
                        <div className="relative h-5 mt-0.5 w-full overflow-hidden">
                          <AnimatePresence mode="wait" initial={false}>
                            {isCopied ? (
                              <motion.div
                                key="copied"
                                initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 5 }}
                                animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
                                exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: -5 }}
                                transition={{ duration: 0.16, ease: "easeOut" }}
                                className="absolute inset-0 flex items-center gap-1.5 text-xs font-black text-[#007AFF] dark:text-[#64D2FF]"
                              >
                                <motion.span
                                  initial={prefersReducedMotion ? undefined : { scale: 0.5, rotate: -25 }}
                                  animate={prefersReducedMotion ? undefined : { scale: 1, rotate: 0 }}
                                  transition={{ type: "spring", stiffness: 600, damping: 24 }}
                                  className="inline-flex items-center justify-center shrink-0"
                                >
                                  <Check className="w-3.5 h-3.5 stroke-[3]" />
                                </motion.span>
                                <span className="truncate tracking-tight font-black">Copiado</span>
                              </motion.div>
                            ) : (
                              <motion.div
                                key="value"
                                initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: -5 }}
                                animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
                                exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 5 }}
                                transition={{ duration: 0.16, ease: "easeOut" }}
                                className="absolute inset-0 flex items-center"
                              >
                                <span className="text-sm font-black text-slate-800 dark:text-slate-100 truncate block w-full" title={cardItem.value}>
                                  {cardItem.value}
                                </span>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      </motion.button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Seção de Coordenadas Geográficas com 6 dígitos decimais exatos */}
            {featureCoords && (
              <div className="bg-black/5 dark:bg-white/5 rounded-2xl p-3.5 space-y-2.5">
                <div className="flex items-center justify-between">
                  <CopyableText
                    value={`${featureCoords.lat.toFixed(6)}, ${featureCoords.lng.toFixed(6)}`}
                    label="Coordenadas completas"
                    showToast={showToast}
                    className="p-1 -ml-1 text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400"
                    title="Clique para copiar par de coordenadas (lat, lng)"
                  >
                    <span className="flex items-center gap-1.5">
                      <Compass className="w-3.5 h-3.5 text-[#007AFF]" />
                      <span>Coordenadas Geográficas</span>
                    </span>
                  </CopyableText>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  {/* Latitude (6 dígitos) */}
                  <div className="p-2.5 bg-white dark:bg-[#2c2c2e] rounded-xl shadow-xs border border-black/5 dark:border-white/5">
                    <span className="text-[10px] text-slate-400 dark:text-slate-500 font-bold block mb-0.5">Latitude</span>
                    <CopyableText
                      value={featureCoords.lat.toFixed(6)}
                      label="Latitude"
                      showToast={showToast}
                      className="text-xs font-mono font-bold text-slate-800 dark:text-slate-100 truncate w-full px-1 py-0.5"
                    />
                  </div>

                  {/* Longitude (6 dígitos) */}
                  <div className="p-2.5 bg-white dark:bg-[#2c2c2e] rounded-xl shadow-xs border border-black/5 dark:border-white/5">
                    <span className="text-[10px] text-slate-400 dark:text-slate-500 font-bold block mb-0.5">Longitude</span>
                    <CopyableText
                      value={featureCoords.lng.toFixed(6)}
                      label="Longitude"
                      showToast={showToast}
                      className="text-xs font-mono font-bold text-slate-800 dark:text-slate-100 truncate w-full px-1 py-0.5"
                    />
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
                      <div className="flex items-center shrink-0 font-bold text-slate-800 dark:text-slate-200">
                        <CopyableText
                          value={prop.value}
                          label={prop.label}
                          showToast={showToast}
                          className="text-right truncate max-w-[190px] px-1.5 py-0.5"
                        />
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
              onSearchByRadius={(raio) => {
                if (activeCategorySearchId === 'hospitais') {
                  onSearchHospitaisByRadius?.(raio);
                } else {
                  onSearchCategoryByRadius?.(activeCategorySearchId, raio);
                }
              }}
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
                  className="w-full bg-transparent outline-none text-sm font-semibold text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={onAbandonSearch}
                    className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer touch-target-44"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Opção: Pesquisar apenas nas camadas ativas */}
              {can('allowSearchActiveLayersOnly') && (
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
              )}
            </div>

            {/* Categorias Apple: "Encontrar por tipo" (Screenshot 4) */}
            {!isSearchResultsVisible && can('allowSearchByType') && (
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
                          logActivity('BUSCA', `Busca rápida por categoria: ${cat.name}`, userRole);
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
                        <ChevronRight className="w-4 h-4 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
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
                  {recentSearches.map((item, idx) => {
                    const cat = item.categoryId ? getCategoryConfig(item.categoryId) : undefined;
                    const Icon = cat ? cat.icon : History;
                    const iconBg = cat ? cat.color : 'bg-black/10 dark:bg-white/10 text-slate-600 dark:text-slate-300';
                    const textColor = cat ? 'text-white' : '';
                    return (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => {
                          if (item.categoryId) {
                            setActiveCategorySearchId(item.categoryId as CategorySearchType);
                          } else {
                            setSearchQuery(item.term);
                            onSearch(item.term);
                          }
                        }}
                        className="w-full p-2 rounded-xl bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 transition-all flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-slate-200 cursor-pointer"
                      >
                        <div className="flex items-center gap-2.5 truncate">
                          <div className={`w-6 h-6 rounded-full ${iconBg} ${textColor} flex items-center justify-center shrink-0 shadow-xs`}>
                            <Icon className="w-3.5 h-3.5" />
                          </div>
                          <span className="truncate">{item.term}</span>
                        </div>
                        <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                      </button>
                    );
                  })}
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
            preferences={exportPrefs}
            onUpdatePreferences={updateExportPrefs}
          />
        )}

        {/* ============================================================== */}
        {/* ABA: RAIO-X TERRITORIAL E DOMICILIAR */}
        {/* ============================================================== */}
        {activeTab === 'dashboard' && (
          <div className="animate-fadeIn">
            <Dashboard 
              selectedFeatures={selectedFeatures} 
              showToast={showToast} 
              onSearchCategoryInFeatures={onSearchCategoryInFeatures}
              onSearchPolygonAddresses={onSearchPolygonAddresses}
              onOpenCnefeBottomBar={onOpenCnefeBottomBar}
              isSearching={isSearchingAddresses}
            />
          </div>
        )}

        {/* ============================================================== */}
        {/* ABA: GUIA DE USO E AJUDA (COMPARTILHADO VIA HelpTabContent)   */}
        {/* ============================================================== */}
        {activeTab === 'help' && (
          <div className="space-y-3 pb-6">
            <HelpTabContent />
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
    </>
  );

  if (isMobile) {
    const isDetailsAllowed = can('tool:feature_specs');
    const isDashboardAllowed = can('tool:raio_x');
    const isExportAllowed = can('tool:export_data');

    const isTabPermitted =
      activeTab === 'details' ? isDetailsAllowed :
      activeTab === 'dashboard' ? isDashboardAllowed :
      activeTab === 'export' ? isExportAllowed :
      true;

    const isSheetOpen = !!activeTab && activeTab !== 'profile' && isTabPermitted;
    const sheetTitle = 
      activeTab === 'search' 
        ? (activeCategorySearchId ? (CATEGORY_UI_META[activeCategorySearchId]?.title || 'Buscar') : 'Buscar')
        : activeTab === 'dashboard'
        ? 'Raio-X Territorial e Domiciliar'
        : activeTab === 'details'
        ? 'Detalhes da Feição'
        : activeTab === 'export'
        ? 'Exportar Feições'
        : activeTab === 'help'
        ? 'Guia de Uso & Ajuda'
        : '';

    const sheetIcon =
      activeTab === 'search' ? <Search className="w-5 h-5" /> :
      activeTab === 'dashboard' ? <Users className="w-5 h-5" /> :
      activeTab === 'details' ? <MapPin className="w-5 h-5" /> :
      activeTab === 'export' ? <Download className="w-5 h-5" /> :
      activeTab === 'help' ? <HelpCircle className="w-5 h-5" /> : null;

    if (!isSheetOpen) return null;

    const renderMobileDetailsHeaderExport = () => {
      if (activeTab !== 'details' || !activeDetailFeature) return null;

      return (
        <button
          type="button"
          disabled={exportButtonState !== 'idle'}
          onClick={handleExportButtonClick}
          className="w-11 h-11 min-w-[44px] min-h-[44px] flex items-center justify-center cursor-pointer active:scale-90 transition-transform disabled:opacity-50"
          title={exportPrefs.quickDownload && exportPrefs.format ? `Baixar seleção em ${(exportPrefs.format === 'csv' && getGeometryKind(selectedFeatures) === 'polygon' ? 'geojson' : exportPrefs.format).toUpperCase()}` : "Exportar feição"}
          aria-label="Exportar"
        >
          <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
            exportButtonState === 'success'
              ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
              : exportButtonState === 'error'
              ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30'
              : 'bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/15 text-slate-600 dark:text-slate-300'
          }`}>
            {exportButtonState === 'preparing' ? (
              <Loader2 className="w-4 h-4 animate-spin text-[#007AFF]" />
            ) : exportButtonState === 'success' ? (
              <Check className="w-4 h-4 stroke-[2.5] text-emerald-600 dark:text-emerald-400" />
            ) : exportButtonState === 'error' ? (
              <AlertTriangle className="w-4 h-4 text-rose-500" />
            ) : (
              <Download className="w-4 h-4 stroke-[2.2]" />
            )}
          </div>
        </button>
      );
    };

    return (
      <MobileSheet
        isOpen={isSheetOpen}
        activeTab={activeTab}
        onClose={() => {
          if (isCustomizerModalOpen) {
            setIsCustomizerModalOpen(false);
            setCustomizerLayer(null);
          }
          setOpenedFromSearch(false);
          setActiveCategorySearchId(null);
          // Raio-X e Detalhes: o botão X fecha a gaveta e desmarca as feições
          if (activeTab === 'dashboard' || activeTab === 'details') {
            onClearSelection();
          }
          setActiveTab(null);
        }}
        onDismiss={() => {
          if (isCustomizerModalOpen) {
            setIsCustomizerModalOpen(false);
            setCustomizerLayer(null);
          }
          setOpenedFromSearch(false);
          setActiveCategorySearchId(null);
          // Arrasto para baixo abaixo do limiar (onDismiss): fecha a gaveta SEM desmarcar feições
          setActiveTab(null);
        }}
        headerActions={renderMobileDetailsHeaderExport()}
        title={isCustomizerModalOpen ? undefined : sheetTitle}
        icon={isCustomizerModalOpen ? undefined : sheetIcon}
        snapPoint={isCustomizerModalOpen ? 'full' : (activeTab === 'help' || activeTab === 'export' ? 'full' : 'half')}
        hideHeader={isCustomizerModalOpen}
        noPadding={isCustomizerModalOpen}
      >
        <div className="relative w-full h-full min-h-full">
          <AnimatePresence initial={false} mode="wait">
            {isCustomizerModalOpen && can('tool:customize_useful_info') ? (
              <motion.div
                key="mobile-customizer-view"
                initial={{ x: '100%', opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: '100%', opacity: 0 }}
                transition={{ type: 'spring', damping: 32, stiffness: 380 }}
                className="w-full h-full flex flex-col"
              >
                <MobileFeatureInfoCustomizer
                  onClose={() => {
                    setIsCustomizerModalOpen(false);
                    setCustomizerLayer(null);
                  }}
                  availableOptions={usefulCardsCatalog.options}
                  allOptionsMap={usefulCardsCatalog.valuesMap}
                  selectedIds={getEffectiveCardIds(userKey, customizerLayer?.norm ?? normalizedLayer)}
                  historyIds={getLayerHistoryIds(userKey, customizerLayer?.norm ?? normalizedLayer)}
                  onSave={handleSaveUsefulCards}
                  onReset={handleResetUsefulCards}
                  maxItems={8}
                  layerName={customizerLayer?.name || activeLayerName}
                />
              </motion.div>
            ) : (
              <motion.div
                key="mobile-stage2-view"
                initial={{ x: '-15%', opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: '-15%', opacity: 0 }}
                transition={{ type: 'spring', damping: 32, stiffness: 380 }}
                className="space-y-4 p-4 pb-[calc(env(safe-area-inset-bottom,0px)+72px)]"
              >
                {renderStage2Body()}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </MobileSheet>
    );
  }

  return (
    <aside 
      aria-label="Barra de Ferramentas Estilo Apple Maps"
      data-stage2-open={!!activeTab}
      className="relative z-[1050] h-full flex shrink-0 select-none font-sans"
    >
      {/* ============================================================== */}
      {/* ESTÁGIO 1: BARRA / RAIL DE NAVEGAÇÃO LATERAL (APPLE SIDEBAR)   */}
      {/* ============================================================== */}
      <nav
        className={`h-full flex flex-col sidebar-ios-transition border-r border-black/10 dark:border-white/10 shadow-xl overflow-hidden overflow-x-hidden select-none shrink-0 p-3 ${
          isAnimating 
            ? 'bg-white/95 dark:bg-[#1c1c1e]/95 backdrop-blur-md' 
            : 'bg-white/90 dark:bg-[#1c1c1e]/90 backdrop-blur-3xl'
        } ${
          isCollapsed ? 'w-[68px]' : 'w-[205px] sm:w-[215px]'
        }`}
      >
        {/* Topo / Header da Barra de Navegação */}
        <div className="flex items-center justify-between pb-3 mb-2 border-b border-black/5 dark:border-white/10 w-full shrink-0 h-12">
          <div className={`transition-all duration-300 ease-out overflow-hidden whitespace-nowrap ${
            isCollapsed ? 'opacity-0 max-w-0 -translate-x-3 pointer-events-none' : 'opacity-100 max-w-[150px] translate-x-0 flex-1 min-w-0'
          }`}>
            <AppLogo
              isDarkMode={isDarkMode}
              variant="sidebar"
              onDoubleClick={() => {
                if (can('admin:panel:access') || isMaster) {
                  onOpenAdminPanel();
                } else {
                  guardAction('admin:panel:access', 'abrir o painel administrativo', onOpenAdminPanel);
                }
              }}
              title="WebGis SSP-PI • Clique duplo para painel de controle"
            />
          </div>

          <button
            type="button"
            onClick={onToggleCollapse}
            className={`w-9 h-9 rounded-xl flex items-center justify-center text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10 active:scale-95 transition-colors cursor-pointer shrink-0 ${
              isCollapsed ? 'mx-auto' : ''
            }`}
            title={isCollapsed ? "Expandir barra lateral" : "Minimizar barra lateral para ícones"}
            aria-label={isCollapsed ? "Expandir barra lateral" : "Minimizar barra lateral"}
          >
            <PanelLeft className="w-5 h-5 text-[#007AFF]" />
          </button>
        </div>

        {/* Lista de Ferramentas (Estágio 1 - Imagem 1 e Imagem 3) */}
        <div className="flex flex-col gap-2 w-full flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar">
          {/* 1. Buscar */}
          <div className="relative group w-full flex items-center">
            <button
              type="button"
              onClick={() => setActiveTab(activeTab === 'search' ? null : 'search')}
              className={`w-full h-11 flex items-center rounded-2xl font-bold transition-colors cursor-pointer px-1 ${
                activeTab === 'search'
                  ? 'bg-[#007AFF] text-white shadow-lg shadow-blue-500/25'
                  : 'text-slate-800 dark:text-slate-200 hover:bg-black/5 dark:hover:bg-white/10'
              }`}
              title={isCollapsed ? "Buscar" : undefined}
            >
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
                activeTab === 'search' 
                  ? 'bg-white/20 text-white' 
                  : 'bg-black/5 dark:bg-white/10 text-slate-700 dark:text-slate-300 group-hover:text-[#007AFF]'
              }`}>
                <Search className="w-4.5 h-4.5" />
              </div>
              <div className={`flex items-center min-w-0 transition-all duration-300 ease-out overflow-hidden whitespace-nowrap pl-2.5 ${
                isCollapsed ? 'opacity-0 max-w-0 -translate-x-2 pointer-events-none' : 'opacity-100 max-w-[140px] translate-x-0'
              }`}>
                <span className="truncate text-sm font-bold">Buscar</span>
              </div>
            </button>
          </div>

          {/* 2. Raio-X */}
          {can('allowDashboardRaioX') && (
            <div className="relative group w-full flex items-center">
              <button
                type="button"
                onClick={() => setActiveTab(activeTab === 'dashboard' ? null : 'dashboard')}
                className={`w-full h-11 flex items-center rounded-2xl font-bold transition-colors cursor-pointer px-1 ${
                  activeTab === 'dashboard'
                    ? 'bg-[#007AFF] text-white shadow-lg shadow-blue-500/25'
                    : 'text-slate-800 dark:text-slate-200 hover:bg-black/5 dark:hover:bg-white/10'
                }`}
                title={isCollapsed ? "Raio-X Territorial e Domiciliar" : undefined}
              >
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
                  activeTab === 'dashboard' 
                    ? 'bg-white/20 text-white' 
                    : 'bg-black/5 dark:bg-white/10 text-slate-700 dark:text-slate-300 group-hover:text-[#34C759]'
                }`}>
                  <Users className="w-4.5 h-4.5" />
                </div>
                <div className={`flex items-center min-w-0 transition-all duration-300 ease-out overflow-hidden whitespace-nowrap pl-2.5 ${
                  isCollapsed ? 'opacity-0 max-w-0 -translate-x-2 pointer-events-none' : 'opacity-100 max-w-[140px] translate-x-0'
                }`}>
                  <span className="truncate text-sm font-bold">Raio-X</span>
                </div>
              </button>
            </div>
          )}

          {/* 3. Detalhes (Permanente na barra lateral) */}
          {can('allowFeatureSpecs') && (
            <div className="relative group w-full flex items-center">
              <button
                type="button"
                onClick={() => {
                  setOpenedFromSearch(false);
                  setActiveTab(activeTab === 'details' ? null : 'details');
                }}
                className={`w-full h-11 flex items-center rounded-2xl font-bold transition-colors cursor-pointer px-1 ${
                  activeTab === 'details'
                    ? 'bg-[#007AFF] text-white shadow-lg shadow-blue-500/25'
                    : 'text-slate-800 dark:text-slate-200 hover:bg-black/5 dark:hover:bg-white/10'
                }`}
                title={isCollapsed ? "Detalhes da Feição" : undefined}
              >
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
                  activeTab === 'details' ? 'bg-white/20 text-white' : 'bg-amber-500/10 text-[#FF9500]'
                }`}>
                  <MapPin className="w-4.5 h-4.5" />
                </div>
                <div className={`flex items-center min-w-0 flex-1 transition-all duration-300 ease-out overflow-hidden whitespace-nowrap pl-2.5 ${
                  isCollapsed ? 'opacity-0 max-w-0 -translate-x-2 pointer-events-none' : 'opacity-100 max-w-[140px] translate-x-0'
                }`}>
                  <span className="truncate text-sm font-bold">Detalhes</span>
                  {hasFeature && (
                    <span className="ml-auto mr-1 w-2 h-2 rounded-full bg-[#FF9500] animate-ping" />
                  )}
                </div>
              </button>
            </div>
          )}

          {/* 4. Exportar (Permanente na barra lateral) */}
          {can('allowExportData') && (
            <div className="relative group w-full flex items-center">
              <button
                type="button"
                onClick={() => {
                  setOpenedFromSearch(false);
                  setActiveTab(activeTab === 'export' ? null : 'export');
                }}
                className={`w-full h-11 flex items-center rounded-2xl font-bold transition-colors cursor-pointer px-1 ${
                  activeTab === 'export'
                    ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-sm'
                    : 'text-slate-800 dark:text-slate-200 hover:bg-black/5 dark:hover:bg-white/10'
                }`}
                title={isCollapsed ? "Exportar Dados" : undefined}
              >
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
                  activeTab === 'export'
                    ? 'bg-white/20 text-white dark:bg-slate-900/20 dark:text-slate-900'
                    : 'bg-black/5 dark:bg-white/10 text-slate-700 dark:text-slate-200'
                }`}>
                  <Download className="w-4.5 h-4.5" />
                </div>
                <div className={`flex items-center min-w-0 transition-all duration-300 ease-out overflow-hidden whitespace-nowrap pl-2.5 ${
                  isCollapsed ? 'opacity-0 max-w-0 -translate-x-2 pointer-events-none' : 'opacity-100 max-w-[140px] translate-x-0'
                }`}>
                  <span className="truncate text-sm font-bold">Exportar</span>
                </div>
              </button>
            </div>
          )}

          {/* Atalhos para Buscas Recentes na Barra Lateral Recolhida */}
          {recentSearches && recentSearches.length > 0 && (
            <div 
              className={`transition-all duration-300 ease-out overflow-hidden flex flex-col items-center gap-1.5 w-full ${
                isCollapsed ? 'opacity-100 max-h-48 pt-1' : 'opacity-0 max-h-0 pointer-events-none'
              }`}
            >
              <div className="w-8 h-px bg-black/10 dark:bg-white/10 my-1 mx-auto" />
              {recentSearches.slice(0, 3).map((item, idx) => {
                const cat = item.categoryId ? getCategoryConfig(item.categoryId) : undefined;
                const Icon = cat ? cat.icon : History;
                const label = item.term;
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      setOpenedFromSearch(false);
                      setActiveTab('search');
                      if (item.categoryId) {
                        setActiveCategorySearchId(item.categoryId as CategorySearchType);
                      } else {
                        setSearchQuery(item.term);
                        onSearch(item.term);
                      }
                    }}
                    className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all cursor-pointer ${
                      cat 
                        ? `${cat.color} text-white hover:opacity-90 shadow-sm` 
                        : 'bg-black/5 dark:bg-white/10 text-slate-700 dark:text-slate-200 hover:bg-black/10 dark:hover:bg-white/20'
                    }`}
                    title={`Busca recente: ${label}`}
                  >
                    <Icon className="w-4 h-4" />
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Rodapé do Estágio 1 */}
        <div className="pt-3 border-t border-black/5 dark:border-white/10 shrink-0 w-full flex flex-col gap-2">
          {/* Cartão de Perfil / Botão de Usuário */}
          <div className="flex items-center gap-2 p-1 rounded-2xl bg-black/5 dark:bg-white/5 w-full">
            <button
              type="button"
              onClick={onOpenProfileModal}
              className="flex items-center gap-2 min-w-0 text-left cursor-pointer group flex-1"
              title="Perfil de Usuário"
            >
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                isMaster ? 'bg-amber-500 text-white' : isManager ? 'bg-indigo-600 text-white' : 'bg-slate-300 dark:bg-slate-700 text-slate-800 dark:text-slate-200'
              }`}>
                {isMaster ? <Crown className="w-4.5 h-4.5" /> : isManager ? <Briefcase className="w-4.5 h-4.5" /> : <User className="w-4.5 h-4.5" />}
              </div>
              <div className={`min-w-0 flex-1 transition-all duration-300 ease-out overflow-hidden whitespace-nowrap ${
                isCollapsed ? 'opacity-0 max-w-0 -translate-x-2 pointer-events-none' : 'opacity-100 max-w-[120px] translate-x-0'
              }`}>
                <span className="text-xs font-bold text-slate-900 dark:text-white truncate block group-hover:text-[#007AFF] transition-colors">
                  {currentActiveUser ? currentActiveUser.name : 'Visitante'}
                </span>
                <span className="text-[10px] text-slate-400 font-medium truncate block">
                  {isMaster ? 'Master' : isManager ? 'Gerente' : 'Conta Padrão'}
                </span>
              </div>
            </button>

            {/* Ações de Painel Admin, Modo Escuro e Sair (visíveis no card quando expandido) */}
            <div className={`items-center gap-1 shrink-0 transition-all duration-300 ease-out overflow-hidden ${
              isCollapsed ? 'opacity-0 max-w-0 pointer-events-none hidden' : 'opacity-100 max-w-[120px] flex'
            }`}>
              {(isMaster || isManager) && (
                <button
                  type="button"
                  onClick={onOpenAdminPanel}
                  className="p-1.5 rounded-xl bg-black/5 dark:bg-white/10 hover:bg-[#007AFF]/15 hover:text-[#007AFF] text-slate-700 dark:text-slate-300 cursor-pointer transition-colors touch-target-44"
                  title="Painel Administrativo"
                  aria-label="Abrir Painel Administrativo"
                >
                  <Settings className="w-4 h-4" />
                </button>
              )}

              <button
                type="button"
                onClick={(e) => onToggleDarkMode(e)}
                className="p-1.5 rounded-xl bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/15 text-slate-700 dark:text-slate-300 cursor-pointer transition-colors touch-target-44"
                title={isDarkMode ? "Modo Claro" : "Modo Escuro"}
                aria-label={isDarkMode ? "Modo Claro" : "Modo Escuro"}
              >
                <motion.div
                  key={isDarkMode ? 'dark' : 'light'}
                  initial={{ rotate: -45, opacity: 0, scale: 0.8 }}
                  animate={{ rotate: 0, opacity: 1, scale: 1 }}
                  transition={{ duration: 0.3 }}
                >
                  {isDarkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4" />}
                </motion.div>
              </button>

              <button
                type="button"
                onClick={onLogout}
                className="p-1.5 rounded-xl bg-black/5 dark:bg-white/10 hover:bg-red-500/10 hover:text-red-500 text-slate-400 dark:text-slate-500 cursor-pointer transition-colors touch-target-44"
                title="Sair"
                aria-label="Sair"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Botão de Painel Admin (Engrenagem) quando Recolhido */}
          {(isMaster || isManager) && (
            <div className={`transition-all duration-300 ease-out flex items-center justify-center w-full ${
              isCollapsed ? 'opacity-100 max-h-12' : 'opacity-0 max-h-0 pointer-events-none overflow-hidden'
            }`}>
              <button
                type="button"
                onClick={onOpenAdminPanel}
                className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-[#007AFF]/15 hover:text-[#007AFF] transition-colors cursor-pointer"
                title="Painel Administrativo"
                aria-label="Abrir Painel Administrativo"
              >
                <Settings className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Botão de Modo Escuro Isolado quando Recolhido */}
          <div className={`transition-all duration-300 ease-out flex items-center justify-center w-full ${
            isCollapsed ? 'opacity-100 max-h-12' : 'opacity-0 max-h-0 pointer-events-none overflow-hidden'
          }`}>
            <button
              type="button"
              onClick={(e) => onToggleDarkMode(e)}
              className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-black/5 dark:hover:bg-white/10 transition-colors cursor-pointer"
              title={isDarkMode ? "Modo Claro" : "Modo Escuro"}
              aria-label={isDarkMode ? "Modo Claro" : "Modo Escuro"}
            >
              <motion.div
                key={isDarkMode ? 'dark' : 'light'}
                initial={{ rotate: -45, opacity: 0, scale: 0.8 }}
                animate={{ rotate: 0, opacity: 1, scale: 1 }}
                transition={{ duration: 0.3 }}
              >
                {isDarkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4" />}
              </motion.div>
            </button>
          </div>

          {/* Links de Rodapé (WebGIS / Ajuda) */}
          <div className={`items-center justify-between text-[11px] text-slate-400 px-1 transition-all duration-300 ease-out overflow-hidden whitespace-nowrap ${
            isCollapsed ? 'opacity-0 max-h-0 pointer-events-none' : 'opacity-100 max-h-6 flex'
          }`}>
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
      </nav>

      {/* ============================================================== */}
      {/* ESTÁGIO 2: PAINEL DA FERRAMENTA SELECIONADA (SEGUNDO ESTÁGIO)  */}
      {/* ============================================================== */}
      {activeTab && (
        <div
          className={`absolute left-full top-0 bottom-0 h-full w-[360px] sm:w-[390px] max-w-[calc(100vw-72px)] flex flex-col transition-all duration-300 ease-out border-r border-black/10 dark:border-white/10 shadow-2xl overflow-hidden z-40 animate-fadeIn ${
            isAnimating 
              ? 'bg-white/98 dark:bg-[#1c1c1e]/98 backdrop-blur-md' 
              : 'bg-white/95 dark:bg-[#1c1c1e]/95 backdrop-blur-3xl'
          }`}
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
              title={activeTab === 'details' ? "Recolher painel (a feição continua selecionada)" : "Recolher painel"}
              aria-label={activeTab === 'details' ? "Recolher painel (a feição continua selecionada)" : "Recolher painel"}
            >
              <PanelLeftClose className="w-4 h-4 text-[#007AFF]" />
            </button>
          </div>

          {/* Conteúdo rolável do painel */}
          <div className="flex-1 overflow-y-auto custom-scrollbar p-3 sm:p-4 space-y-4">
            {renderStage2Body()}
          </div>

          {/* Painel de Personalização de Informações Úteis (acoplado dentro do Estágio 2 da barra lateral, sem cobrir o mapa) */}
          <AnimatePresence>
            {isCustomizerModalOpen && can('tool:customize_useful_info') && (
              <FeatureInfoCustomizerModal
                isOpen={isCustomizerModalOpen}
                onClose={() => {
                  setIsCustomizerModalOpen(false);
                  setCustomizerLayer(null);
                }}
                availableOptions={usefulCardsCatalog.options}
                allOptionsMap={usefulCardsCatalog.valuesMap}
                selectedIds={getEffectiveCardIds(userKey, customizerLayer?.norm ?? normalizedLayer)}
                historyIds={getLayerHistoryIds(userKey, customizerLayer?.norm ?? normalizedLayer)}
                onSave={handleSaveUsefulCards}
                onReset={handleResetUsefulCards}
                maxItems={8}
                layerName={customizerLayer?.name || activeLayerName}
              />
            )}
          </AnimatePresence>
        </div>
      )}
    </aside>
  );
};

export const AppleSidebar = React.memo(AppleSidebarInner);
AppleSidebar.displayName = 'AppleSidebar';
