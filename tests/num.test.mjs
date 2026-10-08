import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseAmount, toPlain, priceDecimals, fiatDecimals, sparkPaths } from '../src/num.js';

test('parseAmount handles both decimal conventions', () => {
  assert.equal(parseAmount('1,234.5'), 1234.5);
  assert.equal(parseAmount('1.234,5'), 1234.5);
  assert.equal(parseAmount('0,5'), 0.5);
  assert.equal(parseAmount('1,000'), 1000);
  assert.equal(parseAmount('1 000'), 1000);
  assert.equal(parseAmount('.25'), 0.25);
  assert.equal(parseAmount(''), null);
  assert.equal(parseAmount('.'), null);
  assert.equal(parseAmount('-5'), null);
  assert.equal(parseAmount('1e9'), null);
  assert.equal(parseAmount('abc'), null);
});

test('toPlain trims and never groups', () => {
  assert.equal(toPlain(1234567.891, 2), '1234567.89');
  assert.equal(toPlain(0.000123456789, 8), '0.00012346');
  assert.equal(toPlain(NaN, 2), '');
  assert.equal(toPlain(20362.5, 2, 2), '20362.50');
});

test('decimals adapt to magnitude and currency', () => {
  assert.equal(priceDecimals(63000), 2);
  assert.equal(priceDecimals(0.05), 4);
  assert.equal(priceDecimals(0.00001), 8);
  assert.equal(fiatDecimals('jpy'), 0);
  assert.equal(fiatDecimals('usd'), 2);
});

test('sparkPaths skips nulls and closes the fill', () => {
  const { line, fill } = sparkPaths([1, null, 3, 2], 100, 20);
  assert.match(line, /^M0\.0 /);
  assert.ok(fill.endsWith('L100 20L0 20Z'));
  assert.deepEqual(sparkPaths([1], 100, 20), { line: '', fill: '' });
});
