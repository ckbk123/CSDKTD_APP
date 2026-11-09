import { describe, expect, it } from 'vitest';
import { analyze, impulseAt, num, stateAt, textRat } from './math';
import { baselineFamily, familyModel, familyPreset, handles, modelLatex, moveHandle } from './families';

describe('CS01 explicit family realizations through the original solver', () => {
  it('preserves the actual canonical baseline and an independently solved initial-value response', () => {
    const model = familyModel(baselineFamily()), result = analyze(model); expect(model.a.map(row => row.map(num))).toEqual([[0, 1], [-2, -3]]); expect(result.numerator.map(textRat)).toEqual(['1']);
    expect(result.denominator.map(textRat)).toEqual(['2', '3', '1']); const t = .7; expect(stateAt(model, [1, 0], t)).toEqual([2 * Math.exp(-t) - Math.exp(-2 * t), -2 * Math.exp(-t) + 2 * Math.exp(-2 * t)]);
  });
  it('moves either real pole without inventing a different numerator', () => {
    const family = moveHandle(baselineFamily(), 'first', -3, 0), model = familyModel(family); expect(model.a.map(row => row.map(num))).toEqual([[0, 1], [-6, -5]]); expect(analyze(model).denominator.map(textRat)).toEqual(['6', '5', '1']); expect(analyze(model).numerator.map(textRat)).toEqual(['1']);
  });
  it('preserves the conjugate oscillator and its real free response', () => {
    const { family } = familyPreset('canonical', true), model = familyModel(family), result = analyze(model); expect(result.freeClass).toBe('bounded, not asymptotic'); expect(result.bibo).toBe(false); expect(stateAt(model, [1, 0], .5)).toEqual([Math.cos(1), -2 * Math.sin(1)]); expect(impulseAt(result, .5)).toBeCloseTo(Math.sin(1) / 2, 14);
    expect(moveHandle(family, 'lower', -.5, -3)).toMatchObject({ first: -.5, second: 3 }); expect(() => moveHandle(family, 'lower', 0, 1)).toThrow('labelled side');
  });
  it('keeps the hidden unstable mode while its scalar channel remains exactly unchanged', () => {
    const { family } = familyPreset('hidden'), first = analyze(familyModel(family)), moved = familyModel(moveHandle(family, 'first', 2, 0)), result = analyze(moved); expect(first.freeClass).toBe('unstable'); expect(result.freeClass).toBe('unstable'); expect(result.bibo).toBe(true); expect(result.reducedDenominator.map(textRat)).toEqual(['2', '1']); expect(first.reducedDenominator.map(textRat)).toEqual(result.reducedDenominator.map(textRat)); expect(stateAt(moved, [1, 1], 1)).toEqual([Math.exp(2), Math.exp(-2)]); expect(impulseAt(result, 1)).toBe(Math.exp(-2));
  });
  it('distinguishes repeated semisimple and Jordan zeros without a multiplicity shortcut', () => {
    const semi = familyModel(familyPreset('repeated').family), jordan = familyModel(familyPreset('repeated', true).family); expect(analyze(semi).freeClass).toBe('bounded, not asymptotic'); expect(analyze(jordan).freeClass).toBe('unstable'); expect(stateAt(semi, [1, 1], 3)).toEqual([1, 1]); expect(stateAt(jordan, [0, 1], 3)).toEqual([3, 1]); expect(handles(familyPreset('repeated').family)).toHaveLength(1); expect(analyze(semi).eigenvalues[0].multiplicity).toBe(2);
  });
  it('rejects unrepresentable editing positions rather than shrinking arbitrary-matrix support', () => {
    expect(() => familyModel({ ...baselineFamily(), first: 10, second: -11 })).toThrow('matrix-entry limits'); expect(() => familyModel({ ...familyPreset('canonical', true).family, first: 8, second: 8 })).toThrow('matrix-entry limits'); expect(() => moveHandle(baselineFamily(), 'first', -.333, 0)).toThrow('0.01 grid'); expect(() => moveHandle(baselineFamily(), 'first', 101, 0)).toThrow('between');
    expect(modelLatex(familyModel({ ...baselineFamily(), first: -.33, second: -2 }))[0]).toContain('\\frac{33}{50}');
  });
});
