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

describe('CF02 TeX spacing and fraction argument boundaries', () => {
  it.each([
    String.raw`\frac{1}{\left\;2}`, String.raw`\frac{\left\,1}{2}`,
    String.raw`\frac1{\left` + '\u2009' + '2}', String.raw`\frac1{\mathrm{\left\,2}}`,
    String.raw`\frac1{\left(2\right\;)}`,
  ])('rejects an incomplete delimiter before normalization in %s', source => {
    expect(() => parseLinear(source)).toThrow(/parentheses/);
  });
  it.each([
    [String.raw`\frac1{\left(\;2\right)}`, [.5, 0]],
    [String.raw`\frac{\left(\,s+1\right)}{2}`, [.5, .5]],
    [String.raw`4\left(\,s+1\right)`, [4, 4]], [String.raw`\left(2\right)`, [2, 0]],
  ] as const)('retains supported visible round delimiters in %s', (source, expected) => {
    expect(parseLinear(source)).toEqual(expected);
  });
  it.each([String.raw`\frac1` + '\u2009' + '2', String.raw`\frac` + '\u2009' + '12'])('rejects a significant Unicode blank used as an unbraced argument in %s', source => {
    expect(() => parseLinear(source)).toThrow();
  });
  it.each([String.raw`\frac1{` + '\u2009' + '2}', String.raw`\frac{` + '\u2009' + '1}{2}'])('retains a numeric value inside its true braced argument in %s', source => {
    expect(parseLinear(source)).toEqual([.5, 0]);
  });
  it('independently distinguishes a spacing argument from a properly braced numeric argument', () => {
    const missingDenominator = convertLatexToMathMl(String.raw`\frac1\;2`);
    expect(missingDenominator).toContain('<mfrac><mn>1</mn><mspace');
    expect(missingDenominator).toContain('</mfrac><mn>2</mn>');
    const missingNumerator = convertLatexToMathMl(String.raw`\frac\,12`);
    expect(missingNumerator).toContain('<mfrac><mspace');
    expect(missingNumerator).toContain('</mfrac><mn>2</mn>');
    expect(convertLatexToMathMl(String.raw`\frac1{\;2}`)).toContain('<mrow><mspace');
    expect(parseLinear(String.raw`\frac1{\;2}`)).toEqual([.5, 0]);
  });
  it.each([
    String.raw`\frac1\;2`, String.raw`\frac\,12`, String.raw`\frac1\quad2`, String.raw`\frac\qquad12`,
    String.raw`\dfrac1\!2`, String.raw`\tfrac\,12`, String.raw`\frac1\;{2}`,
    String.raw`-(\frac1\;2)`, String.raw`s*\frac1\;2`, String.raw`\frac{\frac1\;2}{3}`,
    String.raw`\frac1{\frac\,12}`, String.raw`\frac{\mathrm{1}}{\frac1\;2}`,
  ])('rejects a spacing token used as an unbraced fraction argument in %s', source => {
    expect(() => parseLinear(source)).toThrow(/fraction|numerator|denominator/);
  });
  it.each([
    [String.raw`\frac1{\;2}`, [.5, 0]], [String.raw`\frac{\quad1}{2}`, [.5, 0]],
    [String.raw`\frac{\;s+1}{\qquad2}`, [.5, .5]], [String.raw`\frac1{\frac{\;1}{2}}`, [2, 0]],
    [String.raw`\frac{\mathrm{\;12}}3`, [4, 0]], [String.raw`\;\frac12\quad`, [.5, 0]],
    [String.raw`2\,s+3`, [3, 2]], [String.raw`s\quad2+1`, [1, 2]],
    [String.raw`2\;*\quad\frac12`, [1, 0]], [String.raw`\frac12\,s+\;\frac34`, [.75, .5]],
    [String.raw`4\qquad(s+1)`, [4, 4]], [String.raw` \frac 1 2 `, [.5, 0]],
    [String.raw`-\quad(s+\frac12)`, [-.5, -1]],
  ] as const)('retains valid argument scope and ordinary spacing in %s', (source, expected) => {
    parseLinear(source).forEach((value, i) => expect(value).toBeCloseTo(expected[i], 13));
  });
});
