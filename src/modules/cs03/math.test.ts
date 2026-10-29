import { describe, expect, it } from 'vitest';
import { analyze, checkPrediction, cubicRoots, fromNumber, interval, numberOf, parseDenominator, parseModel, q, textOf } from './math';

const baseline = () => parseModel('D(s)=s(s+2)(s+5)', 1);
const endpoints = (source: string, g = 1) => {
  const set = interval(parseModel(source, g));
  return set.kind === 'finite' ? [textOf(set.lower!), textOf(set.upper!)] : set.kind;
};
function matchRoots(actual: readonly { re: number; im: number }[], expected: readonly (readonly [number, number])[]) {
  const left = [...actual];
  for (const [re, im] of expected) {
    const index = left.findIndex(z => Math.hypot(z.re - re, z.im - im) < 2e-9 * Math.max(1, Math.abs(re), Math.abs(im)));
    expect(index, `Missing ${re}+${im}j from ${JSON.stringify(actual)}`).toBeGreaterThanOrEqual(0); left.splice(index, 1);
  }
  expect(left).toHaveLength(0);
}

describe('exact complete cubic gain regions', () => {
  it('derives the baseline and every endpoint mode independently from factors', () => {
    const m = baseline(); expect(endpoints('s^3+7s^2+10s')).toEqual(['0', '70']);
    const atZero = analyze(m, 0), atSeventy = analyze(m, 70);
    matchRoots(atZero.roots, [[0, 0], [-2, 0], [-5, 0]]);
    matchRoots(atSeventy.roots, [[-7, 0], [0, Math.sqrt(10)], [0, -Math.sqrt(10)]]);
    expect(atZero.formalStable).toBe(false); expect(atSeventy.formalStable).toBe(false);
    expect(atZero.structure).toContain('s(s²'); expect(atSeventy.structure).toContain('(s+a)');
    expect(analyze(m, 10).formalStable).toBe(true);
    expect(analyze(m, 80).rightCount).toBe(2); expect(analyze(m, -1).rightCount).toBe(1);
    expect(analyze(m, 80).signChanges).toBe(2); expect(analyze(m, -1).signChanges).toBe(1);
  });
  it('computes the W06 change rather than retaining the baseline', () => {
    const m = parseModel('s^3+6s^2+8s', 1);
    expect(endpoints('s^3+6s^2+8s')).toEqual(['0', '48']);
    matchRoots(analyze(m, 48).roots, [[-6, 0], [0, Math.sqrt(8)], [0, -Math.sqrt(8)]]);
    expect(analyze(m, 49).rightCount).toBe(2);
  });
  it('reverses polarity and translates both endpoints for changed feedback data', () => {
    expect(endpoints('s^3+7s^2+10s', -1)).toEqual(['-70', '0']);
    expect(endpoints('s^3+7s^2+10s+1')).toEqual(['-1', '69']);
    expect(endpoints('s^3+7s^2+10s+1', -2)).toEqual(['-69/2', '1/2']);
    expect(analyze(parseModel('s^3+7s^2+10s+1', -2), -10).formalStable).toBe(true);
  });
  it('retains exact fractional endpoints that binary floating point cannot represent', () => {
    expect(endpoints('s^3+s^2+s+0.1', .3)).toEqual(['-1/3', '3']);
    const m = parseModel('s^3+s^2+s+0.1', .3), lower = interval(m).lower!;
    expect(analyze(m, lower).c.n).toBe(0n); matchRoots(analyze(m, lower).roots, [[0, 0], [-.5, Math.sqrt(3) / 2], [-.5, -Math.sqrt(3) / 2]]);
  });
  it('handles gain-independent stable, unstable and boundary polynomials', () => {
    expect(endpoints('(s+1)(s+2)(s+3)', 0)).toBe('all');
    expect(endpoints('s^3+7s^2+10s', 0)).toBe('empty');
    expect(endpoints('s^3+7s^2+10s+70', 0)).toBe('empty');
    expect(endpoints('s^3+7s^2+10s+80', 0)).toBe('empty');
  });
  it.each(['s^3-2s^2+3s', 's^3+2s^2-3s', 's^3+3s', 's^3+3s^2'])('reports an empty set when a necessary coefficient fails: %s', source => {
    expect(endpoints(source)).toBe('empty');
  });
  it('does not divide by a zero Routh pivot', () => {
    const result = analyze(parseModel('s^3+4s+1', 1), 0);
    expect(result.firstColumn).toBeNull(); expect(result.formalStable).toBe(false); expect(result.roots).toHaveLength(3);
  });
  it('keeps the exact stability decision when tiny roots are inside the numerical axis tolerance', () => {
    const stable = analyze(baseline(), 1e-100), unstable = analyze(baseline(), -1e-100);
    expect(stable.formalStable).toBe(true); expect(stable.nearAxis).toBe(true);
    expect(unstable.formalStable).toBe(false); expect(unstable.signChanges).toBe(1); expect(unstable.nearAxis).toBe(true);
  });
  it('supports global endpoint checks beyond the manual selected-gain range', () => {
    const m = parseModel('s^3+10s^2+10s', 1e-8), set = interval(m);
    expect(textOf(set.upper!)).toBe('10000000000');
    matchRoots(analyze(m, set.upper!).roots, [[-10, 0], [0, Math.sqrt(10)], [0, -Math.sqrt(10)]]);
  });
});

describe('all numerical cubic roots', () => {
  it.each([
    ['(s+1)(s+2)(s+3)', [[-1, 0], [-2, 0], [-3, 0]]],
    ['(s+2)(s^2+2s+5)', [[-2, 0], [-1, 2], [-1, -2]]],
    ['(s+1)^2(s+4)', [[-1, 0], [-1, 0], [-4, 0]]],
    ['(s+1)^3', [[-1, 0], [-1, 0], [-1, 0]]],
    ['s(s^2-4)', [[0, 0], [-2, 0], [2, 0]]],
    ['s^3', [[0, 0], [0, 0], [0, 0]]],
  ] as const)('agrees with independently factored roots: %s', (source, roots) => {
    matchRoots(analyze(parseModel(source, 0), 0).roots, roots);
  });
  it('retains tiny conjugate imaginary parts near a triple root', () => {
    const result = analyze(parseModel('(s+1)^3', 1), 1e-90);
    expect(Math.max(...result.roots.map(z => Math.abs(z.im))) / (Math.sqrt(3) / 2 * 1e-30)).toBeCloseTo(1, 12);
  });
  it('satisfies complex polynomial residuals and Vieta sums for changed families', () => {
    for (const a of [-3, .5, 7, 20]) for (const b of [-2, .25, 10]) for (const c of [-15, .1, 13, 100]) {
      const roots = cubicRoots(fromNumber(a), fromNumber(b), fromNumber(c)).roots;
      expect(roots.reduce((sum, z) => sum + z.re, 0)).toBeCloseTo(-a, 8);
      expect(roots.reduce((sum, z) => sum + z.im, 0)).toBeCloseTo(0, 10);
      for (const z of roots) {
        let re = 1, im = 0;
        for (const coefficient of [a, b, c]) { const next = re * z.re - im * z.im + coefficient; im = re * z.im + im * z.re; re = next; }
        const radius = Math.hypot(z.re, z.im), scale = Math.max(1, radius ** 3 + Math.abs(a) * radius ** 2 + Math.abs(b) * radius + Math.abs(c));
        expect(Math.hypot(re, im) / scale).toBeLessThan(2e-10);
      }
    }
  });
  it('converts balanced large exact ratios without Infinity/Infinity', () => {
    expect(numberOf(q(10n ** 500n + 1n, 10n ** 500n))).toBeCloseTo(1, 14);
    expect(() => q(2n ** 2050n)).toThrow('precision limit');
  });
});

describe('bounded visual polynomial grammar and scalar controls', () => {
  it.each([String.raw`D(s)=s^3+\frac12s^2+\frac{3}4s+\frac{1}{-2}`, 's^3+0.5s^2+.75s-.5', 's^3+(s^2/2)+(3s/4)-.5'])('reads equivalent exact signed fractions: %s', source => {
    expect(parseDenominator(source).map(textOf)).toEqual(['-1/2', '3/4', '1/2', '1']);
  });
  it.each(['s^4', '2s^3+s', 's^2+s', 's^3+1e-2', 's^3+K', 's^3+1/0', 's^3+1/s', 's^3+', 's^3+0.1234567', String.raw`s^3+\frac{1}{\frac12}`])('rejects unsupported or incomplete input: %s', source => {
    expect(() => parseDenominator(source)).toThrow();
  });
  it('bounds text, nesting, coefficient magnitude and native scalars', () => {
    expect(() => parseDenominator('s^3+' + '1+'.repeat(160) + '1')).toThrow('300');
    expect(() => parseDenominator('s^3+' + '('.repeat(13) + '1' + ')'.repeat(13))).toThrow('twelve');
    expect(() => parseModel('s^3+101s', 1)).toThrow('magnitudes');
    for (const g of [NaN, Infinity, 101, 1e-9]) expect(() => parseModel('s^3+s', g)).toThrow();
    for (const k of [NaN, Infinity, 1001]) expect(() => analyze(baseline(), k)).toThrow();
  });
});

describe('student interval answers', () => {
  const answer = { kind: 'finite' as const, lower: 0, upper: 70, lowerClosed: false, upperClosed: false };
  it('grades open endpoints and gives strict-boundary feedback', () => {
    expect(checkPrediction(baseline(), answer).correct).toBe(true);
    expect(checkPrediction(baseline(), { ...answer, upperClosed: true }).message).toContain('imaginary-axis');
    expect(checkPrediction(baseline(), { ...answer, upper: 71 }).correct).toBe(false);
    expect(() => checkPrediction(baseline(), { ...answer, lower: NaN })).toThrow();
  });
  it('checks reversed polarity, empty and all-real predictions', () => {
    expect(checkPrediction(parseModel('s^3+7s^2+10s', -1), { ...answer, lower: -70, upper: 0 }).correct).toBe(true);
    expect(checkPrediction(parseModel('(s+1)^3', 0), { ...answer, kind: 'all' }).correct).toBe(true);
    expect(checkPrediction(parseModel('s^3+s', 1), { ...answer, kind: 'empty' }).correct).toBe(true);
    expect(checkPrediction(baseline(), { ...answer, kind: 'empty' }).correct).toBe(false);
  });
});
