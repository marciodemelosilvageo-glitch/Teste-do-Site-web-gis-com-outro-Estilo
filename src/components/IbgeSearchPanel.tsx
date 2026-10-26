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
  ChevronLeft, 
  ChevronRight,
  RotateCcw,
  MoveHorizontal
} from 'lucide-react';
import { buscarEnderecos, listarMunicipios } from '../duckdb';
import { toTitleCase } from '../utils';
import { logActivity } from '../services/adminService';

export interface ExternalPolygonSearchResult {
  results: any[];
  totalEncontrado: number;
  title: string;
  sourceLayerName?: string;
  timestamp: number;
}

interface IbgeSearchPanelProps {
  onPlotAddress: (address: any) => void;
  onPlotAllAddresses?: (addresses: any[]) => void;
  onClearPlot?: () => void;
  externalPolygonResult?: ExternalPolygonSearchResult | null;
  allowedColumns?: Record<string, boolean>;
  embedded?: boolean;
  isMaximized?: boolean;
}

export const DEFAULT_COLUMN_WIDTHS: Record<string, number> = {
  codigo_unico: 190,
  municipio: 180,
  endereco: 300,
  numero_logradouro: 120,
  complemento: 200,
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

const ITEMS_PER_PAGE = 50;

export const IbgeSearchPanel: React.FC<IbgeSearchPanelProps> = ({ 
  onPlotAddress, 
  onPlotAllAddresses, 
  onClearPlot,
  externalPolygonResult,
  allowedColumns,
  embedded = false,
  isMaximized = false
}) => {
  const visibleTableColumns = useMemo(() => {
    if (!allowedColumns) return tableColumns;
    return tableColumns.filter(c => allowedColumns[c.key] !== false);
  }, [allowedColumns]);

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

  // Paginação no cliente para manter 60fps mesmo com milhares de resultados
  const [currentPage, setCurrentPage] = useState(1);

  // Monitora resultados vindos de busca espacial por polígono
  useEffect(() => {
    if (externalPolygonResult && externalPolygonResult.timestamp > 0) {
      setResults(externalPolygonResult.results);
      setTotalEncontrado(externalPolygonResult.totalEncontrado);
      setHasSearched(true);
      setIsPlotted(false);
      setCurrentPage(1);
      setTextoBusca('');
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
  }, [externalPolygonResult]);

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
      const filtered = prev.filter(item => item && typeof item === 'string' && item.toLowerCase() !== trimmed.toLowerCase());
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
      const exists = prev.some(item => item && typeof item === 'string' && item.toLowerCase() === trimmed.toLowerCase());
      let updated: string[];
      if (exists) {
        updated = prev.filter(item => item && typeof item === 'string' && item.toLowerCase() !== trimmed.toLowerCase());
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
      const updated = prev.filter(item => item && typeof item === 'string' && item.toLowerCase().trim() !== cleanTerm);
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

      setResults(res.results);
      setTotalEncontrado(res.totalEncontrado);
      setHasSearched(true);
      setIsPlotted(false);
      setCurrentPage(1);

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
    setCurrentPage(1);
    setPolygonSearchTitle(null);
    setErrorMsg(null);
    if (onClearPlot) {
      onClearPlot();
    }
  };

  const handlePlotCurrentPage = () => {
    if (onPlotAllAddresses && paginatedResults.length > 0) {
      onPlotAllAddresses(paginatedResults);
      setIsPlotted(true);
    }
  };

  const exportToCSV = useCallback(() => {
    if (!results || results.length === 0) return;

    const visibleCols = tableColumns.filter(c => !allowedColumns || allowedColumns[c.key] !== false);
    const headers = visibleCols.map(c => `"${c.label.replace(/"/g, '""')}"`).join(',');
    
    const rows = results.map(row => {
      return visibleCols.map(col => {
        const val = row[col.key];
        if (val === null || val === undefined) return '""';
        return `"${String(val).replace(/"/g, '""')}"`;
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

    logActivity('EXPORTACAO', `Exportou ${results.length} endereços CNEFE (${municipio}) para planilha CSV`, 'user');
  }, [results, municipio, allowedColumns]);

  // Itens paginados para renderização leve no DOM
  const totalPages = Math.ceil(results.length / ITEMS_PER_PAGE);
  const paginatedResults = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return results.slice(start, start + ITEMS_PER_PAGE);
  }, [results, currentPage]);

  const filteredMunicipios = useMemo(() => {
    const q = String(municipioBusca || '').toLowerCase().trim();
    const list = Array.isArray(municipiosList) ? municipiosList.filter(m => m && typeof m === 'string') : [];
    if (!q) return list;
    return list.filter(m => String(m).toLowerCase().includes(q));
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
          <div className="h-px bg-gradient-to-r from-transparent via-slate-300 dark:via-slate-700 to-transparent flex-1" />
          <div className="flex items-center gap-2 px-3.5 py-1 bg-slate-100 dark:bg-slate-800 rounded-full border border-slate-200 dark:border-slate-700/80 shadow-xs">
            <Building2 size={15} className="text-red-600 dark:text-red-400" />
            <span className="text-xs font-black text-slate-800 dark:text-slate-100 uppercase tracking-wider">Dashboard de Endereços</span>
          </div>
          <div className="h-px bg-gradient-to-r from-transparent via-slate-300 dark:via-slate-700 to-transparent flex-1" />
        </div>
      )}

      <div className={`rounded-2xl transition-all ${
        embedded 
          ? 'bg-transparent border-0 p-1 sm:p-2 shadow-none' 
          : 'bg-white dark:bg-slate-900 shadow-xl border border-slate-200/80 dark:border-slate-800 p-5 sm:p-7 relative backdrop-blur-sm'
      }`}>
        {/* Cabeçalho (apenas quando não embutido, pois a bottom bar já possui seu header elegante) */}
        {!embedded && (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-5 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-gradient-to-tr from-red-600 to-rose-600 text-white flex items-center justify-center shadow-md shadow-red-500/20 shrink-0">
                <Table2 size={22} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg sm:text-xl font-black text-slate-800 dark:text-slate-100 tracking-tight">Busca de Endereços Avançado</h2>
                  <span className="text-[10px] font-extrabold uppercase bg-red-50 dark:bg-red-950/80 text-red-700 dark:text-red-300 px-2 py-0.5 rounded-full border border-red-200/80 dark:border-red-800/60">
                    IBGE
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">
                  Localização precisa de logradouros, domicílios e estabelecimentos em todos os municípios do Piauí.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Formulário de Busca */}
        <form onSubmit={(e) => { e.preventDefault(); handleSearch(undefined, e); }} className="flex flex-col lg:flex-row items-stretch lg:items-start gap-4 mb-6">
          {/* Município */}
          <div className="flex-1 relative" ref={selectRef}>
            <label className="flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
              <Building2 size={13} className="text-red-600 dark:text-red-400" />
              Município
            </label>
            <div className="relative">
              <div 
                className={`w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-sm font-semibold text-slate-800 dark:text-slate-100 outline-none focus-within:border-red-500 focus-within:ring-2 focus-within:ring-red-500/20 flex justify-between items-center transition-all cursor-pointer hover:border-slate-400 dark:hover:border-slate-600 ${isSelectOpen ? 'border-red-500 ring-2 ring-red-500/20 bg-white dark:bg-slate-800' : ''}`}
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
                <ChevronDown size={16} className={`text-slate-400 transition-transform duration-200 ${isSelectOpen ? 'rotate-180 text-red-600' : ''}`} />
              </div>
              
              {isSelectOpen && (
                <div className="mt-2 w-full bg-white dark:bg-slate-800/95 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg max-h-64 flex flex-col overflow-hidden transition-all animate-fadeIn">
                  <div className="p-2 border-b border-slate-100 dark:border-slate-700 sticky top-0 bg-white dark:bg-slate-800 z-10">
                    <div className="relative">
                      <input
                        type="text"
                        placeholder="Pesquisar município..."
                        value={municipioBusca}
                        onChange={(e) => setMunicipioBusca(e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                        className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-800 dark:text-slate-100 outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500"
                        autoFocus
                      />
                      <Search size={13} className="absolute left-2.5 top-2 text-slate-400" />
                    </div>
                  </div>
                  <div className="overflow-y-auto py-1 custom-scrollbar max-h-48">
                    {isLoadingMunicipios ? (
                      <div className="px-3 py-4 text-xs text-center text-slate-400 flex items-center justify-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin text-red-500" />
                        <span>Carregando municípios...</span>
                      </div>
                    ) : (
                      <>
                        <div 
                          className={`px-3 py-2 text-xs font-bold transition-colors cursor-pointer ${
                            municipio === "Todos" 
                              ? 'bg-red-50 dark:bg-red-950/50 text-red-700 dark:text-red-300 font-extrabold' 
                              : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/60'
                          }`}
                          onClick={() => { setMunicipio("Todos"); setIsSelectOpen(false); }}
                        >
                          Todos os Municípios
                        </div>
                        {filteredMunicipios.map(m => (
                          <div 
                            key={m} 
                            className={`px-3 py-2 text-xs font-medium transition-colors cursor-pointer ${
                              municipio === m 
                                ? 'bg-red-50 dark:bg-red-950/50 text-red-700 dark:text-red-300 font-bold' 
                                : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/60'
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
          
          {/* Campo de Busca Principal */}
          <div className="flex-[2] relative">
            <label className="flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
              <Search size={13} className="text-red-600 dark:text-red-400" />
              Endereço, número, Bairro
            </label>
            <div className="relative flex items-center">
              <input 
                type="text" 
                value={textoBusca}
                onChange={(e) => setTextoBusca(e.target.value)}
                onFocus={() => ensureMunicipiosLoaded()}
                placeholder="Endereço, número, Bairro..."
                className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 rounded-xl pl-3.5 pr-16 py-2.5 text-sm font-semibold text-slate-800 dark:text-slate-100 placeholder:text-slate-400 outline-none focus:border-red-500 focus:ring-2 focus:ring-red-500/20 transition-all"
              />
              {textoBusca.trim() !== '' && (
                <div className="absolute right-2.5 flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => toggleSaveSearch(textoBusca)}
                    className={`p-1.5 transition-colors cursor-pointer rounded-lg ${
                      savedSearches.some(s => s && typeof s === 'string' && s.toLowerCase() === textoBusca.trim().toLowerCase())
                        ? 'text-amber-500 hover:text-amber-600 bg-amber-50 dark:bg-amber-950/50'
                        : 'text-slate-400 hover:text-amber-500 hover:bg-slate-200/50 dark:hover:bg-slate-700/50'
                    }`}
                    title={
                      savedSearches.some(s => s && typeof s === 'string' && s.toLowerCase() === textoBusca.trim().toLowerCase())
                        ? "Remover das pesquisas salvas"
                        : "Salvar esta pesquisa nos favoritos"
                    }
                  >
                    <Star className={`w-4 h-4 ${savedSearches.some(s => s && typeof s === 'string' && s.toLowerCase() === textoBusca.trim().toLowerCase()) ? 'fill-amber-500' : ''}`} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setTextoBusca('')}
                    className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-slate-200/50 dark:hover:bg-slate-700/50 cursor-pointer rounded-lg transition-colors"
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
              <Filter size={13} className="text-red-600 dark:text-red-400" />
              Limite
            </label>
            <select 
              value={limit}
              onChange={(e) => setLimit(Number(e.target.value))}
              className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-800 dark:text-slate-100 outline-none focus:border-red-500 focus:ring-2 focus:ring-red-500/20 transition-all cursor-pointer"
            >
              <option value={100}>100</option>
              <option value={500}>500</option>
              <option value={1000}>1000</option>
              <option value={5000}>5000</option>
              <option value={10000}>10000</option>
            </select>
          </div>
          
          {/* Opção Avançada */}
          <div className="flex flex-col">
            <div className="h-[22px] hidden lg:block" />
            <label className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-300 cursor-pointer select-none bg-slate-100 dark:bg-slate-800/80 hover:bg-slate-200/70 dark:hover:bg-slate-700/70 px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 transition-all h-10">
              <input 
                type="checkbox" 
                checked={modoAvancado} 
                onChange={(e) => setModoAvancado(e.target.checked)}
                className="w-4 h-4 rounded text-red-600 focus:ring-red-500 border-slate-300 dark:border-slate-600 cursor-pointer"
              />
              <span className="whitespace-nowrap">Avançado</span>
            </label>
          </div>

          {/* Botões de Ação */}
          <div className="flex flex-col w-full lg:w-auto">
            <div className="h-[22px] hidden lg:block" />
            <div className="flex items-center gap-2 w-full lg:w-auto">
              <button 
                type="submit" 
                disabled={isSearching}
                className="h-10 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 disabled:from-red-400 disabled:to-rose-400 text-white px-6 rounded-xl font-bold text-sm shadow-md shadow-red-500/20 hover:shadow-lg hover:shadow-red-500/30 active:scale-[0.98] flex items-center justify-center gap-2 transition-all w-full lg:w-auto cursor-pointer"
              >
                {isSearching ? <Loader2 className="animate-spin" size={18} /> : <Search size={18} />}
                <span>Buscar</span>
              </button>
              
              {hasSearched && (
                <button
                  type="button"
                  onClick={() => {
                    setResults([]);
                    setHasSearched(false);
                    setTextoBusca('');
                    if (onClearPlot) onClearPlot();
                    setIsPlotted(false);
                    setTotalEncontrado(0);
                    setCurrentPage(1);
                  }}
                  className="h-10 bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 px-4 rounded-xl font-bold text-xs flex items-center justify-center transition-all cursor-pointer border border-slate-300/60 dark:border-slate-700 shrink-0"
                  title="Limpar Pesquisa"
                >
                  Limpar
                </button>
              )}
            </div>
          </div>
        </form>

        {/* Histórico e Salvos */}
        {(recentSearches.length > 0 || savedSearches.length > 0) && (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mb-6 text-xs bg-slate-50/80 dark:bg-slate-800/40 p-3 rounded-xl border border-slate-200/80 dark:border-slate-800">
            {recentSearches.length > 0 && (
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="flex items-center gap-1 font-extrabold text-slate-500 dark:text-slate-400 select-none uppercase tracking-wider text-[10px]">
                  <History className="w-3.5 h-3.5 text-red-500" />
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
                      className="bg-white dark:bg-slate-800 hover:bg-red-50 dark:hover:bg-red-950/60 text-slate-700 dark:text-slate-200 hover:text-red-700 dark:hover:text-red-300 font-semibold px-2.5 py-1 rounded-lg transition-all cursor-pointer border border-slate-200 dark:border-slate-700 shadow-2xs flex items-center gap-1"
                      title={`Refazer busca: ${term}`}
                    >
                      <span className="truncate max-w-[140px]">{term}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {savedSearches.length > 0 && (
              <div className="flex items-center gap-1.5 flex-wrap border-l border-slate-200 dark:border-slate-700 pl-3">
                <span className="flex items-center gap-1 font-extrabold text-amber-600 dark:text-amber-400 select-none uppercase tracking-wider text-[10px]">
                  <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                  Salvas:
                </span>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {savedSearches.map((term, idx) => (
                    <div
                      key={`saved-addr-${idx}`}
                      className="group bg-amber-50/80 dark:bg-amber-950/40 hover:bg-amber-100 dark:hover:bg-amber-900/50 border border-amber-200 dark:border-amber-800/60 text-amber-900 dark:text-amber-200 font-semibold px-2.5 py-1 rounded-lg transition-all flex items-center gap-1.5 shadow-2xs"
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

        {errorMsg && (
          <div className="p-4 mb-6 bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 rounded-xl text-xs font-bold border border-red-200 dark:border-red-800/60 flex items-center gap-2">
            <X className="shrink-0 text-red-500" size={16} />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Tabela de Resultados do Dashboard */}
        {hasSearched && (
          <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden flex flex-col shadow-sm bg-white dark:bg-slate-900">
            {/* Barra KPI e Ações Rápidas */}
            <div className="bg-slate-50/90 dark:bg-slate-800/90 backdrop-blur-md px-5 py-3.5 flex flex-wrap justify-between items-center gap-3 border-b border-slate-200 dark:border-slate-800">
              <div className="flex flex-wrap items-center gap-3">
                <div className="bg-red-100 dark:bg-red-900/60 text-red-700 dark:text-red-300 text-xs font-black px-3 py-1.5 rounded-lg border border-red-200 dark:border-red-800/50 flex items-center gap-1.5 shadow-2xs">
                  <Sparkles size={14} />
                  <span>{totalEncontrado.toLocaleString('pt-BR')} {totalEncontrado === 1 ? 'Endereço' : 'Endereços'}</span>
                </div>
                {polygonSearchTitle && (
                  <div className="bg-amber-100 dark:bg-amber-950/70 border border-amber-300 dark:border-amber-700/80 text-amber-900 dark:text-amber-200 text-xs font-black px-3 py-1.5 rounded-lg flex items-center gap-1.5 shadow-2xs">
                    <MapPin size={13} className="text-amber-600 dark:text-amber-400 shrink-0" />
                    <span>Polígono: {polygonSearchTitle}</span>
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
                        onPlotAllAddresses(results);
                        setIsPlotted(true);
                      }}
                      className="text-xs font-bold bg-red-600 hover:bg-red-700 text-white px-3.5 py-1.5 rounded-xl flex items-center gap-1.5 shadow-xs transition-all cursor-pointer"
                    >
                      <Map size={14} /> Plotar Todos no Mapa ({results.length})
                    </button>
                  )}
                  {onClearPlot && isPlotted && (
                    <button 
                      onClick={() => {
                        onClearPlot();
                        setIsPlotted(false);
                      }}
                      className="text-xs font-bold bg-slate-700 hover:bg-slate-800 text-white px-3.5 py-1.5 rounded-xl flex items-center gap-1.5 shadow-xs transition-all cursor-pointer"
                    >
                      <Map size={14} /> Desplotar do Mapa
                    </button>
                  )}
                  <button 
                    onClick={handleResetColumnWidths}
                    className="text-xs font-bold bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 px-3 py-1.5 rounded-xl flex items-center gap-1.5 hover:bg-slate-100 dark:hover:bg-slate-600/80 transition-all cursor-pointer shadow-2xs"
                    title="Restaurar larguras padrão de todas as colunas"
                  >
                    <RotateCcw size={13} /> Restaurar Colunas
                  </button>
                  <button 
                    onClick={exportToCSV}
                    className="text-xs font-bold bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 px-3.5 py-1.5 rounded-xl flex items-center gap-1.5 hover:bg-slate-100 dark:hover:bg-slate-600/80 transition-all cursor-pointer shadow-2xs"
                  >
                    <Download size={14} /> Exportar CSV (Excel)
                  </button>
                </div>
              )}
            </div>
            
            {results.length > 0 ? (
              <>
                <div className={`overflow-x-auto overflow-y-auto custom-scrollbar ${
                  embedded 
                    ? 'max-h-[calc(var(--cnefe-bottom-height,46vh)-180px)] min-h-[160px]' 
                    : 'max-h-[540px]'
                }`}>
                  <table className="text-left text-xs whitespace-nowrap border-collapse" style={{ minWidth: '100%', width: 'max-content' }}>
                    <thead className="bg-slate-100/95 dark:bg-slate-800/95 backdrop-blur-md text-slate-700 dark:text-slate-300 sticky top-0 z-10 shadow-xs select-none">
                      <tr>
                        <th className="px-3 py-3 font-extrabold w-14 min-w-[56px] max-w-[56px] text-center border-b border-slate-200 dark:border-slate-700 sticky left-0 z-20 bg-slate-100 dark:bg-slate-800 shadow-r">
                          Ação
                        </th>
                        {visibleTableColumns.map(col => {
                          const width = columnWidths[col.key] || DEFAULT_COLUMN_WIDTHS[col.key] || 180;
                          const isResizingThis = resizingColKey === col.key;
                          return (
                            <th 
                              key={col.key} 
                              style={{ width: `${width}px`, minWidth: `${width}px`, maxWidth: `${width}px` }}
                              className="relative px-3.5 py-3 font-extrabold uppercase tracking-wider text-[11px] border-b border-slate-200 dark:border-slate-700 group/th"
                            >
                              <div className="truncate pr-2.5 font-black select-none" title={`${col.label} (Arraste a borda para redimensionar)`}>
                                {col.label}
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
                                  isResizingThis ? 'bg-red-500/20' : 'group-hover/th:bg-slate-300/40 dark:group-hover/th:bg-slate-700/60'
                                }`}
                              >
                                <div className={`w-[2px] h-3/5 rounded-full transition-colors ${
                                  isResizingThis ? 'bg-red-600 scale-y-125' : 'bg-slate-300 dark:bg-slate-600 group-hover/th:bg-red-500'
                                }`} />
                              </div>
                            </th>
                          );
                        })}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {paginatedResults.map((row, i) => (
                        <tr 
                          key={row.codigo_unico || i} 
                          onClick={() => onPlotAddress(row)}
                          className="hover:bg-red-50/70 dark:hover:bg-red-950/30 transition-colors cursor-pointer group"
                        >
                          <td className="px-3 py-2.5 text-center sticky left-0 z-10 bg-white/95 dark:bg-slate-900/95 group-hover:bg-red-50 dark:group-hover:bg-red-950/30 shadow-r" onClick={(e) => e.stopPropagation()}>
                            <button 
                              onClick={() => onPlotAddress(row)}
                              className="bg-red-100 hover:bg-red-600 dark:bg-red-950/80 dark:hover:bg-red-600 text-red-700 hover:text-white dark:text-red-300 dark:hover:text-white p-1.5 rounded-lg transition-all cursor-pointer shadow-2xs"
                              title="Navegar e destacar no mapa"
                            >
                              <MapPin size={15} />
                            </button>
                          </td>
                          {visibleTableColumns.map(col => {
                            const width = columnWidths[col.key] || DEFAULT_COLUMN_WIDTHS[col.key] || 180;
                            const val = row[col.key];
                            if (val === null || val === undefined) {
                              return (
                                <td 
                                  key={col.key} 
                                  style={{ width: `${width}px`, minWidth: `${width}px`, maxWidth: `${width}px` }}
                                  className="px-3.5 py-2.5 text-slate-700 dark:text-slate-300 font-medium truncate"
                                >
                                  <span className="text-slate-300 dark:text-slate-600 font-normal">-</span>
                                </td>
                              );
                            }
                            const valStr = String(val);
                            const isTextCol = ['municipio', 'endereco', 'bairro', 'localidade', 'nucleo_urbano', 'favela_comunidade', 'agromerado', 'comunidade_rural', 'estabelecimento'].includes(col.key);
                            const displayVal = isTextCol ? toTitleCase(valStr) : valStr;

                            return (
                              <td 
                                key={col.key} 
                                style={{ width: `${width}px`, minWidth: `${width}px`, maxWidth: `${width}px` }}
                                className="px-3.5 py-2.5 text-slate-700 dark:text-slate-300 font-medium truncate" 
                                title={displayVal}
                              >
                                {displayVal}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Paginação */}
                {totalPages > 1 && (
                  <div className="px-4 py-3 bg-slate-50 dark:bg-slate-800/60 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs">
                    <span className="text-slate-500 dark:text-slate-400 font-medium">
                      Página <strong>{currentPage}</strong> de <strong>{totalPages}</strong> ({results.length} carregados)
                    </span>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                        disabled={currentPage === 1}
                        className="px-2.5 py-1 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-slate-700 dark:text-slate-200 font-bold disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-100 cursor-pointer flex items-center gap-1"
                      >
                        <ChevronLeft size={14} /> Anterior
                      </button>
                      <button
                        onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                        disabled={currentPage === totalPages}
                        className="px-2.5 py-1 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-slate-700 dark:text-slate-200 font-bold disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-100 cursor-pointer flex items-center gap-1"
                      >
                        Próxima <ChevronRight size={14} />
                      </button>
                    </div>
                  </div>
                )}
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
