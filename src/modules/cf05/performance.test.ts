import { describe, expect, it } from 'vitest';
import { rat } from './exact';
import { parsePolynomial as p } from './expression';
import { applyM, exponential, tailCertificate } from './linear';
import { createLoop, equivalentSecondOrder, estimateEligibility, frequency, frequencyAnalysis, hurwitz, magnitudeSquared, moveRealZero, standardStep, stepResponse } from './performance';
import { positiveRoots, roots } from './spectral';
const baseline = () => createLoop(p('12(s+8/3)'), p('s(s+2)(s+6)'));
const second = () => createLoop(p('4'), p('s(s+2)'));
describe('CF05 independent complete response and frequency fixtures', () => {
  it('retains the S08 complete characteristic, pair, third pole and zero', () => {
    const loop = baseline(); expect(loop.characteristic.map(c => Number(c.n) / Number(c.d))).toEqual([32, 24, 8, 1]);
    expect(loop.poles).toHaveLength(3); expect(loop.poles[0].re).toBeCloseTo(-4, 9); expect(loop.poles[1].re).toBeCloseTo(-2, 9); expect(Math.abs(loop.poles[1].im)).toBeCloseTo(2, 9);
    expect(loop.zeros[0].re).toBeCloseTo(-8 / 3, 12); expect(loop.stable).toBe(true);
  });
  it('matches the independently derived S08 partial-fraction step identity', () => {
    const result = stepResponse(baseline(), 10);
    for (const t of [.5, 1, 2, 4]) {
      const actual = result.points.find(s => Math.abs(s.t - t) < 1e-10)!;
      const expected = 1 + .5 * Math.exp(-4 * t) - Math.exp(-2 * t) * (1.5 * Math.cos(2 * t) + .5 * Math.sin(2 * t));
      expect(actual.y).toBeCloseTo(expected, 10);
    }
    expect(result.final).toBe(1); expect(result.overshoot).toBeCloseTo(7.925, 2); expect(result.tailCertified).toBe(true); expect(result.settling).toBeGreaterThan(1);
  });
  it('recovers canonical second-order crossover, PM, bandwidth, overshoot and sampled settling', () => {
    const loop = second(), f = frequencyAnalysis(loop), wc = Math.sqrt(Math.sqrt(20) - 2), wb = 2 * Math.sqrt(.5 + Math.sqrt(1.25));
    expect(f.crossovers).toHaveLength(1); expect(f.crossovers[0].omega).toBeCloseTo(wc, 9); expect(f.crossovers[0].margin).toBeCloseTo(Math.atan(2 / wc) * 180 / Math.PI, 8);
    expect(f.bandwidths).toHaveLength(1); expect(f.bandwidth).toBeCloseTo(wb, 9); expect(estimateEligibility(loop, f)).toBeUndefined();
    for (const route of ['crossover', 'bandwidth'] as const) {
      const e = equivalentSecondOrder(f.crossovers[0].margin!, route === 'crossover' ? wc : wb, route);
      expect(e.zeta).toBeCloseTo(.5, 9); expect(e.wn).toBeCloseTo(2, 9); expect(e.overshoot).toBeCloseTo(100 * Math.exp(-Math.PI / Math.sqrt(3)), 8); expect(e.settling).toBeCloseTo(4, 8);
      expect(standardStep(e, 1)).toBeCloseTo(1 - Math.exp(-1) * (Math.cos(Math.sqrt(3)) + Math.sin(Math.sqrt(3)) / Math.sqrt(3)), 9);
    }
    const response = stepResponse(loop, 12); expect(response.overshoot).toBeCloseTo(16.30335, 3);
    // Solve the final 2% crossing from the independent analytic step identity.
    let lo = 4, hi = 4.2; for (let i = 0; i < 60; i++) { const t = (lo + hi) / 2, error = Math.exp(-t) * (Math.cos(Math.sqrt(3) * t) + Math.sin(Math.sqrt(3) * t) / Math.sqrt(3)); if (error > .02) lo = t; else hi = t; }
    expect(response.settling).toBeCloseTo((lo + hi) / 2, 4);
  });
  it('computes a changed first-order closed-loop response and excludes a zero-frequency gain crossing', () => {
    const loop = createLoop(p('1'), p('s+1')), f = frequencyAnalysis(loop), step = stepResponse(loop, 8);
    expect(f.crossovers).toHaveLength(0); expect(f.bandwidth).toBeCloseTo(2, 9); expect(f.dc).toBe(.5);
    expect(step.points[500].y).toBeCloseTo(.5 * (1 - Math.exp(-2 * step.points[500].t)), 11); expect(step.settling).toBeCloseTo(-Math.log(.02) / 2, 4);
  });
  it('handles exact repeated quartic modes without unstable residue subtraction', () => {
    const loop = createLoop(p('1'), p('s^4+4s^3+6s^2+4s')), step = stepResponse(loop, 20);
    expect(loop.poles).toHaveLength(1); expect(loop.poles[0].multiplicity).toBe(4); expect(loop.poles[0].re).toBe(-1);
    for (const t of [1, 2, 5, 10]) { const at = step.points.find(s => Math.abs(s.t - t) < 1e-10)!; expect(at.y).toBeCloseTo(1 - Math.exp(-t) * (1 + t + t * t / 2 + t ** 3 / 6), 10); }
    expect(step.tailCertified).toBe(true); expect(step.observedOvershoot).toBe(0);
  });
  it('changes gain, zero and a DC-normalized added loop pole from actual coefficients', () => {
    const original = baseline(), scaled = createLoop(original.n, original.d, 2), added = createLoop(original.n, original.d, 1, .5);
    expect(scaled.characteristic.map(c => Number(c.n) / Number(c.d))).toEqual([64, 36, 8, 1]); expect(added.d.length).toBe(5);
    expect(added.n.map(c => Number(c.n) / Number(c.d))).toEqual([16, 6]);
    const changed = moveRealZero(original.n, 4); expect(changed.map(c => Number(c.n) / Number(c.d))).toEqual([32, 8]); expect(createLoop(changed, original.d).zeros[0].re).toBe(-4);
    expect(frequency(added.n, added.d, .1)!.re).not.toBeCloseTo(frequency(original.n, original.d, .1)!.re, 3);
  });
  it('does not certify settling from a short horizon even if the trace enters the band', () => {
    const short = stepResponse(second(), 1); expect(short.settling).toBeUndefined(); expect(short.overshoot).toBeUndefined(); expect(short.tailCertified).toBe(false); expect(short.reason).toContain('not established');
    expect(stepResponse(second(), 12).settling).toBeDefined();
  });
  it('keeps unstable retained modes and boundary/zero-final responses distinct from settled metrics', () => {
    const hidden = createLoop(p('s-1'), p('(s-1)(s+2)')); expect(hidden.stable).toBe(false); expect(hidden.poles.some(r => r.re > 0)).toBe(true);
    const response = stepResponse(hidden, 5); expect(response.final).toBeUndefined(); expect(response.reason).toContain('not strictly stable');
    const boundary = createLoop(p('1'), p('s^2')); expect(boundary.stable).toBe(false); expect(stepResponse(boundary, 5).settling).toBeUndefined();
    const zeroFinal = createLoop(p('s'), p('s^2+2s+1')); expect(stepResponse(zeroFinal, 10).reason).toContain('Final output is zero');
  });
  it('does not offer an equivalent minimum-phase estimate for an inverse response', () => {
    const loop = createLoop(p('1-s/10'), p('s(s+2)')), f = frequencyAnalysis(loop); expect(loop.stable).toBe(true); expect(estimateEligibility(loop, f)).toContain('nonminimum-phase');
  });
  it('builds squared-frequency equations with exact coefficient identities', () => {
    const actual = magnitudeSquared(p('s^3+2s^2+3s+4')); // (4-2x)^2+x(3-x)^2
    expect(actual.map(c => Number(c.n) / Number(c.d))).toEqual([16, -7, -2, 1]);
  });
  it.each(['0', '-1', 's^2+1', 's^3+s^2+s+1', 's^4+2s^3+3s^2+2s+1'])('uses exact strict Hurwitz tests for%s', text => {
    const q = p(text, true); if (q.length < 2) expect(() => hurwitz(q)).toThrow(); else expect(hurwitz(q)).toBe(text.startsWith('s^4'));
  });
  it('rejects unsupported orders, improper inputs, geometry/effort and estimate assumptions', () => {
    expect(() => createLoop(p('s'), p('s'))).toThrow('strictly proper'); expect(() => createLoop(p('1'), p('1'))).toThrow('degree1–4');
    expect(() => createLoop(p('1'), p('(s+1)^4'), 1, .2)).toThrow('degree at most3'); expect(() => createLoop(p('1'), p('s+1'), 0)).toThrow('gain');
    expect(() => stepResponse(second(), .01)).toThrow('horizon'); expect(() => stepResponse(second(), 1000)).toThrow('20,000');
    expect(() => equivalentSecondOrder(90, 1, 'crossover')).toThrow(); expect(() => equivalentSecondOrder(80, 1, 'bandwidth')).toThrow('underdamped');
  });
});
describe('independent root/crossing/state checks', () => {
  it('isolates every positive real crossing including tangencies while rejecting nearby complex lookalikes', () => {
    expect(positiveRoots(p('(s-1)^2(s-3)(s+2)'))).toEqual(expect.arrayContaining([expect.closeTo(1, 8), expect.closeTo(3, 8)]));
    expect(positiveRoots(p('s^2-2s+1.001'))).toEqual([]); expect(positiveRoots(p('s(s-2)'))).toEqual([expect.closeTo(2, 8)]);
    expect(() => positiveRoots(p('0', true))).toThrow('identically');
  });
  it('reconstructs independently chosen simple, repeated and conjugate quartic modes', () => {
    const qs = ['(s+1)(s+2)(s+3)(s+4)', '(s+1)^2(s^2+4s+8)', '(s^2+2s+2)(s^2+6s+13)', 's(s+1)(s^2+4s+8)'];
    for (const q of qs) { const r = roots(p(q)); expect(r.reduce((n, z) => n + z.multiplicity, 0)).toBe(4); expect(r.every(z => z.residual <= 1e-10)).toBe(true); }
    const repeated = roots(p('(s+1)^2(s^2+4s+8)')); expect(repeated.find(z => Math.abs(z.re + 1) < 1e-9)!.multiplicity).toBe(2);
  });
  it('propagates nilpotent and rotation states independently of a solver', () => {
    const jordan = exponential([[0, 1], [0, 0]], 3); expect(jordan).toEqual([[1, 3], [0, 1]]);
    const x = applyM(exponential([[0, -2], [2, 0]], .4), [1, 0]); expect(x[0]).toBeCloseTo(Math.cos(.8), 13); expect(x[1]).toBeCloseTo(Math.sin(.8), 13);
  });
  it('provides an all-future Lyapunov bound for stable states only', () => {
    const bound = tailCertificate([[-2]], [3]); expect(bound?.([.5])).toBeCloseTo(1.5, 12); expect(tailCertificate([[1]], [1])).toBeUndefined();
  });
  it.each([String.raw`\frac1\;2`, String.raw`\displaystyle2^\;2`, '2^12', String.raw`2\frac12`, '1{+2}', '1e-2'])('rejects displayed-meaning ambiguity%s', text => expect(() => p(text)).toThrow());
  it('preserves proper compact and braced fraction/power controls', () => {
    expect(p(String.raw`\frac12`)).toEqual([rat(1, 2)]); expect(p(String.raw`\frac1{\;2}`)).toEqual([rat(1, 2)]); expect(p('2^{12}')).toEqual([rat(4096)]);
  });
});
