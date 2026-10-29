import { describe, expect, it } from 'vitest';
import { classify, locate, parsePole, realDimension, realization, samples, validateModel, type Mode } from './math';

const mode = (re: number, structure: Mode['structure'] = 'simple', visible = true, im = 0): Mode => ({ pole: { re, im }, structure, visible });

describe('bounded visual complex-pole grammar', () => {
  it.each([
    ['0.8', .8, 0], ['(-.8)', -.8, 0], ['−1', -1, 0], ['j', 0, 1], ['-i', 0, -1],
    [String.raw`\left(\frac{3}{5}+\frac{4}{5}\mathrm{j}\right)`, .6, .8],
    [String.raw`0.6-0.8\cdot j`, .6, -.8], ['-j+0.2', .2, -1], [String.raw`\frac{-1}{2}`, -.5, 0],
    [String.raw`\frac12`, .5, 0], [String.raw`-\frac1{20}`, -.05, 0], [String.raw`\frac{12}8`, 1.5, 0],
    [String.raw`\frac35+\frac45j`, .6, .8],
    [String.raw`-\left(\frac12\right)`, -.5, 0], [String.raw`\left(-\frac12\right)`, -.5, 0],
    ['-(0.6+0.8j)', -.6, -.8], ['-(-(.8))', .8, 0], ['((((.8))))', .8, 0], ['-(j)', 0, -1],
    [String.raw`\frac{\mathrm{1}}{2}`, .5, 0], [String.raw`-\frac{\mathrm{1}}{\mathrm{2}}`, -.5, 0],
    [String.raw`\mathrm1`, 1, 0], [String.raw`\mathrm{0.6}+\mathrm{0.8}j`, .6, .8],
  ])('parses %s', (text, re, im) => expect(parsePole(text)).toEqual({ re, im }));
  it.each(['', '()', '-()', '(())', '(((((.8)))))', '-(.6)+.8j', 'NaN', 'Infinity', '3', '2+2j', 'z^2', '0.8^k', '0.2+0.3', 'j+j', '1/2', 'sin(1)', '1+', '+', String.raw`\frac{1}{0}`, String.raw`\frac10`, String.raw`\frac123`, String.raw`\frac{1}{\frac12}`, String.raw`\placeholder{}`, '1e-2', '1E-2', '1**j', '0.5jtrash', '0.8*', 'x'.repeat(201)])('rejects %s', text => expect(() => parsePole(text)).toThrow());
  it.each([String.raw`\mathrm{1e-2}`, String.raw`\text{1e2}`])('rejects algebra inside a numeric font wrapper: %s', text => expect(() => parsePole(text)).toThrow());
});

describe('independent modal fixtures', () => {
  it('baseline is two decaying modes; a negative pole alternates', () => {
    const modes = [mode(.8), mode(-.8)];
    expect(classify(modes)).toEqual({ internal: 'decays', bibo: 'stable' });
    const expected = [1, -.8, .64, -.512, .4096];
    samples(modes[1], .1, 4).forEach((sample, k) => {
      expect(sample.first).toBeCloseTo(expected[k], 13);
      expect(sample.norm).toBeCloseTo(Math.abs(expected[k]), 13);
      expect(sample.t).toBeCloseTo(k / 10, 14);
    });
  });
  it.each([1, -1])('simple and independent repeats at %s are bounded but not BIBO stable', p => {
    for (const structure of ['simple', 'independent'] as const) {
      expect(classify([mode(p, structure)])).toEqual({ internal: 'bounded', bibo: 'unstable' });
      expect(samples(mode(p, structure), .2, 6).map(s => s.norm)).toEqual([1, 1, 1, 1, 1, 1, 1]);
    }
  });
  it('a length-2 Jordan block at 1 gives [k,1], so its norm is sqrt(k²+1)', () => {
    const block = mode(1, 'jordan2');
    expect(classify([block]).internal).toBe('grows');
    samples(block, .1, 8).forEach(s => {
      expect(s.first).toBe(s.k);
      expect(s.norm).toBeCloseTo(Math.sqrt(s.k * s.k + 1), 13);
    });
  });
  it('length-3 Jordan block at -1 has binomial growth and alternating signs', () => {
    const points = samples(mode(-1, 'jordan3'), 1, 4);
    expect(points.map(s => s.first)).toEqual([0, 0, 1, -3, 6]);
    expect(points[4].norm).toBeCloseTo(Math.sqrt(53), 13); // vector [6,-4,1]
  });
  it('a defective pole strictly inside still decays asymptotically, despite initial growth', () => {
    const block = mode(.8, 'jordan3');
    expect(classify([block]).internal).toBe('decays');
    expect(samples(block, .1, 80)[80].norm).toBeLessThan(.0001);
  });
  it('a complex conjugate pair has an exact hand-derived first rotation', () => {
    const points = samples(mode(.6, 'simple', true, .8), .5, 4);
    expect(points.map(s => Number(s.first.toFixed(4)))).toEqual([1, .6, -.28, -.936, -.8432]);
    points.forEach(s => expect(s.norm).toBeCloseTo(1, 13));
    expect(classify([mode(.6, 'simple', true, .8)]).internal).toBe('bounded');
  });
  it('zero Jordan blocks are nilpotent; 0^0 is handled at the correct delay', () => {
    expect(samples(mode(0, 'jordan3'), 1, 4).map(s => s.first)).toEqual([0, 0, 1, 0, 0]);
    expect(samples(mode(0, 'jordan3'), 1, 4).map(s => s.norm)).toEqual([1, 1, 1, 0, 0]);
  });
  it('hiding an unstable mode stabilizes only the channel, preserving internal growth', () => {
    const modes = [mode(.8), mode(1.2, 'simple', false)];
    expect(classify(modes)).toEqual({ internal: 'grows', bibo: 'stable' });
    expect(classify([mode(1, 'jordan3', false)])).toEqual({ internal: 'grows', bibo: 'stable' });
  });
  it('flags near-circle rounding rather than certifying a strict side', () => {
    for (const p of [1 - 1e-10, 1 + 1e-10]) {
      expect(locate({ re: p, im: 0 })).toBe('near-boundary');
      expect(classify([mode(p)])).toEqual({ internal: 'uncertain', bibo: 'uncertain' });
    }
    expect(locate({ re: 1.001, im: 0 })).toBe('outside');
  });
  it('does not mistake a radius rounded to 1 for an exact boundary', () => {
    expect(Math.hypot(1, 1e-10)).toBe(1);
    expect(locate({ re: 1, im: 1e-10 })).toBe('near-boundary');
    expect(locate({ re: Math.SQRT1_2, im: Math.SQRT1_2 })).toBe('near-boundary');
    // 7²+24²=25²: exact decimal parts .28 and .96 lie on the circle.
    expect(locate({ re: .28, im: -.96 })).toBe('boundary');
  });
  it('period changes physical timestamps, not z^k', () => {
    const a = samples(mode(-.8), .1, 4), b = samples(mode(-.8), .5, 4);
    expect(a.map(s => s.first)).toEqual(b.map(s => s.first));
    expect(b[4].t).toBe(2);
  });
  it('keeps the largest supported modal computation finite', () => {
    const data = samples(mode(2, 'jordan3'), 10, 80);
    expect(data).toHaveLength(81);
    expect(data.every(s => [s.first, s.norm, s.t].every(Number.isFinite))).toBe(true);
    expect(data[80].first).toBeCloseTo(3160 * 2 ** 78, -14);
  });
  it('constructs the declared real dimension', () => {
    expect(realDimension([mode(.8, 'independent'), mode(.5, 'jordan3', true, .4)])).toBe(8);
  });
  it.each([
    [mode(.8), [1, .8, .64, .512]],
    [mode(1, 'independent'), [2, 2, 2, 2]],
    [mode(1, 'jordan2'), [0, 1, 2, 3]],
    [mode(-1, 'jordan3'), [0, 0, 1, -3]],
    [mode(.6, 'simple', true, .8), [1, .6, -.28, -.936]],
    [mode(1.2, 'jordan2', false), [0, 0, 0, 0]],
  ] as const)('real state matrices reproduce independent Markov coefficients for %j', (block, expected) => {
    const { a, b, c } = realization(block);
    let state = b;
    // h[1..4]=C A^(k-1) B, independently stepped using the displayed real matrices.
    for (const value of expected) {
      expect(c.reduce((sum, ci, i) => sum + ci * state[i], 0)).toBeCloseTo(value, 12);
      state = a.map(row => row.reduce((sum, ai, i) => sum + ai * state[i], 0));
    }
  });
  it('real complex Jordan matrix matches both first coordinate and full norm', () => {
    const block = mode(.6, 'jordan3', true, .8), { a } = realization(block);
    let state = [0, 0, 0, 0, 1, 0];
    for (const sample of samples(block, .1, 6)) {
      expect(sample.first).toBeCloseTo(state[0], 12);
      expect(sample.norm).toBeCloseTo(Math.hypot(...state), 12);
      state = a.map(row => row.reduce((sum, ai, i) => sum + ai * state[i], 0));
    }
  });
  it.each([0, Infinity, NaN, 11])('rejects invalid T %s', t => expect(() => validateModel([mode(.8)], t, 10)).toThrow());
  it.each([3, 81, 4.5, NaN])('rejects invalid horizon %s', n => expect(() => validateModel([mode(.8)], .1, n)).toThrow());
  it('rejects duplicate and conjugate rows, unbounded sizes and nonfinite poles', () => {
    expect(() => validateModel([mode(.8), mode(.8)], .1, 10)).toThrow(/distinct/);
    expect(() => validateModel([mode(.6, 'simple', true, .8), mode(.6, 'simple', true, -.8)], .1, 10)).toThrow(/distinct/);
    expect(() => validateModel([], .1, 10)).toThrow();
    expect(() => validateModel(Array(5).fill(mode(.8)), .1, 10)).toThrow();
    expect(() => validateModel([mode(NaN)], .1, 10)).toThrow();
    expect(() => validateModel([mode(2.1)], .1, 10)).toThrow();
  });
});
