import { describe, expect, it } from 'vitest';
import { analyze, argumentBound, compose, counts, winding } from './criterion';
import { parsePolynomial as p } from './expression';
import { numeric, rat } from './exact';
import { construct } from './nyquist';
const loop = (n = '1', d = '(s+1)(s+2)', c = 4, h = 1) => compose(p(n, true), p(d), rat(c * 100, 100), rat(h * 100, 100));
describe('exact pole counts including exceptional Routh rows', () => {
  it.each([
    ['(s-1)(s-2)(s-3)', 3, 0], ['(s+1)(s+2)(s+3)', 0, 0], ['s^3+1', 2, 0], ['s^3-1', 1, 0],
    ['s^3+2s^2+3s+6', 0, 2], ['s^3-2s^2+3s-6', 1, 2], ['s^3+2s^2-3s-6', 1, 0], ['s^3-2s^2-3s+6', 2, 0],
    ['s^3', 0, 3], ['s(s^2+4)', 0, 3], ['s(s^2-4)', 1, 1], ['s^2(s-2)', 1, 2], ['s^2+4', 0, 2], ['s^2-4', 1, 0],
    ['(s-1)^3', 3, 0], ['(s+1)^3', 0, 0], ['-2(s-1)(s+2)', 1, 0], ['1', 0, 0], ['s+1', 0, 0], ['s-1', 1, 0],
  ])('%s counts multiplicity with axis roots separate', (poly, rhp, axis) => expect(counts(p(poly))).toEqual({ rhp, axis }));
});
describe('full oriented Nyquist criterion', () => {
  it('checks the independent default polynomial s²+3s+6 and roots', () => {
    const m = loop(), a = analyze(m, 20, .05);
    expect(m.characteristic.map(numeric)).toEqual([6, 3, 1]);
    for (const z of m.closedRoots) { expect(z.re).toBeCloseTo(-1.5, 12); expect(Math.abs(z.im)).toBeCloseTo(Math.sqrt(15) / 2, 12); }
    expect(a.kind).toBe('stable'); if ('winding' in a) { expect(a.winding.n).toBe(0); expect(a.z).toBe(0); expect(a.winding.maxBound).toBeLessThan(Math.PI / 3); }
  });
  it.each([
    ['one RHP pole stabilized', '1', 's-1', 2, 1, 1, 1, 0],
    ['no encirclement insufficient', '1', 's-1', .5, 1, 1, 0, 1],
    ['sensor must be included', '1', 's-1', 1.5, .5, 1, 0, 1],
    ['clockwise negative winding', '1', 's+1', -2, 1, 0, -1, 1],
    ['proper feedthrough stable', 's+2', 's+1', 2, 1, 0, 0, 0],
    ['negative feedthrough and RHP feedback zero', 's-2', 's+1', -2, 1, 0, -1, 1],
    ['two RHP poles stabilized', 's+10', '(s-1)(s-2)', 5, 1, 2, 2, 0],
    ['three CCW turns', 's^2+5s+10', '(s-1)(s-2)(s-3)', 10, 1, 3, 3, 0],
    ['three CW turns with numerator axis zeros', '1.2(s^2+1)', '(s+1)(s+2)(s+3)', -10, 1, 0, -3, 3],
    ['one CCW is insufficient for two poles', '1', '(s-1)(s-2)', -4, 1, 2, 1, 1],
    ['repeated RHP pole multiplicity', 's+4', '(s-1)^2', 4, 1, 2, 2, 0],
    ['origin indent', '1', 's', 1, 1, 0, 0, 0],
    ['double origin indent', 's+1', 's^2', 1, 1, 0, 0, 0],
    ['triple origin indent', '1', 's^3', 1, 1, 0, -2, 2],
    ['nonzero axis pair indents', '1', '(s^2+1)(s+2)', 4, 1, 0, -2, 2],
  ])('%s', (_, n, d, c, h, P, N, Z) => {
    const m = loop(n, d, c, h), a = analyze(m, 30, .05);
    expect(a.kind, 'message' in a ? a.message : '').toBe(Z ? 'unstable' : 'stable');
    if ('winding' in a) { expect(m.open.rhp).toBe(P); expect(a.winding.n).toBe(N); expect(a.confirmation.n).toBe(N); expect(a.z).toBe(Z); expect(a.winding.points.at(-1)!.source).toEqual(a.winding.points[0].source); }
  });
  it('changes the nonunit sensor conclusion rather than omitting H', () => {
    expect(analyze(loop('1', 's-1', 1.5, 1), 20, .05).kind).toBe('stable');
    const m = loop('1', 's-1', 1.5, .5); expect(m.closedRoots[0].re).toBeCloseTo(.25, 14);
    expect(analyze(m, 20, .05).kind).toBe('unstable');
  });
  it('preserves the loop and roots under equivalent negative plant scaling', () => {
    const original = loop('1', 's-1', 2), scaled = loop('-2', '-2(s-1)', 2);
    expect(scaled).toEqual(original); expect(scaled.characteristic.map(numeric)).toEqual([1, 1]); expect(scaled.closedRoots[0].re).toBe(-1);
    const a = analyze(scaled, 20, .05); expect(a.kind).toBe('stable'); if ('winding' in a) expect(a.winding.n).toBe(1);
  });
  it('places exact critical frequencies on an ordinary boundary curve', () => {
    const a = analyze(loop('1', 's^2+1', 1), 20, .05);
    expect(a.kind).toBe('boundary');
    for (const frequency of [-Math.sqrt(2), Math.sqrt(2)]) {
      const p = a.contour.points.find(p => p.source.re === 0 && p.source.im === frequency);
      expect(p).toBeDefined(); if (p?.response.kind === 'value') { expect(p.response.value.re).toBeCloseTo(-1, 12); expect(p.response.value.im).toBeCloseTo(0, 12); }
    }
  });
  it.each([['1', 's-1', 1, 1], ['1', 's^2+1', 1, 2], ['1', '(s+1)(s+2)(s+3)', 60, 2], ['1', 's^3+s+1', -1, 3]])('marks a critical hit distinct from stability', (n, d, c, axis) => {
    const controller = c === 60 ? 30 : c, numerator = c === 60 ? '2' : n;
    const m = loop(numerator, d, controller), a = analyze(m, 100, .05);
    expect(m.closed.axis).toBe(axis); expect(a.kind).toBe('boundary'); expect('winding' in a).toBe(false);
  });
  it('rejects a too-small contour and an indent that could exclude roots', () => {
    expect(analyze(loop(), 2, .05).kind).toBe('unresolved');
    const a = analyze(loop('1', 's', .05), 20, .1); expect(a.kind).toBe('unresolved'); if ('message' in a) expect(a.message).toMatch(/indent/);
  });
  it('reports finite computation limits rather than inventing a winding', () => {
    const m = loop('1', 's^3', 1), contour = construct(m.n, m.d, 20, .05);
    expect(() => winding(m, contour, 16)).toThrow(/limit/); expect(() => winding(m, contour, 1e9)).toThrow(/limit/);
  });
  it('bounds polynomial arguments even with a narrow feature hidden between coarse endpoints', () => {
    expect(argumentBound(p('s-1'), { re: 0, im: 0 }, 2)).toBe(Infinity);
    expect(argumentBound(p('s+10'), { re: 0, im: 0 }, .1)).toBeCloseTo(2 * Math.asin(.01), 9);
    const m = compose(p('1.0001'), p('s-1'), rat(1), rat(1)), a = analyze(m, 1000, .05);
    expect(a.kind, 'message' in a ? a.message : '').toBe('stable'); if ('winding' in a) expect(a.winding.n).toBe(1);
  });
  it('rejects ambiguous cancellations, improper plants, algebraic loops and invalid gains', () => {
    expect(() => loop('s-1', '(s-1)(s+2)')).toThrow(/coprime/);
    expect(() => loop('s+1', 's', -1)).toThrow(/well posed/);
    expect(() => loop('s^2+1', 's+1')).toThrow(/proper/);
    expect(() => loop('0', 's+1')).toThrow(/nonzero/);
    expect(() => loop('1', 's+1', 0)).toThrow(/controller/);
    expect(() => loop('1', 's+1', 1, -1)).toThrow(/sensor/);
  });
  it('does not retain caller state or change another contour', () => {
    const a = loop(), d = [...a.d], first = analyze(a, 20, .05);
    const other = loop('1', 's-1', 2); expect(() => winding(a, construct(other.n, other.d, 20, .05))).toThrow(/same coefficients/);
    analyze(loop('1', 's-1', 2), 20, .025); const second = analyze(a, 20, .05);
    expect(a.d).toEqual(d); expect(second).toEqual(first); expect(second).not.toBe(first);
  });
});
