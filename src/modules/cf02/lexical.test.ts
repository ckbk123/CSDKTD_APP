import { describe, expect, it } from 'vitest';
import { convertLatexToMathMl } from 'mathlive/ssr';
import { parseLinear } from './parser';

describe('CF02 lexical adjacency, independent of the accumulated polynomial', () => {
  it.each([
    String.raw`s2\frac12`, String.raw`(s+1)2\frac12`, String.raw`s\mathrm{2}\frac12`,
    String.raw`-s2\frac12`, String.raw`-(s2\frac12)`, String.raw`(s+1)(2\frac12)`,
    String.raw`\frac{s2\frac12}{3}`, String.raw`s2\frac{\frac12}{3}`,
    String.raw`s\mathsf{2}\frac{\mathrm{1}}{2}`, String.raw`s\mathrm{\mathbf{2}}\frac12`,
    String.raw`s*2\frac12`, String.raw`s2\left(\frac12\right)`, String.raw`s(2)\frac12`,
  ])('rejects a numeric/fraction boundary anywhere in %s', text => {
    expect(() => parseLinear(text)).toThrow(/Insert \+.*×/);
  });
  it.each([String.raw`s2\mathrm{3}`, String.raw`s\mathrm{2}3`, String.raw`s\mathrm{2}\mathrm{3}`])('does not multiply joined numeric styles after a variable in %s', text => {
    expect(convertLatexToMathMl(text)).toContain('<mn>23</mn>');
    expect(() => parseLinear(text)).toThrow(/Insert \+.*×/);
  });
  it.each([
    [String.raw`2s\frac12`, [0, 1]], [String.raw`2s\times\frac12`, [0, 1]],
    [String.raw`2\mathrm{s}\frac12`, [0, 1]], [String.raw`2(s)\frac12`, [0, 1]],
    [String.raw`(s+1)2\times\frac12`, [1, 1]], [String.raw`s(2+\frac12)`, [0, 2.5]],
    [String.raw`s2*\frac12`, [0, 1]], [String.raw`s*2*\frac12`, [0, 1]],
    [String.raw`\frac{2s}{2}`, [0, 1]], [String.raw`\frac\mathrm{12}3s`, [0, 4]],
    [String.raw`\frac{2s\frac12}{3}`, [0, 1 / 3]],
  ] as const)('preserves genuine products and fraction-argument scope in %s', (text, expected) => {
    parseLinear(text).forEach((value, i) => expect(value).toBeCloseTo(expected[i], 13));
  });
  it.each([String.raw`s2\frac12`, String.raw`(s+1)2\frac12`, String.raw`s\mathrm{2}\frac12`])('confirms the pinned display emits invisible plus for %s', text => {
    expect(convertLatexToMathMl(text)).toMatch(/&#(?:x2064|8292);/);
  });
  it.each([String.raw`2s\frac12`, String.raw`2s\times\frac12`])('confirms the preserved product %s has no mixed-number plus', text => {
    expect(convertLatexToMathMl(text)).not.toMatch(/&#(?:x2064|8292);/);
  });
});
