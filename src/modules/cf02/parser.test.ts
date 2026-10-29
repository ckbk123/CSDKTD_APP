import { describe, expect, it } from 'vitest';
import { parseLinear } from './parser';

describe('CF02 bounded visual polynomial entry', () => {
  it.each([
    ['4', [4, 0]], ['s+2', [2, 1]], ['4(s+1)', [4, 4]], ['2s+4', [4, 2]],
    [String.raw`\frac12s+\frac{3}{4}`, [.75, .5]],
    [String.raw`\frac{s+1}2`, [.5, .5]], [String.raw`\frac{1}2(s+2)`, [1, .5]],
    [String.raw`\frac1{\frac12}`, [2, 0]], [String.raw`\frac123`, [1.5, 0]],
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
});
