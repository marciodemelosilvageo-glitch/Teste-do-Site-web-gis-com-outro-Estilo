import * as duckdb from '@duckdb/duckdb-wasm';
import duckdb_wasm_eh from '@duckdb/duckdb-wasm/dist/duckdb-eh.wasm?url';
import duckdb_worker_eh from '@duckdb/duckdb-wasm/dist/duckdb-browser-eh.worker.js?url';
import duckdb_wasm_mvp from '@duckdb/duckdb-wasm/dist/duckdb-mvp.wasm?url';
import duckdb_worker_mvp from '@duckdb/duckdb-wasm/dist/duckdb-browser-mvp.worker.js?url';
import booleanPointInPolygon from '@turf/boolean-point-in-polygon';
import { point } from '@turf/helpers';
import {
  normalizeString,
  normalizeSearchText,
  parseAddressForSort,
  haversineDistanceMeters,
  formatDistance,
  escapeSqlLiteral,
  escapeSqlLikePattern
} from './utils';

// Bundles locais empacotados pelo Vite (dispensam importScripts de CDN externa e cumprem CSP estrita 'self')
const LOCAL_DUCKDB_BUNDLES: duckdb.DuckDBBundles = {
  mvp: {
    mainModule: duckdb_wasm_mvp,
    mainWorker: duckdb_worker_mvp,
  },
  eh: {
    mainModule: duckdb_wasm_eh,
    mainWorker: duckdb_worker_eh,
  },
};

let dbInstance: duckdb.AsyncDuckDB | null = null;
let initPromise: Promise<duckdb.AsyncDuckDB> | null = null;

// Re-exporta sanitização SQL de utils
export { escapeSqlLiteral, escapeSqlLikePattern };

export async function getDuckDB(): Promise<duckdb.AsyncDuckDB> {
  if (dbInstance) return dbInstance;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    try {
      const bundle = await duckdb.selectBundle(LOCAL_DUCKDB_BUNDLES);

      let worker: Worker;
      try {
        worker = new Worker(bundle.mainWorker!);
      } catch {
        const workerResp = await fetch(bundle.mainWorker!);
        const workerBlob = await workerResp.blob();
        const blobUrl = URL.createObjectURL(workerBlob);
        worker = new Worker(blobUrl);
      }

      const logger = new duckdb.VoidLogger();
      const db = new duckdb.AsyncDuckDB(logger, worker);

      await db.instantiate(bundle.mainModule, bundle.pthreadWorker);

      const conn = await db.connect();
      
      try {
        await conn.query(`
          CREATE VIEW IF NOT EXISTS enderecos AS 
          SELECT 
            "Código único do endereço" AS codigo_unico,
            CASE "Nome do município" 
              WHEN '2202703' THEN 'Cocal'
              WHEN '2205953' THEN 'Marcolândia'
              ELSE "Nome do município"
            END AS municipio,
            "Nome do subdistrito" AS subdistrito,
            "Código do setor" AS codigo_setor,
            "Endereco" AS endereco,
            "Complemento" AS complemento,
            "CEP" AS cep,
            "Localidade" AS localidade,
            "Número no logradouro" AS numero_logradouro,
            "LATITUDE" AS latitude,
            "LONGITUDE" AS longitude,
            "Identificação do estabelecimento" AS estabelecimento,
            
            "Espécie de endereço" AS especie,
            "Indicador de estabelecimento" AS ind_estabelecimento,
            "Indicador de construção ou reforma" AS ind_construcao_reforma,
            "Indicador de finalidade de construção" AS ind_finalidade_construcao,
            "Tipo da edificação dos domicílios" AS tipo_edificacao,
            "Bairro" AS bairro,
            "Nucleo Urbano" AS nucleo_urbano,
            "Favelas ou Comunidades Urbana" AS favela_comunidade,
            "Agromerado" AS agromerado,
            "Comunidades Rurais de Teresina" AS comunidade_rural
          FROM 'https://pub-2bd417d213f04fae9ffd18d26ad95d5b.r2.dev/Coordenadas%20total.parquet'
        `);
      } catch (viewErr) {
        console.error("Erro ao criar view enderecos:", viewErr);
      } finally {
        await conn.close();
      }

      dbInstance = db;
      return db;
    } catch (err) {
      // Em caso de falha de conexão, reseta a promessa para permitir novas tentativas
      initPromise = null;
      dbInstance = null;
      console.error("Erro crítico na inicialização do DuckDB-WASM:", err);
      throw err;
    }
  })();

  return initPromise;
}

export const COLUNAS_BUSCA_SIMPLES = [
  'endereco', 'numero_logradouro', 'complemento', 'bairro', 'localidade', 'cep',
  'estabelecimento', 'municipio', 'nucleo_urbano', 'favela_comunidade', 'agromerado', 'comunidade_rural'
];

export const COLUNAS_BUSCA_AVANCADA = [
  ...COLUNAS_BUSCA_SIMPLES,
  'subdistrito', 'codigo_unico', 'codigo_setor', 'especie', 'ind_estabelecimento'
];

export async function listarMunicipios(): Promise<string[]> {
  let conn: duckdb.AsyncDuckDBConnection | null = null;
  try {
    const db = await getDuckDB();
    conn = await db.connect();
    const result = await conn.query(`
      SELECT DISTINCT municipio 
      FROM enderecos 
      WHERE municipio IS NOT NULL AND trim(municipio) != ''
      ORDER BY municipio ASC
    `);
    const rows = result.toArray();
    return rows
      .map(r => r.municipio)
      .filter((m): m is string => typeof m === 'string' && m.trim().length > 0);
  } catch (e) {
    console.error("Erro ao listar municípios no DuckDB:", e);
    return [];
  } finally {
    if (conn) await conn.close();
  }
}

export const COMPLEMENT_SYNONYMS: Record<string, string> = {
  qd: 'quadra',
  qdr: 'quadra',
  cs: 'casa',
  lt: 'lote',
  bl: 'bloco',
  blc: 'bloco',
  ap: 'apartamento',
  apto: 'apartamento',
  apart: 'apartamento',
  sl: 'sala',
  lj: 'loja',
  cj: 'conjunto',
  conj: 'conjunto',
  ed: 'edificio',
  edif: 'edificio',
  fundos: 'fundos',
  andar: 'andar',
  lado: 'lado'
};

export const COMPLEMENT_WORDS = new Set([
  'quadra', 'casa', 'lote', 'bloco', 'apartamento', 'sala', 'andar',
  'loja', 'conjunto', 'edificio', 'fundos', 'lado',
  'qd', 'qdr', 'cs', 'lt', 'bl', 'blc', 'ap', 'apto', 'apart', 'sl', 'lj', 'cj', 'conj', 'ed', 'edif'
]);

function canonicalizeComplementWord(w: string): string {
  return COMPLEMENT_SYNONYMS[w] || w;
}

export function extractComplementAndTerms(inputText: string): {
  cleanedText: string;
  complementTokens: Array<{ key: string; val: string }>;
  complementPhrase: string;
  otherWords: string[];
  detectedTargetNumber?: string;
} {
  // Se contiver formato de CEP com hífen (ex: 64091-010), remove o hífen para casar com os 8 dígitos do banco
  const cleanedText = inputText.replace(/\b(\d{5})-(\d{3})\b/g, '$1$2');

  const norm = normalizeSearchText(cleanedText);
  const words = norm.split(/\s+/).filter(Boolean);

  const complementTokens: Array<{ key: string; val: string }> = [];
  const otherWords: string[] = [];

  let i = 0;
  while (i < words.length) {
    const w = words[i];
    if (COMPLEMENT_WORDS.has(w)) {
      const canonKey = canonicalizeComplementWord(w);
      if (i + 1 < words.length) {
        const val = words[i + 1];
        if (COMPLEMENT_WORDS.has(val) && (canonKey === 'fundos' || canonKey === 'andar')) {
          complementTokens.push({ key: canonKey, val: '' });
          i += 1;
        } else {
          complementTokens.push({ key: canonKey, val });
          i += 2;
        }
      } else {
        complementTokens.push({ key: canonKey, val: '' });
        i += 1;
      }
    } else {
      otherWords.push(w);
      i += 1;
    }
  }

  // Não trata como número do logradouro um número que venha logo após palavra de complemento
  let detectedTargetNumber: string | undefined = undefined;
  if (otherWords.length > 1) {
    const lastWord = otherWords[otherWords.length - 1];
    if (/^\d+[a-zA-Z]*$/.test(lastWord)) {
      detectedTargetNumber = lastWord;
    }
  } else if (otherWords.length === 1 && complementTokens.length === 0) {
    if (/^\d+[a-zA-Z]*$/.test(otherWords[0])) {
      detectedTargetNumber = otherWords[0];
    }
  }

  const complementPhrase = complementTokens
    .map(c => c.val ? `${c.key} ${c.val}` : c.key)
    .join(' ');

  return {
    cleanedText,
    complementTokens,
    complementPhrase,
    otherWords,
    detectedTargetNumber
  };
}

// Algoritmo de classificação por relevância e semelhança (Prioriza número e logradouro exatos no topo)
function sortResultsByRelevance(results: any[], queryText: string, targetNumber?: string, complementPhrase?: string): any[] {
  if (!results || results.length <= 1) return results;

  const cleanQuery = normalizeString(queryText);
  const cleanTargetNum = targetNumber ? normalizeString(targetNumber) : '';
  const targetNumInt = cleanTargetNum && /^\d+$/.test(cleanTargetNum) ? parseInt(cleanTargetNum, 10) : null;
  const cleanCompPhrase = complementPhrase ? normalizeSearchText(complementPhrase) : '';

  return [...results].sort((a, b) => {
    // 0. Se foi detectada frase de complemento, prioriza quem contém a frase exata no complemento
    if (cleanCompPhrase) {
      const compA = normalizeSearchText(a.complemento);
      const compB = normalizeSearchText(b.complemento);
      const matchA = ` ${compA} `.includes(` ${cleanCompPhrase} `);
      const matchB = ` ${compB} `.includes(` ${cleanCompPhrase} `);

      if (matchA && !matchB) return -1;
      if (!matchA && matchB) return 1;
    }

    // 1. Se foi pesquisado um número específico (ex: "3625")
    if (cleanTargetNum) {
      const numA = normalizeString(a.numero_logradouro);
      const numB = normalizeString(b.numero_logradouro);
      const endA = normalizeString(a.endereco);
      const endB = normalizeString(b.endereco);

      const isExactNumA = numA === cleanTargetNum || endA.endsWith(`- ${cleanTargetNum}`) || endA.endsWith(` ${cleanTargetNum}`);
      const isExactNumB = numB === cleanTargetNum || endB.endsWith(`- ${cleanTargetNum}`) || endB.endsWith(` ${cleanTargetNum}`);

      if (isExactNumA && !isExactNumB) return -1;
      if (!isExactNumA && isExactNumB) return 1;

      // Se ambos contêm o número parcialmente (ex: "3625A")
      const containsNumA = numA.includes(cleanTargetNum) || endA.includes(cleanTargetNum);
      const containsNumB = numB.includes(cleanTargetNum) || endB.includes(cleanTargetNum);
      if (containsNumA && !containsNumB) return -1;
      if (!containsNumA && containsNumB) return 1;

      // Proximidade numérica (o número mais próximo de 3625 fica mais acima)
      if (targetNumInt !== null) {
        const valA = parseInt(numA.replace(/\D/g, ''), 10);
        const valB = parseInt(numB.replace(/\D/g, ''), 10);
        if (!isNaN(valA) && !isNaN(valB)) {
          const diffA = Math.abs(valA - targetNumInt);
          const diffB = Math.abs(valB - targetNumInt);
          if (diffA !== diffB) return diffA - diffB;
        }
      }
    }

    // 2. Correspondência com início do logradouro
    const endA = normalizeString(a.endereco);
    const endB = normalizeString(b.endereco);
    const startsA = endA.startsWith(cleanQuery);
    const startsB = endB.startsWith(cleanQuery);
    if (startsA && !startsB) return -1;
    if (!startsA && startsB) return 1;

    // 3. Ordem por nome de logradouro (agrupando nomes iguais primeiro) e número da porta
    const pA = parseAddressForSort(a.endereco, a.numero_logradouro);
    const pB = parseAddressForSort(b.endereco, b.numero_logradouro);
    const streetCmp = pA.streetName.localeCompare(pB.streetName, 'pt-BR');
    if (streetCmp !== 0) return streetCmp;
    return pA.doorNumber - pB.doorNumber;
  });
}

export async function buscarEnderecos(
  municipio: string,
  textoBusca: string,
  modoAvancado: boolean = false,
  limit: number = 500
): Promise<{ results: any[]; totalEncontrado: number }> {
  let conn: duckdb.AsyncDuckDBConnection | null = null;
  
  try {
    const db = await getDuckDB();
    conn = await db.connect();
    
    const colunasBusca = modoAvancado ? COLUNAS_BUSCA_AVANCADA : COLUNAS_BUSCA_SIMPLES;
    const whereClauses: string[] = [];
    
    if (municipio && municipio !== 'Todos') {
      const cleanMun = escapeSqlLiteral(municipio.trim());
      const escMunNorm = escapeSqlLiteral(normalizeString(municipio));
      whereClauses.push(`("municipio" = '${cleanMun}' OR "municipio" ILIKE '${cleanMun}' OR strip_accents(lower(municipio)) = '${escMunNorm}')`);
    }

    const trimmedInput = (textoBusca || '').trim();

    if (trimmedInput.length === 0) {
      return { results: [], totalEncontrado: 0 };
    }

    const parsed = extractComplementAndTerms(trimmedInput);
    let detectedTargetNumber = parsed.detectedTargetNumber;

    // Se detectou frase de complemento, exige a expressão normalizada na coluna complemento com limites de palavra
    if (parsed.complementPhrase) {
      const escPhrase = escapeSqlLikePattern(parsed.complementPhrase);
      whereClauses.push(`(' ' || regexp_replace(strip_accents(lower(COALESCE("complemento", ''))), '[^a-z0-9]+', ' ', 'g') || ' ') LIKE '% ${escPhrase} %'`);
    }

    // Verifica se há vírgula separando endereço de bairro/número
    const partes = parsed.cleanedText.split(',').map(p => p.trim()).filter(p => p !== '');

    if (partes.length > 1) {
      // Parte 1 (Rua / Logradouro principal)
      const normParte1 = normalizeSearchText(partes[0]);
      const termosParte1 = normParte1.split(/\s+/).filter(w => !COMPLEMENT_WORDS.has(w) && Boolean(w));

      if (termosParte1.length > 0) {
        const concatStrGeral = colunasBusca.map(col => `COALESCE(CAST("${col}" AS VARCHAR), '')`).join(" || ' ' || ");
        const searchExprGeral = `regexp_replace(strip_accents(lower(${concatStrGeral})), '[^a-z0-9]+', ' ', 'g')`;
        termosParte1.forEach(termo => {
          const t = escapeSqlLikePattern(termo);
          whereClauses.push(`${searchExprGeral} LIKE '%${t}%'`);
        });
      }

      // Processa as demais partes (separadas por vírgula)
      for (let i = 1; i < partes.length; i++) {
        const parte = partes[i];
        const normParte = normalizeSearchText(parte);
        const termosSec = normParte.split(/\s+/).filter(Boolean);
        if (termosSec.length === 0) continue;

        // Se todos os termos dessa parte já foram absorvidos pela frase de complemento, pula
        const termosSemComp = termosSec.filter(w => !COMPLEMENT_WORDS.has(w));
        if (termosSemComp.length === 0 && parsed.complementPhrase) continue;

        const primeiroTermo = termosSec[0];
        const isNumero = /^\d+[a-zA-Z]*$/.test(primeiroTermo) && !COMPLEMENT_WORDS.has(termosSec[0]);

        if (isNumero) {
          detectedTargetNumber = primeiroTermo;
          const colsNum = ['numero_logradouro', 'endereco', 'complemento'];
          const concatStrNum = colsNum.map(col => `COALESCE(CAST("${col}" AS VARCHAR), '')`).join(" || ' ' || ");
          const searchExprNum = `regexp_replace(strip_accents(lower(${concatStrNum})), '[^a-z0-9]+', ' ', 'g')`;
          
          termosSec.forEach(termo => {
            const t = escapeSqlLikePattern(termo);
            whereClauses.push(`${searchExprNum} LIKE '%${t}%'`);
          });
        } else {
          // PASSO 3: inclui 'complemento' além das colunas de localidade para partes que não começam com número
          const colsLoc = ['bairro', 'localidade', 'nucleo_urbano', 'favela_comunidade', 'agromerado', 'comunidade_rural', 'complemento'];
          const concatStrLoc = colsLoc.map(col => `COALESCE(CAST("${col}" AS VARCHAR), '')`).join(" || ' ' || ");
          const searchExprLoc = `regexp_replace(strip_accents(lower(${concatStrLoc})), '[^a-z0-9]+', ' ', 'g')`;
          
          termosSemComp.forEach(termo => {
            const t = escapeSqlLikePattern(termo);
            whereClauses.push(`${searchExprLoc} LIKE '%${t}%'`);
          });
        }
      }
    } else {
      // Busca sem vírgula: se houver outros termos além do complemento, busca nas colunas gerais
      if (parsed.otherWords.length > 0) {
        const concatStr = colunasBusca.map(col => `COALESCE(CAST("${col}" AS VARCHAR), '')`).join(" || ' ' || ");
        const searchExpr = `regexp_replace(strip_accents(lower(${concatStr})), '[^a-z0-9]+', ' ', 'g')`;

        parsed.otherWords.forEach(termo => {
          const t = escapeSqlLikePattern(termo);
          whereClauses.push(`${searchExpr} LIKE '%${t}%'`);
        });
      }
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';
    const safeLimit = Math.max(1, Math.min(10000, Number(limit) || 500));

    // Cláusula de ordenação por relevância no SQL do DuckDB
    let orderBySql = 'ORDER BY "endereco" ASC, TRY_CAST("numero_logradouro" AS BIGINT) ASC';
    if (parsed.complementPhrase) {
      const escComp = escapeSqlLikePattern(parsed.complementPhrase);
      orderBySql = `
        ORDER BY 
          CASE 
            WHEN (' ' || regexp_replace(strip_accents(lower(COALESCE("complemento", ''))), '[^a-z0-9]+', ' ', 'g') || ' ') LIKE '% ${escComp} %' THEN 1
            ELSE 10
          END ASC,
          "endereco" ASC,
          TRY_CAST("numero_logradouro" AS BIGINT) ASC
      `;
    } else if (detectedTargetNumber) {
      const cleanNum = escapeSqlLiteral(detectedTargetNumber.toLowerCase());
      orderBySql = `
        ORDER BY 
          CASE 
            WHEN lower(trim(COALESCE(CAST("numero_logradouro" AS VARCHAR), ''))) = '${cleanNum}' THEN 1
            WHEN strip_accents(lower(COALESCE(CAST("endereco" AS VARCHAR), ''))) LIKE '% - ${cleanNum}' OR strip_accents(lower(COALESCE(CAST("endereco" AS VARCHAR), ''))) LIKE '% ${cleanNum}' THEN 2
            WHEN lower(trim(COALESCE(CAST("numero_logradouro" AS VARCHAR), ''))) LIKE '${cleanNum}%' THEN 3
            WHEN strip_accents(lower(COALESCE(CAST("endereco" AS VARCHAR), ''))) LIKE '%${cleanNum}%' THEN 4
            ELSE 10
          END ASC,
          TRY_CAST("numero_logradouro" AS BIGINT) ASC,
          "endereco" ASC
      `;
    }

    const sql = `
      SELECT *
      FROM enderecos
      ${whereSql}
      ${orderBySql}
      LIMIT ${safeLimit};
    `;

    const result = await conn.query(sql);
    const rows = result.toArray();
    const rawResults = rows.map(r => r.toJSON());
    let totalEncontrado = rawResults.length;

    if (rawResults.length >= safeLimit) {
      try {
        const countRes = await conn.query(`SELECT count(*)::BIGINT AS total FROM enderecos ${whereSql}`);
        const countRow = countRes.toArray()[0]?.toJSON();
        totalEncontrado = countRow ? Number(countRow.total) : rawResults.length;
      } catch {
        totalEncontrado = rawResults.length;
      }
    }

    // Refina a ordenação de relevância no JavaScript para garantir 100% de precisão no primeiro resultado
    const sortedResults = sortResultsByRelevance(rawResults, trimmedInput, detectedTargetNumber, parsed.complementPhrase);

    return { results: sortedResults, totalEncontrado };
  } catch (e) {
    console.error("Erro na busca de endereços no DuckDB:", e);
    throw e;
  } finally {
    if (conn) {
      await conn.close();
    }
  }
}

export function getPolygonBoundingBox(geometry: any): [number, number, number, number] {
  let minLng = Infinity;
  let minLat = Infinity;
  let maxLng = -Infinity;
  let maxLat = -Infinity;

  const traverse = (coords: any) => {
    if (Array.isArray(coords) && typeof coords[0] === 'number' && typeof coords[1] === 'number') {
      const lng = coords[0];
      const lat = coords[1];
      if (lng < minLng) minLng = lng;
      if (lng > maxLng) maxLng = lng;
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
    } else if (Array.isArray(coords)) {
      coords.forEach(traverse);
    }
  };

  if (geometry && geometry.coordinates) {
    traverse(geometry.coordinates);
  }

  return [minLng, minLat, maxLng, maxLat];
}

export async function buscarEnderecosPorPoligono(
  featureOrGeometry: any,
  limit: number = 5000
): Promise<{ results: any[]; totalEncontrado: number }> {
  let conn: duckdb.AsyncDuckDBConnection | null = null;
  try {
    const geometry = featureOrGeometry.geometry || featureOrGeometry;
    const [minLng, minLat, maxLng, maxLat] = getPolygonBoundingBox(geometry);

    if (!isFinite(minLng) || !isFinite(minLat) || !isFinite(maxLng) || !isFinite(maxLat)) {
      return { results: [], totalEncontrado: 0 };
    }

    const db = await getDuckDB();
    conn = await db.connect();

    // Query do DuckDB usando a bounding box espacial com TRY_CAST seguro
    const sql = `
      SELECT *
      FROM enderecos
      WHERE latitude IS NOT NULL AND longitude IS NOT NULL
        AND TRY_CAST(latitude AS DOUBLE) >= ${minLat - 0.0001}
        AND TRY_CAST(latitude AS DOUBLE) <= ${maxLat + 0.0001}
        AND TRY_CAST(longitude AS DOUBLE) >= ${minLng - 0.0001}
        AND TRY_CAST(longitude AS DOUBLE) <= ${maxLng + 0.0001}
      LIMIT 20000;
    `;

    const result = await conn.query(sql);
    const rows = result.toArray();
    const rawResults = rows.map(r => r.toJSON());

    // Filtragem precisa ponto a ponto dentro do polígono exato com Turf.js
    const turfFeature = featureOrGeometry.type === 'Feature' ? featureOrGeometry : {
      type: 'Feature',
      geometry: geometry,
      properties: {}
    };

    const insideResults = rawResults.filter(row => {
      const lat = parseFloat(row.latitude);
      const lng = parseFloat(row.longitude);
      if (isNaN(lat) || isNaN(lng)) return false;
      try {
        const pt = point([lng, lat]);
        return booleanPointInPolygon(pt, turfFeature as any);
      } catch (err) {
        return false;
      }
    });

    const cappedResults = insideResults.slice(0, limit);
    return {
      results: cappedResults,
      totalEncontrado: insideResults.length
    };
  } catch (e) {
    console.error("Erro na busca de endereços por polígono no DuckDB:", e);
    throw e;
  } finally {
    if (conn) {
      await conn.close();
    }
  }
}

/**
 * Busca direta e otimizada de endereços no CNEFE filtrando especificamente
 * pela coluna "localidade" para um determinado município.
 */
export async function buscarEnderecosPorLocalidade(
  municipio: string,
  localidade: string,
  limit: number = 3000
): Promise<{ results: any[]; totalEncontrado: number }> {
  let conn: duckdb.AsyncDuckDBConnection | null = null;
  try {
    const db = await getDuckDB();
    conn = await db.connect();

    const cleanMun = (municipio || '').trim();
    const cleanLoc = (localidade || '').trim();
    const safeLimit = Math.max(1, Math.min(10000, Number(limit) || 5000));

    const whereClauses: string[] = [];

    if (cleanMun && cleanMun !== 'Todos') {
      const cleanMunEsc = escapeSqlLiteral(cleanMun);
      const escMun = escapeSqlLiteral(normalizeString(cleanMun));
      whereClauses.push(`("municipio" = '${cleanMunEsc}' OR "municipio" ILIKE '${cleanMunEsc}' OR strip_accents(lower(municipio)) = '${escMun}')`);
    }

    if (cleanLoc) {
      const escLoc = escapeSqlLikePattern(normalizeString(cleanLoc));
      // Pesquisa direta e prioritária na coluna "localidade" conforme solicitado (sem acentos)
      whereClauses.push(`strip_accents(lower(COALESCE(CAST("localidade" AS VARCHAR), ''))) LIKE '%${escLoc}%'`);
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    const sql = `
      SELECT *
      FROM enderecos
      ${whereSql}
      ORDER BY "endereco" ASC, TRY_CAST("numero_logradouro" AS BIGINT) ASC
      LIMIT ${safeLimit};
    `;

    const result = await conn.query(sql);
    const rows = result.toArray();
    let rawResults = rows.map(r => r.toJSON());
    let totalEncontrado = rawResults.length;

    if (rawResults.length >= safeLimit) {
      try {
        const countRes = await conn.query(`SELECT count(*)::BIGINT AS total FROM enderecos ${whereSql}`);
        const countRow = countRes.toArray()[0]?.toJSON();
        totalEncontrado = countRow ? Number(countRow.total) : rawResults.length;
      } catch {
        totalEncontrado = rawResults.length;
      }
    }

    // Fallback inteligente: se a coluna localidade não estiver preenchida nas linhas do CNEFE
    // daquela região mas o logradouro, bairro ou complemento contiverem o nome da localidade:
    if (rawResults.length === 0 && cleanLoc) {
      const escLoc = escapeSqlLikePattern(normalizeString(cleanLoc));
      const fallbackClauses: string[] = [];
      if (cleanMun && cleanMun !== 'Todos') {
        const cleanMunEsc = escapeSqlLiteral(cleanMun);
        const escMun = escapeSqlLiteral(normalizeString(cleanMun));
        fallbackClauses.push(`("municipio" = '${cleanMunEsc}' OR "municipio" ILIKE '${cleanMunEsc}' OR strip_accents(lower(municipio)) = '${escMun}')`);
      }
      fallbackClauses.push(`(
        strip_accents(lower(COALESCE(CAST("endereco" AS VARCHAR), ''))) LIKE '%${escLoc}%' OR
        strip_accents(lower(COALESCE(CAST("bairro" AS VARCHAR), ''))) LIKE '%${escLoc}%' OR
        strip_accents(lower(COALESCE(CAST("complemento" AS VARCHAR), ''))) LIKE '%${escLoc}%'
      )`);

      const fallbackWhere = `WHERE ${fallbackClauses.join(' AND ')}`;
      const fallbackSql = `
        SELECT *
        FROM enderecos
        ${fallbackWhere}
        ORDER BY "endereco" ASC, TRY_CAST("numero_logradouro" AS BIGINT) ASC
        LIMIT ${safeLimit};
      `;
      const fallbackRes = await conn.query(fallbackSql);
      const fallbackRows = fallbackRes.toArray();
      rawResults = fallbackRows.map(r => r.toJSON());
      totalEncontrado = rawResults.length;
      if (rawResults.length >= safeLimit) {
        try {
          const countRes = await conn.query(`SELECT count(*)::BIGINT AS total FROM enderecos ${fallbackWhere}`);
          const countRow = countRes.toArray()[0]?.toJSON();
          totalEncontrado = countRow ? Number(countRow.total) : rawResults.length;
        } catch {
          totalEncontrado = rawResults.length;
        }
      }
    }

    return { results: rawResults, totalEncontrado };
  } catch (e) {
    console.error("Erro na busca de endereços por localidade no DuckDB:", e);
    throw e;
  } finally {
    if (conn) {
      await conn.close();
    }
  }
}

/**
 * Busca direta e otimizada de endereços no CNEFE filtrando especificamente
 * pela coluna "especie" (Espécie de endereço), como "Estabelecimento de saúde" (Hospitais, etc).
 */
export async function buscarEnderecosPorEspecie(
  especieTerm: string = 'Estabelecimento de saúde',
  municipio?: string,
  limit: number = 3000
): Promise<{ results: any[]; totalEncontrado: number }> {
  let conn: duckdb.AsyncDuckDBConnection | null = null;
  try {
    const db = await getDuckDB();
    conn = await db.connect();

    const cleanMun = (municipio || '').trim();
    const cleanEspecie = (especieTerm || '').trim();
    const safeLimit = Math.max(1, Math.min(10000, Number(limit) || 3000));

    const whereClauses: string[] = [];

    if (cleanMun && cleanMun !== 'Todos') {
      const cleanMunEsc = escapeSqlLiteral(cleanMun);
      const escMun = escapeSqlLiteral(normalizeString(cleanMun));
      whereClauses.push(`("municipio" = '${cleanMunEsc}' OR "municipio" ILIKE '${cleanMunEsc}' OR strip_accents(lower(municipio)) = '${escMun}')`);
    }

    if (cleanEspecie) {
      const escEspecie = escapeSqlLikePattern(normalizeString(cleanEspecie));
      // Filtra na coluna "especie" (Espécie de endereço) por "Estabelecimento de saúde",
      // com suporte a termos relacionados a saúde/hospital
      whereClauses.push(`(
        strip_accents(lower(COALESCE(CAST("especie" AS VARCHAR), ''))) LIKE '%${escEspecie}%'
        OR strip_accents(lower(COALESCE(CAST("especie" AS VARCHAR), ''))) LIKE '%saude%'
        OR strip_accents(lower(COALESCE(CAST("estabelecimento" AS VARCHAR), ''))) LIKE '%hospital%'
      )`);
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    const sql = `
      SELECT *
      FROM enderecos
      ${whereSql}
      ORDER BY 
        CASE 
          WHEN strip_accents(lower(trim(municipio))) = 'teresina' THEN 0 
          WHEN strip_accents(lower(trim(municipio))) LIKE '%teresina%' THEN 1
          ELSE 2 
        END ASC,
        "municipio" ASC, 
        "endereco" ASC, 
        TRY_CAST("numero_logradouro" AS BIGINT) ASC
      LIMIT ${safeLimit};
    `;

    const result = await conn.query(sql);
    const rows = result.toArray();
    const rawResults = rows.map(r => r.toJSON());
    let totalEncontrado = rawResults.length;

    if (rawResults.length >= safeLimit) {
      try {
        const countRes = await conn.query(`SELECT count(*)::BIGINT AS total FROM enderecos ${whereSql}`);
        const countRow = countRes.toArray()[0]?.toJSON();
        totalEncontrado = countRow ? Number(countRow.total) : rawResults.length;
      } catch {
        totalEncontrado = rawResults.length;
      }
    }

    return { results: rawResults, totalEncontrado };
  } catch (e) {
    console.error("Erro na busca de endereços por espécie no DuckDB:", e);
    throw e;
  } finally {
    if (conn) {
      await conn.close();
    }
  }
}

export interface CategorySearchConfig {
  id: string;
  name: string;
  badgeLabel: string;
  species: string[];
  keywords: string[];
  exclusions: string[];
  useWordBoundaryPosto?: boolean;
  useWordBoundaryPetExclusion?: boolean;
  color: string;
}

export const CATEGORY_CONFIGS: Record<string, CategorySearchConfig> = {
  farmacias: {
    id: 'farmacias',
    name: 'Farmácias',
    badgeLabel: 'CNEFE Farmácia • por nome',
    species: ['Estabelecimento de outras finalidades'],
    keywords: ['farmacia', 'drogaria', 'drogasil', 'extrafarma', 'drogao', 'farmaceutic', 'pague menos'],
    exclusions: ['veterinari', 'agro', 'petshop', 'pet shop', 'racoes', 'animal', 'animais', 'mercad'],
    useWordBoundaryPetExclusion: true,
    color: '#EC4899',
  },
  restaurantes: {
    id: 'restaurantes',
    name: 'Restaurantes',
    badgeLabel: 'CNEFE Restaurante • por nome',
    species: ['Estabelecimento de outras finalidades'],
    keywords: [
      'restaurante', 'churrascaria', 'pizzaria', 'lanchonete', 'hamburgueria',
      'pastelaria', 'bistro', 'petiscaria', 'self service', 'self-service',
      'espetaria', 'refeicoes'
    ],
    exclusions: ['escola', 'colegio', 'hospital', 'igreja', 'associacao'],
    color: '#F97316',
  },
  postos: {
    id: 'postos',
    name: 'Postos de Gasolina',
    badgeLabel: 'CNEFE Posto • por nome',
    species: ['Estabelecimento de outras finalidades'],
    keywords: [
      'posto de combustiv', 'posto de gasolina', 'auto posto', 'autoposto'
    ],
    useWordBoundaryPosto: true,
    exclusions: [
      'saude', 'medic', 'vacina', 'policia', 'fiscal', 'atendimento',
      'lavag', 'lava jato', 'telefon', 'telemar', 'correio', 'str',
      'sindicato', 'eleitoral', 'bancari', 'coleta', 'comunitari',
      'agespisa', 'equatorial', 'cepisa', 'dormitorio', 'apostolic'
    ],
    color: '#0284C7',
  },
  hoteis: {
    id: 'hoteis',
    name: 'Hotéis',
    badgeLabel: 'CNEFE Hotelaria • por nome',
    species: ['Estabelecimento de outras finalidades', 'Domicílio coletivo'],
    keywords: [
      'hotel', 'pousada', 'motel', 'hostel', 'hospedaria', 'dormitorio', 'resort'
    ],
    exclusions: [
      'hotelzinho', 'creche', 'infantil', 'escola', 'petshop', 'pet shop',
      'canil', 'cachorro', 'gato', 'animais'
    ],
    useWordBoundaryPetExclusion: true,
    color: '#8B5CF6',
  },
  hospitais: {
    id: 'hospitais',
    name: 'Hospitais',
    badgeLabel: 'CNEFE Saúde • Estabelecimentos',
    species: ['Estabelecimento de saúde'],
    keywords: [],
    exclusions: ['veterinari', 'agro', 'petshop', 'pet shop', 'animal', 'animais'],
    useWordBoundaryPetExclusion: true,
    color: '#DC2626',
  }
};

/**
 * Constrói as cláusulas WHERE SQL para uma categoria temática baseando-se em espécies,
 * estabelecimento obrigatório, palavras-chave e exclusões configuradas.
 */
export function buildCategoryWhereClauses(config: CategorySearchConfig): string[] {
  const clauses: string[] = [];

  // Tratamento específico e robusto para Hospitais / Estabelecimentos de Saúde
  if (config.id === 'hospitais') {
    clauses.push(`(
      "especie" = 'Estabelecimento de saúde'
      OR strip_accents(lower(COALESCE(CAST("especie" AS VARCHAR), ''))) LIKE '%saude%'
      OR (
        "estabelecimento" IS NOT NULL AND 
        strip_accents(lower(COALESCE(CAST("estabelecimento" AS VARCHAR), ''))) LIKE '%hospital%'
      )
    )`);
    // Excluir veterinárias e petshops
    if (config.exclusions && config.exclusions.length > 0) {
      config.exclusions.forEach(ex => {
        const escEx = escapeSqlLikePattern(normalizeString(ex));
        clauses.push(`strip_accents(lower(COALESCE(CAST("estabelecimento" AS VARCHAR), ''))) NOT LIKE '%${escEx}%'`);
      });
    }
    if (config.useWordBoundaryPetExclusion) {
      clauses.push(`regexp_matches(strip_accents(lower(COALESCE(CAST("estabelecimento" AS VARCHAR), ''))), '(^|\\s)pet(\\s|$)') = false`);
    }
    return clauses;
  }

  // Filtro estrito de espécie(s) autorizada(s)
  const speciesList = config.species.map(s => `'${escapeSqlLiteral(s)}'`).join(', ');
  clauses.push(`"especie" IN (${speciesList})`);

  // Estabelecimento deve estar preenchido
  clauses.push(`"estabelecimento" IS NOT NULL AND trim("estabelecimento") != ''`);

  // Palavras-chave que entram
  const kwConditions: string[] = [];
  if (config.useWordBoundaryPosto) {
    kwConditions.push(`regexp_matches(strip_accents(lower("estabelecimento")), '(^|\\s)posto(\\s|$)')`);
  }
  config.keywords.forEach(kw => {
    const escKw = escapeSqlLikePattern(normalizeString(kw));
    if (kw === 'pague menos') {
      kwConditions.push(`(strip_accents(lower("estabelecimento")) LIKE '%${escKw}%' AND strip_accents(lower("estabelecimento")) NOT LIKE '%mercad%')`);
    } else {
      kwConditions.push(`strip_accents(lower("estabelecimento")) LIKE '%${escKw}%'`);
    }
  });
  if (kwConditions.length > 0) {
    clauses.push(`(${kwConditions.join(' OR ')})`);
  }

  // Palavras de exclusão
  config.exclusions.forEach(ex => {
    const escEx = escapeSqlLikePattern(normalizeString(ex));
    clauses.push(`strip_accents(lower("estabelecimento")) NOT LIKE '%${escEx}%'`);
  });
  if (config.useWordBoundaryPetExclusion) {
    clauses.push(`regexp_matches(strip_accents(lower("estabelecimento")), '(^|\\s)pet(\\s|$)') = false`);
  }

  return clauses;
}

/**
 * Busca endereços no CNEFE filtrando por categoria temática através da coluna "estabelecimento"
 * combinada estritamente com a "especie" autorizada e município.
 */
export async function buscarEnderecosPorCategoria(
  categoryId: string,
  municipio?: string,
  limit: number = 3000
): Promise<{ results: any[]; totalEncontrado: number; config: CategorySearchConfig }> {
  const config = CATEGORY_CONFIGS[categoryId];
  if (!config) {
    throw new Error(`Configuração não encontrada para a categoria: ${categoryId}`);
  }

  let conn: duckdb.AsyncDuckDBConnection | null = null;
  try {
    const db = await getDuckDB();
    conn = await db.connect();

    const cleanMun = (municipio || '').trim();
    const safeLimit = Math.max(1, Math.min(10000, Number(limit) || 3000));

    const whereClauses: string[] = [];

    // 1. Filtro obrigatório de município
    if (cleanMun && cleanMun !== 'Todos') {
      const cleanMunEsc = escapeSqlLiteral(cleanMun);
      const escMun = escapeSqlLiteral(normalizeString(cleanMun));
      whereClauses.push(`("municipio" = '${cleanMunEsc}' OR "municipio" ILIKE '${cleanMunEsc}' OR strip_accents(lower(municipio)) = '${escMun}')`);
    }

    // 2. Cláusulas temáticas da categoria (espécies, palavras-chave, exclusões)
    whereClauses.push(...buildCategoryWhereClauses(config));

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    const sql = `
      SELECT *
      FROM enderecos
      ${whereSql}
      ORDER BY 
        CASE 
          WHEN strip_accents(lower(trim(municipio))) = 'teresina' THEN 0 
          WHEN strip_accents(lower(trim(municipio))) LIKE '%teresina%' THEN 1
          ELSE 2 
        END ASC,
        "municipio" ASC, 
        "endereco" ASC, 
        TRY_CAST("numero_logradouro" AS BIGINT) ASC
      LIMIT ${safeLimit};
    `;

    const result = await conn.query(sql);
    const rows = result.toArray();
    const rawResults = rows.map(r => r.toJSON());
    let totalEncontrado = rawResults.length;

    if (rawResults.length >= safeLimit) {
      try {
        const countRes = await conn.query(`SELECT count(*)::BIGINT AS total FROM enderecos ${whereSql}`);
        const countRow = countRes.toArray()[0]?.toJSON();
        totalEncontrado = countRow ? Number(countRow.total) : rawResults.length;
      } catch {
        totalEncontrado = rawResults.length;
      }
    }

    return { results: rawResults, totalEncontrado, config };
  } catch (e) {
    console.error(`Erro na busca de endereços por categoria (${categoryId}) no DuckDB:`, e);
    throw e;
  } finally {
    if (conn) {
      await conn.close();
    }
  }
}

/**
 * Busca endereços de uma categoria temática específica (ou todos) dentro de um conjunto de polígonos GeoJSON.
 * As feições são processadas em sequência reutilizando uma única conexão DuckDB.
 * O filtro de categoria é aplicado no SQL antes do LIMIT e antes da filtragem espacial Turf.
 */
export async function buscarEnderecosPorCategoriaEmPoligonos(
  categoryId: string,
  features: any[],
  limit: number = 5000
): Promise<{ results: any[]; totalEncontrado: number }> {
  if (!features || features.length === 0) {
    return { results: [], totalEncontrado: 0 };
  }

  const isAll = !categoryId || categoryId === 'todos';
  const config = !isAll ? CATEGORY_CONFIGS[categoryId] : null;
  if (!isAll && !config) {
    throw new Error(`Configuração não encontrada para a categoria: ${categoryId}`);
  }

  let conn: duckdb.AsyncDuckDBConnection | null = null;
  try {
    const db = await getDuckDB();
    conn = await db.connect();

    const safeLimit = Math.max(1, Math.min(20000, Number(limit) || 5000));
    const allCandidateRows: any[] = [];

    // Processar feições em sequência reutilizando a mesma conexão
    for (const feat of features) {
      const geometry = feat.geometry || feat;
      const [minLng, minLat, maxLng, maxLat] = getPolygonBoundingBox(geometry);

      if (!isFinite(minLng) || !isFinite(minLat) || !isFinite(maxLng) || !isFinite(maxLat)) {
        continue;
      }

      const whereClauses: string[] = [
        `latitude IS NOT NULL AND longitude IS NOT NULL`,
        `TRY_CAST(latitude AS DOUBLE) >= ${minLat - 0.0001}`,
        `TRY_CAST(latitude AS DOUBLE) <= ${maxLat + 0.0001}`,
        `TRY_CAST(longitude AS DOUBLE) >= ${minLng - 0.0001}`,
        `TRY_CAST(longitude AS DOUBLE) <= ${maxLng + 0.0001}`
      ];

      if (config) {
        whereClauses.push(...buildCategoryWhereClauses(config));
      }

      const whereSql = `WHERE ${whereClauses.join(' AND ')}`;

      // Consulta no SQL com a bounding box espacial + filtros da categoria antes de qualquer LIMIT
      const sql = `
        SELECT *
        FROM enderecos
        ${whereSql}
        LIMIT 20000;
      `;

      const result = await conn.query(sql);
      const rows = result.toArray();
      const rawResults = rows.map(r => r.toJSON());

      // Filtragem espacial exata ponto-a-ponto com Turf
      const turfFeature = feat.type === 'Feature' ? feat : {
        type: 'Feature',
        geometry: geometry,
        properties: feat.properties || {}
      };

      for (const row of rawResults) {
        const lat = parseFloat(row.latitude);
        const lng = parseFloat(row.longitude);
        if (isNaN(lat) || isNaN(lng)) continue;
        try {
          const pt = point([lng, lat]);
          if (booleanPointInPolygon(pt, turfFeature as any)) {
            allCandidateRows.push(row);
          }
        } catch {
          // Ignora erro em geometria inválida
        }
      }
    }

    // Deduplicação dos resultados por codigo_unico (ou chave composta de coordenadas/endereço)
    const seenKeys = new Set<string>();
    const uniqueResults: any[] = [];

    for (const row of allCandidateRows) {
      const key = String(row.codigo_unico || `${row.latitude}_${row.longitude}_${row.numero_logradouro}_${row.endereco}`);
      if (!seenKeys.has(key)) {
        seenKeys.add(key);
        uniqueResults.push(row);
      }
    }

    // Ordenação consistente
    uniqueResults.sort((a, b) => {
      const munComp = (a.municipio || '').localeCompare(b.municipio || '');
      if (munComp !== 0) return munComp;
      const endComp = (a.endereco || '').localeCompare(b.endereco || '');
      if (endComp !== 0) return endComp;
      const numA = parseInt(a.numero_logradouro, 10) || 0;
      const numB = parseInt(b.numero_logradouro, 10) || 0;
      return numA - numB;
    });

    const paginated = uniqueResults.slice(0, safeLimit);

    return {
      results: paginated,
      totalEncontrado: uniqueResults.length
    };
  } catch (e) {
    console.error(`Erro na busca de endereços por categoria (${categoryId}) em polígonos:`, e);
    throw e;
  } finally {
    if (conn) {
      await conn.close();
    }
  }
}

/**
 * Busca endereços de uma categoria temática específica (Farmácias, Restaurantes, Postos, Hotéis, etc.)
 * em um raio geométrico a partir de uma coordenada central (latitude, longitude) em metros.
 */
export async function buscarEnderecosPorCategoriaEmRaio(
  categoryId: string,
  centerLat: number,
  centerLng: number,
  raioMetros: number,
  limit: number = 3000
): Promise<{ results: any[]; totalEncontrado: number; config: CategorySearchConfig }> {
  const config = CATEGORY_CONFIGS[categoryId];
  if (!config) {
    throw new Error(`Configuração não encontrada para a categoria: ${categoryId}`);
  }

  let conn: duckdb.AsyncDuckDBConnection | null = null;
  try {
    const db = await getDuckDB();
    conn = await db.connect();

    const safeRaio = Math.max(50, Math.min(200000, Number(raioMetros) || 1000));
    const safeLimit = Math.max(1, Math.min(10000, Number(limit) || 3000));

    // Bounding Box para aceleração de consulta no DuckDB (graus aprox.)
    const deltaLat = (safeRaio / 111000) * 1.2;
    const cosLat = Math.max(0.1, Math.cos((centerLat * Math.PI) / 180));
    const deltaLng = (safeRaio / (111000 * cosLat)) * 1.2;

    const minLat = centerLat - deltaLat;
    const maxLat = centerLat + deltaLat;
    const minLng = centerLng - deltaLng;
    const maxLng = centerLng + deltaLng;

    const whereClauses: string[] = [
      `TRY_CAST("latitude" AS DOUBLE) BETWEEN ${minLat} AND ${maxLat}`,
      `TRY_CAST("longitude" AS DOUBLE) BETWEEN ${minLng} AND ${maxLng}`,
      ...buildCategoryWhereClauses(config)
    ];

    const whereSql = `WHERE ${whereClauses.join(' AND ')}`;

    const sql = `
      SELECT *
      FROM enderecos
      ${whereSql}
    `;

    const result = await conn.query(sql);
    const rows = result.toArray();
    const rawResults = rows.map(r => r.toJSON());

    // Filtrar com precisão exata usando Haversine e calcular a distância
    const filteredWithDistance = rawResults
      .map(row => {
        const lat = parseFloat(row.latitude);
        const lng = parseFloat(row.longitude);
        if (isNaN(lat) || isNaN(lng)) return null;
        const dist = haversineDistanceMeters(centerLat, centerLng, lat, lng);
        if (dist > safeRaio) return null;
        return {
          ...row,
          distancia_metros: Math.round(dist),
          distancia_texto: formatDistance(dist)
        };
      })
      .filter(Boolean) as any[];

    // Ordenar do mais próximo para o mais distante
    filteredWithDistance.sort((a, b) => a.distancia_metros - b.distancia_metros);

    const paginated = filteredWithDistance.slice(0, safeLimit);

    return {
      results: paginated,
      totalEncontrado: filteredWithDistance.length,
      config
    };
  } catch (e) {
    console.error(`Erro na busca por categoria (${categoryId}) em raio no DuckDB:`, e);
    throw e;
  } finally {
    if (conn) {
      await conn.close();
    }
  }
}

/**
 * Busca endereços (como Hospitais / Estabelecimentos de Saúde) em um raio geométrico
 * a partir de uma coordenada central (latitude, longitude) em metros.
 */
export async function buscarEnderecosPorRaio(
  centerLat: number,
  centerLng: number,
  raioMetros: number,
  especieTerm: string = 'Estabelecimento de saúde',
  limit: number = 3000
): Promise<{ results: any[]; totalEncontrado: number }> {
  let conn: duckdb.AsyncDuckDBConnection | null = null;
  try {
    const db = await getDuckDB();
    conn = await db.connect();

    const safeRaio = Math.max(50, Math.min(200000, Number(raioMetros) || 1000));
    const safeLimit = Math.max(1, Math.min(10000, Number(limit) || 3000));
    const cleanEspecie = (especieTerm || '').trim();

    // Bounding Box para aceleração de consulta no DuckDB (graus aprox.)
    const deltaLat = (safeRaio / 111000) * 1.2;
    const cosLat = Math.max(0.1, Math.cos((centerLat * Math.PI) / 180));
    const deltaLng = (safeRaio / (111000 * cosLat)) * 1.2;

    const minLat = centerLat - deltaLat;
    const maxLat = centerLat + deltaLat;
    const minLng = centerLng - deltaLng;
    const maxLng = centerLng + deltaLng;

    const whereClauses: string[] = [
      `TRY_CAST("latitude" AS DOUBLE) BETWEEN ${minLat} AND ${maxLat}`,
      `TRY_CAST("longitude" AS DOUBLE) BETWEEN ${minLng} AND ${maxLng}`
    ];

    if (cleanEspecie) {
      const escEspecie = escapeSqlLikePattern(normalizeString(cleanEspecie));
      whereClauses.push(`(
        strip_accents(lower(COALESCE(CAST("especie" AS VARCHAR), ''))) LIKE '%${escEspecie}%'
        OR strip_accents(lower(COALESCE(CAST("especie" AS VARCHAR), ''))) LIKE '%saude%'
        OR strip_accents(lower(COALESCE(CAST("estabelecimento" AS VARCHAR), ''))) LIKE '%hospital%'
      )`);
    }

    const whereSql = `WHERE ${whereClauses.join(' AND ')}`;

    const sql = `
      SELECT *
      FROM enderecos
      ${whereSql}
    `;

    const result = await conn.query(sql);
    const rows = result.toArray();
    const rawResults = rows.map(r => r.toJSON());

    // Filtrar com precisão exata usando Haversine e calcular a distância
    const filteredWithDistance = rawResults
      .map(row => {
        const lat = parseFloat(row.latitude);
        const lng = parseFloat(row.longitude);
        if (isNaN(lat) || isNaN(lng)) return null;
        const dist = haversineDistanceMeters(centerLat, centerLng, lat, lng);
        if (dist > safeRaio) return null;
        return {
          ...row,
          distancia_metros: Math.round(dist),
          distancia_texto: formatDistance(dist)
        };
      })
      .filter(Boolean) as any[];

    // Ordenar do mais próximo para o mais distante
    filteredWithDistance.sort((a, b) => a.distancia_metros - b.distancia_metros);

    const paginated = filteredWithDistance.slice(0, safeLimit);

    return {
      results: paginated,
      totalEncontrado: filteredWithDistance.length
    };
  } catch (e) {
    console.error("Erro na busca de endereços por raio no DuckDB:", e);
    throw e;
  } finally {
    if (conn) {
      await conn.close();
    }
  }
}
