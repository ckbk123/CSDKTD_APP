import { describe, expect, it } from 'vitest';
import { EPS, U, Z, addP, addQ, axisMultiplicity, constantRF, divRF, divideP, equalQ, evaluateP, fromNumber, gcdP, latexRF, limitRF, mulP, positiveDistinctRoots, positiveRootsWithMultiplicity, q, rf, subRF, symmetricClassification, textQ, type Poly } from './algebra';
const p = (...a: number[]): Poly => a.map(n => q(n));
const shown = (a: Poly) => a.map(textQ);

describe('CS02 bounded exact algebra', () => {
  it('normalizes signed fractions and preserves decimal/exponent input values', () => {
    expect(textQ(q(12, -18))).toBe('-2/3'); expect(textQ(addQ(q(1, 3), q(1, 6)))).toBe('1/2');
    expect(textQ(fromNumber(.3))).toBe('3/10'); expect(textQ(fromNumber(1e-20))).toBe('1/100000000000000000000');
    expect(() => q(1, 0)).toThrow('zero'); expect(() => q(1n << 4096n)).toThrow('precision');
  });
  it('divides against an independently expanded factor identity', () => {
    // (x-2)(x+3)(x+1) = x³+2x²-5x-6.
    const result = divideP(p(-6, -5, 2, 1), p(-2, 1));
    expect(shown(result.quotient)).toEqual(['3', '4', '1']); expect(shown(result.remainder)).toEqual(['0']);
    expect(equalQ(evaluateP(p(-6, -5, 2, 1), q(2)), Z)).toBe(true);
    expect(shown(gcdP(p(1, 2, 1), p(-1, 0, 1)))).toEqual(['1', '1']);
    expect(() => mulP(Array.from({ length: 33 }, () => U), p(0, 1))).toThrow('degree');
  });
  it('cancels rational functions exactly before interpreting epsilon limits', () => {
    const same = rf(p(0, -2, -2), p(0, 2)); expect(latexRF(same)).toBe('-\\varepsilon-1');
    expect(limitRF(EPS)).toEqual({ kind: 'finite', value: Z, sign: 1 });
    expect(limitRF(subRF(constantRF(q(6)), divRF(constantRF(q(10)), EPS)))).toEqual({ kind: 'infinite', sign: -1 });
    expect(limitRF(rf(p(0, 0, -2), p(0, 3)))).toEqual({ kind: 'finite', value: Z, sign: -1 });
    expect(limitRF(rf(p(-6, 2), p(3, 1)))).toEqual({ kind: 'finite', value: q(-2), sign: -1 });
  });
});

describe('independent Sturm and axis fixtures', () => {
  it('counts positive roots and multiplicities without counting zero/negative roots', () => {
    // x²(x-1)³(x+2), independently factored roots 0,1,-2.
    const polynomial = mulP(p(0, 0, 1), mulP(p(-1, 3, -3, 1), p(2, 1)));
    expect(positiveDistinctRoots(polynomial)).toBe(1); expect(positiveRootsWithMultiplicity(polynomial)).toBe(3);
    expect(positiveDistinctRoots(p(1, 0, 1))).toBe(0); expect(positiveRootsWithMultiplicity(p(0, 0, 0, 1))).toBe(0);
  });
  it('agrees with all directly factored signed/multiple real roots in a changed family', () => {
    for (const a of [-3, 0, 2]) for (const b of [-2, 0, 4]) for (const c of [-1, 0, 3]) {
      const polynomial = [a, b, c].reduce<Poly>((out, root) => mulP(out, p(-root, 1)), [U]);
      expect(positiveDistinctRoots(polynomial)).toBe(new Set([a, b, c].filter(r => r > 0)).size);
      expect(positiveRootsWithMultiplicity(polynomial)).toBe([a, b, c].filter(r => r > 0).length);
    }
  });
  it('counts origin and repeated imaginary factors while excluding symmetric real roots', () => {
    const imaginary = p(4, 0, 1), real = p(-9, 0, 1);
    expect(axisMultiplicity(mulP(imaginary, p(1, 3, 3, 1)))).toBe(2);
    expect(axisMultiplicity(mulP(mulP(imaginary, imaginary), p(0, 0, 1)))).toBe(6);
    expect(axisMultiplicity(mulP(imaginary, real))).toBe(2);
    expect(axisMultiplicity(p(1, 0, 0, 0, 1))).toBe(0);
  });
  it('distinguishes imaginary pairs, real pairs, quartets and origin multiplicities', () => {
    expect(symmetricClassification(p(4, 0, 1))).toEqual({ origin: 0, realPairs: 0, imaginaryPairs: 1, complexQuartets: 0 });
    expect(symmetricClassification(p(-4, 0, 1))).toEqual({ origin: 0, realPairs: 1, imaginaryPairs: 0, complexQuartets: 0 });
    expect(symmetricClassification(p(1, 0, 0, 0, 1))).toEqual({ origin: 0, realPairs: 0, imaginaryPairs: 0, complexQuartets: 1 });
    expect(symmetricClassification(mulP(p(0, 0, 1), mulP(p(4, 0, 1), p(-9, 0, 1))))).toEqual({ origin: 2, realPairs: 1, imaginaryPairs: 1, complexQuartets: 0 });
    expect(() => symmetricClassification(p(1, 1, 1))).toThrow('parity');
  });
  it('retains exact cancellation when the even and odd parts share axis factors', () => {
    const factor = p(1, 0, 2, 0, 1); // (s²+1)²
    expect(axisMultiplicity(mulP(factor, p(2, 1)))).toBe(4);
    expect(shown(addP(factor, factor, true))).toEqual(['0']);
  });
});
