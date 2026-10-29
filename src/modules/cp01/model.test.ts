import { describe, expect, it } from 'vitest';
import { centeredInitial, excitation, initialState, initialTransformNumerator, makeModel, modelFromText, outputCoefficients, phaseInitial, stateMatrix } from './model';
import { decimal, exactText, ONE, rational, ZERO } from './rational';

describe('CP01 declared proper realization', () => {
  it('normalizes the baseline and preserves scaling/sign equivalence', () => {
    const baseline = modelFromText();
    expect(baseline.denominator.map(exactText)).toEqual(['2', '3', '1']);
    expect(baseline.b.map(exactText)).toEqual(['1', '0']);
    expect(baseline.behavior).toBe('stable');
    expect(modelFromText('2', '2(s+1)(s+2)').b).toEqual(baseline.b);
    expect(modelFromText('-1', '-s-1').b.map(exactText)).toEqual(['1']);
  });
  it('extracts a biproper direct term by exact long division', () => {
    const m = modelFromText('2s^2+7s+6', '(s+1)(s+2)', decimal('.5'));
    expect(m.b.map(exactText)).toEqual(['2', '1']);
    expect(exactText(m.direct)).toBe('5/2');
    expect(m.denominator.map(exactText)).toEqual(['2', '3', '1']);
  });
  it('separates zero-input terms from the zero-state transfer function', () => {
    const m = modelFromText();
    expect(initialTransformNumerator(m, [ONE, ZERO]).map(exactText)).toEqual(['3', '1']); // (s+3)/Q
    const linearN = modelFromText('s+4');
    expect(initialTransformNumerator(linearN, [ONE, ZERO]).map(exactText)).toEqual(['10', '4']);
  });
  it('maps initial coordinates exactly and retains the same realization', () => {
    const m = modelFromText('s+4'), x = [ONE, rational(-2n)];
    const z = centeredInitial(m, x);
    expect(z.map(exactText)).toEqual(['1', '-1/2']);
    expect(phaseInitial(m, z)).toEqual(x);
    const actual = stateMatrix(m, true), expected = [[-1.5, 1], [.25, -1.5]];
    actual.forEach((row, i) => row.forEach((value, j) => expect(value).toBeCloseTo(expected[i][j], 14)));
    expect(outputCoefficients(m, true).map(exactText)).toEqual(['5/2', '1']);
  });
  it.each([
    ['s+1', 'stable'], ['s', 'integrator'], ['s-1', 'unstable'],
    ['s^2', 'double-integrator'], ['s(s+2)', 'integrator'],
    ['s^2+4', 'oscillator'], ['s^2-2s+4', 'unstable'], ['s^2+s-2', 'unstable'],
  ] as const)('classifies the retained denominator %s as %s', (d, kind) => expect(modelFromText('1', d).behavior).toBe(kind));
  it('retains an exact near-repeated discriminant without calling it zero', () => {
    const m = modelFromText('1', String.raw`s^2+2s+\frac{999999999}{1000000000}`);
    expect(exactText(m.delta)).toBe('1/1000000000');
    expect(modelFromText('1', '(s+1)^2').delta.n).toBe(0n);
  });
  it.each([['1', '0'], ['1', '2'], ['s^2', 's+1'], ['51', 's+1'], ['1', 's+101'], ['1', 's^2+21s+1']])('rejects model outside the bounded family %s / %s', (n, d) => expect(() => modelFromText(n, d)).toThrow());
  it('bounds exact coefficient resolution and the combined direct gain', () => {
    expect(() => makeModel([rational(1n, 1_000_000_001n)], [ONE, ONE])).toThrow(/denominator budget/);
    expect(() => modelFromText('10s+1', 's+1', ONE)).toThrow(/Resulting direct/);
  });
  it('bounds input, pulse width and initial-state dimensions', () => {
    expect(() => excitation('step', decimal('11'))).toThrow();
    expect(() => excitation('pulse', ONE, decimal('0'))).toThrow();
    expect(() => excitation('pulse', ONE, decimal('.0001'))).toThrow();
    expect(() => initialState(modelFromText(), [ZERO])).toThrow(/2 initial/);
    expect(() => initialState(modelFromText(), [decimal('11'), ZERO])).toThrow();
    expect(() => phaseInitial(modelFromText(), [decimal('20'), ZERO])).toThrow();
  });
});
