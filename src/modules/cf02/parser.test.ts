import { describe, expect, it } from 'vitest';
import { parseLinear } from './parser';

describe('CF02 bounded visual polynomial entry', () => {
  it.each([
    ['4', [4, 0]], ['s+2', [2, 1]], ['4(s+1)', [4, 4]], ['2s+4', [4, 2]],
    [String.raw`\frac12s+\frac{3}{4}`, [.75, .5]],
    [String.raw`\frac{s+1}2`, [.5, .5]], [String.raw`\frac{1}2(s+2)`, [1, .5]],
    [String.raw`\frac1{\frac12}`, [2, 0]],
    [String.raw`\frac{1}{23}`, [1 / 23, 0]],
    [String.raw`-\left(\frac12s+\frac12\right)`, [-.5, -.5]],
    [String.raw`\frac{-s-1}{2}`, [-.5, -.5]],
    [String.raw`\frac{\mathrm{1}}{2}`, [.5, 0]],
    [String.raw`\mathrm{s}+\mathrm{2}`, [2, 1]], ['s-s+1', [1, 0]], ['0s', [0, 0]],
    ['((-.5s+.5))', [.5, -.5]], ['0.0001(s+2)', [.0002, .0001]],
  ] as const)('preserves the displayed meaning of %s', (text, expected) => {
    const result = parseLinear(text);
    result.forEach((value, index) => expect(value).toBeCloseTo(expected[index], 13));
  });
  it.each([
    '', '()', '(())', '-', '+', 's+', '(s+2', 's+2)', 's^2', '(s+1)(s+2)',
    'sin(s)', 'NaN', 'Infinity', '1e-2', '1E2', String.raw`\mathrm{1e-2}`,
    String.raw`\frac1s`, String.raw`\frac1{0}`, String.raw`\frac{}{2}`,
    String.raw`\placeholder{}`, 'y+1', 'P(s)=4', '1/2', 's'.repeat(401),
    '('.repeat(13) + '1' + ')'.repeat(13),
  ])('rejects incomplete or unsupported input %s', text => expect(() => parseLinear(text)).toThrow());
  it('does not silently erase a tiny nonzero literal or product', () => {
    expect(() => parseLinear('.' + '0'.repeat(330) + '1')).toThrow(/too small/);
    const tiny = '.' + '0'.repeat(88) + '1';
    expect(() => parseLinear([tiny, tiny, tiny, tiny].join('*'))).toThrow(/too small/);
  });
  it('bounds intermediate coefficient growth', () => {
    expect(() => parseLinear('1000000000001')).toThrow(/magnitude/);
    expect(() => parseLinear('10000000*10000000')).toThrow(/magnitude/);
  });
  it.each([
    String.raw`2\frac12`, String.raw`-2\frac12`, String.raw`-(2\frac12)`,
    String.raw`(2)\frac12`, String.raw`2\left(\frac12\right)`,
    String.raw`\frac{2\frac12}{3}`, String.raw`2\frac{\frac12}{3}`,
    String.raw`\mathrm{2}\frac{\mathrm{1}}{2}`,
    String.raw`2(s+\frac12)`, String.raw`\frac12\frac12`,
  ])('rejects mixed-number/fraction adjacency with explicit-operator guidance: %s', text => {
    expect(() => parseLinear(text)).toThrow(/Insert \+.*×/);
  });
  it.each([
    [String.raw`2+\frac12`, [2.5, 0]], [String.raw`2\times\frac12`, [1, 0]],
    [String.raw`-2-\frac12`, [-2.5, 0]], [String.raw`2\cdot(s+\frac12)`, [1, 2]],
    [String.raw`\frac12s`, [0, .5]], [String.raw`\frac{2+\frac12}{3}`, [2.5 / 3, 0]],
  ] as const)('retains ordinary fractions and explicit operators: %s', (text, expected) => {
    parseLinear(text).forEach((value, i) => expect(value).toBeCloseTo(expected[i], 13));
  });
  it.each([
    '2{3+4}', '{2+3}s', String.raw`\frac12{s+2}`, '{s}',
    String.raw`\mathrm{2+3}s`, String.raw`\mathbf{2s+3}`, String.raw`\mathrm{-2}s`,
    String.raw`2\mathrm{3}`, String.raw`\mathrm{2}3`, String.raw`\mathrm{2}\mathrm{3}`,
    String.raw`\frac123`, String.raw`\text{1 2}`, String.raw`2\mathrm{\frac12}`,
  ])('rejects invisible arithmetic grouping or ambiguous numeric adjacency: %s', text => {
    expect(() => parseLinear(text)).toThrow();
  });
  it.each([
    ['2(3+4)', [14, 0]], ['(2+3)s', [0, 5]],
    [String.raw`\frac12(s+2)`, [1, .5]],
    [String.raw`\frac{2+3}{4}s`, [0, 1.25]],
    [String.raw`\frac\mathrm{12}3`, [4, 0]],
    [String.raw`\mathrm{\mathbf{12}}s`, [0, 12]],
    [String.raw`2\times\mathrm{3}`, [6, 0]],
  ] as const)('retains visible grouping, atomic numeric style and true fraction scope: %s', (text, expected) => {
    parseLinear(text).forEach((value, i) => expect(value).toBeCloseTo(expected[i], 13));
  });
});
