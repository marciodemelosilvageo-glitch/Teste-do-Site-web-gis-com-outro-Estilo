import React, { useMemo } from 'react';
import { Users, Home, ShieldAlert, Building } from 'lucide-react';
import { SelectedFeature } from '../types';

interface DashboardProps {
  selectedFeatures: SelectedFeature[];
}

// Helper para obter valores numéricos de propriedades com tolerância a vírgulas e strings
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

export const Dashboard: React.FC<DashboardProps> = ({ selectedFeatures }) => {
  if (!selectedFeatures || selectedFeatures.length === 0) {
    return null;
  }

  const { title, sumPop, sumDomTotal, sumVagos, taxaVac, densidade, sumDomCol } = useMemo(() => {
    const count = selectedFeatures.length;
    let localTitle = 'Selecione um local';
    let pop = 0;
    let domPart = 0;
    let domOcup = 0;
    let domCol = 0;
    let domTotal = 0;

    if (count === 1) {
      const feat = selectedFeatures[0];
      localTitle = feat.name || 'Área Selecionada';
      const props = feat.properties;

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
      localTitle = `Seleção Múltipla (${count} áreas)`;
      selectedFeatures.forEach(feat => {
        const props = feat.properties;
        pop += getNumVal(props, ['V0001', 'Total de pessoas', 'POPULACAO', 'populacao']);
        domPart += getNumVal(props, ['V0003', 'Total de Domicílios Particulares']);
        domOcup += getNumVal(props, ['V0007', 'Total de Domicílios Particulares Ocupados']);
        domCol += getNumVal(props, ['V0004', 'Total de Domicílios Coletivos']);
        
        let totalD = getNumVal(props, ['V0002', 'Total de Domicílios (Particulares + Coletivos)']);
        if (totalD === 0) {
          totalD = getNumVal(props, ['V0003', 'Total de Domicílios Particulares']) + getNumVal(props, ['V0004', 'Total de Domicílios Coletivos']);
        }
        domTotal += totalD;
      });
    }

    const vagos = Math.max(0, domPart - domOcup);
    const vacRate = domPart > 0 ? ((vagos / domPart) * 100).toFixed(1) : '0.0';
    const density = domOcup > 0 ? (pop / domOcup).toFixed(2) : '0.00';

    return {
      title: localTitle,
      sumPop: pop,
      sumDomTotal: domTotal,
      sumVagos: vagos,
      taxaVac: vacRate,
      densidade: density,
      sumDomCol: domCol
    };
  }, [selectedFeatures]);

  return (
    <section id="dashboard-container" aria-label="Raio-X Territorial e Domiciliar" className="w-full bg-slate-50 dark:bg-slate-800/90 rounded-2xl shadow-xl p-5 sm:p-6 border border-slate-200 dark:border-slate-700/80 transition-all">
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-lg sm:text-xl font-bold text-slate-800 dark:text-slate-100 border-l-4 border-red-600 pl-3">
          Raio-X Territorial e Domiciliar: <span id="dash-local-name" className="text-red-600 dark:text-red-400 font-semibold">{title}</span>
        </h2>
      </div>

      {/* Grid de KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: População */}
        <div 
          className="bg-white dark:bg-slate-900 p-4 rounded-xl shadow-xs border border-slate-100 dark:border-slate-800 flex items-center hover:shadow-md transition-shadow cursor-help" 
          title="Soma total de habitantes residentes na área selecionada."
        >
          <div className="p-3 rounded-full bg-red-100 dark:bg-red-950/80 text-red-600 dark:text-red-400 mr-4 shrink-0">
            <Users className="h-7 w-7 sm:h-8 sm:w-8" />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wide font-bold">
              População Total 
            </p>
            <p id="dash-pop" className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-slate-100 truncate">
              {sumPop.toLocaleString('pt-BR')}
            </p>
            <p id="dash-dens" className="text-xs text-red-600 dark:text-red-400 font-semibold mt-0.5">
              {densidade} mor./dom
            </p>
          </div>
        </div>

        {/* KPI 2: Domicílios */}
        <div 
          className="bg-white dark:bg-slate-900 p-4 rounded-xl shadow-xs border border-slate-100 dark:border-slate-800 flex items-center hover:shadow-md transition-shadow cursor-help" 
          title="Soma de todos os domicílios particulares e coletivos cadastrados no censo para esta área."
        >
          <div className="p-3 rounded-full bg-emerald-100 dark:bg-emerald-950/80 text-emerald-600 dark:text-emerald-400 mr-4 shrink-0">
            <Home className="h-7 w-7 sm:h-8 sm:w-8" />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wide font-bold">
              Total Domicílios 
            </p>
            <p id="dash-dom-total" className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-slate-100 truncate">
              {sumDomTotal.toLocaleString('pt-BR')}
            </p>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5 font-medium">Cadastrados</p>
          </div>
        </div>

        {/* KPI 3: Vacância */}
        <div 
          className="bg-white dark:bg-slate-900 p-4 rounded-xl shadow-xs border border-slate-100 dark:border-slate-800 flex items-center hover:shadow-md transition-shadow relative overflow-hidden cursor-help" 
          title="Domicílios identificados como vagos ou de uso ocasional no momento do recenseamento."
        >
          <div className="absolute right-0 top-0 h-full w-1 bg-orange-500" />
          <div className="p-3 rounded-full bg-orange-100 dark:bg-orange-950/80 text-orange-600 dark:text-orange-400 mr-4 shrink-0">
            <ShieldAlert className="h-7 w-7 sm:h-8 sm:w-8" />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wide font-bold">
              Vagos / Ocasional 
            </p>
            <p id="dash-vagos" className="text-xl sm:text-2xl font-extrabold text-orange-600 dark:text-orange-400 truncate">
              {sumVagos.toLocaleString('pt-BR')}
            </p>
            <p id="dash-taxa-vac" className="text-xs text-orange-500 dark:text-orange-400 font-bold mt-0.5">
              Taxa: {taxaVac}%
            </p>
          </div>
        </div>

        {/* KPI 4: Coletivos */}
        <div 
          className="bg-white dark:bg-slate-900 p-4 rounded-xl shadow-xs border border-slate-100 dark:border-slate-800 flex items-center hover:shadow-md transition-shadow cursor-help" 
          title="Instituições como asilos, prisões, quartéis, hospitais, alojamentos etc."
        >
          <div className="p-3 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 mr-4 shrink-0">
            <Building className="h-7 w-7 sm:h-8 sm:w-8" />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wide font-bold">
              Dom. Coletivos 
            </p>
            <p id="dash-coletivos" className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-slate-100 truncate">
              {sumDomCol.toLocaleString('pt-BR')}
            </p>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5 font-medium">Instituições</p>
          </div>
        </div>
      </div>
    </section>
  );
};
