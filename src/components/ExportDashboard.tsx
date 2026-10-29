import React, { useState, useCallback, useMemo } from 'react';
import { 
  Download, 
  FileSpreadsheet, 
  Globe, 
  FileCode, 
  CheckCircle2, 
  Info, 
  ChevronLeft,
  ArrowRight,
  Layers,
  Check,
  Loader2,
  Filter
} from 'lucide-react';
import { SelectedFeature } from '../types';
import { dataSources } from '../data';
import { 
  getIdentifier, 
  exportSelectionToCSV, 
  exportSelectionToKML, 
  sanitizeFilename 
} from '../utils';
import { logActivity } from '../services/adminService';

interface ExportDashboardProps {
  selectedFeatures: SelectedFeature[];
  showToast: (msg: string) => void;
  onBackToDetails?: () => void;
  onClose?: () => void;
}

// Cache em memória para os arquivos GeoJSON completos das camadas
const layerGeoJsonCache: Record<string, any> = {};

export const ExportDashboard: React.FC<ExportDashboardProps> = ({
  selectedFeatures,
  showToast,
  onBackToDetails,
}) => {
  const count = selectedFeatures?.length || 0;

  // Modo: 'filtered' (feições selecionadas) ou 'full_layer' (camada completa)
  const [exportMode, setExportMode] = useState<'filtered' | 'full_layer'>(
    count > 0 ? 'filtered' : 'full_layer'
  );

  // Camada selecionada para exportação completa
  const [selectedLayerName, setSelectedLayerName] = useState<string>(
    dataSources[0]?.name || 'Municipios'
  );

  // Estado de carregamento ao baixar camada completa
  const [isDownloading, setIsDownloading] = useState<boolean>(false);
  const [downloadFormat, setDownloadFormat] = useState<string | null>(null);

  // Lista de camadas disponíveis para download completo
  const availableLayers = useMemo(() => {
    return dataSources.map(ds => ({
      name: ds.name,
      url: ds.url,
      friendlyName: ds.name === 'Municipios' ? 'Municípios (Piauí)' :
                    ds.name === 'Bairros' ? 'Bairros (Teresina)' :
                    ds.name === 'Favelas e Comunidades' ? 'Favelas e Comunidades Urbanas' :
                    ds.name
    }));
  }, []);

  const currentLayer = useMemo(() => {
    return availableLayers.find(l => l.name === selectedLayerName) || availableLayers[0];
  }, [availableLayers, selectedLayerName]);

  // ==============================================================
  // FUNÇÕES DE EXPORTAÇÃO FILTRADA (FEIÇÕES SELECIONADAS)
  // ==============================================================
  const handleExportFilteredCSV = useCallback(() => {
    if (count === 0) return;
    const id = getIdentifier(selectedFeatures[0].properties) || 'selecao';
    const rawFeatures = selectedFeatures.map(f => f.layer);
    exportSelectionToCSV(`selecao_${sanitizeFilename(String(id))}.csv`, rawFeatures);
    logActivity('EXPORTACAO', `Exportou ${count} feição(ões) filtrada(s) para CSV`, 'user', `Identificador: ${id}`);
    showToast(`Exportando ${count} feição(ões) em planilha CSV compatível com Excel...`);
  }, [selectedFeatures, count, showToast]);

  const handleExportFilteredKML = useCallback(() => {
    if (count === 0) return;
    const id = getIdentifier(selectedFeatures[0].properties) || 'selecao';
    const rawFeatures = selectedFeatures.map(f => f.layer);
    exportSelectionToKML(`selecao_${sanitizeFilename(String(id))}.kml`, rawFeatures);
    logActivity('EXPORTACAO', `Exportou ${count} feição(ões) filtrada(s) para KML`, 'user', `Identificador: ${id}`);
    showToast(`Exportando ${count} feição(ões) em arquivo KML para Google Earth e QGIS...`);
  }, [selectedFeatures, count, showToast]);

  const handleExportFilteredGeoJSON = useCallback(() => {
    if (count === 0) return;
    const id = getIdentifier(selectedFeatures[0].properties) || 'selecao';
    const featureCollection = {
      type: "FeatureCollection",
      features: selectedFeatures.map(f => {
        if (f.layer && typeof (f.layer as any).toGeoJSON === 'function') {
          return (f.layer as any).toGeoJSON();
        }
        return {
          type: "Feature",
          properties: f.properties || {},
          geometry: (f.layer as any)?.feature?.geometry || null
        };
      })
    };

    const jsonStr = JSON.stringify(featureCollection, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/geo+json;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `selecao_${sanitizeFilename(String(id))}.geojson`;
    link.click();
    URL.revokeObjectURL(link.href);

    logActivity('EXPORTACAO', `Exportou ${count} feição(ões) filtrada(s) para GeoJSON`, 'user', `Identificador: ${id}`);
    showToast(`Exportando ${count} feição(ões) em formato GeoJSON vetorial...`);
  }, [selectedFeatures, count, showToast]);

  // ==============================================================
  // FUNÇÕES DE EXPORTAÇÃO DA CAMADA COMPLETA
  // ==============================================================
  const fetchLayerData = async (url: string) => {
    if (layerGeoJsonCache[url]) {
      return layerGeoJsonCache[url];
    }
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error('Falha ao baixar dados da camada');
    }
    const data = await response.json();
    layerGeoJsonCache[url] = data;
    return data;
  };

  const handleExportFullLayer = useCallback(async (format: 'geojson' | 'csv' | 'kml') => {
    if (!currentLayer) return;
    setIsDownloading(true);
    setDownloadFormat(format);

    try {
      showToast(`Preparando download da camada "${currentLayer.friendlyName}" (${format.toUpperCase()})...`);
      const geojson = await fetchLayerData(currentLayer.url);
      const safeFilename = sanitizeFilename(currentLayer.friendlyName || currentLayer.name);

      if (format === 'geojson') {
        const jsonStr = JSON.stringify(geojson, null, 2);
        const blob = new Blob([jsonStr], { type: 'application/geo+json;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `Camada_${safeFilename}.geojson`;
        link.click();
        URL.revokeObjectURL(link.href);
      } else if (format === 'csv') {
        const features = (geojson.features || []).map((f: any) => ({ feature: f }));
        exportSelectionToCSV(`Camada_${safeFilename}.csv`, features);
      } else if (format === 'kml') {
        const features = (geojson.features || []).map((f: any) => ({ feature: f }));
        exportSelectionToKML(`Camada_${safeFilename}.kml`, features);
      }

      logActivity('EXPORTACAO', `Exportou camada completa "${currentLayer.name}" no formato ${format.toUpperCase()}`, 'user');
      showToast(`Camada "${currentLayer.friendlyName}" exportada com sucesso!`);
    } catch (err) {
      console.error(err);
      showToast(`Erro ao exportar a camada "${currentLayer.friendlyName}". Tente novamente.`);
    } finally {
      setIsDownloading(false);
      setDownloadFormat(null);
    }
  }, [currentLayer, showToast]);

  // Nomes de camadas únicas se houver seleção
  const selectedLayerNames = Array.from(new Set(selectedFeatures.map(f => f.sourceName).filter(Boolean)));
  const primaryFeatureName = selectedFeatures[0]?.name || selectedFeatures[0]?.properties?.Nome || selectedFeatures[0]?.properties?.NM_MUN || 'Feição Selecionada';

  return (
    <div className="space-y-3.5 pb-6 animate-fadeIn">
      {/* Botão de retorno rápido para Detalhes se tiver origem na feição */}
      {onBackToDetails && count > 0 && (
        <button
          type="button"
          onClick={onBackToDetails}
          className="inline-flex items-center gap-1.5 text-xs font-bold text-[#007AFF] hover:underline cursor-pointer group mb-0.5"
        >
          <ChevronLeft className="w-4 h-4 transition-transform group-hover:-translate-x-0.5" />
          <span>Voltar aos detalhes</span>
        </button>
      )}

      {/* Se houver feição selecionada, permite alternar entre Filtro Selecionado e Camada Completa */}
      {count > 0 && (
        <div className="flex items-center p-1 bg-black/5 dark:bg-white/10 rounded-2xl gap-1">
          <button
            type="button"
            onClick={() => setExportMode('filtered')}
            className={`flex-1 py-1.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              exportMode === 'filtered'
                ? 'bg-white dark:bg-[#2c2c2e] text-[#007AFF] shadow-xs'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Filter className="w-3.5 h-3.5" />
            <span>Seleção Filtrada ({count})</span>
          </button>

          <button
            type="button"
            onClick={() => setExportMode('full_layer')}
            className={`flex-1 py-1.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              exportMode === 'full_layer'
                ? 'bg-white dark:bg-[#2c2c2e] text-[#AF52DE] shadow-xs'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Camada Completa</span>
          </button>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODO 1: EXPORTAÇÃO FILTRADA (QUANDO HÁ SELEÇÃO ATIVA) */}
      {/* ============================================================== */}
      {exportMode === 'filtered' && count > 0 && (
        <>
          {/* Card Resumo da Seleção Filtrada */}
          <div className="p-4 rounded-3xl bg-gradient-to-br from-[#AF52DE]/15 via-[#007AFF]/5 to-transparent border border-[#AF52DE]/20 shadow-xs space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-[#AF52DE] to-[#BF5AF2] text-white flex items-center justify-center shadow-md shadow-purple-500/25 shrink-0">
                  <Download className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <h3 className="font-black text-sm text-slate-900 dark:text-white truncate">
                    Exportação Filtrada
                  </h3>
                  <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 truncate">
                    {primaryFeatureName}
                  </p>
                </div>
              </div>

              <span className="bg-[#AF52DE]/15 text-[#AF52DE] dark:text-[#D17BFF] border border-[#AF52DE]/25 font-black px-2.5 py-1 rounded-full text-[11px] shrink-0 flex items-center gap-1 shadow-2xs">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>{count} {count === 1 ? 'item' : 'itens'}</span>
              </span>
            </div>

            {selectedLayerNames.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-black/5 dark:border-white/10">
                <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                  Camadas:
                </span>
                {selectedLayerNames.map(layer => (
                  <span 
                    key={layer} 
                    className="bg-white/80 dark:bg-white/10 text-slate-700 dark:text-slate-200 text-[10px] font-bold px-2 py-0.5 rounded-lg border border-black/5 dark:border-white/10 truncate max-w-[160px]"
                    title={layer}
                  >
                    {layer}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Título da Seção */}
          <div className="px-1 pt-1">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500">
              Formatos de Download Filtrado
            </span>
          </div>

          {/* Grade Vertical de Formatos de Exportação Filtrada */}
          <div className="space-y-2.5">
            {/* Opção 1: Planilha Excel CSV */}
            <button
              type="button"
              onClick={handleExportFilteredCSV}
              className="w-full p-3.5 bg-black/[0.02] dark:bg-white/[0.04] hover:bg-emerald-500/[0.08] dark:hover:bg-emerald-500/[0.12] border border-black/5 dark:border-white/10 hover:border-emerald-500/30 rounded-2xl transition-all text-left flex items-start gap-3 group cursor-pointer active:scale-[0.98] shadow-xs hover:shadow-md"
            >
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-emerald-500 to-green-600 text-white flex items-center justify-center shadow-md shadow-emerald-500/20 shrink-0 group-hover:scale-105 transition-transform">
                <FileSpreadsheet className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-1 mb-1">
                  <h4 className="text-xs font-black text-slate-900 dark:text-slate-100 group-hover:text-emerald-700 dark:group-hover:text-emerald-400 transition-colors">
                    Planilha Excel (CSV)
                  </h4>
                  <span className="text-[9px] font-black bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 px-2 py-0.5 rounded-full uppercase tracking-wider shrink-0">
                    .CSV
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug font-medium">
                  Tabela formatada com UTF-8 BOM para abrir sem erros de acentuação no Excel, LibreOffice e Sheets.
                </p>
                <div className="flex items-center gap-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400 pt-1.5 opacity-90 group-hover:opacity-100">
                  <span>Baixar arquivo CSV filtrado</span>
                  <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-1" />
                </div>
              </div>
            </button>

            {/* Opção 2: Google Earth / QGIS (KML) */}
            <button
              type="button"
              onClick={handleExportFilteredKML}
              className="w-full p-3.5 bg-black/[0.02] dark:bg-white/[0.04] hover:bg-orange-500/[0.08] dark:hover:bg-orange-500/[0.12] border border-black/5 dark:border-white/10 hover:border-orange-500/30 rounded-2xl transition-all text-left flex items-start gap-3 group cursor-pointer active:scale-[0.98] shadow-xs hover:shadow-md"
            >
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-amber-500 to-red-500 text-white flex items-center justify-center shadow-md shadow-red-500/20 shrink-0 group-hover:scale-105 transition-transform">
                <Globe className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-1 mb-1">
                  <h4 className="text-xs font-black text-slate-900 dark:text-slate-100 group-hover:text-orange-700 dark:group-hover:text-orange-400 transition-colors">
                    Google Earth (KML)
                  </h4>
                  <span className="text-[9px] font-black bg-orange-500/15 text-orange-700 dark:text-orange-300 px-2 py-0.5 rounded-full uppercase tracking-wider shrink-0">
                    .KML
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug font-medium">
                  Geometrias completas dos polígonos e pontos com visualização tridimensional no Google Earth e QGIS.
                </p>
                <div className="flex items-center gap-1 text-[11px] font-bold text-orange-600 dark:text-orange-400 pt-1.5 opacity-90 group-hover:opacity-100">
                  <span>Baixar arquivo KML filtrado</span>
                  <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-1" />
                </div>
              </div>
            </button>

            {/* Opção 3: GeoJSON Vetorial */}
            <button
              type="button"
              onClick={handleExportFilteredGeoJSON}
              className="w-full p-3.5 bg-black/[0.02] dark:bg-white/[0.04] hover:bg-blue-500/[0.08] dark:hover:bg-blue-500/[0.12] border border-black/5 dark:border-white/10 hover:border-blue-500/30 rounded-2xl transition-all text-left flex items-start gap-3 group cursor-pointer active:scale-[0.98] shadow-xs hover:shadow-md"
            >
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-[#007AFF] to-[#5856D6] text-white flex items-center justify-center shadow-md shadow-blue-500/20 shrink-0 group-hover:scale-105 transition-transform">
                <FileCode className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-1 mb-1">
                  <h4 className="text-xs font-black text-slate-900 dark:text-slate-100 group-hover:text-blue-700 dark:group-hover:text-blue-400 transition-colors">
                    GeoJSON Vetorial
                  </h4>
                  <span className="text-[9px] font-black bg-blue-500/15 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded-full uppercase tracking-wider shrink-0">
                    .GEOJSON
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug font-medium">
                  Formato aberto padrão web com estrutura vetorial pura para ArcGIS, QGIS, Leaflet e Mapbox.
                </p>
                <div className="flex items-center gap-1 text-[11px] font-bold text-blue-600 dark:text-blue-400 pt-1.5 opacity-90 group-hover:opacity-100">
                  <span>Baixar arquivo GeoJSON filtrado</span>
                  <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-1" />
                </div>
              </div>
            </button>
          </div>
        </>
      )}

      {/* ============================================================== */}
      {/* MODO 2: EXPORTAÇÃO DE CAMADA COMPLETA (SEM SELEÇÃO OU ESCOLHIDA) */}
      {/* ============================================================== */}
      {(exportMode === 'full_layer' || count === 0) && (
        <>
          {/* Card Apresentação da Camada Completa */}
          <div className="p-4 rounded-3xl bg-gradient-to-br from-[#007AFF]/15 via-[#5856D6]/5 to-transparent border border-[#007AFF]/20 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-[#007AFF] to-[#5856D6] text-white flex items-center justify-center shadow-md shadow-blue-500/25 shrink-0">
                  <Layers className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <h3 className="font-black text-sm text-slate-900 dark:text-white truncate">
                    Exportar Camada Completa
                  </h3>
                  <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 truncate">
                    Base territorial integral
                  </p>
                </div>
              </div>

              <span className="bg-[#007AFF]/15 text-[#007AFF] dark:text-[#64D2FF] border border-[#007AFF]/25 font-black px-2.5 py-1 rounded-full text-[10px] uppercase tracking-wider shrink-0 shadow-2xs">
                Base Inteira
              </span>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed font-medium">
              Escolha uma camada abaixo para fazer o download completo de todos os seus elementos e atributos territoriais.
            </p>

            {/* Seletor de Camada Estilo Apple */}
            <div className="space-y-1.5 pt-1">
              <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Selecione a Camada:
              </label>
              <div className="relative">
                <select
                  value={selectedLayerName}
                  onChange={(e) => setSelectedLayerName(e.target.value)}
                  className="w-full bg-white dark:bg-[#2c2c2e] border border-black/10 dark:border-white/10 rounded-2xl px-3.5 py-2.5 text-xs font-bold text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-[#007AFF] transition-all cursor-pointer shadow-xs"
                >
                  {availableLayers.map((layer) => (
                    <option key={layer.name} value={layer.name}>
                      {layer.friendlyName}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Título da Seção */}
          <div className="px-1 pt-1 flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500">
              Formatos de Download da Camada
            </span>
            <span className="text-[10px] font-bold text-[#007AFF]">
              {currentLayer.friendlyName}
            </span>
          </div>

          {/* Grade Vertical de Formatos da Camada Completa */}
          <div className="space-y-2.5">
            {/* 1. GeoJSON Vetorial Completo */}
            <button
              type="button"
              disabled={isDownloading}
              onClick={() => handleExportFullLayer('geojson')}
              className="w-full p-3.5 bg-black/[0.02] dark:bg-white/[0.04] hover:bg-blue-500/[0.08] dark:hover:bg-blue-500/[0.12] border border-black/5 dark:border-white/10 hover:border-blue-500/30 rounded-2xl transition-all text-left flex items-start gap-3 group cursor-pointer active:scale-[0.98] shadow-xs hover:shadow-md disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-[#007AFF] to-[#5856D6] text-white flex items-center justify-center shadow-md shadow-blue-500/20 shrink-0 group-hover:scale-105 transition-transform">
                {isDownloading && downloadFormat === 'geojson' ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <FileCode className="w-5 h-5" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-1 mb-1">
                  <h4 className="text-xs font-black text-slate-900 dark:text-slate-100 group-hover:text-blue-700 dark:group-hover:text-blue-400 transition-colors">
                    GeoJSON Vetorial Completo
                  </h4>
                  <span className="text-[9px] font-black bg-blue-500/15 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded-full uppercase tracking-wider shrink-0">
                    .GEOJSON
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug font-medium">
                  Arquivo vetorial integral com todas as coordenadas, limites e propriedades de cada elemento da camada.
                </p>
                <div className="flex items-center gap-1 text-[11px] font-bold text-[#007AFF] dark:text-[#64D2FF] pt-1.5 opacity-90 group-hover:opacity-100">
                  <span>{isDownloading && downloadFormat === 'geojson' ? 'Processando download...' : 'Baixar Camada Completa (GeoJSON)'}</span>
                  <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-1" />
                </div>
              </div>
            </button>

            {/* 2. Planilha Excel CSV Completa */}
            <button
              type="button"
              disabled={isDownloading}
              onClick={() => handleExportFullLayer('csv')}
              className="w-full p-3.5 bg-black/[0.02] dark:bg-white/[0.04] hover:bg-emerald-500/[0.08] dark:hover:bg-emerald-500/[0.12] border border-black/5 dark:border-white/10 hover:border-emerald-500/30 rounded-2xl transition-all text-left flex items-start gap-3 group cursor-pointer active:scale-[0.98] shadow-xs hover:shadow-md disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-emerald-500 to-green-600 text-white flex items-center justify-center shadow-md shadow-emerald-500/20 shrink-0 group-hover:scale-105 transition-transform">
                {isDownloading && downloadFormat === 'csv' ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <FileSpreadsheet className="w-5 h-5" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-1 mb-1">
                  <h4 className="text-xs font-black text-slate-900 dark:text-slate-100 group-hover:text-emerald-700 dark:group-hover:text-emerald-400 transition-colors">
                    Planilha Excel Completa (CSV)
                  </h4>
                  <span className="text-[9px] font-black bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 px-2 py-0.5 rounded-full uppercase tracking-wider shrink-0">
                    .CSV
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug font-medium">
                  Tabela completa de atributos com UTF-8 BOM para abrir perfeitamente no Excel, LibreOffice e Sheets.
                </p>
                <div className="flex items-center gap-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400 pt-1.5 opacity-90 group-hover:opacity-100">
                  <span>{isDownloading && downloadFormat === 'csv' ? 'Processando download...' : 'Baixar Tabela Completa (CSV)'}</span>
                  <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-1" />
                </div>
              </div>
            </button>

            {/* 3. Google Earth KML Completo */}
            <button
              type="button"
              disabled={isDownloading}
              onClick={() => handleExportFullLayer('kml')}
              className="w-full p-3.5 bg-black/[0.02] dark:bg-white/[0.04] hover:bg-orange-500/[0.08] dark:hover:bg-orange-500/[0.12] border border-black/5 dark:border-white/10 hover:border-orange-500/30 rounded-2xl transition-all text-left flex items-start gap-3 group cursor-pointer active:scale-[0.98] shadow-xs hover:shadow-md disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-amber-500 to-red-500 text-white flex items-center justify-center shadow-md shadow-red-500/20 shrink-0 group-hover:scale-105 transition-transform">
                {isDownloading && downloadFormat === 'kml' ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Globe className="w-5 h-5" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-1 mb-1">
                  <h4 className="text-xs font-black text-slate-900 dark:text-slate-100 group-hover:text-orange-700 dark:group-hover:text-orange-400 transition-colors">
                    Google Earth Completo (KML)
                  </h4>
                  <span className="text-[9px] font-black bg-orange-500/15 text-orange-700 dark:text-orange-300 px-2 py-0.5 rounded-full uppercase tracking-wider shrink-0">
                    .KML
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug font-medium">
                  Todos os polígonos e limites com visualização tridimensional no Google Earth Pro e projetos QGIS.
                </p>
                <div className="flex items-center gap-1 text-[11px] font-bold text-orange-600 dark:text-orange-400 pt-1.5 opacity-90 group-hover:opacity-100">
                  <span>{isDownloading && downloadFormat === 'kml' ? 'Processando download...' : 'Baixar KML Completo'}</span>
                  <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-1" />
                </div>
              </div>
            </button>
          </div>

          {/* Dica de Filtro */}
          <div className="p-3 rounded-2xl bg-black/[0.02] dark:bg-white/[0.04] border border-black/5 dark:border-white/10 flex items-start gap-2.5 text-[11px] text-slate-500 dark:text-slate-400 font-medium leading-relaxed">
            <Info className="w-4 h-4 text-[#007AFF] shrink-0 mt-0.5" />
            <div>
              <strong className="text-slate-700 dark:text-slate-200">Como exportar apenas uma feição filtrada?</strong>
              <p className="mt-0.5">
                Clique diretamente em qualquer elemento no mapa (como um bairro ou município). Esta tela passará automaticamente para o <strong>modo filtrado</strong>, baixando apenas a feição selecionada.
              </p>
            </div>
          </div>
        </>
      )}

      {/* Nota Informativa Apple Glass */}
      <div className="p-3 rounded-2xl bg-black/[0.02] dark:bg-white/[0.04] border border-black/5 dark:border-white/10 flex items-start gap-2 text-[11px] text-slate-500 dark:text-slate-400 font-medium leading-relaxed">
        <Info className="w-4 h-4 text-[#AF52DE] shrink-0 mt-0.5" />
        <span>
          Os dados exportados contêm todas as coordenadas geométricas e colunas analíticas autorizadas para o seu perfil de usuário.
        </span>
      </div>
    </div>
  );
};
