import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Hospital, MapPin, Navigation, X, Search, Check, ChevronDown, Compass } from 'lucide-react';

interface HospitalSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSearchByMunicipio: (municipio: string) => void;
  onSearchByRadius: (raioMetros: number) => void;
  availableMunicipios?: string[];
  isLoading?: boolean;
}

const PRESET_RADII = [
  { label: '500 m', value: 500, desc: 'Muito próximo a pé' },
  { label: '1.000 m (1 km)', value: 1000, desc: 'Bairro e proximidades' },
  { label: '2.000 m (2 km)', value: 2000, desc: 'Região intermediária' },
  { label: '5.000 m (5 km)', value: 5000, desc: 'Zona ampliada' },
  { label: '10.000 m (10 km)', value: 10000, desc: 'Toda a cidade' }
];

const DEFAULT_MUNICIPIOS_PI = [
  'Todos',
  'Teresina',
  'Parnaíba',
  'Picos',
  'Floriano',
  'Piripiri',
  'Campo Maior',
  'Barras',
  'União',
  'Altos',
  'Esperantina',
  'Pedro II',
  'Oeiras',
  'São Raimundo Nonato',
  'José de Freitas',
  'Valença do Piauí',
  'Batalha',
  'Luís Correia',
  'Cocal',
  'Bom Jesus',
  'Corrente'
];

export const HospitalSearchModal: React.FC<HospitalSearchModalProps> = ({
  isOpen,
  onClose,
  onSearchByMunicipio,
  onSearchByRadius,
  availableMunicipios = [],
  isLoading = false
}) => {
  const [searchMode, setSearchMode] = useState<'municipio' | 'radius'>('municipio');
  const [selectedMunicipio, setSelectedMunicipio] = useState<string>('Teresina');
  const [filterMunText, setFilterMunText] = useState<string>('');
  const [selectedRadius, setSelectedRadius] = useState<number>(1000);
  const [customRadiusText, setCustomRadiusText] = useState<string>('1000');
  const [isCustomRadius, setIsCustomRadius] = useState<boolean>(false);

  // Combina lista de municípios recebida com fallback
  const allMunicipios = React.useMemo(() => {
    const list = availableMunicipios && availableMunicipios.length > 0
      ? availableMunicipios
      : DEFAULT_MUNICIPIOS_PI;
    
    const unique = Array.from(new Set(['Todos', 'Teresina', ...list]));
    return unique;
  }, [availableMunicipios]);

  const filteredMunicipios = React.useMemo(() => {
    if (!filterMunText.trim()) return allMunicipios;
    const term = filterMunText.toLowerCase();
    return allMunicipios.filter(m => m.toLowerCase().includes(term));
  }, [allMunicipios, filterMunText]);

  // Tecla Escape para fechar
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchMode === 'municipio') {
      onSearchByMunicipio(selectedMunicipio);
    } else {
      const radiusToUse = isCustomRadius ? (parseInt(customRadiusText, 10) || selectedRadius) : selectedRadius;
      onSearchByRadius(radiusToUse);
    }
  };

  return (
    <AnimatePresence>
      <div 
        className="fixed inset-0 z-[10015] flex items-center justify-center p-4 bg-black/45 backdrop-blur-md animate-fadeIn"
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.94, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.94, y: 12 }}
          transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
          className="w-full max-w-lg bg-white/95 dark:bg-[#1c1c1e]/95 backdrop-blur-3xl rounded-3xl shadow-2xl border border-black/10 dark:border-white/10 overflow-hidden flex flex-col text-slate-800 dark:text-slate-100"
          role="dialog"
          aria-modal="true"
        >
          {/* Cabeçalho */}
          <div className="px-6 py-5 border-b border-black/5 dark:border-white/5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-red-500/10 dark:bg-red-500/20 text-red-600 dark:text-red-400 border border-red-500/20 flex items-center justify-center shrink-0 shadow-sm">
                <Hospital className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-black tracking-tight text-slate-900 dark:text-white">
                  Buscar Hospitais e Saúde
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                  CNEFE IBGE • Estabelecimentos de Saúde
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/20 transition-colors flex items-center justify-center text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white cursor-pointer"
              title="Fechar"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-6">
            {/* Pergunta de Seleção de Modo */}
            <div>
              <label className="block text-xs font-black uppercase tracking-wider text-slate-400 dark:text-slate-400 mb-3">
                Como você deseja realizar a pesquisa?
              </label>

              <div className="grid grid-cols-2 gap-3">
                {/* Opção 1: Por Município */}
                <button
                  type="button"
                  onClick={() => setSearchMode('municipio')}
                  className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer flex flex-col gap-2 relative ${
                    searchMode === 'municipio'
                      ? 'bg-[#007AFF]/10 border-[#007AFF] shadow-sm text-[#007AFF] dark:text-[#0a84ff]'
                      : 'bg-black/[0.02] dark:bg-white/[0.04] border-black/5 dark:border-white/5 hover:bg-black/[0.05] dark:hover:bg-white/[0.08] text-slate-700 dark:text-slate-200'
                  }`}
                >
                  <div className="flex items-center justify-between w-full">
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                      searchMode === 'municipio' ? 'bg-[#007AFF] text-white' : 'bg-black/5 dark:bg-white/10 text-slate-600 dark:text-slate-300'
                    }`}>
                      <MapPin className="w-4 h-4" />
                    </div>
                    {searchMode === 'municipio' && (
                      <span className="w-5 h-5 rounded-full bg-[#007AFF] text-white flex items-center justify-center">
                        <Check className="w-3 h-3 stroke-[3]" />
                      </span>
                    )}
                  </div>
                  <div>
                    <div className="text-xs font-black">Por Município</div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 font-medium leading-snug">
                      Teresina, outra cidade ou todo o Piauí
                    </div>
                  </div>
                </button>

                {/* Opção 2: Ao Redor da Minha Localização */}
                <button
                  type="button"
                  onClick={() => setSearchMode('radius')}
                  className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer flex flex-col gap-2 relative ${
                    searchMode === 'radius'
                      ? 'bg-[#007AFF]/10 border-[#007AFF] shadow-sm text-[#007AFF] dark:text-[#0a84ff]'
                      : 'bg-black/[0.02] dark:bg-white/[0.04] border-black/5 dark:border-white/5 hover:bg-black/[0.05] dark:hover:bg-white/[0.08] text-slate-700 dark:text-slate-200'
                  }`}
                >
                  <div className="flex items-center justify-between w-full">
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                      searchMode === 'radius' ? 'bg-[#007AFF] text-white' : 'bg-black/5 dark:bg-white/10 text-slate-600 dark:text-slate-300'
                    }`}>
                      <Navigation className="w-4 h-4" />
                    </div>
                    {searchMode === 'radius' && (
                      <span className="w-5 h-5 rounded-full bg-[#007AFF] text-white flex items-center justify-center">
                        <Check className="w-3 h-3 stroke-[3]" />
                      </span>
                    )}
                  </div>
                  <div>
                    <div className="text-xs font-black">Ao Redor de Mim</div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 font-medium leading-snug">
                      Hospitais próximos por raio GPS
                    </div>
                  </div>
                </button>
              </div>
            </div>

            {/* Painel Específico: MUNICÍPIO */}
            {searchMode === 'municipio' && (
              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-3 bg-black/[0.02] dark:bg-white/[0.03] p-4 rounded-2xl border border-black/5 dark:border-white/5"
              >
                <div className="flex items-center justify-between">
                  <label className="text-xs font-black text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-[#007AFF]" />
                    Selecione o Município:
                  </label>
                  <span className="text-[10px] text-slate-400 font-bold">
                    {filteredMunicipios.length} opções
                  </span>
                </div>

                {/* Filtro rápido de município */}
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  <input
                    type="text"
                    value={filterMunText}
                    onChange={(e) => setFilterMunText(e.target.value)}
                    placeholder="Filtrar cidade (ex: Teresina, Parnaíba...)"
                    className="w-full pl-8 pr-3 py-2 text-xs rounded-xl bg-white dark:bg-black/30 border border-black/10 dark:border-white/10 text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#007AFF]"
                  />
                </div>

                {/* Select / Lista com scroll */}
                <div className="max-h-36 overflow-y-auto space-y-1 custom-scrollbar pr-1">
                  {filteredMunicipios.map((mun) => {
                    const isSelected = selectedMunicipio.toLowerCase() === mun.toLowerCase();
                    return (
                      <button
                        key={mun}
                        type="button"
                        onClick={() => setSelectedMunicipio(mun)}
                        className={`w-full px-3 py-2 rounded-xl text-xs font-semibold text-left transition-all flex items-center justify-between cursor-pointer ${
                          isSelected
                            ? 'bg-[#007AFF] text-white shadow-sm'
                            : 'hover:bg-black/5 dark:hover:bg-white/5 text-slate-700 dark:text-slate-200'
                        }`}
                      >
                        <span>{mun === 'Todos' ? '📍 Todo o Estado do Piauí' : mun}</span>
                        {isSelected && <Check className="w-3.5 h-3.5" />}
                      </button>
                    );
                  })}
                </div>
              </motion.div>
            )}

            {/* Painel Específico: RAIO GPS */}
            {searchMode === 'radius' && (
              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-4 bg-black/[0.02] dark:bg-white/[0.03] p-4 rounded-2xl border border-black/5 dark:border-white/5"
              >
                <div>
                  <label className="text-xs font-black text-slate-700 dark:text-slate-200 flex items-center gap-1.5 mb-2">
                    <Compass className="w-3.5 h-3.5 text-[#007AFF]" />
                    Quantos metros será o raio ao redor de sua localização?
                  </label>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium mb-3">
                    O sistema obterá o GPS do seu dispositivo e listará os estabelecimentos de saúde mais próximos.
                  </p>
                </div>

                {/* Chips de Raio Predefinidos */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {PRESET_RADII.map((item) => {
                    const isSelected = !isCustomRadius && selectedRadius === item.value;
                    return (
                      <button
                        key={item.value}
                        type="button"
                        onClick={() => {
                          setSelectedRadius(item.value);
                          setIsCustomRadius(false);
                        }}
                        className={`px-3 py-2.5 rounded-xl border text-center transition-all cursor-pointer flex flex-col items-center justify-center ${
                          isSelected
                            ? 'bg-[#007AFF] border-[#007AFF] text-white shadow-md'
                            : 'bg-white dark:bg-black/20 border-black/5 dark:border-white/10 hover:bg-black/5 dark:hover:bg-white/5 text-slate-700 dark:text-slate-200'
                        }`}
                      >
                        <span className="text-xs font-black">{item.label}</span>
                        <span className={`text-[10px] ${isSelected ? 'text-white/80' : 'text-slate-400'}`}>
                          {item.desc}
                        </span>
                      </button>
                    );
                  })}

                  {/* Opção Raio Customizado */}
                  <button
                    type="button"
                    onClick={() => setIsCustomRadius(true)}
                    className={`px-3 py-2.5 rounded-xl border text-center transition-all cursor-pointer flex flex-col items-center justify-center ${
                      isCustomRadius
                        ? 'bg-[#007AFF] border-[#007AFF] text-white shadow-md'
                        : 'bg-white dark:bg-black/20 border-black/5 dark:border-white/10 hover:bg-black/5 dark:hover:bg-white/5 text-slate-700 dark:text-slate-200'
                    }`}
                  >
                    <span className="text-xs font-black">Outro Raio</span>
                    <span className={`text-[10px] ${isCustomRadius ? 'text-white/80' : 'text-slate-400'}`}>
                      Digitar em metros
                    </span>
                  </button>
                </div>

                {/* Input de Raio Customizado */}
                {isCustomRadius && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="flex items-center gap-2 pt-1"
                  >
                    <input
                      type="number"
                      min="50"
                      max="100000"
                      step="100"
                      value={customRadiusText}
                      onChange={(e) => setCustomRadiusText(e.target.value)}
                      placeholder="Ex: 1500"
                      className="w-full px-3.5 py-2 text-xs font-bold rounded-xl bg-white dark:bg-black/30 border border-black/10 dark:border-white/10 text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#007AFF]"
                    />
                    <span className="text-xs font-black text-slate-500 shrink-0">metros</span>
                  </motion.div>
                )}

                <div className="p-2.5 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-700 dark:text-blue-300 text-[11px] font-medium flex items-center gap-2">
                  <Navigation className="w-3.5 h-3.5 shrink-0" />
                  <span>
                    Raio ativo: <strong>{isCustomRadius ? `${customRadiusText || 0} metros` : `${selectedRadius.toLocaleString('pt-BR')} metros (${selectedRadius / 1000} km)`}</strong>.
                  </span>
                </div>
              </motion.div>
            )}

            {/* Rodapé com Botões de Ação */}
            <div className="pt-2 flex items-center justify-end gap-3 border-t border-black/5 dark:border-white/5">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-2xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-black/5 dark:hover:bg-white/10 transition-colors cursor-pointer"
              >
                Cancelar
              </button>

              <button
                type="submit"
                disabled={isLoading}
                className="px-5 py-2.5 rounded-2xl bg-[#007AFF] hover:bg-[#0062cc] active:scale-[0.98] text-white text-xs font-black transition-all shadow-md flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <Search className="w-3.5 h-3.5 stroke-[2.5]" />
                <span>
                  {searchMode === 'municipio'
                    ? `Pesquisar em ${selectedMunicipio === 'Todos' ? 'todo o Piauí' : selectedMunicipio}`
                    : `Pesquisar em Raio de ${isCustomRadius ? customRadiusText : selectedRadius}m`}
                </span>
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
