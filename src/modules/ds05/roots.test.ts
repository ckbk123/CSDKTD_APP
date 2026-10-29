import { describe, expect, it } from 'vitest';
import { countRoots } from './roots';
import { parsePolynomial } from './parser';
import { commonFactor, makeModel, modelFromText } from './model';
import { decimal, exactText, ONE, rational, ZERO } from './rational';

const count = (p: string) => { const r = countRoots(parsePolynomial(p)); return [r.inside, r.outside, r.boundary]; };
describe('exact retained polynomial root accounting', () => {
  it.each([
    ['1', [0, 0, 0]], ['z', [1, 0, 0]], ['z-.3', [1, 0, 0]], ['z+1.2', [0, 1, 0]], ['z-1', [0, 0, 1]], ['z+1', [0, 0, 1]],
    ['(z-.2)(z-1.2)', [1, 1, 0]], ['(z+2)(z-3)', [0, 2, 0]], ['(z-.5)^2', [2, 0, 0]],
    ['(z-1)^2', [0, 0, 2]], ['(z+1)^2', [0, 0, 2]], ['z^2-1', [0, 0, 2]], ['z(z-1)', [1, 0, 1]],
    ['z^2+.5', [2, 0, 0]], ['z^2+1', [0, 0, 2]], ['z^2+2', [0, 2, 0]],
    ['z^2-1.2z+1', [0, 0, 2]], ['z^2-1.2z+.64', [2, 0, 0]],
    ['z^2+z-1', [1, 1, 0]], ['z^2-z-1', [1, 1, 0]],
  ] as const)('%s has the independently factored inside/outside/boundary counts', (p, expected) => expect(count(p)).toEqual(expected));
  it('uses exact root inequalities even when the floating root rounds to one', () => {
    const tiny = rational(1n, 10n ** 40n);
    const r = countRoots([rational(-1n), rational(1n + tiny.d, tiny.d)]);
    expect(r.roots[0].re).toBe(1); expect(r.inside).toBe(1); expect(r.boundary).toBe(0); expect(r.roots[0].nearCircle).toBe(true);
    const complex = countRoots([rational(tiny.d + 1n, tiny.d), ZERO, ONE]);
    expect(complex.outside).toBe(2); expect(complex.boundary).toBe(0);
  });
  it('evaluates small real roots without cancellation', () => {
    const r = countRoots([ONE, rational(-100000000000000000000n), ONE]);
    expect(r.roots[0].re).toBe(1e20); expect(r.roots[1].re).toBe(1e-20);
    expect([r.inside, r.outside]).toEqual([1, 1]);
  });
  it('keeps repeated root multiplicity and sign-scaled polynomials', () => {
    const r = countRoots(parsePolynomial('-2(z+.5)^2'));
    expect(r.roots).toHaveLength(1); expect(r.roots[0].multiplicity).toBe(2); expect(r.inside).toBe(2);
  });
  it('rejects a zero polynomial and unsupported degree', () => {
    expect(() => countRoots([ZERO])).toThrow(/zero polynomial/);
    expect(() => countRoots([ONE, ONE, ONE, ONE])).toThrow(/at most two/);
  });
});
describe('well-posed negative-feedback retained model', () => {
  it('derives the baseline characteristic and counts from exact inputs', () => {
    const m = modelFromText();
    expect(m.closed.map(exactText)).toEqual(['-3/10', '1']);
    expect([m.openRoots.inside, m.openRoots.outside, m.closedRoots.inside, m.closedRoots.outside]).toEqual([1, 0, 1, 0]);
  });
  it('allows stabilization of an initially outside pole', () => {
    const m = modelFromText('.5', 'z-1.2');
    expect(m.closed.map(exactText)).toEqual(['-7/10', '1']);
    expect([m.openRoots.outside, m.closedRoots.outside]).toEqual([1, 0]);
  });
  it('preserves an unstable common factor and zero-gain retained modes', () => {
    const m = modelFromText('.5(z-1.2)', '(z-1.2)(z-.2)');
    expect(m.closed.map(exactText)).toEqual(['-9/25', '-9/10', '1']);
    expect(m.common.map(exactText)).toEqual(['-6/5', '1']);
    expect([m.openRoots.outside, m.closedRoots.outside, m.cancelledRoots.outside]).toEqual([1, 1, 1]);
    const zero = modelFromText('1', 'z-1.2', ZERO);
    expect(zero.common).toEqual(zero.denominator); expect(zero.closedRoots.outside).toBe(1);
  });
  it('normalizes negative leading scales without changing the loop gain', () => {
    const a = modelFromText('-.5', '-z+.8'), b = modelFromText();
    expect(a.closed).toEqual(b.closed); expect(a.numerator).toEqual(b.numerator);
  });
  it('supports a nonsingular direct path but rejects degree loss from an algebraic loop', () => {
    const m = modelFromText('z', 'z-.8');
    expect(exactText(m.direct)).toBe('1'); expect(exactText(m.wellPosed)).toBe('2');
    expect(m.closedRoots.roots[0].re).toBeCloseTo(.4, 14);
    expect(() => modelFromText('-z', 'z-.8')).toThrow(/direct feedback loop is singular/);
    expect(() => modelFromText('-1', '1')).toThrow(/singular/);
    expect(modelFromText('2', '1').closedRoots.degree).toBe(0);
  });
  it('keeps denominator/characteristic boundary cases distinct', () => {
    expect(modelFromText('.5', 'z-1').openRoots.boundary).toBe(1);
    expect(modelFromText('1.8').closedRoots.boundary).toBe(1);
    expect(modelFromText('0', 'z^2+1').openRoots.boundary).toBe(2);
  });
  it('reduces exact common factors independently of coefficient scale', () => {
    expect(commonFactor(parsePolynomial('2(z-.5)^2'), parsePolynomial('3(z-.5)')).map(exactText)).toEqual(['-1/2', '1']);
    expect(commonFactor(parsePolynomial('z^2+1'), parsePolynomial('z+.5')).map(exactText)).toEqual(['1']);
  });
  it('bounds improper, zero, excessive coefficient, resolution, gain and period inputs', () => {
    for (const [n, d] of [['z^2', 'z+1'], ['1', '0'], ['21', 'z+1'], ['1', 'z+21']]) expect(() => modelFromText(n, d)).toThrow();
    expect(() => makeModel([rational(1n, 1000000001n)], [ONE, ONE])).toThrow(/denominator budget/);
    expect(() => modelFromText('1', 'z+1', decimal('11'))).toThrow();
    expect(() => modelFromText('1', 'z+1', ONE, ZERO)).toThrow();
  });
});
