import { describe, expect, it } from 'vitest';
import { evaluateTerms, exactRoot, forcedTerms, freeTerms, inputTransform, polynomial, termsLatex, unitTerms } from './analytic';
import { excitation, modelFromText } from './model';
import { decimal, rational, ZERO } from './rational';

describe('exact computed response terms with independent inverses', () => {
  const fixtures: [string, string, 'step' | 'ramp' | 'impulse', (t: number) => number][] = [
    ['1', '(s+1)(s+2)', 'step', t => .5 - Math.exp(-t) + .5 * Math.exp(-2 * t)],
    ['1', '(s+1)(s+2)', 'ramp', t => .5 * t - .75 + Math.exp(-t) - .25 * Math.exp(-2 * t)],
    ['1', '(s+1)(s+2)', 'impulse', t => Math.exp(-t) - Math.exp(-2 * t)],
    ['2', '(s+1)(s+3)', 'step', t => 2 / 3 - Math.exp(-t) + Math.exp(-3 * t) / 3],
    ['s+4', '(s+1)(s+2)', 'impulse', t => 3 * Math.exp(-t) - 2 * Math.exp(-2 * t)],
    ['s+4', '(s+1)(s+2)', 'step', t => 2 - 3 * Math.exp(-t) + Math.exp(-2 * t)],
    ['2s^2+7s+6', '(s+1)(s+2)', 'step', t => 3 - Math.exp(-t)],
    ['1', '(s+1)^2', 'step', t => 1 - (1 + t) * Math.exp(-t)],
    ['1', '(s+1)^2', 'ramp', t => t - 2 + (t + 2) * Math.exp(-t)],
    ['1', '(s+1)^2', 'impulse', t => t * Math.exp(-t)],
    ['1', 's^2+2s+5', 'step', t => (1 - Math.exp(-t) * (Math.cos(2 * t) + .5 * Math.sin(2 * t))) / 5],
    ['1', 's^2+2s+5', 'impulse', t => .5 * Math.exp(-t) * Math.sin(2 * t)],
    ['4', 's^2+4', 'step', t => 1 - Math.cos(2 * t)],
    ['1', 's+2', 'ramp', t => .5 * t - .25 + .25 * Math.exp(-2 * t)],
    ['1', 's', 'step', t => t],
    ['1', 's', 'ramp', t => t * t / 2],
    ['1', 's', 'impulse', () => 1],
    ['1', 's^2', 'step', t => t * t / 2],
    ['1', 's^2', 'ramp', t => t ** 3 / 6],
    ['s+1', 's^2', 'step', t => t + t * t / 2],
    ['s+1', 's^2', 'ramp', t => t * t / 2 + t ** 3 / 6],
    ['1', 's(s+2)', 'step', t => .5 * t - (1 - Math.exp(-2 * t)) / 4],
    ['1', 's(s+2)', 'ramp', t => t * t / 4 - t / 4 + (1 - Math.exp(-2 * t)) / 8],
    ['1', 's-1', 'step', t => Math.exp(t) - 1],
  ];
  it.each(fixtures)('%s / %s — %s', (n, d, kind, oracle) => {
    const terms = unitTerms(modelFromText(n, d), kind);
    for (const t of [0, .01, .3, 1, 2.2]) expect(evaluateTerms(terms, t)).toBeCloseTo(oracle(t), 11);
  });
  it('baseline display contains exact residues', () => {
    expect(termsLatex(unitTerms(modelFromText(), 'step'))).toBe('\\frac{1}{2}-e^{-t}+\\frac{1}{2}e^{-2t}');
    expect(termsLatex(unitTerms(modelFromText('1', '(s+1)^2'), 'impulse'))).toBe('e^{-t}\\left(t\\right)');
  });
  it('free phase state uses the correct output mapping and is independent of input', () => {
    const m = modelFromText('s+4'), e = freeTerms(m, [decimal('1'), ZERO]);
    for (const t of [0, .2, 1]) expect(evaluateTerms(e, t)).toBeCloseTo(6 * Math.exp(-t) - 2 * Math.exp(-2 * t), 12);
    const integrator = freeTerms(modelFromText('1', 's(s+2)'), [decimal('1'), decimal('2')]);
    expect(evaluateTerms(integrator, 1)).toBeCloseTo(2 - Math.exp(-2), 12);
    expect(termsLatex(freeTerms(modelFromText('1', 's^2'), [decimal('2'), decimal('3')]))).toBe('3t+2');
  });
  it('pulse is a delayed difference of full step, including direct jumps', () => {
    const m = modelFromText('1', 's+1', decimal('3')), input = excitation('pulse', decimal('2'), decimal('.5'));
    const e = forcedTerms(m, input);
    expect(evaluateTerms(e, 0)).toBe(12);
    expect(evaluateTerms(e, .5) - evaluateTerms(e, 0)).toBeCloseTo(4 * (1 - Math.exp(-.5)), 12);
    expect(evaluateTerms(e, 1) - evaluateTerms(e, .5)).toBeCloseTo(4 * (1 - Math.exp(-.5)) * Math.exp(-.5), 12);
    expect(inputTransform(input)).toContain('1-e^{-\\frac{1}{2}s}');
  });
  it('free/zero and direct ramp are represented exactly', () => {
    const m = modelFromText('0', 's+1', decimal('2'));
    expect(termsLatex(forcedTerms(m, excitation('free')))).toBe('0');
    expect(termsLatex(unitTerms(m, 'impulse'))).toBe('0');
    expect(termsLatex(unitTerms(m, 'ramp'))).toBe('2t');
    expect(inputTransform(excitation('impulse', decimal('3')))).toBe('3');
  });
  it('irrational/near-coincident roots retain an exact basis', () => {
    const e = unitTerms(modelFromText('1', 's^2+3s+1'), 'step');
    expect(termsLatex(e)).toContain('\\sqrt{\\frac{5}{4}}');
    expect(termsLatex(e)).toContain('\\cosh');
    const near = unitTerms(modelFromText('1', 's^2+2s+1.000000001'), 'impulse');
    expect(termsLatex(near)).toContain('\\sin');
    expect(evaluateTerms(near, 1)).toBeCloseTo(Math.exp(-1), 9);
    expect(exactRoot(rational(81n, 16n))).toEqual(rational(9n, 4n));
    expect(exactRoot(rational(2n))).toBeUndefined();
    expect(exactRoot(rational(-1n))).toBeUndefined();
  });
  it('places a negative sine/sinh coefficient on an additive term, not an adjacent product', () => {
    const oscillatory = termsLatex(unitTerms(modelFromText('1', 's^2+2s+5'), 'step'));
    // Independently: y=(1-exp(-t)[cos(2t)+sin(2t)/2])/5.
    expect(oscillatory).toContain('\\cos\\left(2t\\right)-\\frac{\\frac{1}{5}}{2}\\sin');
    const real = termsLatex(unitTerms(modelFromText('1', 's^2+3s+1'), 'step'));
    // Negative cosh and negative sinh terms must be a sum with an outer minus.
    expect(real).toContain('\\cosh\\left(\\sqrt{\\frac{5}{4}}t\\right)-\\frac{\\frac{3}{2}}');
    expect(real).not.toContain('\\frac{-');
  });
  it('polynomials declare descending visible order independently of storage', () => {
    expect(polynomial([decimal('1'), decimal('-2'), decimal('.5')])).toBe('\\frac{1}{2}s^{2}-2s+1');
    expect(polynomial([ZERO])).toBe('0');
  });
});
