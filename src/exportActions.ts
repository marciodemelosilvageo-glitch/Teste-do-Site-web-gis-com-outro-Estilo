import { useState, useEffect, useCallback } from 'react';
import { SelectedFeature } from './types';
import { 
  getIdentifier, 
  sanitizeFilename, 
  exportSelectionToCSV, 
  exportSelectionToKML, 
  downloadFile 
} from './utils';
import { logActivity, UserRole } from './services/adminService';

export type ExportFormat = 'csv' | 'kml' | 'geojson';

export interface ExportPreferences {
  quickDownload?: boolean;
  format?: ExportFormat;
}

export interface ExportResult {
  ok: boolean;
  count: number;
  format: ExportFormat;
  filename?: string;
  error?: string;
}

export const getExportPreferences = (uKey: string): ExportPreferences => {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(`export_prefs_${uKey}`);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        const quickDownload = typeof parsed.quickDownload === 'boolean' ? parsed.quickDownload : undefined;
        const validFormats: ExportFormat[] = ['csv', 'kml', 'geojson'];
        const format = validFormats.includes(parsed.format) ? (parsed.format as ExportFormat) : undefined;
        return { quickDownload, format };
      }
    }
  } catch {}
  return {};
};

export const setStoredExportPreferences = (uKey: string, prefs: ExportPreferences): void => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(`export_prefs_${uKey}`, JSON.stringify(prefs));
  } catch {}
};

export const useExportPreferences = (userKey: string) => {
  const [preferences, setPreferencesState] = useState<ExportPreferences>(() => getExportPreferences(userKey));

  useEffect(() => {
    setPreferencesState(getExportPreferences(userKey));
  }, [userKey]);

  const updatePreferences = useCallback((newPrefs: Partial<ExportPreferences>) => {
    setPreferencesState(prev => {
      const updated: ExportPreferences = { ...prev, ...newPrefs };
      setStoredExportPreferences(userKey, updated);
      return updated;
    });
  }, [userKey]);

  return { preferences, updatePreferences };
};

/**
 * Função compartilhada para exportação da seleção filtrada de feições.
 * Valida a existência de feições antes de disparar qualquer exportação (sem usar alert())
 * e devolve um resultado seguro { ok, count, format, filename?, error? }.
 */
export const exportSelectedFeatures = (
  format: ExportFormat,
  selectedFeatures: SelectedFeature[],
  userRole: string = 'user'
): ExportResult => {
  if (!selectedFeatures || selectedFeatures.length === 0) {
    return {
      ok: false,
      count: 0,
      format,
      error: 'Nenhuma feição selecionada para exportar.'
    };
  }

  const safeRole: UserRole = (userRole === 'master' || userRole === 'manager' || userRole === 'admin') ? userRole : 'user';
  const count = selectedFeatures.length;
  const firstProps = selectedFeatures[0]?.properties || {};
  const id = getIdentifier(firstProps) || 'selecao';
  const safeId = sanitizeFilename(String(id));

  try {
    if (format === 'csv') {
      const rawFeatures = selectedFeatures.map(f => f.layer).filter(Boolean);
      if (rawFeatures.length === 0) {
        return { ok: false, count: 0, format, error: 'Sem geometrias para exportar em CSV.' };
      }
      const filename = `selecao_${safeId}.csv`;
      exportSelectionToCSV(filename, rawFeatures);
      logActivity('EXPORTACAO', `Exportou ${count} feição(ões) filtrada(s) para CSV`, safeRole, `Identificador: ${id}`);
      return { ok: true, count, format, filename };
    }

    if (format === 'kml') {
      const rawFeatures = selectedFeatures.map(f => f.layer).filter(Boolean);
      if (rawFeatures.length === 0) {
        return { ok: false, count: 0, format, error: 'Sem geometrias para exportar em KML.' };
      }
      const filename = `selecao_${safeId}.kml`;
      exportSelectionToKML(filename, rawFeatures);
      logActivity('EXPORTACAO', `Exportou ${count} feição(ões) filtrada(s) para KML`, safeRole, `Identificador: ${id}`);
      return { ok: true, count, format, filename };
    }

    if (format === 'geojson') {
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

      const filename = `selecao_${safeId}.geojson`;
      const jsonStr = JSON.stringify(featureCollection, null, 2);
      downloadFile(filename, jsonStr, 'application/geo+json;charset=utf-8;');
      logActivity('EXPORTACAO', `Exportou ${count} feição(ões) filtrada(s) para GeoJSON`, safeRole, `Identificador: ${id}`);
      return { ok: true, count, format, filename };
    }

    return {
      ok: false,
      count: 0,
      format,
      error: 'Formato não suportado.'
    };
  } catch (err: any) {
    return {
      ok: false,
      count: 0,
      format,
      error: err?.message || 'Erro ao gerar arquivo de exportação.'
    };
  }
};
