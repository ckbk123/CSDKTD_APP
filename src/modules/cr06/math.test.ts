import { describe, expect, it } from 'vitest';
import { derivative, matrixExp, modes, run, transfer, type Experiment, type Model } from './math';
import { constantText, matrixInput, parseConstant, parseMatrix } from './parser';
const baseline: Model = { A: [[0, 1], [-2, -3]], B: [0, 1], C: [1, 0], D: 0 };
const settings: Experiment = { horizon: 2, count: 41, input: 1, initial1: [0, 0], initial2: [1, 0] };
const closeArray = (actual: number[], expected: number[]): void => {
  expect(actual.length).toBe(expected.length);
  actual.forEach((x, i) => expect(Math.abs(x - expected[i])).toBeLessThan(3e-12 * Math.max(1, Math.abs(expected[i]))));
};
describe('CR06 independent continuous response fixtures', () => {
  it('recovers the mechanical chain and transfer channel', () => {
    expect(derivative(baseline, [2, 3], 4)).toEqual([3, -9]);
    expect(transfer(baseline)).toMatchObject({ numerator: [0, 0, 1], denominator: [1, 3, 2], cancellations: 0 });
    expect(modes(baseline).map(v => v.real).sort((a, b) => a - b)).toEqual([-2, -1]);
  });
  it('matches hand-derived free, forced and total states at every point', () => {
    for (const p of run(baseline, settings).points) {
      const e = Math.exp(-p.t), e2 = Math.exp(-2 * p.t);
      closeArray(p.phi[0], [2 * e - e2, e - e2]); closeArray(p.phi[1], [-2 * e + 2 * e2, -e + 2 * e2]);
      closeArray(p.forced, [.5 - e + .5 * e2, e - e2]); closeArray(p.free2, [2 * e - e2, -2 * e + 2 * e2]);
      expect(p.y1).toBeCloseTo(.5 - e + .5 * e2, 12); expect(p.y2).toBeCloseTo(.5 + e - .5 * e2, 12);
    }
  });
  it('preserves the same forced response across changed initial vectors', () => {
    const a = run(baseline, settings), b = run(baseline, { ...settings, initial1: [3, -2], initial2: [-4, 5] });
    b.points.forEach((p, k) => { expect(p.forced).toEqual(a.points[k].forced); expect(p.yForced).toBe(a.points[k].yForced); closeArray(p.total2.map((v, i) => v - p.total1[i]), p.difference); });
  });
  it('handles the singular two-integrator chain', () => {
    const m: Model = { A: [[0, 1], [0, 0]], B: [0, 1], C: [1, 0], D: 0 };
    for (const p of run(m, { ...settings, input: 3, initial1: [2, -1] }).points) {
      closeArray(p.total1, [2 - p.t + 1.5 * p.t ** 2, -1 + 3 * p.t]); closeArray(p.integral, [p.t ** 2 / 2, p.t]);
    }
  });
  it('handles a scalar integrator and direct feedthrough at time zero', () => {
    const r = run({ A: [[0]], B: [2], C: [-3], D: 4 }, { ...settings, input: 2, initial1: [1], initial2: [-2] });
    for (const p of r.points) { closeArray(p.total1, [1 + 4 * p.t]); expect(p.y1).toBeCloseTo(5 - 12 * p.t, 12); expect(p.yForced).toBeCloseTo(8 - 12 * p.t, 12); }
    expect(r.points[0].y1).toBe(5);
  });
  it('matches a changed stable scalar and negative input', () => {
    const r = run({ A: [[-4]], B: [2], C: [3], D: -1 }, { ...settings, input: -2, initial1: [3], initial2: [0] });
    for (const p of r.points) expect(p.y1).toBeCloseTo(12 * Math.exp(-4 * p.t) - 1, 11);
  });
  it('matches oscillator sine and cosine identities', () => {
    const r = run({ A: [[0, 1], [-1, 0]], B: [0, 1], C: [1, 0], D: 0 }, settings);
    expect(r.modes).toEqual([{ real: 0, imag: 1 }, { real: 0, imag: -1 }]);
    for (const p of r.points) { closeArray(p.forced, [1 - Math.cos(p.t), Math.sin(p.t)]); closeArray(p.free2, [Math.cos(p.t), -Math.sin(p.t)]); }
  });
  it('propagates a defective repeated pole without diagonalization', () => {
    const m: Model = { A: [[-1, 1], [0, -1]], B: [0, 0], C: [1, 0], D: 0 };
    for (const p of run(m, { ...settings, initial1: [0, 1] }).points) closeArray(p.total1, [p.t * Math.exp(-p.t), Math.exp(-p.t)]);
  });
  it('matches a dense changed matrix through an independent Cayley-Hamilton formula', () => {
    const m: Model = { A: [[1, 2], [3, 4]], B: [.5, -1], C: [2, 3], D: .2 };
    const e = { ...settings, input: 2, initial1: [.3, -.4] };
    for (const p of run(m, e).points) {
      const d = Math.sqrt(33) / 2, h = Math.exp(2.5 * p.t), c = Math.cosh(d * p.t), s = Math.sinh(d * p.t) / d;
      const f00 = h * (c - 1.5 * s), f01 = h * 2 * s, f10 = h * 3 * s, f11 = h * (c + 1.5 * s);
      closeArray(p.phi[0], [f00, f01]); closeArray(p.phi[1], [f10, f11]);
      // A^-1=[[-2,1],[1.5,-.5]] is used only by this nonsingular independent oracle.
      const v0 = .5 * (f00 - 1) - f01, v1 = .5 * f10 - (f11 - 1);
      closeArray(p.integral, [-2 * v0 + v1, 1.5 * v0 - .5 * v1]);
      const x0 = .3 * f00 - .4 * f01 + 2 * (-2 * v0 + v1), x1 = .3 * f10 - .4 * f11 + 2 * (1.5 * v0 - .5 * v1);
      closeArray(p.total1, [x0, x1]);
      expect(Math.abs(p.y1 - (2 * x0 + 3 * x1 + .4))).toBeLessThan(1e-10 * Math.max(1, Math.abs(p.y1)));
    }
  });
  it('retains a hidden unstable state after channel cancellation', () => {
    const m: Model = { A: [[1, 0], [0, -2]], B: [0, 1], C: [0, 1], D: 0 };
    const r = run(m, settings);
    expect(r.transfer).toMatchObject({ numerator: [0, 1, -1], denominator: [1, 1, -2], reducedNumerator: [1], reducedDenominator: [1, 2], cancellations: 1 });
    expect(r.modes.some(v => v.real === 1)).toBe(true);
    for (const p of r.points) { expect(p.y1).toBe(p.y2); expect(p.total2[0]).toBeCloseTo(Math.exp(p.t), 12); }
  });
  it('retains a nearby but unequal numerator zero', () => {
    expect(transfer({ A: [[1, 0], [0, -2]], B: [1, 1], C: [1e-9, 1], D: 0 }).cancellations).toBe(0);
  });
  it('retains a nonzero residue even below the precision of expanded numeric coefficients', () => {
    const t = transfer({ A: [[1, 0], [0, -2]], B: [1, 1], C: [2 ** -80, 1], D: 0 });
    // Rounded display coefficients can look identical to the cancelled example.
    // Exact binary-input algebra must still retain both dynamic factors.
    expect(t.numerator).toEqual([0, 1, -1]);
    expect(t.cancellations).toBe(0); expect(t.reducedDenominator).toEqual([1, 1, -2]);
  });
  it('finds an exact cancellation in a coupled mechanical realization', () => {
    const r = run({ ...baseline, C: [2, 1] }, { ...settings, initial2: [1, -2] }), t = r.transfer;
    // (s+2)/((s+1)(s+2)) is the zero-state channel; both states remain.
    expect(t.cancellations).toBe(1); expect(t.reducedNumerator).toEqual([1]); expect(t.reducedDenominator).toEqual([1, 1]);
    expect(t.denominator).toEqual([1, 3, 2]); expect(r.modes).toHaveLength(2);
    for (const p of r.points) {
      expect(p.y1).toBeCloseTo(1 - Math.exp(-p.t), 12); expect(p.y2).toBeCloseTo(p.y1, 12);
      closeArray(p.free2, [Math.exp(-2 * p.t), -2 * Math.exp(-2 * p.t)]);
    }
  });
  it('keeps a tiny positive state mode lost by ordinary determinant subtraction', () => {
    const delta = 2 ** -20;
    const m: Model = { A: [[1000, 1000 + delta], [1000 - delta, 1000]], B: [0, 0], C: [1, 0], D: 0 };
    const r = run(m, { ...settings, horizon: .01, input: 0, initial1: [1e-20, 0], initial2: [0, 0] });
    expect(r.transfer.denominator[2]).toBe(delta * delta);
    const slow = Math.min(...r.modes.map(p => p.real));
    expect(slow).toBeGreaterThan(0); expect(slow / (delta * delta / 2000)).toBeCloseTo(1, 14);
    const expected = .5 * (Math.exp(20) + 1) * 1e-20;
    expect(r.points.at(-1)!.total1[0] / expected).toBeCloseTo(1, 12);
  });
  it('preserves the discriminant sign near a repeated pole', () => {
    const delta = 2 ** -80;
    const real = modes({ A: [[1, 1], [delta, 1]], B: [0, 0], C: [1, 0], D: 0 });
    const complex = modes({ A: [[1, 1], [-delta, 1]], B: [0, 0], C: [1, 0], D: 0 });
    expect(real.map(v => v.real).sort((a, b) => a - b)).toEqual([1 - 2 ** -40, 1 + 2 ** -40]);
    expect(complex).toEqual([{ real: 1, imag: 2 ** -40 }, { real: 1, imag: -(2 ** -40) }]);
  });
  it('cancels an entire complex channel factor while retaining its state modes', () => {
    const m: Model = { A: [[0, 1], [-1, 0]], B: [0, 0], C: [.5, .25], D: 1.5 };
    const r = run(m, settings);
    expect(r.transfer.cancellations).toBe(2); expect(r.transfer.reducedNumerator).toEqual([1.5]); expect(r.transfer.reducedDenominator).toEqual([1]); expect(r.modes).toHaveLength(2);
  });
  it('retains all states for zero and pure feedthrough channels', () => {
    for (const D of [0, 2]) {
      const r = run({ ...baseline, B: [0, 0], D }, settings);
      expect(r.transfer.reducedNumerator).toEqual([D]); expect(r.transfer.reducedDenominator).toEqual([1]); expect(r.modes).toHaveLength(2);
      expect(r.points.at(-1)!.free2.some(v => v !== 0)).toBe(true);
    }
  });
  it('leaves common-time samples unchanged by drawing density', () => {
    const a = run(baseline, { ...settings, count: 21 }), b = run(baseline, settings);
    a.points.forEach((p, k) => expect(p).toEqual(b.points[2 * k]));
  });
  it('computes identity and an independent nilpotent exponential', () => {
    expect(matrixExp([[0, 0], [0, 0]])).toEqual([[1, 0], [0, 1]]);
    expect(matrixExp([[0, 2, 0], [0, 0, 3], [0, 0, 0]])).toEqual([[1, 2, 3], [0, 1, 3], [0, 0, 1]]);
  });
});
describe('CR06 work and input bounds', () => {
  it.each([{ horizon: 0 }, { horizon: Infinity }, { horizon: 11 }, { count: 20 }, { count: 402 }, { count: 40.5 }, { input: NaN }, { input: 10001 }, { initial1: [0] }, { initial2: [0, Infinity] }])('rejects invalid experiment %j', change => expect(() => run(baseline, { ...settings, ...change })).toThrow());
  it('rejects malformed models and excessive matrix work', () => {
    expect(() => run({ ...baseline, A: [[1, 2]] }, settings)).toThrow(/size/);
    expect(() => run({ ...baseline, B: [1] }, settings)).toThrow(/size/);
    expect(() => run({ ...baseline, D: Infinity }, settings)).toThrow(/finite/);
    expect(() => matrixExp([[65]])).toThrow(/norm/);
    expect(() => matrixExp([[NaN]])).toThrow(/finite/);
    expect(() => matrixExp([[1, 0]])).toThrow(/square/);
  });
  it('reports excessive unstable response', () => {
    expect(() => run({ A: [[6]], B: [0], C: [1], D: 0 }, { ...settings, horizon: 10, initial1: [1], initial2: [0] })).toThrow(/10¹⁰/);
  });
  it('reports an unsupported characteristic coefficient scale without erasing it', () => {
    expect(() => modes({ A: [[1e-155, 0], [0, 1e-155]], B: [0, 0], C: [1, 0], D: 0 })).toThrow(/Rescale/);
  });
});
describe('CR06 visual constant and matrix grammar', () => {
  it.each(['\\frac12', '\\frac{1}2', '\\frac1{2}', '\\frac{1}{2}', '(1)/(2)'])('reads equivalent ratio %s', s => expect(parseConstant(s)).toBe(.5));
  it.each(['-\\frac12', '(-\\frac12)', '\\frac{-1}2', '\\frac1{-2}', '-\\frac{\\mathrm{1}}2'])('preserves signed ratio %s', s => expect(parseConstant(s)).toBe(-.5));
  it('reads nested fractions, arithmetic and numeric font wrappers', () => {
    expect(parseConstant('\\frac{\\frac12}{2}')).toBe(.25); expect(parseConstant('2*(.5+1)')).toBe(3); expect(parseConstant('\\frac{\\mathrm{2}}{\\mathsf{4}}')).toBe(.5);
  });
  it.each(['2\\frac12', '-2\\frac12', '(2\\frac12)', '\\frac{2\\frac12}{3}', '{2}\\frac12', '\\mathrm{2}\\frac12', '2{\\frac12}'])('rejects mixed-number adjacency before normalization %s', s => expect(() => parseConstant(s)).toThrow(/explicit \+.*×/));
  it.each(['{2+3}*4', '1{+2}', '-{2+3}', '\\frac1{{2+3}}'])('rejects invisible algebraic grouping %s', s => expect(() => parseConstant(s)).toThrow(/visible parentheses|explicit \+.*×/));
  it('preserves visible grouping, explicit operators and compact nested arguments', () => {
    expect(parseConstant('2+\\frac12')).toBe(2.5);
    expect(parseConstant('2\\times\\frac12')).toBe(1);
    expect(parseConstant('(2+3)*4')).toBe(20);
    expect(parseConstant('\\frac1\\frac12')).toBe(2);
  });
  it('preserves row-major matrix/vector dimensions', () => {
    expect(parseMatrix('A=\\begin{bmatrix}0&1\\\\-2&-3\\end{bmatrix}', 2, 2, 'A')).toEqual(baseline.A);
    expect(parseMatrix('\\left[\\begin{matrix}0\\\\\\frac12\\end{matrix}\\right]', 2, 1, 'B')).toEqual([[0], [.5]]);
    expect(parseMatrix('\\begin{pmatrix}1&0\\end{pmatrix}', 1, 2, 'C')).toEqual([[1, 0]]);
    expect(parseMatrix('-.5', 1, 1, 'D')).toEqual([[-.5]]);
  });
  it.each(['', '1e-2', '1E3', '\\mathrm{e}', 's', 'sin(1)', '2^2', '1/0', '1 2', '--1', '1+', '(1', '10001', '\\frac1{}'])('rejects unsupported/malformed %s', s => expect(() => parseConstant(s)).toThrow());
  it('preserves native numeric precision when filling a visual matrix', () => {
    const values = [[1e-7, .1234567890123456], [-1e-150, 0]];
    expect(parseMatrix(matrixInput(values), 2, 2, 'A')).toEqual(values);
    expect(constantText(1e-7)).toBe('0.0000001');
    expect(() => constantText(1e-200)).toThrow(/160/);
    expect(() => constantText(Infinity)).toThrow(/finite/);
  });
  it('bounds nesting, length and dimensions', () => {
    expect(() => parseConstant('('.repeat(13) + '1' + ')'.repeat(13))).toThrow(/nested/);
    expect(() => parseConstant('1'.repeat(161))).toThrow(/160/);
    expect(() => parseMatrix('\\begin{bmatrix}1&2\\end{bmatrix}', 2, 1, 'B')).toThrow(/rows/);
    expect(() => parseMatrix('1,2;3,4', 2, 2, 'A')).toThrow(/template/);
  });
});
