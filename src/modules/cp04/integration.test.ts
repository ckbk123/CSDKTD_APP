import { describe, expect, it } from 'vitest';
import { parseDelay, parseReal } from './math';

describe('CP04 argument scope in both visual scalar readers', () => {
  it.each([String.raw`\frac1\;2`, String.raw`\frac\,12`, '\\frac1\u20092', String.raw`\frac1{\left\;2}`, String.raw`\frac1{\left(\left[2\right\;\right)}`])('rejects blank arguments before erasure: %s', source => {
    for (const parse of [parseReal, parseDelay]) expect(() => parse(source)).toThrow(/blank space cannot fill a box/);
  });
  it.each([String.raw`\frac1{\;2}`, String.raw`\frac{\,1}2`, String.raw`\left(\frac1{\;2}\right)`])('retains supported boxed numeric values: %s', source => {
    expect(parseReal(source)).toBe(.5); expect(parseDelay(source)).toBe(.5);
  });
});
