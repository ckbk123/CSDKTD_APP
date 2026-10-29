import { describe, expect, it } from 'vitest';
import { equal, latexRat, num, parseRational, rat, textRat } from './algebra';
import { baseline, decompose, initialDescription, inspect, modeAt, movePole, moveZero, parseModel, sameDenominator, stepAt, termAt } from './math';
const model = (a1: string, a0: string, b1 = '0', b0 = '1') => parseModel(a1, a0, b1, b0);

describe('exact bounded coefficient entry', () => {
  it.each(['\\frac1\u20092',String.raw`\frac1{\left\;2}`,String.raw`\frac1{\left\left\,2}`,String.raw`\frac1{\left2\;}`])('rejects changed argument meaning before normalization in %s',source=>expect(()=>parseRational(source)).toThrow(/box/));
  it('retains proper braced spacing and visible numeric fences',()=>{
    for(const source of [String.raw`\frac1{\;2}`,'\\frac1{\u20092}',String.raw`\left(\frac12\right)`])expect(textRat(parseRational(source))).toBe('1/2');
  });
  it('preserves compact fractions, signs and outer grouping', () => {
    for (const source of ['-\\frac12', '\\frac{-1}2', '-\\frac1{2}', '\\left(-\\frac{1}{2}\\right)']) expect(textRat(parseRational(source))).toBe('-1/2');
    expect(textRat(parseRational('.125'))).toBe('1/8');
  });
  it('rejects mixed-number adjacency and expression variants without changing their displayed meaning', () => {
    for (const source of ['2\\frac12', '-2\\frac12', '\\left(2\\frac12\\right)', '2\\frac{1}{2}', '2{\\frac12}', '\\frac{2\\frac12}{3}', '2+\\frac12', '2\\times\\frac12']) expect(() => parseRational(source)).toThrow(/single numeric/);
  });
  it.each(['', 'NaN', 'Infinity', '1e-2', '1E-2', '2+3', '\\pi', '\\sqrt{2}', '\\frac10', '101', '.0000000001', '\\frac{1}{10000000000000000000}', ' '.repeat(513), '\\frac{\\frac12}{3}'])('rejects unsupported or excessive coefficient %s', source => { expect(() => parseRational(source)).toThrow(); });
});
describe('poles, cancellation and stability of the declared canonical realization', () => {
  it('derives the baseline poles, modes and independent peak value', () => {
    const m = baseline(), a = inspect(m), s = decompose(m);
    expect(a.kind).toBe('conjugate'); expect(a.poles.map(p => p.re)).toEqual([-1, -1]); expect(a.poles[0].im).toBeCloseTo(Math.sqrt(3), 14);
    expect(a.internal).toBe('asymptotically stable'); expect(a.bibo).toBe(true); expect(stepAt(s, 0)).toBe(0);
    expect(s.terms.map(t => t.coefficient)).toEqual([1, -1, -1 / Math.sqrt(3)]);
    const peakTime = Math.PI / Math.sqrt(3); expect(stepAt(s, peakTime)).toBeCloseTo(1 + Math.exp(-peakTime), 13);
    expect(initialDescription(m)).toContain('horizontal tangent');
  });
  it('changes zero and modal weights without changing poles or DC gain', () => {
    const left = moveZero(baseline(), -2, true), right = moveZero(baseline(), 2, true);
    expect(sameDenominator(left, right)).toBe(true); expect(num(left.b0) / num(left.a0)).toBe(1); expect(num(right.b0) / num(right.a0)).toBe(1);
    expect(num(left.b1)).toBe(2); expect(num(right.b1)).toBe(-2); expect(num(inspect(left).zero!)).toBe(-2); expect(num(inspect(right).zero!)).toBe(2);
    expect(decompose(left).terms[2].coefficient).toBeCloseTo(1 / Math.sqrt(3), 14); expect(decompose(right).terms[2].coefficient).toBeCloseTo(-Math.sqrt(3), 14);
    expect(stepAt(decompose(left), 0.01)).toBeGreaterThan(0); expect(stepAt(decompose(right), 0.01)).toBeLessThan(0);
    expect(stepAt(decompose(left), 1e-5) / 1e-5).toBeCloseTo(2, 4); expect(stepAt(decompose(right), 1e-5) / 1e-5).toBeCloseTo(-2, 4);
  });
  it('separates reduced-channel BIBO stability from the retained unstable state', () => {
    const m = model('1', '-2', '1', '-1'), a = inspect(m);
    expect(a.common.map(textRat)).toEqual(['-1', '1']); expect(a.reducedDenominator.map(textRat)).toEqual(['2', '1']);
    expect(a.poles.map(p => p.re).sort()).toEqual([-2, 1]); expect(a.reducedPoles.map(p => p.re)).toEqual([-2]);
    expect(a.bibo).toBe(true); expect(a.internal).toBe('unstable'); expect(stepAt(decompose(m), 20)).toBeCloseTo(0.5 * (1 - Math.exp(-40)), 14);
  });
  it('retains a near pole/zero pair and its unstable residue', () => {
    const m = model('1', '-2', '1', '-1.000001'), a = inspect(m), t = 20;
    expect(a.common.length).toBe(1); expect(a.bibo).toBe(false);
    const expected = (-1e-6 / 3) * Math.expm1(t) + (-3.000001 / 6) * Math.expm1(-2 * t);
    expect(stepAt(decompose(m), t)).toBeCloseTo(expected, 6);
  });
  it('reports unresolved numerical weights instead of plotting an exactly uncanceled pair as canceled', () => {
    const m = model('1', '-2', '1', '-\\frac{1000000000000000001}{1000000000000000000}');
    expect(inspect(m).bibo).toBe(false); expect(inspect(m).common.length).toBe(1); expect(() => decompose(m)).toThrow(/uncanceled pole and zero/);
  });
  it('retains internal modes when the zero scalar channel has no poles', () => {
    const m = model('-2', '1', '0', '0'), a = inspect(m);
    expect(a.internal).toBe('unstable'); expect(a.bibo).toBe(true); expect(a.reducedPoles).toEqual([]); expect(stepAt(decompose(m), 10)).toBe(0);
  });
  it('distinguishes simple boundary modes from a repeated zero Jordan mode', () => {
    const oscillator = model('0', '4', '0', '4'); expect(inspect(oscillator).internal).toBe('bounded, not asymptotic'); expect(inspect(oscillator).bibo).toBe(false);
    expect(stepAt(decompose(oscillator), Math.PI / 2)).toBeCloseTo(2, 14);
    expect(inspect(model('1', '0')).internal).toBe('bounded, not asymptotic'); expect(inspect(model('0', '0')).internal).toBe('unstable');
  });
});
describe('independent step formulas and numerical decomposition', () => {
  it('matches a distinct-real-pole step (1-exp(-t))²', () => {
    const s = decompose(model('3', '2', '0', '2'));
    for (const t of [0, 0.1, 1, 5]) expect(stepAt(s, t)).toBeCloseTo((1 - Math.exp(-t)) ** 2, 13);
  });
  it('matches a repeated pole 1-(1+t)exp(-t)', () => {
    const m = model('2', '1'), s = decompose(m); expect(inspect(m).kind).toBe('repeated');
    for (const t of [0, 0.1, 1, 5]) expect(stepAt(s, t)).toBeCloseTo(1 - (1 + t) * Math.exp(-t), 13);
    expect(s.terms.find(t => t.power === 1)?.coefficient).toBe(-1);
  });
  it('retains the initial curvature for a short time with two close real poles', () => {
    const s = decompose(model('2.000001', '1.000001')), t = 1e-10;
    // y(0)=y′(0)=0, y″(0)=1, y‴(0)=−2.000001; omitted t⁴ term <10⁻⁴⁰.
    const expected = t * t / 2 - 2.000001 * t ** 3 / 6;
    expect(Math.abs(stepAt(s, t) / expected - 1)).toBeLessThan(1e-12);
    expect(() => model('2.0000009', '1.0000009')).toThrow(/Distinct poles are too close/);
  });
  it('supports one and two origin poles, including exact origin cancellation', () => {
    const single = decompose(model('1', '0')), double = decompose(model('0', '0')), canceled = decompose(model('0', '0', '1', '0'));
    for (const t of [0, 0.1, 1, 5]) { expect(stepAt(single, t)).toBeCloseTo(t - 1 + Math.exp(-t), 13); expect(stepAt(double, t)).toBe(t * t / 2); expect(stepAt(canceled, t)).toBe(t); }
  });
  it('reconstructs the full trace from modal terms across all supported root families', () => {
    for (const m of [baseline(), model('3', '2', '1', '2'), model('2', '1'), model('1', '0'), model('0', '0')]) {
      const s = decompose(m); for (const t of [0, 0.1, 1, 4]) expect(s.terms.reduce((sum, value) => sum + termAt(t, value), 0)).toBeCloseTo(stepAt(s, t), 11);
    }
  });
  it('evaluates ordinary and generalized free modes with explicit growth limits', () => {
    expect(modeAt({ re: -1, im: 0, multiplicity: 2 }, true, 2)).toBeCloseTo(2 * Math.exp(-2), 14);
    expect(() => stepAt(decompose(model('-12', '36')), 10)).toThrow(/growth/); expect(() => stepAt(decompose(baseline()), 21)).toThrow(/20 s/);
  });
});
describe('linked pole/zero edits and bounded failures', () => {
  it('links conjugates and round-trips exact generated repeated-root coefficients through the visual grammar', () => {
    const moved = movePole(baseline(), 0, -2, 3), a = inspect(moved);
    expect(a.poles.map(p => p.re)).toEqual([-2, -2]); expect(a.poles.map(p => p.im)).toEqual([3, -3]); expect(num(moved.a1)).toBe(4); expect(num(moved.a0)).toBe(13);
    const repeated = movePole(baseline(), 0, -0.333333333, 0); expect(inspect(repeated).kind).toBe('repeated'); expect(equal(parseRational(latexRat(repeated.a0)), repeated.a0)).toBe(true);
  });
  it('moves a real pole independently and preserves the numerator', () => {
    const before = model('3', '2', '1', '2'), moved = movePole(before, 0, -3, 0);
    expect(inspect(moved).poles.map(p => p.re).sort()).toEqual([-1, -3]); expect(equal(before.b1, moved.b1)).toBe(true); expect(equal(before.b0, moved.b0)).toBe(true);
  });
  it('retains an unmoved rational pole exactly, preserving its hidden-mode cancellation', () => {
    const before = model('\\frac23', '-\\frac13', '1', '-\\frac13'), moved = movePole(before, 0, -2, 0), a = inspect(moved);
    expect(equal(moved.a1, rat(5n, 3n))).toBe(true); expect(equal(moved.a0, rat(-2n, 3n))).toBe(true);
    expect(a.common.length).toBe(2); expect(a.internal).toBe('unstable'); expect(a.bibo).toBe(true); expect(stepAt(decompose(moved), 1)).toBeCloseTo(.5 * (1 - Math.exp(-2)), 14);
  });
  it('handles irrational real poles and states the nine-decimal edit precision honestly', () => {
    const before = model('0', '-2'); expect(stepAt(decompose(before), 1)).toBeCloseTo((Math.cosh(Math.SQRT2) - 1) / 2, 13);
    const moved = movePole(before, 0, -3, 0), positive = inspect(moved).poles.find(p => p.re > 0)!;
    expect(positive.re).toBe(1.414213562); expect(Math.abs(positive.re - Math.SQRT2)).toBeLessThan(.5e-9); expect(equal(moved.b0, before.b0)).toBe(true);
  });
  it('preserves valid models on invalid candidates and supports a zero at the origin without DC preservation', () => {
    const m = baseline(), snapshot = { ...m };
    expect(() => movePole(m, 0, NaN, 1)).toThrow(); expect(() => movePole(m, 0, 11, 0)).toThrow(); expect(() => moveZero(m, 0, true)).toThrow(/DC preservation/); expect(m).toEqual(snapshot);
    const origin = moveZero(m, 0, false); expect(num(inspect(origin).zero!)).toBe(0); expect(num(origin.b0)).toBe(0);
  });
  it('rejects roots/zeros outside the declared support and incomplete conditioning', () => {
    expect(() => model('21', '1')).toThrow(/a₁/); expect(() => model('2', '1.00000001')).toThrow(/imaginary/);
    expect(() => model('2', '4', '.001', '100')).toThrow(/Finite zero/);
    expect(() => movePole(baseline(), 0, 0.00001, 1)).toThrow(/0.001/);
    expect(() => inspect({ ...baseline(), a0: rat(101n) })).toThrow(/100/);
  });
});
