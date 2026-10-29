import React, { useCallback } from 'react';
import { 
  Download, 
  FileSpreadsheet, 
  Globe, 
  FileCode, 
  CheckCircle2, 
  Info, 
  ChevronLeft,
  Sparkles,
  ArrowRight
} from 'lucide-react';
import { SelectedFeature } from '../types';
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

export const ExportDashboard: React.FC<ExportDashboardProps> = ({
  selectedFeatures,
  showToast,
  onBackToDetails,
}) => {
  const count = selectedFeatures?.length || 0;

  const handleExportCSV = useCallback(() => {
    if (count === 0) return;
    const id = getIdentifier(selectedFeatures[0].properties) || 'selecao';
    const rawFeatures = selectedFeatures.map(f => f.layer);
    exportSelectionToCSV(`selecao_${sanitizeFilename(String(id))}.csv`, rawFeatures);
    logActivity('EXPORTACAO', `Exportou ${count} feição(ões) para planilha Excel (CSV)`, 'user', `Identificador: ${id}`);
    showToast('Exportando planilha CSV compatível com Microsoft Excel...');
  }, [selectedFeatures, count, showToast]);

  const handleExportKML = useCallback(() => {
    if (count === 0) return;
    const id = getIdentifier(selectedFeatures[0].properties) || 'selecao';
    const rawFeatures = selectedFeatures.map(f => f.layer);
    exportSelectionToKML(`selecao_${sanitizeFilename(String(id))}.kml`, rawFeatures);
    logActivity('EXPORTACAO', `Exportou ${count} feição(ões) para arquivo Google Earth (KML)`, 'user', `Identificador: ${id}`);
    showToast('Exportando arquivo KML para Google Earth e QGIS...');
  }, [selectedFeatures, count, showToast]);

  const handleExportGeoJSON = useCallback(() => {
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

    logActivity('EXPORTACAO', `Exportou ${count} feição(ões) para formato GeoJSON vetorial`, 'user', `Identificador: ${id}`);
    showToast('Exportando arquivo GeoJSON vetorial...');
  }, [selectedFeatures, count, showToast]);

  // Se nenhuma feição foi selecionada
  if (count === 0) {
    return (
      <div className="space-y-4 py-8 text-center animate-fadeIn px-2">
        <div className="w-14 h-14 rounded-3xl bg-[#AF52DE]/10 text-[#AF52DE] flex items-center justify-center mx-auto mb-3 shadow-inner">
          <Download className="w-7 h-7" />
        </div>
        <h3 className="text-base font-black text-slate-900 dark:text-white">
          Nenhuma feição selecionada
        </h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 max-w-[280px] mx-auto leading-relaxed">
          Selecione qualquer elemento no mapa (bairros, municípios, setores ou localidades) para exportar seus dados analíticos.
        </p>
      </div>
    );
  }

  // Obter nomes únicos das camadas das feições selecionadas
  const layerNames = Array.from(new Set(selectedFeatures.map(f => f.sourceName).filter(Boolean)));
  const primaryFeatureName = selectedFeatures[0]?.name || selectedFeatures[0]?.properties?.Nome || selectedFeatures[0]?.properties?.NM_MUN || 'Feição Selecionada';

  return (
    <div className="space-y-3.5 pb-6 animate-fadeIn">
      {/* Botão de retorno rápido para Detalhes se tiver origem na feição */}
      {onBackToDetails && (
        <button
          type="button"
          onClick={onBackToDetails}
          className="inline-flex items-center gap-1.5 text-xs font-bold text-[#007AFF] hover:underline cursor-pointer group mb-0.5"
        >
          <ChevronLeft className="w-4 h-4 transition-transform group-hover:-translate-x-0.5" />
          <span>Voltar aos detalhes</span>
        </button>
      )}

      {/* Card Resumo Apple Glass */}
      <div className="p-4 rounded-3xl bg-gradient-to-br from-[#AF52DE]/15 via-[#007AFF]/5 to-transparent border border-[#AF52DE]/20 shadow-xs space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-[#AF52DE] to-[#BF5AF2] text-white flex items-center justify-center shadow-md shadow-purple-500/25 shrink-0">
              <Download className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="font-black text-sm text-slate-900 dark:text-white truncate">
                Central de Exportação
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

        {layerNames.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-black/5 dark:border-white/10">
            <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
              Camadas:
            </span>
            {layerNames.map(layer => (
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
          Escolha o formato de download
        </span>
      </div>

      {/* Grade Vertical de Formatos de Exportação */}
      <div className="space-y-2.5">
        {/* Opção 1: Planilha Excel CSV */}
        <button
          type="button"
          onClick={handleExportCSV}
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
              <span>Baixar arquivo CSV</span>
              <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-1" />
            </div>
          </div>
        </button>

        {/* Opção 2: Google Earth / QGIS (KML) */}
        <button
          type="button"
          onClick={handleExportKML}
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
              <span>Baixar arquivo KML</span>
              <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-1" />
            </div>
          </div>
        </button>

        {/* Opção 3: GeoJSON Vetorial */}
        <button
          type="button"
          onClick={handleExportGeoJSON}
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
              <span>Baixar arquivo GeoJSON</span>
              <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-1" />
            </div>
          </div>
        </button>
      </div>

      {/* Nota Informativa Apple Glass */}
      <div className="p-3 rounded-2xl bg-black/[0.02] dark:bg-white/[0.04] border border-black/5 dark:border-white/10 flex items-start gap-2 text-[11px] text-slate-500 dark:text-slate-400 font-medium leading-relaxed">
        <Info className="w-4 h-4 text-[#AF52DE] shrink-0 mt-0.5" />
        <span>
          Os arquivos exportados contêm todas as coordenadas geométricas e colunas analíticas autorizadas para o seu nível de acesso.
        </span>
      </div>
    </div>
  );
};
