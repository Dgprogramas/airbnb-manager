'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');

const { isIsoDate, isMonth, isNonNegativeAmount, isNonEmptyString } = require('../src/validation');

test('isIsoDate aceita datas reais e rejeita formatos/dias inválidos', () => {
  assert.equal(isIsoDate('2026-07-02'), true);
  assert.equal(isIsoDate('2024-02-29'), true); // bissexto

  assert.equal(isIsoDate('2026-02-30'), false); // dia inexistente
  assert.equal(isIsoDate('2026-13-01'), false); // mês inexistente
  assert.equal(isIsoDate('02/07/2026'), false);
  assert.equal(isIsoDate('2026-7-2'), false);
  assert.equal(isIsoDate(''), false);
  assert.equal(isIsoDate(null), false);
  assert.equal(isIsoDate(20260702), false);
});

test('isMonth aceita YYYY-MM com mês 01–12', () => {
  assert.equal(isMonth('2026-01'), true);
  assert.equal(isMonth('2026-12'), true);

  assert.equal(isMonth('2026-13'), false);
  assert.equal(isMonth('2026-00'), false);
  assert.equal(isMonth('2026-1'), false);
  assert.equal(isMonth('2026-07-02'), false);
  assert.equal(isMonth(undefined), false);
});

test('isNonNegativeAmount aceita números e strings numéricas >= 0', () => {
  assert.equal(isNonNegativeAmount(0), true);
  assert.equal(isNonNegativeAmount(150.5), true);
  assert.equal(isNonNegativeAmount('99.90'), true);

  assert.equal(isNonNegativeAmount(-1), false);
  assert.equal(isNonNegativeAmount('abc'), false);
  assert.equal(isNonNegativeAmount(''), false);
  assert.equal(isNonNegativeAmount(null), false);
  assert.equal(isNonNegativeAmount(true), false);
  assert.equal(isNonNegativeAmount(Infinity), false);
});

test('isNonEmptyString rejeita vazio, espaços e não-strings', () => {
  assert.equal(isNonEmptyString('Ana'), true);

  assert.equal(isNonEmptyString(''), false);
  assert.equal(isNonEmptyString('   '), false);
  assert.equal(isNonEmptyString(123), false);
  assert.equal(isNonEmptyString(null), false);
});
