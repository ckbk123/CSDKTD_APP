import { describe, expect, it } from 'vitest';
import { analyzeFrequency, createModel, DROP_SQUARED, emulatePI, frequency, sampledResponse } from './math';
import { parseModel } from './input';

describe('DF03 independent integration fixtures', () => {
  it('matches changed first-order closed forms for responses, crossovers and bandwidth', () => {
    for (const a of [.2, .5, .8]) for (const g of [.1, .3, .6]) {
      const p = a - g, model = createModel({ numerator: [g], denominator: [1, -a] }), T = .125;
      const result = analyzeFrequency(model, T), response = sampledResponse(model, T, 40);
      response.values.forEach((y, k) => expect(y).toBeCloseTo(g / (1 - p) * (1 - p ** k), 12));
      const c = (1 + a * a - g * g) / (2 * a);
      if (c > -1 && c < 1) { expect(result.gain.points).toHaveLength(1); expect(result.gain.points[0].angle).toBeCloseTo(Math.acos(c), 12); }
      else expect(result.gain.points).toHaveLength(0);
      expect(result.gainMargins).toHaveLength(1); expect(result.gainMargins[0].factor).toBeCloseTo((1 + a) / g, 12);
      if (p > 0) {
        const bwCos = (1 + p * p - (1 - p) ** 2 / DROP_SQUARED) / (2 * p);
        if (bwCos > -1 && bwCos < 1) { expect(result.bandwidth.status).toBe('finite'); expect(result.bandwidth.angle).toBeCloseTo(Math.acos(bwCos), 12); }
        else expect(result.bandwidth.status).toBe('beyond');
      }
      const z = { re: Math.cos(.7), im: Math.sin(.7) }, den = (z.re - a) ** 2 + z.im ** 2;
      expect(frequency(model, .7, T).value!.re).toBeCloseTo(g * (z.re - a) / den, 12);
      expect(frequency(model, .7, T).value!.im).toBeCloseTo(-g * z.im / den, 12);
    }
  });
  it('matches the even/odd geometric response and phase crossing of a two-sample delay loop', () => {
    for (const g of [.125, .25, .5]) {
      const model = createModel({ denominator: [1, 0, 0], numerator: [g] }), analysis = analyzeFrequency(model, .2), response = sampledResponse(model, .2, 40);
      response.values.forEach((value, k) => expect(value).toBeCloseTo(g * (1 - (-g) ** Math.floor(k / 2)) / (1 + g), 12));
      expect(analysis.gain.points).toHaveLength(0); expect(analysis.gainMargins).toHaveLength(1); expect(analysis.gainMargins[0].angle).toBeCloseTo(Math.PI / 2, 12); expect(analysis.gainMargins[0].factor).toBeCloseTo(1 / g, 12);
      expect(analysis.bandwidth.status).toBe('beyond');
    }
  });
  it('derives exact ZOH and PI coefficients independently for changed physical plants', () => {
    for (const method of ['backward', 'trapezoidal'] as const) for (const T of [.05, .2]) {
      const p = { g: 1.5, tau: .4, kp: .3, ki: .7, T, method }, result = emulatePI(p), a = Math.exp(-T / p.tau), b = p.g * (1 - a);
      expect(result.a).toBeCloseTo(a, 14); expect(result.b).toBeCloseTo(b, 14);
      const half = method === 'trapezoidal' ? .5 : 1;
      expect(result.model.numerator[0]).toBeCloseTo(b * (p.kp + p.ki * T * half), 14);
      expect(result.model.numerator[1]).toBeCloseTo(b * (-p.kp + (method === 'trapezoidal' ? p.ki * T / 2 : 0)), 14);
      expect(result.model.denominator).toEqual([1, -1 - a, a]);
    }
  });
  it('withholds unstable hidden-mode bandwidth and rejects a numerically amplified long trajectory', () => {
    const model = parseModel('.1(z-2)/((z-2)(z-.2))'); expect(analyzeFrequency(model, .1).bandwidth.status).toBe('undefined');
    sampledResponse(model, .1, 10).values.forEach((y, k) => expect(y).toBeCloseTo((1 - .1 ** k) / 9, 10));
    expect(() => sampledResponse(model, .1, 200)).toThrow(/Roundoff amplification|magnitude/);
  });
  it.each([String.raw`\frac1\;2`, String.raw`\frac\,12`, String.raw`2^\;2`, '\\frac1\u20092', String.raw`\frac1{\left2\;}`])('checks unbraced spacing before normalization: %s', source => expect(() => parseModel(source)).toThrow(/blank space cannot fill a box/));
  it('preserves complete fraction boxes and exponents', () => {
    expect(parseModel(String.raw`\frac1{\;2}/(z-.5)`).numerator).toEqual([.5]);
    expect(parseModel(String.raw`2^{\;2}/(z-.5)`).numerator).toEqual([4]);
  });
});
