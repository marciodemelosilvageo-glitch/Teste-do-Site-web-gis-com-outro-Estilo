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
  Loader2,
  Filter,
  Database,
  Archive,
  AlertTriangle,
  X
} from 'lucide-react';
import { SelectedFeature } from '../types';
import { dataSources } from '../data';
import { 
  getIdentifier, 
  exportSelectionToCSV, 
  exportSelectionToKML, 
  sanitizeFilename,
  getGeometryKind,
  LAYER_GEOMETRY_KINDS,
  downloadFile
} from '../utils';
import { logActivity } from '../services/adminService';
import { exportSelectedFeatures, ExportPreferences, ExportFormat } from '../exportActions';
import { useFeatureAccess } from '../context/FeatureAccessContext';

interface ExportDashboardProps {
  selectedFeatures: SelectedFeature[];
  activeLayers?: string[];
  showToast: (msg: string) => void;
  onBackToDetails?: () => void;
  onClose?: () => void;
  preferences?: ExportPreferences;
  onUpdatePreferences?: (prefs: Partial<ExportPreferences>) => void;
}

// Cache em memória para os arquivos GeoJSON completos das camadas
const layerGeoJsonCache: Record<string, any> = {};

interface FormatCardConfig {
  id: ExportFormat;
  label: string;
  ext: string;
  desc: string;
  icon: React.ComponentType<{ className?: string }>;
  note?: string;
  onlyPoint?: boolean;
}

const ALL_FORMAT_CONFIGS: FormatCardConfig[] = [
  {
    id: 'gpkg',
    label: 'GeoPackage (GPKG)',
    ext: '.GPKG',
    desc: 'Padrão moderno OGC em SQLite para QGIS, ArcGIS e Python com geometrias e atributos integrais.',
    icon: Database
  },
  {
    id: 'shapefile',
    label: 'Shapefile (SHP / ZIP)',
    ext: '.ZIP',
    desc: 'Pacote compactado com .shp, .shx, .dbf, .prj e .cpg (WGS 84 / EPSG:4326).',
    note: 'Nota: nomes de colunas são limitados a 10 caracteres no padrão DBF.',
    icon: Archive
  },
  {
    id: 'csv',
    label: 'Planilha Excel (CSV)',
    ext: '.CSV',
    desc: 'Tabela de coordenadas e atributos com UTF-8 BOM para Excel, LibreOffice e Sheets.',
    icon: FileSpreadsheet,
    onlyPoint: true
  },
  {
    id: 'kmz',
    label: 'Google Earth Compactado (KMZ)',
    ext: '.KMZ',
    desc: 'Arquivo KML comprimido de alta velocidade para abertura no Google Earth Pro e softwares GIS.',
    icon: Globe
  },
  {
    id: 'kml',
    label: 'Google Earth (KML)',
    ext: '.KML',
    desc: 'Estrutura XML vetorial para visualização tridimensional e projetos no Google Earth e QGIS.',
    icon: Globe
  },
  {
    id: 'geojson',
    label: 'GeoJSON Vetorial',
    ext: '.GEOJSON',
    desc: 'Formato aberto padrão web com estrutura vetorial pura para ArcGIS, QGIS, Leaflet e Mapbox.',
    icon: FileCode
  }
];

export const ExportDashboard: React.FC<ExportDashboardProps> = ({
  selectedFeatures,
  activeLayers,
  onBackToDetails,
  preferences,
  onUpdatePreferences
}) => {
  const { can, canExport, canViewLayer, getNumericLimit } = useFeatureAccess();
  const maxExportRows = getNumericLimit('export_rows', 50000);
  const count = selectedFeatures?.length || 0;
  const currentFormat: ExportFormat = preferences?.format || 'geojson';

  // Detecção do tipo de geometria da seleção ativa
  const filteredGeometryKind = useMemo(() => {
    return getGeometryKind(selectedFeatures);
  }, [selectedFeatures]);

  // Modo: 'filtered' (feições selecionadas) ou 'full_layer' (camada completa)
  const [exportMode, setExportMode] = useState<'filtered' | 'full_layer'>(
    count > 0 ? 'filtered' : 'full_layer'
  );

  // Lista de camadas disponíveis para download completo (apenas permitidas e visíveis no mapa)
  const availableLayers = useMemo(() => {
    return dataSources
      .filter(ds => canViewLayer(ds.name) && (!activeLayers || activeLayers.includes(ds.name)))
      .map(ds => ({
        name: ds.name,
        url: ds.url,
        friendlyName: ds.name === 'Municipios' ? 'Municípios (Piauí)' :
                      ds.name === 'Bairros' ? 'Bairros (Teresina)' :
                      ds.name === 'Favelas e Comunidades' ? 'Favelas e Comunidades Urbanas' :
                      ds.name
      }));
  }, [canViewLayer, activeLayers]);

  // Camada selecionada para exportação completa
  const [selectedLayerName, setSelectedLayerName] = useState<string>(
    availableLayers[0]?.name || ''
  );

  // Estado de carregamento e erro inline (sem toasts)
  const [isDownloading, setIsDownloading] = useState<boolean>(false);
  const [downloadFormat, setDownloadFormat] = useState<ExportFormat | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);

  const currentLayer = useMemo(() => {
    return availableLayers.find(l => l.name === selectedLayerName) || availableLayers[0];
  }, [availableLayers, selectedLayerName]);

  // Detecção do tipo de geometria da camada completa selecionada
  const fullLayerGeometryKind = useMemo(() => {
    return currentLayer ? (LAYER_GEOMETRY_KINDS[currentLayer.name] || 'polygon') : 'polygon';
  }, [currentLayer]);

  // Formatos visíveis para a seleção filtrada (CSV apenas se for ponto)
  const visibleFilteredFormats = useMemo(() => {
    return ALL_FORMAT_CONFIGS.filter(cfg => {
      if (!canExport(cfg.id)) return false;
      if (cfg.onlyPoint && filteredGeometryKind !== 'point') return false;
      return true;
    });
  }, [filteredGeometryKind, canExport]);

  // Formatos visíveis para a camada completa (CSV apenas se for ponto)
  const visibleFullLayerFormats = useMemo(() => {
    return ALL_FORMAT_CONFIGS.filter(cfg => {
      if (!canExport(cfg.id)) return false;
      if (cfg.onlyPoint && fullLayerGeometryKind !== 'point') return false;
      return true;
    });
  }, [fullLayerGeometryKind, canExport]);

  // ==============================================================
  // EXPORTAÇÃO FILTRADA (FEIÇÕES SELECIONADAS)
  // ==============================================================
  const handleExportFiltered = useCallback(async (format: ExportFormat) => {
    if (!canExport(format)) {
      setExportError(`Exportação no formato ${format.toUpperCase()} bloqueada pelo administrador.`);
      return;
    }
    const allowedFeatures = selectedFeatures.filter(f => !f.sourceName || canViewLayer(f.sourceName));
    if (allowedFeatures.length === 0) {
      setExportError('Nenhuma das feições selecionadas pertence a uma camada permitida para o seu perfil.');
      return;
    }
    if (allowedFeatures.length > maxExportRows && Number.isFinite(maxExportRows)) {
      setExportError(`O seu perfil possui limite de exportação de até ${maxExportRows.toLocaleString('pt-BR')} linhas (seleção atual: ${allowedFeatures.length.toLocaleString('pt-BR')}). Reduza a seleção ou solicite ampliação de limite ao Administrador.`);
      return;
    }
    setExportError(null);
    setIsDownloading(true);
    setDownloadFormat(format);

    try {
      const res = await exportSelectedFeatures(format, allowedFeatures, 'user');
      if (!res.ok) {
        setExportError(res.error || 'Erro ao exportar feições.');
      }
    } catch (err: any) {
      setExportError(err?.message || 'Erro ao processar download.');
    } finally {
      setIsDownloading(false);
      setDownloadFormat(null);
    }
  }, [selectedFeatures, canExport, canViewLayer, maxExportRows]);

  // ==============================================================
  // EXPORTAÇÃO DA CAMADA COMPLETA
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

  const handleExportFullLayer = useCallback(async (format: ExportFormat) => {
    if (!currentLayer) return;
    if (!canViewLayer(currentLayer.name)) {
      setExportError('Exportação bloqueada: você não possui permissão para acessar esta camada.');
      return;
    }
    if (!canExport(format)) {
      setExportError(`Exportação no formato ${format.toUpperCase()} bloqueada pelo administrador.`);
      return;
    }
    setExportError(null);
    setIsDownloading(true);
    setDownloadFormat(format);

    try {
      const geojson = await fetchLayerData(currentLayer.url);
      const safeFilename = sanitizeFilename(currentLayer.friendlyName || currentLayer.name);
      const features = (geojson.features || []).map((f: any) => ({ feature: f }));

      if (features.length > maxExportRows && Number.isFinite(maxExportRows)) {
        setExportError(`A camada possui ${features.length.toLocaleString('pt-BR')} feições, excedendo o limite de ${maxExportRows.toLocaleString('pt-BR')} linhas permitido para o seu perfil. Utilize a seleção filtrada ou solicite ampliação de limite ao Administrador.`);
        return;
      }

      if (format === 'geojson') {
        const jsonStr = JSON.stringify(geojson, null, 2);
        downloadFile(`Camada_${safeFilename}.geojson`, jsonStr, 'application/geo+json;charset=utf-8;');
      } else if (format === 'csv') {
        if (fullLayerGeometryKind !== 'point') {
          setExportError('O formato CSV não está disponível para camadas de polígonos.');
          return;
        }
        exportSelectionToCSV(`Camada_${safeFilename}.csv`, features);
      } else if (format === 'kml') {
        exportSelectionToKML(`Camada_${safeFilename}.kml`, features);
      } else if (format === 'kmz') {
        const { exportToKMZ } = await import('../kmzExport');
        await exportToKMZ(`Camada_${safeFilename}.kmz`, features);
      } else if (format === 'gpkg') {
        const { exportToGeoPackage } = await import('../geoPackageExport');
        await exportToGeoPackage(`Camada_${safeFilename}.gpkg`, features, safeFilename);
      } else if (format === 'shapefile') {
        const { exportToShapefile } = await import('../shapefileExport');
        await exportToShapefile(`Camada_${safeFilename}.zip`, features, safeFilename);
      }

      logActivity('EXPORTACAO', `Exportou camada completa "${currentLayer.name}" no formato ${format.toUpperCase()}`, 'user');
    } catch (err: any) {
      console.error(err);
      setExportError(`Erro ao exportar a camada "${currentLayer.friendlyName}": ${err?.message || 'Tente novamente.'}`);
    } finally {
      setIsDownloading(false);
      setDownloadFormat(null);
    }
  }, [currentLayer, fullLayerGeometryKind, canExport, canViewLayer, maxExportRows]);

  // Identificador da feição principal
  const primaryFeatureName = useMemo(() => {
    if (!selectedFeatures || selectedFeatures.length === 0) return '';
    const first = selectedFeatures[0];
    return first.name || getIdentifier(first.properties) || 'Feição selecionada';
  }, [selectedFeatures]);

  const selectedLayerNames = useMemo(() => {
    const names = new Set<string>();
    selectedFeatures.forEach(f => {
      if (f.sourceName) names.add(f.sourceName);
    });
    return Array.from(names);
  }, [selectedFeatures]);

  // Formato efetivo exibido no seletor de download rápido (fallback de CSV para geojson quando for polígono)
  const effectiveQuickFormat = (currentFormat === 'csv' && filteredGeometryKind === 'polygon') ? 'geojson' : currentFormat;

  if (!can('allowExportData')) {
    return (
      <div className="p-6 text-center space-y-3">
        <div className="w-12 h-12 mx-auto rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center">
          <Download className="w-6 h-6" />
        </div>
        <h3 className="font-bold text-sm text-slate-800 dark:text-slate-100">
          Exportação de Dados Desativada
        </h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xs mx-auto">
          A exportação de dados está bloqueada pelo administrador para o seu perfil.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Botão de Voltar para os Detalhes da Feição */}
      {count > 0 && onBackToDetails && (
        <button
          type="button"
          onClick={onBackToDetails}
          className="w-full py-2 px-3 rounded-xl bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/15 text-slate-700 dark:text-slate-200 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
        >
          <ChevronLeft className="w-4 h-4" />
          <span>Voltar para Detalhes da Feição</span>
        </button>
      )}

      {/* Header Central de Exportação */}
      <div className="flex items-center gap-2.5 p-3 rounded-2xl bg-gradient-to-r from-blue-500/10 via-indigo-500/10 to-transparent border border-blue-500/20 shadow-xs">
        <div className="w-8 h-8 rounded-xl bg-[#007AFF] text-white flex items-center justify-center shrink-0 shadow-md shadow-blue-500/25">
          <Download className="w-4 h-4" />
        </div>
        <div className="min-w-0">
          <h3 className="font-black text-sm text-slate-900 dark:text-white truncate">
            Central de Exportação de Dados
          </h3>
          <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 truncate">
            Formatos espaciais e tabulares oficiais (WGS 84 / EPSG:4326)
          </p>
        </div>
      </div>

      {/* Alerta Inline de Erro Fixo (Sem Toasts) */}
      {exportError && (
        <div className="p-3 bg-red-500/10 dark:bg-red-950/30 border border-red-500/20 dark:border-red-800/40 rounded-2xl flex items-start gap-2.5 text-xs text-red-600 dark:text-red-400 animate-fadeIn shadow-xs">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-red-500" />
          <div className="flex-1 min-w-0">
            <span className="font-bold block text-xs">Erro na exportação</span>
            <span className="text-[11px] opacity-90 block leading-relaxed">{exportError}</span>
          </div>
          <button
            type="button"
            onClick={() => setExportError(null)}
            className="p-1 hover:bg-black/5 dark:hover:bg-white/10 rounded-lg text-red-500 hover:text-red-700 dark:hover:text-red-300 transition-colors cursor-pointer"
            aria-label="Fechar erro"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Bloco de Download Rápido (Preferência do Usuário) */}
      <div className="p-3 rounded-2xl bg-black/[0.02] dark:bg-white/[0.03] border border-black/5 dark:border-white/10 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-6 h-6 rounded-lg bg-[#007AFF]/15 text-[#007AFF] dark:text-[#64D2FF] flex items-center justify-center shrink-0">
              <Download className="w-3.5 h-3.5" />
            </div>
            <div className="min-w-0">
              <h4 className="font-bold text-xs text-slate-900 dark:text-white truncate">
                Download Rápido
              </h4>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                {preferences?.quickDownload
                  ? `Baixa ${effectiveQuickFormat.toUpperCase()} direto ao tocar em Exportar nos detalhes`
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
                format: effectiveQuickFormat
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
            <div className={`grid ${filteredGeometryKind === 'point' ? 'grid-cols-6' : 'grid-cols-5'} gap-1 p-1 bg-black/5 dark:bg-white/10 rounded-xl`}>
              {((filteredGeometryKind === 'point'
                ? ['csv', 'gpkg', 'shapefile', 'kmz', 'kml', 'geojson']
                : ['gpkg', 'shapefile', 'kmz', 'kml', 'geojson']
              ) as ExportFormat[]).map(fmt => {
                const isSelected = effectiveQuickFormat === fmt;
                return (
                  <button
                    key={fmt}
                    type="button"
                    onClick={() => onUpdatePreferences?.({ format: fmt })}
                    className={`py-1.5 px-1 rounded-lg text-[10px] font-black transition-all uppercase cursor-pointer text-center truncate ${
                      isSelected
                        ? 'bg-white dark:bg-[#2c2c2e] text-[#007AFF] dark:text-[#64D2FF] shadow-xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    {fmt === 'shapefile' ? 'shp' : fmt}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Seletor de Modo: Seleção Filtrada vs Camada Completa */}
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
          <div className="px-1 pt-1 flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500">
              Formatos de Download Filtrado
            </span>
            <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400">
              Tipo: {filteredGeometryKind === 'point' ? 'Pontos' : 'Polígonos'}
            </span>
          </div>

          {/* Grade Vertical de Formatos de Exportação Filtrada */}
          <div className="space-y-2">
            {visibleFilteredFormats.map(fmt => {
              const IconComp = fmt.icon;
              const isFmtDownloading = isDownloading && downloadFormat === fmt.id;

              return (
                <button
                  key={fmt.id}
                  type="button"
                  disabled={isDownloading}
                  onClick={() => handleExportFiltered(fmt.id)}
                  className="w-full p-3 bg-white dark:bg-[#2c2c2e] hover:bg-slate-50 dark:hover:bg-[#343438] border border-black/10 dark:border-white/10 rounded-2xl transition-all text-left flex items-start gap-3 group cursor-pointer active:scale-[0.98] shadow-xs disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-white/10 text-slate-700 dark:text-slate-200 flex items-center justify-center shrink-0">
                    {isFmtDownloading ? (
                      <Loader2 className="w-4 h-4 animate-spin text-[#007AFF]" />
                    ) : (
                      <IconComp className="w-4 h-4" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1 mb-1">
                      <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100">
                        {fmt.label}
                      </h4>
                      <span className="text-[9px] font-bold bg-black/5 dark:bg-white/10 text-slate-600 dark:text-slate-400 px-2 py-0.5 rounded-md uppercase tracking-wider shrink-0">
                        {fmt.ext}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug font-medium">
                      {fmt.desc}
                    </p>
                    {fmt.note && (
                      <p className="text-[10px] text-amber-600 dark:text-amber-400 font-medium pt-1">
                        {fmt.note}
                      </p>
                    )}
                    <div className="flex items-center gap-1 text-[11px] font-bold text-slate-700 dark:text-slate-300 pt-1.5 group-hover:text-[#007AFF] dark:group-hover:text-[#007AFF] transition-colors">
                      <span>{isFmtDownloading ? 'Processando arquivo...' : `Baixar arquivo ${fmt.ext} filtrado`}</span>
                      <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-1" />
                    </div>
                  </div>
                </button>
              );
            })}
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

            {/* Seletor de Camada */}
            {availableLayers.length === 0 ? (
              <p className="text-[11px] font-medium text-amber-600 dark:text-amber-400 bg-amber-500/10 rounded-xl px-3 py-2">
                Nenhuma camada visível no mapa no momento. Ative uma camada para exportar.
              </p>
            ) : (
              <div className="space-y-1">
                <label htmlFor="layer-select" className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 block">
                  Escolha a Camada para Download
                </label>
                <div className="relative">
                  <select
                    id="layer-select"
                    value={currentLayer?.name || ''}
                    onChange={(e) => setSelectedLayerName(e.target.value)}
                    className="w-full py-2.5 pl-3 pr-8 rounded-xl bg-white dark:bg-[#2c2c2e] border border-black/10 dark:border-white/10 text-xs font-bold text-slate-800 dark:text-slate-100 shadow-2xs focus:outline-hidden focus:ring-2 focus:ring-blue-500 cursor-pointer appearance-none"
                  >
                    {availableLayers.map(l => (
                      <option key={l.name} value={l.name}>
                        {l.friendlyName}
                      </option>
                    ))}
                  </select>
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                    ▼
                  </div>
                </div>
              </div>
            )}
          </div>

          {currentLayer && (
            <>
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
            {visibleFullLayerFormats.map(fmt => {
              const IconComp = fmt.icon;
              const isFmtDownloading = isDownloading && downloadFormat === fmt.id;

              return (
                <button
                  key={fmt.id}
                  type="button"
                  disabled={isDownloading}
                  onClick={() => handleExportFullLayer(fmt.id)}
                  className="w-full p-3 bg-white dark:bg-[#2c2c2e] hover:bg-slate-50 dark:hover:bg-[#343438] border border-black/10 dark:border-white/10 rounded-2xl transition-all text-left flex items-start gap-3 group cursor-pointer active:scale-[0.98] shadow-xs disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-white/10 text-slate-700 dark:text-slate-200 flex items-center justify-center shrink-0">
                    {isFmtDownloading ? (
                      <Loader2 className="w-4 h-4 animate-spin text-[#007AFF]" />
                    ) : (
                      <IconComp className="w-4 h-4" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1 mb-1">
                      <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100">
                        {fmt.label}
                      </h4>
                      <span className="text-[9px] font-bold bg-black/5 dark:bg-white/10 text-slate-600 dark:text-slate-400 px-2 py-0.5 rounded-md uppercase tracking-wider shrink-0">
                        {fmt.ext}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug font-medium">
                      {fmt.desc}
                    </p>
                    {fmt.note && (
                      <p className="text-[10px] text-amber-600 dark:text-amber-400 font-medium pt-1">
                        {fmt.note}
                      </p>
                    )}
                    <div className="flex items-center gap-1 text-[11px] font-bold text-slate-700 dark:text-slate-300 pt-1.5 group-hover:text-[#007AFF] dark:group-hover:text-[#007AFF] transition-colors">
                      <span>{isFmtDownloading ? 'Processando download...' : `Baixar Camada Completa (${fmt.ext})`}</span>
                      <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-1" />
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
            </>
          )}

          {/* Dica de Filtro */}
          <div className="p-3 rounded-2xl bg-black/[0.02] dark:bg-white/[0.04] border border-black/5 dark:border-white/10 flex items-start gap-2.5 text-[11px] text-slate-500 dark:text-slate-400 font-medium leading-relaxed">
            <Info className="w-4 h-4 text-slate-500 dark:text-slate-400 shrink-0 mt-0.5" />
            <div>
              <strong className="text-slate-700 dark:text-slate-200">Como exportar apenas uma feição filtrada?</strong>
              <p className="pt-0.5">
                Clique em qualquer bairro, município ou setor no mapa para selecioná-lo. Esta aba se ajustará automaticamente para exportar apenas as feições selecionadas.
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
