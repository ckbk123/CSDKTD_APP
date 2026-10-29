import { describe, expect, it } from 'vitest';
import { numberTex, numberText, polynomialTex } from './format';
describe('DD05 result notation', () => {
  it('keeps exponent powers grouped in typeset numerical results', () => {
    expect(numberTex(1e-9)).toBe(String.raw`1\times10^{-9}`); expect(numberTex(-1e9)).toBe('-1000000000'); expect(numberText(null)).toBe('Undefined'); expect(numberText(Infinity)).toBe('∞');
  });
  it('keeps the degree and sign of a full unreduced characteristic', () => {
    expect(polynomialTex([1, -.2, .05, .026])).toBe('z^{3}-(0.2)z^{2}+(0.05)z+(0.026)'); expect(polynomialTex([1, -1, 0])).toBe('z^{2}-z');
  });
});
