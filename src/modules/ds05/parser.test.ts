import { describe, expect, it } from 'vitest';
import { convertLatexToMathMl } from 'mathlive/ssr';
import { parsePolynomial } from './parser';
import { exactText } from './rational';
const values = (text: string) => parsePolynomial(text).map(exactText);
describe('bounded degree-two visual polynomial grammar', () => {
  it.each([
    ['.5', ['1/2']], ['z-.8', ['-4/5', '1']], ['(z-.2)(z-1.2)', ['6/25', '-7/5', '1']],
    ['-z^2', ['0', '0', '-1']], ['(-z)^2', ['0', '0', '1']], ['z^0', ['1']],
    ['\\frac12', ['1/2']], ['-\\frac1{2}', ['-1/2']], ['\\frac{1}2', ['1/2']],
    ['\\frac{z+1}{2}', ['1/2', '1/2']], ['\\frac{1}{\\frac23}', ['3/2']],
    ['2z\\frac12+1', ['1', '1']], ['(z+1)\\frac12', ['1/2', '1/2']], ['2z\\times\\frac12', ['0', '1']],
    ['2+\\frac12', ['5/2']], ['2\\times\\frac12', ['1']], ['z^2\\frac12', ['0', '0', '1/2']],
    ['2^2\\frac12', ['2']], ['\\mathrm{2}z+\\frac12', ['1/2', '2']], ['\\mathbf{\\mathrm{2}}z', ['0', '2']],
    ['z^{+2}', ['0', '0', '1']], ['\\left(z+1\\right)^2', ['1', '2', '1']],
  ])('preserves %s', (text, expected) => expect(values(text)).toEqual(expected));
  it.each([
    '', 'z^3', 'z^{-1}', 'z^12', 'z^-2', 'z^+2', 'z^2.5', '2^12', '2^{12}', 'z^{12}', '0^0',
    '1e-2', '2E+1', 's+1', '\\sin(z)', '\\sqrt2', 'z/2', '\\frac1z', '\\frac10', 'z^2*z',
    '1{+2}', '{z+1}z', 'z2\\frac12', '(z+1)2\\frac12', 'z\\mathrm{2}\\frac12',
    'z(-2)\\frac12', '2(\\frac12)', '2\\frac12', '\\frac{2\\frac12}{3}', '2\\mathrm{3}',
    '\\mathrm{z+1}', '\\text{2}z', '\\mathrm{NaN}', 'z+Infinity', '(', 'z+',
  ])('rejects unsupported/ambiguous %s', text => expect(() => parsePolynomial(text)).toThrow());
  it('pins the independently rendered mixed-number and TeX exponent distinctions', () => {
    expect(convertLatexToMathMl('z2\\frac12')).toContain('&#x2064;');
    expect(convertLatexToMathMl('z^12')).not.toEqual(convertLatexToMathMl('z^{12}'));
    expect(() => parsePolynomial('z^12')).toThrow(/power boxes/);
    expect(() => parsePolynomial('z^{12}')).toThrow(/integers/);
  });
  it('enforces nesting, length, operation and intermediate coefficient bounds', () => {
    expect(() => parsePolynomial('('.repeat(13) + 'z' + ')'.repeat(13))).toThrow(/12 nested/);
    expect(() => parsePolynomial('z'.repeat(401))).toThrow(/400/);
    expect(() => parsePolynomial(Array(162).fill('0').join('+'))).toThrow(/160/);
    expect(() => parsePolynomial('1000000001')).toThrow(/10⁹/);
  });
});
