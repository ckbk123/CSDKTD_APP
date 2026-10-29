import { describe, expect, it } from 'vitest';
import { coefficientContributions, compareRational, discriminant, expandedFactors, factorPolynomial, fromPoles, roots } from './algebra';
import { decimal, numeric, one, plus, rat, same, textR, zero } from './exact';
import { parsePolynomial as parse } from './expression';
import { convertLatexToMathMl } from 'mathlive';

const coefficients = (s: string) => parse(s).map(textR);
describe('CR01 exact algebra and independent root fixtures', () => {
  it('re-expands the proposed quartic with four independently known roots', () => {
    const p = parse('(s+1)(s+2)(s^2+4s+13)');
    expect(p.map(textR)).toEqual(['26', '47', '27', '7', '1']);
    expect(same(p, parse('s^4+7s^3+27s^2+47s+26'))).toBe(true);
    const f = factorPolynomial(p); expect(f.factors.map(x => x.polynomial.map(textR))).toEqual([['1', '1'], ['2', '1'], ['13', '4', '1']]);
    const r = roots(p, f); expect(r).toHaveLength(4);
    for (const [re, im] of [[-1, 0], [-2, 0], [-2, -3], [-2, 3]]) expect(r.some(z => Math.abs(z.re - re) < 1e-12 && Math.abs(z.im - im) < 1e-12 && z.multiplicity === 1)).toBe(true);
    expect(textR(discriminant(f.factors[2].polynomial))).toBe('-36');
    const rows = coefficientContributions(expandedFactors(f), 2);
    expect(rows.map(x => textR(x.value)).sort()).toEqual(['13', '2', '4', '8']);
    expect(textR(rows.reduce((v, x) => plus(v, x.value), zero))).toBe('27');
  });
  it('certifies a nonmonic quadratic pair and the determinant-zero search case', () => {
    for (const [expanded, factored] of [['6s^4-s^3+5s^2+2', '(2s^2+s+1)(3s^2-2s+2)'], ['s^4+3s^2+4', '(s^2+s+2)(s^2-s+2)']]) {
      const p = parse(expanded); expect(same(p, parse(factored))).toBe(true);
      expect(factorPolynomial(p).factors.map(f => f.polynomial.length)).toEqual([3, 3]);
      expect(roots(p)).toHaveLength(4);
    }
  });
  it('keeps rational scale and exact multiplicity rather than clustering roots', () => {
    const f = factorPolynomial(parse('-1.5(2s-1)^2(s+3)^2'));
    expect(textR(f.scale)).toBe('-6'); expect(f.factors.map(x => x.multiplicity)).toEqual([2, 2]);
    expect(roots(parse('-1.5(2s-1)^2(s+3)^2'))).toEqual(expect.arrayContaining([expect.objectContaining({ re: .5, im: 0, multiplicity: 2 }), expect.objectContaining({ re: -3, im: 0, multiplicity: 2 })]));
    expect(roots(parse('(s^2+1)^2')).map(z => [z.re, z.im, z.multiplicity])).toEqual([[-0, -1, 2], [-0, 1, 2]]);
    expect(roots(parse('s^4'))).toEqual([expect.objectContaining({ re: -0, im: 0, multiplicity: 4 })]);
  });
  it('checks irreducible quartic roots against the eighth roots of unity', () => {
    const p = parse('s^4+1'), f = factorPolynomial(p); expect(f.factors).toHaveLength(1);
    expect(f.factors[0].polynomial).toHaveLength(5);
    const r = roots(p, f); expect(r).toHaveLength(4);
    for (const signRe of [-1, 1]) for (const signIm of [-1, 1]) expect(r.some(z => Math.abs(z.re - signRe / Math.sqrt(2)) < 1e-10 && Math.abs(z.im - signIm / Math.sqrt(2)) < 1e-10)).toBe(true);
    expect(r.every(z => z.residual < 1e-10)).toBe(true);
  });
  it('checks irreducible cubic roots and an explicit convergence failure', () => {
    const p = parse('s^3-2'), c = Math.cbrt(2), r = roots(p); expect(r).toHaveLength(3);
    for (const [re, im] of [[c, 0], [-c / 2, c * Math.sqrt(3) / 2], [-c / 2, -c * Math.sqrt(3) / 2]]) expect(r.some(z => Math.abs(z.re - re) < 1e-10 && Math.abs(z.im - im) < 1e-10)).toBe(true);
    expect(() => roots(p, factorPolynomial(p), 1)).toThrow(/converge/);
  });
  it('handles constant polynomials, zeros and exact changed coefficient data', () => {
    expect(roots(parse('7'))).toEqual([]); expect(factorPolynomial(parse('7')).factors).toEqual([]);
    expect(coefficients('s^4+7s^3+27s^2+47s+27')).toEqual(['27', '47', '27', '7', '1']);
    const p = parse('s^4+7s^3+27s^2+47s+27'), r = roots(p); expect(r.reduce((v, z) => v + z.re, 0)).toBeCloseTo(-7, 9);
    expect(r.reduce((v, z) => v + z.multiplicity, 0)).toBe(4);
    expect(() => parse('0')).toThrow(/zero polynomial/); expect(() => parse('s^5')).toThrow(/degree/);
  });
  it('handles opposite-sign quadratic constants and rejects incomplete root lists', () => {
    const p = parse('s^4-s^2-2'), f = factorPolynomial(p); expect(f.factors.map(x => x.polynomial.length)).toEqual([3, 3]);
    const r = roots(p, f); expect(r.some(z => Math.abs(z.re - Math.sqrt(2)) < 1e-12 && z.im === 0)).toBe(true); expect(r.some(z => z.re === 0 && z.im === 1)).toBe(true);
    expect(() => roots(parse('s^2-1'), { scale: one, factors: [{ polynomial: parse('s-1'), multiplicity: 1 }] })).toThrow(/complete-coefficient/);
  });
  it('constructs the editable real/conjugate pole fixture exactly', () => {
    const p = fromPoles([{ re: rat(-1), im: zero, multiplicity: 1 }, { re: rat(-2), im: zero, multiplicity: 1 }, { re: rat(-2), im: rat(3), multiplicity: 1 }]);
    expect(p.map(textR)).toEqual(['26', '47', '27', '7', '1']);
    expect(fromPoles([{ re: decimal('-.5'), im: zero, multiplicity: 2 }], rat(2)).map(textR)).toEqual(['1/2', '2', '2']);
    expect(() => fromPoles([{ re: one, im: one, multiplicity: 3 }])).toThrow(/degree/);
    expect(() => fromPoles([{ re: one, im: rat(-1), multiplicity: 1 }])).toThrow(/nonnegative/);
  });
  it('compares rational identities and retains original excluded points', () => {
    const a = compareRational(parse('s^2-1'), parse('s-1'), parse('s+1'), parse('1'));
    expect(a.equalOnCommonDomain).toBe(true); expect(a.sameDomain).toBe(false); expect(a.exclusions1[0].re).toBe(1); expect(a.exclusions2).toEqual([]);
    expect(compareRational(parse('2'), parse('2(s+1)'), parse('1'), parse('s+1')).sameDomain).toBe(true);
    expect(compareRational(parse('1'), parse('s+1'), parse('1'), parse('s+1.001')).equalOnCommonDomain).toBe(false);
    expect(() => compareRational([one], [zero], [one], [one])).toThrow(/denominator/);
    expect(compareRational([zero], parse('s'), [zero], [one]).sameDomain).toBe(false);
  });
});

describe('CR01 displayed equation semantics and bounds', () => {
  it('independently distinguishes spacing argument atoms in the pinned editor', () => {
    expect(convertLatexToMathMl(String.raw`\frac1\;2`)).toMatch(/<mfrac>.*<mspace[^>]*\/><\/mfrac><mn>2<\/mn>/);
    expect(convertLatexToMathMl(String.raw`2^\;2`)).toMatch(/<msup>.*<mspace[^>]*\/><\/msup><mn>2<\/mn>/);
    expect(convertLatexToMathMl(String.raw`\frac1{\;2}`)).toMatch(/<mfrac>.*<mrow><mspace[^>]*\/><mn>2<\/mn><\/mrow><\/mfrac>/);
  });
  it.each([String.raw`\frac1\;2`, String.raw`\frac\,12`, String.raw`\frac1\!2`, String.raw`\frac1\ 2`, String.raw`\frac1\quad2`, String.raw`\frac1{\frac1\;2}`, String.raw`\frac\displaystyle12`])('rejects incomplete spacing-command fraction arguments%s', s => expect(() => parse(s)).toThrow(/fraction button/));
  it.each([String.raw`2^\;2`, String.raw`s^\,2`, String.raw`2^\!2`, String.raw`2^\ 2`, String.raw`2^\quad2`])('rejects a spacing-command power argument%s', s => expect(() => parse(s)).toThrow(/power button/));
  it('retains proper braced spacing controls without merging numeric tokens', () => {
    expect(coefficients(String.raw`\frac1{\;2}`)).toEqual(['1/2']); expect(coefficients(String.raw`\frac{\,1}2`)).toEqual(['1/2']);
    expect(coefficients(String.raw`\frac1{\quad2}`)).toEqual(['1/2']); expect(coefficients(String.raw`2^{\;2}`)).toEqual(['4']);
    expect(coefficients(String.raw`2^{-\;2}`)).toEqual(['1/4']); expect(coefficients(String.raw`2\;s+\,1`)).toEqual(['1', '2']);
    expect(() => parse(String.raw`2^{1\;2}`)).toThrow(/one integer/); expect(() => parse(String.raw`1\;2`)).toThrow(/Mixed/);
    expect(() => parse(String.raw`\;2\frac12`)).toThrow(/Mixed/);
  });
  it.each(['\\frac12', '\\frac{1}2', '\\frac1{2}', '\\frac{1}{2}', '\\frac{\\frac12}{2}*2'])('accepts equivalent fraction form %s', s => expect(coefficients(s)).toEqual(['1/2']));
  it.each(['-\\frac12', '\\frac{-1}{2}', '(-\\frac12)'])('preserves a negative ratio %s', s => expect(coefficients(s)).toEqual(['-1/2']));
  it.each(['2\\frac12', '-2\\frac12', '{2}\\frac12', 's2\\frac12', '\\frac{2\\frac12}{3}'])('rejects ambiguous mixed-number adjacency %s', s => expect(() => parse(s)).toThrow(/explicit|Mixed/));
  it.each(['s{+1}', '{s+1}s', '{-2}s'])('rejects hidden grouping %s', s => expect(() => parse(s)).toThrow(/visible parentheses/));
  it.each(['s^12', '2^12', 's^-2', '2^+2'])('rejects ambiguous power tokens %s', s => expect(() => parse(s)).toThrow(/power button/));
  it('preserves real powers, explicit arithmetic, visible groups and optional labels', () => {
    expect(coefficients('2^{12}')).toEqual(['4096']); expect(coefficients('2^{-2}')).toEqual(['1/4']);
    expect(coefficients('2+\\frac12')).toEqual(['5/2']); expect(coefficients('2\\times\\frac12')).toEqual(['1']);
    expect(coefficients('P(s)=s(s+1)')).toEqual(['0', '1', '1']); expect(coefficients('\\frac{s+1}{2}')).toEqual(['1/2', '1/2']);
    expect(coefficients('10^{-2}s')).toEqual(['0', '1/100']);
  });
  it.each(['', '1e-2', '\\sqrt{s}', '\\frac(1)(2)', '\\frac1(2)', '1/(s+1)', 's^{-1}', '1/0', '0^0', 's+NaN', 's^{1.2}'])('rejects malformed/unsupported form %s', s => expect(() => parse(s)).toThrow());
  it('bounds notation, exact height and arithmetic without underflowing nonzero data', () => {
    expect(() => parse('s+'.repeat(400))).toThrow(/600/);
    expect(() => parse('s+0.000001')).toThrow(/10,000/);
    expect(() => parse('10^{-14}*10^{-14}*10^{-14}')).toThrow(/30-digit/);
    expect(numeric(decimal('1e-2', true))).toBe(.01); expect(textR(decimal('0e-999', true))).toBe('0');
    expect(() => decimal('1e-999', true)).toThrow(/scales/);
  });
});
