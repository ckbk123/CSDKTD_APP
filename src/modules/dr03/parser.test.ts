import { describe, expect, it } from 'vitest';
import { parseModel } from './parser';
import { ONE, add, compare, div, fromDecimal, fromNumber, mul, neg, rational, sub, toNumber } from './rational';

describe('DR03 bounded rational coefficients', () => {
  it('rounds halfway binary values to even and preserves representable subnormals', () => {
    const scale = 1n << 53n;
    expect(toNumber(rational(scale + 1n, scale))).toBe(1);
    expect(toNumber(rational(scale + 3n, scale))).toBe(1 + 2 ** -51);
    expect(toNumber(fromNumber(Number.MIN_VALUE), Number.MIN_VALUE)).toBe(Number.MIN_VALUE);
    expect(() => toNumber(rational(1n, 1n << 1075n), Number.MIN_VALUE)).toThrow(/range/);
    expect(toNumber(rational(3n, 1n << 1075n), Number.MIN_VALUE)).toBe(2 * Number.MIN_VALUE);
    for (const value of [.1, .3, 1.2345678901234567, 1e-300, 1e300, -2.718281828459045]) expect(toNumber(fromNumber(value))).toBe(value);
  });
  it('reduces signs and fractions and computes independent exact identities', () => {
    expect(rational(-6n, -8n)).toEqual({ n: 3n, d: 4n });
    const half = rational(1n, 2n), third = rational(1n, 3n);
    expect(add(half, third)).toEqual({ n: 5n, d: 6n });
    expect(mul(half, third)).toEqual({ n: 1n, d: 6n });
    expect(div(half, third)).toEqual({ n: 3n, d: 2n });
    expect(toNumber(neg(half))).toBe(-.5); expect(compare(half, third)).toBe(1);
  });
  it('distinguishes exact decimal source from the binary matrix value', () => {
    const difference = sub(fromNumber(.1), fromDecimal('.1'));
    expect(difference).toEqual({ n: 1n, d: 180143985094819840n });
    expect(toNumber(difference)).toBe(1 / (5 * 2 ** 55));
    expect(fromNumber(-0)).toEqual({ n: 0n, d: 1n });
  });
  it('rejects division by zero, excess bit work and unrepresentable results', () => {
    expect(() => div(ONE, rational(0n))).toThrow(/zero/);
    expect(() => rational(1n << 8192n)).toThrow(/8192/);
    expect(() => fromNumber(Infinity)).toThrow(/range/);
    expect(() => toNumber(fromNumber(Number.MIN_VALUE))).toThrow(/range/);
    expect(() => toNumber(rational(10n ** 301n))).toThrow(/range/);
  });
});

describe('DR03 proper discrete transfer grammar', () => {
  it.each([
    ['2', [1], [2]],
    ['0/(z^2+1)', [1, 0, 1], [0, 0, 0]],
    ['G(z)=(z+.5)/(z^2-.2z-.08)', [1, -.2, -.08], [0, 1, .5]],
    ['(2z+1)/(2z^2+3z+1)', [1, 1.5, .5], [0, 1, .5]],
    ['(z-1)^2/(z^2+2z+1)', [1, 2, 1], [1, -2, 1]],
    ['((z+1)^2-z^2-2z)/(z^2+3z+2)', [1, 3, 2], [0, 0, 1]],
    ['z^{0}*2', [1], [2]],
    ['\\frac12z/(z^2+1)', [1, 0, 1], [0, .5, 0]],
  ] as const)('normalizes %s in descending order without cancelling the denominator', (source, a, b) => {
    expect(parseModel(source)).toEqual({ a: [...a], b: [...b] });
  });
  it.each([
    '\\frac12/(z-.5)', '\\frac{1}2/(z-.5)', '\\frac1{2}/(z-.5)',
    '\\frac1{2(z-.5)}', '\\frac{\\mathrm{1}}2/(z-.5)',
  ])('preserves compact/mixed-argument fraction %s', source => {
    expect(parseModel(source)).toEqual({ a: [1, -.5], b: [0, .5] });
  });
  it('preserves a nested fraction and its outer sign', () => {
    expect(parseModel('-\\frac{\\frac12}{z-.5}')).toEqual({ a: [1, -.5], b: [0, -.5] });
    expect(parseModel('\\frac{-1}{2(z-.5)}')).toEqual({ a: [1, -.5], b: [0, -.5] });
  });
  it('retains a small exact decimal coefficient after large-term cancellation', () => {
    // (10^5+10^-6)^2 - 10^10 - 0.2 = 10^-12.
    const result = parseModel('((100000+.000001)^2-100000^2-.2)/(z+1)');
    expect(result.a).toEqual([1, 1]); expect(result.b).toEqual([0, 1e-12]);
  });
  it.each([
    '2\\frac12/(z+1)', '-2\\frac12/(z+1)', '(2\\frac12)/(z+1)',
    '\\frac{2\\frac12}{z+1}', 'z+2\\frac12', '2z2\\frac12/(z^2+1)',
  ])('rejects ambiguous mixed-number adjacency %s', source => {
    expect(() => parseModel(source)).toThrow(/explicit \+/);
  });
  it('allows explicit fraction arithmetic and a preceding variable factor', () => {
    expect(parseModel('(2+\\frac12)/(z+1)').b).toEqual([0, 2.5]);
    expect(parseModel('2\\times\\frac12/(z+1)').b).toEqual([0, 1]);
    expect(parseModel('2z\\frac12/(z^2+1)').b).toEqual([0, 1, 0]);
  });
  it.each(['1{+2}/(z+1)', '{z+1}z/(z^2+1)', '{z+1}/(z^2+1)'])('rejects invisible grouping %s', source => {
    expect(() => parseModel(source)).toThrow(/explicit|visible/);
  });
  it.each(['z^12', 'z^{12}', '2^12', '2^{12}', 'z^-2', 'z^{+2}', 'z^{-1}'])('does not reinterpret exponent token boundaries %s', source => {
    expect(() => parseModel(source)).toThrow(/power/);
  });
  it.each(['z^{0}2', 'z^{1}2/(z^2+1)', '2^{1}2'])('keeps the token after a braced exponent separate in %s', source => {
    expect(() => parseModel(source)).toThrow(/operators|multiplication/);
  });
  it.each(['1e-2/(z+1)', '1E-2/(z+1)', '\\mathrm{z}', 'sin(z)', 'NaN', 'Infinity'])('rejects unsupported variable/function notation %s', source => {
    expect(() => parseModel(source)).toThrow(/unsupported/i);
  });
  it.each([
    ['', /Enter/], ['\\frac10', /zero/], ['1/(z-z)', /zero/],
    ['z^2/(z+1)', /improper/], ['1/((z+1)(z+2)(z+3))', /order/],
    ['1/(.000000001z+1)', /leading/], ['1000001/(z+1)', /entered number/],
    ['1/(z+1', /Close/], ['1' + ' '.repeat(512), /512/],
    ['('.repeat(21) + '1' + ')'.repeat(21), /nested/],
  ] as const)('rejects bounded failure %s', (source, message) => {
    expect(() => parseModel(source)).toThrow(message);
  });
  it('rejects nonzero coefficient underflow and bounded exact-operand overflow', () => {
    const tiny = '0.' + '0'.repeat(300) + '1';
    expect(() => parseModel(tiny + '/(z+1)')).toThrow(/range/);
    const min = '0.' + '0'.repeat(299) + '1';
    expect(() => parseModel('((((' + min + ')^2)^2)^2)^2')).toThrow(/8192/);
  });
});
