import { describe, expect, it } from 'vitest';
import { decimal, modelLatex } from './input';
import { parseModel } from './parser';
import { zohBaseline } from './math';

describe('DR03 native alternative preserves displayed coefficients', () => {
  it.each([1e-4, .1, .2, 1, 10])('round-trips generated baseline T=%s', T => {
    const model = zohBaseline(T).model, latex = modelLatex(model);
    expect(latex).not.toMatch(/[eE]/); expect(parseModel(latex)).toEqual(model);
  });
  it.each([[1e-7, '0.0000001'], [-1.2345e-7, '-0.00000012345'], [1e21, '1000000000000000000000'], [0, '0'], [.01, '0.01']])('expands native %s into %s', (value, expected) => expect(decimal(Number(value))).toBe(expected));
  it('rejects nonfinite and too-long visual alternatives without altering their meaning', () => {
    expect(() => decimal(Infinity)).toThrow(/finite/);
    expect(() => modelLatex({ a: [1, 1e-300, 1e-300], b: [1e-300, 1e-300, 1e-300] })).toThrow(/512/);
  });
});
