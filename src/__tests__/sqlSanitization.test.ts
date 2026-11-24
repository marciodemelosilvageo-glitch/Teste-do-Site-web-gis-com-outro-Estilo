import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { escapeSqlLiteral, escapeSqlLikePattern } from '../utils/sql';

describe('SQL Sanitization & Injection Prevention Tests', () => {
  test('escapeSqlLiteral escapes single quotes by doubling them', () => {
    assert.equal(escapeSqlLiteral("Teresina"), "Teresina");
    assert.equal(escapeSqlLiteral("Sant'Ana"), "Sant''Ana");
    assert.equal(escapeSqlLiteral("' OR '1'='1"), "'' OR ''1''=''1");
    assert.equal(escapeSqlLiteral("'; DROP TABLE enderecos; --"), "''; DROP TABLE enderecos; --");
  });

  test('escapeSqlLiteral handles numbers, nullish and complex strings', () => {
    assert.equal(escapeSqlLiteral(String(12345)), "12345");
    assert.equal(escapeSqlLiteral(""), "");
    assert.equal(escapeSqlLiteral("Normal string with no quotes"), "Normal string with no quotes");
    assert.equal(escapeSqlLiteral("Multiple ' ' ' quotes"), "Multiple '' '' '' quotes");
  });

  test('escapeSqlLikePattern escapes %, _ and backslashes in addition to quotes', () => {
    assert.equal(escapeSqlLikePattern("100%"), "100\\%");
    assert.equal(escapeSqlLikePattern("setor_01"), "setor\\_01");
    assert.equal(escapeSqlLikePattern("path\\to\\dir"), "path\\\\to\\\\dir");
    assert.equal(escapeSqlLikePattern("user's %_ test"), "user''s \\%\\_ test");
  });
});
