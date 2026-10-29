import { describe, expect, it } from 'vitest';
import { characteristic3, cubic, designFeedback, designObserver, quadratic, simulate, type Matrix, type Options, type Vector } from './math';
import { parseMatrix, parseScalar, parseTarget } from './parser';

const A: Matrix = [0, 1, -2, -3], B: Vector = [0, 1], C: Vector = [1, 0];
const options = (changes: Partial<Options> = {}): Options => ({ initial: [1, 0], estimate: [0, 0], heldInput: 0, reference: 1, noiseAmplitude: 0, noiseFrequency: 1, noisePhase: 0, filterTau: 0, horizon: 5, count: 101, ...changes });
const close = (a: readonly number[], b: readonly number[], digits = 10) => { expect(a.length).toBe(b.length); a.forEach((v, i) => expect(v).toBeCloseTo(b[i], digits)); };

describe('observer design and one measured output', () => {
  it('derives the baseline from two independent matching equations', () => {
    const d = designObserver(A, C, [13, 42]);
    close(d.observability, [1, 0, 0, 1]); expect(d.scaledDet).toBe(1);
    close(d.matching, [1, 0, -3, -1]); close(d.rhs, [10, -40]); close(d.L, [10, 10]);
    close(d.closed, [-10, 1, -12, -3]); close(d.actual, [13, 42]); close(d.poles.map(p => p[0]).sort((a, b) => a - b), [-7, -6]);
  });
  it('keeps the changed velocity sensor observable', () => {
    const d = designObserver(A, [0, 1], [13, 42]);
    close(d.observability, [0, 1, -2, -3]); expect(d.scaledDet).toBeCloseTo(2 / Math.sqrt(13), 12);
    close(d.L, [-20, 10]); close(d.closed, [0, 21, -2, -13]); close(d.actual, [13, 42]);
  });
  it('supports a noncanonical unstable plant with independently solved gain', () => {
    // l1+2l2=9 and -2l1=-7, rather than a canned mechanical realization.
    const d = designObserver([1, 2, 3, 4], [1, 2], [4, 5]); close(d.L, [3.5, 2.75]); close(d.closed, [-2.5, -5, .25, -1.5]); close(d.actual, [4, 5]);
  });
  it('matches independently derived free truth and estimation error at every sample', () => {
    const run = simulate(designObserver(A, C, [13, 42]), B, options());
    for (const sample of run.samples) {
      const { t } = sample, truth = [2 * Math.exp(-t) - Math.exp(-2 * t), -2 * Math.exp(-t) + 2 * Math.exp(-2 * t)];
      const error = [-3 * Math.exp(-6 * t) + 4 * Math.exp(-7 * t), -12 * Math.exp(-6 * t) + 12 * Math.exp(-7 * t)];
      close(sample.x, truth); close(sample.error, error); close(sample.estimate, truth.map((v, i) => v - error[i]));
      expect(sample.innovation).toBeCloseTo(error[0], 11); expect(sample.measuredOutput).toBe(sample.cleanOutput);
    }
  });
  it('uses the same known input in plant and observer without creating estimation error', () => {
    const run = simulate(designObserver(A, C, [13, 42]), B, options({ initial: [0, 0], heldInput: 1 }));
    for (const sample of run.samples) {
      const t = sample.t, expected = [.5 * (1 - 2 * Math.exp(-t) + Math.exp(-2 * t)), Math.exp(-t) - Math.exp(-2 * t)];
      close(sample.x, expected); close(sample.estimate, expected); close(sample.error, [0, 0]); expect(sample.effort).toBe(1);
    }
  });
  it('matches the full observer-based feedback response and all four nominal modes', () => {
    const observer = designObserver(A, C, [13, 42]), feedback = designFeedback(A, B, C, [6, 8]);
    close(feedback.K, [6, 3]); expect(feedback.prefilter).toBe(8);
    const run = simulate(observer, B, options({ initial: [0, 0] }), feedback);
    close(run.allPoles.map(p => p[0]).sort((a, b) => a - b), [-7, -6, -4, -2]);
    for (const sample of run.samples) {
      const t = sample.t; expect(sample.cleanOutput).toBeCloseTo(1 - 2 * Math.exp(-2 * t) + Math.exp(-4 * t), 10);
      expect(sample.effort).toBeCloseTo(2 + 6 * Math.exp(-4 * t), 9); close(sample.error, [0, 0]);
    }
  });
  it('does not let feedback or the known input change the nominal error trajectory', () => {
    const observer = designObserver(A, C, [13, 42]), a = simulate(observer, B, options({ heldInput: .3 }));
    const b = simulate(observer, B, options({ reference: .7 }), designFeedback(A, B, C, [6, 8]));
    a.samples.forEach((p, i) => close(b.samples[i].error, p.error, 9));
  });
  it('preserves repeated and conjugate observer targets', () => {
    const repeated = designObserver(A, C, [12, 36]), complex = designObserver(A, C, [4, 13]);
    close(repeated.L, [9, 7]); close(repeated.poles.flat(), [-6, 0, -6, 0]);
    close(complex.L, [1, 8]); complex.poles.forEach(p => { expect(p[0]).toBeCloseTo(-2, 11); expect(Math.abs(p[1])).toBeCloseTo(3, 11); });
  });
  it('preserves outputs, estimates and effort under a state-coordinate scaling', () => {
    // S=diag(2,3): L'=SL, K'=KS^-1, B'=SB, C'=CS^-1.
    const transformed: Matrix = [0, 2 / 3, -3, -3], sensor: Vector = [.5, 0], input: Vector = [0, 3];
    const a = designObserver(A, C, [13, 42]), b = designObserver(transformed, sensor, [13, 42]); close(b.L, [20, 30]);
    const first = simulate(a, B, options({ initial: [.2, -.3], estimate: [-.1, .4], filterTau: .1, noiseAmplitude: .02, noiseFrequency: 6, noisePhase: .3 }), designFeedback(A, B, C, [6, 8]));
    const second = simulate(b, input, options({ initial: [.4, -.9], estimate: [-.2, 1.2], filterTau: .1, noiseAmplitude: .02, noiseFrequency: 6, noisePhase: .3 }), designFeedback(transformed, input, sensor, [6, 8]));
    first.samples.forEach((p, i) => { const q = second.samples[i]; close(q.x, [2 * p.x[0], 3 * p.x[1]], 9); close(q.estimate, [2 * p.estimate[0], 3 * p.estimate[1]], 9); expect(q.cleanOutput).toBeCloseTo(p.cleanOutput, 10); expect(q.effort).toBeCloseTo(p.effort, 9); });
  });
  it('retains feedback for a zero-DC output without claiming unity tracking', () => {
    const f = designFeedback(A, B, [0, 1], [6, 8]); expect(f.prefilter).toBeNull(); expect(f.dcGain).toBeCloseTo(0, 12);
    const run = simulate(designObserver(A, [0, 1], [13, 42]), B, options({ initial: [0, 0] }), f);
    expect(run.referenceGain).toBe(1); expect(Math.abs(run.samples.at(-1)!.cleanOutput)).toBeLessThan(.001);
  });
  it('retains a checked feedback gain when only the DC solve is poorly conditioned', () => {
    const f = designFeedback([0, 1, 0, 0], B, C, [1, 1e-14]); close(f.K, [1e-14, 1]); expect(f.prefilter).toBeNull(); expect(f.dcGain).toBeNull();
  });
  it('preserves tiny nonzero observer gains and rejects unrepresentable poles', () => {
    const observer = designObserver([0, 1, 0, 0], C, [1e-14, 1e-14]); close(observer.L.map(v => v * 1e14), [1, 1]);
    const run = simulate(observer, B, options({ initial: [0, 0], noiseAmplitude: 1, noiseFrequency: 0, noisePhase: Math.PI / 2, horizon: .1, count: 2 }));
    expect(run.samples[1].estimate[1]).toBeCloseTo(1e-15, 27); expect(run.samples[1].estimate[0]).toBeCloseTo(1.05e-15, 27);
    expect(() => quadratic([10000, Number.MIN_VALUE])).toThrow(/too small to represent/);
  });
});

describe('measurement noise and innovation filtering', () => {
  it('does not feed simulated truth into a noisy estimator', () => {
    const run = simulate(designObserver(A, C, [13, 42]), B, options({ initial: [0, 0], noiseAmplitude: .2, horizon: 10, count: 401 }));
    const last = run.samples.at(-1)!, t = last.t;
    close(last.x, [0, 0]); expect(last.measuredOutput).toBeCloseTo(.2 * Math.sin(t), 12);
    // Independent steady sinusoidal transfer: (40+10j)/(41+13j), (-20+10j)/(41+13j).
    close(last.estimate, [.2 * (1770 * Math.sin(t) - 110 * Math.cos(t)) / 1850, .2 * (-690 * Math.sin(t) + 670 * Math.cos(t)) / 1850], 10);
    close(last.error, last.estimate.map(v => -v));
  });
  it('uses the actual three-state filter polynomial and independent noise transfer', () => {
    const run = simulate(designObserver(A, C, [13, 42]), B, options({ initial: [0, 0], filterTau: .1, noiseAmplitude: .2, horizon: 15, count: 601 }));
    close(run.errorPolynomial, [13, 132, 420]); expect(run.errorPoles).toHaveLength(3); expect(run.allPoles).toHaveLength(5); expect(run.errorStability).toBe('stable');
    const last = run.samples.at(-1)!, t = last.t;
    // Independent filter transfer: (400+100j)/(407+131j), (-200+100j)/(407+131j).
    close(last.estimate, [.2 * (175900 * Math.sin(t) - 11700 * Math.cos(t)) / 182810, .2 * (-68300 * Math.sin(t) + 66900 * Math.cos(t)) / 182810], 10);
  });
  it('preserves the DC estimation bias and initializes the filter from measured innovation', () => {
    const observer = designObserver(A, C, [13, 42]);
    for (const filterTau of [0, .1]) {
      const run = simulate(observer, B, options({ initial: [0, 0], filterTau, noiseAmplitude: .1, noiseFrequency: 0, noisePhase: Math.PI / 2, horizon: 15, count: 401 }));
      expect(run.samples[0].injection).toBeCloseTo(.1, 12); close(run.samples.at(-1)!.estimate, [.1 * 20 / 21, -.1 * 10 / 21], 9);
    }
  });
  it('reports filter-induced unstable error modes despite nominal pole placement', () => {
    const plant: Matrix = [1, 0, 0, 2], sensor: Vector = [1, 1], input: Vector = [1, 1];
    const observer = designObserver(plant, sensor, [13, 42]); close(observer.L, [-56, 72]);
    const run = simulate(observer, input, options({ initial: [.1, 0], filterTau: 1, horizon: .5 }), designFeedback(plant, input, sensor, [6, 8]));
    close(run.errorPolynomial, [-2, 15, 42]); expect(run.errorStability).toBe('unstable'); expect(run.errorPoles.some(p => p[0] > 0)).toBe(true); expect(run.allPoles).toHaveLength(5);
  });
  it('warns about modal/noise sampling resolution and bounds response growth', () => {
    const observer = designObserver(A, C, [13, 42]);
    expect(simulate(observer, B, options({ noiseFrequency: 100, horizon: 50, initial: [0, 0] })).coarse).toBe(true);
    expect(simulate(observer, B, options({ horizon: .1 })).coarse).toBe(false);
    const unstable = designObserver([1000, 1, 0, -1], [1, 0], [13, 42]);
    expect(() => simulate(unstable, B, options({ horizon: 50 }))).toThrow(/overflow|magnitude|scaling/);
  });
});

describe('complete cubic modes and bounded failures', () => {
  it('checks three independently known real and complex roots', () => {
    close(cubic([6, 11, 6]).map(p => p[0]).sort((a, b) => a - b), [-3, -2, -1]);
    const roots = cubic([6, 21, 26]); expect(roots).toHaveLength(3); roots.forEach(p => expect(p[0]).toBeCloseTo(-2, 10)); close(roots.map(p => p[1]).sort((a, b) => a - b), [-3, 0, 3]);
    close(characteristic3([0, 1, -10, -2, -3, -10, 10, 0, -10]), [13, 132, 420]);
  });
  it('retains repeated-root multiplicity with a justified root-conditioning tolerance', () => {
    cubic([3, 3, 1]).forEach(([re, im]) => { expect(re).toBeCloseTo(-1, 4); expect(im).toBeCloseTo(0, 4); });
    close(cubic([4, 5, 2]).map(p => p[0]).sort((a, b) => a - b), [-2, -1, -1], 5);
  });
  it('rejects loss of observability, controllability and coefficient accuracy', () => {
    for (const sensor of [[0, 0], [1, 1e-12]] as Vector[]) expect(() => designObserver([-1, 0, 0, -2], sensor, [13, 42])).toThrow(/rank/);
    expect(() => designFeedback(A, [0, 0], C, [6, 8])).toThrow(/Controllability rank/);
    expect(() => designObserver([1e-6, 0, 0, -2], [3, 1], [2, 1e-30])).toThrow(/Coefficient verification lost accuracy/);
    expect(() => designObserver(A, [Infinity, 0], [13, 42])).toThrow(/finite/);
    for (const target of [[0, 1], [1, 0], [-1, 2], [NaN, 1], [1, 10001]] as Vector[]) expect(() => designObserver(A, C, target)).toThrow();
  });
  it.each([{ filterTau: -1 }, { filterTau: .0001 }, { filterTau: 11 }, { horizon: 0 }, { horizon: 51 }, { count: 1 }, { count: 1002 }, { count: 2.5 }, { noiseAmplitude: -.1 }, { noiseFrequency: -1 }, { reference: NaN }, { initial: [101, 0] as Vector }])('rejects invalid experiment controls %s', changes => {
    expect(() => simulate(designObserver(A, C, [13, 42]), B, options(changes))).toThrow();
  });
  it('rejects mismatched observer/feedback models', () => {
    expect(() => simulate(designObserver(A, C, [13, 42]), B, options(), designFeedback(A, [1, 1], C, [6, 8]))).toThrow(/same plant/);
  });
});

describe('bounded visual meaning', () => {
  it('accepts actual matrix serialization, signed/compact fractions and both target forms', () => {
    close(parseMatrix(String.raw`B=\begin{bmatrix}0\\ 0\end{bmatrix}`, 2, 1, 'B'), [0, 0]);
    close(parseMatrix(String.raw`C=\begin{bmatrix}-\frac12&0\end{bmatrix}`, 1, 2, 'C'), [-.5, 0]);
    close(parseTarget('q(s)=(s+6)(s+7)'), [13, 42]); close(parseTarget('s^{2}+13s+42'), [13, 42]);
    expect(parseScalar(String.raw`\frac{\frac12}2`)).toBe(.25);
  });
  it.each(['1e-2', '2\\frac12', '{1+2}', '1{+2}', '\\frac10', '1/2', ''])('rejects unsupported scalar %s', text => expect(() => parseScalar(text)).toThrow());
  it.each(['s^2+1e-2', 's^02+13s+42', 's^2.0+13s+42', 's^{2}2+13s+42', 's^+2+13s+42', 's^2+2\\frac12 s+1', 's^2+{s+2}s+1'])('rejects ambiguous target %s', text => expect(() => parseTarget(text)).toThrow());
});
