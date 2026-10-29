import { describe, expect, it } from 'vitest';
import { decimal, loopLatex, polynomial } from './format';
import { parseModel } from './input';
import { emulatePI } from './math';
describe('DF03 preserves coefficients in generated visual mathematics', () => {
  it.each([1e-9, -1e-9, 1.234567890123e-8, -5e-8, 100, -.3])('round trips %s as a decimal without exponent symbols', value => {
    const source = decimal(value); expect(source).not.toMatch(/[eE]/); expect(Number(source)).toBe(value);
  });
  it('retains small nonzero powers and signed coefficients in the actual parsed equation', () => {
    expect(polynomial([1, -1e-9, 0])).toBe('z^{2}-0.000000001z');
    expect(parseModel(loopLatex({ numerator: [1e-9], denominator: [1, -1e-9] })).numerator).toEqual([1e-9]);
  });
  it('round trips both emulated loops at changed data without shortening coefficients', () => {
    for (const method of ['backward', 'trapezoidal'] as const) {
      const { model } = emulatePI({ g: 2, tau: .5, kp: .3, ki: .1, T: .01, method });
      const parsed = parseModel(loopLatex(model)); expect(parsed.denominator).toEqual(model.denominator); expect(parsed.numerator).toEqual(model.numerator);
    }
  });
});
