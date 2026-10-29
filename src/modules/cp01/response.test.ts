import { describe, expect, it } from 'vitest';
import { centeredInitial, excitation, modelFromText as model, outputCoefficients, stateMatrix, type Model } from './model';
import { impulseAreas, sample, trace, transition } from './response';
import { decimal, exactText, ONE, toNumber, ZERO } from './rational';

const zeros = (m: Model) => Array.from({ length: m.order }, () => ZERO);
const times = [0, .01, .1, 1, 2, 5, 10];
const vector = (a: number[][], x: number[]) => a.map(row => row.reduce((s, c, j) => s + c * x[j], 0));

describe('CP01 numerical response against independent analytic oracles', () => {
  it('matches the inverse-Laplace baseline step and y(1)', () => {
    const m = model();
    for (const t of times) expect(sample(m, excitation('step'), zeros(m), t).total).toBeCloseTo(.5 - Math.exp(-t) + .5 * Math.exp(-2 * t), 11);
    expect(sample(m, excitation('step'), zeros(m), 1).total).toBeCloseTo(.199788200446864, 12);
  });
  it('matches the independent baseline impulse and ramp integrals', () => {
    const m = model();
    for (const t of times) {
      expect(sample(m, excitation('impulse'), zeros(m), t).total).toBeCloseTo(Math.exp(-t) - Math.exp(-2 * t), 11);
      expect(sample(m, excitation('ramp'), zeros(m), t).total).toBeCloseTo(.5 * t - .75 + Math.exp(-t) - .25 * Math.exp(-2 * t), 10);
    }
  });
  it('preserves nonzero initial state and independently checked superposition', () => {
    const m = model();
    for (const t of times) {
      const p = sample(m, excitation('step'), [ONE, ZERO], t);
      expect(p.free).toBeCloseTo(2 * Math.exp(-t) - Math.exp(-2 * t), 11);
      expect(p.total).toBeCloseTo(.5 + Math.exp(-t) - .5 * Math.exp(-2 * t), 11);
      expect(p.total).toBeCloseTo(p.free + p.forced, 12);
    }
  });
  it('computes changed poles and gain from the actual model', () => {
    const m = model('2', '(s+1)(s+3)');
    for (const t of times) expect(sample(m, excitation('step'), zeros(m), t).total).toBeCloseTo(2 / 3 - Math.exp(-t) + Math.exp(-3 * t) / 3, 11);
  });
  it('handles a first-order free state, forced amplitude and direct jump', () => {
    const m = model('1', 's+1', decimal('.5')), input = excitation('step', decimal('3'));
    for (const t of times) expect(sample(m, input, [decimal('2')], t).total).toBeCloseTo(4.5 - Math.exp(-t), 11);
    expect(sample(m, input, [decimal('2')], 0, 'left').total).toBe(2);
    expect(sample(m, input, [decimal('2')], 0, 'right').total).toBeCloseTo(3.5, 12);
  });
  it('does not draw the direct impulse distribution as a finite peak', () => {
    const m = model('2s+3', 's+1'), input = excitation('impulse', decimal('2'));
    expect(exactText(impulseAreas(m, input).input)).toBe('2');
    expect(exactText(impulseAreas(m, input).output)).toBe('4');
    expect(sample(m, input, zeros(m), 0, 'left').total).toBe(0);
    expect(sample(m, input, zeros(m), 0, 'right').total).toBe(2); // regular dynamic jump only
    for (const t of times) { const p = sample(m, input, zeros(m), t); expect(p.input).toBe(0); expect(p.total).toBeCloseTo(2 * Math.exp(-t), 11); }
  });
  it('retains a cancelled finite state mode in a biproper realization', () => {
    const m = model('2s^2+7s+6', '(s+1)(s+2)'); // 2 + 1/(s+1), with retained phase states
    for (const t of times) {
      expect(sample(m, excitation('step'), zeros(m), t).total).toBeCloseTo(3 - Math.exp(-t), 11);
      expect(sample(m, excitation('free'), [ONE, ZERO], t).total).toBeCloseTo(2 * Math.exp(-t), 11);
    }
  });
  it('uses a linear numerator in free and forced responses', () => {
    const m = model('s+4');
    for (const t of times) {
      expect(sample(m, excitation('impulse'), zeros(m), t).total).toBeCloseTo(3 * Math.exp(-t) - 2 * Math.exp(-2 * t), 11);
      expect(sample(m, excitation('step'), zeros(m), t).total).toBeCloseTo(2 - 3 * Math.exp(-t) + Math.exp(-2 * t), 11);
      expect(sample(m, excitation('free'), [ONE, ZERO], t).total).toBeCloseTo(6 * Math.exp(-t) - 2 * Math.exp(-2 * t), 11);
    }
  });
  it('handles a repeated real pole without a divided root separation', () => {
    const m = model('1', '(s+1)^2');
    for (const t of times) {
      expect(sample(m, excitation('impulse'), zeros(m), t).total).toBeCloseTo(t * Math.exp(-t), 11);
      expect(sample(m, excitation('step'), zeros(m), t).total).toBeCloseTo(1 - (1 + t) * Math.exp(-t), 11);
      expect(sample(m, excitation('free'), [ONE, ZERO], t).total).toBeCloseTo((1 + t) * Math.exp(-t), 11);
    }
  });
  it('matches independent underdamped and undamped formulas', () => {
    const m = model('1', 's^2+2s+5'), undamped = model('4', 's^2+4');
    for (const t of times) {
      expect(sample(m, excitation('impulse'), zeros(m), t).total).toBeCloseTo(.5 * Math.exp(-t) * Math.sin(2 * t), 11);
      expect(sample(m, excitation('step'), zeros(m), t).total).toBeCloseTo((1 - Math.exp(-t) * (Math.cos(2 * t) + .5 * Math.sin(2 * t))) / 5, 11);
      expect(sample(undamped, excitation('step'), zeros(undamped), t).total).toBeCloseTo(1 - Math.cos(2 * t), 10);
    }
  });
  it('preserves both integrator orders and a numerator derivative term', () => {
    const first = model('1', 's'), second = model('1', 's^2'), linear = model('s+1', 's^2');
    for (const t of times) {
      expect(sample(first, excitation('step'), zeros(first), t).total).toBeCloseTo(t, 11);
      expect(sample(first, excitation('ramp'), zeros(first), t).total).toBeCloseTo(t * t / 2, 11);
      expect(sample(second, excitation('step'), zeros(second), t).total).toBeCloseTo(t * t / 2, 11);
      expect(sample(second, excitation('ramp'), zeros(second), t).total).toBeCloseTo(t ** 3 / 6, 10);
      expect(sample(linear, excitation('step'), zeros(linear), t).total).toBeCloseTo(t + t * t / 2, 11);
      expect(sample(second, excitation('free'), [decimal('2'), decimal('-1')], t).total).toBeCloseTo(2 - t, 11);
    }
  });
  it('computes the single-integrator plus finite-pole case', () => {
    const m = model('1', 's(s+2)');
    for (const t of times) {
      expect(sample(m, excitation('impulse'), zeros(m), t).total).toBeCloseTo((1 - Math.exp(-2 * t)) / 2, 11);
      expect(sample(m, excitation('step'), zeros(m), t).total).toBeCloseTo(.5 * t - (1 - Math.exp(-2 * t)) / 4, 11);
      expect(sample(m, excitation('free'), [ONE, decimal('2')], t).total).toBeCloseTo(2 - Math.exp(-2 * t), 11);
    }
  });
  it('shows bounded-horizon growth and truncates a divergent response', () => {
    const m = model('1', 's-1');
    expect(sample(m, excitation('step'), zeros(m), 2).total).toBeCloseTo(Math.exp(2) - 1, 11);
    const run = trace(m, excitation('step'), zeros(m), 60);
    expect(run.truncated).toBe(true); expect(run.points.at(-1)!.t).toBeLessThan(60); expect(run.reason).toContain('10¹⁰');
    const zero = trace(m, excitation('step', ZERO), zeros(m), 60);
    expect(zero.truncated).toBe(false); expect(zero.points.every(p => p.total === 0)).toBe(true);
  });
  it('uses distinct left/right pulse endpoints and the declared pulse area', () => {
    const m = model('1', 's+1', decimal('3')), input = excitation('pulse', decimal('2'), decimal('.5'));
    for (const t of [.1, .5, 1, 2]) {
      const regular = t <= .5 ? 4 * (1 - Math.exp(-t)) : 4 * (1 - Math.exp(-.5)) * Math.exp(-(t - .5));
      expect(sample(m, input, zeros(m), t).total).toBeCloseTo(regular + (t < .5 ? 12 : 0), 11);
    }
    const left = sample(m, input, zeros(m), .5, 'left'), right = sample(m, input, zeros(m), .5, 'right');
    expect(left.input).toBe(4); expect(right.input).toBe(0); expect(left.total - right.total).toBeCloseTo(12, 12);
    expect(left.forcedState).toEqual(right.forcedState);
    expect(sample(m, input, zeros(m), 0, 'left').total).toBe(0); expect(sample(m, input, zeros(m), 0).total).toBeCloseTo(12, 12);
  });
  it('approaches the proper impulse response as pulse width shrinks', () => {
    const m = model('1', 's+1'), expected = 2 * Math.exp(-1);
    const coarse = sample(m, excitation('pulse', decimal('2'), decimal('.01')), zeros(m), 1).total;
    const fine = sample(m, excitation('pulse', decimal('2'), decimal('.001')), zeros(m), 1).total;
    expect(Math.abs(fine - expected)).toBeLessThan(Math.abs(coarse - expected) / 9);
    expect(fine).toBeCloseTo(expected, 3);
  });
  it('checks every baseline trace sample against the independent oracle', () => {
    const m = model(), run = trace(m, excitation('step'), zeros(m), 10);
    expect(run.truncated).toBe(false);
    for (const p of run.points) {
      expect(p.total).toBeCloseTo(.5 - Math.exp(-p.t) + .5 * Math.exp(-2 * p.t), 9);
      expect(p.forcedState).toHaveLength(2); expect(p.freeState).toHaveLength(2);
    }
  });
  it('hits a non-grid pulse boundary exactly and labels cut-off horizons', () => {
    const m = model('1', 's+1', ONE), input = excitation('pulse', ONE, decimal('.0137'));
    const run = trace(m, input, zeros(m), 1), edge = run.points.filter(p => p.t === .0137);
    expect(edge.map(p => p.side)).toEqual(['left', 'right']);
    expect(edge[0].input).toBeCloseTo(1 / .0137, 11); expect(edge[1].input).toBe(0);
    expect(edge[0].forcedState).toEqual(edge[1].forcedState);
    expect(run.points.length).toBeLessThanOrEqual(20_024);
    expect(trace(m, excitation('pulse', ONE, ONE), zeros(m), .1).pulseEndsAfterHorizon).toBe(true);
  });
  it('reports its sample budget without mislabeling an analytic certificate', () => {
    const m = model('1', '(s+10)^2'), run = trace(m, excitation('step'), zeros(m), 60);
    expect(run.resolutionLimited).toBe(true); expect(run.baseIntervals).toBe(20_000); expect(run.truncated).toBe(false);
    expect(run.points.length).toBeLessThanOrEqual(20_024);
  });
  it('preserves physical output in centered coordinates with the mapped initial state', () => {
    const m = model('s+4'), z0 = centeredInitial(m, [ONE, ZERO]).map(x => toNumber(x)), c = outputCoefficients(m, true).map(x => toNumber(x));
    for (const t of times) {
      const z = vector(transition(stateMatrix(m, true), t), z0), output = c.reduce((s, value, i) => s + value * z[i], 0);
      expect(output).toBeCloseTo(6 * Math.exp(-t) - 2 * Math.exp(-2 * t), 11);
    }
  });
  it('bounds invalid times, dimensions and cursor overflow', () => {
    const m = model(); for (const t of [NaN, Infinity, -.1, 61]) expect(() => sample(m, excitation('step'), zeros(m), t)).toThrow();
    for (const t of [0, .01, NaN, Infinity, 61]) expect(() => trace(m, excitation('step'), zeros(m), t)).toThrow();
    expect(() => sample(m, excitation('step'), [ZERO], 1)).toThrow();
    const unstable = model('1', 's-100'); expect(() => sample(unstable, excitation('step'), zeros(unstable), 60)).toThrow();
  });
});

describe('CP01 bounded transition oracles', () => {
  it('matches diagonal exponentials, rotation and a nilpotent chain', () => {
    const diagonal = transition([[-2, 0], [0, 1]], .7);
    expect(diagonal[0][0]).toBeCloseTo(Math.exp(-1.4), 13); expect(diagonal[1][1]).toBeCloseTo(Math.exp(.7), 13);
    const rotation = transition([[0, -2], [2, 0]], .5);
    expect(rotation[0][0]).toBeCloseTo(Math.cos(1), 13); expect(rotation[0][1]).toBeCloseTo(-Math.sin(1), 13);
    const chain = transition([[0, 1, 0, 0], [0, 0, 1, 0], [0, 0, 0, 1], [0, 0, 0, 0]], 2);
    expect(chain[0][1]).toBeCloseTo(2, 13); expect(chain[0][2]).toBeCloseTo(2, 13); expect(chain[0][3]).toBeCloseTo(4 / 3, 13);
    expect(transition([[0]], 0)).toEqual([[1]]);
  });
  it('reports malformed requests, scaling exhaustion and overflow', () => {
    for (const a of [[], [[1, 2]], [[NaN]], [[1e20]], Array.from({ length: 5 }, () => Array(5).fill(0))]) expect(() => transition(a, 1)).toThrow();
    expect(() => transition([[1]], -1)).toThrow(); expect(() => transition([[100]], 60)).toThrow(/overflow/);
  });
});
