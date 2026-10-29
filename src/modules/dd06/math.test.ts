import { describe, expect, it } from 'vitest';
import { baseline, dampingTargets, design, discretize, realTargets, simulate, type M2, type Plant, type V2 } from './math';

function close(actual: number, expected: number, tolerance = 2e-11) {
  expect(Math.abs(actual - expected) / (1 + Math.abs(expected))).toBeLessThan(tolerance);
}
function flatClose(actual: readonly (readonly number[])[], expected: readonly (readonly number[])[]) {
  actual.flat().forEach((value, i) => close(value, expected.flat()[i]));
}
const ready = (plant = baseline(), first = 0.7, second = 0.8) => {
  const result = design(plant, realTargets(first, second));
  expect(result.issue).toBe(''); expect(result.feedback).toBeDefined(); expect(result.tracking?.available).toBe(true);
  return result;
};
describe('DD06 independent ZOH and feedback fixtures', () => {
  it.each([0.001, 0.03, 0.1, 0.2, 0.8, 2])('matches independently integrated mechanical modes at T=%s', T => {
    const e1 = Math.exp(-T), e2 = Math.exp(-2 * T), model = discretize({ ...baseline(), T });
    flatClose(model.Ad, [[2 * e1 - e2, e1 - e2], [-2 * (e1 - e2), 2 * e2 - e1]]);
    close(model.Bd[0], (1 - 2 * e1 + e2) / 2); close(model.Bd[1], e1 - e2);
    expect(model.rank).toBe(2);
  });
  it('recomputes full-precision baseline rather than using quoted rounded gains', () => {
    const result = ready(), feedback = result.feedback!;
    // The TASK/audit quote six decimal places, independent of this algorithm.
    expect(feedback.K[0]).toBeCloseTo(4.956502, 6); expect(feedback.K[1]).toBeCloseTo(2.335770, 6);
    if (!result.tracking?.available) throw new Error('missing reference multiplier');
    expect(result.tracking.N).toBeCloseTo(6.956502, 6);
    // Continuous equilibrium x2=0 and u=2*x1 is preserved by exact ZOH.
    close(result.tracking.N - feedback.K[0], 2);
    close(result.tracking.equilibrium[0], 1); close(result.tracking.equilibrium[1], 0);
    close(feedback.sum, 1.5); close(feedback.product, 0.56);
    const roots = [...feedback.poles].sort((a, b) => a.re - b.re);
    close(roots[0].re, 0.7); close(roots[1].re, 0.8); roots.forEach(root => close(root.im, 0));
    expect(feedback.stability).toBe('stable'); expect(result.tracking.certified).toBe(true);
  });
  it('handles a singular continuous A with the hand-integrated double integrator', () => {
    const result = ready({ A: [[0, 1], [0, 0]], B: [0, 1], C: [1, 0], T: 0.1 });
    flatClose(result.model.Ad, [[1, 0.1], [0, 1]]); flatClose([result.model.Bd], [[0.005, 0.1]]);
    flatClose([result.feedback!.K], [[6, 4.7]]);
    if (result.tracking?.available) close(result.tracking.N, 6);
  });
  it('matches twenty independent double-integrator coefficient solutions across T and targets', () => {
    for (const T of [0.001, 0.01, 0.1, 1]) for (const [first, second] of [[0.7, 0.8], [0.5, 0.5], [-0.3, 0.6], [0, 0], [1.2, 0.8]]) {
      const result = ready({ A: [[0, 1], [0, 0]], B: [0, 1], C: [1, 0], T }, first, second);
      // From det(zI-Acl): a0=1+T²K1/2-TK2,
      // a1=-2+T²K1/2+TK2, solved algebraically before implementation.
      const K1 = (1 - first) * (1 - second) / (T * T);
      const K2 = (2 - first - second - T * T * K1 / 2) / T;
      close(result.feedback!.K[0], K1); close(result.feedback!.K[1], K2);
      if (result.tracking?.available) close(result.tracking.N, K1);
    }
  });
  it('places the independently solved diagonal fixture including a negative gain', () => {
    const T = 0.1, a = Math.log(0.8) / T, b = Math.log(0.6) / T;
    const result = ready({ A: [[a, 0], [0, b]], B: [0.1 * a / -0.2, 0.2 * b / -0.4], C: [1, 0], T }, 0.2, 0.3);
    flatClose(result.model.Ad, [[0.8, 0], [0, 0.6]]); flatClose([result.model.Bd], [[0.1, 0.2]]);
    flatClose([result.feedback!.K], [[15, -3]]);
    if (result.tracking?.available) close(result.tracking.N, 14);
  });
  it('preserves state-basis equivalence and input/output scaling', () => {
    const original = ready();
    // x'=diag(10,.1)x, u'=u, y'=y.
    const transformed = ready({ ...baseline(), A: [[0, 100], [-0.02, -3]], B: [0, 0.1], C: [0.1, 0] });
    close(transformed.feedback!.K[0] * 10, original.feedback!.K[0]); close(transformed.feedback!.K[1] / 10, original.feedback!.K[1]);
    if (transformed.tracking?.available && original.tracking?.available) close(transformed.tracking.N, original.tracking.N);
    const smallInput = ready({ ...baseline(), B: [0, 1e-5], C: [2, 0] });
    smallInput.feedback!.K.forEach((value, i) => close(value * 1e-5, original.feedback!.K[i]));
    if (smallInput.tracking?.available && original.tracking?.available) close(smallInput.tracking.N * 2e-5, original.tracking.N);
    const a = simulate(original, [0, 0], 1, 80), b = simulate(transformed, [0, 0], 1, 80), c = simulate(smallInput, [0, 0], 1, 80);
    a.samples.forEach((sample, i) => { close(b.samples[i].y, sample.y); close(c.samples[i].y, sample.y); });
  });
  it('redesigns when T changes while entered discrete poles stay fixed', () => {
    const first = ready(), changed = ready({ ...baseline(), T: 0.2 });
    expect(changed.model.Ad[0][0]).not.toBe(first.model.Ad[0][0]); expect(changed.feedback!.K[0]).not.toBe(first.feedback!.K[0]);
    close(changed.feedback!.sum, 1.5); close(changed.feedback!.product, 0.56);
    if (changed.tracking?.available) close(changed.tracking.N - changed.feedback!.K[0], 2);
  });
});
describe('DD06 target mapping, retained modes and incompatible designs', () => {
  it.each([[0.707, 10], [0.5, 8]])('maps continuous parameter variation ζ=%s,ωn=%s without asserting its original diagram', (zeta, wn) => {
    const targets = dampingTargets(zeta, wn, 0.1), result = design(baseline(), targets);
    close(targets.sum, 2 * Math.exp(-zeta * wn * 0.1) * Math.cos(wn * Math.sqrt(1 - zeta * zeta) * 0.1));
    close(targets.product, Math.exp(-2 * zeta * wn * 0.1));
    expect(result.feedback?.stability).toBe('stable'); expect(result.tracking?.available).toBe(true);
    result.feedback!.poles.forEach(root => close(Math.hypot(root.re, root.im), Math.exp(-zeta * wn * 0.1)));
  });
  it('supports critical/overdamped mapping and repeated discrete targets', () => {
    const critical = dampingTargets(1, 2, 0.1), overdamped = dampingTargets(1.25, 2, 0.1);
    close(critical.sum, 2 * Math.exp(-0.2)); close(critical.product, Math.exp(-0.4));
    close(overdamped.poles[0].re, Math.exp(-0.1)); close(overdamped.poles[1].re, Math.exp(-0.4));
    const repeated = ready(baseline(), 0.7, 0.7); close(repeated.feedback!.sum, 1.4); close(repeated.feedback!.product, 0.49);
  });
  it('makes angle aliasing and unit-circle uncertainty explicit', () => {
    const targets = dampingTargets(0, 10, 0.5); expect(targets.aliasWarning).toContain('aliases');
    const result = design(baseline(), targets); expect(result.feedback?.stability).toBe('boundary');
    if (result.tracking?.available) expect(result.tracking.certified).toBe(false);
  });
  it.each([0, 1])('refuses arbitrary placement for deficient sampled controllability, B case%s', which => {
    const plant: Plant = { A: [[-1, 0], [0, -2]], B: which ? [1, 0] : [0, 0], C: [1, 0], T: 0.1 };
    const result = design(plant, realTargets(0.7, 0.8)); expect(result.model.rank).toBe(which); expect(result.feedback).toBeUndefined(); expect(result.issue).toContain('rank');
  });
  it('detects sampling-induced controllability loss for a continuously controllable oscillator', () => {
    const model = discretize({ A: [[0, -Math.PI], [Math.PI, 0]], B: [1, 0], C: [1, 0], T: 1 });
    flatClose(model.Ad, [[-1, 0], [0, -1]]); flatClose([model.Bd], [[0, 2 / Math.PI]]);
    expect(model.rank).toBe(1);
    const fullPeriod = discretize({ A: [[0, -Math.PI], [Math.PI, 0]], B: [1, 0], C: [1, 0], T: 2 });
    expect(fullPeriod.rank).toBe(0);
  });
  it('keeps valid feedback visible when a velocity output has zero DC gain', () => {
    const result = design({ ...baseline(), C: [0, 1] }, realTargets(0.7, 0.8));
    expect(result.feedback?.stability).toBe('stable'); expect(result.tracking?.available).toBe(false);
    if (!result.tracking?.available) expect(result.tracking?.reason).toContain('DC');
    expect(() => simulate(result, [0, 0], 1, 80)).toThrow('nonzero reference');
    expect(simulate(result, [1, 0], 0, 80).samples.at(-1)!.y).toBeCloseTo(0, 6);
  });
  it('withholds the DC solve at a target1 and never calls unstable poles stable tracking', () => {
    const unit = design(baseline(), realTargets(1, 0.8)); expect(unit.feedback?.stability).toBe('boundary'); expect(unit.tracking?.available).toBe(false);
    const unstable = ready(baseline(), 1.2, 0.8); expect(unstable.feedback!.stability).toBe('unstable');
    if (unstable.tracking?.available) expect(unstable.tracking.certified).toBe(false);
    const trace = simulate(unstable, [0, 0], 1, 1000); expect(trace.samples.length).toBeLessThan(1001); expect(trace.warning).toMatch(/Stopped/);
  });
});
describe('DD06 sampled timing and independent transient checks', () => {
  it('matches the two-mode output formula and first held inputs', () => {
    const result = ready(), trace = simulate(result, [0, 0], 1, 160);
    if (!result.tracking?.available) throw new Error('missing multiplier');
    const T = 0.1, bdPosition = (1 - 2 * Math.exp(-T) + Math.exp(-2 * T)) / 2;
    const e1 = 1 - bdPosition * result.tracking.N, firstWeight = (e1 - 0.8) / (0.7 - 0.8);
    for (const sample of trace.samples) close(sample.y, 1 - firstWeight * 0.7 ** sample.k - (1 - firstWeight) * 0.8 ** sample.k);
    close(trace.samples[0].y, 0); close(trace.samples[0].u, result.tracking.N);
    close(trace.samples[1].x1, bdPosition * result.tracking.N);
    close(trace.samples[1].u, result.tracking.N * (1 - result.feedback!.K[0] * result.model.Bd[0] - result.feedback!.K[1] * result.model.Bd[1]));
    expect(trace.bandEntry).toBeDefined(); expect(trace.samples.at(-1)!.error).toBeCloseTo(0, 10);
  });
  it('supports changed initial state, reference sign and exact zero reference', () => {
    const result = ready(), positive = simulate(result, [0, 0], 1, 80), negative = simulate(result, [0, 0], -2, 80);
    positive.samples.forEach((sample, k) => { close(negative.samples[k].y, -2 * sample.y); close(negative.samples[k].u, -2 * sample.u); });
    const initial = simulate(result, [1, -0.5], 1, 80); close(initial.samples[0].y, 1); close(initial.samples[0].x2, -0.5);
    const zero = simulate(result, [0, 0], 0, 80); expect(zero.samples.every(sample => sample.y === 0 && sample.u === 0)).toBe(true); expect(zero.overshoot).toBeUndefined();
  });
  it('reproduces the hand-stepped two-sample deadbeat sequence', () => {
    const result = ready({ A: [[0, 1], [0, 0]], B: [0, 1], C: [1, 0], T: 0.1 }, 0, 0);
    const trace = simulate(result, [0, 0], 1, 10);
    close(trace.samples[0].y, 0); close(trace.samples[0].u, 100);
    close(trace.samples[1].y, 0.5); close(trace.samples[1].u, -100);
    trace.samples.slice(2).forEach(sample => { close(sample.y, 1); close(sample.u, 0); });
  });
  it('labels an insufficient window instead of inferring settling from a stable pole', () => {
    const trace = simulate(ready(baseline(), 0.99, 0.98), [0, 0], 1, 10); expect(trace.bandEntry).toBeUndefined(); expect(trace.warning).toBe('');
  });
  it.each([9, 2001, 10.5, NaN])('rejects excessive/noninteger sample work%s', count => {
    expect(() => simulate(ready(), [0, 0], 1, count)).toThrow('integer');
  });
  it.each([0, NaN, Infinity, 2.1])('rejects bad periods%s', T => expect(() => discretize({ ...baseline(), T })).toThrow());
  it('rejects unsupported matrix scales, dimensions and target work', () => {
    expect(() => discretize({ ...baseline(), A: [[100, 0], [0, 100]], T: 2 })).toThrow('scale exceeds');
    expect(() => discretize({ ...baseline(), A: [[20, 0], [0, 20]], T: 1 })).toThrow('range');
    expect(() => discretize({ ...baseline(), A: [[NaN, 0], [0, 1]] })).toThrow('matrix entry');
    expect(() => discretize({ ...baseline(), B: [0, 1e-13] })).toThrow('10⁻¹²');
    expect(() => discretize({ ...baseline(), A: [[1, 2, 3], [0, 1, 0]] as unknown as M2 })).toThrow('two rows');
    expect(() => discretize({ ...baseline(), B: [1] as unknown as V2 })).toThrow('two rows');
    expect(() => dampingTargets(3, 100, 2)).toThrow('decay'); expect(() => realTargets(3, 0.8)).toThrow('target');
    const excessiveGain = design({ ...baseline(), B: [0, 1e-12] }, realTargets(0.7, 0.8));
    expect(excessiveGain.feedback).toBeUndefined(); expect(excessiveGain.issue).toContain('10⁸');
  });
});
