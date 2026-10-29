import { describe, expect, it } from 'vitest';
import { classify, freeDecomposition, impulseDecomposition, modalSamples, parseModel, poles, simulate, type Experiment } from './math';

const baseline = String.raw`G(z)=\frac{0.2}{z-0.8}`;
const experiment: Experiment = { T: 0.1, count: 20, amplitude: 1, history: [0, 0], input: 'step' };
const run = (formula: string, overrides: Partial<Experiment> = {}) => simulate(parseModel(formula), { ...experiment, ...overrides });

describe('DP01 TeX argument spacing', () => {
  it.each([String.raw`\frac1\;2`, String.raw`\frac\,12`, String.raw`2^\;2`, String.raw`\frac1\;`, '\\frac1\u20092', '2^\u20092', String.raw`\frac1\left\;2`, String.raw`2^\left\;2`, String.raw`\frac{1}{\left\;2}`, String.raw`\left\;2`, String.raw`\frac\left(1\right)\;2`])('rejects an empty spacing argument in %s', coefficient => {
    expect(() => parseModel(String.raw`G(z)=\frac{${coefficient}}{z-.5}`)).toThrow(/blank space cannot fill a box/);
  });
  it.each([[String.raw`\frac1{\;2}`, .5], [String.raw`\frac{\,1}{2}`, .5], [String.raw`2^{\;2}`, 4], [String.raw`\frac 1{2}`, .5], [String.raw`\frac{\frac1{\;2}}{2}`, .25], ['\\frac1{\u20092}', .5], ['2^{\u20092}', 4], [String.raw`2^\left(\;2\right)`, 4]] as const)('preserves scoped spacing and fraction arguments in %s', (coefficient, gain) => {
    expect(parseModel(String.raw`G(z)=\frac{${coefficient}}{z-.5}`)).toEqual({ a: [1, -.5], b: [0, gain] });
  });
});

describe('DP01 bounded visual notation', () => {
  it('normalizes the baseline and factored quadratic without reversing delays', () => {
    expect(parseModel(baseline)).toEqual({ a: [1, -0.8], b: [0, 0.2] });
    expect(parseModel(String.raw`\frac{2z+1}{2(z-0.5)(z+0.5)}`)).toEqual({ a: [1, 0, -0.25], b: [0, 1, 0.5] });
    expect(parseModel(String.raw`\frac{z^{2}+1}{z^2+0.5z+0.25}`).b).toEqual([1, 0, 1]);
    expect(parseModel(String.raw`\frac{\frac{1}{2}}{z-\frac{1}{2}}`).b).toEqual([0, 0.5]);
    expect(parseModel(String.raw`\frac12/(z-\frac12)`)).toEqual({ a: [1, -0.5], b: [0, 0.5] });
    expect(parseModel(String.raw`G\left(z\right)=\frac1{z-\frac12}`)).toEqual({ a: [1, -0.5], b: [0, 1] });
  });
  it.each(['', 'G(s)=1/(s+1)', '\\sin(z)', 'NaN', 'Infinity', '1e309/(z-1)', '1/(z-)', '1/(z+1', '1/z^3', '1/(z^2*z)', 'z^2/(z+1)', '1/0', '1/(z-z)', '1/(0.000000001z+1)', '1000001/(z+1)', '1/((z+1)^2)^2', 'z^-1', 'z^0', '1/(z+1))', '2 3/(z+1)'])('rejects invalid/unsupported %s', value => {
    expect(() => parseModel(value)).toThrow();
  });
  it('bounds expression size and nesting', () => {
    expect(() => parseModel('('.repeat(21) + '1/(z+1)' + ')'.repeat(21))).toThrow(/nested/);
    expect(() => parseModel('z'.repeat(513))).toThrow(/512/);
  });
  it.each([
    String.raw`2\frac12`, String.raw`-2\frac{1}{2}`, String.raw`0\frac12`, String.raw`0.5\frac12`,
    String.raw`-{2}\frac12`, String.raw`{{-2}}\tfrac12`, String.raw`-\left(2\frac12\right)`,
    String.raw`2\,\dfrac12`, String.raw`\frac{2\frac12}{2}`, String.raw`\frac1{2\frac12}`,
    String.raw`2{\frac12}`, String.raw`-{2}{\frac12}`, String.raw`2{{\frac12}}`,
    String.raw`2{-\frac12}`, String.raw`\frac{2{\frac12}}{2}`,
  ])('rejects mixed-number adjacency before normalization changes its meaning: %s', expression => {
    // A displayed 2½ means 2 + 1/2, whereas implicit multiplication gives 1.
    // Require an explicit operator rather than selecting either interpretation.
    expect(() => parseModel(String.raw`G(z)=\frac{${expression}}{z-.8}`)).toThrow(/explicit \+ or ×/);
  });
  it.each([
    [String.raw`2+\frac12`, 2.5], [String.raw`-(2+\frac12)`, -2.5],
    [String.raw`2\times\frac12`, 1], [String.raw`-{2}\times\frac12`, -1],
    [String.raw`\frac{2+\frac12}{2}`, 1.25], [String.raw`\frac{2\times\frac12}{2}`, .5],
    [String.raw`\frac12`, .5], [String.raw`\frac1\frac23`, 1.5],
    [String.raw`\frac12\frac34`, .375], [String.raw`(2)\frac12`, 1],
    [String.raw`2+{\frac12}`, 2.5], [String.raw`2\times{\frac12}`, 1], [String.raw`2(3+\frac12)`, 7],
  ] as const)('preserves explicit arithmetic and unambiguous fractions: %s', (expression, gain) => {
    const model = parseModel(String.raw`G(z)=\frac{${expression}}{z-.8}`);
    expect(model).toEqual({ a: [1, -.8], b: [0, gain] });
    // The independent first impulse sample after this one-sample delay is gain.
    expect(simulate(model, { ...experiment, input: 'impulse', count: 4 })[1].y).toBe(gain);
  });
  it('preserves fraction multiplication after a visible variable power', () => {
    for (const power of ['z^2', 'z^{2}']) {
      for (const factor of [String.raw`\frac12`, String.raw`{\frac12}`]) {
        expect(parseModel(String.raw`\frac{${power}${factor}}{z^2+.25}`)).toEqual({ a: [1, 0, .25], b: [.5, 0, 0] });
      }
    }
  });
  it.each([
    String.raw`1{+2}`, String.raw`2{+\frac12}`, String.raw`-{2+3}`,
    String.raw`{z+2}z`, String.raw`z{-2}`, String.raw`{-2}^2`,
  ])('rejects hidden brace grouping that would change the visible expression: %s', expression => {
    expect(() => parseModel(String.raw`\frac{${expression}}{z^2+.25}`)).toThrow(/visible parentheses/);
  });
  it('does not turn a displayed first-order denominator into a quadratic using hidden braces', () => {
    expect(() => parseModel(String.raw`\frac1{{z+2}z}`)).toThrow(/visible parentheses/);
  });
  it.each([
    [String.raw`1(+2)`, 2], [String.raw`(1+2)`, 3], [String.raw`2+(\frac12)`, 2.5],
    [String.raw`-(2+3)`, -5], [String.raw`{2}`, 2], [String.raw`{{-2}}`, -2],
    [String.raw`{\frac12}`, .5], [String.raw`{-\frac12}`, -.5],
    [String.raw`{(2+3)}`, 5], [String.raw`{2}^2`, 4],
  ] as const)('retains visible grouping and atomic numeric/fraction wrappers: %s', (expression, gain) => {
    expect(parseModel(String.raw`\frac{${expression}}{z-.8}`)).toEqual({ a: [1, -.8], b: [0, gain] });
  });
  it('rejects nonzero literal, coefficient-product and normalization underflow', () => {
    const literal = '0.' + '0'.repeat(400) + '1';
    const factor = '0.' + '0'.repeat(199) + '1';
    const numerator = '0.' + '0'.repeat(319) + '1';
    expect(() => parseModel(`${literal}/(z-0.8)`)).toThrow(/nonzero decimal/);
    expect(() => parseModel(`${factor}*${factor}/(z-0.8)`)).toThrow(/coefficient product/);
    expect(() => parseModel(`${numerator}/(1000000z-0.8)`)).toThrow(/normalized coefficient/);
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
  it('decomposes independent real, conjugate, repeated and zero-pole histories', () => {
    const equation = (s: string, history: [number, number]) => {
      const m = parseModel(s); return freeDecomposition(m, simulate(m, { ...experiment, input: 'free', history }));
    };
    // Histories chosen from f[k]=2(0.5)^k+3(−0.5)^k, so f[−1]=−2 and f[−2]=20.
    expect(equation('1/(z^2-0.25)', [-2, 20])).toBe('y_{free}[k]=(3)(-0.5)^{k}+(2)(0.5)^{k}');
    expect(equation('1/(z^2+0.64)', [0, -1.5625])).toContain('(1)\\cos(1.5708k)');
    expect(equation('1/(z-1)^2', [1, 0])).toBe('y_{free}[k]=[(2)+(1)k](1)^{k}');
    expect(equation('1/z^2', [1, 2])).toBe('y_{free}[k]=0');
    expect(impulseDecomposition(parseModel(baseline))).toBe('h[0]=0;\\quad h[k]=(0.2)(0.8)^{(k-1)}\\quad(k\\geq1)');
    expect(impulseDecomposition(parseModel('1/z^2'))).toContain('(1)\\delta[(k-2)]');
    expect(impulseDecomposition(parseModel('1/(z-0.5)^2'))).toContain('[(1)+(1)(k-2)](0.5)^{(k-2)}');
  });
  it.each([
    { T: 0 }, { T: Infinity }, { T: 101 }, { count: 201 }, { count: 3 }, { count: 5.5 },
    { amplitude: NaN }, { amplitude: 10001 }, { history: [Infinity, 0] as [number, number] },
  ])('rejects invalid experiment %j', change => expect(() => run(baseline, change)).toThrow());
  it('stops explosive models with useful feedback', () => expect(() => run('1/(z-1000)')).toThrow(/display bound/));
  it('keeps a valid scaled experiment independent from the unit-kernel explanation bound', () => {
    const m = parseModel('z/(z-10000)');
    const rows = simulate(m, { ...experiment, count: 4, input: 'impulse', amplitude: 0.0001 });
    expect(rows.map(r => r.y)).toEqual([0.0001, 1, 10000, 1e8]);
    expect(impulseDecomposition(m)).toContain('(10000)');
  });
});
