import { describe, expect, it } from 'vitest';
import { analyze, parseTransfer } from './math';
const run = (s: string, N = 60, T = 0.1, band = 0.02) => analyze(parseTransfer(s), T, N, band);
describe('DF01 bounded visual transfer reader', () => {
  it('reads visual fractions, optional name, powers, products and leading normalization', () => {
    expect(parseTransfer(String.raw`G\left(z\right)=\frac{0.4}{2z-1.6}`)).toEqual({ a: [1, -0.8], b: [0, 0.2] });
    expect(parseTransfer(String.raw`\frac{0.25}{(z-0.5)^{2}}`)).toEqual({ a: [1, -1, 0.25], b: [0, 0, 0.25] });
    expect(parseTransfer('(z+1)/(z^2+0.25)')).toEqual({ a: [1, 0, 0.25], b: [0, 1, 1] });
  });
  it.each(['', 'NaN/(z-.8)', '1/(z-)', '1/(s+1)', '1/(z^3)', '1/(z^(1/2))', '1/0', '1/(z-z)', '1/(z-.5)/(z-.2)', String.raw`\frac{1}{\placeholder{}}`, String.raw`\frac{1}{z-.8}+1`, '1/(z-.8))', '1e309/(z-.8)', '1/('.repeat(180)])('rejects malformed/unsupported input %s', s => {
    expect(() => parseTransfer(s)).toThrow();
  });
  it('explains causality and numerical coefficient limits', () => {
    expect(() => parseTransfer('z^2/(z-.5)')).toThrow(/future input/);
    expect(() => parseTransfer('1/(0.00000000001z-.1)')).toThrow(/too small/);
    expect(() => parseTransfer('1000001/(z-.5)')).toThrow(/1,000,000/);
  });
});
describe('DF01 sample convention, independent fixtures and certificates', () => {
  it('baseline y[k]=1-.8^k; first settling sample is 18, not 17; t=1.8 s', () => {
    const r = run('0.2/(z-0.8)');
    r.samples.forEach((v, k) => expect(v).toBeCloseTo(1 - 0.8 ** k, 12));
    expect(r.samples.slice(0, 4)).toEqual([0, 0.2, 0.36000000000000004, 0.48800000000000004]);
    expect(r.finalValue).toBeCloseTo(1, 13);
    expect(r.settling).toBe(18);
    expect(r.settling! * r.T).toBeCloseTo(1.8, 13);
    expect(0.8 ** 17).toBeGreaterThan(0.02);
    expect(0.8 ** 18).toBeLessThan(0.02);
    expect(r.overshoot).toBe(0);
    expect(r.peakEstablished).toBe(false); // monotonically approaches an unattained maximum
    expect(r.residual).toBeLessThan(1e-13);
  });
  it('5% band and T change preserve the sampled sequence but change index/time', () => {
    const r = run('.2/(z-.8)', 60, .25, .05);
    expect(r.settling).toBe(14);
    expect(r.settling! * r.T).toBe(3.5);
    expect(r.samples).toEqual(run('.2/(z-.8)').samples);
  });
  it('negative pole alternates: y[k]=1-(-.5)^k; peak=1, 50% overshoot, settling=6', () => {
    const r = run('1.5/(z+.5)', 30);
    r.samples.forEach((v, k) => expect(v).toBeCloseTo(1 - (-.5) ** k, 12));
    expect(r.peak).toBe(1);
    expect(r.overshoot).toBe(50);
    expect(r.peakEstablished).toBe(true);
    expect(r.settling).toBe(6);
  });
  it('repeated .5 poles: impulse h[k]=(k-1)*.5^k for k>=2', () => {
    const r = run('.25/(z-.5)^2');
    let sum = 0;
    r.samples.forEach((v, k) => {
      if (k >= 2) sum += (k - 1) * .5 ** k;
      expect(v).toBeCloseTo(sum, 12);
      expect(r.stateSamples[k]).toBeCloseTo(sum, 12);
    });
    expect(r.A).toEqual([[1, -.25], [1, 0]]);
    expect(r.settling).toBe(9); // e[8]=9/256 > .02; e[9]=10/512 < .02
  });
  it('conjugate poles ±.5j: paired response samples from y[k]+.25y[k-2]=1.25', () => {
    const r = run('1.25/(z^2+.25)', 40);
    expect(r.samples.slice(0, 8)).toEqual([0, 0, 1.25, 1.25, .9375, .9375, 1.015625, 1.015625]);
    expect(r.peak).toBe(2);
    expect(r.overshoot).toBe(25);
    expect(r.settling).toBe(6);
    expect(r.radius).toBe(.5);
    expect(r.residual).toBeLessThan(1e-13);
  });
  it('direct feedthrough uses output-before-state-update and zero prehistory', () => {
    const r = run('(z+.2)/(z-.5)');
    // G=1+.7/(z-.5): y[k]=2.4-1.4*.5^k, including y[0]=1.
    r.samples.forEach((v, k) => expect(v).toBeCloseTo(2.4 - 1.4 * .5 ** k, 12));
    expect(r.D).toBe(1);
    expect(r.C).toEqual([.7]);
    expect(r.stateSamples[0]).toBe(1);
  });
  it('negative DC gain uses response direction and absolute final-value band', () => {
    const r = run('-1.5/(z+.5)', 30);
    expect(r.finalValue).toBe(-1);
    expect(r.peak).toBe(1);
    expect(r.samples[1]).toBe(-1.5);
    expect(r.overshoot).toBe(50);
    expect(r.settling).toBe(6);
  });
  it('insufficient horizon and slow/oscillatory modes never use the final time as settling', () => {
    expect(run('.2/(z-.8)', 10).settling).toBeNull();
    expect(run('.001/(z-.999)', 500).settling).toBeNull();
    // First entry is k=2, but k=4 exits again. A short in-band suffix is insufficient.
    const r = run('1.64/(z^2+.64)', 2, .1, .05);
    expect(r.settling).toBeNull();
    expect(r.tailBound!).toBeGreaterThan(r.bandWidth);
  });
  it('hidden unstable poles are retained, and boundary/zero-final models are rejected', () => {
    expect(() => run('(z-2)/((z-2)(z-.5))')).toThrow(/Every denominator pole/);
    for (const s of ['1/(z-1)', '1/(z+1)', '1/(z^2+1)', '(z-1)/(z-.5)', '0/(z-.5)']) expect(() => run(s)).toThrow();
  });
  it('validates resource bounds and direct service input', () => {
    for (const T of [NaN, Infinity, 0, -1, 1001]) expect(() => run('.2/(z-.8)', 60, T)).toThrow(/period/);
    for (const N of [NaN, 1, 501, 2.5]) expect(() => run('.2/(z-.8)', N)).toThrow(/index/);
    expect(() => run('.2/(z-.8)', 60, .1, .1)).toThrow(/band/);
    expect(() => analyze({ a: [1, NaN], b: [0, 1] }, .1, 20, .02)).toThrow();
  });
  it('tail certificate encloses future samples for distinct, repeated and complex poles', () => {
    for (const s of ['.2/(z-.8)', '.25/(z-.5)^2', '1.25/(z^2+.25)', '.04/((z-.8)(z-.7))', '(z+.1)/(z^2-.8z+.5)']) {
      const short = run(s, 40), long = run(s, 500);
      expect(short.tailBound).not.toBeNull();
      long.samples.slice(40).forEach(y => expect(Math.abs(y - short.finalValue)).toBeLessThanOrEqual(short.tailBound! + 1e-12));
      if (short.settling !== null) long.samples.slice(short.settling).forEach(y => expect(Math.abs(y - short.finalValue)).toBeLessThan(short.bandWidth + 1e-12));
    }
  });
});

