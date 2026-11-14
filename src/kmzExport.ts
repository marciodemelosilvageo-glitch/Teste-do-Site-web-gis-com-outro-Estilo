import { zipSync, strToU8 } from 'fflate';
import { featureToKMLPlacemark, downloadFile } from './utils';

export async function exportToKMZ(filename: string, rawFeatures: any[]): Promise<void> {
  if (!rawFeatures || rawFeatures.length === 0) {
    throw new Error('Sem feições para exportar em KMZ.');
  }

  let placemarks = '';
  rawFeatures.forEach(layer => {
    const feat = layer?.feature || (typeof layer?.toGeoJSON === 'function' ? layer.toGeoJSON() : layer);
    if (feat) {
      placemarks += featureToKMLPlacemark(feat) + '\n';
    }
  });

  const fullKML = `<?xml version="1.0" encoding="UTF-8"?>\n<kml xmlns="http://www.opengis.net/kml/2.2">\n  <Document>\n${placemarks}  </Document>\n</kml>`;
  
  const zipData = zipSync({
    'doc.kml': strToU8(fullKML)
  });

  downloadFile(filename, zipData, 'application/vnd.google-earth.kmz');
}
