import { describe, expect, it } from 'vitest';
import { experiment, frequency, frequencySweep, measure, parsePlant, poles } from './math';

describe('CP03 bounded equation parser', () => {
  it('expands a visual fraction and factored polynomial independently', () => {
    expect(parsePlant(String.raw`G(s)=\frac{1}{\left(s+1\right)\left(s+2\right)}`)).toEqual({ numerator: [1], denominator: [2, 3, 1] });
    expect(parsePlant(String.raw`G\left(s\right)=\frac{1}{s^2+3s+2}`)).toEqual({ numerator: [1], denominator: [2, 3, 1] });
  });
  it('accepts changed coefficients, normalization, powers and scalar division', () => {
    expect(parsePlant(String.raw`\frac{2s^2+4s+6}{2s^{2}+8s+10}`)).toEqual({ numerator: [3, 2, 1], denominator: [5, 4, 1] });
    expect(parsePlant('2/(s+4)')).toEqual({ numerator: [2], denominator: [4, 1] });
    expect(parsePlant('s^{-1}')).toEqual({ numerator: [1], denominator: [0, 1] });
    expect(parsePlant('-s^2/(s^2+1)').numerator).toEqual([0, 0, -1]);
    expect(parsePlant('0.5')).toEqual({ numerator: [0.5], denominator: [1] });
  });
  it('accepts one-token MathLive fraction shorthand with TeX argument boundaries', () => {
    expect(parsePlant(String.raw`\frac12`)).toEqual({ numerator: [0.5], denominator: [1] });
    expect(parsePlant(String.raw`\frac1{s+1}`)).toEqual({ numerator: [1], denominator: [1, 1] });
    expect(parsePlant(String.raw`\frac{2}s`)).toEqual({ numerator: [2], denominator: [0, 1] });
    expect(parsePlant(String.raw`\frac1{\frac12s+1}`)).toEqual({ numerator: [2], denominator: [2, 1] });
    expect(parsePlant(String.raw`\frac123`)).toEqual({ numerator: [1.5], denominator: [1] });
    expect(() => parsePlant(String.raw`\frac1`)).toThrow(/fraction/);
  });
  it.each(['', 'NaN', 'Infinity', 'exp(s)', '1/(s+)', '1/0', '\\frac{}{s}', 's^3', 's^{1.5}', '1/(s+1)^2/(s+2)', 's^2/(s+1)', '1/(s+101)', '1e999', '1/(0.000000001s+1)', '(s+1', '\\placeholder{}', '1.2.3/(s+1)', '1/(s+1..2)'])('rejects malformed or unsupported input %s', source => {
    expect(() => parsePlant(source)).toThrow();
  });
  it('bounds input length, nesting and expanded coefficients', () => {
    expect(() => parsePlant('1'.repeat(301))).toThrow(/300/);
    expect(() => parsePlant('('.repeat(30) + 's' + ')'.repeat(30))).toThrow(/deep/);
    expect(() => parsePlant('10001/(s+1)')).toThrow(/10000/);
    expect(() => parsePlant('10000/(10^{-8}s+10^{-8})')).toThrow(/Normalized/);
  });
  it('keeps visual e/E algebra separate from numeric decimal coefficients and displayed powers of ten', () => {
    expect(() => parsePlant('1e-2/(s+1)')).toThrow(/visual equation/);
    expect(() => parsePlant('1E-2/(s+1)')).toThrow(/visual equation/);
    expect(parsePlant('0.01/(s+1)')).toEqual({ numerator: [0.01], denominator: [1, 1] });
    expect(parsePlant('10^{-2}/(s+1)')).toEqual({ numerator: [0.01], denominator: [1, 1] });
    expect(parsePlant(String.raw`\frac{2\times10^{-2}}{s+1}`)).toEqual({ numerator: [0.02], denominator: [1, 1] });
  });
  it('reports numerical underflow instead of silently turning nonzero models into zero', () => {
    expect(() => parsePlant('10^{-400}/(s+1)')).toThrow(/too small/);
    expect(() => parsePlant('10^{-300}*10^{-300}/(s+1)')).toThrow(/too small/);
    expect(() => parsePlant('10^{-320}*0.001/(10000s+10000)')).toThrow(/lose a nonzero/);
    expect(() => frequency(parsePlant('10^{-320}*0.001s/(s+1)'), 0.01)).toThrow(/lose a nonzero/);
    expect(() => frequency(parsePlant('10^{-320}*0.001/(s+100)'), 100)).toThrow(/too small/);
    expect(() => experiment(parsePlant('10^{-320}*0.001'), 1, 0.01)).toThrow(/too small/);
    expect(() => parsePlant('1/(s^2+(10^{-320}/2000)s+1)')).toThrow(/real part is too small/);
    expect(() => parsePlant('1/(s^2+2s+10^{-320}/2000)')).toThrow(/pole is too small/);
    expect(poles(parsePlant('1/(s^2+10^{-200}s)'))).toEqual([{ re: 0, im: 0 }, { re: -1e-200, im: 0 }]);
  });
});

describe('CP03 independent frequency and time fixtures', () => {
  const baseline = parsePlant('1/((s+1)(s+2))');
  it('divides 1 by (1+j)(2+j)=1+3j at the baseline', () => {
    const f = frequency(baseline, 1);
    expect(f.re).toBeCloseTo(0.1, 13); expect(f.im).toBeCloseTo(-0.3, 13);
    expect(f.magnitude).toBeCloseTo(1 / Math.sqrt(10), 13);
    expect(f.phase).toBeCloseTo(-Math.atan(3), 13);
    expect(f.phase! * 180 / Math.PI).toBeCloseTo(-71.5650511771, 9);
    expect(f.db).toBeCloseTo(-10, 12);
  });
  it('matches partial fractions y=.1 sin t−.3 cos t+.5 exp(−t)−.2 exp(−2t)', () => {
    const e = experiment(baseline, 1, 1);
    for (const t of [0, 0.125, 1, 3, 9]) {
      expect(e.sample(t).output).toBeCloseTo(0.1 * Math.sin(t) - 0.3 * Math.cos(t) + 0.5 * Math.exp(-t) - 0.2 * Math.exp(-2 * t), 12);
      expect(Math.abs(e.sample(t).transient)).toBeLessThanOrEqual(e.tailBound(t) + 1e-14);
    }
    expect(e.stable).toBe(true);
    expect(e.tailBound(8)).toBeLessThan(0.01 * e.value.magnitude);
  });
  it('changes frequency and amplitude without changing the plant', () => {
    const e = experiment(baseline, 2, 2);
    expect(e.value.re).toBeCloseTo(-0.05, 13); expect(e.value.im).toBeCloseTo(-0.15, 13);
    expect(e.value.magnitude).toBeCloseTo(1 / Math.sqrt(40), 13);
    expect(e.value.phase! * 180 / Math.PI).toBeCloseTo(-108.4349488229, 9);
    expect(e.sample(1).particular).toBeCloseTo(-0.1 * Math.sin(2) - 0.3 * Math.cos(2), 13);
  });
  it('handles first-order proper feedthrough and a repeated pole', () => {
    const first = experiment(parsePlant('(2s+3)/(s+1)'), 1, 1);
    const repeated = experiment(parsePlant('1/(s+1)^2'), 1, 1);
    for (const t of [0, 0.2, 2, 10]) {
      expect(first.sample(t).output).toBeCloseTo(2.5 * Math.sin(t) - 0.5 * Math.cos(t) + 0.5 * Math.exp(-t), 12);
      expect(repeated.sample(t).output).toBeCloseTo(-0.5 * Math.cos(t) + 0.5 * (1 + t) * Math.exp(-t), 12);
      expect(Math.abs(repeated.sample(t + 0.5).transient)).toBeLessThanOrEqual(repeated.tailBound(t) + 1e-13);
    }
  });
  it('checks a complex-pole numerator by independently integrating its impulse response', () => {
    // G=(s+3)/((s+1)^2+4), h=e^-t(cos 2t+sin 2t).
    const e = experiment(parsePlant('(s+3)/(s^2+2s+5)'), 1.7, 2);
    for (const t of [0.4, 1, 3]) {
      const steps = 2000, step = t / steps;
      let sum = 0;
      for (let i = 0; i <= steps; i++) {
        const tau = i * step;
        const f = Math.exp(-tau) * (Math.cos(2 * tau) + Math.sin(2 * tau)) * 2 * Math.sin(1.7 * (t - tau));
        sum += f * (i === 0 || i === steps ? 1 : i % 2 ? 4 : 2);
      }
      expect(e.sample(t).output).toBeCloseTo(sum * step / 3, 10);
    }
  });
  it('preserves second-order feedthrough and zero initial states', () => {
    const e = experiment(parsePlant('(s^2+3s+4)/(s^2+2s+5)'), 2, 3);
    expect(e.sample(0).output).toBeCloseTo(0, 12);
    const h = 1e-6;
    expect((e.sample(h).output - e.sample(0).output) / h).toBeCloseTo(6, 4);
  });
  it('distinguishes unstable, marginal and canceled unstable denominator modes', () => {
    const unstable = experiment(parsePlant('1/(s-1)'), 1, 1);
    expect(unstable.stable).toBe(false); expect(unstable.tailBound(0)).toBe(Infinity);
    expect(unstable.sample(2).output).toBeCloseTo(-0.5 * Math.sin(2) - 0.5 * Math.cos(2) + 0.5 * Math.exp(2), 12);
    const marginal = experiment(parsePlant('1/(s^2+4)'), 1, 1);
    expect(marginal.classification).toMatch(/Marginal/);
    expect(marginal.sample(1).output).toBeCloseTo(Math.sin(1) / 3 - Math.sin(2) / 6, 12);
    expect(experiment(parsePlant('(s-1)/(s-1)'), 1, 1).stable).toBe(false);
  });
  it('reports zero gain and a notch with undefined phase', () => {
    expect(frequency(parsePlant('0/(s+1)'), 1).phase).toBeNull();
    expect(frequency(parsePlant('(s^2+1)/(s^2+2s+2)'), 1).phase).toBeNull();
    expect(experiment(parsePlant('-2'), 1, 3).sample(1).output).toBeCloseTo(-6 * Math.sin(1), 13);
  });
  it('uses the denominator roots without canceling unstable modes', () => {
    expect(poles(parsePlant('1/(s^2+3s+2)')).map(x => x.re).sort((a, b) => a - b)).toEqual([-2, -1]);
    expect(poles(parsePlant('1/(s^2+2s+5)'))).toEqual([{ re: -1, im: 2 }, { re: -1, im: -2 }]);
  });
  it('rejects resonance, bad controls, time overflow and excessive growth', () => {
    expect(() => frequency(parsePlant('1/(s^2+1)'), 1)).toThrow(/singular/);
    for (const w of [0, -1, Infinity, 101, NaN]) expect(() => frequency(baseline, w)).toThrow(/Frequency/);
    for (const a of [0, -1, Infinity, 101, NaN]) expect(() => experiment(baseline, 1, a)).toThrow(/amplitude/);
    expect(() => experiment(baseline, 1, 1).sample(3001)).toThrow(/Time/);
    expect(() => experiment(parsePlant('1/(s-1)'), 1, 1).sample(1000)).toThrow(/bound/);
  });
  it('retains the formal sinusoid when actual unstable growth overflows', () => {
    const e = experiment(parsePlant('1/(s-2)'), 1, 1);
    expect(() => e.sample(1000)).toThrow(/bound/);
    expect(e.particular(1000).particular).toBeCloseTo(-0.4 * Math.sin(1000) - 0.2 * Math.cos(1000), 12);
    expect(() => e.particular(-1)).toThrow(/Time/);
    expect(experiment(parsePlant('(s-1)/(s-1)'), 1, 1).sample(1000).output).toBeCloseTo(Math.sin(1000), 12);
  });
  it('agrees with the repeated-pole limit for nearby real and complex poles', () => {
    const repeated = experiment(parsePlant('1/(s+1)^2'), 1, 1);
    for (const a1 of [1.999999999, 2.000000001]) {
      const nearby = experiment(parsePlant(`1/(s^2+${a1}s+1)`), 1, 1);
      for (const t of [0, 0.2, 1, 5]) expect(nearby.sample(t).output).toBeCloseTo(repeated.sample(t).output, 8);
    }
  });
  it('does not cancel away nearly coincident integrator transients', () => {
    // y'' = sin t with zero state gives t−sin t. Perturbing D by 10⁻⁴⁰
    // changes this by far below floating-point resolution on this horizon.
    const e = experiment(parsePlant('1/(s^2-10^{-40})'), 1, 1);
    for (const t of [0, 0.2, 1, 5, 20]) expect(e.sample(t).output).toBeCloseTo(t - Math.sin(t), 12);
  });
  it('does not certify a slow transient merely because a few cycles are visible', () => {
    const e = experiment(parsePlant('1/(s+0.001)'), 1, 1);
    expect(e.tailBound(20)).toBeGreaterThan(0.9);
    expect(e.tailBound(1000)).toBeGreaterThan(0.01 * e.value.magnitude);
  });
  it('breaks a frequency sweep at the off-grid pole √2 rather than crossing its asymptote', () => {
    // G(jω)=1/(2−ω²). The logarithmic grid's neighbors straddle √2.
    const sweep = frequencySweep(parsePlant('1/(s^2+2)'), 1), gap = sweep.indexOf(null);
    expect(gap).toBeGreaterThan(0);
    const left = sweep[gap - 1]!, right = sweep[gap + 1]!;
    expect(left.w).toBeCloseTo(1.4017374183467695, 12);
    expect(right.w).toBeCloseTo(1.4454397707459272, 12);
    expect(left.re).toBeCloseTo(1 / (2 - left.w ** 2), 12);
    expect(right.re).toBeCloseTo(1 / (2 - right.w ** 2), 12);
    expect(left.re).toBeGreaterThan(28); expect(right.re).toBeLessThan(-11);
    expect(left.w).toBeLessThan(Math.sqrt(2)); expect(right.w).toBeGreaterThan(Math.sqrt(2));
  });
  it('inserts the off-grid numerator notch √2 with undefined phase and dB', () => {
    const sweep = frequencySweep(parsePlant('(s^2+2)/(s^2+2s+3)'), 1);
    const notch = sweep.find(s => s?.w === Math.sqrt(2));
    expect(notch).toBeDefined(); expect(notch?.phase).toBeNull(); expect(notch?.db).toBeNull();
    expect(notch?.magnitude).toBeLessThan(1e-14);
  });
  it('measures lag and lead with signed, principal phase and amplitude ratio', () => {
    expect(measure(0, Math.atan(3), 2 / Math.sqrt(10), 1, 2).phase).toBeCloseTo(-Math.atan(3), 13);
    expect(measure(1, 0.5, 1, 2, 2)).toEqual({ gain: 0.5, phase: 1 });
    expect(measure(0, 4 * Math.PI + 0.5, 1, 1, 1).phase).toBeCloseTo(-0.5, 12);
    expect(() => measure(NaN, 1, 1, 1, 1)).toThrow(/finite/);
  });
});
