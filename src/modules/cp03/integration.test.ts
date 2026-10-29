import { describe, expect, it } from 'vitest';
import { parsePlant } from './math';

describe('CP03 shared argument preflight at integration', () => {
  it.each([String.raw`\frac1\;2`, String.raw`\frac\,12`, '\\frac1\u20092', String.raw`\frac1{\left\;2}`, String.raw`\frac1{\left(\left[2\right\;\right)}`, '2^\u20092'])('rejects blank argument tokens before normalization: %s', source => {
    expect(() => parsePlant(source)).toThrow(/blank space cannot fill a box/);
  });
  it.each([String.raw`\frac1{\;2}`, String.raw`\frac{\,1}2`, String.raw`\frac1{\left(\;2\right)}`, String.raw`\;\frac12`])('retains supported complete fractions: %s', source => {
    expect(parsePlant(source)).toEqual({ numerator: [.5], denominator: [1] });
  });
});
