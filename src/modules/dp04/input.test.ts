import { describe, expect, it } from 'vitest';
import { parseModel } from './input';

describe('DP04 bounded visual rational polynomials', () => {
  it.each([
    '(z+0.2)/(z(z-1))', String.raw`\frac{z+0.2}{z(z-1)}`, String.raw`\left(\frac{z+0.2}{z^2-z}\right)`,
    String.raw`\frac{z+\frac15}{z^{2}-z}`, String.raw`\frac{2z+0.4}{2z(z-1)}`,
  ])('parses the baseline %s', source => expect(parseModel(source)).toEqual({ a1: -1, a0: 0, b1: 1, b0: 0.2 }));
  it.each([
    String.raw`-\frac1{z(z-1)}`, String.raw`-\left(\frac{1}{z(z-1)}\right)`,
    String.raw`\frac{-1}{z(z-1)}`, String.raw`\frac1{-z(z-1)}`,
  ])('preserves a signed ratio %s', source => expect(parseModel(source)).toEqual({ a1: -1, a0: 0, b1: 0, b0: -1 }));
  it.each([String.raw`\frac{-(\frac12)}{z(z-1)}`, String.raw`\frac{-\frac12}{z(z-1)}`])('preserves a signed nested coefficient %s', source => expect(parseModel(source).b0).toBe(-0.5));
  it.each([
    String.raw`\frac{\frac12 z+1}{z(z-1)}`, String.raw`\frac{\frac{1}2 z+1}{z(z-1)}`,
    String.raw`\frac{\frac1{2} z+1}{z(z-1)}`, String.raw`\frac{\frac1\frac23 z+3}{3z(z-1)}`,
  ])('reads compact/nested coefficient fractions %s', source => expect(parseModel(source)).toEqual({ a1: -1, a0: 0, b1: 0.5, b0: 1 }));
  it.each([String.raw`\frac{2+\frac12}{z(z-1)}`, String.raw`\frac{5\times\frac12}{z(z-1)}`])('supports explicit fraction addition/multiplication %s', source => expect(parseModel(source).b0).toBe(2.5));
  it('preserves powers before a unary minus and unreduced common factors', () => {
    expect(parseModel('-1/(-z^2+z)')).toEqual({ a1: -1, a0: 0, b1: 0, b0: 1 });
    expect(parseModel('(z-2)/((z-2)(z+0.5))')).toEqual({ a1: -1.5, a0: -1, b1: 1, b0: -2 });
  });
  it.each([String.raw`\frac{z+.2}{z^+2-z}`, String.raw`\frac{z+.2}{z^2.0+z^2-z}`, String.raw`\frac{z+.2}{z^02-z}`, String.raw`\frac{z+.2}{z^20-z}`, String.raw`\frac{z+.2}{z^2.5-z}`])('rejects ambiguous unbraced exponent atoms %s', source => {
    expect(() => parseModel(source)).toThrow(/power|exponent/);
  });
  it.each([String.raw`\frac{z+.2}{z^{+2}-z}`, String.raw`\frac{z+.2}{z^{2}-z}`, String.raw`\frac{z+.2}{z^2-z}`, String.raw`\frac{z+.2}{z^{(2)}-z}`])('retains explicit supported powers %s', source => {
    expect(parseModel(source)).toEqual({ a1: -1, a0: 0, b1: 1, b0: 0.2 });
  });
  it.each([String.raw`\frac{z+.2}{z^{0}2+z^2-z}`, String.raw`\frac{z+.2}{z^{2}.0+z^2-z}`])('does not merge a braced exponent with following coefficient text %s', source => {
    expect(() => parseModel(source)).toThrow();
  });
  it('normalizes purely numeric font wrappers without granting algebraic variables', () => {
    expect(parseModel(String.raw`\frac{\mathrm{1}}{z(z-1)}`)).toEqual({ a1: -1, a0: 0, b1: 0, b0: 1 });
    expect(() => parseModel(String.raw`\frac{\mathrm{e}}{z(z-1)}`)).toThrow(/e\/E/);
  });
  it.each([
    String.raw`\frac{2\frac12}{z(z-1)}`, String.raw`\frac{-2\frac12}{z(z-1)}`,
    String.raw`\frac{(2\frac12)}{z(z-1)}`, String.raw`\frac{{2}\frac12}{z(z-1)}`,
    String.raw`\frac{(2)\frac12}{z(z-1)}`, String.raw`\frac{\mathrm{2}\frac12}{z(z-1)}`,
    String.raw`\frac{-(2\frac12)}{z(z-1)}`, String.raw`\frac{-(2)\frac12}{z(z-1)}`, String.raw`\frac1{z(z-2\frac12)}`,
  ])('rejects mixed or ambiguous number/fraction adjacency %s', source => expect(() => parseModel(source)).toThrow(/explicit \+ or ×/));
  it.each(['1e-2/(z(z-1))', '1E-2/(z(z-1))', String.raw`\frac{1\times10^{-2}}{z(z-1)}`])('rejects programming exponents or unsupported negative powers %s', source => expect(() => parseModel(source)).toThrow(/e\/E|powers/));
  it.each([
    '', 'K(z+.2)/(z(z-1))', 'L(z)=(z+.2)/(z(z-1))', 'sin(z)/(z(z-1))', '(z+1)/(z+1)',
    '(z^2+1)/(z(z-1))', '1/z^3', '1/0', '1/(z-z)', '1/(z^2.5)', '1/z^-2',
    '(0^0)/(z(z-1))', '1..2/(z(z-1))', '1 2/(z(z-1))', String.raw`\frac1`, String.raw`\frac{1}{}`,
    String.raw`\placeholder{}`, '1/z+1/z', '1'.repeat(513), '('.repeat(9) + '1/(z(z-1))' + ')'.repeat(9),
  ])('rejects unsupported, singular or malformed %s', source => expect(() => parseModel(source)).toThrow());
  it('bounds intermediate degree, magnitude, token count and literal underflow', () => {
    expect(() => parseModel('1/((z^2)(z^2)(z))')).toThrow(/degree/);
    expect(() => parseModel('1000000000000*100/(z(z-1))')).toThrow(/intermediates/);
    expect(() => parseModel('0.' + '0'.repeat(330) + '1/(z(z-1))')).toThrow(/too small/);
    expect(() => parseModel('(' + Array(70).fill('1').join('+') + ')/(z(z-1))')).toThrow(/128/);
  });
  it('rejects nonzero product, quotient and normalization underflow', () => {
    const small = '0.' + '0'.repeat(199) + '1', tiny = '0.' + '0'.repeat(319) + '1';
    expect(() => parseModel(`${small}*${small}/(z(z-1))`)).toThrow(/product is too small/);
    expect(() => parseModel(`${tiny}/1000000000000/(z(z-1))`)).toThrow(/quotient is too small/);
    expect(() => parseModel(`${tiny}/(1000000000000z(z-1))`)).toThrow(/normalized coefficient is too small/);
  });
});
