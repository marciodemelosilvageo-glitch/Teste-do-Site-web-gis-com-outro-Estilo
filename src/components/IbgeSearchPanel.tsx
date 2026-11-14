import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { 
  Search, 
  MapPin, 
  Loader2, 
  Download, 
  Table2, 
  ChevronDown, 
  Map, 
  Star, 
  History, 
  X, 
  Building2, 
  Filter, 
  Sparkles, 
  RotateCcw,
  Trash2,
  SlidersHorizontal,
  ArrowUpDown,
  ArrowUp,
  ArrowDown
} from 'lucide-react';
import { buscarEnderecos, listarMunicipios } from '../duckdb';
import { toTitleCase, normalizeString, parseAddressForSort } from '../utils';
import { logActivity } from '../services/adminService';

export interface ExternalPolygonSearchResult {
  results: any[];
  totalEncontrado: number;
  title: string;
  sourceLayerName?: string;
  timestamp: number;
  searchTerm?: string;
}

interface IbgeSearchPanelProps {
  onPlotAddress: (address: any) => void;
  onPlotAllAddresses?: (addresses: any[]) => void;
  onClearPlot?: () => void;
  onClearExternalResult?: () => void;
  externalPolygonResult?: ExternalPolygonSearchResult | null;
  allowedColumns?: Record<string, boolean>;
  embedded?: boolean;
  isMaximized?: boolean;
  hasPlottedMarkers?: boolean;
}

export const DEFAULT_COLUMN_WIDTHS: Record<string, number> = {
  codigo_unico: 190,
  municipio: 180,
  endereco: 300,
  numero_logradouro: 120,
  complemento: 200,
  cep: 120,
  bairro: 180,
  subdistrito: 140,
  localidade: 180,
  nucleo_urbano: 180,
  favela_comunidade: 220,
  agromerado: 180,
  comunidade_rural: 200,
  latitude: 120,
  longitude: 120,
  codigo_setor: 170,
  estabelecimento: 250,
  especie: 180,
  ind_estabelecimento: 170,
  ind_construcao_reforma: 180,
  ind_finalidade_construcao: 180,
  tipo_edificacao: 190,
};

export const tableColumns = [
  { key: 'codigo_unico', label: 'Código único do endereço' },
  { key: 'municipio', label: 'Nome do município' },
  { key: 'endereco', label: 'Endereco' },
  { key: 'numero_logradouro', label: 'Número no logradouro' },
  { key: 'complemento', label: 'Complemento' },
  { key: 'cep', label: 'CEP' },
  { key: 'bairro', label: 'Bairro' },
  { key: 'subdistrito', label: 'Zona' },
  { key: 'localidade', label: 'Localidade' },
  { key: 'nucleo_urbano', label: 'Nucleo Urbano' },
  { key: 'favela_comunidade', label: 'Favelas ou Comunidades Urbana' },
  { key: 'agromerado', label: 'Agromerado' },
  { key: 'comunidade_rural', label: 'Comunidades Rurais de Teresina' },
  { key: 'latitude', label: 'LATITUDE' },
  { key: 'longitude', label: 'LONGITUDE' },
  { key: 'codigo_setor', label: 'Código do setor' },
  { key: 'estabelecimento', label: 'Identificação do estabelecimento' },
  { key: 'especie', label: 'Espécie de endereço' },
  { key: 'ind_estabelecimento', label: 'Indicador de estabelecimento' },
  { key: 'ind_construcao_reforma', label: 'Indicador de construção ou reforma' },
  { key: 'ind_finalidade_construcao', label: 'Indicador de finalidade de construção' },
  { key: 'tipo_edificacao', label: 'Tipo da edificação dos domicílios' }
];

// Helper para obter o valor textual formatado exatamente como é exibido ao usuário
export function getFormattedDisplayValue(row: any, colKey: string): string {
  if (!row) return '';
  const val = row[colKey];
  if (val === null || val === undefined) return '';
  const valStr = String(val).trim();

  // Formatar Latitude e Longitude com exatamente 6 dígitos após o ponto/vírgula
  if ((colKey === 'latitude' || colKey === 'longitude') && val != null) {
    const numVal = parseFloat(String(val).replace(',', '.'));
    if (!isNaN(numVal)) {
      return numVal.toFixed(6);
    }
  }

  const isTextCol = [
    'municipio', 
    'endereco', 
    'bairro', 
    'localidade', 
    'nucleo_urbano', 
    'favela_comunidade', 
    'agromerado', 
    'comunidade_rural', 
    'estabelecimento'
  ].includes(colKey);

  return isTextCol ? toTitleCase(valStr) : valStr;
}

// Helper para anexar uma chave interna única e estável para cada linha de resultado
export function attachRowKeys(items: any[]): any[] {
  if (!Array.isArray(items)) return [];
  return items.map((row, idx) => ({
    ...row,
    __rowKey: `${row.codigo_unico ?? 'cnefe'}_${idx}`
  }));
}

interface IbgeTableRowProps {
  row: any;
  index: number;
  visibleTableColumns: Array<{ key: string; label: string }>;
  columnWidths: Record<string, number>;
  onPlotAddress: (address: any) => void;
}

const IbgeTableRow = React.memo<IbgeTableRowProps>(({
  row,
  index,
  visibleTableColumns,
  columnWidths,
  onPlotAddress,
}) => {
  // Memoizar também o cálculo dos valores exibidos por linha para não reexecutar getFormattedDisplayValue a cada render
  const formattedCells = useMemo(() => {
    return visibleTableColumns.map(col => {
      const width = columnWidths[col.key] || DEFAULT_COLUMN_WIDTHS[col.key] || 180;
      const displayVal = getFormattedDisplayValue(row, col.key);
      return {
        key: col.key,
        width,
        displayVal
      };
    });
  }, [row, visibleTableColumns, columnWidths]);

  const handleClick = useCallback(() => {
    onPlotAddress(row);
  }, [onPlotAddress, row]);

  return (
    <tr 
      onClick={handleClick}
      className="hover:bg-[#007AFF]/[0.05] dark:hover:bg-[#007AFF]/[0.10] transition-colors cursor-pointer group"
      title="Clique para navegar e destacar este endereço no mapa"
    >
      <td className="px-3 py-2.5 text-center text-slate-400 dark:text-slate-500 font-bold sticky left-0 z-10 bg-white/95 dark:bg-[#1c1c1e]/95 group-hover:bg-[#007AFF]/[0.05] dark:group-hover:bg-[#007AFF]/[0.10] shadow-r border-r border-black/5 dark:border-white/10 select-none text-[11px]">
        {index + 1}
      </td>
      {formattedCells.map(cell => (
        <td 
          key={cell.key} 
          style={{ width: `${cell.width}px`, minWidth: `${cell.width}px`, maxWidth: `${cell.width}px` }}
          className="px-3.5 py-2.5 text-slate-700 dark:text-slate-300 font-medium truncate" 
          title={cell.displayVal || '-'}
        >
          {cell.displayVal || <span className="text-slate-300 dark:text-slate-600 font-normal">-</span>}
        </td>
      ))}
    </tr>
  );
});

IbgeTableRow.displayName = 'IbgeTableRow';

const IbgeSearchPanelComponent: React.FC<IbgeSearchPanelProps> = ({ 
  onPlotAddress, 
  onPlotAllAddresses, 
  onClearPlot,
  onClearExternalResult,
  externalPolygonResult,
  allowedColumns,
  embedded = false,
  isMaximized = false,
  hasPlottedMarkers = false
}) => {
  // Configuração de colunas visíveis pelo usuário com persistência em localStorage
  const [userVisibleKeys, setUserVisibleKeys] = useState<string[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('cnefe_user_visible_columns');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        }
      } catch (e) {
        console.error('Erro ao ler colunas visíveis salvas:', e);
      }
    }
    return tableColumns.map(c => c.key);
  });

  const visibleTableColumns = useMemo(() => {
    return tableColumns.filter(c => {
      if (allowedColumns && allowedColumns[c.key] === false) return false;
      return userVisibleKeys.includes(c.key);
    });
  }, [allowedColumns, userVisibleKeys]);

  const toggleColumnVisibility = (key: string) => {
    setUserVisibleKeys(prev => {
      let updated: string[];
      if (prev.includes(key)) {
        if (prev.length <= 1) return prev; // Mantém no mínimo 1 coluna ativa
        updated = prev.filter(k => k !== key);
      } else {
        updated = [...prev, key];
      }
      try {
        localStorage.setItem('cnefe_user_visible_columns', JSON.stringify(updated));
      } catch (e) {}
      return updated;
    });
  };

  const handleSelectAllColumns = () => {
    const allKeys = tableColumns.map(c => c.key);
    setUserVisibleKeys(allKeys);
    try {
      localStorage.setItem('cnefe_user_visible_columns', JSON.stringify(allKeys));
    } catch (e) {}
  };

  const handleResetColumns = () => {
    const allKeys = tableColumns.map(c => c.key);
    setUserVisibleKeys(allKeys);
    try {
      localStorage.removeItem('cnefe_user_visible_columns');
    } catch (e) {}
  };

  const [isColumnsModalOpen, setIsColumnsModalOpen] = useState(false);
  const [columnSearchText, setColumnSearchText] = useState('');
  const columnsModalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (columnsModalRef.current && !columnsModalRef.current.contains(event.target as Node)) {
        setIsColumnsModalOpen(false);
      }
    };
    if (isColumnsModalOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isColumnsModalOpen]);

  const filteredModalColumns = useMemo(() => {
    const q = normalizeString(columnSearchText);
    const base = tableColumns.filter(c => !allowedColumns || allowedColumns[c.key] !== false);
    if (!q) return base;
    return base.filter(c => normalizeString(c.label).includes(q) || normalizeString(c.key).includes(q));
  }, [columnSearchText, allowedColumns]);

  // Ordenação nas colunas
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);

  const handleSort = (colKey: string) => {
    setSortConfig(prev => {
      if (prev?.key === colKey) {
        if (prev.direction === 'asc') {
          return { key: colKey, direction: 'desc' };
        }
        return null; // desmarca ordenação
      }
      return { key: colKey, direction: 'asc' };
    });
  };

  // Filtros individuais por coluna via inputs no cabeçalho da tabela
  const [columnFilters, setColumnFilters] = useState<Record<string, string>>({});

  const [municipio, setMunicipio] = useState('Todos');
  const [municipiosList, setMunicipiosList] = useState<string[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const cached = localStorage.getItem('webgis_cached_municipios');
        if (cached) {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        }
      } catch (e) {}
    }
    return [];
  });
  const [isLoadingMunicipios, setIsLoadingMunicipios] = useState(false);
  const [hasRequestedMunicipios, setHasRequestedMunicipios] = useState(false);
  const [isSelectOpen, setIsSelectOpen] = useState(false);
  const [municipioBusca, setMunicipioBusca] = useState('');
  const selectRef = useRef<HTMLDivElement>(null);
  
  const [textoBusca, setTextoBusca] = useState('');
  const [polygonSearchTitle, setPolygonSearchTitle] = useState<string | null>(null);
  const [limit, setLimit] = useState(500);
  const [modoAvancado, setModoAvancado] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [results, setResults] = useState<any[]>([]);
  const [totalEncontrado, setTotalEncontrado] = useState(0);
  const [hasSearched, setHasSearched] = useState(false);
  const [isPlotted, setIsPlotted] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Sincroniza isPlotted quando marcadores forem limpos externamente
  useEffect(() => {
    if (hasPlottedMarkers === false && isPlotted) {
      setIsPlotted(false);
    }
  }, [hasPlottedMarkers, isPlotted]);

  // Larguras personalizadas das colunas (estilo Excel com persistência no localStorage)
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('cnefe_table_column_widths');
        if (saved) {
          return { ...DEFAULT_COLUMN_WIDTHS, ...JSON.parse(saved) };
        }
      } catch (e) {
        console.error('Erro ao ler larguras de colunas do CNEFE:', e);
      }
    }
    return DEFAULT_COLUMN_WIDTHS;
  });

  const [resizingColKey, setResizingColKey] = useState<string | null>(null);

  const saveColumnWidths = useCallback((widths: Record<string, number>) => {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('cnefe_table_column_widths', JSON.stringify(widths));
      } catch (e) {
        console.error('Erro ao salvar larguras de colunas:', e);
      }
    }
  }, []);

  const handleStartResize = (colKey: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const startX = e.clientX;
    const startWidth = columnWidths[colKey] || DEFAULT_COLUMN_WIDTHS[colKey] || 180;
    setResizingColKey(colKey);

    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    let currentWidth = startWidth;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startX;
      currentWidth = Math.max(70, Math.min(800, startWidth + deltaX));
      setColumnWidths(prev => ({
        ...prev,
        [colKey]: currentWidth
      }));
    };

    const handleMouseUp = () => {
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      setResizingColKey(null);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);

      setColumnWidths(prev => {
        const updated = { ...prev, [colKey]: currentWidth };
        saveColumnWidths(updated);
        return updated;
      });
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  const handleResetColumnWidths = () => {
    setColumnWidths(DEFAULT_COLUMN_WIDTHS);
    saveColumnWidths(DEFAULT_COLUMN_WIDTHS);
  };

  // Monitora resultados vindos de busca espacial por polígono
  const lastExternalTimestampRef = useRef<number>(0);
  useEffect(() => {
    if (externalPolygonResult && externalPolygonResult.timestamp > 0) {
      if (externalPolygonResult.timestamp !== lastExternalTimestampRef.current) {
        lastExternalTimestampRef.current = externalPolygonResult.timestamp;
        setResults(attachRowKeys(externalPolygonResult.results));
        setTotalEncontrado(externalPolygonResult.totalEncontrado);
        setHasSearched(true);
        setIsPlotted(false);
        setTextoBusca(externalPolygonResult.searchTerm || '');
        if (externalPolygonResult.searchTerm) {
          setModoAvancado(true);
        }
        setColumnFilters({});
        setSortConfig(null);
        setPolygonSearchTitle(externalPolygonResult.title);
        setErrorMsg(null);

        // Scroll suave para o painel de endereços CNEFE
        setTimeout(() => {
          const el = document.getElementById('ibge-search-panel');
          if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
        }, 100);
      }
    } else if (!externalPolygonResult && polygonSearchTitle) {
      lastExternalTimestampRef.current = 0;
      setResults([]);
      setTotalEncontrado(0);
      setHasSearched(false);
      setIsPlotted(false);
      setPolygonSearchTitle(null);
      setColumnFilters({});
      setSortConfig(null);
    }
  }, [externalPolygonResult, polygonSearchTitle]);

  // Controle de requisições concorrentes (race conditions)
  const searchRequestIdRef = useRef(0);

  // Pesquisas Recentes e Salvas para Endereços (localStorage)
  const [recentSearches, setRecentSearches] = useState<string[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('recent_address_searches');
        if (saved) return JSON.parse(saved);
      } catch (e) {
        console.error('Erro ao ler pesquisas recentes de endereços:', e);
      }
    }
    return [];
  });

  const [savedSearches, setSavedSearches] = useState<string[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('saved_address_searches');
        if (saved) return JSON.parse(saved);
      } catch (e) {
        console.error('Erro ao ler pesquisas salvas de endereços:', e);
      }
    }
    return [];
  });

  const addRecentSearch = useCallback((term: string) => {
    const trimmed = String(term || '').trim();
    if (!trimmed) return;
    setRecentSearches(prev => {
      const filtered = prev.filter(item => item && typeof item === 'string' && normalizeString(item) !== normalizeString(trimmed));
      const updated = [trimmed, ...filtered].slice(0, 3);
      try {
        localStorage.setItem('recent_address_searches', JSON.stringify(updated));
      } catch (e) {}
      return updated;
    });
  }, []);

  const toggleSaveSearch = useCallback((term: string) => {
    const trimmed = String(term || '').trim();
    if (!trimmed) return;
    setSavedSearches(prev => {
      const exists = prev.some(item => item && typeof item === 'string' && normalizeString(item) === normalizeString(trimmed));
      let updated: string[];
      if (exists) {
        updated = prev.filter(item => item && typeof item === 'string' && normalizeString(item) !== normalizeString(trimmed));
      } else {
        updated = [trimmed, ...prev];
      }
      try {
        localStorage.setItem('saved_address_searches', JSON.stringify(updated));
      } catch (e) {}
      return updated;
    });
  }, []);

  const removeSavedSearch = useCallback((term: string) => {
    const cleanTerm = String(term || '').toLowerCase().trim();
    setSavedSearches(prev => {
      const updated = prev.filter(item => item && typeof item === 'string' && normalizeString(item) !== normalizeString(cleanTerm));
      try {
        localStorage.setItem('saved_address_searches', JSON.stringify(updated));
      } catch (e) {}
      return updated;
    });
  }, []);

  const ensureMunicipiosLoaded = useCallback(async () => {
    if (hasRequestedMunicipios) return;
    setHasRequestedMunicipios(true);

    if (municipiosList.length > 0) return;

    const cached = typeof window !== 'undefined' ? localStorage.getItem('webgis_cached_municipios') : null;
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setMunicipiosList(parsed);
          return;
        }
      } catch (e) {}
    }

    setIsLoadingMunicipios(true);
    try {
      const list = await listarMunicipios();
      if (list && list.length > 0) {
        setMunicipiosList(list);
        try {
          localStorage.setItem('webgis_cached_municipios', JSON.stringify(list));
        } catch (e) {}
      }
    } catch (err) {
      console.error("Erro ao carregar municípios do DuckDB:", err);
    } finally {
      setIsLoadingMunicipios(false);
    }
  }, [hasRequestedMunicipios, municipiosList.length]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (selectRef.current && !selectRef.current.contains(event.target as Node)) {
        setIsSelectOpen(false);
        setMunicipioBusca("");
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSearch = async (overrideText?: string | React.FormEvent, event?: React.FormEvent) => {
    ensureMunicipiosLoaded();
    let queryText = textoBusca;
    
    if (typeof overrideText === 'string') {
      queryText = overrideText;
      if (event && typeof event.preventDefault === 'function') {
        event.preventDefault();
      }
    } else if (overrideText && typeof overrideText === 'object' && 'preventDefault' in overrideText) {
      overrideText.preventDefault();
    } else if (event && typeof event.preventDefault === 'function') {
      event.preventDefault();
    }

    if (!queryText.trim() && municipio === 'Todos') return;

    setPolygonSearchTitle(null);
    setIsSearching(true);
    
    if (queryText.trim()) {
      addRecentSearch(queryText);
      if (queryText !== textoBusca) {
        setTextoBusca(queryText);
      }
    }

    const currentReqId = ++searchRequestIdRef.current;
    setIsSearching(true);
    setErrorMsg(null);

    try {
      const res = await buscarEnderecos(
        municipio === 'Todos' ? '' : municipio, 
        queryText, 
        modoAvancado, 
        limit
      );

      // Descarta resposta obsoleta caso outra requisição tenha sido disparada
      if (currentReqId !== searchRequestIdRef.current) return;

      setResults(attachRowKeys(res.results));
      setTotalEncontrado(res.totalEncontrado);
      setHasSearched(true);
      setIsPlotted(false);
      setColumnFilters({});
      setSortConfig(null);

      logActivity('ENDERECO', `Pesquisou por "${queryText}" (${municipio}) - ${res.totalEncontrado} resultados`, 'user');
    } catch (err: any) {
      if (currentReqId !== searchRequestIdRef.current) return;
      console.error("Erro na busca de endereços:", err);
      setErrorMsg("Ocorreu um erro ao consultar os endereços. Tente novamente.");
    } finally {
      if (currentReqId === searchRequestIdRef.current) {
        setIsSearching(false);
      }
    }
  };

  const handleClear = () => {
    setTextoBusca('');
    setResults([]);
    setTotalEncontrado(0);
    setHasSearched(false);
    setIsPlotted(false);
    setPolygonSearchTitle(null);
    setErrorMsg(null);
    setColumnFilters({});
    setSortConfig(null);
    if (onClearPlot) {
      onClearPlot();
    }
    if (onClearExternalResult) {
      onClearExternalResult();
    }
  };

  // Filtragem e ordenação dos resultados diretamente no cliente
  const processedResults = useMemo(() => {
    let list = results;

    // 1. Filtragem individual por coluna (inputs sticky no cabeçalho)
    const activeFilters = Object.entries(columnFilters).filter(([_, text]) => Boolean(text && text.trim()));
    if (activeFilters.length > 0) {
      list = list.filter(row => {
        return activeFilters.every(([colKey, filterVal]) => {
          const rawFilter = filterVal.trim();
          if (!rawFilter) return true;

          const displayStr = getFormattedDisplayValue(row, colKey);
          if (!displayStr) return false;

          // Se for latitude ou longitude, aceita busca com vírgula ou ponto
          if (colKey === 'latitude' || colKey === 'longitude') {
            const normalizedDisplay = displayStr.replace(',', '.');
            const normalizedFilter = rawFilter.replace(',', '.');
            return normalizedDisplay.includes(normalizedFilter);
          }

          // Para colunas de texto e código, ignora maiúsculas e acentos
          const normDisplay = normalizeString(displayStr);
          const normFilter = normalizeString(rawFilter);
          return normDisplay.includes(normFilter);
        });
      });
    }

    // 2. Ordenação por coluna clicada
    if (sortConfig) {
      const { key, direction } = sortConfig;
      const factor = direction === 'asc' ? 1 : -1;
      list = [...list].sort((a, b) => {
        const valA = a[key];
        const valB = b[key];

        if (valA === null || valA === undefined) return 1;
        if (valB === null || valB === undefined) return -1;

        // Se for a coluna de endereço: agrupa os nomes de logradouro iguais primeiro e depois ordena pelo número
        if (key === 'endereco') {
          const pA = parseAddressForSort(valA, a.numero_logradouro);
          const pB = parseAddressForSort(valB, b.numero_logradouro);
          const streetCmp = pA.streetName.localeCompare(pB.streetName, 'pt-BR');
          if (streetCmp !== 0) return streetCmp * factor;
          return (pA.doorNumber - pB.doorNumber) * factor;
        }

        const strA = String(valA).trim();
        const strB = String(valB).trim();
        const numA = parseFloat(strA.replace(',', '.'));
        const numB = parseFloat(strB.replace(',', '.'));

        const isAValidNum = !isNaN(numA) && /^-?\d+(\.\d+)?$/.test(strA.replace(',', '.'));
        const isBValidNum = !isNaN(numB) && /^-?\d+(\.\d+)?$/.test(strB.replace(',', '.'));

        if (isAValidNum && isBValidNum && !['codigo_unico', 'codigo_setor', 'cep'].includes(key)) {
          return (numA - numB) * factor;
        }

        return strA.localeCompare(strB, 'pt-BR', { numeric: true, sensitivity: 'base' }) * factor;
      });
    }

    return list;
  }, [results, columnFilters, sortConfig]);

  const exportToCSV = useCallback(() => {
    const hasActiveFilters = Object.entries(columnFilters).some(([_, text]) => Boolean(text && text.trim()));
    const dataToExport = hasActiveFilters ? processedResults : results;
    if (!dataToExport || dataToExport.length === 0) return;

    const visibleCols = visibleTableColumns;
    const headers = visibleCols.map(c => `"${c.label.replace(/"/g, '""')}"`).join(',');
    
    const rows = dataToExport.map(row => {
      return visibleCols.map(col => {
        const val = getFormattedDisplayValue(row, col.key);
        if (!val) return '""';
        return `"${val.replace(/"/g, '""')}"`;
      }).join(',');
    });

    const csvContent = '\uFEFF' + [headers, ...rows].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `CNEFE_${municipio}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    logActivity('EXPORTACAO', `Exportou ${dataToExport.length} endereços CNEFE (${municipio}) para planilha CSV`, 'user');
  }, [processedResults, results, columnFilters, municipio, visibleTableColumns]);

  const filteredMunicipios = useMemo(() => {
    const q = normalizeString(municipioBusca);
    const list = Array.isArray(municipiosList) ? municipiosList.filter(m => m && typeof m === 'string') : [];
    if (!q) return list;
    return list.filter(m => normalizeString(m).includes(q));
  }, [municipiosList, municipioBusca]);

  return (
    <section 
      id="ibge-search-panel"
      aria-label="Busca de Endereços Avançado" 
      className={`w-full flex flex-col gap-4 relative z-20 ${embedded ? 'mt-1 mb-2' : 'mt-10 mb-8'}`}
    >
      {/* Separador e título da seção (apenas quando não embutido) */}
      {!embedded && (
        <div className="flex items-center gap-4 mb-1">
          <div className="h-px bg-gradient-to-r from-transparent via-black/10 dark:via-white/10 to-transparent flex-1" />
          <div className="flex items-center gap-2 px-3.5 py-1 bg-white/80 dark:bg-[#1c1c1e]/80 backdrop-blur-xl rounded-full border border-black/5 dark:border-white/10 shadow-xs">
            <Building2 size={15} className="text-[#007AFF] dark:text-[#64D2FF]" />
            <span className="text-xs font-black text-slate-800 dark:text-slate-100 uppercase tracking-wider">Dashboard de Endereços</span>
          </div>
          <div className="h-px bg-gradient-to-r from-transparent via-black/10 dark:via-white/10 to-transparent flex-1" />
        </div>
      )}

      <div className={`rounded-3xl transition-all ${
        embedded 
          ? 'bg-transparent border-0 p-1 sm:p-2 shadow-none' 
          : 'bg-white/85 dark:bg-[#1c1c1e]/85 shadow-[0_20px_45px_-12px_rgba(0,0,0,0.12)] border border-black/5 dark:border-white/10 p-5 sm:p-7 relative backdrop-blur-2xl'
      }`}>
        {/* Cabeçalho (apenas quando não embutido) */}
        {!embedded && (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-5 border-b border-black/5 dark:border-white/10">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-[#007AFF] to-[#5856D6] text-white flex items-center justify-center shadow-md shadow-blue-500/25 shrink-0">
                <Table2 size={22} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white tracking-tight">Busca de Endereços Avançado</h2>
                  <span className="text-[10px] font-extrabold uppercase bg-[#007AFF]/10 text-[#007AFF] dark:bg-[#007AFF]/20 dark:text-[#64D2FF] px-2.5 py-0.5 rounded-full border border-[#007AFF]/20">
                    IBGE CNEFE
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">
                  Localização precisa de logradouros, domicílios e estabelecimentos em todos os municípios do Piauí.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Formulário de Busca Estilo Apple */}
        <form onSubmit={(e) => { e.preventDefault(); handleSearch(undefined, e); }} className="flex flex-col lg:flex-row items-stretch lg:items-start gap-4 mb-6">
          {/* Município */}
          <div className="flex-1 relative" ref={selectRef}>
            <label className="flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
              <Building2 size={13} className="text-[#007AFF] dark:text-[#64D2FF]" />
              Município
            </label>
            <div className="relative">
              <div 
                className={`w-full bg-black/[0.03] dark:bg-white/[0.06] hover:bg-black/[0.06] dark:hover:bg-white/[0.1] border border-black/10 dark:border-white/10 rounded-2xl px-3.5 py-2.5 text-sm font-semibold text-slate-800 dark:text-slate-100 outline-none flex justify-between items-center transition-all cursor-pointer ${
                  isSelectOpen ? 'border-[#007AFF] ring-2 ring-[#007AFF]/25 bg-white dark:bg-[#2c2c2e]' : ''
                }`}
                onClick={() => { 
                  ensureMunicipiosLoaded();
                  setIsSelectOpen(prev => !prev); 
                  setMunicipioBusca(""); 
                }}
              >
                <span className="truncate pr-2">
                  {isLoadingMunicipios 
                    ? "Carregando municípios..." 
                    : municipio === "Todos" ? "Todos os Municípios" : municipio}
                </span>
                <ChevronDown size={16} className={`text-slate-400 transition-transform duration-200 ${isSelectOpen ? 'rotate-180 text-[#007AFF]' : ''}`} />
              </div>
              
              {isSelectOpen && (
                <div className="mt-2 w-full bg-white/95 dark:bg-[#2c2c2e]/95 backdrop-blur-3xl border border-black/10 dark:border-white/10 rounded-2xl shadow-[0_16px_40px_rgba(0,0,0,0.2)] max-h-64 flex flex-col overflow-hidden transition-all animate-fadeIn z-30">
                  <div className="p-2 border-b border-black/5 dark:border-white/10 sticky top-0 bg-white/90 dark:bg-[#2c2c2e]/90 backdrop-blur-xl z-10">
                    <div className="relative">
                      <input
                        type="text"
                        placeholder="Pesquisar município..."
                        value={municipioBusca}
                        onChange={(e) => setMunicipioBusca(e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                        className="w-full bg-black/5 dark:bg-black/30 border border-black/5 dark:border-white/10 rounded-xl pl-8 pr-3 py-1.5 text-xs text-slate-800 dark:text-slate-100 outline-none focus:border-[#007AFF] focus:ring-1 focus:ring-[#007AFF]"
                        autoFocus
                      />
                      <Search size={13} className="absolute left-2.5 top-2 text-slate-400" />
                    </div>
                  </div>
                  <div className="overflow-y-auto py-1 custom-scrollbar max-h-48">
                    {isLoadingMunicipios ? (
                      <div className="px-3 py-4 text-xs text-center text-slate-400 flex items-center justify-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin text-[#007AFF]" />
                        <span>Carregando municípios...</span>
                      </div>
                    ) : (
                      <>
                        <div 
                          className={`px-3 py-2 text-xs font-bold transition-colors cursor-pointer rounded-xl mx-1 ${
                            municipio === "Todos" 
                              ? 'bg-[#007AFF] text-white font-extrabold' 
                              : 'text-slate-700 dark:text-slate-300 hover:bg-[#007AFF]/10 hover:text-[#007AFF] dark:hover:text-[#64D2FF]'
                          }`}
                          onClick={() => { setMunicipio("Todos"); setIsSelectOpen(false); }}
                        >
                          Todos os Municípios
                        </div>
                        {filteredMunicipios.map(m => (
                          <div 
                            key={m} 
                            className={`px-3 py-2 text-xs font-medium transition-colors cursor-pointer rounded-xl mx-1 ${
                              municipio === m 
                                ? 'bg-[#007AFF] text-white font-bold' 
                                : 'text-slate-700 dark:text-slate-300 hover:bg-[#007AFF]/10 hover:text-[#007AFF] dark:hover:text-[#64D2FF]'
                            }`}
                            onClick={() => { setMunicipio(m); setIsSelectOpen(false); }}
                          >
                            {m}
                          </div>
                        ))}
                        {filteredMunicipios.length === 0 && (
                          <div className="px-3 py-4 text-xs text-center text-slate-400">
                            Nenhum município localizado
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
          
          {/* Campo de Busca Principal (iOS Search Bar) */}
          <div className="flex-[2] relative">
            <label className="flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
              <Search size={13} className="text-[#007AFF] dark:text-[#64D2FF]" />
              Endereço, número, Bairro
            </label>
            <div className="relative flex items-center">
              <input 
                type="text" 
                value={textoBusca}
                onChange={(e) => setTextoBusca(e.target.value)}
                onFocus={() => ensureMunicipiosLoaded()}
                placeholder="Ex: Avenida Frei Serafim, Centro..."
                className="w-full bg-black/[0.03] dark:bg-white/[0.06] hover:bg-black/[0.06] dark:hover:bg-white/[0.1] border border-black/10 dark:border-white/10 rounded-2xl pl-3.5 pr-16 py-2.5 text-sm font-semibold text-slate-800 dark:text-slate-100 placeholder:text-slate-400 outline-none focus:border-[#007AFF] focus:ring-2 focus:ring-[#007AFF]/25 transition-all"
              />
              {textoBusca.trim() !== '' && (
                <div className="absolute right-2.5 flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => toggleSaveSearch(textoBusca)}
                    className={`p-1.5 transition-colors cursor-pointer rounded-xl ${
                      savedSearches.some(s => s && typeof s === 'string' && normalizeString(s) === normalizeString(textoBusca))
                        ? 'text-amber-500 hover:text-amber-600 bg-amber-50 dark:bg-amber-950/50'
                        : 'text-slate-400 hover:text-amber-500 hover:bg-black/5 dark:hover:bg-white/10'
                    }`}
                    title={
                      savedSearches.some(s => s && typeof s === 'string' && normalizeString(s) === normalizeString(textoBusca))
                        ? "Remover das pesquisas salvas"
                        : "Salvar esta pesquisa nos favoritos"
                    }
                  >
                    <Star className={`w-4 h-4 ${savedSearches.some(s => s && typeof s === 'string' && normalizeString(s) === normalizeString(textoBusca)) ? 'fill-amber-500' : ''}`} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setTextoBusca('')}
                    className="p-1.5 text-slate-400 hover:text-[#FF3B30] hover:bg-black/5 dark:hover:bg-white/10 cursor-pointer rounded-xl transition-colors"
                    title="Limpar texto"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Limite de Resultados */}
          <div className="w-full lg:w-28">
            <label className="flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
              <Filter size={13} className="text-[#007AFF] dark:text-[#64D2FF]" />
              Limite
            </label>
            <select 
              value={limit}
              onChange={(e) => setLimit(Number(e.target.value))}
              className="w-full bg-black/[0.03] dark:bg-white/[0.06] hover:bg-black/[0.06] dark:hover:bg-white/[0.1] border border-black/10 dark:border-white/10 rounded-2xl px-3 py-2.5 text-sm font-semibold text-slate-800 dark:text-slate-100 outline-none focus:border-[#007AFF] focus:ring-2 focus:ring-[#007AFF]/25 transition-all cursor-pointer"
            >
              <option value={100}>100</option>
              <option value={500}>500</option>
              <option value={1000}>1000</option>
              <option value={5000}>5000</option>
              <option value={10000}>10000</option>
            </select>
          </div>
          
          {/* Opção Avançada (Apple iPhone Switch) */}
          <div className="flex flex-col">
            <div className="h-[22px] hidden lg:block" />
            <div 
              onClick={() => setModoAvancado(prev => !prev)}
              className="flex items-center justify-between gap-3 bg-black/[0.03] dark:bg-white/[0.06] hover:bg-black/[0.06] dark:hover:bg-white/[0.1] border border-black/10 dark:border-white/10 px-3.5 py-2 rounded-2xl h-10 transition-all cursor-pointer select-none shadow-2xs"
              title="Alternar busca avançada (correspondência aproximada e fonética)"
            >
              <span className="whitespace-nowrap font-bold text-xs text-slate-700 dark:text-slate-200">Avançado</span>
              <div className={`w-9 h-5 rounded-full transition-colors duration-200 p-0.5 flex items-center relative ${
                modoAvancado ? 'bg-[#34C759]' : 'bg-slate-300 dark:bg-slate-600'
              }`}>
                <div className={`w-4 h-4 rounded-full bg-white shadow-xs transition-transform duration-200 ${
                  modoAvancado ? 'translate-x-4' : 'translate-x-0'
                }`} />
              </div>
            </div>
          </div>

          {/* Botões de Ação */}
          <div className="flex flex-col w-full lg:w-auto">
            <div className="h-[22px] hidden lg:block" />
            <div className="flex items-center gap-2 w-full lg:w-auto">
              <button 
                type="submit" 
                disabled={isSearching}
                className="h-10 bg-gradient-to-r from-[#007AFF] to-[#0062cc] hover:brightness-105 active:scale-95 disabled:opacity-50 text-white px-6 rounded-2xl font-bold text-sm shadow-md shadow-blue-500/25 flex items-center justify-center gap-2 transition-all w-full lg:w-auto cursor-pointer"
              >
                {isSearching ? <Loader2 className="animate-spin" size={18} /> : <Search size={18} />}
                <span>Buscar</span>
              </button>
              
              {hasSearched && (
                <button
                  type="button"
                  onClick={handleClear}
                  className="h-10 bg-black/5 hover:bg-black/10 dark:bg-white/10 dark:hover:bg-white/15 active:scale-95 text-slate-700 dark:text-slate-200 px-4 rounded-2xl font-bold text-xs flex items-center justify-center transition-all cursor-pointer border border-black/5 dark:border-white/10 shrink-0"
                  title="Limpar Pesquisa"
                >
                  Limpar
                </button>
              )}
            </div>
          </div>
        </form>

        {/* Histórico e Salvos (Apple Capsule Chips) */}
        {(recentSearches.length > 0 || savedSearches.length > 0) && (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mb-6 text-xs bg-black/[0.02] dark:bg-white/[0.03] p-3 rounded-2xl border border-black/5 dark:border-white/10">
            {recentSearches.length > 0 && (
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="flex items-center gap-1 font-extrabold text-[#007AFF] select-none uppercase tracking-wider text-[10px]">
                  <History className="w-3.5 h-3.5 text-[#007AFF]" />
                  Recentes:
                </span>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {recentSearches.map((term, idx) => (
                    <button
                      key={`recent-addr-${idx}`}
                      type="button"
                      onClick={() => {
                        setTextoBusca(term);
                        handleSearch(term);
                      }}
                      className="bg-white dark:bg-[#2c2c2e] hover:bg-[#007AFF]/10 text-slate-700 dark:text-slate-200 hover:text-[#007AFF] dark:hover:text-[#64D2FF] font-semibold px-3 py-1 rounded-xl transition-all cursor-pointer border border-black/5 dark:border-white/10 shadow-2xs flex items-center gap-1 active:scale-95"
                      title={`Refazer busca: ${term}`}
                    >
                      <span className="truncate max-w-[140px]">{term}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {savedSearches.length > 0 && (
              <div className="flex items-center gap-1.5 flex-wrap border-l border-black/10 dark:border-white/10 pl-3">
                <span className="flex items-center gap-1 font-extrabold text-amber-600 dark:text-amber-400 select-none uppercase tracking-wider text-[10px]">
                  <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                  Salvas:
                </span>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {savedSearches.map((term, idx) => (
                    <div
                      key={`saved-addr-${idx}`}
                      className="group bg-amber-50/90 dark:bg-amber-950/40 hover:bg-amber-100 dark:hover:bg-amber-900/50 border border-amber-300/60 dark:border-amber-700/60 text-amber-900 dark:text-amber-200 font-semibold px-3 py-1 rounded-xl transition-all flex items-center gap-1.5 shadow-2xs"
                    >
                      <button
                        type="button"
                        onClick={() => {
                          setTextoBusca(term);
                          handleSearch(term);
                        }}
                        className="cursor-pointer hover:underline flex items-center gap-1"
                        title={`Buscar salva: ${term}`}
                      >
                        <span className="truncate max-w-[150px]">{term}</span>
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeSavedSearch(term);
                        }}
                        className="text-amber-600/70 dark:text-amber-400/70 hover:text-[#FF3B30] cursor-pointer p-0.5 rounded-full"
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

        {errorMsg && (
          <div className="p-3.5 mb-6 bg-[#FF3B30]/10 text-[#FF3B30] dark:text-[#FF453A] rounded-2xl text-xs font-bold border border-[#FF3B30]/20 flex items-center gap-2.5">
            <X className="shrink-0 text-[#FF3B30]" size={16} />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Tabela de Resultados do Dashboard (Estilo Apple Glass) */}
        {hasSearched && (
          <div className="border border-black/10 dark:border-white/10 rounded-3xl overflow-hidden flex flex-col shadow-lg bg-white/90 dark:bg-[#1c1c1e]/90 backdrop-blur-2xl">
            {/* Barra KPI e Ações Principais */}
            <div className="bg-slate-50/90 dark:bg-[#2c2c2e]/90 backdrop-blur-md px-5 py-3.5 flex flex-wrap justify-between items-center gap-3 border-b border-black/10 dark:border-white/10">
              <div className="flex flex-wrap items-center gap-3">
                <div className="bg-[#007AFF]/10 dark:bg-[#007AFF]/20 text-[#007AFF] dark:text-[#64D2FF] text-xs font-black px-3.5 py-1.5 rounded-xl border border-[#007AFF]/20 flex items-center gap-1.5 shadow-2xs">
                  <Sparkles size={14} />
                  <span>{totalEncontrado.toLocaleString('pt-BR')} {totalEncontrado === 1 ? 'Endereço' : 'Endereços'}</span>
                </div>
                {polygonSearchTitle && (
                  <div className="bg-amber-500/10 dark:bg-amber-950/70 border border-amber-500/20 text-amber-900 dark:text-amber-200 text-xs font-black px-3.5 py-1.5 rounded-xl flex items-center gap-1.5 shadow-2xs">
                    <MapPin size={13} className="text-amber-600 dark:text-amber-400 shrink-0" />
                    <span>{polygonSearchTitle.startsWith('Localidade:') ? polygonSearchTitle : `Polígono: ${polygonSearchTitle}`}</span>
                    <button
                      type="button"
                      onClick={handleClear}
                      className="ml-1 p-0.5 rounded-md hover:bg-amber-200/80 dark:hover:bg-amber-900/60 text-amber-800 dark:text-amber-200 transition-colors cursor-pointer"
                      title="Limpar pesquisa"
                    >
                      <X size={12} />
                    </button>
                  </div>
                )}
                {totalEncontrado > limit && (
                  <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                    (Exibindo primeiros {limit})
                  </span>
                )}
              </div>
              
              {results.length > 0 && (
                <div className="flex flex-wrap items-center gap-2">
                  {onPlotAllAddresses && !isPlotted && (
                    <button 
                      onClick={() => {
                        onPlotAllAddresses(processedResults);
                        setIsPlotted(true);
                      }}
                      className="text-xs font-bold bg-gradient-to-r from-[#007AFF] to-[#0062cc] hover:brightness-105 active:scale-95 text-white px-4 py-2 rounded-xl flex items-center gap-1.5 shadow-md shadow-blue-500/25 transition-all cursor-pointer"
                    >
                      <Map size={14} /> Plotar no Mapa ({processedResults.length})
                    </button>
                  )}
                  {onClearPlot && isPlotted && (
                    <button 
                      onClick={() => {
                        onClearPlot();
                        setIsPlotted(false);
                      }}
                      className="text-xs font-bold bg-black/10 hover:bg-black/15 dark:bg-white/15 dark:hover:bg-white/20 active:scale-95 text-slate-800 dark:text-white px-4 py-2 rounded-xl flex items-center gap-1.5 transition-all cursor-pointer"
                    >
                      <Map size={14} /> Desplotar do Mapa
                    </button>
                  )}
                  <button 
                    type="button"
                    onClick={handleClear}
                    className="text-xs font-bold bg-rose-500/10 hover:bg-rose-500/20 text-[#FF3B30] dark:text-[#FF453A] px-3.5 py-2 rounded-xl flex items-center gap-1.5 transition-all cursor-pointer active:scale-95 shadow-2xs"
                    title="Limpar pesquisa e remover resultados"
                  >
                    <Trash2 size={13} /> Limpar
                  </button>
                  <button 
                    onClick={exportToCSV}
                    className="text-xs font-bold bg-white dark:bg-[#3a3a3c] border border-black/10 dark:border-white/10 text-slate-700 dark:text-slate-200 px-3.5 py-2 rounded-xl flex items-center gap-1.5 hover:bg-black/5 dark:hover:bg-white/10 transition-all cursor-pointer shadow-2xs active:scale-95"
                  >
                    <Download size={14} /> Exportar CSV
                  </button>
                </div>
              )}
            </div>

            {/* Sub-barra: Indicador de Filtros das Colunas e Gerenciamento */}
            {results.length > 0 && (
              <div className="bg-slate-100/60 dark:bg-[#252528]/80 px-5 py-2.5 flex flex-wrap items-center justify-between gap-3 border-b border-black/10 dark:border-white/10">
                {/* Status de Filtros nas Colunas (Lupinhas) */}
                <div className="flex items-center gap-2 flex-wrap">
                  {Object.entries(columnFilters).some(([_, text]) => Boolean(text && text.trim())) ? (
                    <div className="flex items-center gap-2 bg-[#007AFF]/10 dark:bg-[#007AFF]/20 text-[#007AFF] dark:text-[#64D2FF] text-xs font-bold px-3 py-1.5 rounded-xl border border-[#007AFF]/20 shadow-2xs">
                      <Search size={13} className="shrink-0" />
                      <span>
                        Filtro ativo: {processedResults.length} de {results.length} endereços
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setColumnFilters({});
                        }}
                        className="ml-1 text-[#FF3B30] dark:text-[#FF453A] hover:underline cursor-pointer flex items-center gap-0.5 text-[11px]"
                        title="Limpar todos os filtros das colunas"
                      >
                        <X size={12} /> Limpar Filtros
                      </button>
                    </div>
                  ) : (
                    <span className="text-xs text-slate-500 dark:text-slate-400 font-medium flex items-center gap-1.5">
                      <Filter size={12} className="text-[#007AFF]" />
                      <span>Dica: Use os campos <strong>Filtrar...</strong> abaixo de cada coluna para refinar os resultados exibidos.</span>
                    </span>
                  )}
                </div>

                {/* Botões de Ação de Colunas */}
                <div className="flex items-center gap-2 relative" ref={columnsModalRef}>
                  <button
                    type="button"
                    onClick={() => setIsColumnsModalOpen(prev => !prev)}
                    className={`text-xs font-bold px-3 py-1.5 rounded-xl flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs active:scale-95 border ${
                      isColumnsModalOpen
                        ? 'bg-[#007AFF] text-white border-[#007AFF]'
                        : 'bg-white dark:bg-[#3a3a3c] border-black/10 dark:border-white/10 text-slate-700 dark:text-slate-200 hover:bg-black/5 dark:hover:bg-white/10'
                    }`}
                    title="Configurar quais colunas exibir ou ocultar"
                  >
                    <SlidersHorizontal size={13} />
                    <span>Colunas ({visibleTableColumns.length}/{tableColumns.length})</span>
                    <ChevronDown size={13} className={`transition-transform duration-200 ${isColumnsModalOpen ? 'rotate-180' : ''}`} />
                  </button>

                  <button 
                    onClick={handleResetColumnWidths}
                    className="text-xs font-bold bg-white dark:bg-[#3a3a3c] border border-black/10 dark:border-white/10 text-slate-700 dark:text-slate-200 px-3 py-1.5 rounded-xl flex items-center gap-1 hover:bg-black/5 dark:hover:bg-white/10 transition-all cursor-pointer shadow-2xs active:scale-95"
                    title="Restaurar larguras padrão de todas as colunas"
                  >
                    <RotateCcw size={12} />
                    <span className="hidden sm:inline">Larguras</span>
                  </button>

                  {/* Popover de Seleção de Colunas */}
                  {isColumnsModalOpen && (
                    <div className="absolute right-0 top-full mt-2 w-80 bg-white/95 dark:bg-[#2c2c2e]/95 backdrop-blur-2xl border border-black/10 dark:border-white/10 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.25)] p-3 z-50 flex flex-col gap-2.5 animate-fadeIn">
                      <div className="flex items-center justify-between pb-2 border-b border-black/5 dark:border-white/10">
                        <div className="flex items-center gap-1.5">
                          <SlidersHorizontal size={14} className="text-[#007AFF]" />
                          <span className="text-xs font-black text-slate-800 dark:text-white">Configurar Colunas</span>
                        </div>
                        <button
                          onClick={() => setIsColumnsModalOpen(false)}
                          className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-white rounded-lg cursor-pointer"
                        >
                          <X size={14} />
                        </button>
                      </div>

                      {/* Busca rápida de colunas */}
                      <div className="relative">
                        <input
                          type="text"
                          value={columnSearchText}
                          onChange={(e) => setColumnSearchText(e.target.value)}
                          placeholder="Filtrar colunas..."
                          className="w-full bg-black/5 dark:bg-black/30 border border-black/5 dark:border-white/10 rounded-xl pl-7 pr-3 py-1.5 text-xs text-slate-800 dark:text-slate-100 outline-none focus:border-[#007AFF]"
                        />
                        <Search size={12} className="absolute left-2.5 top-2 text-slate-400" />
                      </div>

                      {/* Ações rápidas */}
                      <div className="flex items-center justify-between text-[11px] font-bold text-[#007AFF] px-1">
                        <button
                          type="button"
                          onClick={handleSelectAllColumns}
                          className="hover:underline cursor-pointer"
                        >
                          Marcar Todas ({tableColumns.length})
                        </button>
                        <button
                          type="button"
                          onClick={handleResetColumns}
                          className="text-slate-500 hover:text-slate-800 dark:hover:text-white cursor-pointer"
                        >
                          Padrão
                        </button>
                      </div>

                      {/* Lista de colunas com checkboxes */}
                      <div className="overflow-y-auto max-h-60 custom-scrollbar flex flex-col gap-0.5 pr-1">
                        {filteredModalColumns.map(col => {
                          const isChecked = userVisibleKeys.includes(col.key);
                          return (
                            <label
                              key={col.key}
                              className="flex items-center gap-2.5 px-2.5 py-1.5 hover:bg-black/5 dark:hover:bg-white/5 rounded-xl cursor-pointer text-xs select-none transition-colors"
                            >
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => toggleColumnVisibility(col.key)}
                                className="w-4 h-4 rounded text-[#007AFF] focus:ring-[#007AFF] border-slate-300 dark:border-slate-600 dark:bg-slate-700 cursor-pointer"
                              />
                              <span className={`font-medium truncate ${isChecked ? 'text-slate-800 dark:text-slate-100 font-semibold' : 'text-slate-400 dark:text-slate-500'}`}>
                                {col.label}
                              </span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
            
            {results.length > 0 ? (
              <>
                {processedResults.length > 0 ? (
                  <div className={`overflow-x-auto overflow-y-auto custom-scrollbar ${
                    embedded 
                      ? 'max-h-[calc(var(--cnefe-bottom-height,46vh)-135px)] min-h-[160px]' 
                      : 'max-h-[580px]'
                  }`}>
                    <table className="text-left text-xs whitespace-nowrap border-collapse" style={{ minWidth: '100%', width: 'max-content' }}>
                      <thead className="bg-slate-100/90 dark:bg-[#2c2c2e]/90 backdrop-blur-xl text-slate-600 dark:text-slate-300 sticky top-0 z-10 shadow-xs select-none border-b border-black/10 dark:border-white/10">
                        {/* Linha 1: Títulos das Colunas, Ordenação e Alça de Redimensionamento */}
                        <tr>
                          <th className="px-3 py-3 font-extrabold w-12 min-w-[48px] max-w-[48px] text-center border-b border-black/10 dark:border-white/10 sticky left-0 z-20 bg-slate-100 dark:bg-[#2c2c2e] shadow-r text-slate-500 dark:text-slate-400">
                            #
                          </th>
                          {visibleTableColumns.map(col => {
                            const width = columnWidths[col.key] || DEFAULT_COLUMN_WIDTHS[col.key] || 180;
                            const isResizingThis = resizingColKey === col.key;
                            const isSorted = sortConfig?.key === col.key;
                            const hasActiveFilter = Boolean(columnFilters[col.key] && columnFilters[col.key].trim());

                            return (
                              <th 
                                key={col.key} 
                                style={{ width: `${width}px`, minWidth: `${width}px`, maxWidth: `${width}px` }}
                                className={`relative px-3 py-2.5 font-extrabold uppercase tracking-wider text-[11px] border-b border-black/10 dark:border-white/10 group/th transition-colors ${
                                  hasActiveFilter ? 'bg-[#007AFF]/10 dark:bg-[#007AFF]/20 text-[#007AFF] dark:text-[#64D2FF]' : ''
                                }`}
                              >
                                <div className="flex items-center justify-between gap-1 w-full pr-2.5">
                                  <button
                                    type="button"
                                    onClick={() => handleSort(col.key)}
                                    className={`flex items-center gap-1.5 min-w-0 flex-1 text-left truncate select-none transition-colors cursor-pointer ${
                                      hasActiveFilter 
                                        ? 'text-[#007AFF] dark:text-[#64D2FF]' 
                                        : 'text-slate-700 dark:text-slate-200 hover:text-[#007AFF] dark:hover:text-[#64D2FF] group-hover/th:text-[#007AFF]'
                                    }`}
                                    title={`${col.label} (Clique para ordenar; arraste a borda para redimensionar)`}
                                  >
                                    <span className="truncate font-black">{col.label}</span>
                                    <span className="shrink-0">
                                      {isSorted ? (
                                        sortConfig?.direction === 'asc' ? (
                                          <ArrowUp size={13} className="text-[#007AFF] dark:text-[#64D2FF]" />
                                        ) : (
                                          <ArrowDown size={13} className="text-[#007AFF] dark:text-[#64D2FF]" />
                                        )
                                      ) : (
                                        <ArrowUpDown size={11} className="text-slate-400 opacity-0 group-hover/th:opacity-80 transition-opacity" />
                                      )}
                                    </span>
                                  </button>
                                </div>
                                
                                {/* Alça de redimensionamento estilo Excel */}
                                <div
                                  onMouseDown={(e) => handleStartResize(col.key, e)}
                                  onDoubleClick={() => {
                                    const defW = DEFAULT_COLUMN_WIDTHS[col.key] || 180;
                                    setColumnWidths(prev => {
                                      const updated = { ...prev, [col.key]: defW };
                                      saveColumnWidths(updated);
                                      return updated;
                                    });
                                  }}
                                  title="Arraste para ajustar a largura (duplo clique para restaurar)"
                                  className={`absolute right-0 top-0 bottom-0 w-3 cursor-col-resize flex items-center justify-center transition-colors z-20 select-none ${
                                    isResizingThis ? 'bg-[#007AFF]/20' : 'group-hover/th:bg-black/5 dark:group-hover/th:bg-white/10'
                                  }`}
                                >
                                  <div className={`w-[2px] h-3/5 rounded-full transition-colors ${
                                    isResizingThis ? 'bg-[#007AFF] scale-y-125' : 'bg-slate-300 dark:bg-slate-600 group-hover/th:bg-[#007AFF]'
                                  }`} />
                                </div>
                              </th>
                            );
                          })}
                        </tr>

                        {/* Linha 2: Caixas de Filtro Individuais por Coluna (Sempre Visíveis e Sticky) */}
                        <tr className="bg-slate-200/75 dark:bg-[#242426]/90 border-b border-black/10 dark:border-white/10">
                          <th className="px-1.5 py-1.5 sticky left-0 z-20 bg-slate-200 dark:bg-[#242426] shadow-r text-center">
                            <Filter size={11} className="mx-auto text-slate-400" />
                          </th>
                          {visibleTableColumns.map(col => {
                            const width = columnWidths[col.key] || DEFAULT_COLUMN_WIDTHS[col.key] || 180;
                            const filterVal = columnFilters[col.key] || '';
                            const hasActiveFilter = Boolean(filterVal && filterVal.trim());

                            return (
                              <th
                                key={`filter-${col.key}`}
                                style={{ width: `${width}px`, minWidth: `${width}px`, maxWidth: `${width}px` }}
                                className="px-2 py-1.5 font-normal"
                              >
                                <div className={`relative flex items-center w-full rounded-lg border transition-all ${
                                  hasActiveFilter 
                                    ? 'border-[#007AFF] bg-white dark:bg-[#1c1c1e] ring-2 ring-[#007AFF]/25 shadow-xs' 
                                    : 'border-black/10 dark:border-white/10 bg-white/80 dark:bg-[#1c1c1e]/80 hover:border-black/20 dark:hover:border-white/20'
                                }`}>
                                  <input
                                    type="text"
                                    value={filterVal}
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      setColumnFilters(prev => {
                                        if (!val) {
                                          const copy = { ...prev };
                                          delete copy[col.key];
                                          return copy;
                                        }
                                        return { ...prev, [col.key]: val };
                                      });
                                    }}
                                    placeholder="Filtrar..."
                                    className="w-full pl-2 pr-6 py-1 text-[11px] font-medium text-slate-800 dark:text-slate-100 outline-none bg-transparent placeholder:text-slate-400 dark:placeholder:text-slate-500 placeholder:font-normal"
                                    title={`Filtrar por ${col.label}`}
                                  />
                                  {hasActiveFilter && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setColumnFilters(prev => {
                                          const copy = { ...prev };
                                          delete copy[col.key];
                                          return copy;
                                        });
                                      }}
                                      className="absolute right-1 p-0.5 rounded text-slate-400 hover:text-rose-500 hover:bg-black/5 dark:hover:bg-white/10 transition-colors cursor-pointer shrink-0"
                                      title={`Limpar filtro de ${col.label}`}
                                      aria-label={`Limpar filtro de ${col.label}`}
                                    >
                                      <X size={11} />
                                    </button>
                                  )}
                                </div>
                              </th>
                            );
                          })}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-black/5 dark:divide-white/5">
                        {processedResults.map((row, i) => (
                          <IbgeTableRow
                            key={row.__rowKey || `${row.codigo_unico ?? 'cnefe'}_${i}`}
                            row={row}
                            index={i}
                            visibleTableColumns={visibleTableColumns}
                            columnWidths={columnWidths}
                            onPlotAddress={onPlotAddress}
                          />
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="p-10 text-center text-slate-400 flex flex-col items-center justify-center gap-2">
                    <Search size={30} className="text-slate-300 dark:text-slate-600" />
                    <p className="font-bold text-sm text-slate-600 dark:text-slate-300">Nenhum resultado corresponde ao filtro atual</p>
                    <p className="text-xs text-slate-400">Verifique a grafia ou selecione outra coluna para pesquisar.</p>
                    <button
                      onClick={() => { setColumnFilters({}); }}
                      className="mt-2 text-xs font-bold text-[#007AFF] bg-[#007AFF]/10 hover:bg-[#007AFF]/20 px-3.5 py-1.5 rounded-xl cursor-pointer"
                    >
                      Limpar Filtro nos Resultados
                    </button>
                  </div>
                )}

                {/* Rodapé Informativo: Total Contínuo e Dica de Uso */}
                <div className="px-5 py-3 bg-slate-50/90 dark:bg-[#2c2c2e]/90 border-t border-black/10 dark:border-white/10 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400 font-medium">
                  <div className="flex items-center gap-2">
                    <span>
                      Exibindo <strong>{processedResults.length.toLocaleString('pt-BR')}</strong> de <strong>{results.length.toLocaleString('pt-BR')}</strong> endereços carregados
                    </span>
                    {sortConfig && (
                      <span className="text-[#007AFF] dark:text-[#64D2FF] font-semibold bg-[#007AFF]/10 dark:bg-[#007AFF]/20 px-2 py-0.5 rounded-md text-[11px]">
                        Ordenado por {tableColumns.find(c => c.key === sortConfig.key)?.label || sortConfig.key} ({sortConfig.direction === 'asc' ? '↑ crescente' : '↓ decrescente'})
                      </span>
                    )}
                  </div>
                  <span className="text-[11px] text-slate-400 dark:text-slate-500 flex items-center gap-1">
                    💡 Clique em qualquer linha para navegar e destacar no mapa
                  </span>
                </div>
              </>
            ) : (
              <div className="p-12 text-center text-slate-400 flex flex-col items-center justify-center gap-2">
                <Search size={32} className="text-slate-300 dark:text-slate-600" />
                <p className="font-bold text-sm text-slate-600 dark:text-slate-300">Nenhum endereço encontrado</p>
                <p className="text-xs text-slate-400">Verifique a grafia ou tente buscar sem especificar o número do imóvel.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
};

export const IbgeSearchPanel = React.memo(IbgeSearchPanelComponent);
IbgeSearchPanel.displayName = 'IbgeSearchPanel';
