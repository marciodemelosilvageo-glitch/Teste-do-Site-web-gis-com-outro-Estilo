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
import { exportSelectedFeatures, ExportPreferences, ExportFormat } from '../exportActions';

interface ExportDashboardProps {
  selectedFeatures: SelectedFeature[];
  showToast: (msg: string) => void;
  onBackToDetails?: () => void;
  onClose?: () => void;
  preferences?: ExportPreferences;
  onUpdatePreferences?: (prefs: Partial<ExportPreferences>) => void;
}

// Cache em memória para os arquivos GeoJSON completos das camadas
const layerGeoJsonCache: Record<string, any> = {};

export const ExportDashboard: React.FC<ExportDashboardProps> = ({
  selectedFeatures,
  showToast,
  onBackToDetails,
  preferences,
  onUpdatePreferences
}) => {
  const count = selectedFeatures?.length || 0;
  const currentFormat: ExportFormat = preferences?.format || 'csv';

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
    const res = exportSelectedFeatures('csv', selectedFeatures, 'user');
    if (res.ok) {
      showToast(`Exportando ${res.count} feição(ões) em planilha CSV compatível com Excel...`);
    } else if (res.error) {
      showToast(res.error);
    }
  }, [selectedFeatures, showToast]);

  const handleExportFilteredKML = useCallback(() => {
    const res = exportSelectedFeatures('kml', selectedFeatures, 'user');
    if (res.ok) {
      showToast(`Exportando ${res.count} feição(ões) em arquivo KML para Google Earth e QGIS...`);
    } else if (res.error) {
      showToast(res.error);
    }
  }, [selectedFeatures, showToast]);

  const handleExportFilteredGeoJSON = useCallback(() => {
    const res = exportSelectedFeatures('geojson', selectedFeatures, 'user');
    if (res.ok) {
      showToast(`Exportando ${res.count} feição(ões) em formato GeoJSON vetorial...`);
    } else if (res.error) {
      showToast(res.error);
    }
  }, [selectedFeatures, showToast]);

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

      {/* Seção Download Rápido (configuração de preferência do usuário) */}
      <div className="p-3.5 rounded-2xl bg-black/[0.02] dark:bg-white/[0.03] border border-black/10 dark:border-white/10 shadow-xs space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
              preferences?.quickDownload
                ? 'bg-blue-500/10 text-[#007AFF] dark:bg-blue-400/20 dark:text-[#64D2FF]'
                : 'bg-slate-100 dark:bg-white/10 text-slate-500 dark:text-slate-400'
            }`}>
              <Download className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h4 className="font-bold text-xs text-slate-900 dark:text-white truncate">
                Download Rápido
              </h4>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                {preferences?.quickDownload
                  ? `Baixa ${currentFormat.toUpperCase()} direto ao tocar em Exportar nos detalhes`
                  : 'Ao tocar em Exportar nos detalhes, abre esta aba'}
              </p>
            </div>
          </div>

          {/* Interruptor Liga/Desliga */}
          <button
            type="button"
            role="switch"
            aria-checked={Boolean(preferences?.quickDownload)}
            aria-label="Ativar ou desativar download rápido"
            onClick={() => {
              const currentQuick = Boolean(preferences?.quickDownload);
              onUpdatePreferences?.({
                quickDownload: !currentQuick,
                format: preferences?.format || 'csv'
              });
            }}
            className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors cursor-pointer shrink-0 ${
              preferences?.quickDownload
                ? 'bg-[#007AFF]'
                : 'bg-black/15 dark:bg-white/20'
            }`}
          >
            <div
              className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                preferences?.quickDownload ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>

        {/* Seletor Segmentado de Formato Padrão (quando ligado) */}
        {preferences?.quickDownload && (
          <div className="pt-2 border-t border-black/5 dark:border-white/5 space-y-1.5 animate-fadeIn">
            <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">
              Formato Padrão para Download Rápido
            </span>
            <div className="grid grid-cols-3 gap-1.5 p-1 bg-black/5 dark:bg-white/10 rounded-xl">
              {(['csv', 'kml', 'geojson'] as const).map(fmt => {
                const isSelected = currentFormat === fmt;
                return (
                  <button
                    key={fmt}
                    type="button"
                    onClick={() => onUpdatePreferences?.({ format: fmt })}
                    className={`py-1.5 px-2 rounded-lg text-xs font-bold transition-all uppercase cursor-pointer text-center ${
                      isSelected
                        ? 'bg-white dark:bg-[#2c2c2e] text-slate-900 dark:text-white shadow-xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    {fmt}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Se houver feição selecionada, permite alternar entre Filtro Selecionado e Camada Completa */}
      {count > 0 && (
        <div className="flex items-center p-1 bg-black/5 dark:bg-white/10 rounded-2xl gap-1">
          <button
            type="button"
            onClick={() => setExportMode('filtered')}
            className={`flex-1 py-1.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              exportMode === 'filtered'
                ? 'bg-white dark:bg-[#2c2c2e] text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
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
                ? 'bg-white dark:bg-[#2c2c2e] text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
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
          <div className="p-3.5 rounded-2xl bg-black/[0.02] dark:bg-white/[0.03] border border-black/10 dark:border-white/10 shadow-xs space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-white/10 text-slate-700 dark:text-slate-200 flex items-center justify-center shrink-0">
                  <Download className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <h3 className="font-bold text-sm text-slate-900 dark:text-white truncate">
                    Exportação Filtrada
                  </h3>
                  <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 truncate">
                    {primaryFeatureName}
                  </p>
                </div>
              </div>

              <span className="bg-black/5 dark:bg-white/10 text-slate-700 dark:text-slate-300 border border-black/10 dark:border-white/10 font-bold px-2.5 py-1 rounded-full text-[11px] shrink-0 flex items-center gap-1">
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
                    className="bg-white dark:bg-[#2c2c2e] text-slate-700 dark:text-slate-200 text-[10px] font-bold px-2 py-0.5 rounded-lg border border-black/10 dark:border-white/10 truncate max-w-[160px]"
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
          <div className="space-y-2">
            {/* Opção 1: Planilha Excel CSV */}
            <button
              type="button"
              onClick={handleExportFilteredCSV}
              className="w-full p-3 bg-white dark:bg-[#2c2c2e] hover:bg-slate-50 dark:hover:bg-[#343438] border border-black/10 dark:border-white/10 rounded-2xl transition-all text-left flex items-start gap-3 group cursor-pointer active:scale-[0.98] shadow-xs"
            >
              <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-white/10 text-slate-700 dark:text-slate-200 flex items-center justify-center shrink-0">
                <FileSpreadsheet className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-1 mb-1">
                  <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100">
                    Planilha Excel (CSV)
                  </h4>
                  <span className="text-[9px] font-bold bg-black/5 dark:bg-white/10 text-slate-600 dark:text-slate-400 px-2 py-0.5 rounded-md uppercase tracking-wider shrink-0">
                    .CSV
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug font-medium">
                  Tabela formatada com UTF-8 BOM para abrir sem erros de acentuação no Excel, LibreOffice e Sheets.
                </p>
                <div className="flex items-center gap-1 text-[11px] font-bold text-slate-700 dark:text-slate-300 pt-1.5 group-hover:text-[#007AFF] dark:group-hover:text-[#007AFF] transition-colors">
                  <span>Baixar arquivo CSV filtrado</span>
                  <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-1" />
                </div>
              </div>
            </button>

            {/* Opção 2: Google Earth / QGIS (KML) */}
            <button
              type="button"
              onClick={handleExportFilteredKML}
              className="w-full p-3 bg-white dark:bg-[#2c2c2e] hover:bg-slate-50 dark:hover:bg-[#343438] border border-black/10 dark:border-white/10 rounded-2xl transition-all text-left flex items-start gap-3 group cursor-pointer active:scale-[0.98] shadow-xs"
            >
              <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-white/10 text-slate-700 dark:text-slate-200 flex items-center justify-center shrink-0">
                <Globe className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-1 mb-1">
                  <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100">
                    Google Earth (KML)
                  </h4>
                  <span className="text-[9px] font-bold bg-black/5 dark:bg-white/10 text-slate-600 dark:text-slate-400 px-2 py-0.5 rounded-md uppercase tracking-wider shrink-0">
                    .KML
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug font-medium">
                  Geometrias completas dos polígonos e pontos com visualização tridimensional no Google Earth e QGIS.
                </p>
                <div className="flex items-center gap-1 text-[11px] font-bold text-slate-700 dark:text-slate-300 pt-1.5 group-hover:text-[#007AFF] dark:group-hover:text-[#007AFF] transition-colors">
                  <span>Baixar arquivo KML filtrado</span>
                  <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-1" />
                </div>
              </div>
            </button>

            {/* Opção 3: GeoJSON Vetorial */}
            <button
              type="button"
              onClick={handleExportFilteredGeoJSON}
              className="w-full p-3 bg-white dark:bg-[#2c2c2e] hover:bg-slate-50 dark:hover:bg-[#343438] border border-black/10 dark:border-white/10 rounded-2xl transition-all text-left flex items-start gap-3 group cursor-pointer active:scale-[0.98] shadow-xs"
            >
              <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-white/10 text-slate-700 dark:text-slate-200 flex items-center justify-center shrink-0">
                <FileCode className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-1 mb-1">
                  <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100">
                    GeoJSON Vetorial
                  </h4>
                  <span className="text-[9px] font-bold bg-black/5 dark:bg-white/10 text-slate-600 dark:text-slate-400 px-2 py-0.5 rounded-md uppercase tracking-wider shrink-0">
                    .GEOJSON
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug font-medium">
                  Formato aberto padrão web com estrutura vetorial pura para ArcGIS, QGIS, Leaflet e Mapbox.
                </p>
                <div className="flex items-center gap-1 text-[11px] font-bold text-slate-700 dark:text-slate-300 pt-1.5 group-hover:text-[#007AFF] dark:group-hover:text-[#007AFF] transition-colors">
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
          <div className="p-3.5 rounded-2xl bg-black/[0.02] dark:bg-white/[0.03] border border-black/10 dark:border-white/10 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-white/10 text-slate-700 dark:text-slate-200 flex items-center justify-center shrink-0">
                  <Layers className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <h3 className="font-bold text-sm text-slate-900 dark:text-white truncate">
                    Exportar Camada Completa
                  </h3>
                  <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 truncate">
                    Base territorial integral
                  </p>
                </div>
              </div>

              <span className="bg-black/5 dark:bg-white/10 text-slate-700 dark:text-slate-300 border border-black/10 dark:border-white/10 font-bold px-2.5 py-1 rounded-full text-[10px] uppercase tracking-wider shrink-0">
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
                  className="w-full bg-white dark:bg-[#2c2c2e] border border-black/10 dark:border-white/10 rounded-2xl px-3.5 py-2.5 text-xs font-bold text-slate-800 dark:text-slate-100 outline-none focus:ring-1 focus:ring-slate-400 dark:focus:ring-slate-500 transition-all cursor-pointer shadow-xs"
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
            <span className="text-[10px] font-bold text-slate-600 dark:text-slate-400">
              {currentLayer.friendlyName}
            </span>
          </div>

          {/* Grade Vertical de Formatos da Camada Completa */}
          <div className="space-y-2">
            {/* 1. GeoJSON Vetorial Completo */}
            <button
              type="button"
              disabled={isDownloading}
              onClick={() => handleExportFullLayer('geojson')}
              className="w-full p-3 bg-white dark:bg-[#2c2c2e] hover:bg-slate-50 dark:hover:bg-[#343438] border border-black/10 dark:border-white/10 rounded-2xl transition-all text-left flex items-start gap-3 group cursor-pointer active:scale-[0.98] shadow-xs disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-white/10 text-slate-700 dark:text-slate-200 flex items-center justify-center shrink-0">
                {isDownloading && downloadFormat === 'geojson' ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <FileCode className="w-4 h-4" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-1 mb-1">
                  <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100">
                    GeoJSON Vetorial Completo
                  </h4>
                  <span className="text-[9px] font-bold bg-black/5 dark:bg-white/10 text-slate-600 dark:text-slate-400 px-2 py-0.5 rounded-md uppercase tracking-wider shrink-0">
                    .GEOJSON
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug font-medium">
                  Arquivo vetorial integral com todas as coordenadas, limites e propriedades de cada elemento da camada.
                </p>
                <div className="flex items-center gap-1 text-[11px] font-bold text-slate-700 dark:text-slate-300 pt-1.5 group-hover:text-[#007AFF] dark:group-hover:text-[#007AFF] transition-colors">
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
              className="w-full p-3 bg-white dark:bg-[#2c2c2e] hover:bg-slate-50 dark:hover:bg-[#343438] border border-black/10 dark:border-white/10 rounded-2xl transition-all text-left flex items-start gap-3 group cursor-pointer active:scale-[0.98] shadow-xs disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-white/10 text-slate-700 dark:text-slate-200 flex items-center justify-center shrink-0">
                {isDownloading && downloadFormat === 'csv' ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <FileSpreadsheet className="w-4 h-4" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-1 mb-1">
                  <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100">
                    Planilha Excel Completa (CSV)
                  </h4>
                  <span className="text-[9px] font-bold bg-black/5 dark:bg-white/10 text-slate-600 dark:text-slate-400 px-2 py-0.5 rounded-md uppercase tracking-wider shrink-0">
                    .CSV
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug font-medium">
                  Tabela completa de atributos com UTF-8 BOM para abrir perfeitamente no Excel, LibreOffice e Sheets.
                </p>
                <div className="flex items-center gap-1 text-[11px] font-bold text-slate-700 dark:text-slate-300 pt-1.5 group-hover:text-[#007AFF] dark:group-hover:text-[#007AFF] transition-colors">
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
              className="w-full p-3 bg-white dark:bg-[#2c2c2e] hover:bg-slate-50 dark:hover:bg-[#343438] border border-black/10 dark:border-white/10 rounded-2xl transition-all text-left flex items-start gap-3 group cursor-pointer active:scale-[0.98] shadow-xs disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-white/10 text-slate-700 dark:text-slate-200 flex items-center justify-center shrink-0">
                {isDownloading && downloadFormat === 'kml' ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Globe className="w-4 h-4" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-1 mb-1">
                  <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100">
                    Google Earth Completo (KML)
                  </h4>
                  <span className="text-[9px] font-bold bg-black/5 dark:bg-white/10 text-slate-600 dark:text-slate-400 px-2 py-0.5 rounded-md uppercase tracking-wider shrink-0">
                    .KML
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug font-medium">
                  Todos os polígonos e limites com visualização tridimensional no Google Earth Pro e projetos QGIS.
                </p>
                <div className="flex items-center gap-1 text-[11px] font-bold text-slate-700 dark:text-slate-300 pt-1.5 group-hover:text-[#007AFF] dark:group-hover:text-[#007AFF] transition-colors">
                  <span>{isDownloading && downloadFormat === 'kml' ? 'Processando download...' : 'Baixar KML Completo'}</span>
                  <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-1" />
                </div>
              </div>
            </button>
          </div>

          {/* Dica de Filtro */}
          <div className="p-3 rounded-2xl bg-black/[0.02] dark:bg-white/[0.04] border border-black/5 dark:border-white/10 flex items-start gap-2.5 text-[11px] text-slate-500 dark:text-slate-400 font-medium leading-relaxed">
            <Info className="w-4 h-4 text-slate-500 dark:text-slate-400 shrink-0 mt-0.5" />
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
        <Info className="w-4 h-4 text-slate-500 dark:text-slate-400 shrink-0 mt-0.5" />
        <span>
          Os dados exportados contêm todas as coordenadas geométricas e colunas analíticas autorizadas para o seu perfil de usuário.
        </span>
      </div>
    </div>
  );
};
