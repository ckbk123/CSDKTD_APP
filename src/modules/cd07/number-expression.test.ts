import { expect, it } from 'vitest';
import { parseNumber } from './number-expression';

it.each<[string, number]>([
  ['2', 2], ['.5', .5], ['-0', 0], ['1-1', 0], ['-2^2', -4], ['(-2)^2', 4],
  [String.raw`\frac12`, .5], [String.raw`\frac{1}2`, .5], [String.raw`\frac1{2}`, .5],
  [String.raw`-\frac12`, -.5], [String.raw`\frac{-1}{2}`, -.5], [String.raw`(\frac12)`, .5],
  [String.raw`\frac{\frac12}{2}`, .25],
  [String.raw`2+\frac12`, 2.5], [String.raw`2\times\frac12`, 1],
  [String.raw`10^{-2}`, .01], [String.raw`\left(2+3\right)/2`, 2.5],
  [String.raw`\frac1{\;2}`, .5], [String.raw`\frac{1}{2}\,+\,1`, 1.5],
])('preserves numeric mathematical meaning: %s', (s, n) => expect(parseNumber(s)).toBeCloseTo(n, 12));

it.each([
  '', ' ', 'NaN', 'Infinity', 's', '1e-2', '2E3', '1{+2}', '{2+3}', '{2}2', '2(3)',
  String.raw`2\frac12`, String.raw`-2\frac12`, String.raw`(2\frac12)`, String.raw`\frac{2\frac12}{3}`,
  String.raw`\frac1\;2`, String.raw`\frac1 2`, String.raw`2^\;2`, String.raw`2^12`, String.raw`2^{12}`, String.raw`q^12`, String.raw`q^{12}`,
  String.raw`2^-2`, String.raw`2^{.5}`, String.raw`\frac{1}{0}`, '1/0', '0^0', '0^{-1}',
  String.raw`\frac{1}{}`, String.raw`\placeholder{}`, String.raw`\left2+3\right)`,
  String.raw`\sqrt{4}`, '1+1+1+'.repeat(150), '('.repeat(20) + '1' + ')'.repeat(20),
  '0.000000001', '100000001', '10^{-6}*10^{-6}',
  '0.' + '0'.repeat(350) + '1', String.raw`\frac\frac122`, String.raw`\frac1\frac12^2`,
])('rejects invalid, ambiguous or unsupported notation: %s', s => expect(() => parseNumber(s)).toThrow());
