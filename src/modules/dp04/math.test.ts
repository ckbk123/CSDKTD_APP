import { describe, expect, it } from 'vitest';
import { asymptotes, breakPoints, collisionGains, diskClass, inverseMode, modalSamples, realSegments, rootsAt, testPoint, trace, validateModel } from './math';

const baseline = { a1: -1, a0: 0, b1: 1, b0: 0.2 };
describe('DP04 independent quadratic locus fixtures', () => {
  it('computes every baseline root at zero, interior, boundary and unstable gains', () => {
    expect(rootsAt(baseline, 0).roots).toEqual([{ re: 1, im: 0 }, { re: 0, im: 0 }]);
    const interior = rootsAt(baseline, 1);
    expect(interior.roots[0].re).toBe(0); expect(interior.roots[0].im).toBeCloseTo(Math.sqrt(0.2), 14);
    expect(interior.roots[1].im).toBeCloseTo(-Math.sqrt(0.2), 14);
    expect(diskClass(interior.roots)).toBe('inside');
    expect(rootsAt(baseline, 2.5).roots).toEqual([{ re: -0.5, im: 0 }, { re: -1, im: 0 }]);
    expect(diskClass(rootsAt(baseline, 2.5).roots)).toBe('boundary');
    const outside = rootsAt(baseline, 3);
    expect(outside.roots[0].re).toBeCloseTo(-1 + Math.sqrt(0.4), 14);
    expect(outside.roots[1].re).toBeCloseTo(-1 - Math.sqrt(0.4), 14);
    expect(diskClass(outside.roots)).toBe('outside');
  });
  it('constructs baseline real-axis segments, centroid and both break points', () => {
    expect(realSegments(baseline)).toEqual([
      { left: null, right: -0.2, rightCount: 3, onLocus: true },
      { left: -0.2, right: 0, rightCount: 2, onLocus: false },
      { left: 0, right: 1, rightCount: 1, onLocus: true },
      { left: 1, right: null, rightCount: 0, onLocus: false },
    ]);
    expect(asymptotes(baseline)).toEqual({ centroid: 1.2, angles: [Math.PI] });
    const points = [...breakPoints(baseline)].sort((a, b) => a.position - b.position);
    expect(points).toHaveLength(2);
    expect(points[0].position).toBeCloseTo((-1 - Math.sqrt(6)) / 5, 14);
    expect(points[0].gain).toBeCloseTo((7 + 2 * Math.sqrt(6)) / 5, 14);
    expect(points[1].position).toBeCloseTo((-1 + Math.sqrt(6)) / 5, 14);
    expect(points[1].gain).toBeCloseTo((7 - 2 * Math.sqrt(6)) / 5, 14);
    expect(points.every(point => point.reason === 'positive')).toBe(true);
  });
  it('continues branches through both collisions instead of sorting by real part', () => {
    const gains = collisionGains(baseline);
    expect(gains[0]).toBeCloseTo((7 - 2 * Math.sqrt(6)) / 5, 14);
    expect(gains[1]).toBeCloseTo((7 + 2 * Math.sqrt(6)) / 5, 14);
    const path = trace(baseline, 3);
    expect(path.gains).toHaveLength(243);
    expect(path.branches[0][0].re).toBe(1); expect(path.branches[1][0].re).toBe(0);
    const atOne = path.gains.indexOf(1);
    expect(path.branches[0][atOne].im).toBeGreaterThan(0);
    expect(path.branches[1][atOne].im).toBeLessThan(0);
    for (const gain of gains) {
      const index = path.gains.indexOf(gain);
      expect(Math.hypot(path.branches[0][index].re - path.branches[1][index].re, path.branches[0][index].im - path.branches[1][index].im)).toBeLessThan(1e-6);
    }
  });
  it('counts poles at a narrow interval right boundary without a rounded midpoint', () => {
    const previous = 0.9999999999999999;
    const segments = realSegments({ a1: -1, a0: 0, b1: 1, b0: -previous });
    expect(segments).toEqual([
      { left: null, right: 0, rightCount: 3, onLocus: true },
      { left: 0, right: previous, rightCount: 2, onLocus: false },
      { left: previous, right: 1, rightCount: 1, onLocus: true },
      { left: 1, right: null, rightCount: 0, onLocus: false },
    ]);
    expect(realSegments({ a1: -1, a0: 0, b1: -1, b0: previous }).map(segment => segment.onLocus)).toEqual([false, true, false, true]);
  });
  it('retains repeated-pole multiplicity at interval boundaries', () => {
    expect(realSegments({ a1: -2, a0: 1, b1: 1, b0: -0.9999999999999999 }).map(segment => segment.rightCount)).toEqual([3, 2, 0]);
  });
  it('responds to a changed zero and constant numerator', () => {
    const changed = rootsAt({ ...baseline, b0: 0.5 }, 2);
    expect(changed.roots[0].re).toBe(-0.5); expect(changed.roots[0].im).toBeCloseTo(Math.sqrt(3) / 2, 14);
    expect(diskClass(changed.roots)).toBe('boundary');
    const constant = { ...baseline, b1: 0, b0: 1 };
    expect(asymptotes(constant)).toEqual({ centroid: 0.5, angles: [Math.PI / 2, 3 * Math.PI / 2] });
    expect(breakPoints(constant)).toEqual([{ position: 0.5, gain: 0.25, reason: 'positive' }]);
    expect(rootsAt(constant, 0.25).repeated).toBe(true);
    expect(rootsAt(constant, 0.5).roots).toEqual([{ re: 0.5, im: 0.5 }, { re: 0.5, im: -0.5 }]);
  });
  it('accounts for a negative fixed coefficient without changing K>=0', () => {
    const negative = { ...baseline, b1: 0, b0: -1 };
    expect(realSegments(negative).map(segment => segment.onLocus)).toEqual([true, false, true]);
    expect(asymptotes(negative)).toEqual({ centroid: 0.5, angles: [0, Math.PI] });
    const roots = rootsAt(negative, 1).roots;
    expect(roots[0].re).toBeCloseTo((1 + Math.sqrt(5)) / 2, 14);
    expect(roots[1].re).toBeCloseTo((1 - Math.sqrt(5)) / 2, 14);
    const point = testPoint(negative, { re: -1, im: 0 });
    expect(point.gain?.re).toBe(2); expect(point.onLocus).toBe(true);
    expect(Math.cos(point.vectorTotal! - point.angle!)).toBeCloseTo(1, 14);
  });
  it('handles conjugate open poles and zero real-axis intervals', () => {
    const model = { a1: 0, a0: 1, b1: 0, b0: 1 };
    expect(realSegments(model)).toEqual([{ left: null, right: null, rightCount: 0, onLocus: false }]);
    expect(breakPoints(model)).toEqual([{ position: -0, gain: -1, reason: 'negative' }]);
    expect(collisionGains(model)).toEqual([]);
    expect(diskClass(rootsAt(model, 1).roots)).toBe('outside');
  });
  it('retains exact and near common factors in the entire characteristic set', () => {
    const common = { a1: -1.5, a0: -1, b1: 1, b0: -2 };
    expect(rootsAt(common, 0.25).roots).toEqual([{ re: 2, im: 0 }, { re: -0.75, im: 0 }]);
    expect(diskClass(rootsAt(common, 0.25).roots)).toBe('outside');
    expect(testPoint(common, { re: 2, im: 0 }).kind).toBe('common');
    expect(breakPoints(common)).toEqual([{ position: 2, gain: null, reason: 'singular' }]);
    const nearby = rootsAt({ ...common, b0: -2.00001 }, 0.25).roots;
    expect(nearby).toHaveLength(2); expect(nearby[0].re).toBeGreaterThan(2);
    const fixedZero = { a1: -1, a0: 0, b1: 1, b0: 0 };
    expect(collisionGains(fixedZero)).toEqual([1]);
    expect(rootsAt(fixedZero, 1).roots).toEqual([{ re: 0, im: 0 }, { re: 0, im: 0 }]);
  });
  it('evaluates magnitude and phase independently at a candidate', () => {
    const boundary = testPoint(baseline, { re: -1, im: 0 });
    expect(boundary.kind).toBe('regular'); expect(boundary.gain?.re).toBeCloseTo(2.5, 14); expect(boundary.gain?.im).toBe(0);
    expect(boundary.magnitudeGain).toBe(2.5); expect(boundary.onLocus).toBe(true);
    expect(boundary.angleError).toBeCloseTo(0, 14);
    const interior = testPoint(baseline, { re: 0, im: Math.sqrt(0.2) });
    expect(interior.onLocus).toBe(true); expect(interior.gain?.re).toBeCloseTo(1, 14);
    expect(Math.sin(interior.vectorTotal! - interior.angle!)).toBeCloseTo(0, 14);
    expect(Math.cos(interior.vectorTotal! - interior.angle!)).toBeCloseTo(1, 14);
    const off = testPoint(baseline, { re: 0.5, im: 0.5 });
    expect(off.onLocus).toBe(false); expect(off.gain?.re).toBeCloseTo(0.35 / 0.74, 14); expect(off.gain?.im).toBeCloseTo(-0.25 / 0.74, 14);
    expect(testPoint(baseline, { re: 0, im: 0 }).kind).toBe('pole');
    expect(testPoint(baseline, { re: -0.2, im: 0 }).kind).toBe('zero');
    expect(testPoint(baseline, { re: -0.2 + 1e-14, im: 0 }).kind).toBe('near-singular');
  });
  it('illustrates unit root modes and principal inverse without a forced-response claim', () => {
    const root = rootsAt(baseline, 1).roots[0];
    const samples = modalSamples(root, 4);
    expect(samples[0]).toBe(1); expect(samples[1]).toBe(0); expect(samples[2]).toBeCloseTo(-0.2, 14); expect(samples[3]).toBe(0); expect(samples[4]).toBeCloseTo(0.04, 14);
    expect(modalSamples({ re: -1, im: 0 }, 4)).toEqual([1, -1, 1, -1, 1]);
    expect(modalSamples({ re: 0, im: 0 }, 4)).toEqual([1, 0, 0, 0, 0]);
    expect(inverseMode(root, 0.1)?.sigma).toBeCloseTo(5 * Math.log(0.2), 12);
    expect(inverseMode(root, 0.1)?.omega).toBeCloseTo(5 * Math.PI, 12);
    expect(inverseMode({ re: 0, im: 0 }, 0.1)).toBeNull();
  });
  it.each([
    { ...baseline, a1: NaN }, { ...baseline, a0: 101 }, { ...baseline, b0: 0, b1: 0 },
    { ...baseline, b0: 1e-6, b1: 0 }, { ...baseline, a1: -30 }, { ...baseline, b1: 0.001, b0: 1 },
  ])('rejects unsupported model bounds %j', model => expect(() => validateModel(model)).toThrow());
  it('rejects incomplete root sets and invalid gain/work/time/candidate values', () => {
    expect(() => diskClass([])).toThrow(); expect(() => diskClass([{ re: NaN, im: 0 }, { re: 0, im: 0 }])).toThrow();
    for (const gain of [-1, 101, Infinity]) expect(() => rootsAt(baseline, gain)).toThrow();
    for (const window of [0, 101, NaN]) expect(() => trace(baseline, window)).toThrow();
    expect(() => testPoint(baseline, { re: 51, im: 0 })).toThrow();
    expect(() => modalSamples({ re: 1, im: 0 }, 3)).toThrow(); expect(() => modalSamples({ re: Infinity, im: 0 }, 10)).toThrow();
    expect(() => inverseMode({ re: 1, im: 0 }, 0)).toThrow(); expect(() => inverseMode({ re: NaN, im: 0 }, 0.1)).toThrow();
  });
  it('does not turn unsupported tiny coefficients, gains or candidate products into zero roots', () => {
    expect(() => validateModel({ ...baseline, a0: 1e-101 })).toThrow(/10⁻¹⁰⁰/);
    expect(() => rootsAt({ a1: -1, a0: 0, b1: 0, b0: 0.0001 }, 1e-320)).toThrow(/nonzero gain/);
    expect(() => testPoint({ a1: 0, a0: 0, b1: 0, b0: 1 }, { re: 1e-200, im: 0 })).toThrow(/component magnitudes/);
    const tiny = rootsAt({ a1: 0, a0: 0, b1: 1, b0: 0 }, 1e-100);
    expect(tiny.roots).toEqual([{ re: 0, im: 0 }, { re: -1e-100, im: 0 }]);
    expect(tiny.repeated).toBe(false);
    expect(modalSamples(tiny.roots[1], 4)[1]).toBe(-1e-100);
  });
});
