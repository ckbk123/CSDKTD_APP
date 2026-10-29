import { describe, expect, it } from 'vitest';
import { coefficientResidual, controllerBase, delayedTransfer, dot, historyMap, historyRealization, historyTransfer, mv, observerBase, recoverBase, recurrenceSamples, run, trace, withInputDelay, zohBaseline, type Experiment, type Matrix, type StateModel } from './math';
import { parseModel, type Model } from './parser';

const experiment = (extra: Partial<Experiment> = {}): Experiment => ({ T: .1, count: 8, delay: 0, amplitude: 1, kind: 'step', pastY: [0, 0], pastU: [0, 0], ...extra });
const close = (actual: number[], expected: number[], tolerance = 2e-11): void => {
  expect(actual).toHaveLength(expected.length);
  actual.forEach((v, i) => expect(Math.abs(v - expected[i]) / Math.max(1, Math.abs(expected[i]))).toBeLessThanOrEqual(tolerance));
};
const matrixClose = (actual: Matrix, expected: Matrix): void => {
  expect(actual).toHaveLength(expected.length); actual.forEach((row, i) => close(row, expected[i]));
};
const changed: Model = { a: [1, -.5, .125], b: [2, 3, 4] };
const before = [1, -2], inputBefore = [3, -1];

describe('DR03 declared mechanical ZOH source', () => {
  it.each([1e-4, .1, .2, Math.log(2), 1, 10])('matches independent modal state/input and step expressions at T=%s', T => {
    const { continuous, discrete, model } = zohBaseline(T);
    expect(continuous.A).toEqual([[0, 1], [-2, -3]]);
    const p = Math.exp(-T), q = Math.exp(-2 * T);
    matrixClose(discrete.A, [[2 * p - q, p - q], [-2 * p + 2 * q, -p + 2 * q]]);
    close(discrete.B, [.5 - p + .5 * q, p - q]);
    close(model.a, [1, -p - q, p * q]);
    const rows = trace(discrete, [0, 0], Array(8).fill(1) as number[], T);
    close(rows.map(row => row.y), rows.map((_, k) => .5 - Math.exp(-k * T) + .5 * Math.exp(-2 * k * T)));
    const result = run(model, experiment({ T }));
    expect(result.canonicalWarning).toBe('');
    close(result.rows.map(row => row.y), rows.map(row => row.y));
  });
  it('does not lose the small-period quadratic input integral', () => {
    const { discrete } = zohBaseline(1e-4);
    expect(discrete.B[0]).toBeCloseTo(4.999500029165417e-9, 20);
    expect(discrete.B[0]).toBeGreaterThan(0);
  });
  it.each([0, 1e-5, 11, NaN, Infinity])('rejects unsupported source period %s', T => expect(() => zohBaseline(T)).toThrow(/T/));
});

describe('DR03 scalar storage and simultaneous updates', () => {
  it('constructs history rows with independent direct feedthrough', () => {
    const h = historyRealization(changed, 0);
    expect(h.labels).toEqual(['y[k-1]', 'y[k-2]', 'u[k-1]', 'u[k-2]']);
    expect(h.A).toEqual([[.5, -.125, 3, 4], [1, 0, 0, 0], [0, 0, 0, 0], [0, 0, 1, 0]]);
    expect(h.B).toEqual([2, 0, 1, 0]); expect(h.C).toEqual([.5, -.125, 3, 4]); expect(h.D).toBe(2);
    const rows = trace(h, [...before, ...inputBefore], [1, 1], .1);
    expect(rows[0]).toEqual({ k: 0, t: 0, u: 1, y: 7.75, x: [1, -2, 3, -1], next: [7.75, 1, 1, 3] });
    expect(rows[1].x).toEqual([7.75, 1, 1, 3]); expect(rows[1].y).toBe(20.75);
  });
  it('matches independently derived exact-rational recurrence values with changed data/history', () => {
    const expected = [31 / 4, 83 / 4, 589 / 32, 999 / 64, 3713 / 256, 3661 / 256, 29363 / 2048, 58905 / 4096];
    const result = run(changed, experiment({ pastY: before, pastU: inputBefore }));
    expect(result.reference).toEqual(expected); close(result.rows.map(row => row.y), expected);
    close(result.controller!.rows.map(row => row.y), expected); close(result.observer!.rows.map(row => row.y), expected);
    expect(result.historyResidual).toBe(0);
  });
  it('adds two actual input samples and shifts feedthrough onto old storage', () => {
    const result = run(changed, experiment({ delay: 2, pastY: before, pastU: [3, -1, 2, -2] }));
    const expected = [-13 / 4, 37 / 4, 385 / 32, 1399 / 64, 4717 / 256, 3963 / 256, 29567 / 2048, 58505 / 4096];
    close(result.reference, expected); close(result.controller!.rows.map(row => row.y), expected);
    close(result.observer!.rows.map(row => row.y), expected);
    expect(result.history.A).toHaveLength(6); expect(result.history.D).toBe(0);
    expect(result.controller!.system.A).toHaveLength(4); expect(result.controller!.system.D).toBe(0);
    expect(result.controller!.system.C.slice(2)).toEqual([0, 2]);
    expect(result.controller!.initial.slice(2)).toEqual([3, -1]);
    expect(result.rows[0].next).toEqual([-3.25, 1, 1, 3, -1, 2]);
  });
  it.each([0, 1, 2, 3, 4])('uses exactly m scalar states for delayed gain when m=%s', delay => {
    const e = experiment({ delay, pastY: [], pastU: [5, -2, 7, 3].slice(0, delay), amplitude: 2 });
    const r = run({ a: [1], b: [3] }, e);
    expect(r.history.A).toHaveLength(delay); expect(r.controller!.system.A).toHaveLength(delay);
    close(r.reference, [...e.pastU].reverse().map(v => 3 * v).concat(Array(8 - delay).fill(6) as number[]));
    expect(r.canonicalWarning).toBe(''); expect(r.history.D).toBe(delay ? 0 : 3);
  });
  it('uses a one-sample pulse rather than a continuous-time impulse', () => {
    const r = run({ a: [1, -.5], b: [0, 1] }, experiment({ kind: 'pulse', pastY: [0], pastU: [0] }));
    expect(r.inputs).toEqual([1, 0, 0, 0, 0, 0, 0, 0]);
    expect(r.reference).toEqual([0, 1, .5, .25, .125, .0625, .03125, .015625]);
  });
  it('uses physical ramp A*k*T and alternating samples', () => {
    const m = { a: [1], b: [1] };
    expect(run(m, experiment({ kind: 'ramp', T: .25, amplitude: 2, pastY: [], pastU: [] })).reference).toEqual([0, .5, 1, 1.5, 2, 2.5, 3, 3.5]);
    expect(run(m, experiment({ kind: 'alternating', amplitude: 2, pastY: [], pastU: [] })).reference).toEqual([2, -2, 2, -2, 2, -2, 2, -2]);
  });
  it('retains arbitrary declared history rather than assuming a zero-state transfer response', () => {
    const m = parseModel('1/(z-.5)');
    const r = run(m, experiment({ amplitude: 0, pastY: [4], pastU: [3] }));
    close(r.reference, [5, 2.5, 1.25, .625, .3125, .15625, .078125, .0390625]);
    close(r.controller!.initial, [5]); close(r.observer!.initial, [5]);
    expect(trace(r.controller!.system, [4], r.inputs, .1)[0].y).toBe(4);
  });
});

describe('DR03 recovered zero-state channel and mapped coordinates', () => {
  it('recovers the actual constructed base, including direct feedthrough', () => {
    const c = controllerBase(changed), o = observerBase(c);
    expect(c.A).toEqual([[.5, -.125], [1, 0]]); expect(c.C).toEqual([4, 3.75]); expect(c.D).toBe(2);
    expect(o.A).toEqual([[.5, 1], [-.125, 0]]); expect(o.B).toEqual([4, 3.75]); expect(o.C).toEqual([1, 0]);
    expect(recoverBase(c)).toEqual(changed); expect(recoverBase(o)).toEqual(changed);
    const arbitrary: StateModel = { A: [[1, 2], [3, 4]], B: [2, -1], C: [3, 5], D: 7, labels: ['a', 'b'] };
    // C adj(zI-A) B = z+5, and 7 det(zI-A) = 7z²-35z-14.
    expect(recoverBase(arbitrary)).toEqual({ a: [1, -5, -2], b: [7, -34, -9] });
  });
  it('distinguishes redundant history eigenvalues from the channel denominator', () => {
    expect(delayedTransfer(changed, 2)).toEqual({ a: [1, -.5, .125, 0, 0], b: [0, 0, 2, 3, 4] });
    expect(historyTransfer(changed, 2)).toEqual({ a: [1, -.5, .125, 0, 0, 0, 0], b: [0, 0, 2, 3, 4, 0, 0] });
  });
  it('places the last input-delay cell at the plant input before all cells shift', () => {
    const c = controllerBase(changed), d = withInputDelay(c, 2);
    expect(d.A).toEqual([[.5, -.125, 0, 1], [1, 0, 0, 0], [0, 0, 0, 0], [0, 0, 1, 0]]);
    expect(d.B).toEqual([0, 0, 1, 0]); expect(d.C).toEqual([4, 3.75, 0, 2]);
    const row = trace(d, [0, 0, 3, -1], [2], .1)[0];
    expect(row.y).toBe(-2); expect(row.next).toEqual([-1, 0, 2, 3]);
  });
  it('maps history and companion coordinates instead of copying their numerical vectors', () => {
    const r = run(changed, experiment({ pastY: before, pastU: inputBefore }));
    close(r.controller!.initial, [931 / 377, -415 / 377]);
    matrixClose(r.coordinateMap!, [[4, 3.75], [3.75, -2.375]]);
    close(r.observer!.initial, mv(r.coordinateMap!, r.controller!.initial));
    expect(r.observer!.initial[0]).toBeCloseTo(5.75, 12);
    expect(r.controller!.initial).not.toEqual(r.observer!.initial);
    expect(Math.abs(trace(r.observer!.system, r.controller!.initial, r.inputs, .1)[0].y - 7.75)).toBeGreaterThan(1);
    close(mv(r.historyMap!, [...before, ...inputBefore]), r.controller!.initial);
  });
  it.each([0, 1, 2, 3, 4])('maps nonzero delayed prehistory consistently for m=%s', delay => {
    const pastU = [3, -1, 2, -2, 1, 4].slice(0, 2 + delay);
    const r = run(changed, experiment({ delay, pastY: before, pastU, kind: 'alternating' }));
    expect(r.canonicalWarning).toBe('');
    close(r.controller!.rows.map(row => row.y), r.reference);
    close(r.observer!.rows.map(row => row.y), r.reference);
    expect(r.controller!.initial.slice(2)).toEqual(pastU.slice(0, delay));
  });
  it('preserves a valid nonminimal history response while reporting a singular canonical map', () => {
    const r = run(parseModel('(z-1)/(z^2-1)'), experiment({ pastY: [1, -2], pastU: [3, -1], amplitude: 0 }));
    expect(r.controller).toBeUndefined(); expect(r.observer).toBeUndefined();
    expect(r.canonicalWarning).toMatch(/singular|nonminimal/);
    expect(r.rows.map(row => row.y)).toEqual(r.reference);
    expect(r.reference.slice(0, 4)).toEqual([2, -2, 2, -2]);
  });
  it('retains zero-channel internal recurrence history and reports absent invertible coordinates', () => {
    const r = run({ a: [1, -.5], b: [0, 0] }, experiment({ pastY: [4], pastU: [0] }));
    expect(r.reference).toEqual([2, 1, .5, .25, .125, .0625, .03125, .015625]);
    expect(r.canonicalWarning).toMatch(/singular/);
  });
  it('rejects an ill-conditioned map without hiding the valid delay-register output', () => {
    const r = run({ a: [1, 0, -1], b: [0, 1, -1 + 1e-12] }, experiment());
    expect(r.canonicalWarning).toMatch(/condition/); expect(r.rows).toHaveLength(8);
  });
  it('checks small nonzero coefficients relatively rather than against a unit absolute scale', () => {
    expect(coefficientResidual({ a: [1, -1e-20], b: [0, 1e-30] }, { a: [1, 0], b: [0, 0] })).toBe(1);
    expect(coefficientResidual({ a: [1], b: [0] }, { a: [1], b: [1e-12] })).toBe(1e-12);
    expect(coefficientResidual({ a: [1], b: [1] }, { a: [1, 0], b: [0, 1] })).toBe(Infinity);
  });
});

describe('DR03 finite domain and resource failures', () => {
  it.each([-1, .5, 5, NaN])('rejects input delay %s rather than rounding', delay => expect(() => historyRealization(changed, delay)).toThrow(/integer input delay/));
  it.each([0, 3, 4.5, 121, NaN])('rejects sample count %s', count => expect(() => run(changed, experiment({ count }))).toThrow(/4–120/));
  it.each([0, 1e-5, 11, NaN])('rejects sample period %s', T => expect(() => run(changed, experiment({ T }))).toThrow(/T/));
  it('rejects wrong monic/order/padded dimensions and nonfinite/out-of-bound coefficients', () => {
    for (const m of [{ a: [2, 1], b: [0, 1] }, { a: [1, 0, 0, 0], b: [0, 0, 0, 1] }, { a: [1, 1], b: [1] }]) expect(() => controllerBase(m)).toThrow(/monic/);
    expect(() => controllerBase({ a: [1, Infinity], b: [0, 1] })).toThrow(/finite/);
    expect(() => controllerBase({ a: [1, 1e7], b: [0, 1] })).toThrow(/bound/);
    expect(() => controllerBase({ a: [1, 1e-310], b: [0, 1] })).toThrow(/below/);
  });
  it('rejects incomplete/nonfinite history and out-of-bound samples', () => {
    expect(() => run(changed, experiment({ pastU: [0] }))).toThrow(/past/);
    expect(() => run(changed, experiment({ pastY: [NaN, 0] }))).toThrow(/finite/);
    expect(() => run(changed, experiment({ amplitude: 10001 }))).toThrow(/bound/);
    expect(() => run(changed, experiment({ kind: 'ramp', T: 10, amplitude: 1000 }))).toThrow(/bound/);
    expect(() => run(changed, experiment({ kind: 'unknown' as Experiment['kind'] }))).toThrow(/named/);
  });
  it('bounds generated output and next-state work including the next preview', () => {
    expect(() => run({ a: [1, -1e6], b: [0, 1] }, experiment({ pastY: [1], pastU: [0] }))).toThrow(/bound/);
    const s: StateModel = { A: [[1e12]], B: [0], C: [0], D: 0, labels: ['q'] };
    expect(() => trace(s, [2], [0], .1)).toThrow(/Next state/);
    expect(() => trace(s, [], [0], .1)).toThrow(/dimensions/);
    expect(() => trace({ ...s, A: [[1, 2]] }, [0], [0], .1)).toThrow(/square/);
  });
  it('rounds a dot product once, preserving a small result after large cancellation', () => {
    expect(dot([1e16, 1, -1e16], [1, 1, 1])).toBe(1);
    expect(() => dot([1], [])).toThrow(/dimensions/);
    expect(() => dot([Number.MIN_VALUE], [.25])).toThrow(/range/);
  });
  it('rejects oversized recovery bases and validates history-map dimensions', () => {
    const s: StateModel = { A: [[0, 0, 0], [1, 0, 0], [0, 1, 0]], B: [1, 0, 0], C: [1, 0, 0], D: 0, labels: ['a', 'b', 'c'] };
    expect(() => recoverBase(s)).toThrow(/base separately/);
    expect(() => recurrenceSamples(changed, 0, [], [], [1])).toThrow(/past/);
    expect(historyMap({ a: [1], b: [2] }, 2, controllerBase({ a: [1], b: [2] }))).toEqual([]);
  });
});
