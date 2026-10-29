import { describe, expect, it } from 'vitest';
import { parsePlant } from './input';

describe('DF04 shared TeX argument preflight at integration', () => {
  it.each([String.raw`\frac1\;2`, String.raw`\frac\,12`, '\\frac1\u20092', String.raw`\frac1{\left\;2}`, String.raw`\frac1{\left(\left[2\right\;\right)}`, 's^\u20091'])('rejects a blank argument before normalization: %s', coefficient => {
    expect(() => parsePlant(String.raw`\frac{${coefficient}}{s+1}`)).toThrow(/blank space cannot fill a box/);
  });
  it.each([String.raw`\frac{\;1}{s+1}`, String.raw`\frac1{\left(\;s+1\right)}`, String.raw`\;\frac1{s+1}`])('retains complete supported fractions: %s', source => {
    expect(parsePlant(source)).toEqual({gain:1,tau:1});
  });
});
