import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Hospital, MapPin, Navigation, Search, Check, ChevronLeft, Compass, Loader2, Pill, UtensilsCrossed, Fuel, Hotel } from 'lucide-react';

export type CategorySearchType = 'hospitais' | 'farmacias' | 'restaurantes' | 'postos' | 'hoteis';

interface HospitalSidebarPanelProps {
  category?: CategorySearchType;
  onBack: () => void;
  onSearchByMunicipio: (municipio: string) => void;
  onSearchByRadius?: (raioMetros: number) => void;
  availableMunicipios?: string[];
  isLoading?: boolean;
}

export const CATEGORY_UI_META: Record<CategorySearchType, {
  name: string;
  title: string;
  subtitle: string;
  icon: React.ComponentType<{ className?: string }>;
  iconBg: string;
  cardBg: string;
  border: string;
  shadow: string;
}> = {
  hospitais: {
    name: 'Hospitais & Saúde',
    title: 'Hospitais & Saúde',
    subtitle: 'CNEFE IBGE • Estabelecimentos de Saúde',
    icon: Hospital,
    iconBg: 'bg-red-600',
    cardBg: 'from-red-500/10 via-red-500/5 to-transparent',
    border: 'border-red-500/15',
    shadow: 'shadow-red-500/20'
  },
  farmacias: {
    name: 'Farmácias & Drogarias',
    title: 'Farmácias & Drogarias',
    subtitle: 'CNEFE IBGE • Estabelecimentos por nome',
    icon: Pill,
    iconBg: 'bg-rose-500',
    cardBg: 'from-rose-500/10 via-rose-500/5 to-transparent',
    border: 'border-rose-500/15',
    shadow: 'shadow-rose-500/20'
  },
  restaurantes: {
    name: 'Restaurantes & Alimentação',
    title: 'Restaurantes & Alimentação',
    subtitle: 'CNEFE IBGE • Estabelecimentos por nome',
    icon: UtensilsCrossed,
    iconBg: 'bg-orange-500',
    cardBg: 'from-orange-500/10 via-orange-500/5 to-transparent',
    border: 'border-orange-500/15',
    shadow: 'shadow-orange-500/20'
  },
  postos: {
    name: 'Postos de Gasolina',
    title: 'Postos de Gasolina',
    subtitle: 'CNEFE IBGE • Estabelecimentos por nome',
    icon: Fuel,
    iconBg: 'bg-blue-600',
    cardBg: 'from-blue-500/10 via-blue-500/5 to-transparent',
    border: 'border-blue-500/15',
    shadow: 'shadow-blue-500/20'
  },
  hoteis: {
    name: 'Hotéis & Pousadas',
    title: 'Hotéis & Pousadas',
    subtitle: 'CNEFE IBGE • Estabelecimentos por nome',
    icon: Hotel,
    iconBg: 'bg-purple-600',
    cardBg: 'from-purple-500/10 via-purple-500/5 to-transparent',
    border: 'border-purple-500/15',
    shadow: 'shadow-purple-500/20'
  }
};

const PRESET_RADII = [
  { label: '500 m', value: 500, desc: 'A pé' },
  { label: '1.000 m (1 km)', value: 1000, desc: 'Bairro' },
  { label: '2.000 m (2 km)', value: 2000, desc: 'Próximo' },
  { label: '5.000 m (5 km)', value: 5000, desc: 'Região' },
  { label: '10.000 m (10 km)', value: 10000, desc: 'Cidade' }
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
  'Luis Correia',
  'Cocal',
  'Bom Jesus',
  'Corrente'
];

export const HospitalSidebarPanel: React.FC<HospitalSidebarPanelProps> = ({
  category = 'hospitais',
  onBack,
  onSearchByMunicipio,
  onSearchByRadius,
  availableMunicipios = [],
  isLoading = false
}) => {
  const meta = CATEGORY_UI_META[category] || CATEGORY_UI_META.hospitais;
  const CategoryIcon = meta.icon;

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

    return Array.from(new Set(['Todos', 'Teresina', ...list]));
  }, [availableMunicipios]);

  const filteredMunicipios = React.useMemo(() => {
    if (!filterMunText.trim()) return allMunicipios;
    const term = filterMunText.toLowerCase();
    return allMunicipios.filter(m => m.toLowerCase().includes(term));
  }, [allMunicipios, filterMunText]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchMode === 'municipio' || !onSearchByRadius) {
      onSearchByMunicipio(selectedMunicipio);
    } else {
      const radiusToUse = isCustomRadius ? (parseInt(customRadiusText, 10) || selectedRadius) : selectedRadius;
      onSearchByRadius(radiusToUse);
    }
  };

  return (
    <div className="space-y-4 animate-fadeIn">
      {/* Botão de retorno à busca comum */}
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-1.5 text-xs font-bold text-[#007AFF] hover:underline cursor-pointer group"
      >
        <ChevronLeft className="w-4 h-4 transition-transform group-hover:-translate-x-0.5" />
        <span>Voltar à busca</span>
      </button>

      {/* Card Cabeçalho da Ferramenta */}
      <div className={`p-3.5 rounded-2xl bg-gradient-to-br ${meta.cardBg} border ${meta.border} flex items-center gap-3`}>
        <div className={`w-10 h-10 rounded-2xl ${meta.iconBg} text-white flex items-center justify-center shrink-0 shadow-sm ${meta.shadow}`}>
          <CategoryIcon className="w-5 h-5" />
        </div>
        <div className="min-w-0">
          <h3 className="text-sm font-black text-slate-900 dark:text-white truncate">
            {meta.name}
          </h3>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Pergunta de Seleção de Modo (se busca por raio estiver disponível) */}
        {onSearchByRadius && (
          <div className="space-y-2">
            <label className="block text-xs font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 px-0.5">
              Onde deseja pesquisar?
            </label>

            <div className="grid grid-cols-2 gap-2">
              {/* Opção 1: Por Município */}
              <button
                type="button"
              onClick={() => setSearchMode('municipio')}
              className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex flex-col gap-1.5 relative ${searchMode === 'municipio'
                  ? 'bg-[#007AFF]/10 border-[#007AFF] shadow-sm text-[#007AFF] dark:text-[#0a84ff]'
                  : 'bg-black/[0.02] dark:bg-white/[0.04] border-black/5 dark:border-white/5 hover:bg-black/[0.05] dark:hover:bg-white/[0.08] text-slate-700 dark:text-slate-200'
                }`}
            >
              <div className="flex items-center justify-between w-full">
                <div className={`w-7 h-7 rounded-xl flex items-center justify-center ${searchMode === 'municipio' ? 'bg-[#007AFF] text-white' : 'bg-black/5 dark:bg-white/10 text-slate-600 dark:text-slate-300'
                  }`}>
                  <MapPin className="w-3.5 h-3.5" />
                </div>
                {searchMode === 'municipio' && (
                  <span className="w-4 h-4 rounded-full bg-[#007AFF] text-white flex items-center justify-center">
                    <Check className="w-2.5 h-2.5 stroke-[3]" />
                  </span>
                )}
              </div>
              <div>
                <div className="text-xs font-black leading-tight">Por Município</div>
                <div className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">
                  Teresina ou outra cidade
                </div>
              </div>
            </button>

            {/* Opção 2: Ao Redor da Minha Localização */}
            <button
              type="button"
              onClick={() => setSearchMode('radius')}
              className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex flex-col gap-1.5 relative ${searchMode === 'radius'
                  ? 'bg-[#007AFF]/10 border-[#007AFF] shadow-sm text-[#007AFF] dark:text-[#0a84ff]'
                  : 'bg-black/[0.02] dark:bg-white/[0.04] border-black/5 dark:border-white/5 hover:bg-black/[0.05] dark:hover:bg-white/[0.08] text-slate-700 dark:text-slate-200'
                }`}
            >
              <div className="flex items-center justify-between w-full">
                <div className={`w-7 h-7 rounded-xl flex items-center justify-center ${searchMode === 'radius' ? 'bg-[#007AFF] text-white' : 'bg-black/5 dark:bg-white/10 text-slate-600 dark:text-slate-300'
                  }`}>
                  <Navigation className="w-3.5 h-3.5" />
                </div>
                {searchMode === 'radius' && (
                  <span className="w-4 h-4 rounded-full bg-[#007AFF] text-white flex items-center justify-center">
                    <Check className="w-2.5 h-2.5 stroke-[3]" />
                  </span>
                )}
              </div>
              <div>
                <div className="text-xs font-black leading-tight">Ao Redor de Mim</div>
                <div className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">
                  Raio de distância GPS
                </div>
              </div>
            </button>
          </div>
        </div>
        )}

        {/* MODO MUNICÍPIO */}
        {searchMode === 'municipio' && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-2.5 bg-black/[0.02] dark:bg-white/[0.03] p-3 rounded-2xl border border-black/5 dark:border-white/5"
          >
            <div className="flex items-center justify-between">
              <label className="text-xs font-black text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-[#007AFF]" />
                Selecione a Cidade:
              </label>
              <span className="text-[10px] text-slate-400 font-bold">
                {filteredMunicipios.length} disponíveis
              </span>
            </div>

            {/* Campo para filtrar municípios rapidamente */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <input
                type="text"
                value={filterMunText}
                onChange={(e) => setFilterMunText(e.target.value)}
                placeholder="Filtrar cidade (ex: Teresina...)"
                className="w-full pl-8 pr-3 py-2 text-xs rounded-xl bg-white dark:bg-black/30 border border-black/10 dark:border-white/10 text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#007AFF]"
              />
            </div>

            {/* Lista com scroll */}
            <div className="max-h-44 overflow-y-auto space-y-1 custom-scrollbar pr-1">
              {filteredMunicipios.map((mun) => {
                const isSelected = selectedMunicipio.toLowerCase() === mun.toLowerCase();
                return (
                  <button
                    key={mun}
                    type="button"
                    onClick={() => setSelectedMunicipio(mun)}
                    className={`w-full px-3 py-1.5 rounded-xl text-xs font-semibold text-left transition-all flex items-center justify-between cursor-pointer ${isSelected
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

        {/* MODO RAIO GPS */}
        {searchMode === 'radius' && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-3 bg-black/[0.02] dark:bg-white/[0.03] p-3 rounded-2xl border border-black/5 dark:border-white/5"
          >
            <div>
              <label className="text-xs font-black text-slate-700 dark:text-slate-200 flex items-center gap-1.5 mb-1">
                <Compass className="w-3.5 h-3.5 text-[#007AFF]" />
                Quantos metros será o raio ao redor de sua localização?
              </label>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                O GPS do seu dispositivo será usado para listar os hospitais mais próximos.
              </p>
            </div>

            {/* Chips de Raio */}
            <div className="grid grid-cols-2 gap-2">
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
                    className={`px-2.5 py-2 rounded-xl border text-center transition-all cursor-pointer flex flex-col items-center justify-center ${isSelected
                        ? 'bg-[#007AFF] border-[#007AFF] text-white shadow-sm'
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

              {/* Botão Raio Customizado */}
              <button
                type="button"
                onClick={() => setIsCustomRadius(true)}
                className={`px-2.5 py-2 rounded-xl border text-center transition-all cursor-pointer flex flex-col items-center justify-center ${isCustomRadius
                    ? 'bg-[#007AFF] border-[#007AFF] text-white shadow-sm'
                    : 'bg-white dark:bg-black/20 border-black/5 dark:border-white/10 hover:bg-black/5 dark:hover:bg-white/5 text-slate-700 dark:text-slate-200'
                  }`}
              >
                <span className="text-xs font-black">Outro Raio</span>
                <span className={`text-[10px] ${isCustomRadius ? 'text-white/80' : 'text-slate-400'}`}>
                  Digitar metros
                </span>
              </button>
            </div>

            {/* Input customizado */}
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
                  className="w-full px-3 py-1.5 text-xs font-bold rounded-xl bg-white dark:bg-black/30 border border-black/10 dark:border-white/10 text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#007AFF]"
                />
                <span className="text-xs font-black text-slate-500 shrink-0">metros</span>
              </motion.div>
            )}

            <div className="p-2 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-700 dark:text-blue-300 text-[11px] font-medium flex items-center gap-2">
              <Navigation className="w-3.5 h-3.5 shrink-0" />
              <span>
                Raio: <strong>{isCustomRadius ? `${customRadiusText || 0}m` : `${selectedRadius.toLocaleString('pt-BR')}m (${selectedRadius / 1000} km)`}</strong>.
              </span>
            </div>
          </motion.div>
        )}

        {/* Botão de Pesquisa no CNEFE */}
        <button
          type="submit"
          disabled={isLoading}
          className="w-full py-3 rounded-2xl bg-[#007AFF] hover:bg-[#0062cc] active:scale-[0.98] text-white text-xs font-black transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
        >
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Consultando CNEFE...</span>
            </>
          ) : (
            <>
              <Search className="w-4 h-4 stroke-[2.5]" />
              <span>
                {searchMode === 'municipio'
                  ? `Pesquisar em ${selectedMunicipio === 'Todos' ? 'todo o Piauí' : selectedMunicipio}`
                  : `Pesquisar em Raio de ${isCustomRadius ? customRadiusText : selectedRadius}m`}
              </span>
            </>
          )}
        </button>
      </form>
    </div>
  );
};

