import { describe, expect, it } from 'vitest';
import { calculate, derive, initialize, simulate, type Parameters } from './math';

const baseline: Parameters = { kp: 4, ki: 2, kd: 1, period: 0.1, integral: 'trapezoidal', derivative: 'backward', tau: 0.1 };
const zero = { e0: 0, eMinus1: 0, i0: 0, d0: 0 };
const closeArray = (actual: readonly number[], expected: readonly number[]) => {
  expect(actual).toHaveLength(expected.length);
  actual.forEach((value, index) => expect(value).toBeCloseTo(expected[index], 11));
};

describe('DD04 independent PID derivations', () => {
  it('matches the S14 baseline coefficients and positional arithmetic', () => {
    const model = derive(baseline);
    closeArray(model.b, [14.1, -23.9, 10]); closeArray(model.a, [1, -1, 0]);
    const steps = simulate(model, zero, [1, 1, 1, 1, 0, 0]);
    closeArray(steps.map(s => s.position), [14.1, 4.3, 4.5, 4.7, -9.2, 0.8]);
    closeArray(steps.map(s => s.incremental), [14.1, 4.3, 4.5, 4.7, -9.2, 0.8]);
    expect(steps[0].proportional).toBe(4); expect(steps[0].integral).toBeCloseTo(0.1, 12);
    expect(steps[0].derivative).toBe(10); expect(steps[1].derivative).toBe(0);
    expect(steps[1].time).toBe(0.2);
  });
  it('rederives the accepted T=.2 changed-data experiment', () => {
    const model = derive({ ...baseline, period: 0.2 });
    closeArray(model.b, [9.2, -13.8, 5]);
    closeArray(simulate(model, zero, [1, 1, 1]).map(s => s.position), [9.2, 4.6, 5]);
  });
  it.each([
    ['forward', [14, -23.8, 10], [14, 4.2, 4.4]],
    ['backward', [14.2, -24, 10], [14.2, 4.4, 4.6]],
  ] as const)('implements %s rectangular integration with its timing', (integral, b, outputs) => {
    const model = derive({ ...baseline, integral });
    closeArray(model.b, b);
    closeArray(simulate(model, zero, [1, 1, 1]).map(s => s.position), outputs);
  });
  it('shows the alternating state of the unfiltered Tustin derivative', () => {
    const model = derive({ ...baseline, derivative: 'tustin' });
    expect(model.alpha).toBe(-1); closeArray(model.a, [1, 0, -1]);
    closeArray(model.b, [24.1, -39.8, 16.1]);
    const steps = simulate(model, zero, [1, 1, 1]);
    closeArray(steps.map(s => s.derivative), [20, -20, 20]);
    closeArray(steps.map(s => s.position), [24.1, -15.7, 24.5]);
    closeArray(steps.map(s => s.incremental), [24.1, -15.7, 24.5]);
  });
  it('retains a separate filtered derivative state', () => {
    const model = derive({ ...baseline, derivative: 'filtered' });
    expect(model.alpha).toBe(0.5); expect(model.beta).toBe(5);
    closeArray(model.b, [9.1, -15.95, 6.95]);
    const steps = simulate(model, zero, [1, 1, 1]);
    closeArray(steps.map(s => s.derivative), [5, 2.5, 1.25]);
    closeArray(steps.map(s => s.position), [9.1, 6.8, 5.75]);
  });
  it('maps nonzero memory consistently before comparing representations', () => {
    const model = derive({ kp: 2, ki: 1, kd: 0.5, period: 1, integral: 'trapezoidal', derivative: 'filtered', tau: 1 });
    const initial = { e0: 2, eMinus1: 1, i0: 3, d0: 0.5 };
    const memory = initialize(model, initial);
    expect(memory.output).toBe(7.5); expect(memory.delta).toBe(3.5);
    const steps = simulate(model, initial, [-1, 0]);
    closeArray(steps.map(s => s.position), [1, 3]);
    closeArray(steps.map(s => s.incremental), [1, 3]);
    expect(steps[0].integral).toBe(3.5); expect(steps[0].derivative).toBe(-0.5);
  });
  it('initial integral memory changes the response without changing zero-state coefficients', () => {
    const model = derive({ ...baseline, kp: 0, ki: 0, kd: 0 });
    closeArray(model.b, [0, 0, 0]);
    closeArray(simulate(model, { ...zero, i0: 7 }, [1, -1, 0]).map(s => s.position), [7, 7, 7]);
  });
  it('does not mutate old memory during calculate; updates only through returned next', () => {
    const model = derive(baseline), old = Object.freeze(initialize(model, zero));
    const step = calculate(model, old, 1);
    expect(step.old).toBe(old); expect(old.ePrev).toBe(0); expect(old.k).toBe(1);
    expect(step.next.ePrev).toBe(1); expect(step.next.eOlder).toBe(0); expect(step.next.k).toBe(2);
    expect(step.next.output).toBeCloseTo(14.1, 12);
  });
  it('sets backward derivative initial memory from the specified error history', () => {
    const model = derive(baseline);
    expect(initialize(model, { ...zero, e0: 2, eMinus1: 1, d0: 99 }).derivative).toBe(10);
  });
  it('handles negative gains and compares both forms over a changed finite sequence', () => {
    const model = derive({ ...baseline, kp: -2, ki: 0.5, kd: -0.2, period: 0.5, integral: 'backward', derivative: 'filtered', tau: 0.25 });
    const steps = simulate(model, { e0: 1, eMinus1: -1, i0: 2, d0: -3 }, [2, -1, 0, 0.5]);
    expect(steps[0].position).toBeCloseTo(-83 / 30, 11); // -4 + 2.5 + (-1 - 4/15)
    expect(steps.every(s => s.residual < 1e-12)).toBe(true);
  });
  it('checks the unreduced transfer identity independently at q=1/2', () => {
    for (const derivative of ['backward', 'tustin', 'filtered'] as const) {
      const m = derive({ ...baseline, derivative });
      const q = 0.5;
      const direct = 4 + (m.integral === 'trapezoidal' ? 0.1 * (1 + q) / (1 - q) : 0) + m.beta * (1 - q) / (1 - m.alpha * q);
      const rational = (m.b[0] + m.b[1] * q + m.b[2] * q * q) / (m.a[0] + m.a[1] * q + m.a[2] * q * q);
      expect(rational).toBeCloseTo(direct, 11);
    }
  });
});

describe('DD04 bounds and useful failures', () => {
  it.each([0, -1, NaN, Infinity, 0.0001, 11])('rejects invalid T=%s', period => expect(() => derive({ ...baseline, period })).toThrow());
  it('rejects noncausal forward differentiation explicitly', () => expect(() => derive({ ...baseline, derivative: 'forward' })).toThrow(/e\[k\+1\]/));
  it.each([0, -1, NaN, 11])('rejects invalid filter tau=%s', tau => expect(() => derive({ ...baseline, derivative: 'filtered', tau })).toThrow(/τ/));
  it('rejects nonfinite, excessive and unrepresentable parameters/work', () => {
    expect(() => derive({ ...baseline, kp: Infinity })).toThrow();
    expect(() => derive({ ...baseline, ki: 10001 })).toThrow();
    expect(() => derive({ ...baseline, ki: Number.MIN_VALUE })).toThrow(/too small/);
    const model = derive(baseline);
    expect(() => simulate(model, zero, [])).toThrow(); expect(() => simulate(model, zero, Array(41).fill(1))).toThrow();
    expect(() => simulate(model, zero, [NaN])).toThrow(); expect(() => simulate(model, zero, [10001])).toThrow();
    expect(() => initialize(model, { ...zero, i0: 1e7 })).toThrow();
    expect(() => calculate(model, { ...initialize(model, zero), integral: 1e13 }, 1)).toThrow();
  });
});
