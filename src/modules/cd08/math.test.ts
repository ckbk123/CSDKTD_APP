import { describe, expect, it } from 'vitest';
import { characteristic, design, response, type Model, type Vector } from './math';
import { parseMatrix, parseScalar, parseTarget } from './parser';
const BASE: Model = { A: [0, 1, -2, -3], B: [0, 1], C: [1, 0] };
function close(actual: readonly number[], expected: readonly number[], digits = 10) { expect(actual.length).toBe(expected.length); actual.forEach((n, i) => expect(n).toBeCloseTo(expected[i], digits)); }

describe('independently derived pole-placement and reference fixtures', () => {
  it('matches baseline coefficients, actual eigenvalues, reference gain and controllability columns', () => {
    const result = design(BASE, [6, 8]);
    close(result.AB, [1, -3]); close(result.controllability, [0, 1, 1, -3]);
    close(result.K, [6, 3]); close(result.closed, [0, 1, -8, -6]); close(result.actual, [6, 8]);
    close(result.poles.map(p => p[0]).sort((a, b) => a - b), [-4, -2]);
    expect(result.prefilter).toBe(8); expect(result.dcGain).toBe(.125); expect(result.residual).toBe(0);
    expect(result.scaledDet).toBeCloseTo(-1 / Math.sqrt(10), 13);
  });
  it('checks baseline state, output and effort against analytic time functions', () => {
    const result = design(BASE, [6, 8]), samples = response(result, 8, [0, 0], 1, 4, 41);
    for (const p of samples) {
      const e2 = Math.exp(-2 * p.t), e4 = Math.exp(-4 * p.t);
      close(p.state, [1 - 2 * e2 + e4, 4 * e2 - 4 * e4], 10);
      expect(p.output).toBeCloseTo(1 - 2 * e2 + e4, 10); expect(p.effort).toBeCloseTo(2 + 6 * e4, 10);
    }
    const raw = response(result, 1, [0, 0], 1, 4, 41);
    raw.forEach((p, i) => { expect(p.output * 8).toBeCloseTo(samples[i].output, 11); expect(p.effort * 8).toBeCloseTo(samples[i].effort, 11); });
  });
  it('preserves free response and initial state separately from the reference', () => {
    const result = design(BASE, [6, 8]);
    for (const p of response(result, 8, [1, 0], 0, 4, 21)) {
      const e2 = Math.exp(-2 * p.t), e4 = Math.exp(-4 * p.t);
      close(p.state, [2 * e2 - e4, -4 * e2 + 4 * e4], 10); expect(p.effort).toBeCloseTo(-6 * e4, 10);
    }
  });
  it('computes changed targets −1,−5, not a canned gain', () => {
    const result = design(BASE, [6, 5]); close(result.K, [3, 3]); expect(result.prefilter).toBe(5);
    for (const p of response(result, 5, [0, 0], 1, 4, 21)) expect(p.output).toBeCloseTo(1 - 1.25 * Math.exp(-p.t) + .25 * Math.exp(-5 * p.t), 10);
  });
  it('supports repeated and conjugate target modes', () => {
    const repeated = design(BASE, [6, 9]); close(repeated.K, [7, 3]); expect(repeated.prefilter).toBe(9);
    for (const p of response(repeated, 9, [0, 0], 1, 4, 21)) expect(p.output).toBeCloseTo(1 - (1 + 3 * p.t) * Math.exp(-3 * p.t), 10);
    const complex = design(BASE, [4, 13]); close(complex.K, [11, 1]); close(complex.poles[0], [-2, 3]); close(complex.poles[1], [-2, -3]);
    for (const p of response(complex, 13, [0, 0], 1, 4, 21)) {
      expect(p.output).toBeCloseTo(1 - Math.exp(-2 * p.t) * (Math.cos(3 * p.t) + 2 / 3 * Math.sin(3 * p.t)), 10);
    }
  });
  it('is invariant under independently constructed state-coordinate scaling', () => {
    // S=diag(2,3): A'=SAS^-1, B'=SB, C'=CS^-1, K'=KS^-1.
    const changed: Model = { A: [0, 2 / 3, -3, -3], B: [0, 3], C: [.5, 0] };
    const a = design(BASE, [6, 8]), b = design(changed, [6, 8]); close(b.K, [3, 1]); expect(b.prefilter).toBeCloseTo(8, 12);
    const x = response(a, 8, [.2, -.3], 1, 3, 31), y = response(b, 8, [.4, -.9], 1, 3, 31);
    y.forEach((p, i) => { close(p.state, [2 * x[i].state[0], 3 * x[i].state[1]], 9); expect(p.output).toBeCloseTo(x[i].output, 10); expect(p.effort).toBeCloseTo(x[i].effort, 9); });
  });
  it('places poles for a noncanonical unstable plant with an independently solved gain', () => {
    // Matching equations: k1-k2=9, 6k1-4k2=-7. Steady x=[-3,2], u=-1 gives Ax+Bu=0 and Cx=1.
    const result = design({ A: [1, 2, 3, 4], B: [1, -1], C: [1, 2] }, [4, 5]);
    close(result.K, [-21.5, -30.5]); close(result.closed, [22.5, 32.5, -18.5, -26.5]); close(result.actual, [4, 5]);
    expect(result.prefilter).toBeCloseTo(2.5, 12); expect(result.dcGain).toBeCloseTo(.4, 12); close(result.poles[0], [-2, 1]);
  });
  it('keeps a valid K when no static unity tracking prefilter exists', () => {
    const result = design({ ...BASE, C: [0, 1] }, [6, 8]); close(result.K, [6, 3]); expect(result.dcGain).toBeCloseTo(0, 13); expect(result.prefilter).toBeNull();
    expect(response(result, 1, [0, 0], 1, 4, 21).at(-1)!.output).toBeLessThan(.001);
  });
  it('retains feedback when the required prefilter exceeds the declared gain bound', () => {
    const result = design({ ...BASE, C: [1e-8, 0] }, [6, 8]);
    close(result.K, [6, 3]); expect(result.dcGain).toBeCloseTo(1.25e-9, 20);
    // The mathematical N=8e8 exists; this is outside supported gain, not a zero DC channel.
    expect(1 / result.dcGain).toBeCloseTo(8e8, 3); expect(result.prefilter).toBeNull(); expect(result.trackingNote).toContain('gain exceeds');
  });
  it('rejects rank-deficient, near-rank-deficient and nonfinite models', () => {
    expect(() => design({ ...BASE, B: [0, 0] }, [6, 8])).toThrow(/rank/);
    expect(() => design({ A: [-1, 0, 0, -2], B: [1, 0], C: [1, 1] }, [6, 8])).toThrow(/rank/);
    expect(() => design({ A: [-1, 1e-12, 0, -2], B: [0, 1], C: [1, 0] }, [6, 8])).toThrow(/rank/);
    expect(() => design({ ...BASE, C: [Infinity, 0] }, [6, 8])).toThrow(/finite/);
    for (const desired of [[0, 1], [1, 0], [-1, 2], [2, -1], [NaN, 1]] as Vector[]) expect(() => design(BASE, desired)).toThrow();
  });
  it('bounds the numerical response and handles a genuine zero reference', () => {
    const result = design(BASE, [6, 8]); expect(response(result, 8, [0, 0], 0, .1, 2).every(p => p.output === 0 && p.effort === 0)).toBe(true);
    for (const horizon of [0, 51, NaN, Infinity]) expect(() => response(result, 8, [0, 0], 1, horizon)).toThrow();
    for (const count of [1, 1002, 3.5]) expect(() => response(result, 8, [0, 0], 1, 2, count)).toThrow();
    expect(() => response(result, Infinity, [0, 0], 1, 2)).toThrow();
    expect(() => response(result, 8, [101, 0], 1, 2)).toThrow();
  });
  it('verifies the actual matrix characteristic polynomial rather than desired labels', () => {
    close(characteristic([0, 1, -8, -6]), [6, 8]); close(characteristic([-2, 3, -3, -2]), [4, 13]);
  });
  it('retains tiny nonzero gains and evaluates slow forced response without steady-state cancellation', () => {
    const tiny = design({ A: [0, 1, 0, 0], B: [0, 1], C: [1, 0] }, [1e-14, 1e-14]);
    close(tiny.K.map(x => x * 1e14), [1, 1]); expect(tiny.prefilter).toBeCloseTo(1e-14, 24);
    // At t=.1, y≈N t²/2; no subtraction of two ~1/N steady-state terms.
    expect(response(tiny, tiny.prefilter!, [0, 0], 1, .1, 2)[1].output).toBeCloseTo(5e-17, 27);
  });
  it('does not hide a tiny coefficient mismatch behind an absolute tolerance floor', () => {
    // Ordinary gain subtraction here leaves det(A-BK)≈5.06e-22, not 1e-30.
    // A rank-2 plant does not guarantee that extreme targets are numerically placeable.
    expect(() => design({ A: [1e-6, 0, 0, -2], B: [3, 1], C: [1, 0] }, [2, 1e-30])).toThrow(/Coefficient verification lost accuracy/);
  });
});

describe('bounded visual semantics', () => {
  it('accepts equivalent signed, compact and grouped fractions without changing their meaning', () => {
    for (const source of [String.raw`-\frac12`, String.raw`\frac{-1}2`, String.raw`-\frac1{2}`, String.raw`(-\frac{1}{2})`]) expect(parseScalar(source)).toBe(-.5);
    expect(parseScalar(String.raw`\frac{\frac12}{2}`)).toBe(.25);
    expect(parseScalar('{-0.5}')).toBe(-.5);
  });
  it('reads displayed matrix rows/columns and rejects unsupported dimensions', () => {
    expect(parseMatrix(String.raw`A=\begin{bmatrix}0&1\\-2&-3\end{bmatrix}`, 2, 2, 'A')).toEqual([0, 1, -2, -3]);
    expect(parseMatrix(String.raw`C=\begin{pmatrix}-\frac12&0\end{pmatrix}`, 1, 2, 'C')).toEqual([-.5, 0]);
    expect(() => parseMatrix(String.raw`\begin{bmatrix}1&2&3\end{bmatrix}`, 2, 2, 'A')).toThrow(/row/);
  });
  it('expands supported target expressions including changed, repeated and conjugate targets', () => {
    close(parseTarget('q(s)=(s+2)(s+4)'), [6, 8]); close(parseTarget('s^{2}+6s+8'), [6, 8]);
    close(parseTarget('(s+3)^2'), [6, 9]); close(parseTarget('(s+2)^2+9'), [4, 13]);
    close(parseTarget(String.raw`s^2+\frac12 s+\frac{1}{4}`), [.5, .25]);
    close(parseTarget(String.raw`s^2+2\times\frac12 s+1`), [1, 1]);
    close(parseTarget(String.raw`s^2+2+\frac12`), [0, 2.5]);
  });
  it.each(['s^02+4s+5', 's^2.0+4s+5', 's^22+4s+5', 's^{2}2+4s+5', 's^+2+4s+5', 's^-2+4s+5'])('rejects ambiguous or unsupported exponent %s', source => {
    expect(() => parseTarget(source)).toThrow();
  });
  it.each(['1e-2', '1E-2', '2\\frac12', '-2\\frac12', '1{+2}', '{1+2}', 'NaN', 'Infinity', '\\frac10', '\\frac{1+1}2', '', '1/2', '0.0000000000001'])('rejects unsupported scalar %s', source => {
    expect(() => parseScalar(source)).toThrow();
  });
  it.each(['s^2+1e-2', 's^2+2\\frac12 s+1', 's^2+(2\\frac12)s+1', 's^2+{s+2}s+1', 's^2+1{+2}', '2s^2+6s+8', 's^3+1', 's^2+1/s', 's^2+1/0', 's^2+\\sin(s)', '', '('.repeat(15)+'s^2+1'+')'.repeat(15)])('rejects unsupported or ambiguous polynomial %s', source => {
    expect(() => parseTarget(source)).toThrow();
  });
});
