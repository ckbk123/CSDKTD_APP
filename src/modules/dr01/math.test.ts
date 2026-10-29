import { describe, expect, it } from 'vitest';
import { fromSequence, initialNumerator, parseTransform, poles, samples, transformLatex, validateTransform } from './math';

const values = (expression: string, history = [0, 0], count = 8) => samples(parseTransform(expression), history, count).map(x => x.value);
describe('DR01 transform parsing and independent inverse fixtures', () => {
  it('recovers the baseline geometric sequence, independently evaluated as powers', () => {
    const x = values(String.raw`\frac{z}{z-0.8}`);
    [1, .8, .64, .512, .4096, .32768, .262144, .2097152].forEach((v, i) => expect(x[i]).toBeCloseTo(v, 12));
  });
  it('links z, q and negative-power representations', () => {
    for (const expr of [String.raw`\frac{1}{1-0.8z^{-1}}`, '1/(1-.8q)', 'X(z)=z/(z-.8)', String.raw`\frac{2z}{2z-1.6}`]) {
      expect(parseTransform(expr)).toEqual({ b: [1], a: [1, -.8] });
    }
  });
  it('computes changed sign, gain, and a two-sample delay', () => {
    expect(values('2z^{-2}/(1+.5z^{-1})')).toEqual([0, 0, 2, -1, .5, -.25, .125, -.0625]);
  });
  it('inverts a repeated pole: (k+1)(1/2)^k', () => {
    values('1/(1-.5q)^2').forEach((x, k) => expect(x).toBeCloseTo((k + 1) / 2 ** k, 12));
  });
  it('inverts a conjugate pair and computes its radii', () => {
    expect(values('1/(1+q^2)')).toEqual([1, 0, -1, 0, 1, 0, -1, 0]);
    expect(poles(parseTransform('1/(1+q^2)'))).toEqual([{ re: -0, im: 1 }, { re: -0, im: -1 }]);
  });
  it('matches independently derived distinct-pole partial fractions', () => {
    // 1/[(1-.5q)(1-.25q)] = 2/(1-.5q)-1/(1-.25q).
    values('1/((1-.5q)(1-.25q))').forEach((x, k) => expect(x).toBeCloseTo(2 * .5 ** k - .25 ** k, 12));
  });
  it('combines sequence terms through additive rational arithmetic', () => {
    values('1/(1-.5q)+2/(1+.5q)').forEach((x, k) => expect(x).toBeCloseTo(.5 ** k + 2 * (-.5) ** k, 12));
  });
  it('handles polynomial FIR and constant transforms', () => {
    expect(values('1-2z^{-1}+3z^{-3}')).toEqual([1, -2, 0, 3, 0, 0, 0, 0]);
    expect(values('0')).toEqual(Array(8).fill(0));
    expect(values('2')).toEqual([2, 0, 0, 0, 0, 0, 0, 0]);
  });
  it('preserves a recurrence residual with nonzero history', () => {
    const model = parseTransform('(1+2q)/(1-.75q+.125q^2)');
    const history = [3, -2];
    const x = samples(model, history, 16);
    const at = (k: number) => k < 0 ? history[-k - 1] : x[k].value;
    x.forEach(row => expect(row.value - .75 * at(row.k - 1) + .125 * at(row.k - 2)).toBeCloseTo(model.b[row.k] ?? 0, 12));
    // A X+ = B + .75*3 - .125*(-2) - .125*3 q.
    expect(initialNumerator(model, history)).toEqual([3.5, 1.625]);
    expect(x[0].value).toBe(3.5);
    expect(model.b).toEqual([1, 2]);
  });
  it('reconstructs the history-corrected unilateral transform from zero history', () => {
    const model = parseTransform('1/(1-.8q)');
    const history = [2, 0];
    expect(initialNumerator(model, history)).toEqual([2.6]);
    const corrected = { b: initialNumerator(model, history), a: model.a };
    expect(samples(corrected, [0, 0], 8)).toEqual(samples(model, history, 8).map((row, k) => ({ ...row, forcing: corrected.b[k] ?? 0, feedback: k ? row.feedback : [0] })));
  });
  it('keeps sum and average DC normalization explicit', () => {
    const sum = fromSequence('sum', 1, .8, 2, 4), average = fromSequence('average', 1, .8, 2, 4);
    expect(sum.b).toEqual([0, 0, 1, 1, 1, 1]);
    expect(average.b.reduce((a, b) => a + b, 0)).toBe(1);
    expect(sum.b.reduce((a, b) => a + b, 0)).toBe(4);
    expect(samples(sum, [0, 0], 8).map(x => x.value)).toEqual([0, 0, 1, 1, 1, 1, 0, 0]);
  });
  it('keeps one-third average weights at full precision through the equation editor', () => {
    const average = fromSequence('average', 1, .8, 0, 3);
    const parsed = parseTransform(transformLatex(average, 'q', true));
    expect(parsed.b).toEqual([1 / 3, 1 / 3, 1 / 3]);
    expect(parsed.b.reduce((sum, weight) => sum + weight, 0)).toBe(1);
    expect(samples(parsed, [0, 0], 4).map(row => row.value)).toEqual([1 / 3, 1 / 3, 1 / 3, 0]);
  });
  it('retains recurrence memory even when the zero-history numerator is zero', () => {
    const model = parseTransform('0/(1-.5q)');
    expect(model.a).toEqual([1, -.5]);
    expect(samples(model, [2, 0], 4).map(x => x.value)).toEqual([1, .5, .25, .125]);
  });
  it('round-trips both computed display forms', () => {
    for (const expr of ['.25q^3/(1+.5q)', '(1+q)/(1-q+q^2)', '1+2q^3', '2']) {
      const model = parseTransform(expr);
      for (const variable of ['q', 'z'] as const) expect(parseTransform(transformLatex(model, variable))).toEqual(model);
    }
  });
});

describe('bounded grammar and failures', () => {
  it.each(['', 'NaN', 'Infinity', 'sin(z)', String.raw`\sqrt{z}`, 's+1', '1/(0)', '1/(z-z)', '1+', '(z+1', String.raw`\frac{}{z}`, 'z^{1.5}', 'z^{15}', 'z^{-15}', '1/(1+q+q^2+q^3)', 'q^14+q^14*q', '1e99', '1e-999', '1e-13', '1/(1e-11+q)', '\\placeholder{}'])('rejects %s', expr => {
    expect(() => parseTransform(expr)).toThrow();
  });
  it.each(['z', 'z^2/(z-.8)', '1/q'])('explains future-sample forms: %s', expr => {
    expect(() => parseTransform(expr)).toThrow(/future samples/);
  });
  it('bounds text, grouping, sample work and runaway sequences', () => {
    expect(() => parseTransform('1+'.repeat(310) + '1')).toThrow(/600/);
    expect(() => parseTransform('('.repeat(30) + '1' + ')'.repeat(30))).toThrow(/nested/);
    expect(() => samples(parseTransform('1'), [0, 0], 65)).toThrow(/4 to 64/);
    expect(() => samples(parseTransform('1/(1-10q)'), [0, 0], 64)).toThrow(/numerical bound/);
    expect(() => samples(parseTransform('1'), [NaN, 0], 8)).toThrow(/history/);
    expect(() => validateTransform({ b: [], a: [1] })).toThrow();
  });
  it('rejects normalization underflow of nonzero numerator or denominator coefficients', () => {
    // The numerator is about 10^-312 (representable), then division by 10^12
    // gives about 10^-324, below the smallest positive floating-point number.
    expect(1e-312).toBeGreaterThan(0);
    expect(() => parseTransform('(1e-12)^14*(1e-12)^12/(1e6)^2')).toThrow(/underflow during normalization/);
    expect(() => parseTransform('1/((1e6)^2+(1e-12)^14*(1e-12)^12*q)')).toThrow(/underflow during normalization/);
  });
  it('rejects out-of-range and fractional builder values', () => {
    expect(() => fromSequence('sum', 1, .8, 12, 12)).toThrow(/Length/);
    expect(() => fromSequence('geometric', 1, .8, .5, 4)).toThrow(/Delay/);
    expect(() => fromSequence('average', Infinity, .8, 0, 4)).toThrow(/finite/);
  });
});
