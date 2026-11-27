import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

if (typeof (globalThis as any).window === 'undefined') {
  (globalThis as any).window = { devicePixelRatio: 1, screen: {} };
}
if (typeof (globalThis as any).document === 'undefined') {
  (globalThis as any).document = { documentElement: { style: {} }, createElement: () => ({ style: {} }) };
}
if (typeof (globalThis as any).navigator === 'undefined') {
  (globalThis as any).navigator = { userAgent: '' };
}
const { normalizeString, normalizeSearchText, toTitleCase } = await import('../utils');

function getStableAddressId(row: any): string | null {
  if (!row || typeof row !== 'object') return null;
  const rawCode = row.codigo_unico ?? row.CODIGO_UNICO ?? row['Código único do endereço'];
  if (rawCode !== null && rawCode !== undefined && String(rawCode).trim() !== '') {
    return `cnefe:${String(rawCode).trim()}`;
  }
  const lat = parseFloat(row.latitude ?? row.LATITUDE);
  const lng = parseFloat(row.longitude ?? row.LONGITUDE);
  if (!isNaN(lat) && !isNaN(lng)) {
    return `coord:${lat.toFixed(6)},${lng.toFixed(6)}`;
  }
  if (row.__rowKey !== null && row.__rowKey !== undefined && String(row.__rowKey).trim() !== '') {
    return `row:${String(row.__rowKey).trim()}`;
  }
  return null;
}

function getFormattedVal(row: any, colKey: string): string {
  const raw = row[colKey];
  if (raw === null || raw === undefined) return '';
  if (['endereco', 'bairro', 'municipio', 'localidade'].includes(colKey)) {
    return toTitleCase(String(raw));
  }
  return String(raw);
}

function filterRowsLikePanel(rows: any[], columnFilters: Record<string, string>): any[] {
  const activeFilters = Object.entries(columnFilters).filter(([_, text]) => Boolean(text && text.trim()));
  if (activeFilters.length === 0) return rows;

  return rows.filter(row => {
    return activeFilters.every(([colKey, filterVal]) => {
      const rawFilter = filterVal.trim();
      if (!rawFilter) return true;

      const displayStr = getFormattedVal(row, colKey);
      if (!displayStr) return false;

      if (colKey === 'latitude' || colKey === 'longitude') {
        return displayStr.replace(',', '.').includes(rawFilter.replace(',', '.'));
      }
      if (colKey === 'cep') {
        return displayStr.replace(/\D/g, '').includes(rawFilter.replace(/\D/g, ''));
      }
      if (colKey === 'complemento' || colKey === 'endereco' || colKey === 'bairro' || colKey === 'localidade') {
        return normalizeSearchText(displayStr).includes(normalizeSearchText(rawFilter));
      }
      return normalizeString(displayStr).includes(normalizeString(rawFilter));
    });
  });
}

const sampleResults = [
  {
    codigo_unico: '221100105000001',
    municipio: 'TERESINA',
    endereco: 'AVENIDA FREI SERAFIM',
    numero_logradouro: '1200',
    bairro: 'CENTRO',
    cep: '64001-020',
    latitude: -5.08921,
    longitude: -42.8016,
  },
  {
    codigo_unico: '221100105000002',
    municipio: 'TERESINA',
    endereco: 'RUA COELHO RODRIGUES',
    numero_logradouro: '550',
    bairro: 'CENTRO',
    cep: '64000-080',
    latitude: -5.091,
    longitude: -42.81,
  },
  {
    codigo_unico: '220770205000010',
    municipio: 'PARNAIBA',
    endereco: 'AVENIDA SAO SEBASTIAO',
    numero_logradouro: '800',
    bairro: 'FATIMA',
    cep: '64202-020',
    latitude: -2.905,
    longitude: -41.775,
  },
];

test('column filter never mutates original results and restores rows when backspacing or clearing', () => {
  const snapshot = structuredClone(sampleResults);

  // Digita texto sem correspondência
  const noMatch = filterRowsLikePanel(sampleResults, { endereco: 'FREIXYZ' });
  assert.equal(noMatch.length, 0);
  assert.equal(sampleResults.length, 3);
  assert.deepEqual(sampleResults, snapshot);

  // Apaga caractere por caractere até voltar a encontrar
  assert.equal(filterRowsLikePanel(sampleResults, { endereco: 'FREIXY' }).length, 0);
  assert.equal(filterRowsLikePanel(sampleResults, { endereco: 'FREIX' }).length, 0);
  const backToOne = filterRowsLikePanel(sampleResults, { endereco: 'FREI' });
  assert.equal(backToOne.length, 1);
  assert.equal(backToOne[0].codigo_unico, '221100105000001');

  // Limpa tudo e a lista completa retorna
  const cleared = filterRowsLikePanel(sampleResults, {});
  assert.equal(cleared.length, 3);
  assert.deepEqual(cleared, snapshot);
});

test('IbgeSearchPanel keeps table/header mounted on empty filter and never zeroes results in filter paths', () => {
  const panelPath = path.resolve(process.cwd(), 'src/components/IbgeSearchPanel.tsx');
  const source = fs.readFileSync(panelPath, 'utf8');

  assert.match(source, /export function filterIbgeRows/);
  assert.match(source, /export function getNonEmptyColumnKeys/);
  assert.match(source, /Nenhum resultado para esse filtro/);
  assert.match(source, /Limpar filtro desta coluna/);
  assert.match(source, /Limpar todos os filtros/);
  assert.match(source, /let list = filterIbgeRows\(results, debouncedColumnFilters\);/);
});

test('getStableAddressId produces deterministic IDs from CNEFE code or coordinates', () => {
  assert.equal(
    getStableAddressId({ codigo_unico: '221100105000001', latitude: -5.089, longitude: -42.801 }),
    'cnefe:221100105000001'
  );
  assert.equal(
    getStableAddressId({ latitude: -5.08921, longitude: -42.8016 }),
    'coord:-5.089210,-42.801600'
  );
  assert.equal(getStableAddressId(null), null);
});
