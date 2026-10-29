import { describe, expect, it } from 'vitest';
import { classify, freeDecomposition, modalSamples, parseModel, poles, simulate, type Experiment } from './math';

const baseline = String.raw`G(z)=\frac{0.2}{z-0.8}`;
const experiment: Experiment = { T: 0.1, count: 20, amplitude: 1, history: [0, 0], input: 'step' };
const run = (formula: string, overrides: Partial<Experiment> = {}) => simulate(parseModel(formula), { ...experiment, ...overrides });

describe('DP01 bounded visual notation', () => {
  it('normalizes the baseline and factored quadratic without reversing delays', () => {
    expect(parseModel(baseline)).toEqual({ a: [1, -0.8], b: [0, 0.2] });
    expect(parseModel(String.raw`\frac{2z+1}{2(z-0.5)(z+0.5)}`)).toEqual({ a: [1, 0, -0.25], b: [0, 1, 0.5] });
    expect(parseModel(String.raw`\frac{z^{2}+1}{z^2+0.5z+0.25}`).b).toEqual([1, 0, 1]);
    expect(parseModel(String.raw`\frac{\frac{1}{2}}{z-\frac{1}{2}}`).b).toEqual([0, 0.5]);
  });
  it.each(['', 'G(s)=1/(s+1)', '\\sin(z)', 'NaN', 'Infinity', '1e309/(z-1)', '1/(z-)', '1/(z+1', '1/z^3', '1/(z^2*z)', 'z^2/(z+1)', '1/0', '1/(z-z)', '1/(0.000000001z+1)', '1000001/(z+1)', '1/((z+1)^2)^2', 'z^-1', 'z^0', '1/(z+1))', '2 3/(z+1)'])('rejects invalid/unsupported %s', value => {
    expect(() => parseModel(value)).toThrow();
  });
  it('bounds expression size and nesting', () => {
    expect(() => parseModel('('.repeat(21) + '1/(z+1)' + ')'.repeat(21))).toThrow(/nested/);
    expect(() => parseModel('z'.repeat(513))).toThrow(/512/);
  });
});

describe('DP01 sequences checked against closed forms', () => {
  it('baseline step is 1−0.8^k including the one-sample delay', () => {
    run(baseline).forEach(row => expect(row.y).toBeCloseTo(1 - 0.8 ** row.k, 12));
    expect(run(baseline).slice(0, 4).map(r => r.y)).toEqual([0, 0.2, 0.36000000000000004, 0.48800000000000004]);
  });
  it('impulse, ramp and free responses use distinct conventions', () => {
    run(baseline, { input: 'impulse' }).forEach(r => expect(r.y).toBeCloseTo(r.k === 0 ? 0 : 0.2 * 0.8 ** (r.k - 1), 12));
    // Ramp response: T[k−5+5(0.8)^k] from summing a geometric series.
    run(baseline, { input: 'ramp' }).forEach(r => expect(r.y).toBeCloseTo(0.1 * (r.k - 5 + 5 * 0.8 ** r.k), 12));
    run(baseline, { input: 'free', history: [2, 77] }).forEach(r => expect(r.y).toBeCloseTo(2 * 0.8 ** (r.k + 1), 12));
  });
  it('changed initial history adds free response without changing forced response', () => {
    const zero = run(baseline);
    run(baseline, { history: [3, 0] }).forEach((r, k) => {
      expect(r.forced).toBe(zero[k].y);
      expect(r.y - zero[k].y).toBeCloseTo(3 * 0.8 ** (k + 1), 12);
    });
  });
  it('negative mode alternates and conjugate pair gives cos(kπ/2) times decay', () => {
    run('1/(z+0.8)', { input: 'free', history: [-1.25, 0] }).forEach(r => expect(r.y).toBeCloseTo((-0.8) ** r.k, 12));
    run('1/(z^2+0.64)', { input: 'free', history: [0, -1.5625] }).forEach(r => expect(r.y).toBeCloseTo(0.8 ** r.k * Math.cos(r.k * Math.PI / 2), 12));
    poles(parseModel('1/(z^2+0.64)')).forEach(p => {
      expect(p.re).toBeCloseTo(0, 12);
      expect(Math.abs(p.im)).toBeCloseTo(0.8, 12);
    });
  });
  it('repeated pole impulse is k(0.5)^(k−1), and zero poles give pure delays', () => {
    run('1/(z-0.5)^2', { input: 'impulse' }).forEach(r => expect(r.y).toBeCloseTo(r.k < 2 ? 0 : (r.k - 1) * 0.5 ** (r.k - 2), 12));
    expect(run('1/z^2', { input: 'impulse', count: 5 }).map(r => r.y)).toEqual([0, 0, 1, 0, 0]);
    expect(run('(z^2+2z+3)/z^2', { input: 'impulse', count: 5 }).map(r => r.y)).toEqual([1, 2, 3, 0, 0]);
  });
  it('direct feedthrough and cancelled channel retain the original free mode', () => {
    expect(run('(z+1)/(z-0.5)', { input: 'impulse', count: 4 }).map(r => r.y)).toEqual([1, 1.5, 0.75, 0.375]);
    const rows = run('(z-2)/((z-2)(z-0.5))', { history: [0, -1], count: 4 });
    expect(poles(parseModel('(z-2)/((z-2)(z-0.5))')).some(p => p.re === 2)).toBe(true);
    expect(rows.map(r => r.free)).toEqual([1, 2.5, 5.25, 10.625]);
  });
  it('time labels change with T while fixed discrete step samples do not', () => {
    const a = run(baseline), b = run(baseline, { T: 0.25 });
    expect(b.map(r => r.y)).toEqual(a.map(r => r.y));
    expect(b[4].t).toBe(1);
    expect(run(baseline, { T: 0.25, input: 'ramp' })[4].y / run(baseline, { input: 'ramp' })[4].y).toBeCloseTo(2.5, 12);
  });
  it('modal formulas and boundary explanation distinguish repeated poles', () => {
    const m = parseModel('1/(z-1)^2');
    expect(freeDecomposition(m, simulate(m, { ...experiment, input: 'free', history: [1, 0] }))).toContain('k]');
    expect(classify({ re: -0.8, im: 0 })).toContain('decays; alternates');
    expect(classify({ re: 1, im: 0 })).toContain('unit circle');
    expect(classify({ re: 1.01, im: 0 })).toContain('grows');
    const r = modalSamples(0.8, Math.PI / 2, 5);
    expect(r[2]).toBeCloseTo(-0.64, 12);
    expect(modalSamples(0.8, 0, 5)[2]).toBeCloseTo(0.64, 12);
  });
  it.each([
    { T: 0 }, { T: Infinity }, { T: 101 }, { count: 201 }, { count: 3 }, { count: 5.5 },
    { amplitude: NaN }, { amplitude: 10001 }, { history: [Infinity, 0] as [number, number] },
  ])('rejects invalid experiment %j', change => expect(() => run(baseline, change)).toThrow());
  it('stops explosive models with useful feedback', () => expect(() => run('1/(z-1000)')).toThrow(/display bound/));
});
