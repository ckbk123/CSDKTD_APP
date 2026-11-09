import { describe, expect, it } from 'vitest';
import { parseTransfer } from './input';
import { buildResponse } from './response';
import { decimalCoefficient, draggedPair, editedPair, pairEquation } from './parameters';
describe('CF01 presentation-only pair edits', () => {
  it('preserves the independently known DC gain and round-trips actual coefficient digits', () => {
    const next = editedPair({ g: 4, a1: 2, a0: 4 }, .7, 3);
    expect(next.model).toEqual({ g: 9, a1: 2 * .7 * 3, a0: 9 });
    expect(parseTransfer(next.latex)).toEqual(next.model);
    expect(buildResponse(next.model).finalValue).toBe(1);
    const nonunit = editedPair({ g: 10, a1: 3, a0: 2 }, .3, 2);
    expect(nonunit.model.g).toBe(20); expect(nonunit.model.a0).toBe(4);
  });
  it('moves a conjugate pair using its actual geometry and retains critical/overdamped numeric paths', () => {
    const next = draggedPair({ g: 4, a1: 2, a0: 4 }, -2, 3), r = buildResponse(next.model);
    expect(r.poles[0].re).toBeCloseTo(-2, 12); expect(r.poles[0].im).toBeCloseTo(3, 12);
    expect(buildResponse(editedPair(next.model, 1, 1).model).poles).toEqual([{ re: -1, im: 0 }, { re: -1, im: 0 }]);
    expect(buildResponse(editedPair(next.model, 3, 1).model).poles.every(p => p.im === 0)).toBe(true);
    expect(() => draggedPair(next.model, 0, 3)).toThrow('left half-plane'); expect(() => draggedPair(next.model, -1, 0)).toThrow('numeric');
  });
  it('rejects a DC-preserving edit beyond the original numerator domain without changing its source', () => {
    const base = Object.freeze({ g: 1000, a1: .1, a0: .0025 });
    expect(() => editedPair(base, .5, 20)).toThrow('Preserving the positive DC gain'); expect(base.g).toBe(1000);
    expect(() => editedPair({ g:4,a1:2,a0:4 }, .01, 2)).toThrow('damping');
  });
  it('expands native exponents without rounding them to displayed precision or changing their meaning', () => {
    for (const value of [1e-9, .0025000000000000005, .020000000000000004, 1.2345678901234567, 400]) expect(Number(decimalCoefficient(value))).toBe(value);
    const model = { g: 1e-9, a1: .002, a0: .0025 };
    expect(pairEquation(model)).not.toMatch(/[eE]/); expect(parseTransfer(pairEquation(model))).toEqual(model);
  });
});
