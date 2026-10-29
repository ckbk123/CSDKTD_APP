import { describe, expect, it } from 'vitest';
import { textQ } from './algebra';
import { analyzeCoefficients } from './math';
import { parseAnswer, parseCharacteristic } from './parser';
const coefficients = (source: string, gain = 20) => parseCharacteristic(source, gain).map(textQ);

describe('CS02 visible characteristic polynomial grammar', () => {
  it.each([String.raw`\frac1\;2`, String.raw`\frac\,12`, String.raw`\frac1\quad2`, String.raw`\frac\!12`, String.raw`\frac{1}\ 2`])('rejects spacing arguments before normalization: %s', fraction => {
    expect(() => coefficients(`s+${fraction}`)).toThrow('blank space cannot fill a box'); expect(() => parseAnswer(fraction)).toThrow('blank space cannot fill a box');
  });
  it('preserves properly braced spacing controls and variable fraction tokens', () => {
    expect(coefficients(String.raw`s+\frac1{\;2}`)).toEqual(['1/2', '1']);
    expect(coefficients(String.raw`\frac s2+1`)).toEqual(['1', '1/2']);
    expect(coefficients(String.raw`s+2^{\;2}`)).toEqual(['4', '1']);
    expect(textQ(parseAnswer(String.raw`\frac1{\;2}`))).toBe('1/2');
    expect(textQ(parseAnswer(String.raw`\frac1{\quad2}`))).toBe('1/2');
    for (const source of [String.raw`s+2^\;2`, String.raw`s+2^\,2`]) expect(() => coefficients(source)).toThrow('blank space cannot fill a box');
  });
  it('does not fuse separate numeric tokens across explicit spacing', () => {
    for (const source of [String.raw`s+1\;2`, String.raw`s+0.\,2`, String.raw`s+\frac{1\;2}{3}`, String.raw`s+1\quad2`, String.raw`s+1\; \,2`]) expect(() => coefficients(source)).toThrow('separated numbers');
    expect(coefficients(String.raw`s+2\;s`)).toEqual(['0', '3']);
  });
  it('reads the source polynomial and substitutes changed K before exact analysis', () => {
    expect(coefficients('P(s)=s^3+7s^2+10s+K')).toEqual(['20', '10', '7', '1']);
    expect(analyzeCoefficients(parseCharacteristic('s(s+2)(s+5)+K', 80)).right).toBe(2);
    expect(coefficients('s^2+2s+1', 0)).toEqual(['1', '2', '1']);
  });
  it.each([String.raw`\frac12`, String.raw`\frac{1}2`, String.raw`\frac1{2}`, String.raw`\frac{1}{2}`])('preserves compact one-token fractions: %s', fraction => {
    expect(coefficients(`s+${fraction}`)).toEqual(['1/2', '1']);
    expect(coefficients(`s-${fraction}`)).toEqual(['-1/2', '1']);
  });
  it('supports visible signs, grouped polynomial fractions and bounded nested fractions', () => {
    expect(coefficients(String.raw`-\frac{(s+1)^2}{2}`)).toEqual(['-1/2', '-1', '-1/2']);
    expect(coefficients(String.raw`s+\frac{\frac12}{\frac34}`)).toEqual(['2/3', '1']);
    expect(coefficients(String.raw`s+\frac{-1}{2}`)).toEqual(['-1/2', '1']);
    expect(coefficients(String.raw`s+\frac123`)).toEqual(['3/2', '1']);
  });
  it('keeps exponent token boundaries or rejects ambiguous tails', () => {
    expect(coefficients('s+2^{12}')).toEqual(['4096', '1']);
    expect(coefficients('s^{+2}+1')).toEqual(['1', '0', '1']);
    expect(coefficients('s+2^3')).toEqual(['8', '1']);
    for (const source of ['s+2^12', 's^12+1', 's^{0}2+1', 's^2.0+s', 's^{2}.0+s']) expect(() => coefficients(source), source).toThrow(/power box/);
    for (const source of ['s^-2+1', 's^+2+1']) expect(() => coefficients(source), source).toThrow(/power box/);
    expect(() => coefficients('s^{12}+1')).toThrow('degree'); expect(() => coefficients('s+2^{13}')).toThrow('power');
  });
  it('rejects mixed-number adjacency before any coefficient expansion', () => {
    for (const source of [String.raw`s+2\frac12`, String.raw`s-2\frac12`, String.raw`s(s+2\frac12)`, String.raw`s+\frac{2\frac12}{3}`, String.raw`s+2\,\frac12`, String.raw`s+2.\frac12`]) expect(() => coefficients(source), source).toThrow('Mixed numbers');
    expect(coefficients(String.raw`s+2+\frac12`)).toEqual(['5/2', '1']);
    expect(coefficients(String.raw`s+2\times\frac12`)).toEqual(['1', '1']);
    expect(coefficients(String.raw`s+2\left(\frac12\right)`)).toEqual(['1', '1']);
    expect(coefficients(String.raw`s+\frac12\frac34`)).toEqual(['3/8', '1']);
    expect(coefficients(String.raw`s^2\frac12+s`)).toEqual(['0', '1', '1/2']);
  });
  it('rejects invisible grouping, nonconstant division, e notation and malformed inputs', () => {
    for (const source of ['s+1{+2}', '{s+2}s', String.raw`s+\frac{1{+2}}{3}`]) expect(() => coefficients(source)).toThrow('visible parentheses');
    for (const source of ['s+1e-2', 's+j', String.raw`s+\sqrt{2}`]) expect(() => coefficients(source)).toThrow('unsupported');
    expect(() => coefficients('s+1/s')).toThrow('nonzero constant'); expect(() => coefficients('s+1/0')).toThrow('nonzero constant');
    expect(() => coefficients('(s+1')).toThrow('Close'); expect(() => coefficients('s+')).toThrow('Complete');
    expect(() => coefficients(String.raw`s+\frac-12`)).toThrow(/fraction.*box/); expect(() => coefficients('0')).toThrow('degree');
  });
  it('bounds source, tokens, nesting, literals and native selected K', () => {
    expect(() => coefficients('s+' + '1+'.repeat(300))).toThrow('600');
    expect(() => coefficients('s' + '+s'.repeat(128))).toThrow('256');
    expect(() => coefficients('('.repeat(17) + 's' + ')'.repeat(17))).toThrow('sixteen');
    expect(() => coefficients('s+1234567890123')).toThrow('12 digits'); expect(() => coefficients('s+0.123456789')).toThrow('8 decimal');
    expect(() => coefficients('s^7+1')).toThrow('degree'); expect(() => coefficients('s+K', Infinity)).toThrow('finite');
    expect(() => coefficients('s+K', 1001)).toThrow('finite');
  });
});

describe('CS02 separate exact numeric student answers', () => {
  it('accepts equivalent exact fractions, nested fraction arithmetic and powers', () => {
    expect(textQ(parseAnswer(String.raw`\frac{50}{7}`))).toBe('50/7');
    expect(textQ(parseAnswer(String.raw`-\left(\frac12\right)`))).toBe('-1/2');
    expect(textQ(parseAnswer(String.raw`\frac{\frac12}{\frac34}`))).toBe('2/3');
    expect(textQ(parseAnswer('10^{12}*10^{12}'))).toBe('1000000000000000000000000');
  });
  it('rejects unsupported variables, mixed numbers, hidden groups and undefined arithmetic', () => {
    expect(() => parseAnswer('s')).toThrow('variables'); expect(() => parseAnswer('K')).toThrow('variables');
    expect(() => parseAnswer(String.raw`2\frac12`)).toThrow('Mixed'); expect(() => parseAnswer('1{+2}')).toThrow('visible');
    expect(() => parseAnswer('0^0')).toThrow('power 0'); expect(() => parseAnswer('1/0')).toThrow('nonzero');
    expect(() => parseAnswer('0.1e-2')).toThrow('e notation');
  });
});
