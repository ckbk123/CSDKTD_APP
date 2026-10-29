import { describe, expect, it } from 'vitest';
import { c, residual } from './complex';
import { baseline, candidate, characteristic, gainValue, parseModel } from './model';
import { parsePolynomial } from './parser';
import { derivative, gcd, product, quotient, realZeros } from './polynomial';
import { decimal, exactText, rational, toNumber } from './rational';
import { expandRoots, roots } from './roots';

const coefficients = (text: string) => parsePolynomial(text).map(exactText);
function rootNear(text: string, expected: readonly [number, number, number][]): void {
  const actual = roots(parsePolynomial(text)); expect(actual).toHaveLength(expected.length);
  for (const [re, im, multiplicity] of expected) expect(actual.some(p => Math.abs(p.re - re) < 1e-9 && Math.abs(p.im - im) < 1e-9 && p.multiplicity === multiplicity)).toBe(true);
}
describe('bounded displayed polynomial meaning', () => {
  it.each(['\\frac1\u20092','s^\u20093',String.raw`\frac1{\left\;2}`,String.raw`\frac1{\left\left\,2}`,String.raw`\frac1{\left2\;}`])('rejects changed TeX argument meaning before normalization in %s',source=>expect(()=>parsePolynomial(source)).toThrow(/box/));
  it('retains true braced arguments and visible fences',()=>{
    expect(coefficients('\\frac1{\u20092}')).toEqual(['1/2']);expect(coefficients('s^{\u20093}')).toEqual(['0','0','0','1']);expect(coefficients(String.raw`\frac1{\left(\;2\right)}`)).toEqual(['1/2']);
  });
  it.each([
    ['s(s+2)(s+5)', ['0', '10', '7', '1']], ['(s+1)^3', ['1', '3', '3', '1']],
    [String.raw`\frac12s+1`, ['1', '1/2']], [String.raw`\frac{1}2s+1`, ['1', '1/2']], [String.raw`\frac1{2}s+1`, ['1', '1/2']],
    [String.raw`-\frac{s+1}{2}`, ['-1/2', '-1/2']], [String.raw`\frac{-s-1}{2}`, ['-1/2', '-1/2']],
    [String.raw`2\times\frac12s+1`, ['1', '1']], [String.raw`2+\frac12`, ['5/2']], ['0.01', ['1/100']],
    [String.raw`s^{3}`, ['0', '0', '0', '1']], [String.raw`\mathrm{s}^2+1`, ['1', '0', '1']],
  ])('preserves %s', (text, expected) => { expect(coefficients(text)).toEqual(expected); })
  it.each([String.raw`2\frac12s+1`, String.raw`-2\frac12`, String.raw`(2)\frac12`, String.raw`\frac{2\frac12}{3}`, String.raw`{s+1}s`, '1{+2}', 's^12', 's^{12}', '2^12', 's^(2)', 's^-1', '10^{-2}', '1e-2', 's^4', 's/s', String.raw`\frac1s`, 's+t', '', '0^0', 's^s'])('rejects %s', text => { expect(() => parsePolynomial(text)).toThrow(); });
  it('limits length, nesting, zero denominator and intermediate work', () => {
    for (const text of ['1'.repeat(401), '('.repeat(14) + 's' + ')'.repeat(14), String.raw`\frac10`, '1000000000s*2']) expect(() => parsePolynomial(text)).toThrow();
  });
});
describe('exact polynomial identities and certified real-root counts', () => {
  it('retains multiplicity and common factors', () => {
    const p = parsePolynomial('(s+1)^2(s+2)'); expect(gcd(p, derivative(p)).map(exactText)).toEqual(['1', '1']);
    expect(quotient(p, parsePolynomial('s+1')).map(exactText)).toEqual(['2', '3', '1']);
    expect(() => quotient(p, parsePolynomial('s+3'))).toThrow(/identity/);
  });
  it('isolates all distinct real roots of a fourth-degree stationary equation', () => {
    const p = product(parsePolynomial('(s+1)(s+2)'), parsePolynomial('(s-3)(s-4)'));
    const actual = realZeros(p); expect(actual).toHaveLength(4); actual.forEach((root, i) => expect(root.value).toBeCloseTo([-2, -1, 3, 4][i], 10));
    for (const root of actual) expect(toNumber(root.lower)).toBeLessThanOrEqual(root.value);
  });
  it('deduplicates repeated real roots and excludes nonreal roots', () => {
    expect(realZeros(parsePolynomial('(s+1)^2(s-2)')).map(p => p.value)).toEqual([-1, 2]);
    expect(realZeros(parsePolynomial('s^2+1'))).toEqual([]); expect(() => realZeros([rational(0n)])).toThrow(/family/);
  });
});
describe('independent numerical root fixtures', () => {
  it('recovers the accepted baseline poles', () => rootNear('s(s+2)(s+5)', [[-5, 0, 1], [-2, 0, 1], [0, 0, 1]]));
  it('recovers independently factored real/conjugate/repeated roots', () => {
    rootNear('(s+7)(s^2+10)', [[-7, 0, 1], [0, Math.sqrt(10), 1], [0, -Math.sqrt(10), 1]]);
    rootNear('(s+2)(s^2+2s+5)', [[-2, 0, 1], [-1, 2, 1], [-1, -2, 1]]);
    rootNear('(s+1)^3', [[-1, 0, 3]]); rootNear('(s-2)^2(s+3)', [[-3, 0, 1], [2, 0, 2]]);
    rootNear('s^3+1', [[-1, 0, 1], [.5, Math.sqrt(3) / 2, 1], [.5, -Math.sqrt(3) / 2, 1]]);
  });
  it('preserves a tiny nonzero root without quadratic cancellation', () => {
    const p = roots(parsePolynomial('s^2+s+0.000000000000000001')); expect(p[1].re / -1e-18).toBeCloseTo(1, 12);
  });
  it('returns uncertainty for distinct roots closer than the supported separation', () => {
    expect(() => roots(parsePolynomial('(s+1)(s+1.00000001)(s+2)'))).toThrow(/too close|residual|reconstruction/);
  });
  it('checks both characteristic residuals and multiplicity of a changed fixture', () => {
    const p = parsePolynomial('(s+2)^2(s+4)'), values = expandRoots(roots(p)); expect(values).toHaveLength(3);
    values.forEach(point => expect(residual(p, point)).toBeLessThan(1e-12));
  });
});
describe('actual parameter normalization and full-model point check', () => {
  it('gives the independent K=70 factorization', () => {
    expect(characteristic(baseline(), rational(70n)).map(exactText)).toEqual(['70', '10', '7', '1']);
    const check = candidate(baseline(), c(0, Math.sqrt(10)), rational(70n)); expect(check.onPositiveLocus).toBe(true); expect(check.magnitudeGain).toBeCloseTo(70, 10); expect(check.selectedResidual).toBeLessThan(1e-14);
    expect(candidate(baseline(), c(1, 1), rational(70n)).onPositiveLocus).toBe(false);
  });
  it('keeps Ki fixed and constructs a different Kp locus', () => {
    const model = parseModel('1', 's(s+2)', 'pi', '2.7');
    expect(model.denominator.map(exactText)).toEqual(['27/10', '0', '2', '1']); expect(model.numerator.map(exactText)).toEqual(['0', '1']);
    expect(characteristic(model, rational(27n, 20n)).map(exactText)).toEqual(['27/10', '27/20', '2', '1']);
    const points = expandRoots(roots(characteristic(model, rational(27n, 20n)))); expect(points.some(p => Math.abs(p.re + 2) < 1e-10)).toBe(true);
    expect(candidate(model, c(0, Math.sqrt(27 / 20)), rational(27n, 20n)).onPositiveLocus).toBe(true);
  });
  it('retains a cancelled unstable fixed mode in the full Q', () => {
    const model = parseModel('s-1', '(s-1)(s+2)'); expect(model.fixed).toMatchObject([{ re: 1, im: 0, multiplicity: 1 }]);
    expect(characteristic(model, rational(3n)).map(exactText)).toEqual(['-5', '4', '1']);
    expect(candidate(model, c(1), rational(3n)).kind).toBe('fixed'); expect(candidate(model, c(-2), rational(3n)).kind).toBe('pole');
    expect(candidate(parseModel('s+1', '(s+2)(s+3)'), c(-1), rational(1n)).kind).toBe('zero');
  });
  it('normalizes two negative leading signs consistently', () => {
    expect(parseModel('-1', '-s(s+2)(s+5)').denominator.map(exactText)).toEqual(baseline().denominator.map(exactText));
  });
  it.each([['0', 's+1'], ['1', '0'], ['s+1', 's+1'], ['-1', 's+1'], ['1', '0.000000000001s+1'], ['1', 's+1001']])('rejects unsupported model %s/%s', (n, d) => expect(() => parseModel(n, d)).toThrow());
  it('bounds native gain and candidate inputs separately', () => {
    expect(exactText(gainValue('1e-2'))).toBe('1/100'); expect(exactText(gainValue('0e-999'))).toBe('0');
    for (const value of ['-1', '1001', '1e-999']) expect(() => gainValue(value)).toThrow();
    expect(() => candidate(baseline(), c(NaN), decimal('1'))).toThrow(); expect(() => candidate(baseline(), c(101), decimal('1'))).toThrow();
  });
});
