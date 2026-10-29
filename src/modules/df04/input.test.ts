import { describe, expect, it } from 'vitest';
import { parsePlant } from './input';

describe('DF04 bounded physical first-order visual input', () => {
  it.each(['1/(s+1)', String.raw`\frac1{s+1}`, String.raw`\frac{1}{s^{+1}+1}`, String.raw`\frac{2}{2s+2}`, String.raw`-\frac{-1}{s+1}`])('normalizes the baseline %s', source => {
    expect(parsePlant(source)).toEqual({ gain: 1, tau: 1 });
  });
  it('changes DC gain and time constant independently', () => {
    expect(parsePlant(String.raw`\frac{2}{0.5s+1}`)).toEqual({ gain: 2, tau: 0.5 });
    expect(parsePlant(String.raw`\frac2{4s+2}`)).toEqual({ gain: 1, tau: 2 });
    expect(parsePlant('-1/(-s-1)')).toEqual({ gain: 1, tau: 1 });
  });
  it.each([String.raw`\frac{\frac12}{s+1}`, String.raw`\frac{\frac1{2}}{s+1}`, String.raw`\frac{\frac{1}2}{s+1}`, String.raw`\frac{\frac1\frac23}{3s+3}`])('preserves compact/nested fractions %s', source => {
    expect(parsePlant(source)).toEqual({ gain: 0.5, tau: 1 });
  });
  it('accepts a fraction time constant, ordinary powers and numeric style wrappers', () => {
    expect(parsePlant(String.raw`\frac1{\frac12 s^1+1}`)).toEqual({ gain: 1, tau: 0.5 });
    expect(parsePlant(String.raw`\frac{\mathrm{1}}{s^{(1)}+1}`)).toEqual({ gain: 1, tau: 1 });
    expect(parsePlant(String.raw`\frac{s^0}{s+1}`)).toEqual({ gain: 1, tau: 1 });
  });
  it('keeps explicit addition and multiplication before a fraction distinct', () => {
    expect(parsePlant(String.raw`\frac{2+\frac12}{s+1}`)).toEqual({ gain: 2.5, tau: 1 });
    expect(parsePlant(String.raw`\frac{2\times\frac12}{s+1}`)).toEqual({ gain: 1, tau: 1 });
  });
  it.each([String.raw`\frac{2\frac12}{s+1}`, String.raw`\frac{-(2\frac12)}{s+1}`, String.raw`\frac{(2)\frac12}{s+1}`, String.raw`\frac{\mathrm{2}\frac12}{s+1}`, String.raw`\frac1{s+2\frac12}`])('rejects mixed-fraction adjacency without guessing %s', source => {
    expect(() => parsePlant(source)).toThrow(/explicit \+ or ×/);
  });
  it.each([String.raw`\frac1{s^+1+1}`, String.raw`\frac1{s^1.0+s+1}`, String.raw`\frac1{s^01+1}`, String.raw`\frac1{s^{0}1+s+1}`, String.raw`\frac1{s^{-1}+1}`])('preserves TeX exponent atom boundaries %s', source => {
    expect(() => parsePlant(source)).toThrow();
  });
  it.each(['', '1e-2/(s+1)', '1E-2/(s+1)', 'G(s)=1/(s+1)', 'K/(s+1)', '1/(z+1)', '1/s', '1/(s-1)', '-1/(s+1)', '(s+1)/(s+1)', '1/(s^2+1)', '1/(s-s)', '1/0', '1/(0s+1)', '1/{s+1}', '1/{1+s}s', '1{+2}/(s+1)', '1/s+1/s'])('rejects unsupported or nonphysical forms %s', source => {
    expect(() => parsePlant(source)).toThrow();
  });
  it('bounds source/depth/work, coefficient normalization and nonzero underflow', () => {
    expect(() => parsePlant('1'.repeat(513))).toThrow(/512/);
    expect(() => parsePlant('('.repeat(9) + '1/(s+1)' + ')'.repeat(9))).toThrow(/eight/);
    expect(() => parsePlant('1000000000000*100/(s+1)')).toThrow(/intermediates/);
    expect(() => parsePlant('0.' + '0'.repeat(330) + '1/(s+1)')).toThrow(/too small/);
    expect(() => parsePlant('21/(s+1)')).toThrow(/plant DC gain/);
    expect(() => parsePlant('1/(11s+1)')).toThrow(/time constant/);
    expect(() => parsePlant('(' + Array(70).fill('1').join('+') + ')/(s+1)')).toThrow(/128/);
  });
});
