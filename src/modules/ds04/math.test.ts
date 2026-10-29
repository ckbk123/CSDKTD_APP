import { describe, expect, it } from 'vitest';
import { analyze, boundaryInfo, compare, constraints, exactText, gainRegions, numberOf, parseModel, parsePolynomial, polynomialRoots, rational, sampleLocus } from './math';

const baseline = () => parseModel('z+0.2', 'z(z-1)');
const regionText = (model: ReturnType<typeof parseModel>) => gainRegions(model).stable.map(r => [r.lower ? exactText(r.lower) : '-infinity', r.upper ? exactText(r.upper) : 'infinity']);
describe('DS04 bounded exact polynomial entry', () => {
  it('expands factors and visual fractions into exact coefficients', () => {
    expect(parsePolynomial('D(z)=z(z-1)').map(exactText)).toEqual(['0', '-1', '1']);
    expect(parsePolynomial(String.raw`N\left(z\right)=z+\frac15`).map(exactText)).toEqual(['1/5', '1', '0']);
    for (const text of [String.raw`\frac12`, String.raw`\frac1{2}`, String.raw`\frac{1}2`, String.raw`\dfrac{1}{2}`]) expect(parsePolynomial(`z+${text}`)[0]).toEqual(rational(1, 2));
    expect(parsePolynomial('(z-.1)(z+.1)')[0]).toEqual(rational(-1, 100));
  });
  it.each(['', 'z^3', 'Kz', 'z+NaN', '1/z', 'z+1/0', 'z+sin(z)', 'z+1000', 'z+0.0000001', 'z+0.1234567', 'z+1234567890', 'z+(1', 'z^2+' + '('.repeat(13) + '1' + ')'.repeat(13), 'z+'.repeat(160)])('rejects malformed/unsupported/resource-limited input %s', text => expect(() => parsePolynomial(text)).toThrow());
  it('requires a monic quadratic denominator and proper/biproper numerator', () => {
    expect(() => parseModel('1', 'z+1')).toThrow('monic quadratic');
    expect(() => parseModel('1', '2z^2+1')).toThrow('monic quadratic');
    expect(() => parseModel('z^3', 'z^2')).toThrow();
    expect(parseModel('0', 'z^2').numerator.every(q => q.n === 0n)).toBe(true);
  });
});
describe('DS04 complete exact gain partition', () => {
  it('derives the baseline independently from P=z²+(K-1)z+K/5', () => {
    const m = baseline(), partition = gainRegions(m);
    expect(constraints(m).map(q => [q.name, exactText(q.constant), exactText(q.slope)])).toEqual([
      ['a', '1', '0'], ['P(+1)', '0', '6/5'], ['P(-1)', '2', '-4/5'], ['a-c', '1', '-1/5'],
    ]);
    expect(partition.critical.map(exactText)).toEqual(['0', '5/2', '5']);
    expect(regionText(m)).toEqual([['0', '5/2']]);
    expect(partition.regions.map(r => r.stable)).toEqual([false, true, false, false]);
    expect(boundaryInfo(m, rational(0)).kinds).toContain('z=+1');
    const upper = boundaryInfo(m, rational(5, 2));
    expect(upper.kinds).toContain('z=-1'); expect(upper.roots.finite).toEqual([{ re: -1, im: 0 }, { re: -.5, im: 0 }]);
    expect(boundaryInfo(m, rational(5)).kinds).toContain('a=c equality; no complex unit-circle pair');
  });
  it('finds a changed complex crossing and excludes its exact gain', () => {
    const m = parseModel('z+.5', 'z(z-1)');
    expect(regionText(m)).toEqual([['0', '2']]);
    const crossing = boundaryInfo(m, rational(2));
    expect(crossing.kinds).toContain('complex conjugate unit-circle pair');
    expect(crossing.angle).toBeCloseTo(2 * Math.PI / 3, 14);
    expect(crossing.roots.finite[0].re).toBe(-.5);
    expect(crossing.roots.finite[0].im).toBeCloseTo(Math.sqrt(3) / 2, 14);
    expect(crossing.classification).toContain('boundary');
    expect(regionText(parseModel('z+.1', 'z(z-1)'))).toEqual([['0', '20/9']]);
  });
  it('reports two disconnected stable intervals instead of one maximum gain', () => {
    // Roots: 0 and -K/[2(1-K)]. |K/[2(1-K)]|<1 iff K<2/3 or K>2.
    const m = parseModel('-z^2+.5z', 'z^2');
    expect(regionText(m)).toEqual([['-infinity', '2/3'], ['2', 'infinity']]);
    const singular = boundaryInfo(m, rational(1));
    expect(singular.classification).toContain('singular'); expect(singular.roots.atInfinity).toBe(1);
    expect(singular.roots.finite).toEqual([{ re: -0, im: 0 }]);
    for (const k of [-10, 0, .5, .8, 1, 1.5, 3, 10]) expect(analyze(m, k).classification === 'strictly stable').toBe(k < 2 / 3 || k > 2);
  });
  it('keeps fixed boundary modes and degenerate feedback explicit', () => {
    const fixed = parseModel('z-1', 'z(z-1)');
    expect(gainRegions(fixed).identities).toContain('P(+1)'); expect(gainRegions(fixed).stable).toHaveLength(0);
    const scaled = parseModel('-z^2', 'z^2');
    expect(regionText(scaled)).toEqual([['-infinity', '1'], ['1', 'infinity']]);
    expect(boundaryInfo(scaled, rational(1)).roots.identicallyZero).toBe(true);
    expect(analyze(scaled, 1).classification).toContain('singular');
    expect(regionText(parseModel('0', 'z^2+.2'))).toEqual([['-infinity', 'infinity']]);
    expect(regionText(parseModel('0', 'z^2+2'))).toEqual([]);
    expect(gainRegions(parseModel('z', 'z^2+1')).identities).toContain('a-c');
  });
  it('keeps close rational critical gains distinct without a tolerance merge', () => {
    // P(+1) and P(-1) reach zero at distinct rational values even if close.
    const m = parseModel('-z^2+z/100000000', 'z^2');
    const set = gainRegions(m);
    expect(set.critical).toHaveLength(3);
    expect(compare(set.critical[0], set.critical[1])).toBe(-1);
    expect(compare(set.critical[1], set.critical[2])).toBe(-1);
    expect(set.stable).toHaveLength(2);
  });
  it('matches full-root tests for independently generated changed families', () => {
    for (const numerator of ['z+.2', '-z^2+.5z', '.3z^2-.4z+.1', '1', '0']) for (const denominator of ['z^2', 'z^2-z', 'z^2+.4z-.2', '(z-.3)^2']) {
      const m = parseModel(numerator, denominator), partition = gainRegions(m);
      for (const region of partition.regions) {
        const r = analyze(m, region.probe);
        // A fixed z=1 mode can round a few ulps inward; keep a 1e-10 disk margin.
        expect(r.roots.finite.every(z => Math.hypot(z.re, z.im) < 1 - 1e-10) && r.a !== 0, `${numerator} / ${denominator}, K=${exactText(region.probe)}, radii=${r.radii}`).toBe(region.stable);
        for (const z of r.roots.finite) {
          const scale = Math.max(1, Math.abs(r.a) * Math.hypot(z.re, z.im) ** 2, Math.abs(r.b) * Math.hypot(z.re, z.im), Math.abs(r.c));
          expect(Math.abs(r.a * (z.re ** 2 - z.im ** 2) + r.b * z.re + r.c) / scale).toBeLessThan(1e-12);
          expect(Math.abs(2 * r.a * z.re * z.im + r.b * z.im) / scale).toBeLessThan(1e-12);
        }
      }
    }
  });
});
describe('DS04 numerical roots and sampled illustration', () => {
  it('retains infinity and identically-zero distinctions at degree loss', () => {
    expect(polynomialRoots(0, 2, -1)).toEqual({ finite: [{ re: .5, im: 0 }], atInfinity: 1, identicallyZero: false });
    expect(polynomialRoots(0, 0, 1)).toEqual({ finite: [], atInfinity: 2, identicallyZero: false });
    expect(polynomialRoots(0, 0, 0).identicallyZero).toBe(true);
    expect(polynomialRoots(1, 10000, .01).finite[1].re).toBeCloseTo(-.0000010000000001, 15);
  });
  it('preserves near-repeated unit roots and very small crossing angles', () => {
    // (z−1)(z−(1−1e−8)): a floating discriminant can collapse these modes.
    const close = analyze(parseModel('0', 'z^2+(-2+1/100000000)z+(1-1/100000000)'), 0);
    expect(close.roots.finite.map(z => z.re).sort((a, b) => a - b)[0]).toBeCloseTo(.99999999, 14);
    expect(close.roots.finite.map(z => z.re).sort((a, b) => a - b)[1]).toBeCloseTo(1, 14);
    // At K=1e8, a=c=100000001 and b=−2a+1e−8, so theta≈1e−8.
    const tiny = boundaryInfo(parseModel('z^2-2z+(1+1/100000000)', 'z^2+(-2+1/100000000)z'), rational(100000000));
    expect(tiny.angle).toBeCloseTo(9.99999995e-9, 20);
    expect(tiny.roots.finite[0].im).toBeCloseTo(9.99999995e-9, 20);
    expect(tiny.kinds).toContain('complex conjugate unit-circle pair');
  });
  it('includes every selected root and breaks across an algebraic singularity', () => {
    const m = parseModel('-z^2+.5z', 'z^2'), curves = sampleLocus(m, 0, 2, 5);
    expect(curves).toHaveLength(2); expect(curves.every(b => b.includes(null))).toBe(true);
    expect(curves[0][0]).toEqual({ re: 0, im: 0 });
    const baseCurves = sampleLocus(baseline(), 0, 2.5, 101);
    expect(baseCurves.every(b => b.length === 101)).toBe(true);
    expect(baseCurves.map(b => b[100]!.re).sort((a, b) => a - b)).toEqual([-1, -.5]);
  });
  it.each([NaN, Infinity, -101, 101])('rejects invalid selected K %s', k => expect(() => analyze(baseline(), k)).toThrow());
  it('bounds locus work and validates gain range', () => {
    expect(() => sampleLocus(baseline(), 1, 0)).toThrow(); expect(() => sampleLocus(baseline(), 0, 1, 1002)).toThrow();
    expect(numberOf(rational(20, 9))).toBeCloseTo(20 / 9, 14);
  });
});
