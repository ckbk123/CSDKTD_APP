import { describe, expect, it } from 'vitest';
import { analyzeFrequency, coordinates, cosineRoots, createModel, designDirect, frequency, fromWarped, magnitudePolynomial, poleStatus, sampledResponse, tracking, unitPoint, warpedPlantFrequency, wPlanePlant } from './math';
import { polynomialRoots } from './roots';

const plant = { gain: 1, p: 2 }, constant = { kind: 'constant', K: 4 } as const;
const baseline = () => createModel(plant, .1, constant);
describe('DD03 independent exact ZOH and complete sampled loop', () => {
  it('matches a 65-digit Decimal ZOH/physical-step oracle, not UI baseline text', () => {
    const m = baseline();
    expect(m.a).toBeCloseTo(.81873075307798185867, 15);
    expect(m.b1).toBeCloseTo(.00468268826949546466748, 15);
    expect(m.b0).toBeCloseTo(.00438077407660544239902, 15);
    expect(m.closed[1]).toBeCloseTo(-1.8, 14); expect(m.closed[2]).toBeCloseTo(.836253849384403628266, 14);
    for (const z of m.poles) { expect(z.re).toBeCloseTo(.9, 14); expect(Math.abs(z.im)).toBeCloseTo(.162030396482893382649, 14); }
    expect(m.stability).toBe('inside');
    const r = sampledResponse(m, 200);
    expect(r.values[1]).toBeCloseTo(.0187307530779818586699, 14);
    expect(r.values[2]).toBeCloseTo(.0699692049247709738719, 14);
    expect(r.controls[1]).toBeCloseTo(3.92507698768807256532, 14);
    expect(r.values[200]).toBeCloseTo(1, 7); expect(r.controls).toHaveLength(200); expect(r.errors).toHaveLength(201);
    expect(tracking(m)).toMatchObject({ stepLimit: 1, stepError: 0, velocityConstant: 2, rampError: .5 });
  });
  it('matches the independently integrated T=ln2 plant, including controller timing', () => {
    const T = Math.log(2), m = createModel({ gain: 1, p: 1 }, T, { kind: 'corners', K: 1, zero: T, pole: T / 2 });
    // A=[[1,1/2],[0,1/2]], B=[ln2−1/2,1/2], u[k]=1.5e[k]−.5e[k−1].
    expect(m.a).toBeCloseTo(.5, 15); expect(m.b1).toBeCloseTo(T - .5, 15); expect(m.b0).toBeCloseTo((1 - T) / 2, 15);
    expect(m.cn).toEqual([1.5, -.5]); expect(m.cd).toEqual([1, 0]); expect(m.poles).toHaveLength(3);
    const y1 = 1.5 * (T - .5), u1 = 1 - 1.5 * y1, y2 = y1 + .375 + (T - .5) * u1;
    const r = sampledResponse(m, 30); expect(r.controls[0]).toBe(1.5); expect(r.controls[1]).toBeCloseTo(u1, 14); expect(r.values[1]).toBeCloseTo(y1, 14); expect(r.values[2]).toBeCloseTo(y2, 14);
  });
  it('retains a controller pole even when its corners cancel', () => {
    const m = createModel(plant, .1, { kind: 'corners', K: 4, zero: .1, pole: .1 }), simple = baseline();
    expect(m.poles).toHaveLength(3); expect(m.poles.some(z => Math.abs(z.re - 1 / 3) < 1e-10 && z.im === 0)).toBe(true);
    const a = sampledResponse(m, 100), b = sampledResponse(simple, 100);
    a.values.forEach((v, i) => expect(v).toBeCloseTo(b.values[i], 11));
  });
  it('preserves loop output under inverse controller/plant gain scaling, while control/effort scale', () => {
    const a = sampledResponse(baseline(), 100), b = sampledResponse(createModel({ gain: 2, p: 2 }, .1, { kind: 'constant', K: 2 }), 100);
    a.values.forEach((v, i) => expect(v).toBeCloseTo(b.values[i], 13));
    a.controls.forEach((v, i) => expect(v).toBeCloseTo(2 * b.controls[i], 13)); expect(a.energy).toBeCloseTo(4 * b.energy, 11);
  });
  it('uses resolved small-pT moments rather than subtracting nearly equal numbers', () => {
    const m = createModel({ gain: 2, p: .1 }, .005, { kind: 'constant', K: 4 }), x = .0005;
    expect(m.b1 / (.005 ** 2)).toBeCloseTo(1 - x / 3 + x * x / 12 - x ** 3 / 60, 13);
    expect(m.b0 / (.005 ** 2)).toBeCloseTo(1 - 2 * x / 3 + x * x / 4 - x ** 3 / 15, 13);
  });
  it('reports unstable tracking/insufficient horizon and guards long amplified trajectories', () => {
    const unstable = createModel(plant, .1, { kind: 'constant', K: 100 }); expect(unstable.stability).toBe('outside');
    expect(tracking(unstable)).toMatchObject({ stepLimit: null, rampError: null });
    expect(sampledResponse(unstable, 10).settlingCandidate).toBeNull(); expect(() => sampledResponse(unstable, 2000)).toThrow(/Roundoff|magnitude/);
    const slow = sampledResponse(createModel(plant, .1, { kind: 'constant', K: .1 }), 10); expect(slow.rise).toBeNull(); expect(slow.settlingCandidate).toBeNull();
  });
  it.each([0, 9, 10.5, 2001, NaN, Infinity])('rejects invalid interval count %s', n => { expect(() => sampledResponse(baseline(), n)).toThrow(); });
  it('rejects nonphysical, excessive and nonfinite data', () => {
    expect(() => createModel({ gain: 0, p: 2 }, .1, constant)).toThrow(/gain/);
    expect(() => createModel({ gain: 1, p: -2 }, .1, constant)).toThrow(/rate/);
    expect(() => createModel(plant, 0, constant)).toThrow(/period/);
    expect(() => createModel({ gain: 1, p: 20 }, 2, constant)).toThrow(/pT/);
    expect(() => createModel(plant, .1, { kind: 'constant', K: Infinity })).toThrow(/gain/);
    expect(() => createModel(plant, .1, { kind: 'corners', K: 4, zero: 0, pole: .2 })).toThrow(/constant/);
    expect(() => createModel(plant, .005, { kind: 'corners', K: 1000, zero: 1000, pole: .0001 })).toThrow(/coefficients/);
  });
});
describe('DD03 transform, direct lead and all algebraic crossings', () => {
  it('uses the nonlinear frequency map, including Nyquist infinity', () => {
    const c = coordinates(Math.PI / 2, .1); expect(c.warped).toBeCloseTo(20, 13); expect(c.omega).toBeCloseTo(5 * Math.PI, 13);
    expect(fromWarped(20, .1).angle).toBeCloseTo(Math.PI / 2, 14); expect(fromWarped(Infinity, .1).angle).toBe(Math.PI);
    expect(coordinates(Math.PI, .1).warped).toBe(Infinity); expect(unitPoint(Math.PI)).toEqual({ re: -1, im: 0 });
    expect(() => coordinates(Math.PI + .01, .1)).toThrow(); expect(() => fromWarped(NaN, .1)).toThrow();
  });
  it('constructs the exact W-plane rational plant, including its RHP sampling zero', () => {
    const m = baseline(), w = wPlanePlant(m);
    const rhsZero = 2 / m.T, [a, b, c] = w.numerator;
    expect((a * rhsZero + b) * rhsZero + c).toBeCloseTo(0, 14);
    expect(w.denominator[2]).toBe(0);
    for (const angle of [.02, .2, 1, 2.5]) {
      const at = frequency(m, angle, m.T), transformed = warpedPlantFrequency(m, at.warped);
      expect(4 * transformed.re).toBeCloseTo(at.value!.re, 9); expect(4 * transformed.im).toBeCloseTo(at.value!.im, 9);
    }
    expect(() => warpedPlantFrequency(m, 0)).toThrow(/integrator/);
  });
  it('matches independent high-precision baseline crossings, phase margin and bandwidth', () => {
    const f = analyzeFrequency(baseline());
    expect(f.gain.points).toHaveLength(1); expect(f.gain.points[0].angle).toBeCloseTo(.15711313008440931335, 10);
    expect(f.phaseMargins[0].degrees).toBeCloseTo(47.347326955108116, 8);
    expect(f.gainMargins).toHaveLength(2); expect(f.gainMargins[0].angle).toBeCloseTo(.62239525485777025289, 11); expect(f.gainMargins[0].factor).toBeCloseTo(10.34459000579638244, 9);
    expect(f.gainMargins[1].angle).toBe(Math.PI); expect(f.bandwidth.angle).toBeCloseTo(.26406223886362349343, 10);
    expect(frequency(baseline(), 0, .1).status).toBe('pole');
  });
  it('reconstructs polynomial magnitudes independently at arbitrary angles', () => {
    const p = [1, -1.7, .9, -.1], coefficients = magnitudePolynomial(p);
    for (const t of [.1, .7, 1.8, Math.PI]) {
      const real = p.reduce((s, v, i) => s + v * Math.cos((3 - i) * t), 0), imag = p.reduce((s, v, i) => s + v * Math.sin((3 - i) * t), 0), c = Math.cos(t);
      expect(coefficients.reduceRight((s, v) => s * c + v, 0)).toBeCloseTo(real * real + imag * imag, 12);
    }
  });
  it('enumerates three real roots and a repeated contact without a frequency sweep', () => {
    const three = cosineRoots([.06, -.32, -.1, 1]); expect(three.values).toHaveLength(3);
    three.values.forEach((v, i) => expect(v.cosine).toBeCloseTo([.5, .2, -.6][i], 13));
    const repeated = cosineRoots([.03125, -.1875, 0, 1]); expect(repeated.values.find(v => Math.abs(v.cosine - .25) < 1e-12)?.repeated).toBe(true);
    expect(cosineRoots([0, 0, 0, 0]).continuum).toBe(true); expect(cosineRoots([2]).values).toEqual([]);
    expect(() => cosineRoots([1, 1, 1, 1e-12])).toThrow(/unresolved/);
  });
  it('designs at the physical requirement and rechecks the actual unit-circle magnitude and phase', () => {
    for (const T of [.05, .1, .2]) {
      const d = designDirect(plant, T, 3, 50), f = frequency(d.model, 3 * T, T), all = analyzeFrequency(d.model);
      expect(f.magnitude).toBeCloseTo(1, 11); expect(f.phase).toBeCloseTo(-130, 10);
      expect(d.model.controller.kind).toBe('corners'); expect(d.model.poles).toHaveLength(3);
      expect(all.gain.points.some(v => Math.abs(v.angle / T - 3) < 1e-7)).toBe(true);
      expect(tracking(d.model).velocityConstant).not.toBe(2); // crossover design does not preserve Kv.
    }
  });
  it('distinguishes fixed-controller emulation from redesign after changing T', () => {
    const a = designDirect(plant, .1, 3, 50), fixed = createModel(plant, .2, a.model.controller), redesigned = designDirect(plant, .2, 3, 50);
    expect(frequency(fixed, .6, .2).magnitude).not.toBeCloseTo(1, 5); expect(frequency(redesigned.model, .6, .2).magnitude).toBeCloseTo(1, 12);
    expect(a.warped).not.toBe(redesigned.warped); expect(sampledResponse(redesigned.model, 100).limit).toBe(1);
  });
  it('rejects infeasible lead targets and aliased/excessive requirements', () => {
    expect(() => designDirect(plant, .1, .01, 50)).toThrow(/angle/);
    expect(() => designDirect(plant, .1, 32, 50)).toThrow(/angle/);
    expect(() => designDirect(plant, .1, 1, 20)).toThrow(/positive phase/);
    expect(() => designDirect(plant, .1, 3, 90)).toThrow(/margin/);
    expect(() => designDirect(plant, .1, 28, 85)).toThrow();
  });
  it('does not infer bandwidth or stable limits from margins for an unstable loop', () => {
    const m = createModel(plant, .1, { kind: 'constant', K: 100 }); expect(analyzeFrequency(m).bandwidth.reason).toMatch(/not strictly/);
    expect(poleStatus({ re: 1, im: 0 })).toBe('boundary'); expect(poleStatus({ re: .5, im: 0 })).toBe('inside');
  });
});
describe('DD03 complete root solver', () => {
  it('retains real, complex, repeated and zero roots with Vieta residuals', () => {
    expect(polynomialRoots([1, -1.5, .5, 0])).toHaveLength(3);
    const roots = polynomialRoots([1, -.6, .21, -.026]); // (.2±.3j), extra .2
    expect(roots.some(z => Math.abs(z.re - .2) < 1e-12 && z.im === 0)).toBe(true);
    expect(polynomialRoots([1, 0, 0, 0]).every(z => z.re === 0 && z.im === 0)).toBe(true);
    expect(polynomialRoots([1, -3, 3, -1]).every(z => z.re === 1 && z.im === 0)).toBe(true);
    expect(() => polynomialRoots([1, 1, 1, Infinity])).toThrow();
  });
});
