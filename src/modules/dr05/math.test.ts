import { describe, expect, it } from 'vitest';
import { approximate, exactInterval, matrixExp, realize, run, transfer, type Experiment, type Matrix } from './math';
import { parseModel } from './parser';
const source = (s: string) => realize(parseModel(s));
const base: Experiment = { T: 0.1, count: 11, density: 4, delay: 0, amplitude: 1, initial: [0], input: 'step', method: 'forward' };
const near = (a: Matrix, b: Matrix, precision = 12): void => a.forEach((r, i) => r.forEach((v, j) => expect(v).toBeCloseTo(b[i][j], precision)));

describe('DR05 exact held-input conversion', () => {
  it('matches scalar e^-T and input integral with independently derived samples', () => {
    const plant = source('1/(s+1)'), result = run(plant, base);
    expect(result.exact.A[0][0]).toBeCloseTo(Math.exp(-0.1), 14);
    expect(result.exact.B[0]).toBeCloseTo(-Math.expm1(-0.1), 14);
    result.samples.forEach(r => expect(r.y).toBeCloseTo(1 - Math.exp(-r.t), 13));
    expect(result.samples[1].y).toBeCloseTo(0.09516258196404043, 14);
    const tf = transfer(plant, result.exact, base.T);
    expect(tf.b[0]).toBe(0); expect(tf.b[1]).toBeCloseTo(0.09516258196404043, 14);
    expect(tf.a[1]).toBeCloseTo(-0.9048374180359595, 14);
  });
  it('worksheet T=.2 changes the physical model, while drawing density does not', () => {
    const plant = source('1/(s+1)');
    const result = run(plant, { ...base, T: 0.2 });
    expect(result.samples[1].y).toBeCloseTo(0.18126924692201818, 14);
    expect(result.exact.A[0][0]).toBeCloseTo(0.8187307530779818, 14);
    expect(run(plant, { ...base, density: 16 }).samples).toEqual(run(plant, { ...base, density: 2 }).samples);
  });
  it('handles singular A: single and double integrators without inverse(A)', () => {
    const single = run(source('1/s'), base);
    expect(single.exact).toEqual({ A: [[1]], B: [0.1] });
    single.samples.forEach(r => expect(r.y).toBeCloseTo(r.t, 13));
    const plant = source('1/s^2'), result = run(plant, { ...base, initial: [0, 0] });
    near(result.exact.A, [[1, 0.1], [0, 1]]); near(result.exact.B.map(v => [v]), [[0.005], [0.1]]);
    result.samples.forEach(r => expect(r.y).toBeCloseTo(r.t ** 2 / 2, 13));
    const tf = transfer(plant, result.exact, base.T); near([tf.a], [[1, -2, 1]]); near([tf.b], [[0, 0.005, 0.005]]);
  });
  it('checks the separately declared delayed 5/s² source path', () => {
    const plant = source('5/s^2');
    const result = run(plant, { ...base, T: 0.2, delay: 1, initial: [0, 0], count: 5 });
    near([result.samples.map(r => r.y)], [[0, 0, 0.1, 0.4, 0.9]]);
    const tf = transfer(plant, result.exact, 0.2); near([tf.a], [[1, -2, 1]]); near([tf.b], [[0, 0.1, 0.1]]);
  });
  it('checks oscillator rotation and input integral using sine/cosine identities', () => {
    const T = 0.3, plant = source('1/(s^2+1)');
    const result = run(plant, { ...base, T, initial: [0, 0] });
    near(result.exact.A, [[Math.cos(T), Math.sin(T)], [-Math.sin(T), Math.cos(T)]]);
    near([result.exact.B], [[1 - Math.cos(T), Math.sin(T)]]);
    result.samples.forEach(r => expect(r.y).toBeCloseTo(1 - Math.cos(r.t), 12));
    result.segments.flat().forEach(p => expect(p.y).toBeCloseTo(1 - Math.cos(p.t), 12));
  });
  it('checks repeated and distinct real modes against independent continuous step formulas', () => {
    const critical = run(source('1/(s+1)^2'), { ...base, initial: [0, 0] });
    critical.samples.forEach(r => expect(r.y).toBeCloseTo(1 - (1 + r.t) * Math.exp(-r.t), 12));
    const mechanical = run(source('1/((s+1)(s+2))'), { ...base, initial: [0, 0] });
    mechanical.samples.forEach(r => expect(r.y).toBeCloseTo(0.5 - Math.exp(-r.t) + 0.5 * Math.exp(-2 * r.t), 12));
  });
  it('retains direct feedthrough and right-hand jumps at sample instants', () => {
    const result = run(source('(s+1)/(s+1)'), { ...base, input: 'pulse', delay: 2, count: 6 });
    expect(result.samples.map(r => r.y)).toEqual([0, 0, 1, 0, 0, 0]);
    expect(result.segments[2].at(-1)!.y).toBe(1); // t=3T left limit.
    expect(result.segments[3][0].y).toBe(0); // t=3T right limit.
  });
  it('uses zero delayed-input history and initial plant state independently', () => {
    const result = run(source('1/(s+1)'), { ...base, initial: [2], delay: 2 });
    expect(result.samples[0].y).toBe(2);
    expect(result.samples[2].y).toBeCloseTo(2 * Math.exp(-0.2), 13);
    expect(result.samples[3].y).toBeCloseTo(2 * Math.exp(-0.3) + 1 - Math.exp(-0.1), 13);
    const pulse = run(source('1/(s+1)'), { ...base, input: 'pulse' });
    pulse.samples.slice(1).forEach(r => expect(r.y).toBeCloseTo((1 - Math.exp(-0.1)) * Math.exp(-(r.k - 1) * 0.1), 13));
  });
  it('uses physical sampled ramp values and exact held-interval reconstruction', () => {
    const result = run(source('1/s'), { ...base, input: 'ramp' });
    result.samples.forEach(r => expect(r.y).toBeCloseTo(0.1 ** 2 * r.k * (r.k - 1) / 2, 13));
    result.segments[2].forEach(p => expect(p.y).toBeCloseTo(0.01 + 0.2 * (p.t - 0.2), 13));
  });
  it('retains sound state samples but rejects an ill-conditioned scalar conversion', () => {
    const plant = source('1/((s-60)(s+0.01))');
    const result = run(plant, { ...base, T: 1, count: 4, density: 16, amplitude: 1e-70, initial: [0, 0] });
    // Partial fractions independently integrate the two continuous modes.
    for (const row of result.samples.slice(1)) {
      const expected = 1e-70 * (Math.expm1(60 * row.t) / 60 - Math.expm1(-.01 * row.t) / -.01) / 60.01;
      expect(Math.abs(row.y / expected - 1)).toBeLessThan(1e-11);
    }
    // The true pole product is exp(60)*exp(-.01)=exp(59.99),
    // about 1.130644226e26, not the catastrophic determinant of rounded Ad.
    expect(Math.exp(59.99) / 1.130644226e26).toBeCloseTo(1, 9);
    expect(() => transfer(plant, result.exact, 1)).toThrow(/Scalar transfer and recurrence unavailable/);
  });
  it('recovers reliable scalar coefficients when the same source uses a smaller T', () => {
    const plant = source('1/((s-60)(s+0.01))'), T = .1, d = exactInterval(plant, T), tf = transfer(plant, d, T);
    const p = Math.exp(60 * T), q = Math.exp(-.01 * T), h1 = Math.expm1(60 * T) / 60, h2 = Math.expm1(-.01 * T) / -.01;
    // ZOH modal geometric sequences give these coefficients independently.
    const expectedA = [1, -p - q, p * q], expectedB = [0, (h1 - h2) / 60.01, (p * h2 - q * h1) / 60.01];
    [tf.a, tf.b].forEach((values, i) => values.forEach((v, j) => expect(Math.abs(v - [expectedA, expectedB][i][j])).toBeLessThan(1e-11 * Math.max(1, Math.abs(v)))));
  });
});

describe('DR05 selected interval approximations and safeguards', () => {
  it('checks all three methods against scalar rational formulas', () => {
    const plant = source('1/(s+1)');
    const f = approximate(plant, 0.1, 'forward'), b = approximate(plant, 0.1, 'backward'), t = approximate(plant, 0.1, 'trapezoid');
    near(f.A, [[0.9]]); near([f.B], [[0.1]]);
    near(b.A, [[1 / 1.1]]); near([b.B], [[0.1 / 1.1]]);
    near(t.A, [[0.95 / 1.05]]); near([t.B], [[0.1 / 1.05]]);
  });
  it('compares finite-grid errors and refinement without changing the physical horizon', () => {
    const coarse = run(source('1/(s+1)'), base), fine = run(source('1/(s+1)'), { ...base, T: 0.05, count: 21 });
    expect(coarse.comparison![10].y).toBeCloseTo(1 - 0.9 ** 10, 13);
    expect(coarse.maxError).toBeCloseTo(Math.exp(-1) - 0.9 ** 10, 12);
    expect(fine.maxError!).toBeLessThan(coarse.maxError!);
  });
  it('keeps exact results when an implicit approximation is singular', () => {
    const result = run(source('1/(s-1)'), { ...base, T: 1, count: 4, method: 'backward' });
    expect(result.warning).toContain('singular'); expect(result.comparison).toBeUndefined();
    expect(result.samples[3].y).toBeCloseTo(Math.exp(3) - 1, 11);
  });
  it('reports approximation blowup independently from a stable exact run', () => {
    const result = run(source('1/(s+1)'), { ...base, T: 3, count: 120 });
    expect(result.warning).toContain('Approximation unavailable'); expect(result.samples.at(-1)!.y).toBeCloseTo(1, 12);
  });
  it('explains when the displayed horizon has no full interval after delayed input arrival', () => {
    const result = run(source('1/(s+1)'), { ...base, count: 4, delay: 3 });
    expect(result.samples.map(r => r.y)).toEqual([0, 0, 0, 0]);
    expect(result.samples[3].held).toBe(1);
    expect(result.warning).toContain('No full held interval');
  });
  it('flags a coarse drawing compared with source pole scales without altering exact samples', () => {
    const plant = source('1/(s+4)');
    const coarse = run(plant, { ...base, T: 1, count: 4, density: 2 });
    const fine = run(plant, { ...base, T: 1, count: 4, density: 16 });
    expect(coarse.warning).toContain('Drawing intervals'); expect(fine.warning).not.toContain('Drawing intervals');
    expect(coarse.samples).toEqual(fine.samples);
    expect(coarse.samples[1].y).toBeCloseTo((1 - Math.exp(-4)) / 4, 13);
  });
  it('validates the finite augmented matrix norm and input dimensions', () => {
    expect(() => matrixExp([[65]])).toThrow(/norm/);
    expect(() => matrixExp([[NaN]])).toThrow(/finite/);
    expect(() => matrixExp([[0, 1]])).toThrow(/square/);
    expect(() => exactInterval(source('1/s'), -1)).toThrow(/interval/);
    near(matrixExp([[0, 1, 0], [0, 0, 1], [0, 0, 0]]), [[1, 1, 0.5], [0, 1, 1], [0, 0, 1]]);
    expect(() => run(source('1/(s+1000)'), base)).toThrow(/norm/);
  });
  it.each([{ T: 0 }, { T: NaN }, { T: 11 }, { count: 121 }, { count: 3 }, { density: 1 }, { density: 17 }, { density: 2.1 }, { delay: 1.5 }, { delay: 13 }, { amplitude: Infinity }, { initial: [] }, { initial: [10001] }])('rejects out-of-domain inputs %j', edit => {
    expect(() => run(source('1/(s+1)'), { ...base, ...edit })).toThrow();
  });
});

describe('DR05 visual expression grammar', () => {
  it('accepts braced and actual MathLive compact fraction forms and proper feedthrough', () => {
    expect(parseModel(String.raw`G\left(s\right)=\frac{\frac12}{s+\frac12}`)).toEqual({ a: [1, 0.5], b: [0, 0.5] });
    expect(parseModel(String.raw`\frac{s^2+2s+1}{(s+1)(s+2)}`)).toEqual({ a: [1, 3, 2], b: [1, 2, 1] });
  });
  it('preserves compact/mixed fraction arguments, outer grouping and unary signs', () => {
    for (const coefficient of [String.raw`\frac12`, String.raw`\frac{1}2`, String.raw`\frac1{2}`, String.raw`\frac{1}{2}`]) {
      expect(parseModel(`${coefficient}/(s+${coefficient})`)).toEqual({ a: [1, 0.5], b: [0, 0.5] });
    }
    for (const expression of [String.raw`-\frac{\frac12}{s+\frac12}`, String.raw`\frac{-\frac12}{s+\frac12}`, String.raw`-\left(\frac{\frac12}{s+\frac12}\right)`]) {
      const model = parseModel(expression);
      expect(model).toEqual({ a: [1, 0.5], b: [0, -0.5] });
      expect(run(realize(model), base).samples[1].y).toBeCloseTo(Math.expm1(-0.05), 13);
    }
  });
  it('accepts numeric-only font wrappers from pasted fraction entry without hiding unsupported algebra', () => {
    for (const input of [String.raw`\frac{\mathrm{1}}{s+1}`, String.raw`\frac{\mathrm1}{s+1}`, String.raw`\frac{\mathit{1}}{s+1}`, String.raw`\frac{\text{1}}{s+1}`]) {
      expect(parseModel(input)).toEqual({ a: [1, 1], b: [0, 1] });
    }
    expect(parseModel(String.raw`-\frac{\mathbf{1}}{s+1}`).b).toEqual([0, -1]);
    expect(() => parseModel(String.raw`\mathrm{1e-2}/(s+1)`)).toThrow();
    expect(() => parseModel(String.raw`\text{s+1}/(s+2)`)).toThrow();
  });
  it.each(['', 'G(z)=1/(z+1)', '\\sin(s)', 'NaN', '(1e-2)/(s+1)', '1e3/(s+1)', '1/(s+)', '1/(s-s)', '1/(s^3+1)', 's^2/(s+1)', '1/(0.000000001s+1)', '1000001/(s+1)', '1/(s+1))'])('rejects malformed/unsupported %s', s => expect(() => parseModel(s)).toThrow());
  it.each(['2\\frac12/(s+1)', '-2\\frac12/(s+1)', '(2\\frac12)/(s+1)', '{2\\frac12}/(s+1)', '\\frac{2\\frac12}{s+1}', '{2}\\frac12/(s+1)', '\\mathrm{2}\\frac12/(s+1)', '2{\\frac12}/(s+1)'])('rejects displayed mixed/invisible adjacency %s', s => {
    expect(() => parseModel(s)).toThrow(/explicit \+.*×/);
  });
  it('preserves explicit addition/products and ordinary nested compact arguments', () => {
    expect(parseModel('\\frac{2+\\frac12}{s+1}').b).toEqual([0, 2.5]);
    expect(parseModel('\\frac{2\\times\\frac12}{s+1}').b).toEqual([0, 1]);
    expect(parseModel('\\frac1\\frac12/(s+1)').b).toEqual([0, 2]);
    expect(parseModel('2(\\frac12)/(s+1)').b).toEqual([0, 1]);
  });
  it('bounds input length and rejects nonzero underflow before constructing a plant', () => {
    expect(() => parseModel('s'.repeat(513))).toThrow(/512/);
    const tiny = '0.' + '0'.repeat(400) + '1';
    expect(() => parseModel(`${tiny}/(s+1)`)).toThrow(/nonzero decimal/);
  });
});
