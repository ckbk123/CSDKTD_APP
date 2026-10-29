import { describe, expect, it } from 'vitest';
import { convertLatexToMathMl } from 'mathlive/ssr';
import { parsePolynomial } from './parser';
import { exactText, toNumber } from './rational';

describe('CP01 bounded visual polynomial grammar', () => {
  it.each([
    ['1', [1]], ['0s', [0]], ['s+1', [1, 1]], ['(s+1)(s+2)', [2, 3, 1]],
    [String.raw`s^2+3s+2`, [2, 3, 1]], [String.raw`s^{2}+3s+2`, [2, 3, 1]],
    [String.raw`2(s+1)^2`, [2, 4, 2]], [String.raw`-s^2`, [0, 0, -1]],
    [String.raw`(-s)^2`, [0, 0, 1]], [String.raw`s^{+2}`, [0, 0, 1]],
    [String.raw`\frac{s^2+3s+2}{2}`, [1, 1.5, .5]],
    [String.raw`\frac{s+1}2`, [.5, .5]], [String.raw`\frac1{\frac12}`, [2]],
    [String.raw`\frac\mathrm{12}3`, [4]], [String.raw`\mathrm{\mathbf{12}}s`, [0, 12]],
    [String.raw`\mathrm{s}+\mathsf{2}`, [2, 1]], ['2(3+4)', [14]],
    [String.raw`\frac12s+\frac34`, [.75, .5]],
    [String.raw`2s\frac12+1`, [1, 1]], [String.raw`2s\times\frac12+1`, [1, 1]],
    [String.raw`(s+1)2\times\frac12`, [1, 1]], [String.raw`s(2+\frac12)`, [0, 2.5]],
    [String.raw`2^2\frac12`, [2]], [String.raw`2^{2}\frac12`, [2]],
    [String.raw`s^{2}\frac12`, [0, 0, .5]], [String.raw`s^{0}\frac12`, [.5]],
    [String.raw`(s+1)^2\frac12`, [.5, 1, .5]],
    [String.raw`2^{2}\mathrm{3}`, [12]], [String.raw`s^{2}3`, [0, 0, 3]],
  ] as const)('preserves the displayed polynomial %s', (text, expected) => {
    const result = parsePolynomial(text).map(value => toNumber(value));
    expect(result).toHaveLength(expected.length);
    result.forEach((value, i) => expect(value).toBeCloseTo(expected[i], 13));
  });
  it('retains exact cancellation and fractional coefficients', () => {
    expect(parsePolynomial('.1+.2-.3').map(exactText)).toEqual(['0']);
    expect(parsePolynomial(String.raw`\frac13s+\frac23s`).map(exactText)).toEqual(['0', '1']);
    expect(parsePolynomial(String.raw`(s+\frac13)(s-\frac13)`).map(exactText)).toEqual(['-1/9', '0', '1']);
  });
  it.each([
    '', '()', '-', 's+', '(s+1', 's+1)', '(s+1)(s+2)(s+3)', 's^{3}', 's^{-1}', 's^{.5}',
    '0^0', '2{3+4}', '{s+2}s', String.raw`\mathrm{2+3}s`, String.raw`\text{12}`,
    String.raw`\frac1s`, String.raw`\frac1{0}`, String.raw`\frac{}{2}`, String.raw`\placeholder{}`,
    '1/2', '1e-2', '1E2', 'NaN', 'Infinity', 'sin(s)', 'G(s)=1', 'z+1',
    's'.repeat(401), '('.repeat(13) + '1' + ')'.repeat(13), '1000000001', '100000*100000',
  ])('rejects unsupported or excessive input %s', text => expect(() => parsePolynomial(text)).toThrow());
  it.each([String.raw`s^12`, String.raw`2^12`, String.raw`s^2.5`, String.raw`s^-1`, String.raw`s^+2`, String.raw`s^.5`, String.raw`s^\mathrm{2}3`])('requests a real power box for ambiguous bare exponent %s', text => {
    expect(() => parsePolynomial(text)).toThrow(/power boxes/);
  });
  it.each([String.raw`s^{12}`, String.raw`2^{12}`])('does not confuse grouped twelfth powers %s with bare-token products', text => {
    expect(() => parsePolynomial(text)).toThrow(/integers 0, 1 or 2/);
  });
  it.each([
    String.raw`2\frac12`, String.raw`s2\frac12`, String.raw`(s+1)2\frac12`,
    String.raw`-s2\frac12`, String.raw`\frac{s2\frac12}{3}`, String.raw`s\mathrm{2}\frac12`,
    String.raw`s\mathsf{2}\frac12`, String.raw`s(2)\frac12`, String.raw`s2\mathrm{3}`,
    String.raw`s\mathrm{2}3`, String.raw`(s^0)2\frac12`, String.raw`2^{2}2\frac12`,
  ])('rejects numeric adjacency independently of earlier factors in %s', text => {
    expect(() => parsePolynomial(text)).toThrow(/Insert \+.*×/);
  });
  it('does not erase nonzero underflow or bypass rational work limits', () => {
    expect(() => parsePolynomial('.' + '0'.repeat(330) + '1')).toThrow(/too small/);
    const small = '.' + '0'.repeat(88) + '1';
    expect(() => parsePolynomial([small, small, small, small].join('*'))).toThrow(/too small/);
  });
});

describe('CP01 grammar checked against pinned display structure', () => {
  it('observes mixed-number plus after a variable factor, unlike a true variable product', () => {
    expect(convertLatexToMathMl(String.raw`s2\frac12`)).toContain('&#x2064;');
    expect(convertLatexToMathMl(String.raw`2s\frac12`)).not.toContain('&#x2064;');
  });
  it('distinguishes bare one-token and grouped multi-digit exponents', () => {
    expect(convertLatexToMathMl(String.raw`s^12`)).toMatch(/<msup><mi>s<\/mi><mn>1<\/mn><\/msup><mn>2<\/mn>/);
    expect(convertLatexToMathMl(String.raw`s^{12}`)).toContain('<mn>12</mn>');
    expect(convertLatexToMathMl(String.raw`2^12`)).toMatch(/<msup><mn>2<\/mn><mn>1<\/mn><\/msup><mn>2<\/mn>/);
    expect(convertLatexToMathMl(String.raw`2^{12}`)).toContain('<mn>12</mn>');
  });
  it('does not invent mixed-number plus after a power', () => {
    expect(convertLatexToMathMl(String.raw`2^2\frac12`)).not.toContain('&#x2064;');
    expect(convertLatexToMathMl(String.raw`s^2\frac12`)).not.toContain('&#x2064;');
  });
});
