import { describe, expect, it } from 'vitest';
import { parseErrors, parseNumericLiteral, parseScalar } from './input';

describe('DD04 bounded visual sample input', () => {
  it.each([
    ['-0.5', -0.5], ['0.001', 0.001], [String.raw`\frac12`, 0.5], [String.raw`-\frac{3}{4}`, -0.75],
    [String.raw`\frac1\frac23`, 1.5], ['(2+3)/4', 1.25], [String.raw`1\div2`, 0.5], ['0.000', 0],
    [String.raw`\frac1{2}`, 0.5], [String.raw`\frac{1}2`, 0.5], [String.raw`-(\frac12)`, -0.5],
    [String.raw`\frac{-1}2`, -0.5], [String.raw`\frac1{-2}`, -0.5],
    [String.raw`2+\frac12`, 2.5], [String.raw`2\times\frac12`, 1],
  ])('parses %s', (source, value) => expect(parseScalar(source)).toBe(value));
  it.each(['1e-2', '1E-2', '0e-999', String.raw`\frac{1e-2}{2}`])('rejects visual e/E notation %s', source => expect(() => parseScalar(source)).toThrow(/visual field/));
  it('explains scientific pastes normalized by the editor to textbook powers', () => {
    expect(() => parseErrors(String.raw`[1\times10^{-2}]`)).toThrow(/Powers are not supported/);
  });
  it.each([String.raw`2\frac12`, String.raw`-2\frac{1}{2}`, String.raw`{2}\frac12`])('rejects ambiguous fraction adjacency %s', source => expect(() => parseScalar(source)).toThrow(/explicit|visible/));
  it('reads the baseline list and a changed fractional list', () => {
    expect(parseErrors('[1,1,1,1,0,0]')).toEqual([1, 1, 1, 1, 0, 0]);
    expect(parseErrors(String.raw`\left[\frac12,-\frac14,0\right]`)).toEqual([0.5, -0.25, 0]);
  });
  it.each(['', '[]', '[1,]', '[,1]', '[1,2', 'NaN', 'Infinity', '[j]', '[sin(1)]', '[1/0]', '[1e999]', '[1e-999]', '[1e-300*1e-300]', '[1 2]', '[1^2]', String.raw`[\frac1]`, String.raw`[\placeholder{}]`, '[10001]', '[1]'.repeat(700), '[' + Array(41).fill('1').join(',') + ']', '('.repeat(10) + '1' + ')'.repeat(10)])('rejects %s', source => expect(() => parseErrors(source)).toThrow());
});

describe('DD04 native numeric literal input', () => {
  it.each([['1e-2', 0.01], ['-2E-3', -0.002], ['0e-999', 0], ['5e-324', Number.MIN_VALUE], [' +.5 ', 0.5]])('accepts %s separately from the visual field', (source, expected) => expect(parseNumericLiteral(source)).toBe(expected));
  it.each(['', '1e-999', '1e999', 'NaN', 'Infinity', '1+2', String.raw`\frac12`, '1 2'])('rejects invalid or unrepresentable numeric literal %s', source => expect(() => parseNumericLiteral(source)).toThrow());
});
