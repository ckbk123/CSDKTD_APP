import { describe, expect, it } from 'vitest';
import { parseModel } from './input';
describe('DF03 bounded visual rational loop parser', () => {
  it.each([String.raw`\frac{0.5}{z-0.8}`, '(1/2)/(z-.8)', String.raw`\frac{\frac12}{z-\frac45}`, String.raw`\dfrac{.5}{\left(z-.8\right)}`, String.raw`\frac{1}{2(z-.8)}`])('normalizes equivalent first-order models: %s', source => {
    const m = parseModel(source); expect(m.denominator).toEqual([1, -.8]); expect(m.numerator).toEqual([.5]);
  });
  it.each([String.raw`\frac1{z^2-z+.5}`, String.raw`\frac{1}{z^{+2}-z+.5}`, String.raw`\frac1{(z-.5)^2+.25}`, String.raw`\frac1{z^{(2)}-z+.5}`])('retains actual second-order polynomials: %s', source => {
    const m = parseModel(source); expect(m.denominator).toEqual([1, -1, .5]); expect(m.numerator).toEqual([1]);
  });
  it.each([String.raw`-\frac12/(z-.2)`, String.raw`\frac{-1}{2(z-.2)}`, String.raw`(-\frac12)/(z-.2)`])('preserves signed fractions: %s', source => expect(parseModel(source).numerator).toEqual([-.5]));
  it('keeps full denominator factors and accepts explicit addition/multiplication around fractions', () => {
    expect(parseModel('(z-1)/(z(z-1))').denominator).toEqual([1, -1, 0]);
    expect(parseModel(String.raw`\frac{2+\frac12}{z-.5}`).numerator).toEqual([2.5]);
    expect(parseModel(String.raw`\frac{2\times\frac12}{z-.5}`).numerator).toEqual([1]);
    expect(parseModel(String.raw`\frac{0}{z-.5}`).numerator).toEqual([0]);
  });
  it.each([String.raw`\frac{2\frac12}{z-.5}`, String.raw`\frac{-2\frac12}{z-.5}`, String.raw`\frac{(2)\frac12}{z-.5}`, String.raw`\frac{\frac{2\frac12}{3}}{z-.5}`])('rejects displayed mixed-number ambiguity: %s', source => expect(() => parseModel(source)).toThrow('explicit + or ×'));
  it.each(['1/(z^12+1)', '1/(z^+2+1)', '1/(z^-2+1)', '1/(z^2.0+1)', '2^12/(z+.5)', String.raw`1/(z^{12}+1)`, String.raw`1/(z^{1.0}+1)`])('rejects unsupported/ambiguous powers: %s', source => expect(() => parseModel(source)).toThrow(/power|exponent/));
  it.each(['1e-2/(z-.5)', '1E-2/(z-.5)', 'e/(z-.5)'])('does not borrow native numeric exponent meaning: %s', source => expect(() => parseModel(source)).toThrow('e/E'));
  it.each(['1{+2}/(z-.5)', '{z+2}/(z^2+.5)', '(1)/(z{+.5})'])('rejects invisible grouping: %s', source => expect(() => parseModel(source)).toThrow('visible parentheses'));
  it.each(['', '1/(z^3+1)', '(z+1)/(z-.5)', '1/(z^2+1)+1/(z+.1)', '1/(z-z)', '1/(s+1)', 'L(z)=1/(z+.1)', String.raw`\frac{}{z}`, '1/(z+.1', '0^0/(z+.1)'])('gives useful failure feedback for unsupported/incomplete forms: %s', source => expect(() => parseModel(source)).toThrow());
  it('bounds coefficient precision, work and resource expansion', () => {
    expect(() => parseModel('.0000000001/(z-.5)')).toThrow('1e-9');
    expect(() => parseModel('101/(z-.5)')).toThrow('100');
    expect(() => parseModel('1/'.repeat(300))).toThrow('512');
    expect(() => parseModel('('.repeat(9) + '1/(z+.5)' + ')'.repeat(9))).toThrow('eight');
    expect(() => parseModel('1/(z+.5)' + '+0'.repeat(70))).toThrow('128');
    expect(() => parseModel('1/(z^2*z^2*z+1)')).toThrow('degree');
    expect(() => parseModel('1000000000000*2/(z+.5)')).toThrow('intermediates');
    const tiny = '0.' + '0'.repeat(324) + '1';
    expect(() => parseModel(`${tiny}/(z+.5)`)).toThrow('too small');
  });
});
