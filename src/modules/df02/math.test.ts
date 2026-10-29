import { describe, expect, it } from 'vitest';
import { analyze, rationalLimit, roots, type Basis, type Reference } from './math';
import { parseForward } from './parser';
import { at, cancel, decimal, div, factorsAtOne, number, q } from './rational';

const solve = (plant = '0.1/(z-1)', reference: Reference = 'ramp', basis: Basis = 'physical', T = '0.1', h = '1', N = 80) => analyze(parseForward(plant), decimal(T), decimal(h), reference, basis, N);
const values = (plant: string) => { const f = parseForward(plant); return { n: f.numerator.map(number), d: f.denominator.map(number) }; };

describe('bounded exact visual rational grammar', () => {
  it('normalizes factored and expanded forms without snapping coefficients', () => {
    expect(values('L(z)=\\frac{.1}{z-1}')).toEqual({ n: [0.1], d: [-1, 1] });
    expect(values('(z+1)^2/(z+2)^2')).toEqual({ n: [1, 2, 1], d: [4, 4, 1] });
    expect(values('-(z+1)^2/(z+2)^2').n).toEqual([-1, -2, -1]);
    expect(values('1/(z^{-1})/(z+1)')).toEqual({ n: [0, 1], d: [1, 1] });
  });
  it.each(['\\frac12', '\\frac{1}2', '\\frac1{2}', '(\\frac{1}{2})', '0.5', '10^{-1}*5'])('accepts equivalent half %s', text => {
    const f = parseForward(text);
    expect(div(f.numerator[0], f.denominator[0])).toEqual(q(1, 2));
  });
  it.each(['-\\frac12', '\\frac{-1}2', '-(\\frac1{2})', '\\frac{-(\\frac12)}{1}'])('accepts signed/nested half %s', text => {
    expect(parseForward(text).numerator).toEqual([q(-1, 2)]);
  });
  it('preserves one-token TeX fraction arguments', () => {
    // TeX numerator=1, denominator=2, then a factor 3.
    expect(parseForward('\\frac123').numerator).toEqual([q(3, 2)]);
    expect(parseForward('\\frac{12}3').numerator).toEqual([q(4)]);
  });
  it.each(['2\\frac12', '-2\\frac12', '(2\\frac12)/(z+1)', '\\frac1{2\\frac12}', '-\\frac{2\\frac12}{z+1}'])('rejects ambiguous mixed number %s', text => {
    expect(() => parseForward(text)).toThrow(/Mixed-number/);
  });
  it('requires explicit mixed-number addition or multiplication while preserving algebraic juxtaposition', () => {
    expect(parseForward('2+\\frac12').numerator).toEqual([q(5, 2)]);
    expect(parseForward('2\\times\\frac12').numerator).toEqual([q(1)]);
    expect(values('z^2\\frac12/(z^2+1)')).toEqual({ n: [0, 0, 0.5], d: [1, 0, 1] });
    expect(parseForward('\\frac12\\frac12').numerator).toEqual([q(1, 4)]);
  });
  it.each(['1e-2', '1E-2', '10e2'])('rejects visual programming-style exponents %s', text => expect(() => parseForward(text)).toThrow(/e\/E/));
  it.each(['', '1/0', '1/(z-z)', 'z^2/(z+1)', 'z^3', '1.2.3', 'sin(z)', '1/(z+1', '\\frac1', '0^{-1}', '10^{13}', '1'.repeat(25), '1+'.repeat(80)+'1'])('rejects malformed/unsupported/bounded input %s', text => expect(() => parseForward(text)).toThrow());
  it('keeps exact z=1 factors separate from near factors', () => {
    expect(factorsAtOne(parseForward('1/(z-1)^2').denominator).order).toBe(2);
    expect(factorsAtOne(parseForward('1/(z-0.99999999999999999999999)').denominator).order).toBe(0);
    expect(at(parseForward('1/(z-0.99999999999999999999999)').denominator, q(1))).toEqual(q(1n, 10n ** 23n));
  });
});

describe('independent final-value and sampled-error fixtures', () => {
  it('derives the baseline from the geometric difference equation', () => {
    const a = solve();
    expect(a.stable).toBe(true); expect(a.type).toBe(1);
    expect(a.constants.velocitySequence.value).toEqual(q(1, 10));
    expect(a.constants.velocityPhysical.value).toEqual(q(1));
    expect(a.errors.tracking.outcome).toBe('finite');
    expect(a.errors.tracking.limit.value).toEqual(q(1));
    for (const s of a.samples) {
      const expected = 1 - 0.9 ** s.k;
      expect(s.tracking).toBeCloseTo(expected, 11);
      expect(s.y).toBeCloseTo(s.k / 10 - expected, 11);
      expect(s.comparator).toBeCloseTo(expected, 11);
    }
    expect(a.samples.at(-1)!.tracking).toBeLessThan(1); // a finite horizon is not the exact limit
  });
  it('scales physical time and sequence ramps differently', () => {
    const sequence = solve(undefined, 'ramp', 'sequence');
    const physical = solve(undefined, 'ramp', 'physical', '0.2');
    expect(sequence.errors.tracking.limit.value).toEqual(q(10));
    expect(physical.errors.tracking.limit.value).toEqual(q(2));
    expect(physical.constants.velocityPhysical.value).toEqual(q(1, 2));
    expect(sequence.samples[7].tracking).toBeCloseTo(10 * (1 - 0.9 ** 7), 12);
    expect(physical.samples[7].tracking).toBeCloseTo(2 * (1 - 0.9 ** 7), 12);
  });
  it('checks the zero step error without assuming zero finite-horizon error', () => {
    const a = solve(undefined, 'step');
    expect(a.errors.tracking.limit.value).toEqual(q(0));
    a.samples.forEach(s => expect(s.tracking).toBeCloseTo(0.9 ** s.k, 12));
  });
  it('identifies polynomial growth for a type-one parabolic input', () => {
    const a = solve(undefined, 'parabola');
    expect(a.errors.tracking.outcome).toBe('divergent');
    expect(a.errors.tracking.growthDegree).toBe(1);
    expect(a.errors.tracking.leading).toEqual(q(1, 10));
    for (const s of a.samples) expect(s.tracking).toBeCloseTo(0.1 * s.k - 0.95 * (1 - 0.9 ** s.k), 10);
  });
  it('checks type zero constants and a static-loop parabola', () => {
    const step = solve('1/2', 'step'), parabola = solve('1/2', 'parabola');
    expect(step.type).toBe(0); expect(step.constants.position.value).toEqual(q(1, 2));
    expect(step.errors.comparator.limit.value).toEqual(q(2, 3));
    expect(parabola.errors.tracking.growthDegree).toBe(2);
    expect(parabola.errors.tracking.leading).toEqual(q(1, 300));
    for (const s of parabola.samples) expect(s.tracking).toBeCloseTo(s.k ** 2 / 300, 11);
  });
  it('derives a stable type-two case, finite acceleration error and early samples', () => {
    const a = solve('0.2(z-0.8)/(z-1)^2', 'parabola', 'physical', '0.1', '1', 1000);
    expect(a.stable).toBe(true); expect(a.type).toBe(2);
    expect(a.closed.map(number)).toEqual([0.84, -1.8, 1]);
    expect(a.constants.accelerationSequence.value).toEqual(q(1, 25));
    expect(a.constants.accelerationPhysical.value).toEqual(q(4));
    expect(a.errors.tracking.limit.value).toEqual(q(1, 4));
    [0, 0.005, 0.019, 0.04, 0.06604].forEach((value, k) => expect(a.samples[k].tracking).toBeCloseTo(value, 12));
    expect(a.samples.at(-1)!.tracking).toBeCloseTo(0.25, 8);
    expect(solve('0.2(z-0.8)/(z-1)^2', 'parabola', 'sequence').errors.tracking.limit.value).toEqual(q(25));
  });
  it('distinguishes nonunit comparator and actual tracking errors', () => {
    const a = solve(undefined, 'ramp', 'physical', '0.1', '2');
    expect(a.constants.velocityPhysical.value).toEqual(q(2));
    expect(a.errors.comparator.limit.value).toEqual(q(1, 2));
    expect(a.errors.tracking.outcome).toBe('divergent');
    expect(a.errors.tracking.leading).toEqual(q(1, 20));
    for (const s of a.samples) {
      const ec = 0.5 * (1 - 0.8 ** s.k);
      expect(s.comparator).toBeCloseTo(ec, 12);
      expect(s.tracking).toBeCloseTo(0.05 * s.k + ec / 2, 11);
      expect(s.r - 2 * s.y).toBeCloseTo(s.comparator, 10);
    }
    const step = solve(undefined, 'step', 'physical', '0.1', '2');
    expect(step.errors.comparator.limit.value).toEqual(q(0));
    expect(step.errors.tracking.limit.value).toEqual(q(1, 2));
  });
  it('handles an exactly zero tracking channel without inventing a type-rule error', () => {
    const a = solve('2', 'parabola', 'physical', '0.1', '0.5');
    expect(a.type).toBe(0);
    expect(a.errors.tracking.outcome).toBe('finite'); expect(a.errors.tracking.limit.value).toEqual(q(0));
    expect(a.errors.comparator.outcome).toBe('divergent');
    a.samples.forEach(s => expect(s.tracking).toBe(0));
  });
  it('solves direct feedthrough simultaneously, not with a fictitious delay', () => {
    const a = solve('(2z+1)/(z-0.5)', 'step');
    expect(a.stable).toBe(true);
    expect(a.samples[0].y).toBeCloseTo(2 / 3, 13);
    expect(a.samples[1].tracking).toBeCloseTo(1 / 9, 13);
    expect(a.errors.tracking.limit.value).toEqual(q(1, 7));
  });
  it('withholds the final-value claim when a stable forward plant closes unstably', () => {
    const a = solve('2/(z-0.5)', 'step', 'physical', '0.1', '1', 100);
    expect(a.stable).toBe(false);
    expect(a.errors.tracking.limit.value).toEqual(q(1, 5)); // only a formal algebraic candidate
    expect(a.errors.tracking.outcome).toBe('not-certified');
    expect(a.samples[3].tracking).toBeCloseTo(-2.5, 12);
    expect(a.traceWarning).toMatch(/Stopped before/);
    expect(a.samples.length).toBeLessThan(100);
  });
  it('retains canceled unstable modes for validity while reducing external numeric channels exactly', () => {
    const a = solve('(z-2)/(z-2)', 'step');
    expect(a.stable).toBe(false); expect(a.poles[0].re).toBe(2);
    expect(a.errors.tracking.outcome).toBe('not-certified');
    expect(a.traceWarning).toBe('');
    a.samples.forEach(s => expect(s.y).toBe(0.5));
  });
  it('classifies very near unit-circle cases exactly and declines unreliable floating-point stems', () => {
    const stable = solve('10^{-12}/(z-(1+10^{-12}-10^{-12}*10^{-8}))');
    const unstable = solve('10^{-12}/(z-(1+10^{-12}+10^{-12}*10^{-8}))');
    expect(stable.stable).toBe(true); expect(unstable.stable).toBe(false);
    expect(stable.conditions[0].value).toEqual(q(1n, 10n ** 20n));
    expect(stable.samples).toEqual([]); expect(stable.traceWarning).toMatch(/unit-circle/);
    expect(solve('0.1/(z-1.1)').stable).toBe(false);
  });
  it('supports a zero plant and exact scalar cancellation', () => {
    const a = solve('0', 'step');
    expect(a.stable).toBe(true); expect(a.errors.tracking.limit.value).toEqual(q(1));
    const reduced = cancel([q(-1), q(1)], [q(-2), q(2)]);
    expect(div(reduced.numerator[0], reduced.denominator[0])).toEqual(q(1, 2));
    expect(rationalLimit([q(0)], [q(-1), q(1)]).value).toEqual(q(0));
  });
  it('computes quadratic roots without discarding a tiny real root', () => {
    const p = [decimal('0.000000000001'), q(-2), q(1)];
    const r = roots(p).map(x => x.re).sort((a, b) => a - b);
    expect(r[0]).toBeGreaterThan(0); expect(r[0]).toBeCloseTo(5e-13, 24);
    expect(r[0] * r[1]).toBeCloseTo(1e-12, 24);
  });
  it('rejects a singular algebraic loop and invalid resource parameters', () => {
    expect(() => solve('-1', 'step')).toThrow(/singular/);
    expect(() => solve(undefined, 'step', 'physical', '0')).toThrow(/T=/);
    expect(() => solve(undefined, 'step', 'physical', '0.1', '0')).toThrow(/sensor/);
    expect(() => solve(undefined, 'step', 'physical', '0.1', '1', 10.5)).toThrow(/integer/);
    expect(() => solve(undefined, 'step', 'physical', '0.1', '1', 1001)).toThrow(/integer/);
  });
});
