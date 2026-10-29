import { describe, expect, it } from 'vitest';
import { analyze, type Reference } from './math';
import { parseForward } from './parser';
import { decimal, number, q } from './rational';

describe('DF02 independent integration checks', () => {
  it('matches direct impulse convolution for changed biproper loops and all reference normalizations', () => {
    let cases = 0;
    for (const d of [-.25, .5, 1]) for (const b of [.25, .75]) for (const a of [-.5, .5]) for (const h of [.5, 1, 2]) {
      const lead = 1 + h * d, p = (a - h * b) / lead;
      if (lead === 0 || Math.abs(p) >= .9) continue;
      for (const reference of ['step', 'ramp', 'parabola'] as Reference[]) for (const basis of ['physical', 'sequence'] as const) {
        const result = analyze(parseForward(`(${d}z+${b})/(z-(${a}))`), decimal('.25'), decimal(String(h)), reference, basis, 20);
        expect(result.stable).toBe(true); expect(result.samples).toHaveLength(21);
        const r = (k: number) => { const t = basis === 'physical' ? k / 4 : k; return reference === 'step' ? 1 : reference === 'ramp' ? t : t * t / 2; };
        for (const sample of result.samples) {
          let past = 0; for (let j = 0; j < sample.k; j++) past += p ** (sample.k - j - 1) * r(j);
          const y = d / lead * r(sample.k) + (b / lead + d / lead * p) * past;
          expect(sample.y).toBeCloseTo(y, 9); expect(sample.comparator).toBeCloseTo(r(sample.k) - h * y, 9); expect(sample.tracking).toBeCloseTo(r(sample.k) - y, 9);
        }
        if (reference === 'step') {
          const dcY = (d + b) / (1 - a + h * (d + b));
          expect(number(result.errors.comparator.limit.value)).toBeCloseTo(1 - h * dcY, 12);
          expect(number(result.errors.tracking.limit.value)).toBeCloseTo(1 - dcY, 12);
        }
        cases++;
      }
    }
    expect(cases).toBeGreaterThan(100);
  });
  it('distinguishes an oscillatory retained mode, a cancelled unstable mode and a singular direct loop', () => {
    expect(analyze(parseForward('1/z'), decimal('.1'), q(1), 'step', 'physical', 20).errors.tracking.outcome).toBe('not-certified');
    const cancelled = analyze(parseForward('(z-2)/(z-2)'), decimal('.1'), q(1), 'step', 'physical', 20);
    expect(cancelled.stable).toBe(false); expect(cancelled.samples.every(s => s.y === .5 && s.tracking === .5)).toBe(true);
    expect(() => analyze(parseForward('-1'), decimal('.1'), q(1), 'step', 'physical', 20)).toThrow(/singular/);
  });
  it.each([String.raw`\frac1\;2`, String.raw`\frac\,12`, String.raw`2^\;2`, '\\frac1\u20092', String.raw`\frac1{\left2\;}`])('preserves TeX argument evidence: %s', source => {
    expect(() => parseForward(source)).toThrow(/blank space cannot fill a box/);
  });
  it('keeps compact fractions and genuinely grouped spacing', () => {
    for (const source of [String.raw`\frac12`, String.raw`\frac1{\;2}`]) expect(number(parseForward(source).numerator[0])).toBe(.5);
    expect(number(parseForward(String.raw`10^{\;2}`).numerator[0])).toBe(100);
  });
});
