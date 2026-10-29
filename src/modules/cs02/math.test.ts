import { describe, expect, it } from 'vitest';
import { U, Z, constantOf, latexRF, mulP, q, scaleP, textQ, type Poly } from './algebra';
import { analyzeCoefficients, determinant } from './math';
const p = (...a: number[]): Poly => a.map(n => q(n));
const column = (source: Poly) => analyzeCoefficients(source).rows.map(row => { const value = constantOf(row.values[0]); return value ? textQ(value) : latexRF(row.values[0]); });

describe('CS02 exact Routh and Hurwitz calculation', () => {
  it('matches the source cubic first column and independently derived minors', () => {
    const result = analyzeCoefficients(p(20, 10, 7, 1));
    expect(column(p(20, 10, 7, 1))).toEqual(['1', '7', '50/7', '20']);
    expect(result.minors.map(textQ)).toEqual(['7', '50', '1000']);
    expect([result.right, result.axis, result.left, result.strict]).toEqual([0, 0, 3, true]);
    for (const k of [-1, 0, 35, 70, 80]) {
      const changed = analyzeCoefficients(p(k, 10, 7, 1));
      expect(changed.minors.map(textQ)).toEqual(['7', String(70 - k), String(k * (70 - k))]);
      expect(changed.strict).toBe(k > 0 && k < 70);
    }
  });
  it('uses a symbolic epsilon for the proposed isolated-zero quartic', () => {
    const result = analyzeCoefficients(p(5, 6, 3, 2, 1));
    expect(result.rows.map(row => row.treatment)).toEqual(['ordinary', 'ordinary', 'epsilon', 'ordinary', 'ordinary']);
    expect(result.rows[2].original.map(value => textQ(constantOf(value)!))).toEqual(['0', '5', '0']);
    expect(result.limits[3]).toEqual({ kind: 'infinite', sign: -1 });
    expect(result.signs).toEqual([1, 1, 1, -1, 1]); expect(result.right).toBe(2); expect(result.axis).toBe(0);
  });
  it('forms and differentiates the proposed all-zero auxiliary polynomial', () => {
    const result = analyzeCoefficients(p(4, 12, 13, 7, 3, 1)), special = result.rows[4];
    expect(special.power).toBe(1); expect(special.original.every(value => constantOf(value)?.n === 0n)).toBe(true);
    expect(special.treatment).toBe('auxiliary'); expect(result.auxiliaries[0].polynomial?.map(textQ)).toEqual(['4', '0', '1']);
    expect(special.values.map(value => textQ(constantOf(value)!))).toEqual(['2', '0', '0']);
    expect([result.right, result.axis, result.left, result.strict]).toEqual([0, 2, 3, false]);
    expect(result.auxiliaries[0].classification?.imaginaryPairs).toBe(1);
  });
  it('normalizes negative leading scale before demanding Hurwitz positivity', () => {
    const original = p(6, 11, 6, 1), scaled = scaleP(original, q(-3, 2));
    const first = analyzeCoefficients(original), second = analyzeCoefficients(scaled);
    expect(second.normalized).toEqual(first.normalized); expect(second.minors).toEqual(first.minors); expect(second.strict).toBe(true);
    expect(second.leading).toEqual(q(-3, 2));
  });
  it('treats repeated origin and imaginary roots separately from RHP roots', () => {
    for (let n = 1; n <= 6; n++) {
      const result = analyzeCoefficients([...Array.from({ length: n }, () => Z), U]);
      expect([result.right, result.axis, result.left, result.strict]).toEqual([0, n, 0, false]);
    }
    const repeated = analyzeCoefficients(mulP(mulP(p(1, 0, 1), p(1, 0, 1)), p(1, 0, 1)));
    expect([repeated.right, repeated.axis, repeated.left]).toEqual([0, 6, 0]);
  });
  it('does not mistake origin symmetry for purely imaginary auxiliary roots', () => {
    const real = analyzeCoefficients(p(-4, 0, 1));
    expect([real.right, real.axis, real.left]).toEqual([1, 0, 1]); expect(real.auxiliaries[0].classification?.realPairs).toBe(1);
    const quartet = analyzeCoefficients(p(1, 0, 0, 0, 1));
    expect([quartet.right, quartet.axis, quartet.left]).toEqual([2, 0, 2]); expect(quartet.auxiliaries[0].classification?.complexQuartets).toBe(1);
  });
  it('agrees with independently factored combinations through degree six', () => {
    const factors = [
      { a: p(2, 1), right: 0, axis: 0, left: 1 }, { a: p(-1, 1), right: 1, axis: 0, left: 0 },
      { a: p(0, 1), right: 0, axis: 1, left: 0 }, { a: p(5, 2, 1), right: 0, axis: 0, left: 2 },
      { a: p(2, -2, 1), right: 2, axis: 0, left: 0 }, { a: p(4, 0, 1), right: 0, axis: 2, left: 0 },
    ];
    for (const a of factors) for (const b of factors) for (const c of factors) {
      const result = analyzeCoefficients(mulP(mulP(a.a, b.a), c.a));
      expect([result.right, result.axis, result.left]).toEqual([a.right + b.right + c.right, a.axis + b.axis + c.axis, a.left + b.left + c.left]);
    }
  });
  it('computes exact determinants including row swaps and singular minors', () => {
    expect(textQ(determinant([p(0, 2), p(3, 4)]))).toBe('-6');
    expect(textQ(determinant([p(1, 2, 3), p(0, 4, 5), p(1, 0, 6)]))).toBe('22');
    expect(textQ(determinant([p(1, 2), p(2, 4)]))).toBe('0');
    expect(() => analyzeCoefficients(p(0))).toThrow('degree'); expect(() => analyzeCoefficients(p(1))).toThrow('degree');
    expect(() => analyzeCoefficients(p(1000001, 1))).toThrow('magnitudes');
    expect(() => determinant([p(1, 2)])).toThrow('square');
  });
});
