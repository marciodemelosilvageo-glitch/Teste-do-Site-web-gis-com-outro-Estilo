import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeString,
  normalizeSearchText,
  parseAddressForSort,
  haversineDistanceMeters,
  formatDistance,
} from '../utils/geodesic';

describe('Geodesic & String Normalization Utilities', () => {
  describe('normalizeString', () => {
    test('removes accents, trims, and converts to lowercase', () => {
      assert.equal(normalizeString('Piauí'), 'piaui');
      assert.equal(normalizeString(' Marcolândia  '), 'marcolandia');
      assert.equal(normalizeString('Avenida São Sebastião'), 'avenida sao sebastiao');
      assert.equal(normalizeString('ÁÉÍÓÚ ÀÈÌÒÙ ÂÊÎÔÛ ÃÕ Ç'), 'aeiou aeiou aeiou ao c');
    });

    test('returns empty string for null, undefined or empty values', () => {
      assert.equal(normalizeString(null), '');
      assert.equal(normalizeString(undefined), '');
      assert.equal(normalizeString(''), '');
    });
  });

  describe('normalizeSearchText', () => {
    test('replaces non-alphanumeric characters with single space and trims', () => {
      assert.equal(normalizeSearchText('Av. Frei Serafim, 1200 - Centro'), 'av frei serafim 1200 centro');
      assert.equal(normalizeSearchText('Rua 15 de Novembro (antiga rua 3)'), 'rua 15 de novembro antiga rua 3');
      assert.equal(normalizeSearchText('   espacos   duplos   '), 'espacos duplos');
    });
  });

  describe('parseAddressForSort', () => {
    test('separates street name and door number from address string', () => {
      const res1 = parseAddressForSort('Avenida Frei Serafim - 1200');
      assert.equal(res1.streetName, 'avenida frei serafim');
      assert.equal(res1.doorNumber, 1200);

      const res2 = parseAddressForSort('Rua Radialista Jim Borralho, 475');
      assert.equal(res2.streetName, 'rua radialista jim borralho');
      assert.equal(res2.doorNumber, 475);
    });

    test('uses doorNum fallback parameter when string has no number', () => {
      const res = parseAddressForSort('Avenida Raul Lopes', '500');
      assert.equal(res.streetName, 'avenida raul lopes');
      assert.equal(res.doorNumber, 500);
    });
  });

  describe('haversineDistanceMeters & formatDistance', () => {
    test('calculates correct distance between known coordinates', () => {
      // Teresina (-5.0892, -42.8016) até Parnaíba (-2.9056, -41.7753) ~ 265 km
      const distance = haversineDistanceMeters(-5.0892, -42.8016, -2.9056, -41.7753);
      assert.ok(distance > 260000 && distance < 275000, `Distância esperada ~265km, obtido: ${distance}`);
    });

    test('distance between identical points is 0', () => {
      const distance = haversineDistanceMeters(-7.0, -42.8, -7.0, -42.8);
      assert.equal(distance, 0);
    });

    test('formatDistance formats meters and kilometers properly', () => {
      assert.equal(formatDistance(0), '0 m');
      assert.equal(formatDistance(450), '450 m');
      assert.equal(formatDistance(1000), '1.0 km');
      assert.equal(formatDistance(265400), '265.4 km');
    });
  });
});
