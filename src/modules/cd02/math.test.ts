import { describe, expect, it } from 'vitest';
import { checkEntryDeadline, cubicRoots, design, polynomialResidual, responseCoefficients, rootLocus, stepTrace, stepValue, targetFromSpecs } from './math';
const base = { g: 1, a: 2, sigma: 2, omega: 2, pole: 6 };
const near = (a: number, b: number, tolerance = 1e-9) => expect(Math.abs(a - b)).toBeLessThan(tolerance);

describe('lead design independently checked by geometry and polynomial expansion', () => {
  it('recovers the documented baseline and every retained pole', () => {
    const d = design(base); expect(d.coefficients).toEqual([1, 8, 24, 32]); near(d.gain, 12); near(d.zero, 8 / 3); near(d.remaining, 4); near(d.rampError, 3 / 8);
    near(d.deficiency * 180 / Math.PI, 45); near(d.magnitudeGain, 12); near(d.angleResidual, 0);
    const roots = cubicRoots(8, 24, 32);
    for (const [re, im] of [[-4, 0], [-2, 2], [-2, -2]]) expect(roots.some(r => Math.hypot(r.re - re, r.im - im) < 1e-8)).toBe(true);
  });
  it('derives a zero from the independent angle construction', () => {
    const d = design(base), angle = (135 + 90 + Math.atan(.5) * 180 / Math.PI - 180) * Math.PI / 180;
    near(2 + 2 / Math.tan(angle), d.zero);
  });
  it('changes the pole to −8 and recomputes the full result', () => {
    const d = design({ ...base, pole: 8 }); near(d.gain, 16); near(d.zero, 3); near(d.remaining, 6); near(d.rampError, 1 / 3); expect(d.coefficients).toEqual([1, 10, 32, 48]);
    near(responseCoefficients(d).A, .4); near(responseCoefficients(d).B, -1.4); near(responseCoefficients(d).D, -.2);
  });
  it('normalizes plant gain while preserving the closed-loop response', () => {
    const a = design(base), b = design({ ...base, g: 2 }); near(b.gain, 6); near(a.zero, b.zero); expect(a.coefficients).toEqual(b.coefficients);
    for (const t of [.1, .5, 1, 2, 5]) near(stepValue(a, t), stepValue(b, t));
  });
  it('retains the stable canceled mode and checks the resulting exact second-order response', () => {
    const d = design({ ...base, pole: 4 }); near(d.zero, 2); near(d.remaining, 2); near(d.gain, 8); near(responseCoefficients(d).A, 0);
    expect(d.coefficients).toEqual([1, 6, 16, 16]);
    near(stepValue(d, 1), 1 - Math.exp(-2) * (Math.cos(2) + Math.sin(2)));
  });
  it('translates independent second-order time specifications', () => {
    const t = targetFromSpecs(100 * Math.exp(-Math.PI), 2); near(t.sigma, 2); near(t.omega, 2);
    const changed = targetFromSpecs(5, 4); near(changed.sigma, 1); near(changed.omega, Math.PI / Math.log(20));
  });
  it.each([0, NaN, Infinity, 50])('rejects unsupported overshoot %s', n => expect(() => targetFromSpecs(n, 2)).toThrow());
  it.each([0, .3, 41, NaN])('rejects unsupported settling time %s', n => expect(() => targetFromSpecs(5, n)).toThrow());
  it.each([
    { g: 0 }, { g: NaN }, { a: 0 }, { a: 21 }, { sigma: 0 }, { omega: 0 }, { omega: Infinity }, { pole: 0 },
    { sigma: 4 }, { sigma: 10, pole: 2 }, { sigma: 1, omega: 1 }, { sigma: 1, omega: .1, pole: 6 },
  ])('rejects invalid, unstable-remaining or non-lead design %j', change => expect(() => design({ ...base, ...change })).toThrow());
});

describe('complete root-locus computation', () => {
  it.each([
    [6, 11, 6, [-1, -2, -3]], [3, 3, 1, [-1, -1, -1]], [0, -1, 0, [-1, 0, 1]],
  ] as [number, number, number, number[]][])('solves cubic with coefficients %s %s %s', (a, b, c, expected) => {
    const roots = cubicRoots(a, b, c).sort((r, s) => r.re - s.re);
    roots.forEach((r, i) => { near(r.re, expected.sort((x, y) => x - y)[i], 1e-7); near(r.im, 0, 1e-7); expect(polynomialResidual([1, a, b, c], r)).toBeLessThan(1e-8); });
  });
  it('computes all three branches from open-loop poles through the designed gain', () => {
    const d = design(base), locus = rootLocus(d, 60); expect(locus.branches).toHaveLength(3); expect(locus.branches.map(b => b[0].re)).toEqual([0, -2, -6]);
    const at = locus.gains.findIndex(g => g === 12);
    for (const branch of locus.branches) {
      expect(branch.length).toBe(locus.gains.length);
      branch.forEach((r, i) => expect(polynomialResidual([1, 8, 12 + locus.gains[i], 8 / 3 * locus.gains[i]], r)).toBeLessThan(1e-8));
    }
    near(locus.branches.reduce((sum, b) => sum + b[at].re, 0), -8);
    expect(locus.branches.some(b => Math.hypot(b[at].re + 2, b[at].im - 2) < 1e-7)).toBe(true);
  });
  it('always includes the design even if a shorter sweep was requested', () => expect(rootLocus(design(base), 1).gains.at(-1)).toBeGreaterThan(12));
  it('approaches the analytic zero and two vertical high-gain asymptotes', () => {
    const roots = cubicRoots(8, 12 + 10000, 10000 * 8 / 3);
    const real = roots.find(r => Math.abs(r.im) < 1e-8)!;
    near(real.re, -8 / 3, .001);
    for (const r of roots.filter(r => Math.abs(r.im) > 1)) near(r.re, -(8 - 8 / 3) / 2, .001);
    expect(roots.filter(r => Math.abs(r.im) > 90)).toHaveLength(2);
  });
  it.each([NaN, Infinity, -1, 10001])('rejects invalid gain range %s', n => expect(() => rootLocus(design(base), n)).toThrow());
  it('rejects nonfinite cubic data', () => expect(() => cubicRoots(NaN, 1, 2)).toThrow());
});

describe('full model and second-order approximation', () => {
  it('matches the independently inverted baseline transfer function', () => {
    const d = design(base); near(responseCoefficients(d).A, .5); near(responseCoefficients(d).B, -1.5); near(responseCoefficients(d).D, -.5);
    for (const t of [0, .01, .2, .5, 1, 2, 5]) near(stepValue(d, t), 1 + .5 * Math.exp(-4 * t) - Math.exp(-2 * t) * (1.5 * Math.cos(2 * t) + .5 * Math.sin(2 * t)));
  });
  it('matches the independently bracketed derivative zero and source-rounded overshoot', () => {
    let lo = 1, hi = 1.5;
    for (let n = 0; n < 60; n++) { const m = (lo + hi) / 2; if (Math.cos(2 * m) + 2 * Math.sin(2 * m) - Math.exp(-2 * m) > 0) lo = m; else hi = m; }
    const t = (lo + hi) / 2, expected = 100 * (.5 * Math.exp(-4 * t) - Math.exp(-2 * t) * (1.5 * Math.cos(2 * t) + .5 * Math.sin(2 * t)));
    const trace = stepTrace(design(base), 12); near(trace.overshoot, expected, .001); near(trace.overshoot, 7.925, .001);
    expect(trace.overshoot).toBeGreaterThan(100 * Math.exp(-Math.PI)); expect(trace.entry).not.toBeNull(); expect(trace.refinement).toBeLessThan(.001);
  });
  it('qualifies a short horizon and rejects excessive sample work', () => {
    expect(stepTrace(design(base), .5).entry).toBeNull();
    expect(() => stepTrace(design({ ...base, pole: 50 }), 200)).toThrow(/60,000/);
    expect(() => stepTrace(design(base), NaN)).toThrow();
  });
  it('does not fail a deadline inside the independently derived final band-crossing bracket', () => {
    // Independent inverse transform, not stepValue or the production residues.
    const y = (t: number) => 1 + .5 * Math.exp(-4 * t) - Math.exp(-2 * t) * (1.5 * Math.cos(2 * t) + .5 * Math.sin(2 * t));
    let lo = 2, hi = 2.2;
    for (let n = 0; n < 60; n++) { const t = (lo + hi) / 2; if (y(t) > 1.02) lo = t; else hi = t; }
    const crossing = (lo + hi) / 2;
    near(crossing, 2.0665872605835336, 1e-12);
    // The response decreases through this bracket; beyond 2.2 s its complete
    // exponential envelope is <2%, excluding any later departure in this fixture.
    expect(.5 * Math.exp(-4 * 2.2) + Math.sqrt(2.5) * Math.exp(-2 * 2.2)).toBeLessThan(.02);
    expect(crossing).toBeLessThan(2.067);
    const trace = stepTrace(design(base), 12), bracket = trace.entryBracket!;
    near(bracket[0], 2.0625); near(bracket[1], 2.06875);
    expect(y(bracket[0])).toBeGreaterThan(1.02); expect(y(bracket[1])).toBeLessThan(1.02);
    expect(bracket[0]).toBeLessThan(crossing); expect(bracket[1]).toBeGreaterThan(crossing);
    expect(checkEntryDeadline(trace, 2.067)).toBe('Unresolved');
    expect(checkEntryDeadline(trace, 2.05)).toBe('Fails deadline');
    expect(checkEntryDeadline(trace, 2.08)).toBe('Observed pass');
    expect(checkEntryDeadline(trace, bracket[0])).toBe('Fails deadline');
    expect(checkEntryDeadline(trace, bracket[1])).toBe('Observed pass');
  });
  it('keeps deadline results qualified across horizon and sample-spacing variations', () => {
    const steps = new Set<number>();
    for (const horizon of [2.58, 3, 5.019, 12, 12.003, 30.007, 200]) {
      const trace = stepTrace(design(base), horizon);
      steps.add(trace.time[1]);
      expect(trace.entryBracket).not.toBeNull();
      expect(checkEntryDeadline(trace, 2.067)).not.toBe('Fails deadline');
      expect(checkEntryDeadline(trace, 2.05)).toBe('Fails deadline');
      expect(checkEntryDeadline(trace, 2.08)).toBe('Observed pass');
    }
    expect(steps.size).toBeGreaterThan(1);
    const short = stepTrace(design(base), 2.4);
    expect(short.entryBracket).toBeNull(); expect(checkEntryDeadline(short, 2.067)).toBe('Unresolved');
    expect(checkEntryDeadline(stepTrace(design(base), 3), 4)).toBe('Unresolved');
  });
});
