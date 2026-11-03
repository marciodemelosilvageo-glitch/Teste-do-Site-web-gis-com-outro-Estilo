import { useState, useEffect, useRef, useMemo, useCallback, lazy, Suspense } from 'react';
import { 
  Search, 
  X, 
  HelpCircle, 
  MousePointerClick, 
  ZoomIn, 
  Trash2, 
  ChevronDown, 
  ChevronUp, 
  MapPin, 
  Info,
  Check, Sun, Moon, Printer,
  Star, History,
  ShieldCheck, KeyRound, Lock, LogOut, User, Eye, EyeOff, SlidersHorizontal, ShieldAlert,
  UserCheck, UserPlus, Crown, Briefcase, AlertTriangle, Loader2,
  Download, Table2, ExternalLink, PanelLeft, PanelLeftClose
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import L from 'leaflet';

import { MapComponent } from './components/MapComponent';
import { IbgeSearchPanel, ExternalPolygonSearchResult } from './components/IbgeSearchPanel';
import { PropertyTable } from './components/PropertyTable';
import { AppleSidebar, SidebarTab } from './components/AppleSidebar';
import { CnefeBottomBar } from './components/CnefeBottomBar';
import Globe from './components/Globe';
import { SelectedFeature, GroupedSearchResults, SearchResultItem } from './types';
import { dataSources, PRIORITY_KEYS, propertyNames, DEFAULT_ACTIVE_LAYERS } from './data';
import { normalizeString, levenshteinDistance, getIdentifier, getTranslatedValue, haversineDistanceMeters, toTitleCase } from './utils';
import { buscarEnderecosPorPoligono, buscarEnderecosPorLocalidade, buscarEnderecosPorEspecie, buscarEnderecosPorRaio, listarMunicipios } from './duckdb';

// Carregamento sob demanda (Lazy Loading) para componentes pesados
const AdminPanelModal = lazy(() => import('./components/AdminPanelModal').then(m => ({ default: m.AdminPanelModal })));
const UserProfileModal = lazy(() => import('./components/UserProfileModal').then(m => ({ default: m.UserProfileModal })));
import { 
  UserRole, 
  FeaturePermissions, 
  RegisteredUser,
  getSessionId,
  getLayerPermissions, 
  getFeaturePermissions, 
  getAddressColumnsPermissions,
  getFeaturePropertiesPermissions,
  getEffectiveUserPermissions,
  getCurrentActiveUser,
  setCurrentActiveUser,
  getLastLoggedInUser,
  setLastLoggedInUser,
  authenticateRegisteredUser,
  authenticateRegisteredUserAsync,
  findRegisteredUserByLoginOrNameAsync,
  saveRegisteredUser,
  sanitizeUsername,
  getRegisteredUsers,
  saveUserSessionConfig,
  logActivity, 
  initAdminService
} from './services/adminService';

import booleanPointInPolygon from '@turf/boolean-point-in-polygon';
import { point } from '@turf/helpers';

// Gerenciamento de Logos do Sistema (A logo da gerência fica preservada aqui)
export const SYSTEM_LOGOS = {
  gerencia: "https://raw.githubusercontent.com/marciodemelosilvageo-glitch/GeoCode/main/logo/Nova%20logo.png",
  teste: "https://raw.githubusercontent.com/marciodemelosilvageo-glitch/GeoCode/main/logo/ChatGPT%20Image%209%20de%20ago.%20de%202026%2C%2017_43_35.png"
};

// Logo ativa no cabeçalho e na tela de entrada do aplicativo
const CURRENT_APP_LOGO = SYSTEM_LOGOS.gerencia;

export default function App() {
  const [hasEntered, setHasEntered] = useState<boolean>(() => {
    return !!getCurrentActiveUser();
  });

  // Identificação do Visitante / Nome e Senha Opcional na Tela Inicial
  const [visitorNameInput, setVisitorNameInput] = useState<string>('');
  const [visitorPasswordInput, setVisitorPasswordInput] = useState<string>('');
  const [showVisitorPassword, setShowVisitorPassword] = useState<boolean>(false);
  const [welcomeError, setWelcomeError] = useState<string | null>(null);
  const [isWelcomeSubmitting, setIsWelcomeSubmitting] = useState<boolean>(false);
  const [detectedExistingUser, setDetectedExistingUser] = useState<RegisteredUser | null>(null);
  const [isCheckingWelcomeName, setIsCheckingWelcomeName] = useState<boolean>(false);

  // Usuário Credenciado Ativo (Login com senha)
  const [currentActiveUser, setCurrentActiveUserState] = useState<RegisteredUser | null>(() => getCurrentActiveUser());
  const [lastPreviousUser, setLastPreviousUser] = useState<RegisteredUser | null>(() => getLastLoggedInUser());
  const [promptPasswordForPreviousUser, setPromptPasswordForPreviousUser] = useState<boolean>(false);
  const [previousUserPasswordInput, setPreviousUserPasswordInput] = useState<string>('');
  const [showPreviousUserPassword, setShowPreviousUserPassword] = useState<boolean>(false);
  const [previousUserError, setPreviousUserError] = useState<string | null>(null);
  const [isPreviousUserSubmitting, setIsPreviousUserSubmitting] = useState<boolean>(false);

  const [isUserLoginModalOpen, setIsUserLoginModalOpen] = useState<boolean>(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState<boolean>(false);
  const [userLoginInput, setUserLoginInput] = useState<string>('');
  const [userPasswordInput, setUserPasswordInput] = useState<string>('');
  const [showUserPassword, setShowUserPassword] = useState<boolean>(false);
  const [userLoginError, setUserLoginError] = useState<string | null>(null);
  const [isUserLoginSubmitting, setIsUserLoginSubmitting] = useState<boolean>(false);

  // Estados de Autenticação e Perfis (ADM vs Usuário Comum)
  const [userRole, setUserRole] = useState<UserRole>(() => {
    const active = getCurrentActiveUser();
    if (active) {
      return (active.role === 'master' || (active.role as string) === 'admin') ? 'master' : (active.role === 'manager' ? 'manager' : 'user');
    }
    return 'user';
  });
  const [isAdminModalOpen, setIsAdminModalOpen] = useState<boolean>(false);
  
  // Controle de Simulação Exclusivo do Master
  const [isSimulatingUser, setIsSimulatingUser] = useState<boolean>(false);
  const [simulatedRole, setSimulatedRole] = useState<'user' | 'manager'>('user');
  const [simulatedTargetUser, setSimulatedTargetUser] = useState<RegisteredUser | null>(null);
  const [simulatedSessionId, setSimulatedSessionId] = useState<string | null>(null);
  const [isSimulationChoiceModalOpen, setIsSimulationChoiceModalOpen] = useState<boolean>(false);
  const [simulatedSelectedUserId, setSimulatedSelectedUserId] = useState<string>('');

  // Sessão atual
  const currentSessionId = useMemo(() => getSessionId(), []);

  // Identifica se o usuário autenticado na sessão é o Master Dono do Sistema
  const isRealMaster = (currentActiveUser?.role === 'master' || (currentActiveUser?.role as string) === 'admin') || (userRole === 'master' || (userRole as string) === 'admin');

  // Permissões Globais e Individuais Efetivas
  const [layerPermissions, setLayerPermissions] = useState<Record<string, boolean>>(() => {
    return getLayerPermissions(dataSources.map(s => s.name));
  });

  const [featurePermissions, setFeaturePermissions] = useState<FeaturePermissions>(() => {
    return getFeaturePermissions();
  });

  const [effectiveSession, setEffectiveSession] = useState(() => {
    return getEffectiveUserPermissions(currentSessionId, dataSources.map(s => s.name));
  });

  // Papéis e permissões efetivas para a visualização ativa na tela
  const isMaster = isRealMaster && !isSimulatingUser;
  const isManager = (userRole === 'manager' || (isRealMaster && isSimulatingUser && simulatedRole === 'manager')) && !isMaster;
  const isAdmin = isMaster;

  const refreshPermissions = useCallback(() => {
    const effectiveActiveUser = isSimulatingUser 
      ? (simulatedTargetUser || null) 
      : currentActiveUser;

    const targetSessionId = (isRealMaster && isSimulatingUser && simulatedSessionId)
      ? simulatedSessionId
      : currentSessionId;
    const eff = getEffectiveUserPermissions(targetSessionId, dataSources.map(s => s.name), effectiveActiveUser);
    setEffectiveSession(eff);
    setLayerPermissions(eff.layerPermissions);
    setFeaturePermissions(eff.featurePermissions);
  }, [currentSessionId, isRealMaster, isSimulatingUser, simulatedSessionId, simulatedTargetUser, currentActiveUser]);

  const handleStartSimulation = (
    role: 'user' | 'manager',
    targetUser?: RegisteredUser | null,
    sessionId?: string | null
  ) => {
    setIsSimulatingUser(true);
    setSimulatedRole(role);
    setSimulatedTargetUser(targetUser || null);
    setSimulatedSessionId(sessionId || (targetUser ? targetUser.id : null));
    setIsSimulationChoiceModalOpen(false);
    setIsAdminModalOpen(false);
    setActiveLayers(DEFAULT_ACTIVE_LAYERS);

    if (role === 'manager') {
      showToast('👔 Modo de simulação ativado: Visualizando o WebGIS como Gerente');
    } else if (targetUser) {
      showToast(`👤 Modo de simulação ativado: Visualizando como @${targetUser.username}`);
    } else {
      showToast('👁️ Modo de simulação ativado: Visualizando como Visitante Comum');
    }
  };

  const handleExitSimulation = () => {
    setIsSimulatingUser(false);
    setSimulatedRole('user');
    setSimulatedTargetUser(null);
    setSimulatedSessionId(null);
    setIsSimulationChoiceModalOpen(false);
    setActiveLayers(DEFAULT_ACTIVE_LAYERS);
    showToast('👑 Retornado com sucesso para a visão de Administrador Master!');
  };

  useEffect(() => {
    initAdminService(true);
    refreshPermissions();
    const handlePermissionsUpdated = () => {
      refreshPermissions();
    };
    window.addEventListener('webgis_permissions_updated', handlePermissionsUpdated);
    return () => {
      window.removeEventListener('webgis_permissions_updated', handlePermissionsUpdated);
    };
  }, [isSimulatingUser, simulatedSessionId, simulatedRole, refreshPermissions]);

  // Lista de camadas autorizadas para o perfil ativo
  const allowedLayerNames = useMemo(() => {
    if (isSimulatingUser && simulatedTargetUser?.customLayerPermissions) {
      return dataSources
        .filter(s => simulatedTargetUser.customLayerPermissions?.[s.name] !== false)
        .map(s => s.name);
    }
    return dataSources
      .filter(s => (layerPermissions[s.name] !== false) && (effectiveSession.layerPermissions[s.name] !== false))
      .map(s => s.name);
  }, [isSimulatingUser, simulatedTargetUser, layerPermissions, effectiveSession.layerPermissions]);

  // Configurações de Camadas e Seleção
  const [selectedFeatures, setSelectedFeatures] = useState<SelectedFeature[]>([]);
  const [isMultiSelectMode, setIsMultiSelectMode] = useState<boolean>(false);
  const [activeLayers, setActiveLayers] = useState<string[]>(() => {
    return DEFAULT_ACTIVE_LAYERS;
  });

  const prevAllowedLayersRef = useRef<string[]>(allowedLayerNames);

  // Garantir estritamente que camadas desativadas sejam removidas E camadas reativadas voltem automaticamente às camadas ativas (apenas as padrão)
  useEffect(() => {
    if (allowedLayerNames) {
      const prevAllowed = prevAllowedLayersRef.current || [];
      const newlyAllowed = allowedLayerNames.filter(name => !prevAllowed.includes(name));
      prevAllowedLayersRef.current = allowedLayerNames;

      setActiveLayers(prev => {
        // Remove qualquer camada que o usuário não tenha permissão de ver
        const filtered = prev.filter(name => allowedLayerNames.includes(name));
        
        // Se uma camada PADRÃO do sistema foi reativada, reativa nas camadas ativas
        // NUNCA ativa automaticamente camadas extras (como AISP, RISP, Áreas de Desenvolvimento)
        if (newlyAllowed.length > 0) {
          const defaultToAdd = newlyAllowed.filter(
            name => DEFAULT_ACTIVE_LAYERS.includes(name) && !filtered.includes(name)
          );
          return [...filtered, ...defaultToAdd];
        }
        return filtered.length === prev.length ? prev : filtered;
      });

      setSelectedFeatures(prev => {
        const filtered = prev.filter(feat => !feat.sourceName || allowedLayerNames.includes(feat.sourceName));
        return filtered.length === prev.length ? prev : filtered;
      });
    }
  }, [allowedLayerNames]);
  const [mapInstance, setMapInstance] = useState<L.Map | null>(null);
  const [searchCoordinates, setSearchCoordinates] = useState<Array<{ lat: number; lng: number; label?: string; details?: string[]; isCoordSearch?: boolean; rawAddress?: any }> | null>(null);

  // Estados de Carregamento e Status do Mapa
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [statusText, setStatusText] = useState<string>('Carregando dados...');

  // Controle de Caixa de Busca
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [searchActiveLayersOnly, setSearchActiveLayersOnly] = useState<boolean>(false);
  const [isSearchLoading, setIsSearchLoading] = useState<boolean>(false);
  const [searchResults, setSearchResults] = useState<GroupedSearchResults>({});
  const [isSearchResultsVisible, setIsSearchResultsVisible] = useState<boolean>(false);
  const [totalResultsCount, setTotalResultsCount] = useState<number>(0);
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});

  // Pesquisas Recentes e Salvas (Persistidos no localStorage)
  const [recentSearches, setRecentSearches] = useState<string[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('recent_searches');
        if (saved) return JSON.parse(saved);
      } catch (e) {
        console.error('Erro ao ler pesquisas recentes:', e);
      }
    }
    return [];
  });

  const [savedSearches, setSavedSearches] = useState<string[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('saved_searches');
        if (saved) return JSON.parse(saved);
      } catch (e) {
        console.error('Erro ao ler pesquisas salvas:', e);
      }
    }
    return [];
  });

  const addRecentSearch = (term: string) => {
    const trimmed = term.trim();
    if (!trimmed) return;
    setRecentSearches(prev => {
      const filtered = prev.filter(item => item.toLowerCase() !== trimmed.toLowerCase());
      const updated = [trimmed, ...filtered].slice(0, 3);
      try {
        localStorage.setItem('recent_searches', JSON.stringify(updated));
      } catch (e) {}
      return updated;
    });
  };

  const toggleSaveSearch = (term: string) => {
    const trimmed = term.trim();
    if (!trimmed) return;
    setSavedSearches(prev => {
      const exists = prev.some(item => item.toLowerCase() === trimmed.toLowerCase());
      let updated: string[];
      if (exists) {
        updated = prev.filter(item => item.toLowerCase() !== trimmed.toLowerCase());
        showToast(`"${trimmed}" removida dos favoritos.`);
      } else {
        updated = [trimmed, ...prev];
        showToast(`"${trimmed}" salva nos favoritos!`);
      }
      try {
        localStorage.setItem('saved_searches', JSON.stringify(updated));
      } catch (e) {}
      return updated;
    });
  };

  const removeSavedSearch = (term: string) => {
    setSavedSearches(prev => {
      const updated = prev.filter(item => item.toLowerCase() !== term.toLowerCase());
      try {
        localStorage.setItem('saved_searches', JSON.stringify(updated));
      } catch (e) {}
      showToast(`"${term}" removida dos favoritos.`);
      return updated;
    });
  };

  // Controle do Modal de Ajuda e Notificações (Toast)
  const [isHelpOpen, setIsHelpOpen] = useState<boolean>(false);

  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('theme');
      if (saved) return saved === 'dark';
      return false;
    }
    return false;
  });

  const [isPrintMode, setIsPrintMode] = useState<boolean>(false);
  const [printTitle, setPrintTitle] = useState<string>('Mapa Temático');
  const [printOrientation, setPrintOrientation] = useState<'portrait' | 'landscape'>('landscape');
  const [printFontFamily, setPrintFontFamily] = useState<string>('font-sans');
  const [printFontSize, setPrintFontSize] = useState<number>(36);

  // Estados de layout estilo Apple Maps (maps.apple.com)
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(false);
  const [sidebarTab, setSidebarTab] = useState<SidebarTab>(null);
  const [isFullTableModalOpen, setIsFullTableModalOpen] = useState<boolean>(false);
  const [isHospitalSearching, setIsHospitalSearching] = useState(false);
  const [cnefeMunicipios, setCnefeMunicipios] = useState<string[]>([]);

  // Carregar lista de municípios do CNEFE para o modal de busca
  useEffect(() => {
    listarMunicipios().then(muns => {
      if (muns && muns.length > 0) {
        setCnefeMunicipios(muns);
      }
    }).catch(err => {
      console.warn('Não foi possível carregar municípios antecipadamente:', err);
    });
  }, []);
  const [isCnefeBottomBarOpen, setIsCnefeBottomBarOpen] = useState<boolean>(true);
  const [isCnefeBottomBarExpanded, setIsCnefeBottomBarExpanded] = useState<boolean>(false);
  const [isCnefeBottomBarMaximized, setIsCnefeBottomBarMaximized] = useState<boolean>(false);

  // Abrir aba de Detalhes no estilo Apple Maps quando uma feição for selecionada no mapa,
  // mas se o usuário já estiver na ferramenta Raio-X (dashboard), permanece nela!
  // E quando o usuário desmarcar a feição (nada selecionado), fecha o painel de detalhes.
  useEffect(() => {
    if (selectedFeatures.length > 0) {
      const isOnlyLocalidades = selectedFeatures.every(f => {
        const src = (f.sourceName || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        if (src.includes('localidade')) return true;
        const props = f.properties || {};
        return props.id_Localidades != null || props.id_localidades != null || (props.Localidade && !props.NM_BAIRRO && !props.NM_MUN);
      });

      if (isOnlyLocalidades) {
        setSidebarTab('details');
      } else {
        setSidebarTab(prev => (prev === 'dashboard' ? 'dashboard' : 'details'));
      }
    } else {
      // Mantem a aba selecionada sem fechar bruscamente
    }
  }, [selectedFeatures]);

  const [measureHistory, setMeasureHistory] = useState<L.LatLng[] | null>(null);

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDarkMode]);

  // Prevenir que o site e mapa de fundo rolem quando qualquer modal estiver aberto
  useEffect(() => {
    const isAnyModalOpen = isAdminModalOpen || isHelpOpen || isUserLoginModalOpen || isProfileModalOpen;
    if (isAnyModalOpen) {
      document.body.style.overflow = 'hidden';
      document.documentElement.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
      document.documentElement.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
      document.documentElement.style.overflow = '';
    };
  }, [isAdminModalOpen, isHelpOpen, isUserLoginModalOpen, isProfileModalOpen, hasEntered]);

  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const toastTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Referência para ações de mapa cruzadas
  const mapActionsRef = useRef<{
    loadLayerByName: (name: string) => Promise<L.GeoJSON>;
    searchLayerByName?: (name: string, anchor: string, num: string | null, localities: string[]) => Promise<L.GeoJSON>;
    zoomToFeature: (layer: L.Layer) => void;
    selectFeature: (layer: L.Layer, feature: any, sourceName: string) => void;
    removeMeasurePoint: (index: number) => void;
  } | null>(null);

  // Exibir toast temporário de feedback
  const showToast = (msg: string) => {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    setToastMessage(msg);
    toastTimeoutRef.current = setTimeout(() => {
      setToastMessage(null);
    }, 3000);
  };

  // Salvar Combinação de Camadas Favoritas (Item 5: Produtividade)
  const handleSaveFavoriteLayers = useCallback(() => {
    try {
      const storageKey = currentActiveUser 
        ? `fav_layers_${currentActiveUser.username}` 
        : 'fav_layers_default';
      localStorage.setItem(storageKey, JSON.stringify(activeLayers));
      showToast(`⭐ ${activeLayers.length} camadas salvas como suas favoritas!`);
    } catch (e) {
      showToast('Erro ao salvar camadas favoritas.');
    }
  }, [activeLayers, currentActiveUser]);

  // Carregar Combinação de Camadas Favoritas
  const handleLoadFavoriteLayers = useCallback(() => {
    try {
      const storageKey = currentActiveUser 
        ? `fav_layers_${currentActiveUser.username}` 
        : 'fav_layers_default';
      const saved = localStorage.getItem(storageKey);
      if (!saved) {
        showToast('Nenhuma combinação favorita salva ainda. Ative suas camadas e clique em "Salvar Favoritas" ⭐');
        return;
      }
      const parsed: string[] = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) {
        const allowed = parsed.filter(name => allowedLayerNames.includes(name));
        setActiveLayers(allowed);
        showToast(`⭐ ${allowed.length} camadas favoritas carregadas com sucesso!`);
      } else {
        showToast('Lista de camadas favoritas vazia.');
      }
    } catch (e) {
      showToast('Erro ao carregar camadas favoritas.');
    }
  }, [allowedLayerNames, currentActiveUser]);

  // Atalhos Globais de Teclado (Item 5: Produtividade)
  // Ctrl + F ou '/' -> Foca na barra de pesquisa
  // Esc -> Limpa buscas, desmarca feições, fecha modais e limpa medição
  // M -> Ativa/desativa régua de medição (quando não estiver digitando)
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      const isTyping = activeEl && (
        activeEl.tagName === 'INPUT' ||
        activeEl.tagName === 'TEXTAREA' ||
        activeEl.tagName === 'SELECT' ||
        (activeEl as HTMLElement).isContentEditable
      );

      // 1. Ctrl+F ou Barra '/' -> Focar na busca
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
        showToast('⌨️ Atalho: Foco na barra de busca (Ctrl+F)');
        return;
      }

      if (e.key === '/' && !isTyping) {
        e.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
        showToast('⌨️ Atalho: Foco na barra de busca (/)');
        return;
      }

      // 2. Tecla Escape (Esc)
      if (e.key === 'Escape') {
        if (isProfileModalOpen) {
          setIsProfileModalOpen(false);
          return;
        }
        if (isAdminModalOpen) {
          setIsAdminModalOpen(false);
          return;
        }
        if (isHelpOpen) {
          setIsHelpOpen(false);
          return;
        }

        if (isUserLoginModalOpen) {
          setIsUserLoginModalOpen(false);
          return;
        }
        if (isSearchResultsVisible || searchQuery) {
          handleAbandonSearch();
          showToast('Busca limpa.');
          return;
        }
        if (selectedFeatures.length > 0) {
          setSelectedFeatures([]);
          showToast('Seleção de feições limpa.');
          return;
        }
        if (measureHistory && measureHistory.length > 0) {
          setMeasureHistory(null);
          showToast('Medição limpa.');
          return;
        }
        mapInstance?.closePopup();
        return;
      }

      // 3. Tecla M -> Alternar/Acionar régua de medição
      if (e.key.toLowerCase() === 'm' && !isTyping && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const measureBtn = document.querySelector('#btn-toggle-measure, .leaflet-control-measure-toggle, a.leaflet-control-measure-toggle') as HTMLElement;
        if (measureBtn) {
          e.preventDefault();
          measureBtn.click();
          showToast('⌨️ Atalho: Ferramenta de Medição (M)');
        }
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [
    isAdminModalOpen,
    isHelpOpen,
    isUserLoginModalOpen,
    isSearchResultsVisible,
    searchQuery,
    selectedFeatures,
    measureHistory,
    mapInstance
  ]);

  // Helper para verificar se um elemento corresponde ao filtro de município
  const matchesMunicipality = (props: Record<string, any>, filterTerm: string): boolean => {
    const munKeys = ['NM_MUN', 'Nome do município'];
    for (const k of munKeys) {
      if (props[k]) {
        const val = normalizeString(String(props[k]));
        if (val.includes(filterTerm)) return true;
      }
    }
    return false;
  };

  const [cnefeExternalResult, setCnefeExternalResult] = useState<ExternalPolygonSearchResult | null>(null);

  // Busca espacial de endereços CNEFE dentro da geometria de um polígono selecionado
  const handleSearchPolygonAddresses = async (feat: { feature?: any; properties?: any; name?: string; title?: string; sourceName?: string; layer?: any }) => {
    try {
      const featTitle = feat.name || feat.title || (feat.properties ? getIdentifier(feat.properties) : 'Área Selecionada');
      showToast(`🔍 Consultando banco CNEFE (1M+ endereços) dentro de "${featTitle}"...`);
      
      let geoJsonFeature: any = null;
      if (feat.layer) {
        if (typeof feat.layer.toGeoJSON === 'function') {
          geoJsonFeature = feat.layer.toGeoJSON();
        } else if (feat.layer.feature) {
          geoJsonFeature = feat.layer.feature;
        }
      }
      if (!geoJsonFeature && feat.feature) {
        geoJsonFeature = feat.feature;
      }
      if (!geoJsonFeature && feat) {
        geoJsonFeature = feat;
      }

      if (!geoJsonFeature) {
        showToast('Geometria do polígono não identificada.');
        return;
      }

      const res = await buscarEnderecosPorPoligono(geoJsonFeature, 3000);

      if (!res.results || res.results.length === 0) {
        showToast(`Nenhum endereço cadastrado no CNEFE foi localizado dentro de "${featTitle}".`);
        return;
      }

      setCnefeExternalResult({
        results: res.results,
        totalEncontrado: res.totalEncontrado,
        title: `${featTitle} (${feat.sourceName || 'Polígono'})`,
        sourceLayerName: feat.sourceName,
        timestamp: Date.now()
      });
      setIsCnefeBottomBarOpen(true);
      setIsCnefeBottomBarExpanded(true);

      logActivity(
        'ENDERECO',
        `Busca CNEFE no polígono: "${featTitle}"`,
        userRole,
        `${res.totalEncontrado} endereços/domicílios identificados na área delimitada`
      );

      showToast(`✨ ${res.totalEncontrado} endereço(s) CNEFE encontrado(s) dentro de "${featTitle}"!`);

      // Scroll suave para o painel de endereços CNEFE
      setTimeout(() => {
        const el = document.getElementById('ibge-search-panel');
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 150);
    } catch (err) {
      console.error('Erro na busca CNEFE por polígono:', err);
      showToast('Erro ao consultar endereços do CNEFE para este polígono.');
    }
  };

  // Busca direta de endereços CNEFE pela coluna "localidade" em um determinado município
  const handleSearchLocalidadeAddresses = async (localidade: string, municipio: string) => {
    try {
      const locClean = (localidade || '').trim();
      const munClean = (municipio || '').trim();
      if (!locClean) {
        showToast('Nome da localidade não identificado para a pesquisa.');
        return;
      }

      showToast(`🔍 Consultando endereços da localidade "${locClean}"${munClean ? ` em ${munClean}` : ''}...`);

      const res = await buscarEnderecosPorLocalidade(munClean, locClean, 3000);

      if (!res.results || res.results.length === 0) {
        showToast(`Nenhum endereço com a localidade "${locClean}" foi localizado no CNEFE${munClean ? ` (${munClean})` : ''}.`);
        return;
      }

      setCnefeExternalResult({
        results: res.results,
        totalEncontrado: res.totalEncontrado,
        title: `Localidade: ${toTitleCase(locClean)}${munClean ? ` • ${toTitleCase(munClean)}` : ''}`,
        sourceLayerName: 'Localidades (Piauí)',
        timestamp: Date.now()
      });
      setIsCnefeBottomBarOpen(true);
      setIsCnefeBottomBarExpanded(true);

      logActivity(
        'ENDERECO',
        `Busca CNEFE por Localidade: "${locClean}"`,
        userRole,
        `${res.totalEncontrado} endereços encontrados no município de ${munClean || 'Piauí'}`
      );

      showToast(`✨ ${res.totalEncontrado} endereço(s) CNEFE encontrado(s) para "${locClean}"!`);

      setTimeout(() => {
        const el = document.getElementById('ibge-search-panel');
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 150);
    } catch (err) {
      console.error('Erro ao buscar endereços da localidade no CNEFE:', err);
      showToast('Erro ao consultar endereços da localidade no CNEFE.');
    }
  };



  // Executa busca de Hospitais filtrando por Município
  const handleExecuteHospitalSearchByMunicipio = async (municipio: string) => {
    try {
      setIsHospitalSearching(true);

      const isTodos = !municipio || municipio === 'Todos';
      const munLabel = isTodos ? 'em todo o Estado' : `em ${municipio}`;
      showToast(`🏥 Consultando estabelecimentos de saúde ${munLabel} no CNEFE...`);

      const res = await buscarEnderecosPorEspecie(
        'Estabelecimento de saúde',
        isTodos ? undefined : municipio,
        5000
      );

      if (!res.results || res.results.length === 0) {
        showToast(`Nenhum estabelecimento de saúde localizado ${munLabel}.`);
        return;
      }

      // Não plota no mapa de imediato, conforme solicitado
      setSearchCoordinates(null);

      setCnefeExternalResult({
        results: res.results,
        totalEncontrado: res.totalEncontrado,
        title: `Hospitais e Estabelecimentos de Saúde (${isTodos ? 'Piauí' : municipio})`,
        sourceLayerName: 'Estabelecimentos de Saúde',
        timestamp: Date.now(),
        searchTerm: 'Estabelecimento de saúde'
      });
      setIsCnefeBottomBarOpen(true);
      setIsCnefeBottomBarExpanded(true);

      logActivity(
        'ENDERECO',
        `Busca CNEFE: Saúde por Município (${municipio})`,
        userRole,
        `${res.totalEncontrado} estabelecimentos encontrados`
      );

      showToast(`🏥 ${res.totalEncontrado} estabelecimentos de saúde carregados na Busca Avançada (${isTodos ? 'Piauí' : municipio})!`);

      setTimeout(() => {
        const el = document.getElementById('ibge-search-panel');
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 150);
    } catch (err) {
      console.error('Erro ao buscar hospitais por município no CNEFE:', err);
      showToast('Erro ao consultar estabelecimentos de saúde no CNEFE.');
    } finally {
      setIsHospitalSearching(false);
    }
  };

  // Executa busca de Hospitais por Raio GPS ao redor da localização do usuário
  const handleExecuteHospitalSearchByRadius = (raioMetros: number) => {
    try {
      setIsHospitalSearching(true);

      if (!('geolocation' in navigator)) {
        showToast('Geolocalização não é suportada por este dispositivo.');
        setIsHospitalSearching(false);
        return;
      }

      const raioKm = (raioMetros / 1000).toLocaleString('pt-BR');
      showToast(`📍 Obtendo localização GPS para buscar em raio de ${raioMetros >= 1000 ? `${raioKm} km` : `${raioMetros} m`}...`);

      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          try {
            const { latitude, longitude } = pos.coords;
            showToast(`🏥 Buscando hospitais em raio de ${raioMetros >= 1000 ? `${raioKm} km` : `${raioMetros} m`} no CNEFE...`);

            const res = await buscarEnderecosPorRaio(
              latitude,
              longitude,
              raioMetros,
              'Estabelecimento de saúde',
              3000
            );

            if (!res.results || res.results.length === 0) {
              showToast(`Nenhum estabelecimento de saúde encontrado a até ${raioMetros >= 1000 ? `${raioKm} km` : `${raioMetros} m`}.`);
              return;
            }

            // Não plota no mapa de imediato, conforme solicitado
            setSearchCoordinates(null);

            setCnefeExternalResult({
              results: res.results,
              totalEncontrado: res.totalEncontrado,
              title: `Hospitais em raio de ${raioMetros >= 1000 ? `${raioKm} km` : `${raioMetros} m`} da sua localização`,
              sourceLayerName: 'Estabelecimentos de Saúde (Raio GPS)',
              timestamp: Date.now(),
              searchTerm: 'Estabelecimento de saúde'
            });
            setIsCnefeBottomBarOpen(true);
            setIsCnefeBottomBarExpanded(true);

            logActivity(
              'ENDERECO',
              `Busca CNEFE: Saúde por Raio (${raioMetros}m)`,
              userRole,
              `${res.totalEncontrado} estabelecimentos encontrados`
            );

            showToast(`🏥 ${res.totalEncontrado} estabelecimentos de saúde encontrados a até ${raioMetros >= 1000 ? `${raioKm} km` : `${raioMetros} m`}!`);

            setTimeout(() => {
              const el = document.getElementById('ibge-search-panel');
              if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }, 150);
          } catch (innerErr) {
            console.error('Erro na pesquisa por raio no CNEFE:', innerErr);
            showToast('Erro ao consultar estabelecimentos de saúde por raio.');
          } finally {
            setIsHospitalSearching(false);
          }
        },
        (geoErr) => {
          setIsHospitalSearching(false);
          console.warn('Erro ao obter GPS:', geoErr);
          if (geoErr.code === 1) {
            showToast('Permissão de GPS negada. Por favor, permita a localização no seu navegador.');
          } else {
            showToast('Não foi possível obter a sua localização GPS atual.');
          }
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
      );
    } catch (err) {
      setIsHospitalSearching(false);
      console.error('Erro ao processar localização para a busca:', err);
      showToast('Erro ao iniciar localização.');
    }
  };

  // Login direto em conta autenticada
  const handleDirectLoginPreviousUser = (user: RegisteredUser) => {
    document.body.style.overflow = '';
    document.documentElement.style.overflow = '';
    setCurrentActiveUser(user);
    setCurrentActiveUserState(user);
    const assignedRole: UserRole = (user.role === 'master' || (user.role as string) === 'admin') ? 'master' : (user.role === 'manager' ? 'manager' : 'user');
    setUserRole(assignedRole);
    setIsSimulatingUser(false);
    setHasEntered(true);
    setPromptPasswordForPreviousUser(false);
    setPreviousUserPasswordInput('');
    setPreviousUserError(null);
    
    // Garante que o mapa sempre inicie com as camadas padrão oficiais
    setActiveLayers(DEFAULT_ACTIVE_LAYERS);
    
    refreshPermissions();
    if (assignedRole === 'master') {
      showToast(`👑 Bem-vindo de volta, Administrador Master ${user.name}!`);
    } else if (assignedRole === 'manager') {
      showToast(`👔 Bem-vindo de volta, Gerente ${user.name}!`);
    } else {
      showToast(`👤 Bem-vindo de volta, ${user.name}!`);
    }
  };

  // Continuar com conta anterior (solicita senha se a conta tiver uma)
  const handleContinueWithPreviousUser = async () => {
    if (!lastPreviousUser) return;
    
    // Se a conta não tem senha cadastrada
    if (!lastPreviousUser.password || lastPreviousUser.password.trim() === '') {
      handleDirectLoginPreviousUser(lastPreviousUser);
      return;
    }

    if (!previousUserPasswordInput.trim()) {
      setPreviousUserError('Por favor, digite a senha da sua conta.');
      return;
    }

    setIsPreviousUserSubmitting(true);
    setPreviousUserError(null);
    try {
      const res = await authenticateRegisteredUserAsync(lastPreviousUser.username, previousUserPasswordInput);
      if (res.success && res.user) {
        handleDirectLoginPreviousUser(res.user);
      } else {
        setPreviousUserError(res.message || 'Senha incorreta. Tente novamente.');
      }
    } catch (e: any) {
      setPreviousUserError(e?.message || 'Erro ao autenticar.');
    } finally {
      setIsPreviousUserSubmitting(false);
    }
  };

  // Verificação instantânea em tempo real ao digitar o nome na tela de entrada
  useEffect(() => {
    let isMounted = true;
    const trimmed = visitorNameInput.trim();
    if (!trimmed || trimmed.length < 2) {
      setDetectedExistingUser(null);
      setIsCheckingWelcomeName(false);
      return;
    }

    setIsCheckingWelcomeName(true);
    const timer = setTimeout(async () => {
      try {
        const found = await findRegisteredUserByLoginOrNameAsync(trimmed);
        if (isMounted) {
          setDetectedExistingUser(found);
        }
      } catch (e) {
        if (isMounted) {
          setDetectedExistingUser(null);
        }
      } finally {
        if (isMounted) {
          setIsCheckingWelcomeName(false);
        }
      }
    }, 200);

    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [visitorNameInput]);

  // Entrar 100% como Visitante puro (garante que nenhuma conta anterior seja associada)
  const handleEnterPureVisitor = (customName?: string) => {
    document.body.style.overflow = '';
    document.documentElement.style.overflow = '';
    setCurrentActiveUser(null);
    setCurrentActiveUserState(null);
    setUserRole('user');
    setIsSimulatingUser(false);
    
    const displayName = (customName || '').trim() || 'Visitante';
    saveUserSessionConfig(currentSessionId, {
      customName: displayName
    });
    logActivity('ACESSO', `Visitante "${displayName}" acessou o sistema WebGis`, 'user');
    
    setHasEntered(true);
    setVisitorNameInput('');
    setVisitorPasswordInput('');
    setDetectedExistingUser(null);
    setIsCheckingWelcomeName(false);
    setWelcomeError(null);
    setPromptPasswordForPreviousUser(false);
    setPreviousUserPasswordInput('');
    setPreviousUserError(null);
    refreshPermissions();
    showToast(displayName !== 'Visitante' ? `Bem-vindo, ${displayName}!` : 'Acesso como Visitante liberado!');
  };

  const handleEnterAsUser = async () => {
    if (isWelcomeSubmitting) return;
    setWelcomeError(null);
    const trimmedName = visitorNameInput.trim();
    const trimmedPassword = visitorPasswordInput.trim();

    // 1. Se não digitou nome nenhum: entra como visitante padrão imediatamente
    if (!trimmedName) {
      handleEnterPureVisitor();
      return;
    }

    setIsWelcomeSubmitting(true);

    try {
      // 2. Verificar se o nome ou login digitado já existe no banco de dados (Supabase / Usuários Cadastrados)
      const existingUser = await findRegisteredUserByLoginOrNameAsync(trimmedName);

      if (existingUser) {
        // Se informou senha, tenta autenticar diretamente
        if (trimmedPassword) {
          const authResult = await authenticateRegisteredUserAsync(existingUser.username, trimmedPassword);
          if (authResult.success && authResult.user) {
            handleDirectLoginPreviousUser(authResult.user);
            return;
          } else {
            setWelcomeError(authResult.message || `Senha incorreta. Digite a senha para entrar no site.`);
            setIsWelcomeSubmitting(false);
            return;
          }
        } else {
          // Se NÃO informou senha:
          // Se a conta não tem senha, entra diretamente nela
          if (!existingUser.password || existingUser.password.trim() === '') {
            handleDirectLoginPreviousUser(existingUser);
            return;
          }
          // Se a conta tem senha, avisa e pede a senha de forma direta
          setWelcomeError(`O nome de usuário já existe. Digite a senha para entrar no site.`);
          setIsWelcomeSubmitting(false);
          return;
        }
      }

      // 3. Usuário NÃO existe no banco de dados:
      // Se digitou uma senha, CADASTRA a conta no Supabase para ficar salva permanentemente!
      if (trimmedPassword) {
        if (trimmedPassword.length < 4) {
          setWelcomeError('A senha deve ter no mínimo 4 caracteres para criar sua conta.');
          setIsWelcomeSubmitting(false);
          return;
        }

        const cleanLogin = sanitizeUsername(trimmedName).replace(/[^a-z0-9._-]/g, '.') || `usr.${Date.now().toString().slice(-4)}`;
        
        const saveRes = await saveRegisteredUser({
          name: trimmedName,
          username: cleanLogin,
          password: trimmedPassword,
          role: 'user',
          department: 'Cadastrado pelo Usuário',
          createdBy: 'Criada pelo Usuário (Site)',
          isActive: true,
          hasCustomPermissions: false
        }, 'master');

        if (saveRes.success) {
          const newUser = saveRes.users.find(u => sanitizeUsername(u.username) === cleanLogin) || {
            id: 'usr_' + Date.now(),
            name: trimmedName,
            username: cleanLogin,
            password: trimmedPassword,
            role: 'user' as const,
            department: 'Cadastrado pelo Usuário',
            createdBy: 'Criada pelo Usuário (Site)',
            createdAt: new Date().toISOString(),
            isActive: true,
            hasCustomPermissions: false
          };
          handleDirectLoginPreviousUser(newUser as RegisteredUser);
          showToast(`🎉 Conta criada e salva com sucesso para @${cleanLogin}!`);
          return;
        } else {
          console.warn('Aviso ao salvar nova conta:', saveRes.error);
        }
      }

      // 4. Sem senha digitada -> Acesso liberado como Visitante com o nome informado
      handleEnterPureVisitor(trimmedName);
    } catch (err) {
      console.error('Erro na validação de entrada:', err);
      handleEnterPureVisitor(trimmedName);
    } finally {
      setIsWelcomeSubmitting(false);
    }
  };

  const handleOpenUserLogin = () => {
    setUserLoginInput('');
    setUserPasswordInput('');
    setUserLoginError(null);
    setShowUserPassword(false);
    setIsUserLoginModalOpen(true);
  };

  const handleConfirmUserLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userLoginInput.trim() || !userPasswordInput) {
      setUserLoginError('Preencha o usuário e a senha.');
      return;
    }

    setIsUserLoginSubmitting(true);
    setUserLoginError(null);

    try {
      const result = await authenticateRegisteredUserAsync(userLoginInput.trim(), userPasswordInput);
      if (result.success && result.user) {
        document.body.style.overflow = '';
        document.documentElement.style.overflow = '';
        setCurrentActiveUser(result.user);
        setCurrentActiveUserState(result.user);

        const assignedRole: UserRole = (result.user.role === 'master' || (result.user.role as string) === 'admin') ? 'master' : (result.user.role === 'manager' ? 'manager' : 'user');
        setUserRole(assignedRole);

        setIsSimulatingUser(false);
        setIsUserLoginModalOpen(false);
        setHasEntered(true);
        setUserLoginInput('');
        setUserPasswordInput('');
        setUserLoginError(null);
        refreshPermissions();

        if (assignedRole === 'master') {
          showToast(`👑 Bem-vindo, Administrador Master ${result.user.name}!`);
        } else if (assignedRole === 'manager') {
          showToast(`👔 Bem-vindo, Gerente ${result.user.name}!`);
        } else {
          showToast(`👤 Bem-vindo(a), ${result.user.name}!`);
        }
      } else {
        setUserLoginError(result.message || 'Credenciais inválidas.');
      }
    } catch (err: any) {
      console.error('Erro no login:', err);
      setUserLoginError(err?.message || 'Erro ao realizar login.');
    } finally {
      setIsUserLoginSubmitting(false);
    }
  };

  const handleOpenAdminLogin = () => {
    setIsUserLoginModalOpen(true);
  };

  const handleLogout = () => {
    document.body.style.overflow = '';
    document.documentElement.style.overflow = '';
    setCurrentActiveUser(null);
    setCurrentActiveUserState(null);
    setLastPreviousUser(getLastLoggedInUser());
    setPromptPasswordForPreviousUser(false);
    setPreviousUserPasswordInput('');
    setPreviousUserError(null);
    setUserRole('user');
    setIsSimulatingUser(false);
    setHasEntered(false);
    setIsAdminModalOpen(false);
    setIsUserLoginModalOpen(false);
    setIsProfileModalOpen(false);
    setVisitorNameInput('');
    setVisitorPasswordInput('');
    setWelcomeError(null);
    refreshPermissions();
    showToast('Sessão encerrada com sucesso.');
  };

  // Executar busca espacial e fuzzy
  const handleSearch = async (overrideQuery?: string) => {
    const rawInput = typeof overrideQuery === 'string' ? overrideQuery.trim() : searchQuery.trim();
    if (!rawInput) {
      setIsSearchResultsVisible(false);
      return;
    }

    addRecentSearch(rawInput);
    if (overrideQuery && overrideQuery !== searchQuery) {
      setSearchQuery(overrideQuery);
    }

    logActivity('BUSCA', `Pesquisa global realizada: "${rawInput}"`, userRole);

    setIsSearchLoading(true);
    setIsSearchResultsVisible(true);
    setSearchResults({});
    setTotalResultsCount(0);

    // Verificar se o input é um par de coordenadas (ex: "-5.243542, -42.535423")
    const coordRegex = /^\s*(-?\d+(\.\d+)?)\s*,\s*(-?\d+(\.\d+)?)\s*$/;
    const coordMatch = rawInput.match(coordRegex);

    let isCoordSearch = false;
    let searchLat = 0;
    let searchLng = 0;

    if (coordMatch) {
      searchLat = parseFloat(coordMatch[1]);
      searchLng = parseFloat(coordMatch[3]);
      if (!isNaN(searchLat) && !isNaN(searchLng) && searchLat >= -90 && searchLat <= 90 && searchLng >= -180 && searchLng <= 180) {
        isCoordSearch = true;
        setSearchCoordinates([{ lat: searchLat, lng: searchLng, isCoordSearch: true }]);
      }
    }

    let primaryTerm = '';
    let searchNumber: string | null = null;
    let localities: string[] = [];
    let anchor = '';

    if (!isCoordSearch) {
      if (rawInput.includes(',')) {
        const parts = rawInput.split(',');
        primaryTerm = normalizeString(parts[0].trim());
        const otherParts = parts.slice(1).map(p => p.trim());
        
        for (const part of otherParts) {
          if (/\d/.test(part)) {
            if (!searchNumber) searchNumber = part.replace(/\D/g, '');
          } else if (part.length > 0) {
            localities.push(normalizeString(part));
          }
        }
      } else {
        primaryTerm = normalizeString(rawInput);
      }

      if (!primaryTerm) {
        setIsSearchLoading(false);
        setIsSearchResultsVisible(false);
        return;
      }

      // Remover prefixos genéricos e encontrar âncora
      const genericPrefixes = ['rua', 'av', 'avenida', 'travessa', 'br', 'rodovia', 'praca', 'praça', 'alameda', 'estrada', 'vila', 'beco', 'rod', 'marginal'];
      const cleanWords = primaryTerm.split(/\s+/).filter(w => !genericPrefixes.includes(w) && w.length > 2);
      
      if (cleanWords.length > 0) {
        let longestWord = cleanWords.reduce((a, b) => a.length >= b.length ? a : b, "");
        anchor = longestWord;
      } else {
        anchor = primaryTerm;
      }
    }

    try {
      const layersToSearch: { name: string; loader: () => Promise<L.GeoJSON> }[] = [];

      if (searchActiveLayersOnly && !isCoordSearch) {
        activeLayers
          .filter(name => allowedLayerNames.includes(name))
          .forEach(name => {
            layersToSearch.push({
              name,
              loader: async () => {
                if (mapActionsRef.current) {
                  return await mapActionsRef.current.loadLayerByName(name);
                }
                throw new Error('Ações do mapa não disponíveis');
              }
            });
          });
      } else {
        dataSources
          .filter(src => allowedLayerNames.includes(src.name))
          .forEach(src => {
            layersToSearch.push({
              name: src.name,
              loader: async () => {
                if (mapActionsRef.current) {
                  return await mapActionsRef.current.loadLayerByName(src.name);
                }
                throw new Error('Ações do mapa não disponíveis');
              }
            });
          });
      }

      const tempResults: GroupedSearchResults = {};
      let countFound = 0;

      if (isCoordSearch) {
        const searchPoint = point([searchLng, searchLat]);
        const coordProperties: Record<string, any> = {
          "Latitude": searchLat.toFixed(6),
          "Longitude": searchLng.toFixed(6),
          "Tipo": "Busca de Coordenada"
        };
        
        const foundFeaturesMap: Record<string, string[]> = {};

        // Busca espacial em todas as camadas por interseção ou proximidade
        for (const step of layersToSearch) {
          const geoJsonLayer = await step.loader();
          const matches: SearchResultItem[] = [];

          const featureElements: any[] = (geoJsonLayer as any).allMarkers && Array.isArray((geoJsonLayer as any).allMarkers) && (geoJsonLayer as any).allMarkers.length > 0
            ? (geoJsonLayer as any).allMarkers
            : [];
          
          if (featureElements.length === 0) {
            geoJsonLayer.eachLayer((poly: any) => featureElements.push(poly));
          }

          featureElements.forEach((poly: any) => {
            if (!poly.feature || !poly.feature.geometry) return;
            
            try {
              const geomType = poly.feature.geometry.type;
              let isMatch = false;

              if (geomType === 'Polygon' || geomType === 'MultiPolygon') {
                if (booleanPointInPolygon(searchPoint, poly.feature)) {
                  isMatch = true;
                }
              } else if (geomType === 'Point' || geomType === 'MultiPoint') {
                const coords = poly.feature.geometry.coordinates;
                if (coords && coords.length >= 2) {
                  const latP = Number(coords[1]);
                  const lngP = Number(coords[0]);
                  const distMeters = haversineDistanceMeters(searchLat, searchLng, latP, lngP);
                  if (distMeters <= 1000) { // Proximidade de até ~1.000m (1km) para localidades e feições pontuais
                    isMatch = true;
                  }
                }
              }

              if (isMatch) {
                const identifier = getIdentifier(poly.feature.properties, step.name);
                
                if (!foundFeaturesMap[step.name]) {
                  foundFeaturesMap[step.name] = [];
                }
                if (!foundFeaturesMap[step.name].includes(identifier)) {
                  foundFeaturesMap[step.name].push(identifier);
                }

                coordProperties[step.name] = identifier;

                matches.push({
                  polygonLayer: poly,
                  value: identifier,
                  key: 'Área Encontrada',
                  distance: 0
                });
              }
            } catch (err) {
              // Ignore invalid geometries or turf calculation errors
            }
          });

          if (matches.length > 0) {
            tempResults[step.name] = matches;
            countFound += matches.length;
          }
        }

        const layerLabelMap: Record<string, string> = {
          'Municipios': 'Município',
          'Bairros': 'Bairro',
          'Favelas e Comunidades': 'Favela/Comunidade',
          'Núcleos Urbanos': 'Núcleo Urbano',
          'Comunidades Rurais de Teresina': 'Comunidade Rural',
          'Aglomerados Rurais': 'Aglomerado Rural',
          'Áreas de Desenvolvimento': 'Área de Desenvolvimento',
          'AISP': 'AISP',
          'RISP': 'RISP',
          'Localidades (Piauí)': 'Localidade'
        };

        const details: string[] = [];
        const priorityOrder = [
          'Municipios', 'Bairros', 'Favelas e Comunidades', 'Núcleos Urbanos',
          'Comunidades Rurais de Teresina', 'Aglomerados Rurais', 'Áreas de Desenvolvimento',
          'AISP', 'RISP', 'Localidades (Piauí)'
        ];

        // Adiciona detalhes preservando rótulos amigáveis para todas as feições encontradas
        priorityOrder.forEach(layerName => {
          if (foundFeaturesMap[layerName]) {
            const label = layerLabelMap[layerName] || layerName;
            details.push(`${label}: ${foundFeaturesMap[layerName].join(', ')}`);
          }
        });

        Object.keys(foundFeaturesMap).forEach(layerName => {
          if (!priorityOrder.includes(layerName)) {
            const label = layerLabelMap[layerName] || layerName;
            details.push(`${label}: ${foundFeaturesMap[layerName].join(', ')}`);
          }
        });

        const coordName = details.length > 0
          ? `Coordenada Localizada (${details.join(' | ')})`
          : `Coordenada: ${searchLat.toFixed(6)}, ${searchLng.toFixed(6)}`;
          
        coordProperties["Nome"] = coordName;
        coordProperties["_details"] = details;

        // Adiciona um item correspondente à coordenada em si
        tempResults["Coordenadas"] = [
          {
            polygonLayer: {
              feature: {
                type: "Feature",
                properties: coordProperties
              },
              getBounds: () => L.latLng(searchLat, searchLng).toBounds(100),
              getLatLng: () => L.latLng(searchLat, searchLng),
              openPopup: () => {}
            } as any,
            value: `${searchLat.toFixed(6)}, ${searchLng.toFixed(6)}`,
            key: "Coordenada",
            distance: 0
          }
        ];
        countFound += 1;

        showToast(`Buscando feições para a coordenada: ${searchLat.toFixed(6)}, ${searchLng.toFixed(6)}`);
      } else {
        // Algoritmo de Ranking e Similaridade Otimizado
        const lowerPriorityKeys = PRIORITY_KEYS.map(k => k.toLowerCase());

        const isMunicipalityKey = (key: string): boolean => {
          const normKey = normalizeString(key);
          return normKey.includes('municipio') || normKey === 'nm_mun' || normKey === 'cd_mun' || normKey === 'nm_municip';
        };

        const calculateSimilarity = (s1: string, s2: string): number => {
          if (!s1 || !s2) return 0;
          if (s1 === s2 || s2.includes(s1)) return 1.0;
          
          const words2 = s2.split(/\s+/);
          let bestWordSim = 0;

          for (const w2 of words2) {
            if (w2.length < 2) continue;
            if (w2 === s1 || w2.includes(s1) || s1.includes(w2)) {
              bestWordSim = Math.max(bestWordSim, 0.9);
              continue;
            }
            const maxLen = Math.max(s1.length, w2.length);
            if (Math.abs(s1.length - w2.length) / maxLen > 0.45) continue;

            const maxDist = Math.floor(maxLen * 0.45);
            const dist = levenshteinDistance(s1, w2, maxDist);
            if (dist <= maxDist && maxLen > 0) {
              const sim = 1.0 - (dist / maxLen);
              if (sim > bestWordSim) {
                bestWordSim = sim;
              }
            }
          }
          
          if (bestWordSim >= 0.85) return bestWordSim;

          const maxLen = Math.max(s1.length, s2.length);
          if (Math.abs(s1.length - s2.length) / maxLen <= 0.4) {
            const maxDist = Math.floor(maxLen * 0.4);
            const dist = levenshteinDistance(s1, s2, maxDist);
            if (dist <= maxDist && maxLen > 0) {
              const overallSim = 1.0 - (dist / maxLen);
              return Math.max(bestWordSim, overallSim);
            }
          }
          
          return bestWordSim;
        };

        for (const step of layersToSearch) {
          const geoJsonLayer = await step.loader();
          const matches: (SearchResultItem & { score: number })[] = [];

          const featureElements: any[] = (geoJsonLayer as any).allMarkers && Array.isArray((geoJsonLayer as any).allMarkers) && (geoJsonLayer as any).allMarkers.length > 0
            ? (geoJsonLayer as any).allMarkers
            : [];
          
          if (featureElements.length === 0) {
            geoJsonLayer.eachLayer((poly: any) => featureElements.push(poly));
          }

          const sourceObj = dataSources.find(s => s.name === step.name);
          const primaryPropKey = sourceObj?.popupProperty || 'Nome';

          featureElements.forEach((poly: any) => {
            if (!poly.feature || !poly.feature.properties) return;
            const props = poly.feature.properties;

            // Extrair o nome principal e real da feição nesta camada específica
            const mainName = getIdentifier(props, step.name);
            if (!mainName || mainName === 'Item' || mainName === 'Item Territorial') return;

            const normMainName = normalizeString(mainName);

            // Contexto municipal da feição (se existir na camada)
            const rawMuni = props.NM_MUN || props['Nome do município'] || props['Nome do municipio'] || props.MUNICIPIO || props.Municipio || '';
            const normMuni = normalizeString(String(rawMuni || ''));

            let hasAnchor = false;
            if (anchor) {
              if ((normMuni && normMuni.includes(anchor)) || normMainName.includes(anchor)) {
                hasAnchor = true;
              }
            }

            // A busca casa ESTRITAMENTE com o nome principal da feição
            const bestSim = calculateSimilarity(primaryTerm, normMainName);

            // Se o usuário digitou uma âncora de município (ex: "Centro, Teresina"),
            // a feição DEVE pertencer àquele município se a camada possuir informação municipal
            if (anchor && normMuni && !normMuni.includes(anchor) && !normMainName.includes(anchor)) {
              return;
            }

            // Se a similaridade com o nome principal for baixa, descarta
            if (bestSim < 0.55) return;

            let score = bestSim;

            // Bônus se a âncora bater perfeitamente
            if (hasAnchor) {
              score += 0.3;
            }

            // Lógica de Número
            if (searchNumber) {
              if (mainName.includes(searchNumber)) {
                score += 0.4;
              }
            }

            // Lógica de Localidade / Município explícito
            if (localities.length > 0) {
              let foundLoc = false;
              for (const loc of localities) {
                if (normMuni.includes(loc) || loc.includes(normMuni) || normMainName.includes(loc)) {
                  foundLoc = true;
                  break;
                }
              }
              if (!foundLoc && normMuni) return;
              if (foundLoc) score += 0.5;
            }

            // Limiar mínimo para considerar match
            if (score >= 0.55) {
              matches.push({
                polygonLayer: poly,
                value: mainName,
                key: primaryPropKey,
                distance: 1.0 - score,
                score: score
              });
            }
          });

          if (matches.length > 0) {
            // Ordenar por score descrescente e limitar a 100 resultados
            matches.sort((a, b) => b.score - a.score);
            const topMatches = matches.slice(0, 100);
            
            tempResults[step.name] = topMatches;
            countFound += topMatches.length;
          }
        }
      }

      // Ordenar e formatar resultados
      Object.keys(tempResults).forEach(key => {
        tempResults[key].sort((a, b) => a.distance - b.distance);
      });

      setSearchResults(tempResults);
      setTotalResultsCount(countFound);

      if (isCoordSearch && tempResults["Coordenadas"] && tempResults["Coordenadas"].length > 0) {
        const coordItem = tempResults["Coordenadas"][0];
        const featureId = 'coord-search';
        const newFeature: SelectedFeature = {
          id: featureId,
          name: coordItem.polygonLayer.feature.properties.Nome || "Coordenada",
          sourceName: "Coordenadas",
          layer: coordItem.polygonLayer,
          properties: coordItem.polygonLayer.feature.properties
        };
        setSelectedFeatures(prev => {
          const filtered = prev.filter(f => f.sourceName !== "Coordenadas");
          return [...filtered, newFeature];
        });
        if (mapInstance) {
          mapInstance.setView([searchLat, searchLng], 14);
        }
        setSearchCoordinates([{
          lat: searchLat,
          lng: searchLng,
          label: coordItem.polygonLayer.feature.properties.Nome,
          details: coordItem.polygonLayer.feature.properties._details,
          isCoordSearch: true
        }]);
      }

      // Iniciar accordions contraídos por padrão a pedido do usuário
      const initialCollapsed: Record<string, boolean> = {};
      Object.keys(tempResults).forEach(name => {
        initialCollapsed[name] = true;
      });
      setCollapsedGroups(initialCollapsed);

    } catch (err) {
      console.error(err);
      showToast('Ocorreu um erro ao pesquisar.');
    } finally {
      setIsSearchLoading(false);
    }
  };

  // Limpar busca atual
  const handleAbandonSearch = () => {
    setSearchQuery('');
    setSearchResults({});
    setTotalResultsCount(0);
    setIsSearchResultsVisible(false);
    setSearchCoordinates(null);
    showToast('Busca redefinida.');
  };

  // Clique em um item do resultado de pesquisa
  const handleResultItemClick = async (layerName: string, item: SearchResultItem) => {
    if (!mapInstance) return;

    if (layerName === "Coordenadas") {
      const lat = parseFloat(item.polygonLayer.feature.properties.Latitude);
      const lng = parseFloat(item.polygonLayer.feature.properties.Longitude);
      setSearchCoordinates([{ 
        lat, 
        lng, 
        label: item.polygonLayer.feature.properties.Nome,
        details: item.polygonLayer.feature.properties._details,
        isCoordSearch: true
      }]);
      mapInstance.setView([lat, lng], 14);
      
      const featureId = 'coord-search';
      const newFeature: SelectedFeature = {
        id: featureId,
        name: item.polygonLayer.feature.properties.Nome || "Coordenada",
        sourceName: layerName,
        layer: item.polygonLayer,
        properties: item.polygonLayer.feature.properties
      };
      
      setSelectedFeatures(prev => {
        const filtered = prev.filter(f => f.sourceName !== "Coordenadas");
        return [...filtered, newFeature];
      });

      showToast(`Focado na coordenada: ${lat.toFixed(6)}, ${lng.toFixed(6)}`);
      return;
    }

    if (!mapActionsRef.current) return;

    try {
      // 1. Garantir que a camada do item esteja ativada no mapa
      const targetPoly = item.polygonLayer;
      
      const loadedGeoJson = await mapActionsRef.current.loadLayerByName(layerName);
      if (!mapInstance.hasLayer(loadedGeoJson)) {
        loadedGeoJson.addTo(mapInstance);
        if (!activeLayers.includes(layerName)) {
          setActiveLayers([...activeLayers, layerName]);
        }
      }

      // Se for camada com allMarkers (ex: Localidades), garantir que o marcador esteja anexado à camada
      if (layerName === "Localidades (Piauí)" || (loadedGeoJson as any).allMarkers) {
        if (typeof (loadedGeoJson as any).addLayer === 'function' && !(loadedGeoJson as any).hasLayer(targetPoly)) {
          (loadedGeoJson as any).addLayer(targetPoly);
        }
      }

      // 2. Centralizar câmera na feição
      mapActionsRef.current.zoomToFeature(targetPoly);

      // 3. Simular clique na feição para selecioná-la
      mapActionsRef.current.selectFeature(targetPoly, targetPoly.feature, layerName);

      // 4. Abrir pop-up nativo se disponível
      if (typeof targetPoly.openPopup === 'function') {
        setTimeout(() => {
          if (typeof targetPoly.openPopup === 'function') {
            targetPoly.openPopup();
          }
        }, 150);
      }

      // 5. Reduzir ou fechar busca na visualização móvel
      showToast(`Centralizado em: ${getIdentifier(targetPoly.feature?.properties, layerName)}`);
      logActivity('BUSCA', `Clicou no resultado: "${getIdentifier(targetPoly.feature?.properties, layerName)}"`, userRole, `Camada: ${layerName}`);
    } catch (err) {
      console.error(err);
      showToast('Erro ao focar na feição selecionada.');
    }
  };

  // Remover feição individual da lista de selecionados
  const handleRemoveFromSelection = (id: string) => {
    const target = selectedFeatures.find(f => f.id === id);
    if (target) {
      const lyr = target.layer as any;
      if (lyr && typeof lyr.setStyle === 'function') {
        lyr.setStyle(lyr.defaultStyle);
      }

      setSelectedFeatures(selectedFeatures.filter(f => f.id !== id));
      logActivity('FEICAO', `Removeu feição "${target.name}" da seleção`, userRole);
      showToast('Feição removida da seleção.');
    }
  };

  // Zoom para feição selecionada
  const handleZoomToFeature = (feat: SelectedFeature) => {
    if (mapActionsRef.current) {
      mapActionsRef.current.zoomToFeature(feat.layer);
      if (typeof (feat.layer as any).openPopup === 'function') {
        (feat.layer as any).openPopup();
      }
      showToast(`Centralizando câmera em ${feat.name}`);
    }
  };

  const formatAddressDetails = (row: any) => {
    const details: string[] = [];
    const add = (label: string, value: any) => {
      if (value && String(value).trim() !== '' && String(value).trim() !== '-' && String(value).trim() !== 'null') {
        details.push(`${label}: ${value}`);
      }
    };
    
    add('Endereço', row.endereco || row.ENDERECO);
    add('Complemento', row.complemento || row.COMPLEMENTO);
    add('Município', row.municipio || row.MUNICIPIO);
    add('Bairro', row.bairro || row.BAIRRO);
    add('Zona', row.zona || row.ZONA);
    add('Localidade', row.localidade || row.LOCALIDADE);
    add('Núcleo Urbano', row.nucleo_urbano || row.NUCLEO_URBANO || row['Nucleo Urbano']);
    add('Favelas ou Comunidades Urbana', row.favela_comunidade || row.FAVELA_COMUNIDADE || row['Favelas ou Comunidades Urbana']);
    add('Espécie', row.especie || row.ESPECIE || row['Espécie de endereço']);
    add('Identificação do Estabelecimento', row.estabelecimento || row.ESTABELECIMENTO || row['Identificação do estabelecimento']);
    add('Agromerado', row.agromerado || row.AGROMERADO || row['Agromerado']);
    add('Comunidades Rurais de Teresina', row.comunidade_rural || row.COMUNIDADE_RURAL || row['Comunidades Rurais de Teresina']);
    
    return details;
  };

  const handlePlotAddress = (row: any) => {
    const lat = parseFloat(row.latitude || row.LATITUDE);
    const lng = parseFloat(row.longitude || row.LONGITUDE);
    
    if (isNaN(lat) || isNaN(lng)) {
      showToast('Coordenadas inválidas para este endereço.');
      return;
    }

    const addrLabel = row.endereco || row.ENDERECO || 'Endereço IBGE';

    setSearchCoordinates([{ 
      lat, 
      lng, 
      label: addrLabel, 
      details: formatAddressDetails(row),
      isCoordSearch: false,
      rawAddress: row
    }]);

    if (mapInstance) {
      mapInstance.setView([lat, lng], 17);
    }
    
    logActivity('ENDERECO', `Plotou endereço no mapa: "${addrLabel}"`, userRole, `Município: ${row.municipio || row.MUNICIPIO || '-'}`);
    showToast(`Plotando endereço no mapa...`);
    
    // Rolar a tela para o topo para ver o mapa
    // map is already visible on screen
  };

  const handlePlotAllAddresses = (results: any[]) => {
    const validCoords = results
      .map(row => {
        const lat = parseFloat(row.latitude || row.LATITUDE);
        const lng = parseFloat(row.longitude || row.LONGITUDE);
        if (isNaN(lat) || isNaN(lng)) return null;
        return {
          lat,
          lng,
          label: row.endereco || row.ENDERECO || 'Endereço IBGE',
          details: formatAddressDetails(row),
          isCoordSearch: false,
          rawAddress: row
        };
      })
      .filter(Boolean) as Array<{ lat: number; lng: number; label?: string; details?: string[]; isCoordSearch?: boolean; rawAddress?: any }>;

    if (validCoords.length === 0) {
      showToast('Nenhuma coordenada válida encontrada nos resultados.');
      return;
    }

    setSearchCoordinates(validCoords);

    if (mapInstance && validCoords.length > 0) {
      if (validCoords.length === 1) {
        mapInstance.setView([validCoords[0].lat, validCoords[0].lng], 17);
      } else {
        const bounds = L.latLngBounds(validCoords.map(c => [c.lat, c.lng]));
        mapInstance.fitBounds(bounds, { padding: [50, 50] });
      }
    }
    
    logActivity('ENDERECO', `Plotou ${validCoords.length} endereços simultâneos no mapa`, userRole);
    showToast(`Plotando ${validCoords.length} endereços no mapa...`);
    // map is already visible on screen
  };

  const handleClearPlot = () => {
    setSearchCoordinates(null);
    setCnefeExternalResult(null);
    logActivity('ENDERECO', 'Limpou marcadores e resultados de endereços do mapa', userRole);
    showToast('Pesquisa e marcadores de endereços limpos.');
  };

  const handleKeyDown = (e: any) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  // Limpeza de busca se estiver vazio
  useEffect(() => {
    if (searchQuery.trim() === '') {
      setSearchResults({});
      setTotalResultsCount(0);
      setIsSearchResultsVisible(false);
    }
  }, [searchQuery, searchActiveLayersOnly]);

  if (!hasEntered) {
    return (
      <div className="relative min-h-screen w-full flex flex-col items-center justify-center p-4 font-sans select-none overflow-hidden animate-fade-in">
        {/* Fundo imersivo com efeito Apple Glass */}
        <div className="fixed inset-0 z-[-2] pointer-events-none overflow-hidden bg-[#f2f2f7] dark:bg-[#000000]">
          <div 
            className="absolute inset-[-10%] w-[120%] h-[120%] filter blur-[32px] opacity-65 dark:opacity-35 scale-105"
            style={{
              backgroundImage: "url('https://raw.githubusercontent.com/marciodemelosilvageo-glitch/GeoCode/main/logo/banner-mock.webp')",
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              backgroundAttachment: 'fixed',
            }}
          />
        </div>
        {/* Camada de desfoque e iluminação suave */}
        <div className="fixed inset-0 bg-white/40 dark:bg-black/60 backdrop-blur-2xl z-[-1]" />

        {/* Card de Entrada Apple Style */}
        <motion.div 
          initial={{ opacity: 0, y: 24, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="w-full max-w-[460px] bg-white/80 dark:bg-[#1c1c1e]/85 backdrop-blur-3xl rounded-[32px] p-7 sm:p-8 shadow-[0_24px_50px_-12px_rgba(0,0,0,0.25)] dark:shadow-[0_24px_50px_-12px_rgba(0,0,0,0.7)] border border-black/[0.06] dark:border-white/[0.12] ring-1 ring-white/60 dark:ring-white/[0.05] flex flex-col items-center text-center space-y-6"
        >
          {/* Logo Principal + Globo 3D Interativo */}
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.15, duration: 0.5 }}
            className="flex flex-col items-center w-full"
          >
            <div className="flex items-center justify-center gap-3 sm:gap-4 w-full">
              {/* Globo 3D Interativo posicionado ao lado da logo */}
              <div 
                className="w-16 h-16 sm:w-20 sm:h-20 shrink-0 relative rounded-2xl overflow-hidden flex items-center justify-center cursor-grab active:cursor-grabbing hover:scale-105 transition-transform"
                title="Globo Terrestre Interativo 3D • Arraste para rotacionar"
              >
                <Globe
                  speed={1.8}
                  scale={9.5}
                  dots={{
                    color: isDarkMode ? "#38bdf8" : "#007AFF",
                    size: 5,
                    density: 8,
                    allDots: false
                  }}
                  outlineColor={isDarkMode ? "rgba(255,255,255,0.45)" : "rgba(0,122,255,0.45)"}
                  graticuleColor={isDarkMode ? "rgba(255,255,255,0.12)" : "rgba(0,122,255,0.15)"}
                  oceanColor="transparent"
                  showGrid={true}
                  showOutline={true}
                  stopOnHover={false}
                />
              </div>

              {/* Logo Oficial SSP-PI */}
              <img 
                src={CURRENT_APP_LOGO} 
                alt="Logo" 
                className="h-14 sm:h-18 w-auto max-w-[210px] sm:max-w-[240px] object-contain drop-shadow-md hover:scale-[1.02] transition-transform duration-300 pointer-events-none" 
              />
            </div>

            <div className="mt-3.5 inline-flex items-center gap-2 px-3 py-1 rounded-full bg-black/[0.04] dark:bg-white/[0.08] text-slate-600 dark:text-zinc-300 border border-black/[0.04] dark:border-white/[0.06] text-xs font-medium tracking-wide">
              <span className="w-1.5 h-1.5 rounded-full bg-[#007AFF] animate-pulse" />
              <span>Sistema de Informações Geográficas</span>
            </div>
          </motion.div>

          {/* Opções de Acesso: Lembrete de Conta Anterior & Visitante */}
          <div className="w-full space-y-3.5 pt-1">
            {/* Card de Memória / Lembrete de Conta Anterior */}
            {lastPreviousUser && (
              <div className="w-full bg-black/[0.03] dark:bg-white/[0.04] border border-black/[0.06] dark:border-white/[0.08] rounded-2xl p-3.5 text-left space-y-2.5 shadow-sm animate-fadeIn">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-full bg-[#007AFF]/10 dark:bg-[#007AFF]/20 text-[#007AFF] flex items-center justify-center font-bold text-xs">
                      {lastPreviousUser.role === 'master' ? <Crown className="w-4 h-4 text-amber-500" /> : (lastPreviousUser.role === 'manager' ? <Briefcase className="w-4 h-4 text-[#007AFF]" /> : <User className="w-4 h-4" />)}
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-800 dark:text-white">
                        {lastPreviousUser.name}
                      </p>
                      <p className="text-[10px] text-slate-500 dark:text-zinc-400 font-mono">
                        @{lastPreviousUser.username}
                      </p>
                    </div>
                  </div>
                  <span className="text-[10px] font-medium bg-black/[0.04] dark:bg-white/[0.08] text-slate-600 dark:text-zinc-300 px-2 py-0.5 rounded-full">
                    Último Acesso
                  </span>
                </div>

                <p className="text-[11px] text-slate-600 dark:text-zinc-300 leading-snug">
                  Deseja continuar conectado nesta conta?
                </p>

                {promptPasswordForPreviousUser ? (
                  <div className="space-y-2 pt-1">
                    <div className="relative">
                      <input
                        type={showPreviousUserPassword ? "text" : "password"}
                        value={previousUserPasswordInput}
                        onChange={(e) => {
                          setPreviousUserPasswordInput(e.target.value);
                          if (previousUserError) setPreviousUserError(null);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleContinueWithPreviousUser();
                        }}
                        placeholder="Digite a senha da conta..."
                        autoFocus
                        className="w-full bg-white dark:bg-[#2c2c2e] border border-black/10 dark:border-white/10 rounded-xl pl-3.5 pr-9 py-2 text-xs text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-[#007AFF]"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPreviousUserPassword(!showPreviousUserPassword)}
                        className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 cursor-pointer"
                      >
                        {showPreviousUserPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>

                    {previousUserError && (
                      <p className="text-[11px] text-red-500 font-bold">{previousUserError}</p>
                    )}

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setPromptPasswordForPreviousUser(false);
                          setPreviousUserPasswordInput('');
                          setPreviousUserError(null);
                        }}
                        className="px-3 py-1.5 bg-black/[0.04] dark:bg-white/[0.08] hover:bg-black/[0.08] dark:hover:bg-white/[0.12] text-slate-700 dark:text-zinc-200 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
                      >
                        Cancelar
                      </button>
                      <button
                        type="button"
                        onClick={handleContinueWithPreviousUser}
                        disabled={isPreviousUserSubmitting}
                        className="flex-1 py-1.5 bg-[#007AFF] hover:bg-[#0071eb] text-white rounded-xl text-xs font-semibold transition-all shadow-sm cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50"
                      >
                        {isPreviousUserSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                        <span>Confirmar e Entrar</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 pt-0.5">
                    <button
                      type="button"
                      onClick={() => handleEnterPureVisitor()}
                      className="flex-1 py-2 bg-black/[0.04] dark:bg-white/[0.06] hover:bg-black/[0.08] dark:hover:bg-white/[0.1] text-slate-700 dark:text-zinc-300 rounded-xl text-xs font-medium transition-colors cursor-pointer"
                    >
                      Entrar como Visitante
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (lastPreviousUser.password && lastPreviousUser.password.trim().length > 0) {
                          setPromptPasswordForPreviousUser(true);
                        } else {
                          handleDirectLoginPreviousUser(lastPreviousUser);
                        }
                      }}
                      className="flex-1 py-2 bg-[#007AFF] hover:bg-[#0071eb] text-white rounded-xl text-xs font-semibold transition-all shadow-sm cursor-pointer flex items-center justify-center gap-1"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>Continuar na Conta</span>
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Campo de Identificação / Nome */}
            <div className="space-y-1.5 text-left">
              <label className="block text-xs font-semibold text-slate-600 dark:text-zinc-400 pl-1">
                Seu Nome ou Identificação (opcional):
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={visitorNameInput}
                  onChange={(e) => {
                    setVisitorNameInput(e.target.value);
                    if (welcomeError) setWelcomeError(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleEnterAsUser();
                  }}
                  placeholder="Ex: Carlos (Visitante), Fiscalização, Setor X..."
                  className={`w-full bg-black/[0.03] dark:bg-white/[0.05] border rounded-2xl pl-10 pr-4 py-3 text-sm font-medium transition-all ${
                    detectedExistingUser
                      ? 'border-amber-400 dark:border-amber-500/60 ring-2 ring-amber-400/20 text-slate-900 dark:text-white'
                      : 'border-black/[0.08] dark:border-white/[0.1] text-slate-900 dark:text-white outline-none focus:border-[#007AFF] focus:ring-4 focus:ring-[#007AFF]/15'
                  }`}
                />
                <User className="w-4 h-4 text-slate-400 dark:text-zinc-500 absolute left-3.5 top-3.5" />
              </div>

              {/* Status do Nome em Tempo Real */}
              {isCheckingWelcomeName && (
                <div className="flex items-center gap-1.5 text-[11px] font-medium text-slate-400 dark:text-zinc-500 pl-1 pt-0.5 animate-fadeIn">
                  <Loader2 className="w-3 h-3 animate-spin text-[#007AFF]" />
                  <span>Consultando usuário no banco de dados...</span>
                </div>
              )}

              {!isCheckingWelcomeName && detectedExistingUser && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-3 bg-amber-500/10 border border-amber-500/25 rounded-2xl text-left flex items-center gap-2.5 shadow-sm mt-1 animate-fadeIn"
                >
                  <AlertTriangle className="w-4 h-4 shrink-0 text-amber-500" />
                  <div className="text-xs">
                    <p className="font-bold text-amber-900 dark:text-amber-200">
                      O nome de usuário já existe.
                    </p>
                    <p className="text-[11px] text-amber-800 dark:text-amber-300 font-medium">
                      Digite a senha abaixo para entrar nesta conta.
                    </p>
                  </div>
                </motion.div>
              )}

              {!isCheckingWelcomeName && !detectedExistingUser && visitorNameInput.trim().length >= 3 && (
                <div className="flex items-center gap-1.5 text-[11px] font-medium text-emerald-600 dark:text-emerald-400 pl-1 pt-0.5 animate-fadeIn">
                  <Check className="w-3.5 h-3.5 text-emerald-500" />
                  <span>Nome disponível como Visitante ou Nova Conta</span>
                </div>
              )}
            </div>

            {/* Campo Dinâmico de Senha */}
            <AnimatePresence>
              {visitorNameInput.trim().length > 0 && (
                <motion.div
                  initial={{ opacity: 0, height: 0, y: -6 }}
                  animate={{ opacity: 1, height: 'auto', y: 0 }}
                  exit={{ opacity: 0, height: 0, y: -6 }}
                  transition={{ duration: 0.25, ease: "easeOut" }}
                  className="space-y-1.5 text-left overflow-hidden"
                >
                  <label className="block text-xs font-semibold text-slate-600 dark:text-zinc-400 pl-1 flex items-center justify-between">
                    {detectedExistingUser ? (
                      <span className="flex items-center gap-1.5 text-amber-700 dark:text-amber-400 font-bold">
                        <KeyRound className="w-3.5 h-3.5" />
                        Digite a senha para entrar no site:
                      </span>
                    ) : (
                      <span>Senha de Acesso (para criar ou proteger sua conta):</span>
                    )}
                    <span className="text-[10px] text-slate-400 dark:text-zinc-500 font-normal">
                      {detectedExistingUser ? 'Obrigatória para esta conta' : 'Opcional para visitantes'}
                    </span>
                  </label>
                  <div className="relative">
                    <input
                      type={showVisitorPassword ? "text" : "password"}
                      value={visitorPasswordInput}
                      onChange={(e) => {
                        setVisitorPasswordInput(e.target.value);
                        if (welcomeError) setWelcomeError(null);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleEnterAsUser();
                      }}
                      placeholder={
                        detectedExistingUser
                          ? "Digite a senha para entrar no site..."
                          : "Digite uma senha para criar sua conta..."
                      }
                      autoFocus={!!detectedExistingUser}
                      className={`w-full bg-black/[0.03] dark:bg-white/[0.05] border rounded-2xl pl-10 pr-10 py-3 text-sm font-medium transition-all ${
                        detectedExistingUser
                          ? 'border-amber-400 dark:border-amber-500/60 ring-2 ring-amber-400/20 text-slate-900 dark:text-white focus:ring-amber-500'
                          : 'border-black/[0.08] dark:border-white/[0.1] text-slate-900 dark:text-white outline-none focus:border-[#007AFF] focus:ring-4 focus:ring-[#007AFF]/15'
                      }`}
                    />
                    <KeyRound className="w-4 h-4 text-slate-400 dark:text-zinc-500 absolute left-3.5 top-3.5" />
                    <button
                      type="button"
                      onClick={() => setShowVisitorPassword(!showVisitorPassword)}
                      className="absolute right-3.5 top-3.5 text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 cursor-pointer"
                      tabIndex={-1}
                    >
                      {showVisitorPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>

                  {detectedExistingUser && (
                    <div className="flex items-center justify-between text-[11px] pt-0.5 px-1">
                      <span className="text-slate-500 dark:text-zinc-400">Não é sua conta?</span>
                      <button
                        type="button"
                        onClick={() => {
                          setVisitorNameInput('');
                          setVisitorPasswordInput('');
                          setDetectedExistingUser(null);
                          setWelcomeError(null);
                        }}
                        className="text-[#007AFF] hover:underline font-semibold cursor-pointer"
                      >
                        Limpar e usar outro nome
                      </button>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Mensagem de Erro / Alerta na Entrada */}
            <AnimatePresence>
              {welcomeError && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  className="p-3 bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20 rounded-2xl text-xs font-semibold flex flex-col gap-2 text-left animate-shake"
                >
                  <div className="flex items-start gap-2.5">
                    <AlertTriangle className="w-4 h-4 shrink-0 text-red-500 mt-0.5" />
                    <span className="leading-snug">{welcomeError}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleEnterPureVisitor(visitorNameInput)}
                    className="self-end px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded-lg text-[11px] font-semibold transition-colors cursor-pointer"
                  >
                    Entrar como Visitante com este Nome
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Botão de Acesso Principal (Apple Blue) */}
            <div className="w-full pt-1">
              <motion.button
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleEnterAsUser}
                disabled={isWelcomeSubmitting}
                className="w-full py-3.5 bg-[#007AFF] hover:bg-[#0071eb] active:bg-[#0062cc] text-white font-semibold text-sm rounded-2xl shadow-lg shadow-[#007AFF]/25 transition-all flex items-center justify-center gap-2 cursor-pointer group disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isWelcomeSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Verificando...</span>
                  </>
                ) : (
                  <>
                    <span>
                      {detectedExistingUser
                        ? `Entrar na Conta (@${detectedExistingUser.username})`
                        : (visitorPasswordInput.trim() 
                          ? 'Entrar no Sistema' 
                          : (visitorNameInput.trim() ? `Acessar como ${visitorNameInput}` : 'Acessar como Visitante'))}
                    </span>
                    <svg 
                      className="w-4 h-4 group-hover:translate-x-1 transition-transform" 
                      fill="none" 
                      viewBox="0 0 24 24" 
                      stroke="currentColor" 
                      strokeWidth="2.5"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13 5l7 7-7 7M5 5l7 7-7 7" />
                    </svg>
                  </>
                )}
              </motion.button>
            </div>
            
            {/* Botão de Login Institucional Discreto */}
            <div className="pt-1.5">
              <button
                type="button"
                onClick={handleOpenUserLogin}
                className="w-full py-2.5 rounded-2xl border border-black/[0.08] dark:border-white/[0.1] hover:bg-black/[0.03] dark:hover:bg-white/[0.05] text-slate-600 dark:text-zinc-300 text-xs font-semibold transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <KeyRound className="w-3.5 h-3.5 text-[#007AFF]" />
                <span>Login com Usuário Cadastrado</span>
              </button>
            </div>
          </div>

          {/* Footer discreto */}
          <p className="text-slate-400 dark:text-zinc-500 text-[11px] font-normal pt-1">
            Plataforma Geoespacial &bull; {new Date().getFullYear()}
          </p>
        </motion.div>

        {/* Modal de Login de Usuário Cadastrado (Estilo Apple) */}
        {isUserLoginModalOpen && (
          <div 
            className="fixed inset-0 top-0 left-0 right-0 bottom-0 z-[9999] w-screen h-screen min-h-[100dvh] bg-black/50 backdrop-blur-md flex items-center justify-center p-4 animate-fadeIn"
            onClick={() => setIsUserLoginModalOpen(false)}
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white/95 dark:bg-[#1c1c1e]/95 backdrop-blur-2xl border border-black/[0.08] dark:border-white/[0.12] rounded-[28px] shadow-2xl max-w-sm w-full p-6 text-left space-y-5"
            >
              <div className="flex items-center justify-between border-b border-black/[0.06] dark:border-white/[0.08] pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-full bg-[#007AFF]/10 dark:bg-[#007AFF]/20 text-[#007AFF] flex items-center justify-center font-bold">
                    <UserCheck className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                      Login de Usuário
                    </h3>
                    <p className="text-[11px] text-slate-500 dark:text-zinc-400">
                      Acesse com sua credencial cadastrada
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsUserLoginModalOpen(false)}
                  className="w-7 h-7 rounded-full bg-black/[0.05] dark:bg-white/[0.1] hover:bg-black/[0.1] dark:hover:bg-white/[0.15] text-slate-500 dark:text-zinc-300 flex items-center justify-center transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleConfirmUserLogin} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1.5 pl-0.5">
                    Usuário / Login:
                  </label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-2.5 text-slate-400 dark:text-zinc-500 font-mono text-xs font-bold">@</span>
                    <input 
                      type="text"
                      value={userLoginInput}
                      onChange={(e) => setUserLoginInput(e.target.value)}
                      placeholder="seu.usuario"
                      autoFocus
                      className="w-full bg-black/[0.03] dark:bg-white/[0.05] border border-black/[0.08] dark:border-white/[0.1] rounded-xl pl-8 pr-3.5 py-2.5 text-sm text-slate-900 dark:text-white outline-none focus:border-[#007AFF] focus:ring-4 focus:ring-[#007AFF]/15 font-mono font-medium"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1.5 pl-0.5">
                    Senha de Acesso:
                  </label>
                  <div className="relative">
                    <input 
                      type={showUserPassword ? "text" : "password"}
                      value={userPasswordInput}
                      onChange={(e) => setUserPasswordInput(e.target.value)}
                      placeholder="Digite sua senha..."
                      className="w-full bg-black/[0.03] dark:bg-white/[0.05] border border-black/[0.08] dark:border-white/[0.1] rounded-xl pl-3.5 pr-10 py-2.5 text-sm text-slate-900 dark:text-white outline-none focus:border-[#007AFF] focus:ring-4 focus:ring-[#007AFF]/15 font-medium"
                    />
                    <button
                      type="button"
                      onClick={() => setShowUserPassword(!showUserPassword)}
                      className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 cursor-pointer"
                    >
                      {showUserPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {userLoginError && (
                  <div className="p-3 bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20 rounded-xl text-xs font-semibold flex items-center gap-2 animate-shake">
                    <X className="w-4 h-4 shrink-0 text-red-500" />
                    <span>{userLoginError}</span>
                  </div>
                )}

                <div className="flex items-center gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsUserLoginModalOpen(false)}
                    className="flex-1 py-2.5 bg-black/[0.04] hover:bg-black/[0.08] dark:bg-white/[0.08] dark:hover:bg-white/[0.12] text-slate-700 dark:text-zinc-200 font-semibold rounded-xl text-xs transition-colors cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isUserLoginSubmitting}
                    className="flex-1 py-2.5 bg-[#007AFF] hover:bg-[#0071eb] text-white font-semibold rounded-xl text-xs transition-all shadow-md shadow-[#007AFF]/25 cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50"
                  >
                    {isUserLoginSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                    <span>{isUserLoginSubmitting ? 'Entrando...' : 'Entrar'}</span>
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </div>
    );
  }

    if (hasEntered && !isAdmin && effectiveSession.isBlocked) {
    return (
      <div className="relative min-h-screen w-full flex flex-col items-center justify-center p-4 font-sans select-none overflow-hidden bg-slate-950 text-white animate-fadeIn">
        {/* Papel de parede de fundo desfocado */}
        <div className="fixed inset-0 z-[-2] pointer-events-none overflow-hidden bg-slate-900">
          <div 
            className="absolute inset-[-10%] w-[120%] h-[120%] filter blur-[20px] scale-105 opacity-20"
            style={{
              backgroundImage: "url('https://raw.githubusercontent.com/marciodemelosilvageo-glitch/GeoCode/main/logo/banner-mock.webp')",
              backgroundSize: 'cover',
              backgroundPosition: 'center',
            }}
          />
        </div>
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-lg z-[-1]" />

        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-md bg-slate-900/90 backdrop-blur-2xl rounded-3xl p-8 shadow-2xl border border-red-500/30 flex flex-col items-center text-center space-y-5"
        >
          <div className="w-16 h-16 rounded-3xl bg-red-950/80 border border-red-500/40 flex items-center justify-center text-red-500 shadow-lg shadow-red-600/20">
            <ShieldAlert className="w-9 h-9" />
          </div>

          <div className="space-y-2">
            <h2 className="text-2xl font-black text-white">Acesso Suspenso</h2>
            <p className="text-xs text-slate-400 leading-relaxed">
              O acesso desta sessão foi temporariamente suspenso pelo Administrador do sistema. Entre em contato com o suporte ou gestor responsável para liberação.
            </p>
            <p className="text-[10px] text-slate-500 font-mono mt-1">
              Sessão: {simulatedSessionId || currentSessionId} {effectiveSession.customName ? `(${effectiveSession.customName})` : ''}
            </p>
          </div>

          <div className="w-full pt-3 flex flex-col gap-2.5">
            {userRole === 'admin' && isSimulatingUser && (
              <button
                onClick={() => {
                  setIsSimulatingUser(false);
                  setSimulatedSessionId(null);
                  showToast('👑 Retornado para visualização completa de Administrador');
                }}
                className="w-full py-3 bg-amber-400 hover:bg-amber-500 text-slate-950 font-black rounded-2xl text-xs transition-colors cursor-pointer shadow-md"
              >
                Sair da Visão de Simulação (Usuário Bloqueado)
              </button>
            )}

            <button
              onClick={() => {
                refreshPermissions();
                showToast('Verificando permissões atualizadas...');
              }}
              className="w-full py-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded-2xl text-xs transition-colors cursor-pointer shadow-md shadow-red-600/30"
            >
              Verificar Novamente
            </button>

            {userRole !== 'admin' && (
              <button
                onClick={() => {
                  setHasEntered(false);
                  handleOpenAdminLogin();
                }}
                className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-2xl text-xs transition-colors cursor-pointer border border-slate-700"
              >
                Entrar como Administrador
              </button>
            )}
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className={`relative w-screen h-screen overflow-hidden font-sans select-none bg-slate-100 dark:bg-slate-950 ${isPrintMode ? 'bg-white' : ''}`}>
      <style>
        {`
          @media print {
            @page { size: ${printOrientation}; margin: 0; }
            .leaflet-control-container { display: none !important; }
            body, html { background-color: white !important; margin: 0; padding: 0; }
            #map { height: 100% !important; border: none !important; border-radius: 0 !important; }
            .map-print-container { height: 100vh !important; }
          }
        `}
      </style>

      {/* BANNER FLUTUANTE DE SIMULAÇÃO (EXCLUSIVO DO MASTER) */}
      {isRealMaster && isSimulatingUser && (
        <div className="absolute top-2 left-1/2 -translate-x-1/2 w-11/12 max-w-4xl bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 text-white font-bold px-4 py-2 rounded-2xl shadow-xl border border-amber-300/40 flex flex-col sm:flex-row items-center justify-between gap-2 z-[2500] animate-fadeIn select-none">
          <div className="flex items-center gap-2.5 text-xs sm:text-sm">
            <div className="w-7 h-7 rounded-lg bg-black/20 flex items-center justify-center shrink-0 border border-white/20">
              <Eye className="w-3.5 h-3.5 text-white" />
            </div>
            <div>
              <span className="text-[9px] font-black uppercase tracking-wider text-amber-100 block">
                Modo de Simulação Ativo (Master)
              </span>
              <span className="font-extrabold text-white flex items-center gap-1.5 flex-wrap text-xs">
                Vendo o WebGIS como:{' '}
                <span className="bg-slate-950/80 text-amber-300 px-2 py-0.5 rounded-md border border-amber-400/40 font-mono text-[11px]">
                  {simulatedRole === 'manager' 
                    ? '👔 GERENTE' 
                    : (simulatedTargetUser ? `👤 @${simulatedTargetUser.username} (${simulatedTargetUser.name})` : '👤 VISITANTE COMUM')}
                </span>
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 flex-wrap">
            <button
              type="button"
              onClick={() => setIsSimulationChoiceModalOpen(true)}
              className="px-2.5 py-1 bg-slate-950/70 hover:bg-slate-950 text-amber-200 rounded-lg text-xs font-bold transition-all cursor-pointer border border-amber-400/30 flex items-center gap-1 shadow-sm"
              title="Trocar para visão de Gerente ou outro usuário"
            >
              <Eye className="w-3 h-3" />
              <span>Trocar Visão</span>
            </button>

            <button
              type="button"
              onClick={() => setIsAdminModalOpen(true)}
              className="px-2.5 py-1 bg-black/30 hover:bg-black/50 text-white rounded-lg text-xs font-bold transition-all cursor-pointer border border-white/20 flex items-center gap-1 shadow-sm"
              title="Abrir Painel Master para ajustar permissões"
            >
              <SlidersHorizontal className="w-3 h-3" />
              <span>Painel Master</span>
            </button>

            <button
              type="button"
              onClick={handleExitSimulation}
              className="px-3 py-1 bg-white hover:bg-amber-50 text-slate-950 rounded-lg text-xs font-black transition-all cursor-pointer shadow-md flex items-center gap-1 hover:scale-105 active:scale-95"
              title="Encerrar simulação e voltar para visão total de Master"
            >
              <Crown className="w-3.5 h-3.5 text-amber-600 fill-amber-500" />
              <span>Voltar</span>
            </button>
          </div>
        </div>
      )}

      {/* BARRA SUPERIOR DE IMPRESSÃO (QUANDO MODO IMPRESSÃO ATIVO) */}
      {isPrintMode && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[2600] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl p-3 flex items-center gap-3">
          <input
            type="text"
            value={printTitle}
            onChange={(e) => setPrintTitle(e.target.value)}
            placeholder="Título do Mapa..."
            className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 rounded-xl text-xs font-bold border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-100 w-48"
          />
          <button
            type="button"
            onClick={() => setPrintOrientation(prev => prev === 'portrait' ? 'landscape' : 'portrait')}
            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold transition-all"
          >
            {printOrientation === 'portrait' ? 'Retrato' : 'Paisagem'}
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Imprimir</span>
          </button>
          <button
            type="button"
            onClick={() => setIsPrintMode(false)}
            className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold"
          >
            Fechar
          </button>
        </div>
      )}

      {/* TELA INTEGRADA ESTILO APPLE MAPS (MAPS.APPLE.COM) */}
      <div className="relative w-full h-full flex overflow-hidden">
        {/* BARRA LATERAL TRANSLÚCIDA APPLE */}
        {!isPrintMode && (
          <AppleSidebar
            isCollapsed={isSidebarCollapsed}
            onToggleCollapse={() => setIsSidebarCollapsed(prev => !prev)}
            activeTab={sidebarTab}
            setActiveTab={setSidebarTab}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            onSearch={handleSearch}
            onAbandonSearch={handleAbandonSearch}
            isSearchLoading={isSearchLoading}
            searchActiveLayersOnly={searchActiveLayersOnly}
            setSearchActiveLayersOnly={setSearchActiveLayersOnly}
            recentSearches={recentSearches}
            savedSearches={savedSearches}
            onToggleSaveSearch={toggleSaveSearch}
            searchResults={searchResults}
            totalResultsCount={totalResultsCount}
            isSearchResultsVisible={isSearchResultsVisible}
            collapsedGroups={collapsedGroups}
            setCollapsedGroups={setCollapsedGroups}
            onResultItemClick={handleResultItemClick}
            selectedFeatures={selectedFeatures}
            onZoomToFeature={handleZoomToFeature}
            onRemoveFromSelection={handleRemoveFromSelection}
            onClearSelection={() => setSelectedFeatures([])}
            isMultiSelectMode={isMultiSelectMode}
            onToggleMultiSelect={() => {
              setIsMultiSelectMode(!isMultiSelectMode);
              showToast(isMultiSelectMode ? 'Multiseleção desativada.' : 'Multiseleção ativada! Clique em várias áreas.');
            }}
            onSearchPolygonAddresses={handleSearchPolygonAddresses}
            onSearchLocalidadeAddresses={handleSearchLocalidadeAddresses}
            onSearchHospitaisByMunicipio={handleExecuteHospitalSearchByMunicipio}
            onSearchHospitaisByRadius={handleExecuteHospitalSearchByRadius}
            cnefeMunicipios={cnefeMunicipios}
            isHospitalSearching={isHospitalSearching}
            onOpenCnefeBottomBar={() => {
              setIsCnefeBottomBarOpen(true);
              setIsCnefeBottomBarExpanded(true);
            }}
            activeLayers={activeLayers}
            setActiveLayers={setActiveLayers}
            allowedLayerNames={allowedLayerNames || []}
            currentActiveUser={currentActiveUser}
            userRole={userRole}
            isMaster={isMaster}
            isManager={isManager}
            isAdmin={isAdmin}
            isDarkMode={isDarkMode}
            onToggleDarkMode={() => setIsDarkMode(prev => !prev)}
            onOpenAdminPanel={() => {
              if (isAdmin) setIsAdminModalOpen(true);
              else handleOpenAdminLogin();
            }}
            onOpenProfileModal={() => {
              if (currentActiveUser) setIsProfileModalOpen(true);
              else setIsUserLoginModalOpen(true);
            }}
            onLogout={handleLogout}
            onOpenHelp={() => setSidebarTab(prev => prev === 'help' ? null : 'help')}
            showToast={showToast}
            onPlotAddress={handlePlotAddress}
            onPlotAllAddresses={handlePlotAllAddresses}
            onClearPlot={handleClearPlot}
            cnefeExternalResult={cnefeExternalResult}
            allowedColumns={effectiveSession?.addressColumnsPermissions}
            allowedProperties={effectiveSession?.featurePropertiesPermissions}
            featurePermissions={featurePermissions}
            effectiveSession={effectiveSession}
            isSimulatingUser={isSimulatingUser}
            simulatedRole={simulatedRole}
            onExitSimulation={handleExitSimulation}
            onOpenSimulationChoice={() => setIsSimulationChoiceModalOpen(true)}
            onOpenFullTableModal={() => setIsFullTableModalOpen(true)}
            onOpenExportModal={() => setSidebarTab('export')}
          />
        )}
        
        {/* CONTAINER DO MAPA (100% WIDTH / HEIGHT) */}
        <div className="flex-1 w-full h-full relative overflow-hidden">
          <MapComponent 
            isPrintMode={isPrintMode}
            isStage2Open={!!sidebarTab}
            isMultiSelectMode={isMultiSelectMode}
            onToggleMultiSelect={() => {
              setIsMultiSelectMode(!isMultiSelectMode);
              showToast(isMultiSelectMode ? 'Multiseleção desativada.' : 'Multiseleção ativada! Clique em várias áreas.');
            }}
            selectedFeatures={selectedFeatures}
            onSelectionChange={(features) => {
              setSelectedFeatures(prev => {
                const nextFeatures = typeof features === 'function' ? features(prev) : features;
                if (nextFeatures.length === 0 && prev.length === 0) return prev;
                if (nextFeatures.length > prev.length) {
                  const newest = nextFeatures[nextFeatures.length - 1];
                  if (newest && newest.name) {
                    logActivity('FEICAO', `Selecionou feição no mapa: "${newest.name}"`, userRole, `Camada: ${newest.sourceName} • Total selecionadas: ${nextFeatures.length}`);
                  }
                }
                return nextFeatures;
              });
            }}
            showToast={showToast}
            statusText={statusText}
            setStatusText={setStatusText}
            isLoading={isLoading}
            setIsLoading={setIsLoading}
            activeLayers={activeLayers}
            setActiveLayers={(layers: any) => {
              const nextLayers: string[] = typeof layers === 'function' ? layers(activeLayers) : layers;
              const added = nextLayers.filter(l => !activeLayers.includes(l));
              const removed = activeLayers.filter(l => !nextLayers.includes(l));
              if (added.length > 0) {
                logActivity('CAMADA', `Ativou camada(s): ${added.join(', ')}`, userRole);
              }
              if (removed.length > 0) {
                logActivity('CAMADA', `Desativou camada(s): ${removed.join(', ')}`, userRole);
              }
              setActiveLayers(nextLayers);
            }}
            setMapInstance={setMapInstance}
            registerMapActions={(actions) => {
              mapActionsRef.current = actions;
            }}
            allowedLayerNames={allowedLayerNames}
            allowMeasureTool={isAdmin || featurePermissions.allowMeasureTool !== false}
            allowLayerPanel={isAdmin || featurePermissions.allowLayerPanel !== false}
            searchCoordinates={searchCoordinates}
            onMeasureChange={(latlngs) => {
              setMeasureHistory(latlngs);
              if (latlngs && latlngs.length >= 2) {
                logActivity('MEDICAO', `Ferramenta de régua/medição utilizada`, userRole, `${latlngs.length} pontos marcados no mapa`);
              }
            }}
            measureHistory={measureHistory}
            onSearchCoordinate={(coordStr) => {
              setSearchQuery(coordStr);
              handleSearch(coordStr);
            }}
            onSearchPolygonAddresses={handleSearchPolygonAddresses}
            onSaveFavoriteLayers={handleSaveFavoriteLayers}
            onLoadFavoriteLayers={handleLoadFavoriteLayers}
            isBottomBarOpen={isCnefeBottomBarOpen}
            isBottomBarExpanded={isCnefeBottomBarExpanded}
            isBottomBarMaximized={isCnefeBottomBarMaximized}
          />

          {/* BARRA INFERIOR DE BUSCA DE ENDEREÇOS CNEFE (IBGE) */}
          <CnefeBottomBar
            isOpen={isCnefeBottomBarOpen}
            isStage2Open={!!sidebarTab}
            isExpanded={isCnefeBottomBarExpanded}
            onOpen={() => setIsCnefeBottomBarOpen(true)}
            onClose={() => setIsCnefeBottomBarOpen(false)}
            onToggleExpand={() => {
              setIsCnefeBottomBarExpanded(prev => {
                const next = !prev;
                if (!next) {
                  setIsCnefeBottomBarMaximized(false);
                }
                return next;
              });
            }}
            isMaximized={isCnefeBottomBarMaximized}
            onToggleMaximize={() => setIsCnefeBottomBarMaximized(prev => !prev)}
            onPlotAddress={handlePlotAddress}
            onPlotAllAddresses={handlePlotAllAddresses}
            onClearPlot={handleClearPlot}
            onClearExternalResult={() => {
              setCnefeExternalResult(null);
              setSearchCoordinates(null);
            }}
            externalPolygonResult={cnefeExternalResult}
            allowedColumns={effectiveSession?.addressColumnsPermissions}
            hasPlottedMarkers={!!(searchCoordinates && searchCoordinates.length > 0)}
          />
        </div>
      </div>

      {/* MODAL EXPANDIDO DE TABELA DE ATRIBUTOS */}
      {isFullTableModalOpen && (
        <div className="fixed inset-0 z-[3000] bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-6xl max-h-[90vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
              <div className="flex items-center gap-2.5">
                <Table2 className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">
                  Tabela Completa de Atributos ({selectedFeatures.length} selecionadas)
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsFullTableModalOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-200/70 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 flex items-center justify-center text-slate-600 dark:text-slate-200 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 overflow-auto p-4">
              <PropertyTable
                selectedFeatures={selectedFeatures}
                showToast={showToast}
                allowedProperties={isAdmin ? undefined : effectiveSession.featurePropertiesPermissions}
                onSearchPolygonAddresses={handleSearchPolygonAddresses}
                onSearchLocalidadeAddresses={handleSearchLocalidadeAddresses}
              />
            </div>
          </div>
        </div>
      )}

{/* Modal de exportação agora está integrado diretamente na barra lateral */}

      {/* MODAL DO PAINEL DO ADMINISTRADOR / GERENTE (Carregado apenas quando acionado) */}
      {isAdminModalOpen && (
        <Suspense fallback={
          <div className="fixed inset-0 z-[10005] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-2xl flex items-center gap-3 text-slate-800 dark:text-slate-100">
              <Loader2 className="w-6 h-6 animate-spin text-red-600" />
              <span className="font-bold text-sm">Carregando painel de gerenciamento...</span>
            </div>
          </div>
        }>
          <AdminPanelModal
            isOpen={isAdminModalOpen}
            onClose={() => {
              setIsAdminModalOpen(false);
              refreshPermissions();
            }}
            currentUserRole={isSimulatingUser ? simulatedRole : (currentActiveUser?.role || userRole)}
            currentActiveUser={isSimulatingUser ? (simulatedTargetUser || currentActiveUser) : currentActiveUser}
            layerPermissions={getLayerPermissions(dataSources.map(s => s.name))}
            onUpdateLayerPermissions={(newPerms) => {
              setLayerPermissions(newPerms);
              refreshPermissions();
            }}
            featurePermissions={getFeaturePermissions()}
            onUpdateFeaturePermissions={(newPerms) => {
              setFeaturePermissions(newPerms);
              refreshPermissions();
            }}
            addressColumnsPermissions={getAddressColumnsPermissions()}
            onUpdateAddressColumnsPermissions={() => {
              refreshPermissions();
            }}
            featurePropertiesPermissions={getFeaturePropertiesPermissions()}
            onUpdateFeaturePropertiesPermissions={() => {
              refreshPermissions();
            }}
            onSimulateUser={(targetSessionId, targetRole) => {
              const role = targetRole === 'manager' ? 'manager' : 'user';
              const target = getRegisteredUsers().find(u => u.id === targetSessionId);
              handleStartSimulation(role, target, targetSessionId);
            }}
            onOpenSimulationChoice={() => {
              setIsSimulationChoiceModalOpen(true);
            }}
            showToast={showToast}
          />
        </Suspense>
      )}

      {/* ================= MODAL: ESCOLHA DE VISÃO DE SIMULAÇÃO (MASTER) ================= */}
      <AnimatePresence>
        {isSimulationChoiceModalOpen && (
          <div 
            className="fixed inset-0 top-0 left-0 right-0 bottom-0 z-[10005] w-screen h-screen min-h-[100dvh] bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-fadeIn"
            onClick={() => setIsSimulationChoiceModalOpen(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              transition={{ type: 'spring', damping: 25, stiffness: 350 }}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden my-auto"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header do Modal */}
              <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 p-5 text-white flex items-center justify-between border-b border-slate-700">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-amber-500/20 border border-amber-500/40 text-amber-400 flex items-center justify-center shrink-0">
                    <Crown className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-white">Simular Visão do Sistema</h3>
                    <p className="text-xs text-slate-400">Escolha qual perfil você deseja testar no WebGIS</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsSimulationChoiceModalOpen(false)}
                  className="p-1.5 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Opções de Simulação */}
              <div className="p-5 space-y-3.5">
                {/* Opção 1: Visitante Comum */}
                <div 
                  onClick={() => handleStartSimulation('user')}
                  className="p-4 rounded-2xl border-2 border-slate-200 dark:border-slate-800 hover:border-red-500 dark:hover:border-red-500 bg-slate-50/70 dark:bg-slate-800/50 hover:bg-red-50/50 dark:hover:bg-red-950/20 transition-all cursor-pointer group flex items-start gap-3.5"
                >
                  <div className="w-11 h-11 rounded-2xl bg-slate-200 dark:bg-slate-700 group-hover:bg-red-600 text-slate-700 dark:text-slate-200 group-hover:text-white flex items-center justify-center shrink-0 transition-colors shadow-sm">
                    <User className="w-5 h-5" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <h4 className="text-sm font-black text-slate-800 dark:text-slate-100 group-hover:text-red-600 dark:group-hover:text-red-400 transition-colors">
                        👤 Visitante / Usuário Comum
                      </h4>
                      <span className="text-[10px] font-black uppercase bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-2 py-0.5 rounded-md">
                        Restrito
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                      Veja o WebGIS exatamente como o público geral vê (apenas camadas autorizadas, sem botões ou painel administrativo).
                    </p>
                  </div>
                </div>

                {/* Opção 2: Gerente */}
                <div 
                  onClick={() => handleStartSimulation('manager')}
                  className="p-4 rounded-2xl border-2 border-slate-200 dark:border-slate-800 hover:border-indigo-500 dark:hover:border-indigo-500 bg-slate-50/70 dark:bg-slate-800/50 hover:bg-indigo-50/50 dark:hover:bg-indigo-950/20 transition-all cursor-pointer group flex items-start gap-3.5"
                >
                  <div className="w-11 h-11 rounded-2xl bg-indigo-100 dark:bg-indigo-950/80 group-hover:bg-indigo-600 text-indigo-700 dark:text-indigo-300 group-hover:text-white flex items-center justify-center shrink-0 transition-colors shadow-sm">
                    <Briefcase className="w-5 h-5" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <h4 className="text-sm font-black text-slate-800 dark:text-slate-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                        👔 Gerente (Manager)
                      </h4>
                      <span className="text-[10px] font-black uppercase bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 px-2 py-0.5 rounded-md border border-indigo-200 dark:border-indigo-800">
                        Gerência
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                      Veja o WebGIS como um Gerente (acesso ao Painel de Gerência simplificado, criação de logins de equipe e alteração de senhas permitidas).
                    </p>
                  </div>
                </div>

                {/* Opção 3: Simular Usuário Cadastrado Específico */}
                <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-800/30 space-y-2.5">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                    👥 Simular Conta de Usuário Específica:
                  </label>
                  <div className="flex items-center gap-2">
                    <select
                      value={simulatedSelectedUserId}
                      onChange={(e) => setSimulatedSelectedUserId(e.target.value)}
                      className="flex-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 dark:text-slate-100 outline-none cursor-pointer"
                    >
                      <option value="">Selecione um usuário cadastrado...</option>
                      {getRegisteredUsers().map(u => (
                        <option key={u.id} value={u.id}>
                          {u.role === 'manager' ? '👔' : '👤'} {u.name} (@{u.username})
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      disabled={!simulatedSelectedUserId}
                      onClick={() => {
                        const target = getRegisteredUsers().find(u => u.id === simulatedSelectedUserId);
                        if (target) {
                          handleStartSimulation(target.role === 'manager' ? 'manager' : 'user', target, target.id);
                        }
                      }}
                      className="px-3.5 py-2 bg-slate-900 hover:bg-black disabled:bg-slate-300 text-white dark:bg-slate-700 dark:hover:bg-slate-600 dark:disabled:bg-slate-800 font-bold rounded-xl text-xs transition-all cursor-pointer shrink-0 disabled:cursor-not-allowed"
                    >
                      Simular
                    </button>
                  </div>
                </div>
              </div>

              {/* Rodapé */}
              <div className="bg-slate-50 dark:bg-slate-800/80 px-5 py-3.5 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
                {isSimulatingUser && (
                  <button
                    type="button"
                    onClick={handleExitSimulation}
                    className="px-3.5 py-2 bg-red-50 hover:bg-red-100 text-red-600 rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5"
                  >
                    <Crown className="w-3.5 h-3.5" />
                    <span>Sair da Simulação Atual</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setIsSimulationChoiceModalOpen(false)}
                  className="ml-auto px-4 py-2 bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL DE CONTA DO USUÁRIO / VISITANTE (Carregado apenas sob demanda) */}
      {isProfileModalOpen && (
        <Suspense fallback={null}>
          <UserProfileModal
            isOpen={isProfileModalOpen}
            onClose={() => setIsProfileModalOpen(false)}
            currentUser={currentActiveUser}
            userRole={userRole}
            visitorDisplayName={effectiveSession.customName || 'Visitante'}
            sessionId={currentSessionId}
            onUserUpdated={(updatedUser) => {
              setCurrentActiveUser(updatedUser);
              setCurrentActiveUserState(updatedUser);
              setUserRole(updatedUser.role || 'user');
              refreshPermissions();
            }}
            onVisitorNameUpdated={() => {
              refreshPermissions();
            }}
            onLogout={handleLogout}
            showToast={showToast}
          />
        </Suspense>
      )}

      {/* NOTIFICAÇÃO TOAST TEMPORÁRIA (SEMPRE NO TOPO DE QUALQUER MODAL / PAINEL) */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div 
            initial={{ opacity: 0, y: 30, x: '-50%', scale: 0.9 }}
            animate={{ opacity: 1, y: 0, x: '-50%', scale: 1 }}
            exit={{ opacity: 0, y: 20, x: '-50%', scale: 0.9 }}
            transition={{ type: 'spring', damping: 25, stiffness: 350 }}
            className="fixed bottom-8 left-1/2 -translate-x-1/2 bg-slate-900/95 dark:bg-slate-900/95 text-white px-5 py-3 rounded-2xl shadow-2xl z-[99999] font-bold text-xs sm:text-sm flex items-center gap-3 border border-slate-700/80 backdrop-blur-md max-w-[92vw] text-center"
          >
            <div className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-500/30">
              <Check className="w-3.5 h-3.5" />
            </div>
            <span className="tracking-tight leading-snug">{toastMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>



      {/* MODAL DE AJUDA AGORA INTEGRADO NA BARRA LATERAL (AppleSidebar) */}
    </div>
  );
}