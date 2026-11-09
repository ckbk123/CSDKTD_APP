import { describe, expect, it } from 'vitest';
import { analyze, parseModel } from './math';
import { baselineFamily, familyModel, familyPreset, moveHandle } from './families';
import { sampleTraces } from './traces';

describe('CS01 bounded cached analytic traces', () => {
  it('samples the independently solved baseline IVP and regular impulse without altering the roots', () => {
    const model = familyModel(baselineFamily()), analysis = analyze(model), result = sampleTraces(model, analysis, [1, 0], 6), t = result.times.at(-1)!;
    expect(result.times).toHaveLength(241); expect(result.free.curves[0].values.at(-1)).toBeCloseTo(2 * Math.exp(-t) - Math.exp(-2 * t), 14); expect(result.free.curves[1].values.at(-1)).toBeCloseTo(-2 * Math.exp(-t) + 2 * Math.exp(-2 * t), 14); expect(result.impulse.curves[0].values.at(-1)).toBeCloseTo(Math.exp(-t) - Math.exp(-2 * t), 14); expect(analysis.eigenvalues.map(root => root.re).sort((a, b) => a - b)).toEqual([-2, -1]);
  });
  it('retains a valid reduced channel trace when an original hidden mode exceeds the unchanged growth screen', () => {
    const model = familyModel(moveHandle(familyPreset('hidden').family, 'first', 100, 0)), analysis = analyze(model), result = sampleTraces(model, analysis, [1, 1], 6);
    expect(result.free.error).toContain('exp(40)'); expect(result.free.curves).toHaveLength(0); expect(analysis.freeClass).toBe('unstable'); expect(analysis.bibo).toBe(true); expect(result.impulse.error).toBeUndefined(); expect(result.impulse.curves[0].values.at(-1)).toBe(Math.exp(-12));
  });
  it('keeps both semisimple and generalized Jordan behavior in its original state basis', () => {
    const model = familyModel(familyPreset('repeated', true).family), analysis = analyze(model), result = sampleTraces(model, analysis, [0, 1], 3);
    expect(result.free.curves[0].values.at(-1)).toBe(3); expect(result.free.curves[1].values.at(-1)).toBe(1); expect(result.modes[0].ordinary.curves[0].values.at(-1)).toBe(1); expect(result.modes[0].generalized.curves[0].values.at(-1)).toBe(3);
  });
  it('retains exact classification when the original oscillation display budget is exceeded', () => {
    const model = parseModel('\\begin{bmatrix}0&100\\\\-100&0\\end{bmatrix}', '\\begin{bmatrix}0\\\\1\\end{bmatrix}', '\\begin{bmatrix}1&0\\end{bmatrix}', '0'), analysis = analyze(model), result = sampleTraces(model, analysis, [1, 0], 30);
    expect(analysis.freeClass).toBe('bounded, not asymptotic'); expect(analysis.bibo).toBe(false); expect(result.times).toHaveLength(0); expect(result.free.error).toContain('2,049'); expect(result.modes).toHaveLength(2);
  });
});
