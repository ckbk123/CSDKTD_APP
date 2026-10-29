import { describe, expect, it } from 'vitest';
import { evaluateTerms, freeTerms } from './analytic';
import { excitation, modelFromText } from './model';
import { sample, trace } from './response';
import { decimal, ONE } from './rational';

describe('modal cancellation before exponential amplification', () => {
  it.each([20, 30])('preserves the exactly decaying eigenmode at horizon %s', horizon => {
    const m = modelFromText('1', '(s-2)(s+3)'), x = [ONE, decimal('-3')], input = excitation('free');
    const expected = Math.exp(-3 * horizon), p = sample(m, input, x, horizon);
    expect(p.free / expected).toBeCloseTo(1, 11);
    expect(p.freeState[0] / expected).toBeCloseTo(1, 11);
    expect(p.freeState[1] / (-3 * expected)).toBeCloseTo(1, 11);
    expect(evaluateTerms(freeTerms(m, x), horizon) / expected).toBeCloseTo(1, 11);
    const run = trace(m, input, x, horizon);
    expect(run.truncated).toBe(false); expect(run.points.at(-1)!.t).toBe(horizon);
    for (const point of run.points) expect(point.free / Math.exp(-3 * point.t)).toBeCloseTo(1, 10);
  });
  it('preserves the slow unstable mode without inventing the unexcited fast mode', () => {
    const m = modelFromText('1', '(s-.1)(s-10)'), x = [ONE, decimal('.1')], input = excitation('free');
    const expected = Math.exp(.5), p = sample(m, input, x, 5);
    expect(p.total).toBeCloseTo(expected, 12); expect(p.freeState[1]).toBeCloseTo(.1 * expected, 12);
    expect(evaluateTerms(freeTerms(m, x), 5)).toBeCloseTo(expected, 12);
    const run = trace(m, input, x, 5); expect(run.truncated).toBe(false);
    for (const point of run.points) expect(point.total).toBeCloseTo(Math.exp(.1 * point.t), 11);
  });
  it.each([
    ['(s-2)(s+3)', '-2.999999999999', 20, 2e-13 * Math.exp(40) + (1 - 2e-13) * Math.exp(-60)],
    ['(s-2)(s+3)', '-2.99999999999999999999', 30, 2e-21 * Math.exp(60) + (1 - 2e-21) * Math.exp(-90)],
    ['(s-.1)(s-10)', '.10000000000001', 5, (1e-14 / 9.9) * Math.exp(50) + (1 - 1e-14 / 9.9) * Math.exp(.5)],
  ] as const)('retains the genuine small fast-mode coefficient for %s', (denominator, derivative, horizon, expected) => {
    const m = modelFromText('1', denominator), x = [ONE, decimal(derivative)], input = excitation('free');
    expect(sample(m, input, x, horizon).total / expected).toBeCloseTo(1, 11);
    expect(evaluateTerms(freeTerms(m, x), horizon) / expected).toBeCloseTo(1, 11);
    const run = trace(m, input, x, horizon); expect(run.truncated).toBe(false);
    expect(run.points.at(-1)!.total / expected).toBeCloseTo(1, 10);
  });
  it('keeps the regular basis near coincident rational roots', () => {
    const m = modelFromText('1', 's^2+.000000002s'), input = excitation('free'), x = [decimal('0'), ONE];
    for (const t of [.001, .1, 1, 30]) {
      const expected = -Math.expm1(-2e-9 * t) / 2e-9;
      expect(sample(m, input, x, t).total / expected).toBeCloseTo(1, 12);
      expect(evaluateTerms(freeTerms(m, x), t) / expected).toBeCloseTo(1, 12);
    }
  });
  it('resolves a near-eigenvector with irrational roots using the exact coefficient product', () => {
    const m = modelFromText('1', 's^2-2'), x = [ONE, decimal('-1.414213562373095')], input = excitation('free');
    // Independent Python Decimal, 85 digits: sqrt(2); A+=(1+v/sqrt(2))/2;
    // A+*exp(30sqrt(2)) + A-*exp(-30sqrt(2)) = 45.9667975612399498165…
    const expected = 45.9667975612399498165;
    expect(evaluateTerms(freeTerms(m, x), 30) / expected).toBeCloseTo(1, 11);
    expect(sample(m, input, x, 30).total / expected).toBeCloseTo(1, 11);
    const run = trace(m, input, x, 30); expect(run.truncated).toBe(false);
    expect(run.points.at(-1)!.total / expected).toBeCloseTo(1, 10);
  });
  it('reports an unrepresentable nonzero modal coefficient instead of trimming it away', () => {
    const m = modelFromText('1', '(s-2)(s+3)'), x = [ONE, decimal('-2.' + '9'.repeat(400))];
    expect(() => sample(m, excitation('free'), x, 20)).toThrow(/nonzero coefficient is too small/);
    expect(() => trace(m, excitation('free'), x, 20)).toThrow(/nonzero coefficient is too small/);
  });
});
