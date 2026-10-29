import { describe, expect, it } from 'vitest';
import { analyzeFrequency, coordinates, cosineRoots, createModel, DROP_SQUARED, emulatePI, frequency, magnitudePolynomial, roots, sampledResponse } from './math';

const baseline = () => createModel({ denominator: [1, -.8], numerator: [.5] });
describe('DF03 independent unit-circle and feedback mathematics', () => {
  it('matches the baseline analytic gain/phase endpoints, full pole and -3dB equation', () => {
    const m = baseline(), a = analyzeFrequency(m, .1), c = (1 + .8 ** 2 - .5 ** 2) / 1.6;
    expect(m.closed).toEqual([1, -.30000000000000004]); expect(m.poles[0].re).toBeCloseTo(.3, 14); expect(m.stability).toBe('inside');
    expect(a.gain.points).toHaveLength(1); expect(a.gain.points[0].angle).toBeCloseTo(Math.acos(c), 13);
    // |exp(j Omega)-.8|=.5, phase= -atan2(sin(Omega), cos(Omega)-.8).
    const phase = -Math.atan2(Math.sqrt(1 - c * c), c - .8) * 180 / Math.PI;
    expect(a.phaseMargins[0].degrees).toBeCloseTo(180 + phase, 12);
    expect(a.gainMargins).toHaveLength(1); expect(a.gainMargins[0].angle).toBe(Math.PI); expect(a.gainMargins[0].factor).toBeCloseTo(3.6, 13);
    expect(a.bandwidth.angle).toBeCloseTo(Math.acos((1 + .3 ** 2 - .7 ** 2 / DROP_SQUARED) / .6), 12);
    expect(frequency(m, 0, .1).value!.re).toBeCloseTo(2.5, 14);
  });
  it('evaluates a complex cursor directly, retaining axes and undefined endpoints', () => {
    const f = frequency(baseline(), Math.PI / 2, .2);
    expect(f.value!.re).toBeCloseTo(-.4 / 1.64, 14); expect(f.value!.im).toBeCloseTo(-.5 / 1.64, 14);
    expect(f.omega).toBeCloseTo(2.5 * Math.PI, 14); expect(f.hz).toBe(1.25); expect(f.warped).toBeCloseTo(10, 13);
    expect(coordinates(Math.PI, .1).warped).toBe(Infinity); expect(coordinates(0, .1).hz).toBe(0);
  });
  it('finds both resonant gain crossings without a sweep', () => {
    // |D|² = 3.6c²-5.32c+1.97; |.4z|²=.16.
    const m = createModel({ denominator: [1, -1.4, .9], numerator: [.4, 0] }), a = analyzeFrequency(m, .1);
    const disc = 5.32 ** 2 - 4 * 3.6 * 1.81;
    const expected = [(5.32 + Math.sqrt(disc)) / 7.2, (5.32 - Math.sqrt(disc)) / 7.2].map(Math.acos);
    expect(a.gain.points).toHaveLength(2);
    a.gain.points.forEach((p, i) => { expect(p.angle).toBeCloseTo(expected[i], 12); expect(p.value.magnitude).toBeCloseTo(1, 12); });
    expect(a.gainMargins).toHaveLength(1); expect(a.gainMargins[0].angle).toBe(Math.PI);
  });
  it('preserves a tangency and handles the exact constant-magnitude continuum', () => {
    expect(cosineRoots([.25, -1, 1])).toEqual({ continuum: false, points: [{ cosine: .5, repeated: true }] });
    const a = analyzeFrequency(createModel({ denominator: [1, 0], numerator: [1] }), .1);
    expect(a.gain.continuum).toBe(true); expect(a.gain.points).toEqual([]); expect(a.gainMargins[0].factor).toBe(1);
    expect(a.bandwidth.status).toBe('undefined'); // full pole -1 is on the disk.
  });
  it('includes zero/Nyquist gain endpoints and signed phase margins', () => {
    const a = analyzeFrequency(createModel({ denominator: [1, -.5], numerator: [.5] }), .1);
    expect(a.gain.points[0].angle).toBe(0); expect(a.gain.points[0].kind).toBe('endpoint'); expect(a.phaseMargins[0].degrees).toBe(180);
    const b = analyzeFrequency(createModel({ denominator: [1, -.5], numerator: [-1.5] }), .1);
    expect(b.gain.points[0].angle).toBe(Math.PI); expect(b.phase.points[0].angle).toBe(0); expect(b.gainMargins[0].factor).toBeCloseTo(1 / 3);
  });
  it('finds an interior negative-real crossing from the independent imaginary equation', () => {
    // N=.4z+.2, D=z²-.6z+.3. Im(N D*)=sin(Omega)*(-.16-.4c).
    const m = createModel({ denominator: [1, -.6, .3], numerator: [.4, .2] }), a = analyzeFrequency(m, .1);
    const crossing = a.phase.points.find(p => Math.abs(p.cosine + .4) < 1e-12)!;
    expect(crossing).toBeDefined(); expect(crossing.value.value!.im).toBeCloseTo(0, 12); expect(crossing.value.value!.re).toBeLessThan(0);
  });
  it('reports the entire negative-real continuum as bounded angle intervals', () => {
    const a = analyzeFrequency(createModel({ denominator: [1, 0, 1], numerator: [1, 0] }), .1);
    expect(a.phase.continuum).toBe(true);
    expect(a.phase.intervals).toEqual([{ from: Math.PI / 2, to: Math.PI, fromIncluded: false, toIncluded: true }]);
    expect(a.singular[0].status).toBe('pole');
  });
  it('keeps unreduced cancelled modes and distinguishes 0/0 from poles', () => {
    const m = createModel({ denominator: [1, -1, 0], numerator: [.5, -.5] });
    expect(m.closed).toEqual([1, -.5, -.5]); expect(m.poles.map(p => p.re).sort()).toEqual([-.5, 1]); expect(m.stability).toBe('boundary');
    expect(frequency(m, 0, .1).status).toBe('indeterminate'); expect(analyzeFrequency(m, .1).bandwidth.status).toBe('undefined');
    expect(frequency(createModel({ denominator: [1, -1], numerator: [.5] }), 0, .1).status).toBe('pole');
    const f = frequency(createModel({ denominator: [1, -.6, .3], numerator: [.2, -.2] }), 0, .1);
    expect(f.status).toBe('zero'); expect(f.phase).toBeNull(); expect(f.db).toBe(-Infinity);
  });
  it('returns absence rather than invented margins/bandwidth for a zero loop', () => {
    const m = createModel({ denominator: [1, .2], numerator: [0] }), a = analyzeFrequency(m, .1);
    expect(a.gain.points).toEqual([]); expect(a.phase.points).toEqual([]); expect(a.phase.continuum).toBe(false); expect(a.bandwidth.status).toBe('undefined');
    expect(sampledResponse(m, .1, 20).values.every(x => x === 0)).toBe(true);
  });
  it('states that a flat stable closed-loop response never drops -3dB below Nyquist', () => {
    const m = createModel({ denominator: [1, -.5], numerator: [.5] });
    expect(analyzeFrequency(m, .1).bandwidth.status).toBe('beyond'); // H=.5/z, constant magnitude.
  });
  it('retains all closed poles including oscillatory and repeated poles', () => {
    const complex = roots([1, -1, .5]); expect(complex).toEqual([{ re: .5, im: .5 }, { re: .5, im: -.5 }]);
    expect(roots([1, -1, .25])).toEqual([{ re: .5, im: 0 }, { re: .5, im: 0 }]);
    expect(roots([1, -100, 1])[1].re).toBeCloseTo(.01000100020005, 12);
    for (const p of [[1], [0, 1], [1, NaN]]) expect(() => roots(p)).toThrow();
  });
  it('matches the baseline closed-form zero-state response and sampled transient definitions', () => {
    const r = sampledResponse(baseline(), .1, 20);
    r.values.forEach((y, k) => expect(y).toBeCloseTo(5 / 7 * (1 - .3 ** k), 13));
    expect(r.limit).toBeCloseTo(5 / 7, 14); expect(r.overshoot).toBe(0); expect(r.rise).toBeCloseTo(.1, 14); expect(r.settlingCandidate).toBe(.4);
  });
  it('computes actual alternating overshoot and exposes insufficient settling horizons', () => {
    const m = createModel({ denominator: [1, -.2], numerator: [1] }), r = sampledResponse(m, .2, 40);
    // q=-.8, y[k]=(1/1.8)*(1-(-.8)^k), first peak1=180% of limit.
    expect(r.overshoot).toBeCloseTo(80, 12); expect(r.values[1]).toBe(1); expect(r.values[2]).toBeCloseTo(.2, 13);
    expect(sampledResponse(m, .2, 10).settlingCandidate).toBeNull();
    const slow = createModel({ denominator: [1, -.999], numerator: [.001] });
    expect(sampledResponse(slow, .1, 10).rise).toBeNull();
  });
  it('does not certify a steady limit for unstable hidden modes or return partial growth metrics', () => {
    const hidden = createModel({ denominator: [1, -2, 0], numerator: [.1, -.2] });
    expect(hidden.stability).toBe('outside'); expect(sampledResponse(hidden, .1, 10).limit).toBeNull();
    expect(() => sampledResponse(createModel({ denominator: [1, 0], numerator: [100] }), .1, 20)).toThrow('no partial');
  });
  it('changes seconds axes and response times with T while keeping the same discrete loop poles', () => {
    const m = baseline(), a = analyzeFrequency(m, .1), b = analyzeFrequency(m, .2);
    expect(a.gain.points[0].angle).toBe(b.gain.points[0].angle);
    expect(frequency(m, .5, .1).omega).toBe(2 * frequency(m, .5, .2).omega);
    expect(sampledResponse(m, .2, 20).settlingCandidate).toBe(2 * sampledResponse(m, .1, 20).settlingCandidate!);
  });
  it('builds independent backward/trapezoidal PI and exact ZOH coefficients at T=ln2', () => {
    const p = { g: 2, tau: 1, kp: .5, ki: 1, T: Math.log(2), method: 'backward' as const }, b = emulatePI(p), t = emulatePI({ ...p, method: 'trapezoidal' });
    expect(b.a).toBe(.5); expect(b.b).toBe(1); expect(b.model.denominator).toEqual([1, -1.5, .5]);
    expect(b.model.numerator).toEqual([.5 + Math.log(2), -.5]);
    expect(t.model.numerator).toEqual([.5 + Math.log(2) / 2, -.5 + Math.log(2) / 2]);
    for (const item of [b, t]) expect(sampledResponse(item.model, p.T, 100).limit).toBeCloseTo(1, 13);
    expect(b.model.closed).not.toEqual(t.model.closed);
  });
  it('rejects unsupported sizes, nonfinite/under-resolved coefficients, work and emulator limits', () => {
    for (const loop of [{ denominator: [1, 1, 1, 1], numerator: [1] }, { denominator: [2, 1], numerator: [1] }, { denominator: [1, 0], numerator: [1, 0] }, { denominator: [1, 1e-10], numerator: [1] }, { denominator: [1, 0], numerator: [Infinity] }]) expect(() => createModel(loop)).toThrow();
    for (const n of [9, 2001, 10.5, NaN]) expect(() => sampledResponse(baseline(), .1, n)).toThrow();
    for (const T of [0, .0001, 11, Infinity]) expect(() => coordinates(1, T)).toThrow();
    expect(() => coordinates(3.2, .1)).toThrow();
    expect(() => emulatePI({ g: 1, tau: .01, kp: 1, ki: 1, T: 1, method: 'backward' })).toThrow('T/tau');
  });
  it('verifies the magnitude polynomial independently at three exact angles', () => {
    const p = [1, -1.4, .9], q = magnitudePolynomial(p), value = (c: number) => q[0] + q[1] * c + q[2] * c * c;
    expect(value(1)).toBeCloseTo(.5 ** 2, 13); expect(value(-1)).toBeCloseTo(3.3 ** 2, 13); expect(value(0)).toBeCloseTo(.1 ** 2 + 1.4 ** 2, 13);
    expect(cosineRoots([1, 0, 1]).points).toEqual([]); expect(cosineRoots([0, 0, 0]).continuum).toBe(true);
    expect(() => cosineRoots([1, -2, 1 - Number.EPSILON])).toThrow('too close');
  });
});
