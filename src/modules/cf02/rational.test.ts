import { describe, expect, it } from 'vitest';
import { add, compare, decimal, div, exactText, mul, ONE, rational, sub, toNumber, ZERO } from './rational';
import { parseLinearExact } from './parser';

describe('exact CF02 numeric coefficients', () => {
  it('preserves decimal and fraction cancellation', () => {
    expect(exactText(sub(add(decimal('.1'), decimal('.2')), decimal('.3')))).toBe('0');
    expect(exactText(add(div(ONE, rational(3n)), div(rational(2n), rational(3n))))).toBe('1');
    expect(exactText(parseLinearExact('0.1+0.2-0.3')[0])).toBe('0');
    expect(exactText(parseLinearExact(String.raw`\frac13s+\frac23s`)[1])).toBe('1');
  });
  it('does not invent a nonzero physical-error constant from h=.8, N=10, D=s+2', () => {
    const constant = add(decimal('2'), mul(sub(decimal('.8'), ONE), decimal('10')));
    expect(constant.n).toBe(0n);
  });
  it('keeps native exponent syntax separate from visual literals', () => {
    expect(() => decimal('1e-2')).toThrow();
    expect(exactText(decimal('1e-2', true))).toBe('1/100');
    expect(decimal('0e-999', true)).toEqual(ZERO);
    expect(() => toNumber(decimal('1e-999', true))).toThrow(/too small/);
  });
  it('converts large finite ratios without Infinity/Infinity', () => {
    const scale = 10n ** 400n;
    const value = rational(scale + 1n, scale - 1n);
    expect(toNumber(value)).toBeCloseTo(1, 14);
    expect(compare(value, ONE)).toBe(1);
    expect(exactText(rational(-6n, -8n))).toBe('3/4');
  });
  it('rejects zero division and bounded-arithmetic exhaustion', () => {
    expect(() => div(ONE, ZERO)).toThrow(/zero denominator/);
    expect(() => rational(1n << 5000n)).toThrow(/4096 bits/);
    expect(() => decimal('1e999999', true)).toThrow(/budget/);
  });
});
