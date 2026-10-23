import L from 'leaflet';
import { situationMap, typeMap, propertyNames, PRIORITY_KEYS, CODE_KEYS } from './data';

// Normalizar texto para buscas sem acentos e em minúsculas
export const normalizeString = (s: string | null | undefined): string => {
  if (!s) return '';
  return String(s)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
};

// Algoritmo de Levenshtein altamente otimizado (alocação mínima com 2 vetores de tamanho reduzido)
export const levenshteinDistance = (a: string, b: string, maxDistance: number = Infinity): number => {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  // Early-exit: se a diferença de tamanho já for maior que o máximo tolerado
  if (Math.abs(a.length - b.length) > maxDistance) {
    return maxDistance + 1;
  }

  // Garantir que 'b' seja a string mais curta para minimizar uso de memória
  let strA = a;
  let strB = b;
  if (strA.length < strB.length) {
    strA = b;
    strB = a;
  }

  const bLen = strB.length;
  let v0 = new Int32Array(bLen + 1);
  let v1 = new Int32Array(bLen + 1);

  for (let i = 0; i <= bLen; i++) {
    v0[i] = i;
  }

  for (let i = 0; i < strA.length; i++) {
    v1[0] = i + 1;
    let minInRow = v1[0];

    for (let j = 0; j < bLen; j++) {
      const cost = strA[i] === strB[j] ? 0 : 1;
      const val = Math.min(
        v1[j] + 1,      // Inserção
        v0[j + 1] + 1,  // Deleção
        v0[j] + cost    // Substituição
      );
      v1[j + 1] = val;
      if (val < minInRow) {
        minInRow = val;
      }
    }

    if (minInRow > maxDistance) {
      return maxDistance + 1;
    }

    // Troca os buffers
    const tmp = v0;
    v0 = v1;
    v1 = tmp;
  }

  return v0[bLen];
};

// Sanitização de HTML e XML contra injeções e quebras de sintaxe
export const escapeHtml = (s: string | null | undefined): string => {
  if (!s) return '';
  return String(s).replace(/[&<>"'`=\\/]/g, ch => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
    '`': '&#96;',
    '=': '&#61;',
    '/': '&#47;'
  }[ch] || ch));
};

export const escapeXml = (s: string | null | undefined): string => {
  if (!s) return '';
  return String(s).replace(/[<>&'"]/g, ch => ({
    '<': '&lt;',
    '>': '&gt;',
    '&': '&amp;',
    "'": '&apos;',
    '"': '&quot;'
  }[ch] || ch));
};

// Sanitizar nome do arquivo para exportação segura
export const sanitizeFilename = (s: string | null | undefined): string => {
  if (!s) return 'export';
  return String(s).replace(/[\\/:*?"<>|]+/g, '_').slice(0, 120);
};

// Traduzir valores codificados (Ex: Situação 1, Tipo do Setor 1) para descrições legíveis
export const getTranslatedValue = (key: string, value: any): string => {
  if (value === null || value === undefined) return '';
  const valStr = String(value).trim();
  
  if (key === 'CD_SIT' && situationMap[valStr]) {
    return `${valStr} - ${situationMap[valStr]}`;
  }
  if (key === 'CD_TIPO' && typeMap[valStr]) {
    return `${valStr} - ${typeMap[valStr]}`;
  }
  
  if (typeof value === 'number') {
    if (!Number.isInteger(value)) {
      return value.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 3 });
    }
    return value.toLocaleString('pt-BR');
  }

  if (typeof value === 'string' && !isNaN(Number(value)) && value.includes('.')) {
    const num = Number(value);
    if (!Number.isInteger(num)) {
      return num.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 3 });
    }
  }

  return valStr;
};

// Identifica se uma chave de propriedade é um código técnico, ID ou campo interno que não deve ser exibido
export const isCodeOrSystemProperty = (key: string): boolean => {
  if (!key) return true;
  const rawKey = key.trim();
  const lowKey = rawKey.toLowerCase();
  
  // 1. Chaves de sistema e identificadores técnicos exatos
  const systemExact = [
    'fid', 'ogc_fid', 'id', 'gid', 'objectid', 'cartodb_id', 'geom', 'geometry', '_details',
    'id localidades', 'id_localidades', 'id localidade', 'cod_aisp', 'cod_risp',
    'código único do endereço', 'codigo unico do endereco'
  ];
  if (systemExact.includes(lowKey)) return true;

  // 2. Prefixos de códigos técnicos (CD_*, COD_*, CODIGO_*, CÓDIGO_*)
  const upperKey = rawKey.toUpperCase();
  if (
    upperKey.startsWith('CD_') || 
    upperKey.startsWith('COD_') || 
    upperKey.startsWith('CODIGO_') || 
    upperKey.startsWith('CÓDIGO_')
  ) {
    // CD_SIT e CD_TIPO têm valor descritivo traduzido ("Situação Detalhada", "Tipo do Setor"), mantemos
    if (upperKey === 'CD_SIT' || upperKey === 'CD_TIPO') {
      return false;
    }
    return true;
  }

  // 3. Qualquer chave cujo nome contenha código/geocódigo
  if (
    lowKey.includes('codigo') || 
    lowKey.includes('código') || 
    lowKey.includes('geocodigo') || 
    lowKey.includes('geocódigo')
  ) {
    return true;
  }

  // 4. Se houver um nome amigável registrado em propertyNames
  const label = propertyNames[rawKey];
  if (label) {
    const lowLabel = label.toLowerCase();
    if (
      lowLabel.startsWith('código') || 
      lowLabel.startsWith('codigo') || 
      lowLabel.startsWith('geocódigo') || 
      lowLabel.startsWith('geocodigo') ||
      lowLabel.startsWith('id ') ||
      lowLabel.includes('código do') ||
      lowLabel.includes('codigo do') ||
      lowLabel.includes('código da') ||
      lowLabel.includes('codigo da') ||
      lowLabel.includes('código de') ||
      lowLabel.includes('codigo de')
    ) {
      return true;
    }
  }

  return false;
};

// Formatar textos de MAIÚSCULO para Title Case (Ex: "CACIMBA DE CIMA" -> "Cacimba de Cima")
export const toTitleCase = (str: string | null | undefined): string => {
  if (!str) return '';
  const text = String(str).trim();
  if (!text) return '';

  // Se for código numérico ou sigla curta em maiúsculas (ex: "PI", "AISP", "RISP", "UF", "IBGE")
  if (/^\d+$/.test(text) || /^[A-Z]{1,4}$/.test(text)) {
    return text;
  }

  // Preposições, artigos e conjunções que devem permanecer em minúsculo
  const lowerExceptions = new Set([
    'de', 'do', 'da', 'dos', 'das', 'e', 'em', 'no', 'na', 'nos', 'nas', 
    'a', 'o', 'as', 'os', 'com', 'por', 'para', 'se', 'ou', 'até'
  ]);

  // Se o texto estiver totalmente em MAIÚSCULAS
  const isAllUpper = text === text.toUpperCase() && /[A-Z]/.test(text);
  const targetText = isAllUpper ? text.toLowerCase() : text;

  // Split por espaços, hífens ou barras mantendo os delimitadores
  const parts = targetText.split(/(\s+|-|\/)/);
  let wordCount = 0;

  return parts.map((part) => {
    if (/^(\s+|-|\/)$/.test(part) || !part) {
      return part;
    }

    wordCount++;

    // Preposição no meio da frase/nome
    if (wordCount > 1 && lowerExceptions.has(part.toLowerCase())) {
      return part.toLowerCase();
    }

    // Capitaliza a primeira letra
    return part.charAt(0).toUpperCase() + part.slice(1);
  }).join('');
};

// Mapeamento específico por nome de camada para garantir a propriedade principal correta
const LAYER_PRIMARY_PROPS: Record<string, string[]> = {
  'Municipios': ['NM_MUN', 'Nome do município', 'Nome do municipio', 'MUNICIPIO', 'Municipio', 'municipio', 'NM_MUNICIP', 'Nome', 'nome'],
  'Bairros': ['NM_BAIRRO', 'Nome do bairro', 'Bairro', 'bairro', 'BAIRRO', 'Nome'],
  'Favelas e Comunidades': ['NM_FCU', 'Favela', 'favela', 'Nome da favela', 'Nome', 'nome'],
  'Localidades (Piauí)': ['Localidade', 'NM_LOCALIDA', 'NM_LOCALIDADE', 'Nome_Localidade', 'Nome', 'nome'],
  'Núcleos Urbanos': ['NM_NU', 'Núcleo Urbano', 'nucleo urbano', 'Nome', 'nome'],
  'Aglomerados Rurais': ['NM_AGLOM', 'Aglomerado', 'aglomerado', 'Nome', 'nome'],
  'Comunidades Rurais de Teresina': ['Nome', 'nome'],
  'Áreas de Desenvolvimento': ['Area de desenvolvimento', 'Área de desenvolvimento', 'Nome', 'nome'],
  'AISP': ['Aisp', 'AISP', 'aisp', 'Nome'],
  'RISP': ['Risp', 'RISP', 'risp', 'Nome']
};

// Identificar dinamicamente o nome da feição por prioridade de chaves de texto e camada
export const getIdentifier = (props: Record<string, any> | undefined, layerName?: string): string => {
  if (!props) return 'Item';

  // 1. Se foi informada a camada, prioriza as colunas específicas dela
  if (layerName && LAYER_PRIMARY_PROPS[layerName]) {
    for (const k of LAYER_PRIMARY_PROPS[layerName]) {
      if (props[k] != null && String(props[k]).trim() !== '') {
        return toTitleCase(String(props[k]));
      }
    }
  }

  // 2. Chaves prioritárias globais
  for (const k of PRIORITY_KEYS) {
    if (props[k] != null && String(props[k]).trim() !== '') {
      return toTitleCase(String(props[k]));
    }
  }
  for (const k of CODE_KEYS) {
    if (props[k] != null && String(props[k]).trim() !== '') {
      return getTranslatedValue(k, props[k]);
    }
  }
  return 'Item Territorial';
};

// Calcular centro geográfico de um polígono/ponto
export const getFeatureCenter = (layer: L.Layer | null | undefined): L.LatLng | null => {
  if (!layer) return null;
  try {
    if (typeof (layer as any).getBounds === 'function') {
      const bounds = (layer as any).getBounds();
      if (bounds && bounds.isValid()) {
        return bounds.getCenter();
      }
    } else if (typeof (layer as any).getLatLng === 'function') {
      return (layer as any).getLatLng();
    }
  } catch (e) {
    console.warn('Erro ao obter centroide da feição:', e);
  }
  return null;
};

// Download de arquivos com suporte a UTF-8 BOM
export const downloadFile = (filename: string, content: string, mimeType: string): void => {
  const blob = new Blob([content], { type: mimeType });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

// Exportar feições selecionadas para formato CSV compatível com Excel (com UTF-8 BOM)
export const exportSelectionToCSV = (filename: string, features: any[]): void => {
  if (!features || features.length === 0) {
    alert('Não há dados selecionados para exportar.');
    return;
  }
  const allKeys = new Set<string>();
  features.forEach(layer => {
    const props = layer?.feature?.properties || {};
    Object.keys(props).forEach(k => {
      const low = k.toLowerCase();
      if (low !== 'fid' && low !== 'id' && low !== 'geom' && low !== '_details') {
        allKeys.add(k);
      }
    });
  });

  const keys = Array.from(allKeys).sort();
  const headers = keys.map(k => `"${(propertyNames[k] || k).replace(/"/g, '""')}"`);
  
  // Adiciona o prefixo UTF-8 BOM (\uFEFF) para garantir abertura correta no Excel no Windows
  let csv = '\uFEFF' + headers.join(',') + '\r\n';

  features.forEach(layer => {
    const props = layer?.feature?.properties || {};
    const row = keys.map(k => {
      let v = props[k];
      if (k === 'CD_SIT' || k === 'CD_TIPO') {
        v = getTranslatedValue(k, v);
      }
      const s = (v != null) ? String(v) : '';
      return `"${s.replace(/"/g, '""')}"`;
    });
    csv += row.join(',') + '\r\n';
  });

  downloadFile(filename, csv, 'text/csv;charset=utf-8');
};

// Converter coordenadas de polígono para string KML
const coordsToStr = (coords: any[]): string => {
  if (!Array.isArray(coords)) return '';
  return coords.map(c => `${c[0]},${c[1]},0`).join(' ');
};

const polygonToKml = (coords: any[][]): string => {
  if (!Array.isArray(coords) || coords.length === 0) return '';
  let kml = `        <Polygon>\n          <outerBoundaryIs>\n            <LinearRing>\n              <coordinates>${coordsToStr(coords[0])}</coordinates>\n            </LinearRing>\n          </outerBoundaryIs>\n`;
  for (let i = 1; i < coords.length; i++) {
    kml += `          <innerBoundaryIs>\n            <LinearRing>\n              <coordinates>${coordsToStr(coords[i])}</coordinates>\n            </LinearRing>\n          </innerBoundaryIs>\n`;
  }
  kml += `        </Polygon>\n`;
  return kml;
};

// Converter feição GeoJSON para Placemark KML
export const featureToKMLPlacemark = (feature: any): string => {
  if (!feature) return '';
  const props = feature.properties || {};
  const geom = feature.geometry || {};
  const name = getIdentifier(props);

  let xml = `    <Placemark>\n      <name>${escapeXml(String(name))}</name>\n      <ExtendedData>\n`;
  for (const key in props) {
    const low = key.toLowerCase();
    if (low === 'fid' || low === 'id' || low === 'geom' || low === '_details') continue;
    let v = props[key];
    if (key === 'CD_SIT' || key === 'CD_TIPO') {
      v = getTranslatedValue(key, v);
    }
    const display = propertyNames[key] || key;
    xml += `        <Data name="${escapeXml(String(display))}"><value>${escapeXml(String(v))}</value></Data>\n`;
  }
  xml += '      </ExtendedData>\n';

  if (geom.type === 'Polygon' && Array.isArray(geom.coordinates)) {
    xml += polygonToKml(geom.coordinates);
  } else if (geom.type === 'MultiPolygon' && Array.isArray(geom.coordinates)) {
    xml += '      <MultiGeometry>\n';
    geom.coordinates.forEach((p: any) => {
      xml += polygonToKml(p);
    });
    xml += '      </MultiGeometry>\n';
  } else if (geom.type === 'LineString' && Array.isArray(geom.coordinates)) {
    xml += `      <LineString>\n        <coordinates>${coordsToStr(geom.coordinates)}</coordinates>\n      </LineString>\n`;
  } else if (geom.type === 'MultiLineString' && Array.isArray(geom.coordinates)) {
    xml += '      <MultiGeometry>\n';
    geom.coordinates.forEach((line: any) => {
      xml += `        <LineString>\n          <coordinates>${coordsToStr(line)}</coordinates>\n        </LineString>\n`;
    });
    xml += '      </MultiGeometry>\n';
  } else if (geom.type === 'Point' && Array.isArray(geom.coordinates) && geom.coordinates.length >= 2) {
    xml += `      <Point>\n        <coordinates>${geom.coordinates[0]},${geom.coordinates[1]},0</coordinates>\n      </Point>\n`;
  } else if (geom.type === 'MultiPoint' && Array.isArray(geom.coordinates)) {
    xml += '      <MultiGeometry>\n';
    geom.coordinates.forEach((pt: any) => {
      xml += `        <Point>\n          <coordinates>${pt[0]},${pt[1]},0</coordinates>\n        </Point>\n`;
    });
    xml += '      </MultiGeometry>\n';
  }

  xml += '    </Placemark>';
  return xml;
};

// Exportar feições selecionadas para formato KML do Google Earth
export const exportSelectionToKML = (filename: string, features: any[]): void => {
  if (!features || features.length === 0) {
    return;
  }
  let placemarks = '';
  features.forEach(layer => {
    if (layer?.feature) {
      placemarks += featureToKMLPlacemark(layer.feature) + '\n';
    }
  });

  const fullKML = `<?xml version="1.0" encoding="UTF-8"?>\n<kml xmlns="http://www.opengis.net/kml/2.2">\n  <Document>\n${placemarks}  </Document>\n</kml>`;
  downloadFile(filename, fullKML, 'application/vnd.google-earth.kml+xml');
};

export function patchMeasureControl() {
  if (L.Control && (L.Control as any).Measure) {
    const MeasureControl = (L.Control as any).Measure;
    
    if (!MeasureControl.prototype._patchedForHistory) {
      MeasureControl.prototype._patchedForHistory = true;
      
      const originalHandleMeasureClick = MeasureControl.prototype._handleMeasureClick;
      MeasureControl.prototype._handleMeasureClick = function(evt: any) {
        if (typeof originalHandleMeasureClick === 'function') {
          originalHandleMeasureClick.call(this, evt);
        }
        if (this._map) {
          this._map.fire('measurechange', { latlngs: Array.isArray(this._latlngs) ? [...this._latlngs] : [] });
        }
      };

      const originalStartMeasure = MeasureControl.prototype._startMeasure;
      MeasureControl.prototype._startMeasure = function() {
        originalStartMeasure.call(this);
        this._map.fire('measurechange', { latlngs: [] });
      };
      
      const originalClearMeasure = MeasureControl.prototype._clearMeasure;
      MeasureControl.prototype._clearMeasure = function() {
        originalClearMeasure.call(this);
        this._map.fire('measurechange', { latlngs: null });
      };

      MeasureControl.prototype.removePoint = function(index: number) {
        if (!this._latlngs || index < 0 || index >= this._latlngs.length) return;
        this._latlngs.splice(index, 1);
        
        if (this._measureArea) {
          this._layer.removeLayer(this._measureArea);
          this._measureArea = null;
        }
        if (this._measureBoundary) {
          this._layer.removeLayer(this._measureBoundary);
          this._measureBoundary = null;
        }
        this._measureVertexes.clearLayers();
        
        if (this._latlngs.length > 0) {
          this._addMeasureArea(this._latlngs);
          this._addMeasureBoundary(this._latlngs);
          
          const vertexSymbol = this._symbols.getSymbol('measureVertex');
          for (let i = 0; i < this._latlngs.length; i++) {
             this._addNewVertex(this._latlngs[i]);
          }
          const layers = this._measureVertexes.getLayers();
          for (let i = 0; i < layers.length - 1; i++) {
             layers[i].setStyle(vertexSymbol);
             if (layers[i]._path) layers[i]._path.setAttribute('class', vertexSymbol.className);
          }
          
          if (this._measureBoundary) this._measureBoundary.bringToFront();
          this._measureVertexes.bringToFront();
          
          this._updateResults();
          this._updateMeasureStartedWithPoints();
        } else {
          this._updateMeasureStartedNoPoints();
          this._resultsModel = null;
          this.$results.innerHTML = '';
        }
        
        this._map.fire('measurechange', { latlngs: [...this._latlngs] });
      };
    }
  }
}

// Distância Haversine em metros entre dois pontos (lat1, lon1) e (lat2, lon2)
export const haversineDistanceMeters = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

// Formatar distância em metros/km legível
export const formatDistance = (meters: number): string => {
  if (meters === 0) return 'No ponto exato (0 m)';
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 2 })} km`;
};
