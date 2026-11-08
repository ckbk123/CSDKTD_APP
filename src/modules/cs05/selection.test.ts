import { describe, expect, it } from 'vitest';
import { cutLatex, cutNumber } from './gains';
import { cursorGain, nativeGain } from './selection';

describe('bounded exact gain-entry conventions', () => {
  it('keeps native zero and exponent values exact while rejecting out-of-range or underflow text', () => {
    expect(cutLatex(nativeGain('0e-999'))).toBe('0'); expect(cutLatex(nativeGain('1e-2'))).toBe(String.raw`\frac{1}{100}`);
    expect(() => nativeGain('1e-999')).toThrow(); expect(() => nativeGain('-1')).toThrow('0 to 10,000'); expect(() => nativeGain('10001')).toThrow('0 to 10,000');
  });
  it('uses a nonzero declared cursor precision down to its scale limit', () => {
    for (const value of [0, 1e-15, 1e-12, .00000123456789123, .000123456789123, 70, 10000]) {
      const result = cutNumber(cursorGain(value)); expect(result).toBeCloseTo(value, 11); if (value) expect(result).toBeGreaterThan(0);
    }
    expect(cutLatex(cursorGain(1e-15))).toBe(String.raw`\frac{1}{1000000000000000}`);
    expect(() => cursorGain(1e-16)).toThrow('not changed to zero'); expect(() => cursorGain(NaN)).toThrow();
  });
});
