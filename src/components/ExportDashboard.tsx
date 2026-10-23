import React, { useCallback } from 'react';
import { Download, FileSpreadsheet, Globe, FileCode, CheckCircle2, Info } from 'lucide-react';
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
}

export const ExportDashboard: React.FC<ExportDashboardProps> = ({
  selectedFeatures,
  showToast
}) => {
  if (!selectedFeatures || selectedFeatures.length === 0) {
    return null;
  }

  const count = selectedFeatures.length;

  const handleExportCSV = useCallback(() => {
    const id = count > 0 ? getIdentifier(selectedFeatures[0].properties) : 'selecao';
    const rawFeatures = selectedFeatures.map(f => f.layer);
    exportSelectionToCSV(`selecao_${sanitizeFilename(String(id))}.csv`, rawFeatures);
    logActivity('EXPORTACAO', `Exportou ${count} feição(ões) para planilha Excel (CSV)`, 'user', `Identificador: ${id}`);
    showToast('Exportando planilha CSV compatível com Microsoft Excel...');
  }, [selectedFeatures, count, showToast]);

  const handleExportKML = useCallback(() => {
    const id = count > 0 ? getIdentifier(selectedFeatures[0].properties) : 'selecao';
    const rawFeatures = selectedFeatures.map(f => f.layer);
    exportSelectionToKML(`selecao_${sanitizeFilename(String(id))}.kml`, rawFeatures);
    logActivity('EXPORTACAO', `Exportou ${count} feição(ões) para arquivo Google Earth (KML)`, 'user', `Identificador: ${id}`);
    showToast('Exportando arquivo KML para Google Earth e QGIS...');
  }, [selectedFeatures, count, showToast]);

  const handleExportGeoJSON = useCallback(() => {
    const id = count > 0 ? getIdentifier(selectedFeatures[0].properties) : 'selecao';
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

  // Obter nomes únicos das camadas das feições selecionadas
  const layerNames = Array.from(new Set(selectedFeatures.map(f => f.sourceName)));

  return (
    <section 
      id="export-dashboard-container" 
      aria-label="Central de Exportação de Dados"
      className="w-full bg-white dark:bg-slate-900 rounded-2xl shadow-xl p-5 sm:p-6 border border-slate-200/90 dark:border-slate-800 transition-all"
    >
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100 dark:border-slate-800">
        <div>
          <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2.5">
            <span className="p-2 rounded-xl bg-red-100 dark:bg-red-950/80 text-red-600 dark:text-red-400">
              <Download className="w-5 h-5" />
            </span>
            <span>Central de Exportação de Dados</span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Exporte as feições territoriais selecionadas em múltiplos formatos geoespaciais e tabulares.
          </p>
        </div>

        {/* Badges de Feições e Camadas */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-800/60 text-red-700 dark:text-red-300 text-xs font-black px-3 py-1 rounded-xl flex items-center gap-1.5 shadow-2xs">
            <CheckCircle2 className="w-3.5 h-3.5 text-red-600" />
            {count} {count === 1 ? 'Feição Pronta' : 'Feições Prontas'}
          </span>
          {layerNames.map(layer => (
            <span key={layer} className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[11px] font-bold px-2.5 py-1 rounded-xl border border-slate-200 dark:border-slate-700 truncate max-w-[180px]">
              {layer}
            </span>
          ))}
        </div>
      </div>

      {/* Grade de Botões de Exportação */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 my-4">
        {/* Opção 1: Planilha Excel CSV */}
        <button
          type="button"
          onClick={handleExportCSV}
          className="p-4 bg-emerald-50/70 hover:bg-emerald-100/80 dark:bg-emerald-950/30 dark:hover:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800/60 rounded-2xl transition-all text-left flex flex-col justify-between group cursor-pointer shadow-xs hover:shadow-md"
        >
          <div className="flex items-center justify-between mb-2">
            <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-black group-hover:scale-105 transition-transform">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <span className="text-[10px] font-extrabold bg-emerald-200/70 dark:bg-emerald-900 text-emerald-800 dark:text-emerald-300 px-2 py-0.5 rounded-full uppercase tracking-wider">
              Excel / CSV
            </span>
          </div>
          <div>
            <h4 className="text-sm font-black text-slate-900 dark:text-slate-100 group-hover:text-emerald-700 dark:group-hover:text-emerald-400 transition-colors">
              Planilha Excel (CSV)
            </h4>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-snug">
              Tabela formatada com UTF-8 BOM para abrir sem erros de acentuação no Excel ou LibreOffice.
            </p>
          </div>
        </button>

        {/* Opção 2: Google Earth / QGIS (KML) */}
        <button
          type="button"
          onClick={handleExportKML}
          className="p-4 bg-red-50/70 hover:bg-red-100/80 dark:bg-red-950/30 dark:hover:bg-red-950/50 border border-red-200 dark:border-red-800/60 rounded-2xl transition-all text-left flex flex-col justify-between group cursor-pointer shadow-xs hover:shadow-md"
        >
          <div className="flex items-center justify-between mb-2">
            <div className="w-9 h-9 rounded-xl bg-red-600 text-white flex items-center justify-center font-black group-hover:scale-105 transition-transform">
              <Globe className="w-5 h-5" />
            </div>
            <span className="text-[10px] font-extrabold bg-red-200/70 dark:bg-red-900 text-red-800 dark:text-red-300 px-2 py-0.5 rounded-full uppercase tracking-wider">
              Google Earth
            </span>
          </div>
          <div>
            <h4 className="text-sm font-black text-slate-900 dark:text-slate-100 group-hover:text-red-700 dark:group-hover:text-red-400 transition-colors">
              Google Earth (KML)
            </h4>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-snug">
              Geometrias completas dos polígonos e pontos para visualização 3D no Google Earth e QGIS.
            </p>
          </div>
        </button>

        {/* Opção 3: GeoJSON Vetorial */}
        <button
          type="button"
          onClick={handleExportGeoJSON}
          className="p-4 bg-blue-50/70 hover:bg-blue-100/80 dark:bg-blue-950/30 dark:hover:bg-blue-950/50 border border-blue-200 dark:border-blue-800/60 rounded-2xl transition-all text-left flex flex-col justify-between group cursor-pointer shadow-xs hover:shadow-md"
        >
          <div className="flex items-center justify-between mb-2">
            <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center font-black group-hover:scale-105 transition-transform">
              <FileCode className="w-5 h-5" />
            </div>
            <span className="text-[10px] font-extrabold bg-blue-200/70 dark:bg-blue-900 text-blue-800 dark:text-blue-300 px-2 py-0.5 rounded-full uppercase tracking-wider">
              GIS Vetorial
            </span>
          </div>
          <div>
            <h4 className="text-sm font-black text-slate-900 dark:text-slate-100 group-hover:text-blue-700 dark:group-hover:text-blue-400 transition-colors">
              GeoJSON Vetorial
            </h4>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-snug">
              Formato aberto padrão web com estrutura vetorial para importação direta em softwares SIG.
            </p>
          </div>
        </button>
      </div>

      {/* Nota Informativa */}
      <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 rounded-xl p-3 text-xs text-slate-600 dark:text-slate-400 flex items-start gap-2.5">
        <Info className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
        <div className="leading-relaxed text-[11px]">
          Os arquivos gerados contêm todas as propriedades analíticas das feições ativas no momento da seleção.
        </div>
      </div>
    </section>
  );
};
