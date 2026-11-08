import { describe, expect, it } from 'vitest';
import { editFactor, replaceFactor, scalarText } from './editing';
import { baseline, normalize, parseDelay, parseReal, responseAt, type Factor } from './math';

describe('CP04 bounded visible coefficient transactions', () => {
  it('moves the second corner 2→3 preserving its constant and normalization gain', () => {
    const base = baseline(), edit = editFactor(base.factors[1], 3), model = replaceFactor(base, 1, edit);
    expect(edit.a1).toBe('2/3'); expect(parseReal(edit.a1)).toBe(model.factors[1].a1);
    expect(model.factors[1].a0).toBe(2); expect(model.gain).toBe(1); expect(normalize(model).gain).toBe(.5);
    // 1 / [(1+j)(2+2j/3)]; this differs from changing the raw constant 2→3.
    expect(responseAt(model, 1).magnitude).toBeCloseTo(3 / Math.sqrt(80), 13);
    expect(responseAt(model, 1).phase).toBeCloseTo(-63.43494882292201, 11);
    expect(base.factors[1].a1).toBe(1);
  });
  it('retains quadratic damping and constant while moving natural frequency', () => {
    const f: Factor = { kind: 'second', position: 'pole', a0: 4, a1: 1, a2: 1 }, edit = editFactor(f, 3);
    expect(edit.a1).toBe('2/3'); expect(edit.a2).toBe('4/9'); expect(edit.damping).toBeCloseTo(.25, 14);
    const model = { gain: 1, originPower: 0, delay: 0, factors: [edit.factor] };
    expect(normalize(model).gain).toBe(.25); expect(responseAt(model, 3).magnitude).toBeCloseTo(.5, 13); expect(responseAt(model, 3).phase).toBeCloseTo(-90, 12);
    const damped = editFactor(f, 2, .5); expect(damped.factor).toEqual({ ...f, a1: 2 });
    expect(responseAt({ ...model, factors: [damped.factor] }, 2).magnitude).toBeCloseTo(.25, 14);
  });
  it.each(['pole', 'zero'] as const)('preserves first-order RHP sign for a %s', position => {
    const f: Factor = { kind: 'first', position, a0: 7, a1: -2, a2: 0 }, edit = editFactor(f, 5);
    expect(edit.factor.a0).toBe(7); expect(edit.factor.a1).toBe(-1.4); expect(edit.actualCorner).toBe(5);
    const at = responseAt({ gain: -2, originPower: 0, delay: .5, factors: [edit.factor] }, 5);
    expect(at.phase).toBeCloseTo(180 + (position === 'zero' ? -45 : 45) - 2.5 * 180 / Math.PI, 11);
  });
  it.each([1e-6, .000010003, 2 / 3, 4 / 9, Math.PI, -999999.99, 1e6])('publishes a reparsable bounded scalar for %s', value => {
    const text = scalarText(value); expect(parseReal(text)).toBeCloseTo(value, Math.abs(value) < .001 ? 16 : 8);
    expect(text).not.toMatch(/[eE]/);
  });
  it('keeps small explicit delays separate from the coefficient floor', () => {
    expect(parseDelay(scalarText(1e-9, true))).toBe(1e-9); expect(() => scalarText(1e-9)).toThrow('bounds');
  });
  it('rejects unsupported derived coefficients atomically instead of clamping', () => {
    const f: Factor = { kind: 'first', position: 'pole', a0: 1e-6, a1: 1e-6, a2: 0 };
    expect(() => editFactor(f, 2)).toThrow('bounds'); expect(f.a1).toBe(1e-6);
    expect(() => editFactor({ ...f, a0: 1e6, a1: 1e6 }, .5)).toThrow('bounds');
    expect(() => editFactor(baseline().factors[0], 1e5)).toThrow('Frequency');
    expect(() => editFactor({ kind: 'second', position: 'pole', a0: 4, a1: 1, a2: 1 }, 2, .01)).toThrow('Damping');
  });
});
