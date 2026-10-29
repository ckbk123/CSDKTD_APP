import { describe, expect, it } from 'vitest';
import { parsePlant } from './input';
describe('DD03 bounded visual integrating-plant grammar', () => {
  it.each(['1/(s(s+2))', String.raw`\frac1{s(s+2)}`, String.raw`\frac{1}{s^{2}+2s}`, String.raw`\frac{2}{2s(s+2)}`, String.raw`-\frac{-1}{s^2+2s}`])('normalizes %s', source => {
    expect(parsePlant(source)).toEqual({ gain: 1, p: 2 });
  });
  it.each([String.raw`\frac{\frac12}{s(s+1)}`, String.raw`\frac{\frac{1}2}{s(s+1)}`, String.raw`\frac{\frac1{2}}{s(s+1)}`, String.raw`\frac{\frac1\frac23}{3s(s+1)}`])('preserves compact/nested fractions %s', source => { expect(parsePlant(source)).toEqual({ gain: .5, p: 1 }); });
  it('normalizes changed coefficient order, positive scaling and signs without cancellation', () => {
    expect(parsePlant('2/(3s+2s^2)')).toEqual({ gain: 1, p: 1.5 }); expect(parsePlant('-2/(-s^2-4s)')).toEqual({ gain: 2, p: 4 });
    expect(parsePlant(String.raw`\frac{\mathrm{1}}{s^{+2}+2s^{(1)}}`)).toEqual({ gain: 1, p: 2 });
    expect(parsePlant(String.raw`\frac{2+\frac12}{s(s+2)}`)).toEqual({ gain: 2.5, p: 2 });
    expect(parsePlant(String.raw`\frac{2\times\frac12}{s(s+2)}`)).toEqual({ gain: 1, p: 2 });
  });
  it.each([String.raw`\frac{2\frac12}{s(s+1)}`, String.raw`\frac{-(2\frac12)}{s(s+1)}`, String.raw`\frac{(2)\frac12}{s(s+1)}`, String.raw`\frac{\mathrm{2}\frac12}{s(s+1)}`, String.raw`\frac1{s(s+2\frac12)}`])('rejects mixed adjacency %s', source => { expect(() => parsePlant(source)).toThrow(/explicit \+ or ×/); });
  it.each([String.raw`\frac1{s^+2+2s}`, String.raw`\frac1{s^2.0+2s}`, String.raw`\frac1{s^02+2s}`, String.raw`\frac1{s^(2)+2s}`, String.raw`\frac1{s^{0}2+2s}`, String.raw`\frac1{s^{-2}+2s}`])('keeps exponent atom boundaries %s', source => { expect(() => parsePlant(source)).toThrow(); });
  it.each([String.raw`\frac\quad12/(s(s+1))`, String.raw`\frac1\,2/(s(s+1))`, String.raw`1/(s^\;2+s)`, String.raw`1\quad2/(s(s+1))`, String.raw`\frac{1\,2}{s(s+1)}`, String.raw`\frac{1}{s(s+1)}\!2`])('rejects explicit spacing rather than erasing TeX argument tokens %s', source => { expect(() => parsePlant(source)).toThrow(/spacing commands|blank space cannot fill a box/); });
  it.each(['', '1e-2/(s(s+1))', '1E-2/(s(s+1))', 'G(s)=1/(s(s+1))', 'K/(s(s+1))', '1/(z(z+1))', '1/s', '1/(s(s-1))', '-1/(s(s+1))', '(s+1)/(s(s+1))', '1/(s^2+1)', '1/(s-s)', '1/0', '1/{s(s+1)}', '1{+2}/(s(s+1))', '1/s+1/s', '1 2/(s(s+1))'])('rejects unsupported/invalid input %s', source => { expect(() => parsePlant(source)).toThrow(); });
  it('bounds source, work, depth and numeric conditioning', () => {
    expect(() => parsePlant('1'.repeat(513))).toThrow(/512/);
    expect(() => parsePlant('('.repeat(9) + '1/(s(s+1))' + ')'.repeat(9))).toThrow(/eight/);
    expect(() => parsePlant('1000000000000*100/(s(s+1))')).toThrow(/intermediates/);
    expect(() => parsePlant('0.' + '0'.repeat(330) + '1/(s(s+1))')).toThrow(/too small/);
    expect(() => parsePlant('21/(s(s+1))')).toThrow(/Plant gain/);
    expect(() => parsePlant('1/(s(s+21))')).toThrow(/rate/);
    expect(() => parsePlant('(' + Array(70).fill('1').join('+') + ')/(s(s+1))')).toThrow(/128/);
  });
});
