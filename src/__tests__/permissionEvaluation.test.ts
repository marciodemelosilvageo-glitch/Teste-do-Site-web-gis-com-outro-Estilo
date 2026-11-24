import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeCapabilityKey } from '../context/FeatureAccessContext';

describe('Feature Access & Permission Evaluation', () => {
  describe('normalizeCapabilityKey', () => {
    test('normalizes legacy camelCase permissions to canonical keys', () => {
      assert.equal(normalizeCapabilityKey('allowCnefeSearch'), 'tool:cnefe_search');
      assert.equal(normalizeCapabilityKey('allowMeasureTool'), 'tool:measure');
      assert.equal(normalizeCapabilityKey('allowPrintA4'), 'tool:print_a4');
      assert.equal(normalizeCapabilityKey('allowExportData'), 'tool:export_data');
      assert.equal(normalizeCapabilityKey('allowExportGeoJson'), 'data:export:geojson');
      assert.equal(normalizeCapabilityKey('allowExportShapefile'), 'data:export:shapefile');
      assert.equal(normalizeCapabilityKey('allowExportGeoPackage'), 'data:export:geopackage');
      assert.equal(normalizeCapabilityKey('allowGenerateLogins'), 'admin:users:create');
    });

    test('normalizes legacy dot-notation keys to canonical keys', () => {
      assert.equal(normalizeCapabilityKey('ferramenta.cnefe'), 'tool:cnefe_search');
      assert.equal(normalizeCapabilityKey('ferramenta.medir'), 'tool:measure');
      assert.equal(normalizeCapabilityKey('ferramenta.imprimir'), 'tool:print_a4');
      assert.equal(normalizeCapabilityKey('ferramenta.raiox'), 'tool:raio_x');
    });

    test('passes through canonical keys without changes', () => {
      assert.equal(normalizeCapabilityKey('tool:cnefe_search'), 'tool:cnefe_search');
      assert.equal(normalizeCapabilityKey('tool:measure'), 'tool:measure');
      assert.equal(normalizeCapabilityKey('admin:users:create'), 'admin:users:create');
    });

    test('handles empty or blank values safely', () => {
      assert.equal(normalizeCapabilityKey(''), '');
      assert.equal(normalizeCapabilityKey('   '), '');
    });
  });
});
