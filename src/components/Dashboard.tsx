import React, { useMemo, useState } from 'react';
import { 
  Users, 
  Home, 
  ShieldAlert, 
  Building, 
  Copy, 
  Check, 
  MapPin, 
  TrendingUp, 
  Sparkles,
  Layers,
  Activity,
  ArrowUpRight
} from 'lucide-react';
import { SelectedFeature } from '../types';

interface DashboardProps {
  selectedFeatures: SelectedFeature[];
}

// Helper para obter valores numéricos com tolerância a vírgulas e tipos
const getNumVal = (props: Record<string, any> | undefined, keys: string[]): number => {
  if (!props) return 0;
  for (const k of keys) {
    if (props[k] !== undefined && props[k] !== null) {
      let v = props[k];
      if (typeof v === 'string') {
        v = parseFloat(v.replace(',', '.'));
      }
      return Number(v) || 0;
    }
  }
  return 0;
};

// Formatação amigável para nomes próprios
const formatTitle = (text: string): string => {
  if (!text) return '';
  return text
    .toLowerCase()
    .split(' ')
    .map(word => {
      if (['de', 'da', 'do', 'das', 'dos', 'e', 'em'].includes(word)) return word;
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(' ');
};

export const Dashboard: React.FC<DashboardProps> = ({ selectedFeatures }) => {
  const [copied, setCopied] = useState(false);

  // Se nenhuma feição estiver selecionada, renderiza o Onboarding elegante estilo Apple
  if (!selectedFeatures || selectedFeatures.length === 0) {
    return (
      <div 
        id="dashboard-container"
        className="w-full rounded-3xl p-6 bg-white/70 dark:bg-[#1c1c1e]/70 backdrop-blur-2xl border border-black/5 dark:border-white/10 shadow-sm text-center space-y-5 animate-fadeIn"
      >
        <div className="w-14 h-14 mx-auto rounded-3xl bg-gradient-to-tr from-[#007AFF] to-[#5856D6] flex items-center justify-center text-white shadow-lg shadow-blue-500/25">
          <Activity className="w-7 h-7" />
        </div>

        <div className="space-y-1.5">
          <h3 className="text-base font-extrabold text-slate-900 dark:text-white tracking-tight">
            Raio-X Territorial e Domiciliar
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xs mx-auto leading-relaxed">
            Selecione qualquer bairro, município ou setor censitário no mapa para carregar a análise demográfica oficial do IBGE.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-2.5 text-left pt-2">
          <div className="flex items-center gap-3 p-3 rounded-2xl bg-black/[0.03] dark:bg-white/[0.04] border border-black/5 dark:border-white/5">
            <div className="w-8 h-8 rounded-xl bg-blue-500/10 text-[#007AFF] dark:text-blue-400 flex items-center justify-center shrink-0">
              <Users className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-800 dark:text-slate-200">População Residente</p>
              <p className="text-[11px] text-slate-400">Total de habitantes e média de pessoas por residência.</p>
            </div>
          </div>

          <div className="flex items-center gap-3 p-3 rounded-2xl bg-black/[0.03] dark:bg-white/[0.04] border border-black/5 dark:border-white/5">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
              <Home className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-800 dark:text-slate-200">Estrutura Habitacional</p>
              <p className="text-[11px] text-slate-400">Domicílios particulares ocupados, vagos e coletivos.</p>
            </div>
          </div>

          <div className="flex items-center gap-3 p-3 rounded-2xl bg-black/[0.03] dark:bg-white/[0.04] border border-black/5 dark:border-white/5">
            <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
              <ShieldAlert className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-800 dark:text-slate-200">Taxa de Vacância</p>
              <p className="text-[11px] text-slate-400">Percentual de imóveis desocupados ou de uso ocasional.</p>
            </div>
          </div>
        </div>

        <div className="pt-1 flex items-center justify-center gap-1.5 text-[11px] font-semibold text-[#007AFF]">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Base de Dados: Censo IBGE 2022</span>
        </div>
      </div>
    );
  }

  const {
    title,
    municipio,
    bairro,
    areaKm2,
    sumPop,
    sumDomTotal,
    sumDomPart,
    sumDomOcup,
    sumVagos,
    taxaVac,
    densidade,
    sumDomCol,
    taxaOcupacao,
    pctOcup,
    pctVagos,
    pctCol,
    count
  } = useMemo(() => {
    const totalCount = selectedFeatures.length;
    let localTitle = 'Selecione um local';
    let munName = '';
    let bairroName = '';
    let totalArea = 0;

    let pop = 0;
    let domPart = 0;
    let domOcup = 0;
    let domCol = 0;
    let domTotal = 0;

    if (totalCount === 1) {
      const feat = selectedFeatures[0];
      localTitle = feat.name || 'Área Selecionada';
      const props = feat.properties || {};

      munName = props.NM_MUN || props.nm_mun || props.municipio || props.MUNICIPIO || '';
      bairroName = props.NM_BAIRRO || props.nm_bairro || props.bairro || props.BAIRRO || '';
      totalArea = getNumVal(props, ['AREA_KM2', 'area_km2', 'Area_km2', 'area']);

      pop = getNumVal(props, ['V0001', 'Total de pessoas', 'POPULACAO', 'populacao']);
      domPart = getNumVal(props, ['V0003', 'Total de Domicílios Particulares']);
      domOcup = getNumVal(props, ['V0007', 'Total de Domicílios Particulares Ocupados']);
      domCol = getNumVal(props, ['V0004', 'Total de Domicílios Coletivos']);
      
      let totalD = getNumVal(props, ['V0002', 'Total de Domicílios (Particulares + Coletivos)']);
      if (totalD === 0) {
        totalD = domPart + domCol;
      }
      domTotal = totalD;
    } else {
      localTitle = `Seleção Múltipla (${totalCount} áreas)`;
      selectedFeatures.forEach(feat => {
        const props = feat.properties || {};
        pop += getNumVal(props, ['V0001', 'Total de pessoas', 'POPULACAO', 'populacao']);
        domPart += getNumVal(props, ['V0003', 'Total de Domicílios Particulares']);
        domOcup += getNumVal(props, ['V0007', 'Total de Domicílios Particulares Ocupados']);
        domCol += getNumVal(props, ['V0004', 'Total de Domicílios Coletivos']);
        totalArea += getNumVal(props, ['AREA_KM2', 'area_km2', 'Area_km2', 'area']);
        
        let totalD = getNumVal(props, ['V0002', 'Total de Domicílios (Particulares + Coletivos)']);
        if (totalD === 0) {
          totalD = domPart + domCol;
        }
        domTotal += totalD;
      });
    }

    const vagos = Math.max(0, domPart - domOcup);
    const vacRate = domPart > 0 ? ((vagos / domPart) * 100).toFixed(1) : '0.0';
    const density = domOcup > 0 ? (pop / domOcup).toFixed(2) : '0.00';
    const ocupRate = domTotal > 0 ? ((domOcup / domTotal) * 100).toFixed(1) : '0.0';

    // Percentuais relativos para a barra segmentada
    const safeTotal = domTotal > 0 ? domTotal : 1;
    const pOcup = Math.min(100, (domOcup / safeTotal) * 100);
    const pVagos = Math.min(100 - pOcup, (vagos / safeTotal) * 100);
    const pCol = Math.max(0, 100 - pOcup - pVagos);

    return {
      title: formatTitle(localTitle),
      municipio: formatTitle(munName),
      bairro: formatTitle(bairroName),
      areaKm2: totalArea > 0 ? totalArea.toLocaleString('pt-BR', { maximumFractionDigits: 2 }) : null,
      sumPop: pop,
      sumDomTotal: domTotal,
      sumDomPart: domPart,
      sumDomOcup: domOcup,
      sumVagos: vagos,
      taxaVac: vacRate,
      densidade: density,
      sumDomCol: domCol,
      taxaOcupacao: ocupRate,
      pctOcup: pOcup,
      pctVagos: pVagos,
      pctCol: pCol,
      count: totalCount
    };
  }, [selectedFeatures]);

  // Ação de copiar resumo demográfico
  const handleCopySummary = () => {
    const text = `📊 *Raio-X Territorial e Domiciliar - ${title}*
👥 População Total: ${sumPop.toLocaleString('pt-BR')} habitantes
📈 Média por Domicílio: ${densidade} moradores/dom.
🏠 Total de Domicílios: ${sumDomTotal.toLocaleString('pt-BR')}
  • Particulares Ocupados: ${sumDomOcup.toLocaleString('pt-BR')} (${taxaOcupacao}%)
  • Vagos / Uso Ocasional: ${sumVagos.toLocaleString('pt-BR')} (Vacância: ${taxaVac}%)
  • Coletivos (Instituições): ${sumDomCol.toLocaleString('pt-BR')}
${areaKm2 ? `🗺️ Área Territorial: ${areaKm2} km²\n` : ''}📍 Fonte: Censo Demográfico IBGE 2022 | WebGIS Geocodificando`;

    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2200);
  };

  return (
    <section 
      id="dashboard-container" 
      aria-label="Raio-X Territorial e Domiciliar" 
      className="w-full space-y-4 animate-fadeIn"
    >
      {/* 1. CARD PRINCIPAL DA LOCALIDADE COM BADGES */}
      <div className="p-4 sm:p-5 rounded-3xl bg-white/80 dark:bg-[#1c1c1e]/80 backdrop-blur-2xl border border-black/5 dark:border-white/10 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-blue-500/10 text-[#007AFF] dark:text-blue-400">
            <span className="w-1.5 h-1.5 rounded-full bg-[#007AFF] animate-pulse" />
            Censo IBGE 2022
          </span>

          <button
            type="button"
            onClick={handleCopySummary}
            className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/20 text-slate-700 dark:text-slate-300 transition-all cursor-pointer active:scale-95"
            title="Copiar resumo para a área de transferência"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-500" />
                <span className="text-emerald-600 dark:text-emerald-400">Copiado!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>Copiar</span>
              </>
            )}
          </button>
        </div>

        <div>
          <h2 
            id="dash-local-name" 
            className="text-lg sm:text-xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2"
          >
            <MapPin className="w-5 h-5 text-[#007AFF] shrink-0" />
            <span className="truncate">{title}</span>
          </h2>

          <div className="flex flex-wrap items-center gap-2 mt-2 pt-2 border-t border-black/5 dark:border-white/5 text-[11px] text-slate-500 dark:text-slate-400">
            {municipio && (
              <span className="px-2 py-0.5 rounded-lg bg-black/[0.03] dark:bg-white/[0.05] font-semibold">
                {municipio}
              </span>
            )}
            {bairro && (
              <span className="px-2 py-0.5 rounded-lg bg-black/[0.03] dark:bg-white/[0.05] font-semibold">
                Bairro {bairro}
              </span>
            )}
            {count > 1 && (
              <span className="px-2 py-0.5 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 font-bold">
                {count} polígonos unidos
              </span>
            )}
            {areaKm2 && (
              <span className="px-2 py-0.5 rounded-lg bg-black/[0.03] dark:bg-white/[0.05] font-semibold">
                {areaKm2} km²
              </span>
            )}
          </div>
        </div>
      </div>

      {/* 2. HERO CARD: POPULAÇÃO TOTAL (Apple Style Glassmorphic) */}
      <div 
        className="p-5 rounded-3xl bg-gradient-to-br from-blue-500/10 via-indigo-500/10 to-transparent dark:from-blue-500/20 dark:via-indigo-500/15 dark:to-transparent border border-blue-500/20 dark:border-blue-400/20 shadow-xs relative overflow-hidden"
        title="População total recenseada nesta localidade"
      >
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <span className="text-[11px] font-black uppercase tracking-wider text-[#007AFF] dark:text-blue-400 block">
              População Residente
            </span>
            <p 
              id="dash-pop" 
              className="text-3xl sm:text-4xl font-black text-slate-900 dark:text-white tracking-tight"
            >
              {sumPop.toLocaleString('pt-BR')}
            </p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
              habitantes contabilizados
            </p>
          </div>

          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-[#007AFF] to-[#5856D6] flex items-center justify-center text-white shadow-lg shadow-blue-500/30 shrink-0">
            <Users className="w-6 h-6" />
          </div>
        </div>

        {/* Badge de Densidade Residencial */}
        <div className="mt-4 pt-3 border-t border-blue-500/15 dark:border-blue-400/15 flex items-center justify-between text-xs">
          <span className="text-slate-600 dark:text-slate-300 font-medium flex items-center gap-1.5">
            <Activity className="w-3.5 h-3.5 text-[#007AFF]" />
            Adensamento Familiar:
          </span>
          <span 
            id="dash-dens" 
            className="px-2.5 py-0.5 rounded-full bg-[#007AFF]/15 text-[#007AFF] dark:text-blue-300 font-black text-[11px]"
          >
            {densidade} mor./domicílio
          </span>
        </div>
      </div>

      {/* 3. ESTRUTURA HABITACIONAL & BARRA MULTI-SEGMENTO APPLE */}
      <div className="p-4 sm:p-5 rounded-3xl bg-white/80 dark:bg-[#1c1c1e]/80 backdrop-blur-2xl border border-black/5 dark:border-white/10 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-[11px] font-black uppercase tracking-wider text-slate-400 block">
              Estrutura Habitacional
            </span>
            <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">
              Perfil dos Domicílios
            </h3>
          </div>

          <div className="text-right">
            <span 
              id="dash-dom-total" 
              className="text-lg font-black text-slate-900 dark:text-white block"
            >
              {sumDomTotal.toLocaleString('pt-BR')}
            </span>
            <span className="text-[10px] text-slate-400 font-medium block">
              total de unidades
            </span>
          </div>
        </div>

        {/* Barra de Distribuição Segmentada Estilo Apple */}
        <div className="space-y-1.5">
          <div className="w-full h-3 rounded-full bg-black/5 dark:bg-white/10 overflow-hidden flex gap-0.5 p-0.5">
            <div 
              style={{ width: `${pctOcup}%` }} 
              className="h-full rounded-full bg-[#34C759] transition-all duration-500" 
              title={`Ocupados: ${sumDomOcup.toLocaleString('pt-BR')} (${pctOcup.toFixed(1)}%)`}
            />
            <div 
              style={{ width: `${pctVagos}%` }} 
              className="h-full rounded-full bg-[#FF9500] transition-all duration-500" 
              title={`Vagos / Ocasional: ${sumVagos.toLocaleString('pt-BR')} (${pctVagos.toFixed(1)}%)`}
            />
            <div 
              style={{ width: `${pctCol}%` }} 
              className="h-full rounded-full bg-[#AF52DE] transition-all duration-500" 
              title={`Coletivos: ${sumDomCol.toLocaleString('pt-BR')} (${pctCol.toFixed(1)}%)`}
            />
          </div>

          <div className="flex items-center justify-between text-[10px] font-bold text-slate-400 px-0.5">
            <span className="text-[#34C759] flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-[#34C759]" /> Ocupados ({pctOcup.toFixed(0)}%)
            </span>
            <span className="text-[#FF9500] flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-[#FF9500]" /> Vagos ({pctVagos.toFixed(0)}%)
            </span>
            <span className="text-[#AF52DE] flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-[#AF52DE]" /> Coletivos
            </span>
          </div>
        </div>

        {/* Indicadores Detalhados em Cards Estilo Widgets iOS */}
        <div className="grid grid-cols-2 gap-2.5 pt-1">
          {/* Card: Domicílios Ocupados */}
          <div className="p-3 rounded-2xl bg-black/[0.02] dark:bg-white/[0.03] border border-black/5 dark:border-white/5 space-y-1.5">
            <div className="flex items-center justify-between">
              <div className="w-7 h-7 rounded-xl bg-emerald-500/10 text-[#34C759] flex items-center justify-center">
                <Home className="w-3.5 h-3.5" />
              </div>
              <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                {taxaOcupacao}%
              </span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 font-semibold block uppercase tracking-wider">
                Habitados
              </span>
              <p className="text-base font-black text-slate-900 dark:text-white truncate">
                {sumDomOcup.toLocaleString('pt-BR')}
              </p>
            </div>
          </div>

          {/* Card: Domicílios Vagos */}
          <div className="p-3 rounded-2xl bg-black/[0.02] dark:bg-white/[0.03] border border-black/5 dark:border-white/5 space-y-1.5">
            <div className="flex items-center justify-between">
              <div className="w-7 h-7 rounded-xl bg-amber-500/10 text-[#FF9500] flex items-center justify-center">
                <ShieldAlert className="w-3.5 h-3.5" />
              </div>
              <span id="dash-taxa-vac" className="text-[10px] font-bold text-amber-600 dark:text-amber-400">
                {taxaVac}% vac.
              </span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 font-semibold block uppercase tracking-wider">
                Vagos / Ocasional
              </span>
              <p id="dash-vagos" className="text-base font-black text-[#FF9500] truncate">
                {sumVagos.toLocaleString('pt-BR')}
              </p>
            </div>
          </div>

          {/* Card: Domicílios Coletivos */}
          <div className="p-3 rounded-2xl bg-black/[0.02] dark:bg-white/[0.03] border border-black/5 dark:border-white/5 space-y-1.5">
            <div className="flex items-center justify-between">
              <div className="w-7 h-7 rounded-xl bg-purple-500/10 text-[#AF52DE] flex items-center justify-center">
                <Building className="w-3.5 h-3.5" />
              </div>
              <span className="text-[10px] font-bold text-purple-600 dark:text-purple-400">
                Instituições
              </span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 font-semibold block uppercase tracking-wider">
                Coletivos
              </span>
              <p id="dash-coletivos" className="text-base font-black text-slate-900 dark:text-white truncate">
                {sumDomCol.toLocaleString('pt-BR')}
              </p>
            </div>
          </div>

          {/* Card: Domicílios Particulares */}
          <div className="p-3 rounded-2xl bg-black/[0.02] dark:bg-white/[0.03] border border-black/5 dark:border-white/5 space-y-1.5">
            <div className="flex items-center justify-between">
              <div className="w-7 h-7 rounded-xl bg-blue-500/10 text-[#007AFF] flex items-center justify-center">
                <TrendingUp className="w-3.5 h-3.5" />
              </div>
              <span className="text-[10px] font-bold text-[#007AFF]">
                Particulares
              </span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 font-semibold block uppercase tracking-wider">
                Base Residencial
              </span>
              <p className="text-base font-black text-slate-900 dark:text-white truncate">
                {sumDomPart.toLocaleString('pt-BR')}
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
