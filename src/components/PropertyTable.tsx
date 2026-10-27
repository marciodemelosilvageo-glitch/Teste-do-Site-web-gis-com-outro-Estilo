import React, { useMemo, useCallback } from 'react';
import { Copy, Search, Home } from 'lucide-react';
import { SelectedFeature } from '../types';
import { propertyNames } from '../data';
import { 
  getTranslatedValue, 
  getFeatureCenter, 
  toTitleCase,
  isCodeOrSystemProperty
} from '../utils';

interface PropertyTableProps {
  selectedFeatures: SelectedFeature[];
  showToast: (msg: string) => void;
  allowedProperties?: Record<string, boolean>;
  onSearchPolygonAddresses?: (feature: SelectedFeature) => void;
  onSearchLocalidadeAddresses?: (localidade: string, municipio: string) => void;
}

// Helper para obter valores numéricos
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

export const PropertyTable: React.FC<PropertyTableProps> = ({ 
  selectedFeatures, 
  showToast,
  allowedProperties,
  onSearchPolygonAddresses,
  onSearchLocalidadeAddresses
}) => {
  if (!selectedFeatures || selectedFeatures.length === 0) {
    return null;
  }

  const count = selectedFeatures.length;

  const handleCopy = useCallback((text: string, label: string) => {
    try {
      if (navigator && navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).catch(() => {});
      }
      showToast(`${label} copiada com sucesso!`);
    } catch {
      showToast(`${label} copiada!`);
    }
  }, [showToast]);

  // Processamento dos dados para exibição
  const processedData = useMemo(() => {
    if (count === 1) {
      const feat = selectedFeatures[0];
      const props = feat.properties || {};
      const center = (allowedProperties && allowedProperties['_centroide'] === false) ? null : getFeatureCenter(feat.layer);

      const pop = getNumVal(props, ['V0001', 'Total de pessoas', 'POPULACAO', 'populacao']);
      const domPart = getNumVal(props, ['V0003', 'Total de Domicílios Particulares']);
      const domOcup = getNumVal(props, ['V0007', 'Total de Domicílios Particulares Ocupados']);

      const domVagos = Math.max(0, domPart - domOcup);
      const taxaVac = domPart > 0 ? ((domVagos / domPart) * 100).toFixed(1) : '0.0';
      const densidade = domOcup > 0 ? (pop / domOcup).toFixed(2) : '0.00';

      const filteredProps: Array<{ key: string; label: string; value: string; isHighlighted: boolean }> = [];

      Object.keys(props).forEach(key => {
        // Ocultar fid, códigos técnicos e campos de sistema
        if (isCodeOrSystemProperty(key)) return;

        // Verificar permissão administrativa para a propriedade
        if (allowedProperties && allowedProperties[key] === false) return;

        const low = key.toLowerCase();
        const featNameUpper = String(feat.name || '').toUpperCase().trim();
        if (feat.sourceName === "Municipios" && (featNameUpper === "TERESINA" || featNameUpper === "PARNAÍBA" || featNameUpper === "PARNAIBA")) {
          if (low === 'aisp' || low === 'cod_aisp') return;
        }
        
        if (feat.sourceName === "AISP" || feat.sourceName === "Áreas de Desenvolvimento" || feat.sourceName === "RISP") {
          if (low === 'aisp' || low === 'cod_aisp') return;
        }
        
        if (feat.sourceName === "Localidades (Piauí)") {
          if (['id localidades', 'id_localidades', 'id localidade', 'total de domicilios', 'total de domicílios', 'taxa de vacancia', 'taxa de vacância', 'media de moradores', 'média de moradores', 'nm_uf', 'nome uf', 'nome_uf', 'uf'].includes(low)) return;
        } else if (feat.sourceName === "Comunidades Rurais de Teresina") {
          if (['id localidades', 'id_localidades', 'id localidade', 'total de domicilios', 'total de domicílios', 'taxa de vacancia', 'taxa de vacância', 'media de moradores', 'média de moradores'].includes(low)) return;
        }

        if (feat.sourceName === "Coordenadas" || feat.sourceName === "Coordenada" || feat.sourceName === "Coordenadas IBGE") {
          if (['latitude', 'longitude', 'lat', 'lng', 'lon', 'nome', 'tipo'].includes(low)) return;
        }

        const val = props[key];
        if (val == null || String(val).trim() === '') return;

        let translatedVal = getTranslatedValue(key, val);
        if ((low === 'latitude' || low === 'longitude' || low === 'lat' || low === 'lng') && val != null) {
          const numVal = parseFloat(String(val).replace(',', '.'));
          if (!isNaN(numVal)) {
            translatedVal = numVal.toFixed(6);
          }
        } else if (typeof val === 'string' && (key.startsWith('NM_') || key.toLowerCase().includes('nome') || key.toLowerCase().includes('localida') || key.toLowerCase().includes('bairro') || key.toLowerCase().includes('municip') || key.toLowerCase().includes('endereco') || key.toLowerCase().includes('logradouro'))) {
          translatedVal = toTitleCase(translatedVal);
        } else if (key === 'AREA_KM2' && typeof val === 'number') {
          translatedVal = `${val.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 3 })} km²`;
        }
        const disp = propertyNames[key] || key;
        const isHighlighted = key === 'NM_MUN' || key === 'NM_BAIRRO' || key === 'Nome' || key === 'Município' || key === 'Bairros' || key === 'Municipios';

        filteredProps.push({
          key,
          label: disp,
          value: translatedVal,
          isHighlighted
        });
      });

      // Ordenar priorizando nomes oficiais, área territorial e informações descritivas no topo
      filteredProps.sort((a, b) => {
        const priorityOrder = [
          'nm_mun', 'municipio', 'nome do município',
          'nm_bairro', 'bairro', 'nome do bairro',
          'nome', 'localidade', 'nm_fcu', 'nm_nu', 'nm_aglom',
          'nm_dist', 'distrito', 'nm_subdist', 'subdistrito', 'zona',
          'nm_rgint', 'nm_rgi', 'nm_uf',
          'area_km2',
          'situacao', 'cd_sit', 'situação detalhada',
          'tipo do setor', 'cd_tipo', 'tipo',
          'area de desenvolvimento', 'risp', 'aisp',
          'total de pessoas', 'v0001',
          'total de domicílios', 'v0002',
          'total de domicílios particulares', 'v0003',
          'total de domicílios particulares ocupados', 'v0007',
          'total de domicílios coletivos', 'v0004',
          'v0005'
        ];
        const idxA = priorityOrder.indexOf(a.key.toLowerCase());
        const idxB = priorityOrder.indexOf(b.key.toLowerCase());
        if (idxA !== -1 && idxB !== -1) return idxA - idxB;
        if (idxA !== -1) return -1;
        if (idxB !== -1) return 1;
        return 0;
      });

      return {
        isSingle: true,
        feat,
        center,
        domVagos,
        taxaVac,
        densidade,
        filteredProps
      };
    } else {
      let sumPop = 0;
      let sumDomPart = 0;
      let sumDomOcup = 0;
      let sumDomCol = 0;
      let sumDomTotal = 0;

      selectedFeatures.forEach(feat => {
        const props = feat.properties || {};
        sumPop += getNumVal(props, ['V0001', 'Total de pessoas', 'POPULACAO', 'populacao']);
        sumDomPart += getNumVal(props, ['V0003', 'Total de Domicílios Particulares']);
        sumDomOcup += getNumVal(props, ['V0007', 'Total de Domicílios Particulares Ocupados']);
        sumDomCol += getNumVal(props, ['V0004', 'Total de Domicílios Coletivos']);
        
        let totalD = getNumVal(props, ['V0002', 'Total de Domicílios (Particulares + Coletivos)']);
        if (totalD === 0) {
          totalD = getNumVal(props, ['V0003', 'Total de Domicílios Particulares']) + getNumVal(props, ['V0004', 'Total de Domicílios Coletivos']);
        }
        sumDomTotal += totalD;
      });

      const sumVagos = Math.max(0, sumDomPart - sumDomOcup);
      const avgTaxaVac = sumDomPart > 0 ? ((sumVagos / sumDomPart) * 100).toFixed(1) : '0.0';
      const avgDensidade = sumDomOcup > 0 ? (sumPop / sumDomOcup).toFixed(2) : '0.00';

      const metrics = [
        { label: 'População Total Consolidada', val: sumPop.toLocaleString('pt-BR') },
        { label: 'Total de Domicílios Geral', val: sumDomTotal.toLocaleString('pt-BR') },
        { label: 'Total de Domicílios Particulares', val: sumDomPart.toLocaleString('pt-BR') },
        { label: 'Total de Domicílios Ocupados', val: sumDomOcup.toLocaleString('pt-BR') },
        { label: 'Total de Domicílios Coletivos', val: sumDomCol.toLocaleString('pt-BR') },
        { label: 'Domicílios Vagos / Uso Ocasional', val: sumVagos.toLocaleString('pt-BR') },
        { label: 'Taxa de Vacância Média Consolidada', val: avgTaxaVac + '%' },
        { label: 'Densidade Média (Habitantes/Domicílio)', val: avgDensidade }
      ];

      return {
        isSingle: false,
        metrics
      };
    }
  }, [selectedFeatures, count, allowedProperties]);

  return (
    <div id="info-table-container" className="w-full bg-white dark:bg-slate-900 rounded-2xl shadow-xl p-5 border border-slate-200/80 dark:border-slate-800">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pb-3 border-b border-slate-100 dark:border-slate-800">
        <h3 className="text-lg font-black text-slate-900 dark:text-white border-l-4 border-[#007AFF] pl-3 tracking-tight">
          Especificação das Feições {count > 1 ? `(${count} selecionadas)` : ''}
        </h3>

        {selectedFeatures.length === 1 && !['Coordenadas', 'Coordenada', 'Coordenadas IBGE'].includes(selectedFeatures[0].sourceName) && (
          selectedFeatures[0].sourceName === "Localidades (Piauí)" ? (
            <button 
              onClick={() => {
                const f = selectedFeatures[0];
                const loc = f.properties?.Localidade || f.properties?.NM_LOCALIDA || f.name || '';
                const mun = f.properties?.['Nome do município'] || f.properties?.MUNICIPIO || f.properties?.Municipio || f.properties?.NM_MUN || '';
                if (onSearchLocalidadeAddresses) {
                  onSearchLocalidadeAddresses(loc, mun);
                } else if (onSearchPolygonAddresses) {
                  onSearchPolygonAddresses(f);
                }
              }}
              className="px-4 py-2 bg-gradient-to-r from-[#FF9500] to-[#FF5E3A] hover:brightness-105 active:scale-95 text-white font-bold rounded-2xl text-xs sm:text-sm flex items-center gap-2 transition-all shadow-md shadow-orange-500/20 cursor-pointer self-start sm:self-auto" 
              title="Consultar e listar todos os endereços do CNEFE/IBGE desta localidade"
            >
              <Home className="h-4 w-4" />
              Buscar Endereços desta Localidade
            </button>
          ) : (
            onSearchPolygonAddresses && (
              <button 
                onClick={() => onSearchPolygonAddresses(selectedFeatures[0])}
                className="px-4 py-2 bg-gradient-to-r from-[#007AFF] to-[#0062cc] hover:brightness-105 active:scale-95 text-white font-bold rounded-2xl text-xs sm:text-sm flex items-center gap-2 transition-all shadow-md shadow-blue-500/20 cursor-pointer self-start sm:self-auto" 
                title="Consultar e listar todos os endereços do CNEFE/IBGE contidos neste polígono"
              >
                <Search className="h-4 w-4" />
                Buscar Endereços CNEFE no Polígono
              </button>
            )
          )
        )}
      </div>

      <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-xl">
        <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800 text-xs sm:text-sm">
          <thead className="bg-slate-50 dark:bg-slate-800/90 text-slate-700 dark:text-slate-300">
            <tr>
              <th scope="col" className="px-5 py-3 text-left font-bold uppercase tracking-wider text-xs">Propriedade</th>
              <th scope="col" className="px-5 py-3 text-left font-bold uppercase tracking-wider text-xs">Valor</th>
            </tr>
          </thead>
          <tbody id="info-table-body" className="bg-white dark:bg-slate-900 divide-y divide-slate-100 dark:divide-slate-800/60">
            {processedData.isSingle ? (
              <>
                {/* 1. Coordenadas do Centroide */}
                {processedData.center && (
                  <tr className="bg-slate-50/70 dark:bg-slate-800/50">
                    <td className="px-5 py-3 font-bold text-red-700 dark:text-red-400 max-w-[240px]">
                      Coordenadas (Centro Territorial)
                      <p className="text-[10px] font-normal text-slate-500 dark:text-slate-400 mt-0.5 leading-tight">
                        *Centro geográfico (centroide) do polígono territorial.
                      </p>
                    </td>
                    <td className="px-5 py-3 text-slate-900 dark:text-slate-200">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-800/60 px-2.5 py-1 rounded-md text-xs text-red-800 dark:text-red-300 font-bold">
                          {processedData.center.lat.toFixed(6)}, {processedData.center.lng.toFixed(6)}
                        </span>
                        <div className="flex gap-1">
                          <button 
                            onClick={() => handleCopy(processedData.center!.lat.toFixed(6), 'Latitude')}
                            className="px-2 py-1 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs rounded text-slate-700 dark:text-slate-300 font-semibold cursor-pointer transition-colors" 
                            title="Copiar Latitude"
                          >
                            Lat
                          </button>
                          <button 
                            onClick={() => handleCopy(processedData.center!.lng.toFixed(6), 'Longitude')}
                            className="px-2 py-1 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs rounded text-slate-700 dark:text-slate-300 font-semibold cursor-pointer transition-colors" 
                            title="Copiar Longitude"
                          >
                            Long
                          </button>
                          <button 
                            onClick={() => handleCopy(`${processedData.center!.lat.toFixed(6)}, ${processedData.center!.lng.toFixed(6)}`, 'Coordenada completa')}
                            className="px-2.5 py-1 bg-red-100 dark:bg-red-950/80 hover:bg-red-200 dark:hover:bg-red-900/60 text-xs rounded text-red-700 dark:text-red-300 font-bold flex items-center gap-1 cursor-pointer transition-colors" 
                            title="Copiar Coordenadas Completas"
                          >
                            <Copy className="h-3 w-3" />
                            Copiar
                          </button>
                        </div>
                      </div>
                    </td>
                  </tr>
                )}

                {/* 2. Propriedades GeoJSON */}
                {processedData.filteredProps?.map((prop) => (
                  <tr 
                    key={`prop-${prop.key}`} 
                    className={`hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors ${
                      prop.isHighlighted ? 'bg-red-50/60 dark:bg-red-950/20' : ''
                    }`}
                  >
                    <td className={`px-5 py-2.5 ${prop.isHighlighted ? 'font-bold text-red-900 dark:text-red-300' : 'font-semibold text-slate-800 dark:text-slate-200'}`}>
                      {prop.label}
                    </td>
                    <td className={`px-5 py-2.5 ${prop.isHighlighted ? 'font-bold text-red-900 dark:text-red-300' : 'text-slate-700 dark:text-slate-300'}`}>
                      {prop.value}
                    </td>
                  </tr>
                ))}

                {/* 3. Métricas Demográficas da Feição Única */}
                {processedData.feat && !['Coordenadas', 'Coordenada', 'Coordenadas IBGE', 'Localidades (Piauí)', 'Comunidades Rurais de Teresina'].includes(processedData.feat.sourceName) && (
                  <>
                    <tr className="hover:bg-slate-50 dark:hover:bg-slate-800/40 border-t border-slate-100 dark:border-slate-800">
                      <td className="px-5 py-2.5 font-semibold text-slate-800 dark:text-slate-200">Total de Domicílios Vagos</td>
                      <td className="px-5 py-2.5 text-slate-700 dark:text-slate-300 font-medium">{processedData.domVagos?.toLocaleString('pt-BR')}</td>
                    </tr>
                    <tr className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                      <td className="px-5 py-2.5 font-semibold text-slate-800 dark:text-slate-200">Taxa de Vacância</td>
                      <td className="px-5 py-2.5 text-slate-700 dark:text-slate-300 font-medium">{processedData.taxaVac}%</td>
                    </tr>
                    <tr className="hover:bg-slate-50 dark:hover:bg-slate-800/40 bg-red-50/40 dark:bg-red-950/20">
                      <td className="px-5 py-2.5 font-bold text-red-900 dark:text-red-300">Média de Moradores por Domicílio (Densidade)</td>
                      <td className="px-5 py-2.5 font-black text-red-900 dark:text-red-300">{processedData.densidade}</td>
                    </tr>
                  </>
                )}
              </>
            ) : (
              // EXIBIÇÃO DE MÚLTIPLOS ITENS (CONSOLIDADO)
              <>
                <tr className="bg-red-50 dark:bg-red-950/40">
                  <td className="px-5 py-3 font-extrabold text-red-900 dark:text-red-200">Total Consolidado</td>
                  <td className="px-5 py-3 font-extrabold text-red-900 dark:text-red-200">{count} áreas territoriais selecionadas</td>
                </tr>
                {processedData.metrics?.map((m, idx) => (
                  <tr key={`metric-${idx}`} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="px-5 py-2.5 font-semibold text-slate-800 dark:text-slate-200">{m.label}</td>
                    <td className="px-5 py-2.5 text-slate-700 dark:text-slate-300 font-bold">{m.val}</td>
                  </tr>
                ))}
              </>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
