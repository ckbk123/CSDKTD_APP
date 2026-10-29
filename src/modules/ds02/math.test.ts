import { describe, expect, it } from 'vitest';
import { at, cmp, conditions, decimal, exact, intersect, intervalText, num, parseFamily, parseNumber, rat, roots } from './math';

describe('quadratic Jury interval: independent analytic fixtures', () => {
  it('derives all four baseline constraints and their strict intersection', () => {
    const f = parseFamily('P(z)=z^2+(K-1)z+0.2K');
    expect(conditions(f).map(c => [exact(c.slope), exact(c.offset)])).toEqual([['6/5', '0'], ['-4/5', '2'], ['-1/5', '1'], ['1/5', '1']]);
    expect(intervalText(intersect(conditions(f)))).toBe('0 < K < 5/2');
    // K=1 gives z²+.2: roots ±j/√5, row [.96,0,0].
    const mid = at(f, rat(1));
    expect(mid.stable).toBe(true);
    expect(mid.roots[0].re).toBeCloseTo(0, 13);
    expect(Math.abs(mid.roots[0].im)).toBeCloseTo(1 / Math.sqrt(5), 13);
    expect(mid.row.map(exact)).toEqual(['24/25', '0', '0']);
    expect(at(f, rat(0)).roots.map(r => r.re).sort((a, b) => a - b)).toEqual([0, 1]);
    const end = at(f, rat(5, 2));
    expect(end.roots.map(r => r.re).sort((a, b) => a - b)).toEqual([-1, -.5]);
    expect(end.boundary).toBe(true);
    expect(end.stable).toBe(false);
    expect(at(f, rat(3)).stable).toBe(false);
    expect(at(f, rat(-1)).stable).toBe(false);
  });
  it('computes the W13 changed coefficient, not the baseline interval', () => {
    const f = parseFamily('z^{2}+(K-1)z+\\frac{K}{10}');
    expect(intervalText(intersect(conditions(f)))).toBe('0 < K < 20/9');
    const end = at(f, rat(20, 9));
    expect(end.roots.map(r => r.re).sort((a, b) => a - b)[0]).toBeCloseTo(-1, 13);
    expect(end.roots.map(r => r.re).sort((a, b) => a - b)[1]).toBeCloseTo(-2 / 9, 13);
    expect(end.stable).toBe(false);
  });
  it('supports changed intercepts, negative slopes, empty and universal sets', () => {
    expect(intervalText(intersect(conditions(parseFamily('z^2+Kz+0.5'))))).toBe('-3/2 < K < 3/2');
    expect(intervalText(intersect(conditions(parseFamily('z^2-0.5'))))).toBe('All real K');
    expect(intervalText(intersect(conditions(parseFamily('z^2+2'))))).toBe('No strictly stable K');
    expect(intersect([{ slope: rat(1), offset: rat(0) }, { slope: rat(-1), offset: rat(0) }]).empty).toBe(true);
    expect(intervalText(intersect([{ slope: rat(-2), offset: rat(3) }]))).toBe('K < 3/2');
    expect(intervalText(intersect([{ slope: rat(2), offset: rat(3) }]))).toBe('K > -3/2');
    expect(intersect([{ slope: rat(0), offset: rat(0) }]).empty).toBe(true);
  });
  it('derives an independent family with changed slopes and intercepts in both coefficients', () => {
    // P(1)=11/10+3K/5, P(-1)=3/2-2K/5; product bounds are redundant.
    const f = parseFamily('z^2+(0.5K-0.2)z+(0.1K+0.3)');
    expect(intervalText(intersect(conditions(f)))).toBe('-11/6 < K < 15/4');
    // Endpoint factorizations: (z-1)(z-7/60), (z+1)(z+27/40).
    const low = at(f, rat(-11, 6)), high = at(f, rat(15, 4));
    expect(low.roots.map(r => r.re).sort((a, b) => a - b)[0]).toBeCloseTo(7 / 60, 13);
    expect(low.roots.map(r => r.re).sort((a, b) => a - b)[1]).toBeCloseTo(1, 13);
    expect(high.roots.map(r => r.re).sort((a, b) => a - b)[0]).toBeCloseTo(-1, 13);
    expect(high.roots.map(r => r.re).sort((a, b) => a - b)[1]).toBeCloseTo(-27 / 40, 13);
    expect(low.stable || high.stable).toBe(false);
    expect(at(f, rat(0)).stable).toBe(true);
  });
  it('handles conjugate and repeated boundary roots and Jury singular rows', () => {
    for (const expression of ['z^2+1', 'z^2-2z+1', 'z^2+2z+1', 'z^2-1']) {
      const r = at(parseFamily(expression), rat(0));
      expect(r.stable).toBe(false);
      expect(r.boundary).toBe(true);
      expect(r.roots.every(z => Math.abs(Math.hypot(z.re, z.im) - 1) < 1e-12)).toBe(true);
      expect(r.row[0].n).toBe(0n);
    }
    expect(at(parseFamily('z^2+3z+1'), rat(0)).boundary).toBe(false);
    expect(roots(0, 0)).toEqual([{ re: 0, im: 0 }, { re: 0, im: 0 }]);
  });
  it('checks roots against polynomial residual and Vieta on changed data', () => {
    for (const [b, a] of [[-1.2, .32], [4, -2], [.3, .9], [10000, .000001], [2, 1]]) {
      const rs = roots(b, a);
      expect(rs[0].re + rs[1].re).toBeCloseTo(-b, 9);
      expect(rs[0].re * rs[1].re - rs[0].im * rs[1].im).toBeCloseTo(a, 9);
      for (const z of rs) {
        const re = z.re ** 2 - z.im ** 2 + b * z.re + a, im = 2 * z.re * z.im + b * z.im;
        expect(Math.hypot(re, im) / (1 + Math.abs(b) * Math.hypot(z.re, z.im) + Math.abs(a) + z.re ** 2 + z.im ** 2)).toBeLessThan(1e-12);
      }
    }
  });
});

describe('bounded visual polynomial parser and rational arithmetic', () => {
  it('accepts textbook grouping, multiplication, decimals and constant fractions', () => {
    const f = parseFamily(String.raw`P(z)=z^{2}+\left(\frac{K}{2}-1\right)\cdot z+\frac{1}{5}K`);
    expect(exact(f.b.slope)).toBe('1/2');
    expect(exact(f.a.slope)).toBe('1/5');
    expect(exact(decimal('-.25'))).toBe('-1/4');
    expect(cmp(rat(2, 4), rat(1, 2))).toBe(0);
    expect(num(rat(-2, -5))).toBe(.4);
  });
  it.each(['', 'z^3+K', '2z^2+K', 'Kz^2+z+1', 'z^2+K^2', 'z^2+1/K', 'z^2+1/0', 'z^2+\\sin(K)', 'z^2+NaN', 'z^2+1e10', 'z^2+(K', 'z^2+K+', 'z^2+10001', 'z^2+0.0000001', 'z^2+\\placeholder{}', 'z^2+'+'('.repeat(20)+'1'+')'.repeat(20), 'z'.repeat(401)])('rejects unsupported or malformed input %s', source => {
    expect(() => parseFamily(source)).toThrow();
  });
  it('bounds selected gain and rejects nonfinite numerics', () => {
    expect(() => at(parseFamily('z^2+K'), decimal('10001'))).toThrow();
    expect(() => decimal('Infinity')).toThrow();
    expect(() => roots(NaN, 1)).toThrow();
    expect(exact(parseNumber('20/9'))).toBe('20/9');
    expect(exact(parseNumber('-.25/0.5'))).toBe('-1/2');
    expect(() => parseNumber('1/2/3')).toThrow();
    expect(() => parseNumber('1/0')).toThrow();
    expect(() => rat(10n ** 25n)).toThrow();
    expect(() => at(parseFamily('z^2+K'), parseNumber('10000000000000000000001/1000000000000000000'))).toThrow();
  });
});
