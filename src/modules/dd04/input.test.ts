import { describe, expect, it } from 'vitest';
import { parseErrors, parseScalar } from './input';

describe('DD04 bounded visual sample input', () => {
  it.each([
    ['-0.5', -0.5], ['1e-3', 0.001], [String.raw`\frac12`, 0.5], [String.raw`-\frac{3}{4}`, -0.75],
    [String.raw`\frac1\frac23`, 1.5], ['(2+3)/4', 1.25], [String.raw`1\div2`, 0.5], ['0e-999', 0],
  ])('parses %s', (source, value) => expect(parseScalar(source)).toBe(value));
  it('reads the baseline list and a changed fractional list', () => {
    expect(parseErrors('[1,1,1,1,0,0]')).toEqual([1, 1, 1, 1, 0, 0]);
    expect(parseErrors(String.raw`\left[\frac12,-\frac14,0\right]`)).toEqual([0.5, -0.25, 0]);
  });
  it.each(['', '[]', '[1,]', '[,1]', '[1,2', 'NaN', 'Infinity', '[j]', '[sin(1)]', '[1/0]', '[1e999]', '[1e-999]', '[1e-300*1e-300]', '[1 2]', '[1^2]', String.raw`[\frac1]`, String.raw`[\placeholder{}]`, '[10001]', '[1]'.repeat(700), '[' + Array(41).fill('1').join(',') + ']', '('.repeat(10) + '1' + ')'.repeat(10)])('rejects %s', source => expect(() => parseErrors(source)).toThrow());
});
