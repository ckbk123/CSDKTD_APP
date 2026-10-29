import { describe, expect, it } from 'vitest';
import { parsePlant, parseController } from './input';
describe('CF03 displayed mathematical meaning', () => {
  it('reads baseline polynomial/factored plants and P/PI controllers', () => {
    expect(parsePlant(String.raw`G(s)=\frac1{(s+1)(s+2)}`)).toEqual({g:1,a:[1,3,2]});
    expect(parsePlant('2/(2s^2+6s+4)')).toEqual({g:1,a:[1,3,2]});
    expect(parseController('C(s)=4')).toEqual({kp:4,ki:0});
    expect(parseController(String.raw`C(s)=\frac{4s+2}s`)).toEqual({kp:4,ki:2});
    expect(parseController(String.raw`\frac1s`)).toEqual({kp:0,ki:1});
    for(const source of[String.raw`\frac12`,String.raw`\frac{1}2`,String.raw`\frac1{2}`])expect(parseController(source)).toEqual({kp:.5,ki:0});
  });
  it('preserves outer unary signs without changing the sign of a following sum', () => {
    expect(parseController('-1+2')).toEqual({kp:1,ki:0});
    expect(parseController('-(1+2)')).toEqual({kp:-3,ki:0});
    expect(parseController(String.raw`-\left(\frac1s\right)`)).toEqual({kp:0,ki:-1});
    expect(parsePlant(String.raw`-(\frac1{s+1})`)).toEqual({g:-1,a:[1,1]});
    expect(parsePlant('-1/(s+1)')).toEqual({g:-1,a:[1,1]});
  });
  it.each([String.raw`\frac{1{+2}}{s+1}`,String.raw`\frac1{{s+2}s}`,String.raw`\frac{2\frac12}{s+1}`,String.raw`2{\frac12}`,String.raw`-{2}\frac12`,String.raw`\frac1{s+2\frac12}`,'1e-2/(s+1)','1/(s+1)+2','1+2/(s+1)','1/s(s+1)','1/0','1/(s^3+1)','0/(s+1)','1/(s+)',String.raw`\frac1{\placeholder{}}`])('rejects malformed or unsupported plant meaning %s', source => {
    expect(()=>parsePlant(source)).toThrow();
  });
  it('keeps numeric wrappers and explicit grouping distinct from invisible grouping', () => {
    expect(parsePlant(String.raw`\frac{1{2}}{s+1}`).g).toBe(12);
    expect(parseController(String.raw`-{2}{3}`)).toEqual({kp:-23,ki:0});
    expect(()=>parseController(String.raw`-{2+3}`)).toThrow(/visible parentheses/);
    expect(parsePlant(String.raw`\frac{{.2}}{s^{2}+3s+2}`).g).toBe(.2);
    expect(parsePlant(String.raw`\frac{1+2}{s+1}`).g).toBe(3);
    expect(()=>parsePlant(String.raw`\frac{1{+2}}{s+1}`)).toThrow(/visible parentheses/);
    expect(parseController('(4s+2)/s')).toEqual({kp:4,ki:2});
    expect(()=>parseController('4+2/s')).toThrow(/visible parentheses/);
    expect(()=>parseController('2/(s+1)')).toThrow(/proportional/);
  });
  it('rejects raw unbraced parenthesized exponent atoms before brace normalization', () => {
    for (const source of ['2^(2)', '-2^(2)', String.raw`2^\left(2\right)`]) expect(() => parseController(source)).toThrow(/power box/);
    for (const source of [String.raw`\frac{1}{s^(2)+s+1}`, String.raw`\frac{1}{s^\left(2\right)+s+1}`]) expect(() => parsePlant(source)).toThrow(/power box/);
  });
  it('retains true braced and one-token powers throughout the bounded grammar', () => {
    for (const [source, expected] of [['2^0', 1], ['2^{0}', 1], ['2^1', 2], ['2^{1}', 2], ['2^2', 4], ['2^{2}', 4]] as const) expect(parseController(source)).toEqual({kp:expected,ki:0});
    expect(parseController('2^{2}(2)')).toEqual({kp:8,ki:0});
    expect(parsePlant(String.raw`\frac{1}{s^{2}+s+1}`)).toEqual({g:1,a:[1,1,1]});
    expect(parsePlant(String.raw`\frac{1}{s^2+s+1}`)).toEqual({g:1,a:[1,1,1]});
  });
  it('bounds coefficient size and rejects raw nonzero decimal underflow', () => {
    expect(()=>parseController('1001')).toThrow(/1000/);
    expect(()=>parsePlant('1/(0.00000000001s+1)')).toThrow(/leading/);
    expect(()=>parseController('0.'+'0'.repeat(400)+'1')).toThrow(/too small/);
    const tiny='0.'+'0'.repeat(319)+'1'; // representable numerator, unrepresentable nonzero quotient
    expect(()=>parseController(`${tiny}/1000000`)).toThrow(/ratio is too small/);
    expect(()=>parsePlant('1'.repeat(513))).toThrow(/512/);
  });
});
