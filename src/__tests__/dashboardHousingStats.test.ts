import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import esbuild from 'esbuild';

// Carrega apenas as funções puras reais de Dashboard.tsx (sem disparar initAdminService/rede no import)
const dashboardSource = fs.readFileSync(
  path.resolve(process.cwd(), 'src/components/Dashboard.tsx'),
  'utf8'
);
const startIdx = dashboardSource.indexOf('const getNumVal =');
const endIdx = dashboardSource.indexOf('interface AnimatedNumberProps');
assert.ok(startIdx >= 0 && endIdx > startIdx, 'Bloco de cálculo puro não encontrado em Dashboard.tsx');

const pureSnippet = dashboardSource
  .slice(startIdx, endIdx)
  .replace(/export\s+interface\s+DashboardHousingStats[\s\S]*?\n\}\n/, '')
  .replace(/export\s+function\s+computeDashboardHousingStats/, 'function computeDashboardHousingStats')
  .replace(/:\s*SelectedFeature\[\]/g, '')
  .replace(/:\s*DashboardHousingStats/g, '');

const compiled = esbuild.transformSync(
  `${pureSnippet}\nmodule.exports = { computeDashboardHousingStats };`,
  { loader: 'ts', format: 'cjs' }
);

const mod: { exports: { computeDashboardHousingStats?: any } } = { exports: {} };
vm.runInNewContext(compiled.code, { module: mod, exports: mod.exports, console, Math, Number, String });
const { computeDashboardHousingStats } = mod.exports;

const makeArea = (id: string, props: Record<string, any>) => ({
  id,
  name: `Área ${id}`,
  sourceName: 'Setores',
  layer: null as any,
  properties: props,
});

test('cenário do print: 2 áreas sem V0002 somando 2.026 particulares (1.475 ocupados, 551 vagos, 0 coletivos)', () => {
  const area1 = makeArea('1', {
    V0001: 4200,
    V0002: 0,
    V0003: 1840,
    V0007: 1340,
    V0004: 0,
    AREA_KM2: 1.5,
  });
  const area2 = makeArea('2', {
    V0001: 450,
    V0002: 0,
    V0003: 186,
    V0007: 135,
    V0004: 0,
    AREA_KM2: 0.5,
  });

  const stats = computeDashboardHousingStats([area1, area2]);

  assert.equal(stats.sumDomPart, 2026);
  assert.equal(stats.sumDomOcup, 1475);
  assert.equal(stats.sumVagos, 551);
  assert.equal(stats.sumDomCol, 0);
  assert.equal(stats.sumDomTotal, 2026);
  assert.equal(stats.taxaOcupacao, '72.8');
  assert.ok(Math.abs(stats.pctOcup - (1475 / 2026) * 100) < 1e-9);
  assert.ok(Math.abs(stats.pctVagos - (551 / 2026) * 100) < 1e-9);
  assert.equal(stats.pctCol, 0);
  assert.equal(stats.pctSemClassificacao, 0);
  assert.ok(Math.abs(stats.pctOcup + stats.pctVagos + stats.pctCol - 100) < 1e-9);
});

test('ordem de seleção não altera totais nem percentuais (1, 2 e 3 áreas, com e sem V0002)', () => {
  const a1 = makeArea('A', { V0001: 1000, V0003: 400, V0007: 300, V0004: 0 });
  const a2 = makeArea('B', { V0001: 2000, V0002: 800, V0003: 800, V0007: 600, V0004: 0 });
  const a3 = makeArea('C', { V0001: 500, V0002: 9999, V0003: 200, V0007: 150, V0004: 50 });

  // 1 área
  const s1 = computeDashboardHousingStats([a1]);
  assert.equal(s1.sumDomTotal, 400);
  assert.equal(s1.pctCol, 0);

  // 2 áreas em ordens opostas
  const s2ab = computeDashboardHousingStats([a1, a2]);
  const s2ba = computeDashboardHousingStats([a2, a1]);
  assert.equal(s2ab.sumDomTotal, 1200);
  assert.equal(s2ba.sumDomTotal, 1200);
  assert.equal(s2ab.sumDomOcup, s2ba.sumDomOcup);
  assert.equal(s2ab.sumVagos, s2ba.sumVagos);
  assert.equal(s2ab.sumPop, s2ba.sumPop);

  // 3 áreas com coletivos > 0 e V0002 divergente em a3 (deve emitir 1 warning único e preferir particulares + coletivos)
  const warnings: string[] = [];
  const origWarn = console.warn;
  console.warn = (...args: any[]) => warnings.push(args.join(' '));
  try {
    const s3abc = computeDashboardHousingStats([a1, a2, a3]);
    const s3cba = computeDashboardHousingStats([a3, a2, a1]);

    assert.equal(warnings.length, 2); // 1 por chamada de seleção com divergência
    assert.equal(s3abc.sumDomPart, 1400);
    assert.equal(s3abc.sumDomCol, 50);
    assert.equal(s3abc.sumDomTotal, 1450);
    assert.equal(s3cba.sumDomTotal, 1450);
    assert.equal(s3abc.sumDomOcup, 1050);
    assert.equal(s3abc.sumVagos, 350);
    assert.ok(s3abc.pctCol > 0);
    assert.ok(Math.abs(s3abc.pctOcup + s3abc.pctVagos + s3abc.pctCol - 100) < 1e-9);
    assert.equal(s3abc.pctOcup, s3cba.pctOcup);
    assert.equal(s3abc.pctVagos, s3cba.pctVagos);
    assert.equal(s3abc.pctCol, s3cba.pctCol);
  } finally {
    console.warn = origWarn;
  }
});
