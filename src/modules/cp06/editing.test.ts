import { describe, expect, it } from 'vitest';
import { addFactor, additionLimit, editableFactors, moveFactor, removeFactor, snapCoordinate } from './editing';
import { polynomial } from './format';
import { baseline, characteristic, gainValue, parseModel } from './model';
import { degree } from './polynomial';
import { roots } from './roots';

describe('bounded full-plant pole and zero editing', () => {
  it('moves the origin pole while preserving the other exact factors', () => {
    const original = baseline(), edited = moveFactor(original, 'pole-2', -1, 0);
    // (s+1)(s+2)(s+5) = s³+8s²+17s+10.
    expect(polynomial(edited.model.plantD)).toBe('s^{3}+8s^{2}+17s+10');
    expect(polynomial(original.plantD)).toBe('s^{3}+7s^{2}+10s');
    expect(polynomial(characteristic(edited.model, gainValue('70')))).toBe('s^{3}+8s^{2}+17s+80');
    expect(edited.note).toContain('Untouched exact factors');
  });
  it('adds and removes a zero without changing the denominator or leading numerator scale', () => {
    const source = parseModel('4', 's(s+2)'), added = addFactor(source, 'zero', false, -3, 0);
    expect(polynomial(added.model.plantN)).toBe('4s+12'); expect(added.model.plantD).toEqual(source.plantD);
    const restored = removeFactor(added.model, 'zero-0').model;
    expect(polynomial(restored.plantN)).toBe('4'); expect(restored.plantD).toEqual(source.plantD);
  });
  it('preserves conjugacy, degree and scale when a complex pair moves or becomes repeated real', () => {
    const source = parseModel('4', 's^2+2s+5');
    expect(polynomial(moveFactor(source, 'pole-0', -2, 3).model.plantD)).toBe('s^{2}+4s+13');
    const repeated = moveFactor(source, 'pole-0', -2, 0).model;
    expect(polynomial(repeated.plantD)).toBe('s^{2}+4s+4');
    expect(roots(repeated.plantD)).toEqual([{ re: -2, im: 0, multiplicity: 2 }]);
    expect(polynomial(moveFactor(repeated, 'pole-0', -3, 0).model.plantD)).toBe('s^{2}+6s+9');
  });
  it('adds a conjugate pair as two poles and checks the complete cubic', () => {
    const model = addFactor(parseModel('1', 's+3'), 'pole', true, -1, 2).model;
    // (s+3)((s+1)²+4).
    expect(polynomial(model.plantD)).toBe('s^{3}+5s^{2}+11s+15'); expect(roots(model.plantD)).toHaveLength(3);
    expect(additionLimit(model, 'pole', false)).toContain('at most 3');
    expect(() => addFactor(model, 'pole', false, -4, 0)).toThrow('degree 1–3');
  });
  it('keeps repeated-group multiplicities rather than removing a hidden copy', () => {
    const moved = moveFactor(parseModel('1', '(s+1)^3'), 'pole-0', -2, 0).model;
    expect(polynomial(moved.plantD)).toBe('s^{3}+6s^{2}+12s+8');
    expect(roots(moved.plantD)).toEqual([{ re: -2, im: 0, multiplicity: 3 }]);
    expect(() => removeFactor(moved, 'pole-0')).toThrow('degree 1–3');
  });
  it('retains an untouched cancelled unstable mode in the full Q', () => {
    const original = parseModel('s-1', '(s-1)(s+2)'), edited = moveFactor(original, 'pole-0', -3, 0).model;
    expect(polynomial(edited.common)).toBe('s-1');
    expect(polynomial(characteristic(edited, gainValue('3')))).toBe('s^{2}+5s-6');
    expect(roots(characteristic(edited, gainValue('3'))).map(p => p.re)).toEqual([-6, 1]);
  });
  it('preserves an untouched exact nondecimal rational root', () => {
    const original = parseModel('1', String.raw`(s-\frac{1}{3})(s+2)`), edited = moveFactor(original, 'pole-0', -3, 0);
    expect(polynomial(edited.model.plantD)).toBe(String.raw`s^{2}+\frac{8}{3}s-1`);
    expect(edited.note).toContain('Untouched exact factors');
  });
  it('discloses bounded approximation when an irreducible cubic cannot be exactly split', () => {
    const original = parseModel('1', 's^3+s+1'), factors = editableFactors(original);
    expect(factors[0].exact).toBeUndefined();
    const edited = moveFactor(original, factors.find(f => !f.pair)!.id, -1, 0);
    expect(edited.note).toContain('Other roots without an exact split');
    expect(degree(edited.model.plantD)).toBe(3);
    expect(polynomial(edited.model.plantD)).toBe(String.raw`s^{3}+\frac{8}{25}s^{2}+\frac{1953}{2500}s+\frac{3653}{2500}`);
  });
  it('preserves an untouched exact common factor when another irrational real group moves or is removed', () => {
    const source = parseModel(String.raw`s-\frac{1}{3}`, String.raw`(s-\frac{1}{3})(s^2-2)`);
    const moved = moveFactor(source, 'pole-0', -1, 0).model;
    expect(polynomial(moved.plantD)).toBe(String.raw`s^{3}-\frac{223}{300}s^{2}-\frac{191}{150}s+\frac{47}{100}`);
    expect(polynomial(moved.common)).toBe(String.raw`s-\frac{1}{3}`);
    const removed = removeFactor(source, 'pole-0').model;
    expect(polynomial(removed.plantD)).toBe(String.raw`s^{2}-\frac{523}{300}s+\frac{47}{100}`);
    expect(polynomial(removed.common)).toBe(String.raw`s-\frac{1}{3}`);
    expect(moved.fixed[0].re).toBeCloseTo(1 / 3, 15); expect(removed.fixed[0].re).toBeCloseTo(1 / 3, 15);
  });
  it('edits the PI plant and derives its effective characteristic with fixed Ki', () => {
    const source = parseModel('1', 's(s+2)', 'pi', '2.7'), changed = moveFactor(source, 'pole-0', -3, 0).model;
    expect(polynomial(changed.plantD)).toBe('s^{2}+3s');
    expect(polynomial(changed.denominator)).toBe(String.raw`s^{3}+3s^{2}+\frac{27}{10}`);
    expect(polynomial(changed.numerator)).toBe('s');
    expect(polynomial(characteristic(changed, gainValue('1.35')))).toBe(String.raw`s^{3}+3s^{2}+\frac{27}{20}s+\frac{27}{10}`);
    expect(changed.integral).toEqual(source.integral); expect(additionLimit(changed, 'pole', false)).toContain('at most 2');
  });
  it('checks properness, degree, coordinate and coefficient failures without mutating the source', () => {
    const source = parseModel('s+1', 's(s+2)'), before = polynomial(source.plantD);
    expect(() => removeFactor(source, 'pole-0')).toThrow('strictly proper');
    expect(() => addFactor(source, 'zero', false, -3, 0)).toThrow('strictly proper');
    expect(() => moveFactor(source, 'pole-0', Infinity, 0)).toThrow('finite');
    expect(() => moveFactor(source, 'pole-0', -1, 2)).toThrow('real axis');
    expect(() => moveFactor(parseModel('1', '(s+1)^3'), 'pole-0', 100, 0)).toThrow('magnitude');
    expect(() => snapCoordinate(101)).toThrow('±100'); expect(snapCoordinate(-0.001)).toBe(0); expect(snapCoordinate(-1.237)).toBe(-1.24);
    expect(polynomial(source.plantD)).toBe(before);
  });
});
