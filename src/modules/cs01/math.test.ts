import { describe, expect, it } from 'vitest';
import { analyze, impulseAt, modeAt, num, parseMatrix, parseModel, parseScalar, polynomialLatex, stateAt, textRat } from './math';

const matrix = (rows: string[][]): string => `\\begin{bmatrix}${rows.map(row => row.join('&')).join('\\\\')}\\end{bmatrix}`;
const make = (a: string[][], b = ['0', '1'], c = ['1', '0'], d = '0') => parseModel(matrix(a), matrix(b.map(x => [x])), matrix([c]), d);
const baseline = () => make([['0', '1'], ['-2', '-3']]);

describe('CS01 TeX argument spacing at scalar and matrix entries', () => {
  it.each([String.raw`\frac1\;2`, String.raw`\frac\,12`, String.raw`\frac1\;`, '\\frac1\u20092', String.raw`\frac1\left\;2`, String.raw`\frac{1}{\left\;2}`, String.raw`\frac\left(1\right)\;2`])('rejects an empty spacing argument in %s', source => {
    expect(() => parseScalar(source)).toThrow(/blank space cannot fill a box/);
    expect(() => parseMatrix(matrix([[source, '0'], ['0', '1']]), 2, 2, 'A')).toThrow(/blank space cannot fill a box/);
    expect(() => make([[source, '0'], ['0', '1']])).toThrow(/blank space cannot fill a box/);
  });
  it.each([String.raw`\frac1{\;2}`, String.raw`\frac{\,1}{2}`, String.raw`\frac 1{2}`, '\\frac1{\u20092}'])('preserves valid spacing through the matrix wrapper in %s', source => {
    expect(textRat(parseScalar(source))).toBe('1/2');
    expect(textRat(parseMatrix(matrix([[source, '0'], ['0', '1']]), 2, 2, 'A')[0][0])).toBe('1/2');
  });
});

describe('bounded exact state-space entry', () => {
  it('preserves decimal and fractional values exactly', () => {
    expect(textRat(parseScalar('0.1'))).toBe('1/10');
    expect(textRat(parseScalar('-\\frac{1}{3}'))).toBe('-1/3');
    expect(textRat(parseScalar('\\frac{-0.5}{2}'))).toBe('-1/4');
    expect(num(parseScalar('1/8'))).toBe(0.125);
    expect(textRat(parseScalar('\\frac12'))).toBe('1/2');
    expect(textRat(parseScalar('-\\frac1{20}'))).toBe('-1/20');
    expect(textRat(parseScalar('\\frac{12}3'))).toBe('4');
  });
  it('accepts MathLive matrix delimiters and a label', () => {
    expect(parseMatrix('A=\\left[\\begin{matrix}0&1\\\\-2&-3\\end{matrix}\\right]', 2, 2, 'A')[1].map(num)).toEqual([-2, -3]);
  });
  it.each(['', 'NaN', 'Infinity', '1e3', 's', '2+3', '\\sqrt{2}', '\\frac{1}{0}', '101', '0.0000000001', '\\frac{1}{1000000001}', '1'.repeat(100)])('rejects unsupported scalar %s', source => {
    expect(() => parseScalar(source)).toThrow();
  });
  it('rejects malformed, wrong-size and excessive matrices', () => {
    expect(() => parseMatrix('0,1;-2,-3', 2, 2, 'A')).toThrow(/displayed matrix/);
    expect(() => parseMatrix(matrix([['1', '2', '3']]), 2, 2, 'A')).toThrow(/2 by 2/);
    expect(() => parseMatrix(' '.repeat(513), 2, 2, 'A')).toThrow();
  });
});

describe('stability and exact scalar channel reduction', () => {
  it('derives the baseline 1/(s²+3s+2) and its two negative poles', () => {
    const result = analyze(baseline());
    expect(result.denominator.map(textRat)).toEqual(['2', '3', '1']);
    expect(result.numerator.map(textRat)).toEqual(['1']);
    expect(result.eigenvalues.map(x => x.re).sort()).toEqual([-1, -2]);
    expect(result.freeClass).toBe('asymptotically stable'); expect(result.bibo).toBe(true);
    expect(polynomialLatex(result.denominator)).toBe('s^{2}+3s+2');
  });
  it.each([['0', '1'], ['1', '1']])('retains the hidden unstable state for B=%s,%s', (b1, b2) => {
    const model = make([['1', '0'], ['0', '-2']], [b1, b2], ['0', '1']);
    const result = analyze(model);
    expect(result.reducedNumerator.map(textRat)).toEqual(['1']);
    expect(result.reducedDenominator.map(textRat)).toEqual(['2', '1']);
    expect(result.cancellation.map(textRat)).toEqual(['-1', '1']);
    expect(result.bibo).toBe(true); expect(result.freeClass).toBe('unstable');
    expect(stateAt(model, [1, 0], 2)[0]).toBeCloseTo(Math.exp(2), 12);
    expect(stateAt(model, [1, 0], 2)[1]).toBe(0);
  });
  it('does not cancel a near pole/zero pair', () => {
    const result = analyze(make([['1', '0'], ['0', '-2']], ['1', '1'], ['0.000001', '1']));
    expect(result.cancellation.length).toBe(1); expect(result.poles.length).toBe(2); expect(result.bibo).toBe(false);
  });
  it('distinguishes simple imaginary poles from BIBO stability', () => {
    const result = analyze(make([['0', '1'], ['-4', '0']]));
    expect(result.eigenvalues.map(x => x.im)).toEqual([2, -2]);
    expect(result.freeClass).toBe('bounded, not asymptotic'); expect(result.bibo).toBe(false); expect(result.defective).toBe(false);
  });
  it('distinguishes semisimple repeated zero from a zero Jordan block', () => {
    const semi = analyze(make([['0', '0'], ['0', '0']], ['1', '1']));
    const jordan = analyze(make([['0', '1'], ['0', '0']]));
    expect(semi.freeClass).toBe('bounded, not asymptotic'); expect(semi.defective).toBe(false);
    expect(jordan.freeClass).toBe('unstable'); expect(jordan.defective).toBe(true);
    expect(jordan.poles[0].multiplicity).toBe(2);
    expect(stateAt(make([['0', '1'], ['0', '0']]), [0, 1], 3)).toEqual([3, 1]);
  });
  it('keeps a repeated negative Jordan eigenvalue asymptotically stable', () => {
    const model = make([['-1', '1'], ['0', '-1']]); const result = analyze(model);
    expect(result.freeClass).toBe('asymptotically stable'); expect(result.defective).toBe(true); expect(result.bibo).toBe(true);
    expect(stateAt(model, [0, 1], 2)).toEqual([2 * Math.exp(-2), Math.exp(-2)]);
  });
  it('handles a zero scalar channel and direct feedthrough without dropping internal modes', () => {
    for (const d of ['0', '2']) {
      const result = analyze(make([['1', '0'], ['0', '1']], ['0', '0'], ['1', '0'], d));
      expect(result.reducedDenominator.map(textRat)).toEqual(['1']);
      expect(result.reducedNumerator.map(textRat)).toEqual([d]);
      expect(result.poles).toEqual([]); expect(result.bibo).toBe(true); expect(result.freeClass).toBe('unstable');
    }
  });
  it('derives direct feedthrough and nontrivial B,C independently', () => {
    // C(sI-A)^-1B = 8/(s+1)+15/(s+2); adding D=2 gives (2s²+29s+35)/(s²+3s+2).
    const result = analyze(make([['-1', '0'], ['0', '-2']], ['2', '3'], ['4', '5'], '2'));
    expect(result.numerator.map(textRat)).toEqual(['35', '29', '2']);
    expect(impulseAt(result, 2)).toBeCloseTo(8 * Math.exp(-2) + 15 * Math.exp(-4), 12);
  });
  it('treats a simple zero with a negative eigenvalue as bounded, not asymptotic', () => {
    const result = analyze(make([['0', '0'], ['0', '-1']], ['1', '1'], ['1', '1']));
    expect(result.freeClass).toBe('bounded, not asymptotic'); expect(result.defective).toBe(false); expect(result.bibo).toBe(false);
  });
  it('retains near-boundary conjugate modes on either side without a tolerance band', () => {
    for (const real of ['0.000000001', '-0.000000001']) {
      const result = analyze(make([[real, '1'], ['-1', real]]));
      expect(result.freeClass).toBe(real.startsWith('-') ? 'asymptotically stable' : 'unstable');
      expect(result.bibo).toBe(real.startsWith('-'));
      expect(result.eigenvalues[0].im).toBe(1);
    }
  });
  it('does not round a very small positive eigenvalue onto the axis', () => {
    const result = analyze(make([['0.000000001', '0'], ['0', '-100']]));
    expect(result.freeClass).toBe('unstable');
    expect(result.eigenvalues.find(x => x.re > 0)?.re).toBeCloseTo(1e-9, 20);
  });
  it('is invariant under an exact coordinate permutation', () => {
    const first = analyze(baseline()); const swapped = analyze(make([['-3', '-2'], ['1', '0']], ['1', '0'], ['0', '1']));
    expect(swapped.numerator.map(textRat)).toEqual(first.numerator.map(textRat));
    expect(swapped.denominator.map(textRat)).toEqual(first.denominator.map(textRat));
    expect(swapped.freeClass).toBe(first.freeClass);
  });
});

describe('free-response projections before exponential amplification', () => {
  const expectState = (actual: readonly number[], expected: readonly number[]) => {
    expected.forEach((value, i) => expect(Math.abs(actual[i] - value)).toBeLessThanOrEqual(1e-12 * Math.max(1, Math.abs(value))));
  };
  it.each([1, 1.1, -2.2, .3, 12.8, 1e-20])('keeps the unexcited fast dyadic mode exactly absent at scale %s', scale => {
    // Eigenvalues 1/8 and 8; [1,1/8] is the slow eigenvector.
    const model = make([['0', '1'], ['-1', '8.125']]);
    const initial = [scale, scale / 8], growth = Math.exp(5 / 8);
    const result = stateAt(model, initial, 5);
    expectState(result, initial.map(value => value * growth));
    expect(num(model.c[0]) * result[0] + num(model.c[1]) * result[1]).toBeCloseTo(scale * growth, 11);
  });
  it.each([[1, .1], [-3, -.3], [.1, .01], [7.5, .75]])('retains the exact decimal slow eigenvector %s, %s', (first, second) => {
    // A[1,1/10]' = (1/10)[1,1/10]'; the other eigenvalue is 10.
    const model = make([['0', '1'], ['-1', '10.1']], ['0', '1'], ['0', '1']);
    const result = stateAt(model, [first, second], 4), growth = Math.exp(.4);
    expectState(result, [first * growth, second * growth]);
    expect(result[1]).toBeCloseTo(second * growth, 12);
  });
  it.each([[1, -3], [.5, -1.5], [-.4, 1.2]])('does not invent a growing mode in the decaying initial state %s, %s', (first, second) => {
    const model = make([['0', '1'], ['6', '-1']]);
    const expected = [first * Math.exp(-60), second * Math.exp(-60)];
    const result = stateAt(model, [first, second], 20);
    expected.forEach((value, i) => expect(result[i] / value).toBeCloseTo(1, 13));
  });
  it.each([
    [.137500001, 1e-9], [.137499999, -1e-9],
    [.137500000000001, 1e-15], [.137499999999999, -1e-15],
    [.13750000000000004, 4e-17], [.13749999999999998, -2e-17],
  ])('preserves the genuinely nonzero fast mode for initial velocity %s', (second, epsilon) => {
    // Perturbing velocity by epsilon gives fast coefficient epsilon/(8-1/8).
    const fast = epsilon * 8 / 63, slow = 1.1 - fast, t = 5;
    const expected = [slow * Math.exp(t / 8) + fast * Math.exp(8 * t),
      slow / 8 * Math.exp(t / 8) + fast * 8 * Math.exp(8 * t)];
    expectState(stateAt(make([['0', '1'], ['-1', '8.125']]), [1.1, second], t), expected);
  });
  it('preserves initial values exactly at t=0, including small native exponent values', () => {
    const initial = Object.freeze([1e-200, -.1375]);
    const result = stateAt(make([['0', '1'], ['-1', '8.125']]), initial, 0);
    expect(result).toEqual(initial); expect(result).not.toBe(initial);
    const tiny = stateAt(make([['8', '0'], ['0', '-1']]), [1e-200, 1], 5);
    expect(tiny[0] / (1e-200 * Math.exp(40))).toBeCloseTo(1, 13);
  });
  it('evaluates the repeated-root polynomial before amplifying it', () => {
    // exp(8t)[-1/2+t/10, 1] is exactly [0,exp(40)] at t=5.
    expectState(stateAt(make([['8', '.1'], ['0', '8']]), [-.5, 1], 5), [0, Math.exp(40)]);
    expectState(stateAt(make([['-1', '1'], ['0', '-1']]), [.3, -.7], 2), [-1.1 * Math.exp(-2), -.7 * Math.exp(-2)]);
  });
  it('keeps complex-pair and near-repeated evaluation in the regular real basis', () => {
    const t = 2.5, scale = Math.exp(-.3 * t), c = Math.cos(2 * t), s = Math.sin(2 * t);
    expectState(stateAt(make([['-.3', '-2'], ['2', '-.3']]), [.3, -.7], t), [scale * (.3 * c + .7 * s), scale * (.3 * s - .7 * c)]);
    const q = Math.sqrt(1e-9);
    expectState(stateAt(make([['0', '1'], ['.000000001', '0']]), [0, 1], .01), [Math.sinh(q * .01) / q, Math.cosh(q * .01)]);
  });
  it('reports unresolved irrational projection cancellation instead of deleting a fast mode', () => {
    const model = make([['0', '1'], ['2', '0']]);
    expect(() => stateAt(model, [1, -1.4142135623730951], 20)).toThrow(/ill-conditioned/);
    expect(analyze(model).freeClass).toBe('unstable');
    // A nearby plainly excited mode remains calculable at the same horizon.
    const q = Math.sqrt(2), fast = (1 - 1.4 / q) / 2, slow = (1 + 1.4 / q) / 2;
    expectState(stateAt(model, [1, -1.4], 20), [fast * Math.exp(20 * q) + slow * Math.exp(-20 * q), q * (fast * Math.exp(20 * q) - slow * Math.exp(-20 * q))]);
  });
});

describe('analytic free and modal traces', () => {
  it('derives baseline and Jordan impulse traces independently', () => {
    expect(impulseAt(analyze(baseline()), 1)).toBeCloseTo(Math.exp(-1) - Math.exp(-2), 14);
    expect(impulseAt(analyze(make([['-1', '1'], ['0', '-1']])), 2)).toBeCloseTo(2 * Math.exp(-2), 14);
    expect(impulseAt(analyze(make([['0', '1'], ['-4', '0']])), Math.PI / 4)).toBeCloseTo(0.5, 14);
  });
  it('uses exact reduction to avoid contamination from a hidden unstable mode', () => {
    const result = analyze(make([['1', '0'], ['0', '-2']], ['0', '1'], ['0', '1']));
    expect(impulseAt(result, 30)).toBeCloseTo(Math.exp(-60), 40);
    const mixed = stateAt(make([['1', '0'], ['0', '-2']]), [1, 1], 30);
    expect(mixed[0]).toBeCloseTo(Math.exp(30), 0); expect(mixed[1]).toBeCloseTo(Math.exp(-60), 40);
    expect(impulseAt(analyze(make([['1', '0'], ['0', '1']], ['0', '0'], ['1', '0'], '2')), 1)).toBe(0);
  });
  it('handles nearly repeated real eigenvalues without subtractive loss in the transition', () => {
    const model = make([['0', '1'], ['0.000000001', '0']]);
    expect(stateAt(model, [0, 1], 0.01)[0]).toBeCloseTo(0.01, 14);
  });
  it('matches an independently solved baseline IVP', () => {
    // x1=2e^-t-e^-2t, x2=-2e^-t+2e^-2t for x(0)=[1,0].
    for (const t of [0, 0.1, 1, 5]) {
      const x = stateAt(baseline(), [1, 0], t);
      expect(x[0]).toBeCloseTo(2 * Math.exp(-t) - Math.exp(-2 * t), 12);
      expect(x[1]).toBeCloseTo(-2 * Math.exp(-t) + 2 * Math.exp(-2 * t), 12);
    }
  });
  it('matches a harmonic oscillator IVP', () => {
    const model = make([['0', '1'], ['-4', '0']]);
    const x = stateAt(model, [1, 0], Math.PI / 4);
    expect(x[0]).toBeCloseTo(0, 12); expect(x[1]).toBeCloseTo(-2, 12);
  });
  it('has the correct derivative at the initial state', () => {
    const model = make([['-2', '3'], ['-1', '-4']]); const h = 1e-7;
    const x = stateAt(model, [2, -1], h);
    expect((x[0] - 2) / h).toBeCloseTo(-7, 5); expect((x[1] + 1) / h).toBeCloseTo(2, 5);
  });
  it('evaluates a generalized mode and rejects unbounded plotting requests', () => {
    expect(modeAt({ re: -1, im: 0, multiplicity: 2 }, true, 2)).toBeCloseTo(2 * Math.exp(-2), 14);
    expect(() => stateAt(make([['100', '0'], ['0', '1']]), [1, 0], 2)).toThrow(/horizon/);
    expect(() => stateAt(baseline(), [NaN, 0], 1)).toThrow();
    expect(() => stateAt(baseline(), [1, 0], 31)).toThrow();
    expect(() => modeAt({ re: 100, im: 0, multiplicity: 1 }, false, 2)).toThrow(/horizon/);
  });
});
