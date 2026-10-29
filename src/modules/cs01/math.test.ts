import { describe, expect, it } from 'vitest';
import { analyze, impulseAt, modeAt, num, parseMatrix, parseModel, parseScalar, polynomialLatex, stateAt, textRat } from './math';

const matrix = (rows: string[][]): string => `\\begin{bmatrix}${rows.map(row => row.join('&')).join('\\\\')}\\end{bmatrix}`;
const make = (a: string[][], b = ['0', '1'], c = ['1', '0'], d = '0') => parseModel(matrix(a), matrix(b.map(x => [x])), matrix([c]), d);
const baseline = () => make([['0', '1'], ['-2', '-3']]);

describe('bounded exact state-space entry', () => {
  it('preserves decimal and fractional values exactly', () => {
    expect(textRat(parseScalar('0.1'))).toBe('1/10');
    expect(textRat(parseScalar('-\\frac{1}{3}'))).toBe('-1/3');
    expect(textRat(parseScalar('\\frac{-0.5}{2}'))).toBe('-1/4');
    expect(num(parseScalar('1/8'))).toBe(0.125);
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

describe('analytic free and modal traces', () => {
  it('derives baseline and Jordan impulse traces independently', () => {
    expect(impulseAt(analyze(baseline()), 1)).toBeCloseTo(Math.exp(-1) - Math.exp(-2), 14);
    expect(impulseAt(analyze(make([['-1', '1'], ['0', '-1']])), 2)).toBeCloseTo(2 * Math.exp(-2), 14);
    expect(impulseAt(analyze(make([['0', '1'], ['-4', '0']])), Math.PI / 4)).toBeCloseTo(0.5, 14);
  });
  it('uses exact reduction to avoid contamination from a hidden unstable mode', () => {
    const result = analyze(make([['1', '0'], ['0', '-2']], ['0', '1'], ['0', '1']));
    expect(impulseAt(result, 30)).toBeCloseTo(Math.exp(-60), 40);
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
