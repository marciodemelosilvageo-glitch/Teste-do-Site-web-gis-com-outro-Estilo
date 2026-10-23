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
  UserCheck, UserPlus, Crown, Briefcase, AlertTriangle, Loader2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import L from 'leaflet';

import { MapComponent } from './components/MapComponent';
import { IbgeSearchPanel, ExternalPolygonSearchResult } from './components/IbgeSearchPanel';
import { PropertyTable } from './components/PropertyTable';
import { SelectedFeature, GroupedSearchResults, SearchResultItem } from './types';
import { dataSources, PRIORITY_KEYS, propertyNames, DEFAULT_ACTIVE_LAYERS } from './data';
import { normalizeString, levenshteinDistance, getIdentifier, getTranslatedValue, haversineDistanceMeters } from './utils';
import { buscarEnderecosPorPoligono } from './duckdb';

// Carregamento sob demanda (Lazy Loading) para componentes pesados
const AdminPanelModal = lazy(() => import('./components/AdminPanelModal').then(m => ({ default: m.AdminPanelModal })));
const Dashboard = lazy(() => import('./components/Dashboard').then(m => ({ default: m.Dashboard })));
const ExportDashboard = lazy(() => import('./components/ExportDashboard').then(m => ({ default: m.ExportDashboard })));
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
  const [searchCoordinates, setSearchCoordinates] = useState<Array<{ lat: number; lng: number; label?: string; details?: string[]; isCoordSearch?: boolean }> | null>(null);

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
        const measureBtn = document.querySelector('.leaflet-control-measure-toggle, a.leaflet-control-measure-toggle') as HTMLElement;
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
      isCoordSearch: false
    }]);

    if (mapInstance) {
      mapInstance.setView([lat, lng], 17);
    }
    
    logActivity('ENDERECO', `Plotou endereço no mapa: "${addrLabel}"`, userRole, `Município: ${row.municipio || row.MUNICIPIO || '-'}`);
    showToast(`Plotando endereço no mapa...`);
    
    // Rolar a tela para o topo para ver o mapa
    window.scrollTo({ top: 0, behavior: 'smooth' });
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
          isCoordSearch: false
        };
      })
      .filter(Boolean) as Array<{ lat: number; lng: number; label?: string; details?: string[]; isCoordSearch?: boolean }>;

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
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleClearPlot = () => {
    setSearchCoordinates(null);
    logActivity('ENDERECO', 'Limpou marcadores de endereços do mapa', userRole);
    showToast('Coordenadas removidas do mapa.');
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
        {/* Papel de parede de fundo desfocado (borrado) */}
        <div className="fixed inset-0 z-[-2] pointer-events-none overflow-hidden bg-white dark:bg-slate-900">
          <div 
            className="absolute inset-[-10%] w-[120%] h-[120%] filter blur-[15px] scale-105"
            style={{
              backgroundImage: "url('https://raw.githubusercontent.com/marciodemelosilvageo-glitch/GeoCode/main/logo/banner-mock.webp')",
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              backgroundAttachment: 'fixed',
            }}
          />
        </div>
        {/* Camada de Desfoque de Fundo para Efeito Vidro */}
        <div className="fixed inset-0 bg-white/40 dark:bg-slate-900/80 backdrop-blur-md z-[-1]" />

        {/* Card de Entrada */}
        <motion.div 
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="w-full max-w-lg bg-white/85 dark:bg-slate-900/85 backdrop-blur-2xl rounded-3xl p-8 sm:p-11 shadow-2xl border border-white/70 dark:border-slate-800/80 flex flex-col items-center text-center space-y-7"
        >
          {/* Logo Principal */}
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.2, duration: 0.6 }}
          >
            <img 
              src={CURRENT_APP_LOGO} 
              alt="Logo WebGis" 
              className="h-28 sm:h-32 drop-shadow-2xl hover:scale-105 transition-transform duration-300" 
            />
          </motion.div>

          {/* Título e Texto com Tipografia Premium */}
          <div className="space-y-3">
            <h1 className="font-display text-4xl sm:text-5xl font-black tracking-tight text-slate-900 dark:text-white">
              WebGis
            </h1>
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-red-500/10 text-red-700 dark:text-red-400 border border-red-500/20 text-xs sm:text-sm font-bold tracking-widest uppercase font-grotesk shadow-2xs">
              <span className="w-2 h-2 rounded-full bg-red-600 animate-pulse" />
              Inteligência Geográfica
            </div>
            <p className="font-sans text-slate-700 dark:text-slate-300 text-sm sm:text-base leading-relaxed font-normal pt-1">
              Explore camadas de dados geoespaciais, faça consultas avançadas e analise informações municipais em uma interface interativa de alto desempenho.
            </p>
          </div>

          {/* Opções de Acesso: Lembrete de Conta Anterior & Visitante */}
          <div className="w-full space-y-3.5 pt-1">
            {/* 0. Card de Memória / Lembrete de Conta Anterior */}
            {lastPreviousUser && (
              <div className="w-full bg-slate-50 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700/80 rounded-2xl p-3.5 text-left space-y-2.5 shadow-sm animate-fadeIn">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-red-100 dark:bg-red-950/80 text-red-600 dark:text-red-400 flex items-center justify-center font-bold text-xs">
                      {lastPreviousUser.role === 'master' ? <Crown className="w-4 h-4 text-amber-500" /> : (lastPreviousUser.role === 'manager' ? <Briefcase className="w-4 h-4 text-indigo-500" /> : <User className="w-4 h-4" />)}
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-800 dark:text-slate-100">
                        {lastPreviousUser.name}
                      </p>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                        @{lastPreviousUser.username}
                      </p>
                    </div>
                  </div>
                  <span className="text-[10px] font-bold bg-slate-200/80 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-2 py-0.5 rounded-md">
                    Último Acesso
                  </span>
                </div>

                <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-snug">
                  Na última vez você logou nesta conta. Deseja continuar nela?
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
                        className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl pl-3 pr-9 py-2 text-xs text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-red-500"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPreviousUserPassword(!showPreviousUserPassword)}
                        className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                      >
                        {showPreviousUserPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>

                    {previousUserError && (
                      <p className="text-[11px] text-red-600 dark:text-red-400 font-bold">{previousUserError}</p>
                    )}

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setPromptPasswordForPreviousUser(false);
                          setPreviousUserPasswordInput('');
                          setPreviousUserError(null);
                        }}
                        className="px-3 py-1.5 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                      >
                        Cancelar
                      </button>
                      <button
                        type="button"
                        onClick={handleContinueWithPreviousUser}
                        disabled={isPreviousUserSubmitting}
                        className="flex-1 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50"
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
                      className="flex-1 py-1.5 bg-slate-200/80 dark:bg-slate-700/80 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold transition-colors cursor-pointer"
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
                      className="flex-1 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer flex items-center justify-center gap-1"
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
              <label className="block text-xs font-bold text-slate-600 dark:text-slate-300">
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
                  className={`w-full bg-slate-50 dark:bg-slate-800/90 border rounded-2xl pl-9 pr-3.5 py-3 text-xs sm:text-sm font-medium transition-all ${
                    detectedExistingUser
                      ? 'border-amber-400 dark:border-amber-600 ring-2 ring-amber-400/25 text-slate-900 dark:text-slate-100'
                      : 'border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-red-500'
                  }`}
                />
                <User className="w-4 h-4 text-slate-400 absolute left-3 top-3.5" />
              </div>

              {/* Status do Nome em Tempo Real */}
              {isCheckingWelcomeName && (
                <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-400 pl-1 pt-0.5 animate-fadeIn">
                  <Loader2 className="w-3 h-3 animate-spin text-slate-400" />
                  <span>Consultando usuário no banco de dados...</span>
                </div>
              )}

              {!isCheckingWelcomeName && detectedExistingUser && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-3 bg-amber-50 dark:bg-amber-950/80 border border-amber-300 dark:border-amber-700/80 rounded-2xl text-left flex items-center gap-2.5 shadow-sm mt-1 animate-fadeIn"
                >
                  <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400" />
                  <div className="text-xs">
                    <p className="font-bold text-amber-950 dark:text-amber-100">
                      O nome de usuário já existe.
                    </p>
                    <p className="text-[11px] text-amber-800 dark:text-amber-300 font-medium">
                      Digite a senha para entrar no site.
                    </p>
                  </div>
                </motion.div>
              )}

              {!isCheckingWelcomeName && !detectedExistingUser && visitorNameInput.trim().length >= 3 && (
                <div className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-600 dark:text-emerald-400 pl-1 pt-0.5 animate-fadeIn">
                  <Check className="w-3.5 h-3.5 text-emerald-500" />
                  <span>Nome disponível como Visitante ou Nova Conta</span>
                </div>
              )}
            </div>

            {/* Campo Dinâmico de Senha (Aparece quando o usuário digita algum nome) */}
            <AnimatePresence>
              {visitorNameInput.trim().length > 0 && (
                <motion.div
                  initial={{ opacity: 0, height: 0, y: -6 }}
                  animate={{ opacity: 1, height: 'auto', y: 0 }}
                  exit={{ opacity: 0, height: 0, y: -6 }}
                  transition={{ duration: 0.25, ease: "easeOut" }}
                  className="space-y-1.5 text-left overflow-hidden"
                >
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 flex items-center justify-between">
                    {detectedExistingUser ? (
                      <span className="flex items-center gap-1.5 text-amber-700 dark:text-amber-400 font-bold">
                        <KeyRound className="w-3.5 h-3.5" />
                        Digite a senha para entrar no site:
                      </span>
                    ) : (
                      <span>Senha de Acesso (para criar ou proteger sua conta):</span>
                    )}
                    <span className="text-[10px] text-slate-400 font-normal">
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
                      className={`w-full bg-slate-50 dark:bg-slate-800/90 border rounded-2xl pl-9 pr-10 py-3 text-xs sm:text-sm font-medium transition-all ${
                        detectedExistingUser
                          ? 'border-amber-400 dark:border-amber-600 ring-2 ring-amber-400/20 text-slate-900 dark:text-slate-100 focus:ring-amber-500'
                          : 'border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-red-500'
                      }`}
                    />
                    <KeyRound className="w-4 h-4 text-slate-400 absolute left-3 top-3.5" />
                    <button
                      type="button"
                      onClick={() => setShowVisitorPassword(!showVisitorPassword)}
                      className="absolute right-3 top-3.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                      tabIndex={-1}
                    >
                      {showVisitorPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>

                  {detectedExistingUser && (
                    <div className="flex items-center justify-between text-[11px] pt-0.5 px-1">
                      <span className="text-slate-500 dark:text-slate-400">Não é sua conta?</span>
                      <button
                        type="button"
                        onClick={() => {
                          setVisitorNameInput('');
                          setVisitorPasswordInput('');
                          setDetectedExistingUser(null);
                          setWelcomeError(null);
                        }}
                        className="text-red-600 hover:text-red-700 dark:text-red-400 font-bold cursor-pointer hover:underline"
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
                  className="p-3 bg-red-50 dark:bg-red-950/60 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800/70 rounded-2xl text-xs font-bold flex flex-col gap-2 text-left animate-shake"
                >
                  <div className="flex items-start gap-2.5">
                    <AlertTriangle className="w-4 h-4 shrink-0 text-red-600 mt-0.5" />
                    <span className="leading-snug">{welcomeError}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleEnterPureVisitor(visitorNameInput)}
                    className="self-end px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded-lg text-[11px] font-bold transition-colors cursor-pointer"
                  >
                    Entrar como Visitante com este Nome
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Botão de Acesso Principal */}
            <div className="w-full">
              {/* 1. Botão Principal: Acessar como Visitante / Entrar com Senha */}
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleEnterAsUser}
                disabled={isWelcomeSubmitting}
                className="w-full py-3.5 bg-gradient-to-r from-red-600 via-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 text-white font-display font-bold text-sm tracking-wide rounded-2xl shadow-xl shadow-red-600/30 transition-all flex items-center justify-center gap-2 cursor-pointer group disabled:opacity-75 disabled:cursor-not-allowed"
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
                          : (visitorNameInput.trim() ? 'Acessar com este Nome' : 'Acessar como Visitante'))}
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
            
            {/* 2. Botão de Login Discreto */}
            <div className="pt-2">
              <button
                onClick={handleOpenUserLogin}
                className="text-xs font-bold text-slate-500 hover:text-red-600 dark:text-slate-400 dark:hover:text-red-400 transition-colors cursor-pointer flex items-center justify-center gap-1.5 w-full mx-auto"
              >
                <KeyRound className="w-3.5 h-3.5" />
                <span>Login</span>
              </button>
            </div>
          </div>

          {/* Footer discreto */}
          <p className="text-slate-400 text-xs font-mono pt-4">
            &copy; {new Date().getFullYear()} WebGis. Todos os direitos reservados.
          </p>
        </motion.div>

        {/* Modal de Login de Usuário Cadastrado (Usuário Ativo) */}
        {isUserLoginModalOpen && (
          <div 
            className="fixed inset-0 top-0 left-0 right-0 bottom-0 z-[9999] w-screen h-screen min-h-[100dvh] bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4 animate-fadeIn"
            onClick={() => setIsUserLoginModalOpen(false)}
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl max-w-sm w-full p-6 text-left space-y-5"
            >
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-red-100 dark:bg-red-950/80 text-red-600 dark:text-red-400">
                    <UserCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-slate-900 dark:text-slate-100">
                      Login de Usuário
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Acesse com seu login institucional
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsUserLoginModalOpen(false)}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-lg cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleConfirmUserLogin} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                    Usuário / Login:
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-slate-400 font-mono text-xs font-bold">@</span>
                    <input 
                      type="text"
                      value={userLoginInput}
                      onChange={(e) => setUserLoginInput(e.target.value)}
                      placeholder="seu.usuario"
                      autoFocus
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl pl-7 pr-3.5 py-2.5 text-sm text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-red-500 font-mono font-bold"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                    Senha de Acesso:
                  </label>
                  <div className="relative">
                    <input 
                      type={showUserPassword ? "text" : "password"}
                      value={userPasswordInput}
                      onChange={(e) => setUserPasswordInput(e.target.value)}
                      placeholder="Digite sua senha..."
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl pl-3.5 pr-10 py-2.5 text-sm text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-red-500 font-semibold"
                    />
                    <button
                      type="button"
                      onClick={() => setShowUserPassword(!showUserPassword)}
                      className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                    >
                      {showUserPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {userLoginError && (
                  <div className="p-3 bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800/60 rounded-xl text-xs font-bold flex items-center gap-2 animate-shake">
                    <X className="w-4 h-4 shrink-0 text-red-600" />
                    <span>{userLoginError}</span>
                  </div>
                )}

                <div className="flex items-center gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsUserLoginModalOpen(false)}
                    className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold rounded-xl text-xs transition-colors cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isUserLoginSubmitting}
                    className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl text-xs transition-all shadow-md shadow-red-600/30 cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50"
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

  // Tela de Acesso Suspenso para Usuários Bloqueados Individualmente pelo Administrador
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
    <div className={`relative min-h-screen w-full flex flex-col items-center p-1 sm:p-2.5 md:p-3.5 space-y-3 font-sans select-none overflow-x-hidden ${isPrintMode ? 'bg-white' : ''}`}>
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
      {/* Papel de parede de fundo desfocado (borrado) - Corrigido para não bugar no fundo */}
      <div className="fixed inset-0 z-[-2] pointer-events-none overflow-hidden bg-white dark:bg-slate-900">
        <div 
          className="absolute inset-[-10%] w-[120%] h-[120%] filter blur-[15px] scale-105"
          style={{
            backgroundImage: "url('https://raw.githubusercontent.com/marciodemelosilvageo-glitch/GeoCode/main/logo/banner-mock.webp')",
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            backgroundAttachment: 'fixed',
          }}
        />
      </div>
      {/* Camada de Desfoque de Fundo para Efeito Vidro */}
      <div className="fixed inset-0 bg-white/40 dark:bg-slate-900/80 backdrop-blur-md z-[-1]" />

      {/* BANNER FLUTUANTE DE SIMULAÇÃO (EXCLUSIVO DO MASTER) */}
      {isRealMaster && isSimulatingUser && (
        <div className="w-full bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 text-white font-bold px-4 py-3 rounded-2xl shadow-xl border border-amber-300/40 flex flex-col sm:flex-row items-center justify-between gap-3 z-[2500] animate-fadeIn select-none">
          <div className="flex items-center gap-3 text-xs sm:text-sm">
            <div className="w-8 h-8 rounded-xl bg-black/20 flex items-center justify-center shrink-0 border border-white/20">
              <Eye className="w-4 h-4 text-white" />
            </div>
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider text-amber-100 block">
                Modo de Simulação Ativo (Master)
              </span>
              <span className="font-extrabold text-white flex items-center gap-1.5 flex-wrap">
                Vendo o WebGIS como:{' '}
                <span className="bg-slate-950/80 text-amber-300 px-2.5 py-0.5 rounded-lg border border-amber-400/40 font-mono text-xs">
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
              className="px-3 py-1.5 bg-slate-950/70 hover:bg-slate-950 text-amber-200 rounded-xl text-xs font-bold transition-all cursor-pointer border border-amber-400/30 flex items-center gap-1.5 shadow-sm"
              title="Trocar para visão de Gerente ou outro usuário"
            >
              <Eye className="w-3.5 h-3.5" />
              <span>Trocar Visão</span>
            </button>

            <button
              type="button"
              onClick={() => setIsAdminModalOpen(true)}
              className="px-3 py-1.5 bg-black/30 hover:bg-black/50 text-white rounded-xl text-xs font-bold transition-all cursor-pointer border border-white/20 flex items-center gap-1.5 shadow-sm"
              title="Abrir Painel Master para ajustar permissões"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>Painel Master</span>
            </button>

            <button
              type="button"
              onClick={handleExitSimulation}
              className="px-3.5 py-1.5 bg-white hover:bg-amber-50 text-slate-950 rounded-xl text-xs font-black transition-all cursor-pointer shadow-md flex items-center gap-1.5 hover:scale-105 active:scale-95"
              title="Encerrar simulação e voltar para visão total de Master"
            >
              <Crown className="w-4 h-4 text-amber-600 fill-amber-500" />
              <span>Voltar para Visão Master</span>
            </button>
          </div>
        </div>
      )}

      {/* QUADRO PRINCIPAL */}
      <main className={`w-full bg-white dark:bg-slate-900 z-10 ${isPrintMode ? 'fixed inset-0 m-0 p-0 rounded-none flex flex-col md:flex-row z-[9999] bg-slate-200 dark:bg-slate-800 print:bg-white print:block' : 'rounded-2xl shadow-2xl p-2.5 sm:p-4 space-y-3 border border-slate-200/60 dark:border-slate-800/60'}`}>
        
        {/* CABEÇALHO E BUSCA */}
        {!isPrintMode && (
          <header className="flex flex-col lg:flex-row items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3 relative z-40">
            {/* Logo e Branding - Clique duplo secreto para login ADM */}
            <div className="flex items-center gap-3">
              <div 
                className="bg-white rounded-xl p-1 shadow-sm border border-slate-200 cursor-pointer select-none"
                onDoubleClick={handleOpenAdminLogin}
                title="WebGis"
              >
                <img 
                  src={CURRENT_APP_LOGO} 
                  alt="Logo WebGis" 
                  className="h-14 sm:h-16 hover:scale-105 transition-transform select-none pointer-events-none" 
                />
              </div>
            </div>


            {/* Controles de Administrador / Gerente / Usuário e Toggle Tema Escuro */}
            <div className="flex items-center gap-2 flex-wrap justify-end">
              {/* Badge e Controles do Master */}
              {isMaster && (
                <div className="flex items-center gap-1.5 bg-gradient-to-r from-red-600 via-rose-600 to-red-700 text-white px-2.5 sm:px-3 py-1.5 rounded-2xl shadow-xs border border-red-500/30 text-xs font-bold animate-fadeIn">
                  <button
                    type="button"
                    onClick={() => setIsProfileModalOpen(true)}
                    className="flex items-center gap-1.5 hover:bg-white/20 px-2 py-1 rounded-xl transition-colors cursor-pointer"
                    title="Clique para abrir Sua Conta (Editar nome, usuário ou senha)"
                  >
                    <Crown className="w-4 h-4 text-amber-300 shrink-0" />
                    <span>MASTER</span>
                    {currentActiveUser && (
                      <span className="hidden xl:inline text-red-100 font-normal">
                        ({currentActiveUser.name})
                      </span>
                    )}
                  </button>
                  
                  <button
                    type="button"
                    onClick={() => setIsAdminModalOpen(true)}
                    className="px-2 py-1 bg-white/20 hover:bg-white/30 text-white rounded-lg transition-colors cursor-pointer flex items-center gap-1 text-[11px]"
                    title="Abrir Painel do Administrador Master"
                  >
                    <SlidersHorizontal className="w-3.5 h-3.5" />
                    <span>Painel Master</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsSimulationChoiceModalOpen(true)}
                    className="px-2.5 py-1 bg-white/20 hover:bg-white/30 text-white rounded-lg transition-colors cursor-pointer text-[11px] flex items-center gap-1.5"
                    title="Simular a visão de Visitante ou Gerente"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Testar Visão</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleLogout}
                    className="p-1 bg-black/20 hover:bg-black/40 text-white rounded-lg transition-colors cursor-pointer"
                    title="Sair do Modo Master e voltar para a tela inicial"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              {/* Badge e Controles do Gerente */}
              {isManager && (
                <div className="flex items-center gap-1.5 bg-gradient-to-r from-indigo-600 via-blue-600 to-indigo-700 text-white px-2.5 sm:px-3 py-1.5 rounded-2xl shadow-xs border border-indigo-500/30 text-xs font-bold animate-fadeIn">
                  <button
                    type="button"
                    onClick={() => setIsProfileModalOpen(true)}
                    className="flex items-center gap-1.5 hover:bg-white/20 px-2 py-1 rounded-xl transition-colors cursor-pointer"
                    title="Clique para abrir Sua Conta (Editar nome, usuário ou senha)"
                  >
                    <Briefcase className="w-4 h-4 text-white shrink-0" />
                    <span>GERENTE</span>
                    {currentActiveUser && (
                      <span className="hidden xl:inline text-indigo-100 font-normal">
                        ({currentActiveUser.name})
                      </span>
                    )}
                  </button>
                  
                  <button
                    type="button"
                    onClick={() => setIsAdminModalOpen(true)}
                    className="px-2.5 py-1 bg-white/20 hover:bg-white/30 text-white rounded-lg transition-colors cursor-pointer flex items-center gap-1 text-[11px]"
                    title="Abrir Painel de Gestão do Gerente"
                  >
                    <SlidersHorizontal className="w-3.5 h-3.5" />
                    <span>Painel de Gestão</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleLogout}
                    className="p-1 bg-black/20 hover:bg-black/40 text-white rounded-lg transition-colors cursor-pointer"
                    title="Sair da sessão e voltar para a tela inicial"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              {/* Badge do Usuário Comum / Visitante (Clicável para abrir Sua Conta) */}
              {!isMaster && !isManager && (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsProfileModalOpen(true)}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200/80 dark:bg-slate-800/80 dark:hover:bg-slate-700/80 text-slate-800 dark:text-slate-100 border border-slate-200 dark:border-slate-700 text-xs font-bold shadow-xs transition-all cursor-pointer group"
                    title={currentActiveUser ? "Clique para gerenciar sua conta e trocar senha" : "Clique aqui para criar sua conta oficial no WebGIS"}
                  >
                    <div className="w-5 h-5 rounded-lg bg-emerald-100 dark:bg-emerald-950/80 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                      <User className="w-3.5 h-3.5" />
                    </div>
                    <span className="group-hover:text-red-600 dark:group-hover:text-red-400 transition-colors font-bold">
                      {currentActiveUser
                        ? `${currentActiveUser.name} (@${currentActiveUser.username})`
                        : 'Clique aqui para fazer sua conta'}
                    </span>
                    {currentActiveUser?.department && (
                      <span className="hidden sm:inline-block text-[10px] text-slate-400 font-normal">
                        • {currentActiveUser.department}
                      </span>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={handleLogout}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800/80 hover:bg-red-50 dark:hover:bg-red-950/50 text-slate-700 dark:text-slate-200 hover:text-red-600 dark:hover:text-red-400 border border-slate-200 dark:border-slate-700 transition-all text-xs font-bold shadow-xs cursor-pointer"
                    title="Sair ou trocar de usuário"
                  >
                    <LogOut className="w-3.5 h-3.5 text-red-500" />
                    <span className="hidden sm:inline">Sair</span>
                  </button>
                </div>
              )}

              <button
                onClick={() => setIsDarkMode(!isDarkMode)}
                className="p-2 sm:p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800/80 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors shadow-sm cursor-pointer"
                title={isDarkMode ? "Ativar Modo Claro" : "Ativar Modo Escuro"}
              >
                {isDarkMode ? <Sun className="w-5 h-5 sm:w-6 sm:h-6" /> : <Moon className="w-5 h-5 sm:w-6 sm:h-6" />}
              </button>
            </div>

            <div className="w-px h-8 bg-slate-200 dark:bg-slate-700 hidden sm:block"></div>

            {/* Campo de Busca Avançada */}
            <div className="w-full lg:w-full flex flex-col gap-2 max-w-3xl flex-grow z-50">
              {/* Opção de busca restrita */}
              {(isAdmin || featurePermissions.allowSearchActiveLayersOnly !== false) && (
                <div className="flex items-center self-end" title="Busca somente nas camadas ligadas">
                  <input 
                    id="search-active-layers-toggle" 
                    type="checkbox" 
                    checked={searchActiveLayersOnly}
                    onChange={(e) => setSearchActiveLayersOnly(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 dark:border-slate-600 text-red-600 focus:ring-red-500 cursor-pointer" 
                  />
                  <label htmlFor="search-active-layers-toggle" className="ml-2 text-xs text-slate-600 dark:text-slate-400 font-semibold cursor-pointer select-none">
                    Pesquisar apenas nas camadas ativas
                  </label>
                </div>
              )}

              {/* Barra de Input */}
              <div className="w-full flex items-center gap-2">
                <div className="relative flex-grow">
                  <div className="flex rounded-xl shadow-sm border border-slate-300 dark:border-slate-600 focus-within:ring-2 focus-within:ring-red-500 focus-within:border-red-500 overflow-hidden bg-slate-50 dark:bg-slate-800 transition-all">
                    <input 
                      ref={searchInputRef}
                      type="text" 
                      id="search-input" 
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder="Pesquisar (ex: Centro, Teresina) — [Ctrl + F]" 
                      autoComplete="off"
                      className="w-full px-4 py-2.5 text-slate-800 dark:text-slate-200 bg-transparent focus:outline-none text-sm placeholder-slate-400 font-semibold"
                    />
                    {searchQuery.trim() !== '' && (
                      <button
                        type="button"
                        onClick={() => toggleSaveSearch(searchQuery)}
                        className={`px-2.5 flex items-center justify-center transition-colors cursor-pointer border-l border-slate-200 dark:border-slate-700 ${
                          savedSearches.some(s => s.toLowerCase() === searchQuery.trim().toLowerCase())
                            ? 'text-amber-500 hover:text-amber-600'
                            : 'text-slate-400 hover:text-amber-500'
                        }`}
                        title={
                          savedSearches.some(s => s.toLowerCase() === searchQuery.trim().toLowerCase())
                            ? "Remover das pesquisas salvas"
                            : "Salvar esta pesquisa nos favoritos"
                        }
                      >
                        <Star className={`w-4 h-4 ${savedSearches.some(s => s.toLowerCase() === searchQuery.trim().toLowerCase()) ? 'fill-amber-500' : ''}`} />
                      </button>
                    )}
                    {searchQuery && (
                      <button 
                        onClick={handleAbandonSearch}
                        className="px-2 text-slate-400 hover:text-red-500 cursor-pointer"
                        title="Limpar busca"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                    <button 
                      onClick={() => handleSearch()}
                      disabled={isSearchLoading}
                      className="px-4 bg-red-600 text-white font-semibold hover:bg-red-700 disabled:opacity-50 flex items-center justify-center cursor-pointer border-l border-red-700" 
                      title="Pesquisar"
                    >
                      {isSearchLoading ? (
                        <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                      ) : (
                        <Search className="h-5 w-5" />
                      )}
                    </button>
                  </div>
                </div>
              </div>

              {/* Seção de Pesquisas Recentes (3 últimas) e Pesquisas Salvas */}
              {(recentSearches.length > 0 || savedSearches.length > 0) && (
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mt-1 px-1 text-xs">
                  {/* 3 Pesquisas Recentes */}
                  {recentSearches.length > 0 && (
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="flex items-center gap-1 font-bold text-slate-500 dark:text-slate-400 select-none">
                        <History className="w-3.5 h-3.5 text-red-500" />
                        Recentes:
                      </span>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {recentSearches.map((term, idx) => (
                          <button
                            key={`recent-${idx}`}
                            onClick={() => {
                              setSearchQuery(term);
                              handleSearch(term);
                            }}
                            className="bg-slate-200/80 dark:bg-slate-700/80 hover:bg-red-100 dark:hover:bg-red-900/40 text-slate-700 dark:text-slate-200 hover:text-red-700 dark:hover:text-red-300 font-semibold px-2.5 py-0.5 rounded-full transition-all cursor-pointer border border-slate-300/50 dark:border-slate-600/50 flex items-center gap-1"
                            title={`Refazer busca: ${term}`}
                          >
                            <span className="truncate max-w-[140px]">{term}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Pesquisas Salvas */}
                  {savedSearches.length > 0 && (
                    <div className="flex items-center gap-1.5 flex-wrap border-l border-slate-200 dark:border-slate-700 pl-3">
                      <span className="flex items-center gap-1 font-bold text-amber-600 dark:text-amber-400 select-none">
                        <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                        Salvas:
                      </span>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {savedSearches.map((term, idx) => (
                          <div
                            key={`saved-${idx}`}
                            className="group bg-amber-50 dark:bg-amber-950/40 hover:bg-amber-100 dark:hover:bg-amber-900/50 border border-amber-200 dark:border-amber-800/60 text-amber-900 dark:text-amber-200 font-semibold px-2.5 py-0.5 rounded-full transition-all flex items-center gap-1.5 shadow-xs"
                          >
                            <button
                              onClick={() => {
                                setSearchQuery(term);
                                handleSearch(term);
                              }}
                              className="cursor-pointer hover:underline flex items-center gap-1"
                              title={`Buscar salva: ${term}`}
                            >
                              <span className="truncate max-w-[150px]">{term}</span>
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                removeSavedSearch(term);
                              }}
                              className="text-amber-600/70 dark:text-amber-400/70 hover:text-red-600 dark:hover:text-red-400 cursor-pointer p-0.5 rounded-full"
                              title="Remover das pesquisas salvas"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
              <p className="text-[11px] text-slate-500 dark:text-slate-400 ml-1 font-medium select-none">
                💡 Dica: Use <strong>vírgula</strong> para filtrar por município (ex: <em>Cacimba, Teresina</em>).
              </p>

              
            </div>
          </header>
        )}

        {/* PRINT SIDEBAR */}
        {isPrintMode && (
          <div className="w-full md:w-80 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-700 p-6 flex flex-col gap-6 shadow-2xl z-20 print:hidden overflow-y-auto shrink-0">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-lg text-slate-800 dark:text-slate-100 flex items-center gap-2">
                <Printer className="w-5 h-5 text-red-600" /> Configuração
              </h2>
              <button
                onClick={() => setIsPrintMode(false)}
                className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors"
                title="Fechar"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex flex-col gap-2">
              <label htmlFor="printTitle" className="text-xs font-bold text-slate-500 uppercase tracking-wider">Título do Mapa</label>
              <input
                id="printTitle"
                type="text"
                value={printTitle}
                onChange={(e) => setPrintTitle(e.target.value)}
                className="w-full font-semibold bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg p-2.5 focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-all text-slate-800 dark:text-slate-100"
                placeholder="Insira um título..."
              />
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Orientação da Página</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setPrintOrientation('portrait')}
                  className={`flex flex-col items-center justify-center p-3 rounded-lg border-2 transition-all ${printOrientation === 'portrait' ? 'border-red-600 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300' : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:border-slate-300'}`}
                >
                  <div className="w-4 h-6 border-2 border-current rounded-sm mb-2" />
                  <span className="text-xs font-bold">Retrato</span>
                </button>
                <button
                  onClick={() => setPrintOrientation('landscape')}
                  className={`flex flex-col items-center justify-center p-3 rounded-lg border-2 transition-all ${printOrientation === 'landscape' ? 'border-red-600 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300' : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:border-slate-300'}`}
                >
                  <div className="w-6 h-4 border-2 border-current rounded-sm mb-2" />
                  <span className="text-xs font-bold">Paisagem</span>
                </button>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <label htmlFor="printFontFamily" className="text-xs font-bold text-slate-500 uppercase tracking-wider">Fonte do Título</label>
              <select
                id="printFontFamily"
                value={printFontFamily}
                onChange={(e) => setPrintFontFamily(e.target.value)}
                className="w-full font-semibold bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg p-2.5 focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-all text-slate-800 dark:text-slate-100"
              >
                <option value="font-sans">Sans Serif</option>
                <option value="font-serif">Serif</option>
                <option value="font-mono">Monospace</option>
              </select>
            </div>

            <div className="flex flex-col gap-2">
              <label htmlFor="printFontSize" className="text-xs font-bold text-slate-500 uppercase tracking-wider">Tamanho do Título ({printFontSize}px)</label>
              <input
                id="printFontSize"
                type="range"
                min="16"
                max="72"
                value={printFontSize}
                onChange={(e) => setPrintFontSize(parseInt(e.target.value))}
                className="w-full accent-red-600"
              />
            </div>

            {/* Portal target for map controls (active layers, etc) */}
            <div id="print-map-controls-portal" className="flex flex-col gap-4 mt-2"></div>

            <div className="mt-auto pt-6 border-t border-slate-100 dark:border-slate-800">
              <button
                onClick={() => window.print()}
                className="w-full p-3 rounded-xl bg-red-600 hover:bg-red-700 text-white transition-colors shadow-lg shadow-red-600/20 flex items-center justify-center gap-2 font-bold"
              >
                <Printer className="w-5 h-5" />
                Imprimir / PDF
              </button>
            </div>
          </div>
        )}

        {/* PAINEL DE RESULTADOS DA BUSCA */}
        {!isPrintMode && (
              <AnimatePresence>
                {isSearchResultsVisible && (
                  <motion.div 
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    id="search-results-container" 
                    className="w-full bg-white dark:bg-slate-900 rounded-3xl border border-red-100 dark:border-red-900/40 shadow-xl p-4 space-y-3 z-30 relative flex flex-col max-h-[280px]"
                  >
                    <div className="flex justify-between items-center border-b border-red-50 pb-2">
                      <small id="search-results-title" className="text-red-900 dark:text-red-200 font-bold text-sm">
                        {isSearchLoading ? 'Buscando...' : `${totalResultsCount} resultado(s) encontrado(s)`}
                      </small>
                      <button 
                        onClick={handleAbandonSearch}
                        className="text-slate-400 hover:text-red-600 p-1 rounded-full hover:bg-red-50 transition-colors cursor-pointer" 
                        title="Fechar resultados"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>

                    <div id="search-results-list" className="overflow-y-auto custom-scrollbar space-y-2 pr-1 flex-1">
                      {Object.keys(searchResults).length > 0 ? (
                        Object.entries(searchResults)
                          .sort((a, b) => {
                            return a[0].localeCompare(b[0]);
                          })
                          .map(([groupName, items]) => {
                          const isCollapsed = !!collapsedGroups[groupName];
                          const typedItems = items as SearchResultItem[];
                          
                          return (
                            <div key={groupName} className={`border rounded-xl overflow-hidden shadow-sm border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900`}>
                              <button 
                                onClick={() => setCollapsedGroups({ ...collapsedGroups, [groupName]: !isCollapsed })}
                                className={`w-full p-3 flex justify-between items-center transition-colors font-bold text-sm border-b cursor-pointer bg-slate-50 dark:bg-slate-800/80 text-slate-800 dark:text-slate-200 hover:bg-slate-50 border-slate-100 dark:border-slate-800`}
                              >
                                <div className="flex items-center gap-2">
                                  <span className="text-red-800 dark:text-red-300">
                                    {groupName}
                                  </span>
                                  <span className={`text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700`}>{typedItems.length}</span>
                                </div>
                                {isCollapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
                              </button>

                              {!isCollapsed && (
                                <div className={`divide-y divide-slate-50 dark:divide-slate-800`}>
                                  {typedItems.map((item, idx) => {
                                    const featureProps = item.polygonLayer.feature.properties;
                                    const identifier = getIdentifier(featureProps, groupName);
                                    const muniContext = featureProps['Nome do município'] || featureProps['NM_MUN'];

                                    return (
                                      <div 
                                        key={idx}
                                        onClick={() => handleResultItemClick(groupName, item)}
                                        className={`p-3 cursor-pointer transition-colors text-sm pl-6 flex items-start gap-2 group hover:bg-red-50 dark:hover:bg-red-900/40`}
                                      >
                                        <MapPin className="w-4 h-4 text-slate-400 group-hover:text-red-600 mt-0.5 shrink-0" />
                                        <div className="flex-grow">
                                          <p className="font-semibold text-slate-800 dark:text-slate-200 group-hover:text-red-900 dark:group-hover:text-red-300 transition-colors">{identifier}</p>
                                          {muniContext && String(muniContext).toLowerCase() !== String(identifier).toLowerCase() && (
                                            <p className="text-[10px] text-red-600 dark:text-red-300 font-bold mt-1 bg-red-50 dark:bg-red-900/40 px-2 py-0.5 rounded-full inline-block">
                                              Município: {muniContext}
                                            </p>
                                          )}
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          );
                        })
                      ) : (
                        !isSearchLoading && (
                          <p className="p-4 text-center text-slate-500 dark:text-slate-400 text-sm font-semibold bg-slate-50 dark:bg-slate-800 rounded-xl">
                            Nenhum local correspondente encontrado. Verifique a grafia ou experimente outra camada.
                          </p>
                        )
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
        )}

        {/* A4 WRAPPERS */}
        <div className={isPrintMode ? 'flex-1 overflow-auto flex justify-center items-start sm:items-center p-4 sm:p-8 custom-scrollbar print:p-0 print:overflow-visible print:block' : 'w-full'}>
          <div className={isPrintMode ? `bg-white shadow-2xl relative flex flex-col print:shadow-none print:w-full print:h-full print:m-0 print:border-none shrink-0 ${printOrientation === 'portrait' ? 'aspect-[1/1.414] h-[calc(100vh-4rem)] max-h-[1123px]' : 'aspect-[1.414/1] w-full max-w-[calc(100vw-22rem)] lg:max-w-[1123px]'} print:!aspect-auto` : 'w-full'}>
             
            {isPrintMode && (
              <div className="text-center pt-8 pb-4 bg-white z-50 print:block shrink-0">
                <h1 
                  className={`font-bold text-black uppercase tracking-wider border-b-4 border-black inline-block pb-2 px-8 ${printFontFamily}`}
                  style={{ fontSize: `${printFontSize}px`, lineHeight: 1.2 }}
                >
                  {printTitle || 'Mapa Temático'}
                </h1>
              </div>
            )}
             
            <div className={isPrintMode ? 'flex-1 w-full h-full p-4 print:p-0 relative flex flex-col map-print-container' : 'w-full'}>
              {/* MAPA INTERATIVO PRINCIPAL */}
              <MapComponent 
            isPrintMode={isPrintMode}
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
          />
            </div>
          </div>
        </div>

        {/* BUSCA DE ENDEREÇOS DO IBGE (DUCKDB) - Condicional por Permissão */}
        {!isPrintMode && (isAdmin || featurePermissions.allowCnefeSearch !== false) && (
          <IbgeSearchPanel 
            onPlotAddress={handlePlotAddress} 
            onPlotAllAddresses={handlePlotAllAddresses} 
            onClearPlot={handleClearPlot}
            externalPolygonResult={cnefeExternalResult}
            allowedColumns={isAdmin ? undefined : effectiveSession.addressColumnsPermissions}
          />
        )}

        {/* PAINEL DASHBOARD (RAIO-X POPULACIONAL) */}
        {!isPrintMode && selectedFeatures.length > 0 && (isAdmin || featurePermissions.allowDashboardRaioX !== false) && (!selectedFeatures.every(f => f.sourceName === "Coordenadas" || f.sourceName === "Coordenadas IBGE" || f.sourceName === "Localidades (Piauí)" || f.sourceName === "Comunidades Rurais de Teresina")) && (
          <Suspense fallback={null}>
            <Dashboard selectedFeatures={selectedFeatures} />
          </Suspense>
        )}

        {/* FEIÇÕES SELECIONADAS */}
        {!isPrintMode && (isAdmin || featurePermissions.allowSelectedFeaturesPanel !== false) && (
          <AnimatePresence>
            {selectedFeatures.length > 0 && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                id="selected-features-container" 
                className="w-full bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-xl p-4 overflow-hidden"
              >
                <h3 className="text-base sm:text-lg font-bold text-red-900 dark:text-red-200 border-l-4 border-red-600 pl-2.5 mb-3">
                  Feições Selecionadas ({selectedFeatures.length})
                </h3>
                <div id="selected-features-list" className="max-h-[180px] overflow-y-auto custom-scrollbar space-y-2 pr-1">
                  {selectedFeatures.map(feat => (
                    <div 
                      key={feat.id} 
                      className="flex justify-between items-center p-2.5 bg-slate-50 dark:bg-slate-800 hover:bg-red-50 dark:bg-red-900/10 border border-slate-100 dark:border-slate-800 rounded-xl transition-all"
                    >
                      <div>
                        <p className="font-bold text-sm text-slate-900 dark:text-slate-100 leading-snug">{feat.name}</p>
                        <p className="text-[10px] bg-red-100 text-red-700 font-bold px-2 py-0.5 rounded-full inline-block mt-1">
                          {feat.sourceName}
                        </p>
                      </div>
                      <div className="flex items-center gap-1">
                        <button 
                          onClick={() => handleZoomToFeature(feat)}
                          className="p-1.5 text-red-700 hover:bg-red-100/50 rounded-lg transition-colors cursor-pointer" 
                          title="Zoom na feição"
                        >
                          <ZoomIn className="w-5 h-5" />
                        </button>
                        <button 
                          onClick={() => handleRemoveFromSelection(feat.id)}
                          className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer" 
                          title="Remover da seleção"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        )}

        {/* CENTRAL DEDICADA DE EXPORTAÇÃO DE DADOS (CSV, KML, GeoJSON) */}
        {!isPrintMode && selectedFeatures.length > 0 && (isAdmin || featurePermissions.allowExportData !== false) && (
          <Suspense fallback={null}>
            <ExportDashboard 
              selectedFeatures={selectedFeatures} 
              showToast={showToast} 
            />
          </Suspense>
        )}

        {/* TABELA DE ESPECIFICAÇÕES DAS FEIÇÕES (ATRIBUTOS) */}
        {!isPrintMode && (isAdmin || featurePermissions.allowFeatureSpecs !== false) && (
          <PropertyTable 
            selectedFeatures={selectedFeatures} 
            showToast={showToast} 
            allowedProperties={isAdmin ? undefined : effectiveSession.featurePropertiesPermissions}
            onSearchPolygonAddresses={handleSearchPolygonAddresses}
          />
        )}

      </main>

      {/* RODAPÉ E PARCEIROS */}
      {!isPrintMode && (isAdmin || featurePermissions.allowSourcesFooter !== false) && (
      <footer className="w-full mt-2 text-center pb-4 select-none z-10 print:hidden">
        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl p-6 border border-slate-100 dark:border-slate-800 flex flex-col items-center gap-6">
          <div className="w-full flex flex-col items-center gap-3">
            <h4 className="text-[11px] font-bold text-black uppercase tracking-widest">Fontes</h4>
            <div className="flex flex-col md:flex-row justify-center items-center gap-6 md:gap-10">
              <img 
                src="https://raw.githubusercontent.com/marciodemelosilvageo-glitch/GeoCode/main/logo/IBGE.png" 
                alt="Logo IBGE" 
                className="h-5 sm:h-7 object-contain hover:scale-105 transition-transform"
              />
              <img 
                src="https://raw.githubusercontent.com/marciodemelosilvageo-glitch/web/main/geojsom/SSP.png" 
                alt="Logo SSP" 
                className="h-8 sm:h-10 object-contain hover:scale-105 transition-transform"
                onError={(e) => {
                  // Fallback caso a URL SSP original mude
                  (e.target as HTMLImageElement).src = 'https://raw.githubusercontent.com/marciodemelosilvageo-glitch/GeoCode/main/logo/image-removebg-preview.png';
                }}
              />
              <img 
                src="https://raw.githubusercontent.com/marciodemelosilvageo-glitch/GeoCode/main/logo/Nova%20logo.png" 
                alt="Logo Gerência de Dados" 
                className="h-8 sm:h-10 object-contain hover:scale-105 transition-transform cursor-pointer select-none"
                onDoubleClick={handleOpenAdminLogin}
                title="Gerência de Dados"
              />
            </div>
          </div>
          
          <div className="border-t border-slate-100 dark:border-slate-800 w-full pt-4 mt-2 flex flex-col items-center gap-1.5">
            <p className="text-sm font-extrabold text-black dark:text-slate-300">WebGis</p>
            <p className="text-xs text-black dark:text-black max-w-lg text-center leading-relaxed">
              Encontrou algum bug, tem sugestões de melhorias ou algo deu errado? Entre em contato:
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3 mt-1 text-[13px] text-slate-600 dark:text-slate-400">
              <a 
                href="https://wa.me/5586981689456" 
                target="_blank" 
                rel="noopener noreferrer" 
                className="hover:text-emerald-600 font-bold transition-colors underline decoration-emerald-300 underline-offset-2"
              >
                (86) 98168-9456
              </a>
              <span className="text-slate-300">•</span>
              <a 
                href="mailto:marciodemelosilva.geo@gmail.com" 
                className="hover:text-red-600 font-bold transition-colors underline decoration-red-300 underline-offset-2"
              >
                marciodemelosilva.geo@gmail.com
              </a>
            </div>
          </div>
        </div>
      </footer>
      )}

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

      {/* BOTÃO AJUDA FLUTUANTE */}
      <button 
        id="help-btn" 
        onClick={() => setIsHelpOpen(true)}
        className="fixed bottom-6 right-6 bg-red-600 text-white p-4 rounded-full shadow-lg hover:bg-red-700 z-[2000] flex items-center justify-center transition-transform hover:scale-110 active:scale-95 cursor-pointer" 
        title="Ajuda e Instruções"
      >
        <HelpCircle className="h-7 w-7" />
      </button>

      {/* MODAL DE AJUDA */}
      <AnimatePresence>
        {isHelpOpen && (
          <div 
            id="help-modal-backdrop"
            onClick={() => setIsHelpOpen(false)}
            className="fixed inset-0 top-0 left-0 right-0 bottom-0 w-screen h-screen min-h-[100dvh] bg-slate-950/85 backdrop-blur-sm z-[3000] flex items-center justify-center p-4 animate-fadeIn"
          >
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              onClick={(e) => e.stopPropagation()} // Impede fechamento ao clicar dentro
              className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-2xl w-full p-6 relative max-h-[85vh] overflow-y-auto custom-scrollbar border border-slate-100 dark:border-slate-800"
            >
              <button 
                id="close-help" 
                onClick={() => setIsHelpOpen(false)}
                className="absolute top-4 right-4 text-slate-400 hover:text-red-600 hover:bg-red-50 p-1.5 rounded-full transition-colors cursor-pointer" 
                title="Fechar"
              >
                <X className="w-5 h-5" />
              </button>

              <h2 className="text-2xl font-black text-red-700 dark:text-red-400 mb-4 flex items-center gap-2 border-b border-red-100 dark:border-red-900/50 pb-3">
                <HelpCircle className="w-6 h-6 text-red-600" />
                Guia Completo de Uso do WebGis
              </h2>

              <div className="space-y-4 text-slate-700 dark:text-slate-300 text-sm">
                {/* 1. NAVEGAÇÃO E CAMADAS */}
                <div className="bg-red-50 dark:bg-red-950/40 p-4 rounded-xl border border-red-100 dark:border-red-900/40">
                  <h3 className="font-extrabold text-red-900 dark:text-red-200 mb-1.5 text-base flex items-center gap-2">
                    <span>🗺️</span> 1. Navegando no Mapa & Personalizando Camadas
                  </h3>
                  <p className="text-red-950/80 dark:text-red-200/90 leading-relaxed mb-2">
                    O WebGis exibe divisões territoriais oficiais (como Municípios, Bairros, Setores Censitários, Favelas/Comunidades).
                  </p>
                  <ul className="list-disc list-inside space-y-1 text-red-950/90 dark:text-red-200/90 text-xs sm:text-sm">
                    <li><strong>Painel de Camadas:</strong> Clique no botão de camadas (canto superior direito do mapa) para Ligar/Desligar mapas e ajustar a <strong>opacidade</strong>, <strong>cor de preenchimento</strong> e <strong>cor da borda</strong> de cada camada.</li>
                    <li><strong>Mapa de Fundo (Basemap):</strong> Alterne entre <em> Apple Maps (Claro)</em>, <em> Apple Maps (Escuro)</em>, <em>Google Satélite</em>, <em>Google Híbrido</em>, <em>OSM</em> e <em>Esri</em>.</li>
                    <li><strong>Ações Rápidas:</strong> Use os botões <strong>"Ligar Tudo"</strong> ou <strong>"Desligar Tudo"</strong> no topo do mapa para controlar todas as camadas rapidamente.</li>
                  </ul>
                </div>

                {/* 2. SELEÇÃO DE ÁREAS */}
                <div className="bg-slate-50 dark:bg-slate-800/80 p-4 rounded-xl border border-slate-200 dark:border-slate-700">
                  <h3 className="font-extrabold text-slate-900 dark:text-slate-100 mb-1.5 text-base flex items-center gap-2">
                    <span>🖱️</span> 2. Selecionando Áreas e Raio-X Territorial
                  </h3>
                  <p className="mb-2 text-slate-800 dark:text-slate-200 leading-relaxed">
                    <strong>Clique Simples:</strong> Clique em um polígono colorido para gerar automaticamente o <strong>"Raio-X Territorial e Domiciliar"</strong> (População total, Domicílios particulares/coletivos, ocupados, vagos e média de moradores/domicílio).
                  </p>
                  <p className="text-slate-800 dark:text-slate-200 leading-relaxed">
                    <strong>Seleção Múltipla:</strong> Ative o botão <strong>"Multiseleção: ON"</strong> acima do mapa (ou segure a tecla <kbd className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 px-1.5 py-0.5 rounded shadow-xs font-mono text-xs text-slate-800 dark:text-slate-200">Ctrl</kbd> no computador) e clique em várias regiões simultaneamente para somar populações e estatísticas em tempo real!
                  </p>
                </div>

                {/* 3. BUSCA AVANÇADA E PAINEL IBGE */}
                <div className="bg-slate-50 dark:bg-slate-800/80 p-4 rounded-xl border border-slate-200 dark:border-slate-700">
                  <h3 className="font-extrabold text-slate-900 dark:text-slate-100 mb-1.5 text-base flex items-center gap-2">
                    <span>🔍</span> 3. Ferramentas de Busca, Endereços & Botão Direito
                  </h3>
                  <div className="space-y-2 text-xs sm:text-sm text-slate-800 dark:text-slate-200">
                    <p>
                      <strong>Busca por Nomes e Territórios:</strong> Pesquise bairros, comunidades ou municípios no topo. Para locais comuns, adicione vírgula com o município (ex: <code>Cacimba, Teresina</code>).
                    </p>
                    <p>
                      <strong>Busca por Coordenadas & Menu do Botão Direito:</strong> Insira pares de Latitude/Longitude (ex: <code>-5.089, -42.801</code>) para marcar pontos. Você também pode dar <strong>clique com o botão direito</strong> em qualquer lugar do mapa para copiar coordenadas, identificar feições locais ou abrir direto no Google Street View.
                    </p>
                    <p>
                      <strong>Painel de Busca de Endereços IBGE (DuckDB):</strong> Na seção inferior de busca, pesquise por endereços completos, logradouros, CEPs e números de portas.
                    </p>
                    <ul className="list-disc list-inside pl-2 space-y-0.5 text-slate-600 dark:text-slate-400 text-xs">
                      <li><strong>Favoritos (⭐):</strong> Salve suas buscas frequentes para acesso rápido.</li>
                      <li><strong>Recentes:</strong> Reutilize facilmente suas últimas buscas realizadas.</li>
                      <li><strong>Plotar Todos:</strong> Marque múltiplos resultados encontrados de uma só vez no mapa.</li>
                    </ul>
                  </div>
                </div>

                {/* 4. MEDIÇÃO E PONTOS */}
                <div className="bg-slate-50 dark:bg-slate-800/80 p-4 rounded-xl border border-slate-200 dark:border-slate-700">
                  <h3 className="font-extrabold text-slate-900 dark:text-slate-100 mb-1.5 text-base flex items-center gap-2">
                    <span>📏</span> 4. Medição & Histórico de Pontos
                  </h3>
                  <p className="text-slate-800 dark:text-slate-200 leading-relaxed text-xs sm:text-sm">
                    Utilize a ferramenta de medição para calcular distâncias e áreas no mapa. Os pontos marcados ficam organizados no painel flutuante <strong>"Histórico de Pontos"</strong>, onde você pode conferir as coordenadas precisas e remover marcações individuais.
                  </p>
                </div>

                {/* 5. EXPORTAÇÃO */}
                <div className="bg-emerald-50 dark:bg-emerald-950/40 p-4 rounded-xl border border-emerald-100 dark:border-emerald-900/40">
                  <h3 className="font-extrabold text-emerald-900 dark:text-emerald-200 mb-1.5 text-base flex items-center gap-2">
                    <span>📥</span> 5. Exportação de Dados em Planilhas e KML
                  </h3>
                  <p className="text-emerald-950/90 dark:text-emerald-200/90 leading-relaxed text-xs sm:text-sm mb-2">
                    A tabela <strong>"Especificação das Feições"</strong> ao final da página reúne todos os dados das regiões selecionadas.
                  </p>
                  <ul className="list-disc list-inside space-y-1 text-emerald-950/90 dark:text-emerald-200/90 text-xs sm:text-sm">
                    <li><strong>Exportar CSV (Excel):</strong> Baixe planilhas com todos os atributos numéricos e demográficos. <em>(Dica no Excel: vá em "Dados &gt; Obter Dados de Texto/CSV" para organizar perfeitamente as colunas)</em>.</li>
                    <li><strong>Exportar KML (Google Earth/QGIS):</strong> Exporte as geometrias para plotagem e uso em programas GIS profissionais.</li>
                  </ul>
                </div>

                {/* 6. ATALHOS DE TECLADO & PRODUTIVIDADE */}
                <div className="bg-amber-50/80 dark:bg-amber-950/40 p-4 rounded-xl border border-amber-200 dark:border-amber-900/50">
                  <h3 className="font-extrabold text-amber-950 dark:text-amber-200 mb-2 text-base flex items-center gap-2">
                    <span>⌨️</span> 6. Atalhos Rápidos de Teclado & Produtividade
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs sm:text-sm text-amber-950/90 dark:text-amber-200/90">
                    <div className="flex items-center gap-2 bg-white/70 dark:bg-slate-900/70 p-2 rounded-lg border border-amber-200/60 dark:border-amber-900/40">
                      <kbd className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded font-mono font-bold text-xs shadow-2xs">Ctrl + F</kbd>
                      <span className="text-xs">ou</span>
                      <kbd className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded font-mono font-bold text-xs shadow-2xs">/</kbd>
                      <span className="text-xs font-semibold">Focar na busca</span>
                    </div>

                    <div className="flex items-center gap-2 bg-white/70 dark:bg-slate-900/70 p-2 rounded-lg border border-amber-200/60 dark:border-amber-900/40">
                      <kbd className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded font-mono font-bold text-xs shadow-2xs">Esc</kbd>
                      <span className="text-xs font-semibold">Limpar buscas, seleções e medições</span>
                    </div>

                    <div className="flex items-center gap-2 bg-white/70 dark:bg-slate-900/70 p-2 rounded-lg border border-amber-200/60 dark:border-amber-900/40">
                      <kbd className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded font-mono font-bold text-xs shadow-2xs">M</kbd>
                      <span className="text-xs font-semibold">Ativar / Desativar régua de medição</span>
                    </div>

                    <div className="flex items-center gap-2 bg-white/70 dark:bg-slate-900/70 p-2 rounded-lg border border-amber-200/60 dark:border-amber-900/40">
                      <span className="font-bold text-amber-700 dark:text-amber-400">💾 Salvar Estilos</span>
                      <span className="text-xs font-semibold">Salvar/carregar até 4 combinações personalizadas no painel de camadas</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-6 flex justify-end">
                <button 
                  id="btn-entendi" 
                  onClick={() => setIsHelpOpen(false)}
                  className="bg-red-600 text-white px-6 py-2.5 rounded-xl font-bold hover:bg-red-700 transition-colors shadow-lg cursor-pointer"
                >
                  Entendi, Começar a Usar
                </button>
              </div>
            </motion.div>
          </div>
        )}


      </AnimatePresence>
    </div>
  );
}
