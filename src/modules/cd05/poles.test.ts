import { describe, expect, it } from 'vitest';
import { roots } from './poles';
import { closedLoop, constantLead } from './frequency';
const flatten = (a: ReturnType<typeof roots>): { re: number; im: number }[] => a.values.flatMap(p => Array.from({ length: p.multiplicity }, () => ({ re: p.re, im: p.im })));
const compare = (coefficients: number[], expected: { re: number; im: number }[]): void => {
  const result = roots(coefficients), values = flatten(result);
  expect(values).toHaveLength(expected.length);
  const remaining = [...expected];
  for (const value of values) {
    const index = remaining.findIndex(p => Math.hypot(p.re - value.re, p.im - value.im) < 1e-8 * Math.max(1, Math.hypot(p.re, p.im)));
    expect(index).toBeGreaterThanOrEqual(0); remaining.splice(index, 1);
  }
  expect(result.residual).toBeLessThanOrEqual(1e-10); expect(result.coefficientResidual).toBeLessThanOrEqual(1e-8);
};
describe('CD05 complete characteristic poles', () => {
  it('checks the independent source no-lead quadratic', () => {
    compare([1, 2, 4], [{ re: -1, im: -Math.sqrt(3) }, { re: -1, im: Math.sqrt(3) }]);
  });
  it('retains all three roots in a cancellation fixture', () => {
    const model = closedLoop({ k: 1, a: 2 }, { K: 4, T: .5, alpha: .5 });
    expect(model.denominator).toEqual([1, 6, 16, 16]);
    compare(model.denominator, [{ re: -2, im: 0 }, { re: -2, im: 2 }, { re: -2, im: -2 }]);
  });
  it('checks every pole in the independent three-mode fixture', () => {
    compare([1, 8, 24, 32], [{ re: -4, im: 0 }, { re: -2, im: -2 }, { re: -2, im: 2 }]);
  });
  it('handles three distinct real roots without sorting a partial pair', () => {
    compare([1, 6, 11, 6], [{ re: -1, im: 0 }, { re: -2, im: 0 }, { re: -3, im: 0 }]);
  });
  it('preserves critical quadratic multiplicity exactly', () => {
    expect(roots([1, 2, 1]).values).toEqual([{ re: -1, im: 0, multiplicity: 2 }]);
    expect(roots([1, 0, 0]).values).toEqual([{ re: 0, im: 0, multiplicity: 2 }]);
  });
  it('preserves double and triple cubic multiplicities', () => {
    expect(roots([1, 4, 5, 2]).values).toEqual([{ re: -2, im: 0, multiplicity: 1 }, { re: -1, im: 0, multiplicity: 2 }]);
    expect(roots([1, 3, 3, 1]).values).toEqual([{ re: -1, im: 0, multiplicity: 3 }]);
    expect(roots([1, -3, 3, -1]).values).toEqual([{ re: 1, im: 0, multiplicity: 3 }]);
  });
  it('preserves the full triple characteristic for a cancelling lead model', () => {
    const model = closedLoop({ k: 1, a: 1 }, { K: .5, T: 1, alpha: .5 });
    expect(model.denominator).toEqual([1, 3, 3, 1]);
    expect(roots(model.denominator).values).toEqual([{ re: -1, im: 0, multiplicity: 3 }]);
  });
  it('does not lose a tiny quadratic pole to subtractive cancellation', () => {
    const result = roots([1, 1e8, 1]), values = flatten(result);
    const small = values.reduce((a, b) => Math.abs(a.re) < Math.abs(b.re) ? a : b);
    expect(Math.abs((small.re + 1e-8) / 1e-8)).toBeLessThan(1e-12); expect(small.im).toBe(0);
  });
  it('retains a real zero root and both nonreal roots', () => {
    compare([1, 1, 1, 0], [{ re: 0, im: 0 }, { re: -.5, im: Math.sqrt(3) / 2 }, { re: -.5, im: -Math.sqrt(3) / 2 }]);
    expect(roots([1, 0, 0, 0]).values).toEqual([{ re: 0, im: 0, multiplicity: 3 }]);
  });
  it('checks all supported positive-family range corners', () => {
    for (const k of [.01, 100]) for (const a of [.1, 100]) for (const K of [.01, 1000]) for (const T of [.01, 10]) for (const alpha of [.02, 1]) {
      const model = closedLoop({ k, a }, { K, T, alpha }), result = roots(model.denominator);
      expect(result.values.reduce((sum, value) => sum + value.multiplicity, 0)).toBe(alpha === 1 ? 2 : 3);
      result.values.forEach(value => expect(value.re).toBeLessThan(0));
    }
  });
  it('leaves caller-owned coefficients unchanged', () => {
    const data = closedLoop({ k: 1, a: 2 }, constantLead(4)).denominator, before = [...data];
    roots(data); expect(data).toEqual(before);
  });
  it.each([[2, 2, 1], [1, 1], [1, 0, 0, 0, 1], [1, NaN, 1], [1, Infinity, 1], [1, 1e11, 1]].map(coefficients => ({ coefficients })))('rejects invalid or excessive coefficients $coefficients', ({ coefficients }) => expect(() => roots(coefficients)).toThrow(/bounded/));
});
