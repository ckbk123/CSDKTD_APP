import { describe, expect, it } from 'vitest';
import { createModel, design, desiredRoots, polynomialRoots, simulate, type Settings, type Target } from './math';
const source = (): Settings => ({ plant: { gain: 10, tau: 10 }, sensor: .05, T: 2, structure: 'pi', reference: 1, preweight: 'raw' });
const target: Target = { mode: 'continuous', zeta: .707, wn: 2 };
const exact = (structure: 'pi' | 'pid' = 'pi'): Settings => ({ plant: { gain: 1, tau: 1 }, sensor: .5, T: Math.log(2), structure, reference: 1, preweight: 'raw' });
const pair: Target = { mode: 'discrete', re: .2, im: .3 };
describe('DD05 full characteristic matching, sensor convention and actual sampled loop', () => {
  it('matches the source-input PI fixture against a separate60-digit Decimal/series oracle', () => {
    const result = design(source(), target, -.2, 'comparator', true), m = result.model;
    // Oracle: Decimal exp/sqrt and90-term sin/cos series, outside browser code.
    expect(m.a).toBeCloseTo(.81873075307798185867, 14); expect(m.b).toBeCloseTo(1.8126924692201814133, 13);
    expect(result.desired.pair[0].re).toBeCloseTo(-.05626282518411268028, 14); expect(result.desired.pair[0].im).toBeCloseTo(.01819256346493521628, 14);
    expect(m.q[0]).toBeCloseTo(21.308152775379840336, 12); expect(m.q[1]).toBeCloseTo(-8.994733437223040429, 12);
    expect(m.gains.kp).toBeCloseTo(8.994733437223040429, 12); expect(m.gains.ki).toBeCloseTo(6.156709669078399954, 12); expect(m.gains.kd).toBe(0);
    expect(result.desired.extra).toBeNull(); expect(m.poles).toHaveLength(2); expect(m.stability).toBe('inside'); expect(result.compatible).toBe(true);
    expect(Math.max(...result.residuals.map(Math.abs))).toBeLessThan(1e-14);
    const r = simulate(m, 100); expect(r.samples[1].output).toBeCloseTo(38.62512806892414438, 11); expect(r.samples[2].output).toBeCloseTo(17.97412484811529575, 11);
    expect(r.limit).toBe(20); expect(r.comparatorLimit).toBe(0); expect(r.physicalLimit).toBe(-19); expect(r.overshoot).toBeCloseTo(93.12564034462072192, 10);
  });
  it('derives the independent rational PI target Q=z²-.4z+.13 and first outputs', () => {
    const { model: m } = design(exact(), pair, .9, 'comparator', true);
    expect(m.a).toBe(.5); expect(m.b).toBe(.5); expect(m.q[0]).toBeCloseTo(4.4, 13); expect(m.q[1]).toBeCloseTo(-1.48, 13);
    expect(m.gains.kp).toBeCloseTo(1.48, 13); expect(m.gains.ki * m.settings.T).toBeCloseTo(2.92, 13);
    expect(m.polynomial[1]).toBeCloseTo(-.4, 13); expect(m.polynomial[2]).toBeCloseTo(.13, 13);
    const r = simulate(m, 50); [0, 2.2, 2.34, 2.11].forEach((value, k) => expect(r.samples[k].output).toBeCloseTo(value, 12));
    expect(r.overshoot).toBeCloseTo(17, 11); expect(r.samples[0].control).toBeCloseTo(4.4, 13); expect(r.samples[1].control).toBeCloseTo(2.48, 12);
  });
  it('matches all three PID coefficients, retaining the additional pole and different transient', () => {
    const result = design(exact('pid'), pair, -.2, 'comparator', true), m = result.model;
    // (z²-.4z+.13)(z+.2)=z³-.2z²+.05z+.026.
    [1, -.2, .05, .026].forEach((value, i) => expect(m.polynomial[i]).toBeCloseTo(value, 13));
    [5.2, -1.8, .104].forEach((value, i) => expect(m.q[i]).toBeCloseTo(value, 13));
    expect(m.gains.kp).toBeCloseTo(1.592, 13); expect(m.gains.ki * m.settings.T).toBeCloseTo(3.504, 13); expect(m.gains.kd / m.settings.T).toBeCloseTo(.104, 13);
    expect(m.poles).toHaveLength(3); expect(m.poles!.find(z => Math.abs(z.im) < 1e-12)!.re).toBeCloseTo(-.2, 12);
    const r = simulate(m, 50); [0, 2.6, 2.22, 2.066].forEach((value, k) => expect(r.samples[k].output).toBeCloseTo(value, 12)); expect(r.overshoot).toBeCloseTo(30, 11);
  });
  it('distinguishes raw comparator zero error from physical zero error and calibrated reference', () => {
    const raw = design(exact(), pair, 0, 'physical', true); expect(raw.compatible).toBe(false); expect(raw.issues.join(' ')).toContain('incompatible');
    const calibrated = design({ ...exact(), preweight: 'calibrated' }, pair, 0, 'physical', true); expect(calibrated.compatible).toBe(true);
    expect(calibrated.model.polynomial).toEqual(raw.model.polynomial);
    const a = simulate(raw.model, 40), b = simulate(calibrated.model, 40);
    expect(a.limit).toBe(2); expect(a.physicalLimit).toBe(-1); expect(b.limit).toBe(1); expect(b.physicalLimit).toBe(0); expect(b.comparatorLimit).toBe(0);
    a.samples.forEach((sample, k) => expect(b.samples[k].output).toBeCloseTo(sample.output / 2, 12));
  });
  it('reports signed-gain incompatibility without calling a realizable signed controller impossible', () => {
    const constrained = design(exact('pid'), pair, .2, 'comparator', true); expect(constrained.model.gains.kd).toBeLessThan(0); expect(constrained.compatible).toBe(false); expect(constrained.issues.join()).toContain('negative PID gain');
    expect(design(exact('pid'), pair, .2, 'comparator', false).compatible).toBe(true);
  });
  it('does not discard the derivative delay mode when Kd=0 in a PID realization', () => {
    const d = design(exact('pid'), pair, 0, 'comparator', true); expect(d.model.gains.kd).toBeCloseTo(0, 14); expect(d.model.poles).toHaveLength(3); expect(d.model.poles).toContainEqual({ re: 0, im: 0 });
    expect(design(exact(), pair, NaN, 'comparator', true).desired.extra).toBeNull(); // unused extra data does not alter PI.
  });
  it('retains an unexcited integral mode and rejects final-value claims for it', () => {
    const m = createModel(exact(), { kp: .5, ki: 0, kd: 0 }); expect(m.stability).toBe('boundary'); expect(m.poles).toHaveLength(2);
    const r = simulate(m, 20); expect(r.limit).toBeNull(); expect(r.comparatorLimit).toBeNull(); expect(r.settlingCandidate).toBeNull();
    r.samples.forEach((s, k) => expect(s.output).toBeCloseTo(.4 * (1 - .375 ** k), 12));
  });
  it('checks every original state update and incremental residual without terminal double counting', () => {
    const m = design(exact('pid'), pair, -.2, 'comparator', true).model, r = simulate(m, 10);
    for (let k = 0; k < 10; k++) { const s = r.samples[k]; expect(r.samples[k + 1].output).toBeCloseTo(.5 * s.output + .5 * s.control!, 13); expect(s.incrementResidual).toBeCloseTo(0, 13); }
    expect(r.samples).toHaveLength(11); expect(r.samples[10].control).toBeNull(); expect(r.horizon).toBe(10 * Math.log(2));
    expect(r.controlEnergy).toBeCloseTo(r.samples.slice(0, 10).reduce((sum, s) => sum + Math.log(2) * s.control! ** 2, 0), 11);
  });
  it('preserves gain scaling and signed-reference symmetry on changed physical data', () => {
    const a = simulate(design(exact(), pair, 0, 'comparator', true).model, 40), b = simulate(design({ ...exact(), plant: { gain: 2, tau: 1 } }, pair, 0, 'comparator', true).model, 40);
    a.samples.forEach((s, k) => { expect(b.samples[k].output).toBeCloseTo(s.output, 12); if (s.control !== null) expect(b.samples[k].control).toBeCloseTo(s.control / 2, 12); }); expect(b.controlEnergy).toBeCloseTo(a.controlEnergy / 4, 12);
    const negative = simulate(design({ ...exact(), reference: -1 }, pair, 0, 'comparator', true).model, 40); expect(negative.overshoot).toBeCloseTo(a.overshoot!, 11); expect(negative.samples[1].output).toBeCloseTo(-2.2, 12);
    const zero = simulate(design({ ...exact(), reference: 0 }, pair, 0, 'comparator', true).model, 40); expect(zero.samples.every(s => s.output === 0 && (s.control === 0 || s.control === null))).toBe(true); expect(zero.overshoot).toBeNull();
  });
  it('derives actual complete roots independently for cubic complex/real/repeated/zero cases', () => {
    const complex = polynomialRoots([1, -.2, .05, .026]); expect(complex).toHaveLength(3);
    expect(complex.find(z => z.im > 0)!.re).toBeCloseTo(.2, 12); expect(complex.find(z => z.im > 0)!.im).toBeCloseTo(.3, 12);
    expect(polynomialRoots([1, -.4, -.11, .03]).map(z => z.re).sort((a, b) => a - b)).toEqual(expect.arrayContaining([expect.closeTo(-.3, 12), expect.closeTo(.2, 12), expect.closeTo(.5, 12)]));
    expect(polynomialRoots([1, -1.5, .75, -.125])).toEqual([{ re: .5, im: 0 }, { re: .5, im: 0 }, { re: .5, im: 0 }]);
    expect(polynomialRoots([1, -1, 0, 0])).toHaveLength(3);
  });
  it('checks boundary/outside candidates, work limits, growth and conservative roundoff feedback', () => {
    const unstable = createModel(source(), { kp: 1000, ki: 1000, kd: 0 }); expect(unstable.stability).toBe('outside'); expect(() => simulate(unstable, 100)).toThrow('no partial');
    for (const n of [9, 2001, 10.5, NaN]) expect(() => simulate(design(exact(), pair, 0, 'comparator', true).model, n)).toThrow();
    const hidden = createModel(exact('pid'), { kp: .5, ki: 0, kd: 0 }); expect(() => simulate(hidden, 2000)).toThrow('Roundoff amplification');
  });
  it('rejects aliased, repeated/under-resolved and unstable target pairs with useful feedback', () => {
    expect(() => desiredRoots({ mode: 'continuous', zeta: .1, wn: 4 }, 2, 'pi', 0)).toThrow('Nyquist');
    expect(() => desiredRoots({ mode: 'continuous', zeta: .99, wn: 20 }, 10, 'pi', 0)).toThrow('at most20');
    expect(() => desiredRoots({ mode: 'discrete', re: .8, im: .8 }, .1, 'pi', 0)).toThrow('strictly inside');
    expect(() => desiredRoots({ mode: 'discrete', re: .2, im: 0 }, .1, 'pi', 0)).toThrow();
    expect(() => desiredRoots(pair, .1, 'pid', 1)).toThrow('Additional PID pole');
  });
  it('validates physical/controller precision bounds and PI realization separately from PID', () => {
    expect(() => createModel({ ...exact(), T: 0 }, { kp: 1, ki: 1, kd: 0 })).toThrow('Sample period');
    expect(() => createModel({ ...exact(), sensor: 0 }, { kp: 1, ki: 1, kd: 0 })).toThrow('Sensor');
    expect(() => createModel({ ...exact(), plant: { gain: 1, tau: .01 }, T: 1 }, { kp: 1, ki: 1, kd: 0 })).toThrow('T/τ');
    expect(() => createModel(exact(), { kp: 1, ki: 1, kd: 1 })).toThrow('PI has no derivative');
    expect(() => createModel(exact('pid'), { kp: Infinity, ki: 1, kd: 1 })).toThrow('Controller');
    expect(() => polynomialRoots([1, 0, 0, 0, 1])).toThrow('degree');
    expect(() => polynomialRoots([1, 1e7, 1])).toThrow('magnitude');
  });
});
