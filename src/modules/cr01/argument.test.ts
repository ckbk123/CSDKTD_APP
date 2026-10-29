import { describe, expect, it } from 'vitest';
import { parsePolynomial } from './expression';

describe('shared argument guard before CR01 normalization', () => {
  it.each([
    '\\frac1\u20092', 's^\u20092+s', '\\frac1{\\left\\;2}',
    '\\frac1{\\left\\left\\,2}', '\\frac1{\\left2\\;}',
  ])('does not turn malformed visible arguments into coefficients: %s', source => {
    expect(() => parsePolynomial(source)).toThrow();
  });
  it.each([
    ['\\frac1{\\;2}', [.5]], ['\\frac1{\\left(\\;2\\right)}', [.5]],
    ['s^{2}+2s+1', [1, 2, 1]], ['\\frac12', [.5]],
  ] as const)('retains a supported argument: %s', (source, expected) => {
    expect(parsePolynomial(source).map(x => Number(x.n) / Number(x.d))).toEqual(expected);
  });
});
