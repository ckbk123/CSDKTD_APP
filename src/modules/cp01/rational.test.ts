import { describe, expect, it } from 'vitest';
import { add, decimal, div, exactText, ONE, rational, sub, toNumber, ZERO } from './rational';

describe('CP01 exact scalar coefficients and separate numerical conversion', () => {
  it('retains exact arithmetic identities before conversion', () => {
    expect(exactText(sub(add(decimal('.1'), decimal('.2')), decimal('.3')))).toBe('0');
    expect(exactText(add(div(ONE, rational(3n)), div(rational(2n), rational(3n))))).toBe('1');
  });
  it('uses ordinary finite ratios without introducing a decimal-mantissa division', () => {
    expect(toNumber(rational(3n))).toBe(3);
    expect(toNumber(rational(-3n, 2n))).toBe(-1.5);
    expect(toNumber(rational(1n, 8n))).toBe(.125);
  });
  it('still converts huge finite ratios without Infinity/Infinity', () => {
    const scale = 10n ** 400n;
    expect(toNumber(rational(scale + 1n, scale - 1n))).toBeCloseTo(1, 14);
  });
  it('keeps native exponent syntax and intentional zero distinct from underflow', () => {
    expect(() => decimal('1e-2')).toThrow();
    expect(exactText(decimal('1e-2', true))).toBe('1/100');
    expect(decimal('0e-999', true)).toEqual(ZERO);
    expect(() => toNumber(decimal('1e-999', true))).toThrow(/too small/);
  });
  it('reports zero division and exact-work exhaustion', () => {
    expect(() => div(ONE, ZERO)).toThrow(/zero denominator/);
    expect(() => rational(1n << 5000n)).toThrow(/4096 bits/);
  });
});
