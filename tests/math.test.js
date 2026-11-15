import test from 'node:test';
import assert from 'node:assert/strict';
import { calculate, parseDecimal } from '../dist/math.js';

const defaults = { mode: 'vertical', length: '50,560', angleMode: 'dms', degrees: '12', minutes: '0', seconds: '6', basis: 'vertical' };
const run = overrides => calculate({ ...defaults, ...overrides });
const close = (actual, expected, tolerance = 1e-10) => assert.ok(Math.abs(actual - expected) < tolerance, `${actual} ≈ ${expected}`);

test('accepts comma/dot decimals and finite numeric inputs', () => {
  assert.equal(parseDecimal(' 50,560 '), 50.56);
  assert.equal(parseDecimal('50.560'), 50.56);
  assert.equal(parseDecimal('.25'), 0.25);
  assert.equal(parseDecimal(0), 0);
});

test('rejects empty, malformed, grouped and nonfinite input', () => {
  for (const value of ['', ' ', '50,56.0', '1 000', '12abc', '1e3', 'Infinity', NaN, Infinity, null, undefined, true]) {
    assert.throws(() => parseDecimal(value), Error);
  }
});

test('zero inclination preserves the input length in both directions', () => {
  for (const mode of ['vertical', 'pile']) {
    const value = run({ mode, degrees: 0, minutes: '', seconds: '' });
    assert.equal(value.result, 50.56);
    assert.equal(value.offset, 0);
    assert.equal(value.difference, 0);
  }
});

test('distinguishes six seconds from six minutes', () => {
  const seconds = run({});
  close(seconds.result, 49.454836890053954);
  close(seconds.offset, 10.51345367508502);
  close(seconds.difference, 1.1051631099460482);
  close(seconds.angleDegrees, 12.001666666666667);
  const minutes = run({ minutes: 6, seconds: 0 });
  close(minutes.result, 49.43672045051513);
  assert.notEqual(seconds.result, minutes.result);
});

test('calculates slopes measured per vertical metre', () => {
  close(run({ angleMode: 'slope', slope: 140 }).result, 50.07167871185413);
  close(run({ angleMode: 'slope', slope: 192 }).result, 49.65307704459309);
  close(run({ angleMode: 'slope', slope: 140 }).slopePerVerticalMetre, 140);
});

test('calculates slopes measured per metre along the pile', () => {
  const result = run({ angleMode: 'slope', slope: 140, basis: 'pile' });
  close(result.result, 50.06206001993925);
  close(result.offset, 7.0784);
  close(result.slopePerPileMetre, 140);
});

test('inverse mode returns the pile length and round-trips', () => {
  const inverse = run({ mode: 'pile' });
  close(inverse.result, 51.68986009767045);
  close(inverse.offset, 10.748396946370327);
  close(run({ length: inverse.result }).result, 50.56);
  assert.equal(inverse.verticalLength, 50.56);
  for (const basis of ['vertical', 'pile']) {
    const vertical = run({ angleMode: 'slope', slope: 192, basis });
    close(run({ mode: 'pile', length: vertical.result, angleMode: 'slope', slope: 192, basis }).result, 50.56);
  }
});

test('validates only the selected angle input method', () => {
  assert.doesNotThrow(() => run({ slope: 'invalid' }));
  assert.doesNotThrow(() => run({ angleMode: 'slope', slope: 140, degrees: '', minutes: 'invalid', seconds: -10 }));
});

test('rejects invalid lengths, angles, slopes and modes with Russian errors', () => {
  for (const overrides of [
    { length: 0 }, { length: -1 }, { length: '' }, { length: Infinity },
    { degrees: '' }, { degrees: -1 }, { degrees: 90 }, { degrees: 100 },
    { minutes: 60 }, { minutes: -1 }, { seconds: 60 }, { seconds: -1 },
    { angleMode: 'slope', slope: -1 }, { angleMode: 'slope', slope: '' },
    { angleMode: 'slope', slope: 1000, basis: 'pile' },
    { angleMode: 'slope', slope: 140, basis: 'unknown' },
    { mode: 'unknown' }, { angleMode: 'unknown' },
  ]) assert.throws(() => run(overrides), /[А-Яа-я]/);
});

test('handles angles close to 90 degrees and rejects overflow', () => {
  const value = run({ mode: 'pile', degrees: '89,999999', minutes: '', seconds: '' });
  assert.ok(Number.isFinite(value.result));
  assert.ok(value.result > 2e9);
  close(run({ length: value.result, degrees: '89,999999', minutes: '', seconds: '' }).result, 50.56);
  assert.throws(() => run({ mode: 'pile', length: Number.MAX_VALUE, degrees: 89, seconds: 0 }), /слишком велик/);
});

test('retains very small length corrections without cancellation', () => {
  const value = run({ degrees: 0, minutes: 0, seconds: 0.001 });
  assert.ok(value.difference > 0);
  assert.ok(value.difference < 1e-12);
});
