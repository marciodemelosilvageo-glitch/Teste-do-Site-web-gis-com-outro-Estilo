import initSqlJs from 'sql.js';
import sqlWasmUrl from 'sql.js/dist/sql-wasm.wasm?url';
import { downloadFile, sanitizeFilename } from './utils';

let sqlInstancePromise: Promise<any> | null = null;

async function getSqlInstance() {
  if (!sqlInstancePromise) {
    sqlInstancePromise = initSqlJs({
      locateFile: () => sqlWasmUrl
    });
  }
  return sqlInstancePromise;
}

function normalizeFeature(f: any): any {
  if (!f) return null;
  if (typeof f.toGeoJSON === 'function') return f.toGeoJSON();
  if (f.layer && typeof f.layer.toGeoJSON === 'function') return f.layer.toGeoJSON();
  if (f.feature) return f.feature;
  if (f.geometry) return f;
  return null;
}

function getEnvelope(geom: any): { minX: number; maxX: number; minY: number; maxY: number } {
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  function visit(c: any) {
    if (!c) return;
    if (typeof c[0] === 'number') {
      const x = Number(c[0]);
      const y = Number(c[1]);
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    } else if (Array.isArray(c)) {
      c.forEach(visit);
    }
  }
  if (geom && geom.coordinates) {
    visit(geom.coordinates);
  }
  if (minX === Infinity) {
    minX = maxX = minY = maxY = 0;
  }
  return { minX, maxX, minY, maxY };
}

function writeWKB(geom: any): Uint8Array {
  const type = geom?.type;
  const coords = geom?.coordinates || [];

  if (type === 'Point') {
    const buf = new ArrayBuffer(21);
    const view = new DataView(buf);
    view.setUint8(0, 1); // Little endian
    view.setUint32(1, 1, true); // Point
    view.setFloat64(5, Number(coords[0] || 0), true);
    view.setFloat64(13, Number(coords[1] || 0), true);
    return new Uint8Array(buf);
  }

  if (type === 'MultiPoint') {
    const count = coords.length;
    const buf = new ArrayBuffer(9 + count * 21);
    const view = new DataView(buf);
    view.setUint8(0, 1);
    view.setUint32(1, 4, true); // MultiPoint
    view.setUint32(5, count, true);
    let offset = 9;
    for (let i = 0; i < count; i++) {
      view.setUint8(offset, 1);
      view.setUint32(offset + 1, 1, true);
      view.setFloat64(offset + 5, Number(coords[i][0] || 0), true);
      view.setFloat64(offset + 13, Number(coords[i][1] || 0), true);
      offset += 21;
    }
    return new Uint8Array(buf);
  }

  if (type === 'LineString') {
    const count = coords.length;
    const buf = new ArrayBuffer(9 + count * 16);
    const view = new DataView(buf);
    view.setUint8(0, 1);
    view.setUint32(1, 2, true); // LineString
    view.setUint32(5, count, true);
    let offset = 9;
    for (let i = 0; i < count; i++) {
      view.setFloat64(offset, Number(coords[i][0] || 0), true);
      view.setFloat64(offset + 8, Number(coords[i][1] || 0), true);
      offset += 16;
    }
    return new Uint8Array(buf);
  }

  if (type === 'MultiLineString') {
    const numLines = coords.length;
    let size = 9;
    for (let i = 0; i < numLines; i++) {
      size += 9 + coords[i].length * 16;
    }
    const buf = new ArrayBuffer(size);
    const view = new DataView(buf);
    view.setUint8(0, 1);
    view.setUint32(1, 5, true); // MultiLineString
    view.setUint32(5, numLines, true);
    let offset = 9;
    for (let i = 0; i < numLines; i++) {
      const line = coords[i];
      view.setUint8(offset, 1);
      view.setUint32(offset + 1, 2, true);
      view.setUint32(offset + 5, line.length, true);
      offset += 9;
      for (let j = 0; j < line.length; j++) {
        view.setFloat64(offset, Number(line[j][0] || 0), true);
        view.setFloat64(offset + 8, Number(line[j][1] || 0), true);
        offset += 16;
      }
    }
    return new Uint8Array(buf);
  }

  if (type === 'Polygon') {
    const numRings = coords.length;
    let totalPoints = 0;
    for (let r = 0; r < numRings; r++) {
      totalPoints += coords[r].length;
    }
    const buf = new ArrayBuffer(9 + numRings * 4 + totalPoints * 16);
    const view = new DataView(buf);
    view.setUint8(0, 1);
    view.setUint32(1, 3, true); // Polygon
    view.setUint32(5, numRings, true);
    let offset = 9;
    for (let r = 0; r < numRings; r++) {
      const ring = coords[r];
      view.setUint32(offset, ring.length, true);
      offset += 4;
      for (let p = 0; p < ring.length; p++) {
        view.setFloat64(offset, Number(ring[p][0] || 0), true);
        view.setFloat64(offset + 8, Number(ring[p][1] || 0), true);
        offset += 16;
      }
    }
    return new Uint8Array(buf);
  }

  if (type === 'MultiPolygon') {
    const numPolys = coords.length;
    let size = 9;
    for (let i = 0; i < numPolys; i++) {
      const poly = coords[i];
      size += 9;
      for (let r = 0; r < poly.length; r++) {
        size += 4 + poly[r].length * 16;
      }
    }
    const buf = new ArrayBuffer(size);
    const view = new DataView(buf);
    view.setUint8(0, 1);
    view.setUint32(1, 6, true); // MultiPolygon
    view.setUint32(5, numPolys, true);
    let offset = 9;
    for (let i = 0; i < numPolys; i++) {
      const poly = coords[i];
      view.setUint8(offset, 1);
      view.setUint32(offset + 1, 3, true);
      view.setUint32(offset + 5, poly.length, true);
      offset += 9;
      for (let r = 0; r < poly.length; r++) {
        const ring = poly[r];
        view.setUint32(offset, ring.length, true);
        offset += 4;
        for (let p = 0; p < ring.length; p++) {
          view.setFloat64(offset, Number(ring[p][0] || 0), true);
          view.setFloat64(offset + 8, Number(ring[p][1] || 0), true);
          offset += 16;
        }
      }
    }
    return new Uint8Array(buf);
  }

  // Fallback para geometria desconhecida
  return new Uint8Array([1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
}

function toGeoPackageBinary(geom: any): Uint8Array {
  const wkb = writeWKB(geom);
  const env = getEnvelope(geom);
  // OGC GeoPackage binary header (40 bytes com envelope de 32 bytes)
  const buf = new ArrayBuffer(40 + wkb.byteLength);
  const view = new DataView(buf);
  view.setUint8(0, 0x47); // 'G'
  view.setUint8(1, 0x50); // 'P'
  view.setUint8(2, 0);    // version 0
  view.setUint8(3, 0x03); // flags: little endian (bit 0=1), envelope 32 bytes (bits 1-3=1 -> 1<<1=2 -> 0x03)
  view.setUint32(4, 4326, true); // srs_id = 4326 (WGS 84)
  view.setFloat64(8, env.minX, true);
  view.setFloat64(16, env.maxX, true);
  view.setFloat64(24, env.minY, true);
  view.setFloat64(32, env.maxY, true);

  const u8 = new Uint8Array(buf);
  u8.set(wkb, 40);
  return u8;
}

export async function exportToGeoPackage(
  filename: string,
  rawFeatures: any[],
  layerName: string = 'feicoes'
): Promise<void> {
  const features = rawFeatures.map(normalizeFeature).filter(Boolean);
  if (features.length === 0) {
    throw new Error('Nenhuma feição válida para exportar em GeoPackage.');
  }

  const SQL = await getSqlInstance();
  const db = new SQL.Database();

  // 1. Metadados do banco SQLite e GeoPackage 1.3
  db.run("PRAGMA application_id = 1196444487; PRAGMA user_version = 10300;");

  // 2. Tabela OGC de SRS (Sistema de Referência Espacial - EPSG:4326)
  db.run(`CREATE TABLE gpkg_spatial_ref_sys (
    srs_name TEXT NOT NULL,
    srs_id INTEGER NOT NULL PRIMARY KEY,
    organization TEXT NOT NULL,
    organization_coordsys_id INTEGER NOT NULL,
    definition TEXT NOT NULL,
    description TEXT
  );`);

  db.run(`INSERT INTO gpkg_spatial_ref_sys VALUES 
    ('WGS 84 geodetic', 4326, 'EPSG', 4326, 'GEOGCS["WGS 84",DATUM["WGS_1984",SPHEROID["WGS 84",6378137,298.257223563,AUTHORITY["EPSG","7030"]],AUTHORITY["EPSG","6326"]],PRIMEM["Greenwich",0,AUTHORITY["EPSG","8901"]],UNIT["degree",0.0174532925199433,AUTHORITY["EPSG","9122"]],AXIS["Latitude",NORTH],AXIS["Longitude",EAST],AUTHORITY["EPSG","4326"]]', 'WGS 84 geodetic'),
    ('Undefined cartesian SRS', -1, 'NONE', -1, 'undefined', 'undefined cartesian coordinate reference system'),
    ('Undefined geographic SRS', 0, 'NONE', 0, 'undefined', 'undefined geographic coordinate reference system');`);

  // 3. Tabela OGC gpkg_contents
  db.run(`CREATE TABLE gpkg_contents (
    table_name TEXT NOT NULL PRIMARY KEY,
    data_type TEXT NOT NULL,
    identifier TEXT UNIQUE,
    description TEXT DEFAULT '',
    last_change DATETIME NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    min_x DOUBLE,
    min_y DOUBLE,
    max_x DOUBLE,
    max_y DOUBLE,
    srs_id INTEGER,
    CONSTRAINT fk_gc_r_srs_id FOREIGN KEY (srs_id) REFERENCES gpkg_spatial_ref_sys(srs_id)
  );`);

  // 4. Tabela OGC gpkg_geometry_columns
  db.run(`CREATE TABLE gpkg_geometry_columns (
    table_name TEXT NOT NULL,
    column_name TEXT NOT NULL,
    geometry_type_name TEXT NOT NULL,
    srs_id INTEGER NOT NULL,
    z TINYINT NOT NULL,
    m TINYINT NOT NULL,
    CONSTRAINT pk_geom_cols PRIMARY KEY (table_name, column_name),
    CONSTRAINT fk_gc_tn FOREIGN KEY (table_name) REFERENCES gpkg_contents(table_name),
    CONSTRAINT fk_gc_srs FOREIGN KEY (srs_id) REFERENCES gpkg_spatial_ref_sys(srs_id)
  );`);

  // 5. Determinar tipo de geometria e envelope geral
  let globalMinX = Infinity, globalMaxX = -Infinity, globalMinY = Infinity, globalMaxY = -Infinity;
  const geomTypes = new Set<string>();

  features.forEach((f: any) => {
    if (f.geometry) {
      geomTypes.add(f.geometry.type || 'GEOMETRY');
      const env = getEnvelope(f.geometry);
      if (env.minX < globalMinX) globalMinX = env.minX;
      if (env.maxX > globalMaxX) globalMaxX = env.maxX;
      if (env.minY < globalMinY) globalMinY = env.minY;
      if (env.maxY > globalMaxY) globalMaxY = env.maxY;
    }
  });

  if (globalMinX === Infinity) {
    globalMinX = globalMaxX = globalMinY = globalMaxY = 0;
  }

  let geomTypeName = 'GEOMETRY';
  if (geomTypes.size === 1) {
    geomTypeName = Array.from(geomTypes)[0].toUpperCase();
  }

  // 6. Extrair e sanitizar colunas de atributos
  const safeTableName = sanitizeFilename(layerName).replace(/[^a-zA-Z0-9_]/g, '_') || 'feicoes';
  const attrKeyMap = new Map<string, string>(); // originalKey -> safeSqlKey
  const attrColTypes = new Map<string, string>(); // safeSqlKey -> 'INTEGER' | 'REAL' | 'TEXT'

  features.forEach((f: any) => {
    const props = f.properties || {};
    Object.keys(props).forEach(k => {
      const lower = k.toLowerCase();
      if (lower === 'id' || lower === 'geom' || lower.startsWith('_')) return;
      if (!attrKeyMap.has(k)) {
        let safeCol = k.replace(/[^a-zA-Z0-9_]/g, '_');
        if (/^[0-9]/.test(safeCol)) safeCol = `col_${safeCol}`;
        if (safeCol.toLowerCase() === 'id' || safeCol.toLowerCase() === 'geom') safeCol = `attr_${safeCol}`;
        attrKeyMap.set(k, safeCol);
        attrColTypes.set(safeCol, 'TEXT');
      }
    });
  });

  // 7. Criar tabela da camada
  const colDefs = ['id INTEGER PRIMARY KEY AUTOINCREMENT', 'geom BLOB'];
  attrKeyMap.forEach((safeCol) => {
    colDefs.push(`"${safeCol}" TEXT`);
  });

  db.run(`CREATE TABLE "${safeTableName}" (${colDefs.join(', ')});`);

  // 8. Registrar na tabela gpkg_contents e gpkg_geometry_columns
  db.run(`INSERT INTO gpkg_contents (table_name, data_type, identifier, description, last_change, min_x, min_y, max_x, max_y, srs_id)
    VALUES (?, 'features', ?, '', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), ?, ?, ?, ?, 4326);`,
    [safeTableName, safeTableName, globalMinX, globalMinY, globalMaxX, globalMaxY]
  );

  db.run(`INSERT INTO gpkg_geometry_columns (table_name, column_name, geometry_type_name, srs_id, z, m)
    VALUES (?, 'geom', ?, 4326, 0, 0);`,
    [safeTableName, geomTypeName]
  );

  // 9. Inserir dados com transação
  db.run('BEGIN TRANSACTION;');
  const sqlCols = ['geom', ...Array.from(attrKeyMap.values()).map(c => `"${c}"`)];
  const placeholders = sqlCols.map(() => '?').join(', ');
  const insertStmt = db.prepare(`INSERT INTO "${safeTableName}" (${sqlCols.join(', ')}) VALUES (${placeholders});`);

  try {
    for (const f of features) {
      const geomBlob = f.geometry ? toGeoPackageBinary(f.geometry) : null;
      const props = f.properties || {};
      const rowValues: any[] = [geomBlob];

      attrKeyMap.forEach((_, origKey) => {
        const val = props[origKey];
        if (val === undefined || val === null) {
          rowValues.push(null);
        } else if (typeof val === 'object') {
          rowValues.push(JSON.stringify(val));
        } else {
          rowValues.push(String(val));
        }
      });

      insertStmt.run(rowValues);
    }
    db.run('COMMIT;');
  } catch (err) {
    db.run('ROLLBACK;');
    throw err;
  } finally {
    insertStmt.free();
  }

  // 10. Exportar binário SQLite e disparar download
  const gpkgBytes = db.export();
  db.close();

  downloadFile(filename, gpkgBytes, 'application/geopackage+sqlite3');
}
