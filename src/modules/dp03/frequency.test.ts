import { describe, expect, it } from 'vitest';
import { parseModel } from './expression';
import { bilinear, frequencySamples, fromPhysical, principalAngle, rationalAt, unitResponse, warpedResponse, type FrequencyResult } from './frequency';

const baseline = () => parseModel(String.raw`\frac{0.0544z+0.0493}{z^2-1.741z+0.741}`);
function value(result: FrequencyResult) { expect(result.kind).toBe('value'); if (result.kind !== 'value') throw new Error(result.message); return result; }

describe('DP03 independent frequency fixtures', () => {
  it('preserves the rounded source input and identifies its DC singularity', () => {
    const model = baseline();
    expect(model.a).toEqual([1, -1.741, .741]); expect(model.b).toEqual([0, .0544, .0493]);
    expect(unitResponse(model, 0).kind).toBe('pole');
    // Clearing denominators can round a theoretically zero coefficient. Its
    // construction scale must preserve the same singularity classification.
    const transformed = bilinear(model, .1);
    expect(rationalAt(transformed, { re: 0, im: 0 }).kind).toBe('pole');
    expect(warpedResponse(model, transformed, 0).result.kind).toBe('pole');
  });
  it('matches hand substitution at z=j, with 40-digit decimal reference arithmetic', () => {
    // N=.0493+.0544j, D=-.259-1.741j; independent Decimal division.
    const response = value(unitResponse(baseline(), Math.PI / 2));
    expect(response.value.re).toBeCloseTo(-.03469124597099828866, 13);
    expect(response.value.im).toBeCloseTo(.02315621326450973190, 13);
    expect(response.db).toBeCloseTo(20 * Math.log10(Math.hypot(-.03469124597099828866, .02315621326450973190)), 12);
  });
  it('matches the Nyquist endpoint -0.0051/3.482 and its W-plane limit', () => {
    const model = baseline(), response = value(unitResponse(model, Math.PI));
    expect(response.value.re).toBeCloseTo(-.001464675473865594486, 14);
    expect(response.value.im).toBe(0); expect(response.phase).toBe(Math.PI);
    const warped = warpedResponse(model, bilinear(model, .1), Math.PI);
    expect(warped.endpoint).toBe(true); expect(warped.frequency).toBeNull();
    expect(warped.result).toEqual(unitResponse(model, Math.PI));
  });
  it('derives an independent first-order W polynomial and exact quarter-circle response', () => {
    const model = parseModel('1/(1-.5q)'), transformed = bilinear(model, 2);
    // With T=2: H_w(w)=(1+w)/(.5+1.5w).
    expect(transformed.b).toEqual([1, 1]); expect(transformed.a).toEqual([.5, 1.5]);
    const direct = value(unitResponse(model, Math.PI / 2));
    expect(direct.value.re).toBeCloseTo(.8, 14); expect(direct.value.im).toBeCloseTo(-.4, 14);
    const warped = warpedResponse(model, transformed, Math.PI / 2);
    expect(warped.frequency).toBeCloseTo(1, 14);
    expect(value(warped.result).value.re).toBeCloseTo(.8, 14);
    // An unwarped physical axis evaluates at pi/4 instead of w=1.
    const w = Math.PI / 4, den = .25 + 2.25 * w * w;
    const unwarped = value(rationalAt(transformed, { re: 0, im: w }));
    expect(unwarped.value.re).toBeCloseTo((.5 + 1.5 * w * w) / den, 14);
    expect(unwarped.value.im).toBeCloseTo(-w / den, 14);
    expect(Math.abs(unwarped.value.re - direct.value.re)).toBeGreaterThan(.05);
  });
  it('checks a changed FIR, zero magnitude and undefined phase', () => {
    const model = parseModel(String.raw`\frac12(1+z^{-1})`);
    const mid = value(unitResponse(model, Math.PI / 2));
    expect(mid.value.re).toBeCloseTo(.5, 14); expect(mid.value.im).toBeCloseTo(-.5, 14);
    expect(mid.phase).toBeCloseTo(-Math.PI / 4, 14);
    const end = value(unitResponse(model, Math.PI));
    expect(end.magnitude).toBe(0); expect(end.db).toBeNull(); expect(end.phase).toBeNull();
  });
  it('preserves exact warped evaluation, conjugacy and periodicity for changed fourth-order data', () => {
    const model = parseModel('(1+.2q^2)/(1-.4q+.3q^2+.1q^4)');
    for (const period of [.01, .2, 2]) {
      const transformed = bilinear(model, period);
      for (const angle of [.05, .3, 1.2, 2.8]) {
        const direct = value(unitResponse(model, angle));
        const warped = value(warpedResponse(model, transformed, angle).result);
        expect(warped.value.re).toBeCloseTo(direct.value.re, 10); expect(warped.value.im).toBeCloseTo(direct.value.im, 10);
        const negative = value(unitResponse(model, -angle));
        expect(negative.value.re).toBeCloseTo(direct.value.re, 12); expect(negative.value.im).toBeCloseTo(-direct.value.im, 12);
        const repeated = value(unitResponse(model, angle + 8 * Math.PI));
        expect(repeated.value.re).toBeCloseTo(direct.value.re, 11); expect(repeated.value.im).toBeCloseTo(direct.value.im, 11);
      }
    }
  });
  it('checks a pure four-sample delay against its binomial W construction and linear phase', () => {
    const model = parseModel('q^4'), transformed = bilinear(model, 2);
    // q=(1-w)/(1+w); independently expanded fourth powers.
    expect(transformed.b).toEqual([1, -4, 6, -4, 1]);
    expect(transformed.a).toEqual([1, 4, 6, 4, 1]);
    const quarter = value(unitResponse(model, Math.PI / 8));
    expect(quarter.value.re).toBeCloseTo(0, 13);
    expect(quarter.value.im).toBeCloseTo(-1, 13);
    expect(quarter.magnitude).toBeCloseTo(1, 13);
    expect(quarter.phase).toBeCloseTo(-Math.PI / 2, 13);
    const endpoint = value(warpedResponse(model, transformed, Math.PI).result);
    expect(endpoint.value.re).toBeCloseTo(1, 13); expect(endpoint.value.im).toBeCloseTo(0, 13);
  });
  it('reports a Nyquist-contour pole rather than fabricating an infinite-W gain', () => {
    const model = parseModel('1/(1+q)');
    expect(value(unitResponse(model, 0)).magnitude).toBe(.5);
    expect(unitResponse(model, Math.PI).kind).toBe('pole');
    expect(unitResponse(model, -Math.PI).kind).toBe('pole');
    const endpoint = warpedResponse(model, bilinear(model, .1), Math.PI);
    expect(endpoint.frequency).toBeNull(); expect(endpoint.endpoint).toBe(true);
    expect(endpoint.result.kind).toBe('pole');
  });
  it('relates physical, normalized, aliased and warped frequencies without silently changing coefficients', () => {
    expect(fromPhysical(2, .1)).toEqual({ raw: .2, angle: expect.closeTo(.2, 12), aliased: false });
    expect(fromPhysical(2, .2).angle).toBeCloseTo(.4, 12);
    expect(fromPhysical(2 + 2 * Math.PI / .1, .1).angle).toBeCloseTo(.2, 12);
    expect(fromPhysical(2 + 2 * Math.PI / .1, .1).aliased).toBe(true);
    expect(principalAngle(-.2)).toBeCloseTo(-.2, 12);
  });
  it('keeps the singular source endpoint as a gap in a bounded sample sweep', () => {
    const points = frequencySamples(baseline(), .1, 21);
    expect(points).toHaveLength(21); expect(points[0].exact.kind).toBe('pole');
    expect(points[0].unwarped.kind).toBe('pole'); expect(points.at(-1)!.angle).toBe(Math.PI);
  });
});

describe('DP03 grammar and numerical boundaries', () => {
  it.each(['1e-2', '1E-2', 'sin(z)', 'z', '1/(1+q^5)', 'q^5', '1/(0)', String.raw`\frac1`])('rejects unsupported visual input %s', expression => {
    expect(() => parseModel(expression)).toThrow();
  });
  it('accepts outer minus/grouping and mixed compact fractions', () => {
    expect(parseModel(String.raw`-\left(\frac12\right)`)).toEqual({ b: [-.5], a: [1] });
    expect(value(unitResponse(parseModel(String.raw`\frac1{1-\frac12z^{-1}}`), Math.PI / 2)).value.re).toBeCloseTo(.8, 14);
  });
  it('accepts the optional textbook G(z) label after visual grouping normalization', () => {
    expect(parseModel(String.raw`G\left(z\right)=\frac1{1-\frac12z^{-1}}`)).toEqual({ b: [1], a: [1, -.5] });
  });
  it('preserves TeX fraction grouping without interpreting parentheses as braces', () => {
    expect(() => parseModel(String.raw`\frac(1)(2)`)).toThrow(/Parentheses/);
    expect(() => parseModel(String.raw`\frac1(2)`)).toThrow(/Parentheses/);
    for (const expression of [String.raw`-\frac12`, String.raw`\frac{-1}2`, String.raw`-\left(\frac{(1)}{(2)}\right)`]) {
      expect(value(unitResponse(parseModel(expression), 1)).value.re).toBe(-.5);
    }
    expect(value(unitResponse(parseModel(String.raw`\frac{\frac12}{(2)}`), 1)).value.re).toBe(.25);
  });
  it('retains canceled denominator factors at a singular contour point', () => {
    expect(unitResponse(parseModel('(1-q)/(1-q)'), 0).kind).toBe('pole');
  });
  it('bounds period, alias angle, physical frequency, sample work and transformed underflow', () => {
    const model = parseModel('1/(1-.5q)');
    expect(() => bilinear(model, 0)).toThrow(/period/);
    expect(() => fromPhysical(Infinity, .1)).toThrow(/finite/);
    expect(() => fromPhysical(100000, 100)).toThrow(/normalized/);
    expect(() => principalAngle(NaN)).toThrow(/finite/);
    expect(() => frequencySamples(model, .1, 601)).toThrow(/20–600/);
    const tiny = parseModel('(0.000000000001)^14*(0.000000000001)^12*q^4');
    expect(() => bilinear(tiny, .000001)).toThrow(/underflow/);
  });
});
