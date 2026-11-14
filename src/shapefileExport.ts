import { zipSync, strToU8 } from 'fflate';
import { downloadFile, sanitizeFilename } from './utils';

function normalizeFeature(f: any): any {
  if (!f) return null;
  if (typeof f.toGeoJSON === 'function') return f.toGeoJSON();
  if (f.layer && typeof f.layer.toGeoJSON === 'function') return f.layer.toGeoJSON();
  if (f.feature) return f.feature;
  if (f.geometry) return f;
  return null;
}

interface BBox {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

function computeBBox(points: Array<[number, number]>): BBox {
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const pt of points) {
    if (pt[0] < minX) minX = pt[0];
    if (pt[0] > maxX) maxX = pt[0];
    if (pt[1] < minY) minY = pt[1];
    if (pt[1] > maxY) maxY = pt[1];
  }
  if (minX === Infinity) minX = maxX = minY = maxY = 0;
  return { minX, maxX, minY, maxY };
}

export async function exportToShapefile(
  filename: string,
  rawFeatures: any[],
  layerName: string = 'feicoes'
): Promise<void> {
  const features = rawFeatures.map(normalizeFeature).filter(Boolean);
  if (features.length === 0) {
    throw new Error('Nenhuma feição válida para exportar em Shapefile.');
  }

  const safeLayer = sanitizeFilename(layerName).replace(/[^a-zA-Z0-9_]/g, '_') || 'camada';

  // Determinar se é Point ou Polygon
  let isPoint = false;
  let isPolygon = false;

  for (const f of features) {
    const t = f.geometry?.type?.toLowerCase();
    if (t === 'point' || t === 'multipoint') isPoint = true;
    if (t === 'polygon' || t === 'multipolygon') isPolygon = true;
  }

  if (isPoint && isPolygon) {
    throw new Error('Shapefile não suporta mistura de pontos e polígonos no mesmo arquivo.');
  }

  const shapeType = isPoint ? 1 : 5; // 1 = Point, 5 = Polygon

  // Coletar campos da tabela de atributos (limitados a 10 caracteres no DBF)
  const originalKeys = new Set<string>();
  features.forEach((f: any) => {
    const props = f.properties || {};
    Object.keys(props).forEach(k => {
      const low = k.toLowerCase();
      if (low === 'id' || low === 'geom' || low.startsWith('_')) return;
      originalKeys.add(k);
    });
  });

  const fieldList: Array<{ original: string; dbfName: string; length: number }> = [];
  const usedDbfNames = new Set<string>();

  Array.from(originalKeys).sort().forEach(orig => {
    let clean = orig.trim().replace(/[^a-zA-Z0-9_]/g, '_').substring(0, 10).toUpperCase();
    if (!clean) clean = 'FIELD';
    let candidate = clean;
    let counter = 1;
    while (usedDbfNames.has(candidate)) {
      const suffix = String(counter);
      candidate = clean.substring(0, 10 - suffix.length) + suffix;
      counter++;
    }
    usedDbfNames.add(candidate);
    fieldList.push({ original: orig, dbfName: candidate, length: 254 });
  });

  // Bounding box global
  let globalMinX = Infinity, globalMaxX = -Infinity, globalMinY = Infinity, globalMaxY = -Infinity;

  // Processar geometrias para o formato Shapefile
  interface ShpRecord {
    shapeType: number;
    bbox?: BBox;
    parts?: number[];
    points: Array<[number, number]>;
    contentLengthWords: number;
  }

  const records: ShpRecord[] = [];

  for (const f of features) {
    const geom = f.geometry;
    if (!geom) {
      records.push({ shapeType: 0, points: [], contentLengthWords: 2 });
      continue;
    }

    if (shapeType === 1) {
      // Point
      const coords = geom.coordinates || [0, 0];
      const x = Number(coords[0] || 0);
      const y = Number(coords[1] || 0);
      if (x < globalMinX) globalMinX = x;
      if (x > globalMaxX) globalMaxX = x;
      if (y < globalMinY) globalMinY = y;
      if (y > globalMaxY) globalMaxY = y;

      records.push({
        shapeType: 1,
        points: [[x, y]],
        contentLengthWords: 10 // (4 bytes type + 16 bytes x,y) / 2
      });
    } else {
      // Polygon / MultiPolygon
      const allRings: Array<Array<[number, number]>> = [];
      if (geom.type === 'Polygon' && Array.isArray(geom.coordinates)) {
        geom.coordinates.forEach((ring: any[]) => {
          if (Array.isArray(ring)) {
            const pts: Array<[number, number]> = ring.map((pt: any) => [Number(pt[0]), Number(pt[1])]);
            // Garantir anel fechado
            if (pts.length > 0) {
              const first = pts[0];
              const last = pts[pts.length - 1];
              if (first[0] !== last[0] || first[1] !== last[1]) {
                pts.push([first[0], first[1]]);
              }
              allRings.push(pts);
            }
          }
        });
      } else if (geom.type === 'MultiPolygon' && Array.isArray(geom.coordinates)) {
        geom.coordinates.forEach((poly: any[]) => {
          if (Array.isArray(poly)) {
            poly.forEach((ring: any[]) => {
              if (Array.isArray(ring)) {
                const pts: Array<[number, number]> = ring.map((pt: any) => [Number(pt[0]), Number(pt[1])]);
                if (pts.length > 0) {
                  const first = pts[0];
                  const last = pts[pts.length - 1];
                  if (first[0] !== last[0] || first[1] !== last[1]) {
                    pts.push([first[0], first[1]]);
                  }
                  allRings.push(pts);
                }
              }
            });
          }
        });
      }

      const flatPoints: Array<[number, number]> = [];
      const parts: number[] = [];
      for (const ring of allRings) {
        parts.push(flatPoints.length);
        for (const pt of ring) {
          flatPoints.push(pt);
          if (pt[0] < globalMinX) globalMinX = pt[0];
          if (pt[0] > globalMaxX) globalMaxX = pt[0];
          if (pt[1] < globalMinY) globalMinY = pt[1];
          if (pt[1] > globalMaxY) globalMaxY = pt[1];
        }
      }

      const recBBox = computeBBox(flatPoints);
      // Byte length: 4 (type) + 32 (box) + 4 (numParts) + 4 (numPoints) + (parts.length * 4) + (flatPoints.length * 16)
      const contentBytes = 44 + (parts.length * 4) + (flatPoints.length * 16);
      records.push({
        shapeType: 5,
        bbox: recBBox,
        parts,
        points: flatPoints,
        contentLengthWords: contentBytes / 2
      });
    }
  }

  if (globalMinX === Infinity) {
    globalMinX = globalMaxX = globalMinY = globalMaxY = 0;
  }

  // --- 1. CONSTRUÇÃO DO ARQUIVO .SHP ---
  let totalContentWords = 50; // cabeçalho de 100 bytes = 50 palavras
  records.forEach(r => {
    totalContentWords += 4 + r.contentLengthWords; // 4 palavras de cabeçalho de registro + conteúdo
  });

  const shpBuf = new ArrayBuffer(totalContentWords * 2);
  const shpView = new DataView(shpBuf);
  // Cabeçalho de 100 bytes
  shpView.setUint32(0, 9994, false); // File Code (Big Endian)
  shpView.setUint32(24, totalContentWords, false); // File Length (Big Endian)
  shpView.setUint32(28, 1000, true); // Version 1000 (Little Endian)
  shpView.setUint32(32, shapeType, true); // Shape Type (Little Endian)
  shpView.setFloat64(36, globalMinX, true);
  shpView.setFloat64(44, globalMinY, true);
  shpView.setFloat64(52, globalMaxX, true);
  shpView.setFloat64(60, globalMaxY, true);

  // --- 2. CONSTRUÇÃO DO ARQUIVO .SHX ---
  const shxWords = 50 + records.length * 4;
  const shxBuf = new ArrayBuffer(shxWords * 2);
  const shxView = new DataView(shxBuf);
  shxView.setUint32(0, 9994, false);
  shxView.setUint32(24, shxWords, false);
  shxView.setUint32(28, 1000, true);
  shxView.setUint32(32, shapeType, true);
  shxView.setFloat64(36, globalMinX, true);
  shxView.setFloat64(44, globalMinY, true);
  shxView.setFloat64(52, globalMaxX, true);
  shxView.setFloat64(60, globalMaxY, true);

  let currentWordOffset = 50;
  let shpByteOffset = 100;

  records.forEach((rec, idx) => {
    // SHX index record
    shxView.setUint32(100 + idx * 8, currentWordOffset, false);
    shxView.setUint32(100 + idx * 8 + 4, rec.contentLengthWords, false);

    // SHP record header
    shpView.setUint32(shpByteOffset, idx + 1, false); // 1-based record number
    shpView.setUint32(shpByteOffset + 4, rec.contentLengthWords, false);
    shpByteOffset += 8;

    if (rec.shapeType === 1) {
      // Point
      shpView.setUint32(shpByteOffset, 1, true);
      shpView.setFloat64(shpByteOffset + 4, rec.points[0][0], true);
      shpView.setFloat64(shpByteOffset + 12, rec.points[0][1], true);
      shpByteOffset += 20;
    } else if (rec.shapeType === 5) {
      // Polygon
      shpView.setUint32(shpByteOffset, 5, true);
      const b = rec.bbox || { minX: 0, maxX: 0, minY: 0, maxY: 0 };
      shpView.setFloat64(shpByteOffset + 4, b.minX, true);
      shpView.setFloat64(shpByteOffset + 12, b.minY, true);
      shpView.setFloat64(shpByteOffset + 20, b.maxX, true);
      shpView.setFloat64(shpByteOffset + 28, b.maxY, true);
      const numParts = rec.parts ? rec.parts.length : 0;
      const numPoints = rec.points.length;
      shpView.setUint32(shpByteOffset + 36, numParts, true);
      shpView.setUint32(shpByteOffset + 40, numPoints, true);
      shpByteOffset += 44;

      if (rec.parts) {
        for (const p of rec.parts) {
          shpView.setUint32(shpByteOffset, p, true);
          shpByteOffset += 4;
        }
      }

      for (const pt of rec.points) {
        shpView.setFloat64(shpByteOffset, pt[0], true);
        shpView.setFloat64(shpByteOffset + 8, pt[1], true);
        shpByteOffset += 16;
      }
    } else {
      // Null shape
      shpView.setUint32(shpByteOffset, 0, true);
      shpByteOffset += 4;
    }

    currentWordOffset += 4 + rec.contentLengthWords;
  });

  // --- 3. CONSTRUÇÃO DO ARQUIVO .DBF (dBASE III) ---
  const encoder = new TextEncoder();
  const numRecords = features.length;
  const headerLength = 32 + fieldList.length * 32 + 1;
  const recordLength = 1 + fieldList.reduce((acc, f) => acc + f.length, 0); // 1 byte delete flag + soma dos campos
  const dbfTotalLength = headerLength + numRecords * recordLength + 1; // + 1 byte EOF (0x1A)

  const dbfBuf = new ArrayBuffer(dbfTotalLength);
  const dbfView = new DataView(dbfBuf);
  const dbfU8 = new Uint8Array(dbfBuf);

  // Cabeçalho DBF
  dbfView.setUint8(0, 0x03); // dBASE III sem memo
  const now = new Date();
  dbfView.setUint8(1, now.getFullYear() - 1900);
  dbfView.setUint8(2, now.getMonth() + 1);
  dbfView.setUint8(3, now.getDate());
  dbfView.setUint32(4, numRecords, true);
  dbfView.setUint16(8, headerLength, true);
  dbfView.setUint16(10, recordLength, true);

  // Descritores de campo
  fieldList.forEach((field, fIdx) => {
    const fOffset = 32 + fIdx * 32;
    const nameBytes = encoder.encode(field.dbfName);
    for (let i = 0; i < 11; i++) {
      dbfView.setUint8(fOffset + i, i < nameBytes.length ? nameBytes[i] : 0);
    }
    dbfView.setUint8(fOffset + 11, 0x43); // 'C' (Character)
    dbfView.setUint8(fOffset + 16, field.length); // 254 bytes
  });

  dbfView.setUint8(headerLength - 1, 0x0D); // Header terminator

  // Registros de dados
  let dbfRecordOffset = headerLength;
  features.forEach((feat: any) => {
    dbfView.setUint8(dbfRecordOffset, 0x20); // 0x20 = registro ativo (não deletado)
    let fieldColOffset = dbfRecordOffset + 1;

    const props = feat.properties || {};
    fieldList.forEach(field => {
      const val = props[field.original];
      const valStr = (val !== null && val !== undefined) ? String(val) : '';
      const valBytes = encoder.encode(valStr);

      for (let c = 0; c < field.length; c++) {
        dbfView.setUint8(fieldColOffset + c, c < valBytes.length ? valBytes[c] : 0x20); // preenche com espaços
      }
      fieldColOffset += field.length;
    });

    dbfRecordOffset += recordLength;
  });

  dbfView.setUint8(dbfTotalLength - 1, 0x1A); // EOF

  // --- 4. ARQUIVOS PRJ E CPG ---
  const prjContent = 'GEOGCS["GCS_WGS_1984",DATUM["D_WGS_1984",SPHEROID["WGS_1984",6378137.0,298.257223563]],PRIMEM["Greenwich",0.0],UNIT["Degree",0.0174532925199433]]';
  const cpgContent = 'UTF-8';

  // --- 5. COMPACTAÇÃO EM ARQUIVO .ZIP ---
  const zipFiles: Record<string, Uint8Array> = {};
  zipFiles[`${safeLayer}.shp`] = new Uint8Array(shpBuf);
  zipFiles[`${safeLayer}.shx`] = new Uint8Array(shxBuf);
  zipFiles[`${safeLayer}.dbf`] = dbfU8;
  zipFiles[`${safeLayer}.prj`] = strToU8(prjContent);
  zipFiles[`${safeLayer}.cpg`] = strToU8(cpgContent);

  const zipData = zipSync(zipFiles);
  downloadFile(filename, zipData, 'application/zip');
}
