import { describe, expect, it } from 'vitest';
import { parseTransfer, latexNumber } from './input';
import { buildResponse } from './response';
describe('CF01 bounded visual transfer input', () => {
  it('typesets scientific results with multiplication and a power, never a tab escape', () => {
    expect(latexNumber(1e-7)).toBe(String.raw`1\times10^{-7}`);
    expect(latexNumber(.5)).toBe('0.5');
  });
  it('reads baseline, products, changed normalization and visible unary grouping', () => {
    expect(parseTransfer('4/(s^2+2s+4)')).toEqual({g:4,a1:2,a0:4});
    expect(parseTransfer('T(s)=8/(2s^2+4s+8)')).toEqual({g:4,a1:2,a0:4});
    expect(parseTransfer('1/((s+1)(s+2))')).toEqual({g:1,a1:3,a0:2});
    expect(parseTransfer('-4/(-s^2-2s-4)')).toEqual({g:4,a1:2,a0:4});
  });
  it('accepts the actual compact fraction forms and proper power-box arguments', () => {
    for (const text of ['\\frac4{s^2+2s+4}','\\frac{4}{s^{2}+2s+4}']) expect(parseTransfer(text)).toEqual({g:4,a1:2,a0:4});
    expect(parseTransfer('\\frac{1{2}}{s^{2}+2s+4}').g).toBe(12);
    expect(parseTransfer('\\frac{{.2}}{s^{2}+2s+4}').g).toBe(.2);
  });
  it.each(['4/(s^(2)+2s+4)','4/(s^12+2s+4)','4/(s^{12}+2s+4)','4/(s+1)','4/(s^3+1)','4+1/(s^2+s+1)','4/s(s+1)','\\frac{1{+2}}{s^2+s+1}','\\frac{2\\frac12}{s^2+s+1}','1e-2/(s^2+s+1)','\\frac4{s+}','\\frac4{\\placeholder{}}','0/(s^2+s+1)'])('rejects ambiguous, incomplete or unsupported meaning: %s', text => {
    expect(() => buildResponse(parseTransfer(text))).toThrow();
  });
  it('keeps mathematical validation separate and bounds input/underflow work', () => {
    expect(() => buildResponse(parseTransfer('1/(s^2-2s+1)'))).toThrow(/stable/);
    expect(() => buildResponse(parseTransfer('1/(s^2+100s+1)'))).toThrow(/damping/);
    expect(() => parseTransfer('1'.repeat(513))).toThrow(/512/);
    expect(() => parseTransfer('0.'+'0'.repeat(400)+'1/(s^2+s+1)')).toThrow(/too small/);
    expect(() => parseTransfer('1/(0.00000000001s^2+s+1)')).toThrow(/leading/);
    const tiny='0.'+'0'.repeat(319)+'1';
    expect(() => parseTransfer(tiny+'/(1000000s^2+s+1)')).toThrow(/ratio is too small/);
  });
});
