import { describe, expect, it } from 'vitest';
import { characteristic, compareCuts, conditionRoots, cutLatex, cutNumber, gainPolynomialLatex, intervalLatex, isStable, locus, matchRoots, numericRoots, rationalCut, signAt, solveRegions, validateModel } from './gains';
import { decimal, rat, textR, zero } from './exact';
import { parsePolynomial as parse } from './expression';
const baseline = () => solveRegions(parse('1'), parse('s(s+2)(s+5)'));
const at = (x: number) => rationalCut(rat(x));

describe('CS05 exact complete gain regions', () => {
  it('derives the audited baseline0<K<70 and every boundary factor/root', () => {
    const r = baseline(); expect(r.model.d.map(textR)).toEqual(['0', '10', '7', '1']);
    expect(r.conditions.map(c => gainPolynomialLatex(c.polynomial))).toEqual(['7', '10', 'K', '-K+70']);
    expect(r.intervals.map(intervalLatex)).toEqual(['(0,70)']); expect(r.cuts.map(cutNumber)).toEqual([0, 70]);
    expect(isStable(r, at(20))).toBe(true); expect(isStable(r, at(0))).toBe(false); expect(isStable(r, at(70))).toBe(false); expect(isStable(r, at(80))).toBe(false);
    const start = numericRoots(characteristic(r.model, at(0))); expect(start.map(z => z.re)).toEqual(expect.arrayContaining([expect.closeTo(-5, 11), expect.closeTo(-2, 11), expect.closeTo(0, 11)]));
    const boundary = numericRoots(characteristic(r.model, at(70)));
    for (const [re, im] of [[-7, 0], [0, Math.sqrt(10)], [0, -Math.sqrt(10)]]) expect(boundary.some(z => Math.abs(z.re - re) < 1e-10 && Math.abs(z.im - im) < 1e-10)).toBe(true);
    expect(numericRoots(characteristic(r.model, at(80))).filter(z => z.re > 0)).toHaveLength(2);
  });
  it('cross-checks CS03/W06 changed cubic with48 boundary', () => {
    const r = solveRegions(parse('1'), parse('s^3+6s^2+8s')); expect(r.intervals.map(intervalLatex)).toEqual(['(0,48)']);
    const found = numericRoots(characteristic(r.model, at(48))); expect(found.some(z => Math.abs(z.re + 6) < 1e-12)).toBe(true); expect(found.some(z => Math.abs(z.im - Math.sqrt(8)) < 1e-12)).toBe(true);
  });
  it('returns two disjoint intervals instead of forcing one maximum gain', () => {
    // a2=a1=K+1,a0=6K-2 gives Delta=(K-1)(K-3).
    const r = solveRegions(parse('s^2+s+6'), parse('s^3+s^2+s-2'));
    expect(r.intervals.map(intervalLatex)).toEqual(['(\\frac{1}{3},1)', '(3,\\infty)']);
    for (const [k, stable] of [[.5, true], [2, false], [4, true]] as const) expect(isStable(r, rationalCut(decimal(String(k))))).toBe(stable);
    expect(numericRoots(characteristic(r.model, at(2))).some(z => z.re > 0)).toBe(true);
  });
  it('keeps irrational endpoints exact and excludes the exact selected boundary', () => {
    // Delta=K²-4K+2, so boundaries2±sqrt2 and a0>0 requiresK>1/6.
    const r = solveRegions(parse('s^2+s+6'), parse('s^3+s^2+s-1'));
    expect(r.intervals).toHaveLength(2); expect(cutNumber(r.intervals[0].lower)).toBeCloseTo(1 / 6, 12);
    expect(cutNumber(r.intervals[0].upper!)).toBeCloseTo(2 - Math.sqrt(2), 12); expect(cutNumber(r.intervals[1].lower)).toBeCloseTo(2 + Math.sqrt(2), 12);
    for (const c of r.cuts.slice(1)) { expect(isStable(r, c)).toBe(false); expect(r.conditions.some(condition => signAt(condition.polynomial, c) === 0)).toBe(true); }
    expect(cutLatex(r.intervals[1].lower)).toContain('sqrt');
    expect(compareCuts(r.intervals[0].upper!, at(1))).toBeLessThan(0);
  });
  it('preserves included zero, unbounded tails, no stable gains and negative-leading normalization', () => {
    const first = solveRegions(parse('1'), parse('s-2')); expect(first.intervals.map(intervalLatex)).toEqual(['(2,\\infty)']);
    const second = solveRegions(parse('-s'), parse('s^2+2s+1')); expect(second.intervals.map(intervalLatex)).toEqual(['[0,2)']);
    const fixed = solveRegions([zero], parse('(s+1)^3')); expect(fixed.intervals.map(intervalLatex)).toEqual(['[0,\\infty)']);
    expect(solveRegions([zero], parse('s^2-1')).intervals).toEqual([]);
    expect(solveRegions(parse('-1'), parse('-s^3-7s^2-10s')).intervals.map(intervalLatex)).toEqual(['(0,70)']);
    expect(isStable(second, at(-1))).toBe(false);
  });
  it('solves constant, linear, repeated and negative-discriminant inequalities without a sweep', () => {
    expect(conditionRoots(parse('3'))).toEqual([]); expect(conditionRoots(parse('s^2+1'))).toEqual([]);
    expect(conditionRoots(parse('(s-2)^2')).map(cutNumber)).toEqual([2]);
    expect(conditionRoots(parse('-s^2+3s-2')).map(cutNumber)).toEqual([1, 2]);
    const roots = conditionRoots(parse('s^2-2')); expect(signAt(parse('s^2-2'), roots[1])).toBe(0); expect(compareCuts(roots[0], at(0))).toBeLessThan(0);
  });
  it('rejects unsupported model sizes and numeric ranges explicitly', () => {
    expect(() => validateModel(parse('1'), parse('1'))).toThrow(/degree/);
    expect(() => validateModel(parse('s^2'), parse('s^2+1'))).toThrow(/lower/);
    expect(() => validateModel(parse('1'), parse('s^4+1'))).toThrow(/degree/);
    expect(() => locus(baseline().model, 0)).toThrow(/range/); expect(() => locus(baseline().model, 100, 10000)).toThrow(/sample/);
    expect(() => characteristic(baseline().model, at(-1))).toThrow(/nonnegative/);
    expect(() => numericRoots([1, 2, 0])).toThrow(/degree/);
  });
});

describe('CS05 independent numerical roots and branch assignment', () => {
  it('resolves all real, conjugate and repeated roots against explicit factorizations', () => {
    for (const [p, expected] of [
      [[6, 11, 6, 1], [[-1, 0], [-2, 0], [-3, 0]]],
      [[4, 4, 1, 1], [[-1, 0], [0, -2], [0, 2]]],
      [[1, 3, 3, 1], [[-1, 0], [-1, 0], [-1, 0]]],
      [[-2, 0, 1], [[-Math.sqrt(2), 0], [Math.sqrt(2), 0]]],
    ] as const) {
      const found = numericRoots(p); expect(found).toHaveLength(expected.length);
      expected.forEach(([re, im]) => expect(found.some(z => Math.abs(z.re - re) < 1e-6 && Math.abs(z.im - im) < 1e-6)).toBe(true));
      expect(found.every(z => z.residual < 1e-9)).toBe(true);
    }
  });
  it('matches moving conjugates by minimal full-list displacement', () => {
    const a = [{ re: 0, im: 2, residual: 0 }, { re: 0, im: -2, residual: 0 }, { re: -3, im: 0, residual: 0 }];
    const b = [{ re: -3.1, im: 0, residual: 0 }, { re: .1, im: -2.1, residual: 0 }, { re: .1, im: 2.1, residual: 0 }];
    expect(matchRoots(a, b)).toEqual([b[2], b[1], b[0]]);
    const samples = locus(baseline().model, 100, 61); expect(samples).toHaveLength(61); expect(samples.every(s => s.roots?.length === 3)).toBe(true);
  });
});

describe('CS05 visual parser semantics carried forward with independent checks', () => {
  it.each(['\\frac12', '\\frac{1}2', '\\frac1{2}'])('reads compact fraction%s', s => expect(parse(s).map(textR)).toEqual(['1/2']));
  it.each(['2\\frac12', '-2\\frac12', 's2\\frac12', '\\frac{2\\frac12}{3}'])('rejects mixed-number ambiguity%s', s => expect(() => parse(s)).toThrow(/Mixed/));
  it.each(['s{+1}', '{s+1}s', '{-2}s'])('rejects hidden formatting groups%s', s => expect(() => parse(s)).toThrow(/visible parentheses/));
  it.each(['2^12', 's^12', 's^-2'])('rejects a malformed exponent tail%s', s => expect(() => parse(s)).toThrow(/power button/));
  it('keeps explicit arithmetic, signed fractions and properly boxed powers', () => {
    expect(parse('2+\\frac12').map(textR)).toEqual(['5/2']); expect(parse('-\\frac12').map(textR)).toEqual(['-1/2']);
    expect(parse('2^{12}').map(textR)).toEqual(['4096']); expect(parse('2^{-2}').map(textR)).toEqual(['1/4']);
    expect(parse('s(s+1)').map(textR)).toEqual(['0', '1', '1']);
  });
  it.each(['1e-2', '\\frac(1)(2)', '1/(s+1)', '0^0', '\\sqrt{s}', 's^5'])('rejects unsupported form%s', s => expect(() => parse(s)).toThrow());
});
