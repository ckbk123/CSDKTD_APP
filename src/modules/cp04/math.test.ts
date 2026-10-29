import { describe, expect, it } from 'vitest';
import { baseline, dbToLinear, diagnosePrediction, factorAt, frequencyGrid, fromAngular, normalize, parseDelay, parseReal, predictionAt, responseAt, slopeIntervals, toAngular, type Model } from './math';

describe('Bode normalization and independent reference values', () => {
  it('normalizes the default raw factors and adds slopes at both corners', () => {
    const normalized = normalize(baseline()); expect(normalized.gain).toBe(0.5); expect(normalized.factors.map(f => f.corner)).toEqual([1, 2]);
    expect(slopeIntervals(baseline())).toEqual([{ from: 0, to: 1, slope: 0 }, { from: 1, to: 2, slope: -20 }, { from: 2, to: Infinity, slope: -40 }]);
  });
  it('matches G(j)=1/(1+3j)=0.1-0.3j and G(2j)=1/(-2+6j)', () => {
    const atOne = responseAt(baseline(), 1), atTwo = responseAt(baseline(), 2);
    expect(atOne.magnitude).toBeCloseTo(Math.sqrt(0.1), 14); expect(atOne.db).toBeCloseTo(-10, 12);
    expect(atOne.phase).toBeCloseTo(-Math.atan(3) * 180 / Math.PI, 12);
    expect(atTwo.magnitude).toBeCloseTo(1 / Math.sqrt(40), 14); expect(atTwo.phase).toBeCloseTo(-108.43494882292202, 12);
    expect(atOne.asymptoteMagnitude).toBe(0.5); expect(atTwo.asymptoteMagnitude).toBeCloseTo(0.25, 14);
  });
  it('diagnoses a correct shape with a missing normalization gain', () => {
    const model = baseline(), wrong = { gain: 1, corners: [1, 2] };
    for (const w of [0.01, 1, 10, 100]) expect(predictionAt(model, w, wrong).db - responseAt(model, w).asymptoteDb).toBeCloseTo(20 * Math.log10(2), 12);
    expect(diagnosePrediction(model, wrong)).toContain('shifted by 6.021 dB');
    expect(diagnosePrediction(model, { gain: 0.5, corners: [1, 2] })).toContain('match the asymptotic');
    expect(diagnosePrediction(model, { gain: 0.5, corners: [1, 3] })).toContain('Check the corner');
  });
  it('preserves the transfer when a raw denominator factor and K are both scaled', () => {
    const model = baseline(), scaled: Model = { ...model, gain: 7, factors: [{ ...model.factors[0], a0: 7, a1: 7 }, model.factors[1]] };
    expect(normalize(scaled).gain).toBe(0.5);
    for (const w of [0.01, 1, 3, 100]) { expect(responseAt(scaled, w).db).toBeCloseTo(responseAt(model, w).db, 12); expect(responseAt(scaled, w).phase).toBeCloseTo(responseAt(model, w).phase, 12); }
  });
  it('adds explicit pure delay to phase only, including the unwrapped branch', () => {
    const plain = baseline(), delayed = { ...plain, delay: 0.5 };
    for (const w of [0.1, 2, 100]) {
      expect(responseAt(delayed, w).magnitude).toBe(responseAt(plain, w).magnitude);
      expect(responseAt(delayed, w).phase - responseAt(plain, w).phase).toBeCloseTo(-0.5 * w * 180 / Math.PI, 10);
      expect(responseAt(delayed, w).asymptotePhase - responseAt(plain, w).asymptotePhase).toBeCloseTo(-0.5 * w * 180 / Math.PI, 10);
    }
    expect(responseAt(delayed, 100).phase).toBeLessThan(-180);
  });
  it('keeps physical values invariant under rad/s-Hz and dB-linear display conversion', () => {
    for (const w of [0.0001, 1, 10000]) expect(toAngular(fromAngular(w, 'Hz'), 'Hz')).toBeCloseTo(w, 12);
    expect(toAngular(1, 'Hz')).toBeCloseTo(2 * Math.PI, 14);
    expect(dbToLinear(-20)).toBeCloseTo(0.1, 15); expect(dbToLinear(20)).toBe(10);
  });
  it('explains a resonant quadratic with exact, non-asymptotic magnitude at its natural frequency', () => {
    const model: Model = { gain: 1, originPower: 0, delay: 0, factors: [{ kind: 'second', position: 'pole', a0: 4, a1: 1, a2: 1 }] };
    expect(normalize(model).factors[0]).toMatchObject({ corner: 2, damping: 0.25 });
    const result = responseAt(model, 2); expect(result.magnitude).toBeCloseTo(0.5, 14); expect(result.asymptoteMagnitude).toBeCloseTo(0.25, 14); expect(result.phase).toBe(-90);
    expect(result.db - result.asymptoteDb).toBeCloseTo(20 * Math.log10(2), 12);
  });
  it('distinguishes a right-half-plane first-order zero by phase, with the same magnitude', () => {
    const left = { kind: 'first' as const, position: 'zero' as const, a0: 2, a1: 1, a2: 0 }, right = { ...left, a1: -1 };
    expect(factorAt(left, 2).db).toBe(factorAt(right, 2).db); expect(factorAt(left, 2).phase).toBe(45); expect(factorAt(right, 2).phase).toBe(-45);
  });
  it('keeps origin powers and negative gain phase explicit', () => {
    const result = responseAt({ gain: -2, originPower: -1, delay: 0, factors: [] }, 2);
    expect(result.magnitude).toBe(1); expect(result.phase).toBe(90);
    expect(slopeIntervals({ gain: 1, originPower: 2, delay: 0, factors: [] })[0].slope).toBe(40);
  });
  it('combines coincident corner slope changes without inventing an interval', () => {
    const f = baseline().factors[0]; expect(slopeIntervals({ gain: 1, originPower: 0, delay: 0, factors: [f, f] })).toEqual([{ from: 0, to: 1, slope: 0 }, { from: 1, to: Infinity, slope: -40 }]);
  });
  it('groups scale-equivalent factors at one corner with one combined slope change', () => {
    for (const corner of [1e-4, 1 / 3, 1, 1e4]) {
      const a = { kind: 'first' as const, position: 'pole' as const, a0: corner * .3, a1: .3, a2: 0 }, b = { ...a, a0: corner, a1: 1 };
      const model = { ...baseline(), factors: [a, b] }, rows = slopeIntervals(model);
      expect(rows).toHaveLength(2); expect(rows.map(row => row.slope)).toEqual([0, -40]); expect(rows[0].to).toBeCloseTo(corner, 12);
      expect(slopeIntervals({ ...model, factors: [b, a] })).toEqual(rows);
    }
    const rows = slopeIntervals({ ...baseline(), factors: [{ kind: 'first', position: 'pole', a0: .1, a1: .3, a2: 0 }, { kind: 'second', position: 'pole', a0: 1, a1: 3, a2: 9 }] });
    expect(rows.map(row => row.slope)).toEqual([0, -60]);
  });
  it('keeps physically distinct nearby corners outside the grouping tolerance', () => {
    const f = { kind: 'first' as const, position: 'pole' as const, a0: 1 / 3, a1: 1, a2: 0 };
    const rows = slopeIntervals({ ...baseline(), factors: [f, { ...f, a0: f.a0 * (1 + 1e-9) }] });
    expect(rows.map(row => row.slope)).toEqual([0, -20, -40]); expect(rows[1].to).toBeGreaterThan(rows[1].from);
  });
});

describe('bounded visual-number grammar and failure cases', () => {
  it('permits short positive delays at visual precision without relaxing coefficient bounds', () => {
    for (const source of ['.0000001', '\\frac{1}{10000000}', '.000000001']) expect(parseDelay(source)).toBeGreaterThan(0);
    const delay = parseDelay('.0000001'); expect(delay).toBe(1e-7); expect(parseDelay('0')).toBe(0); expect(parseDelay('10')).toBe(10);
    expect(() => parseReal('.0000001')).toThrow(/10⁻⁶/); expect(() => parseDelay('-.0000001')).toThrow(/Delay/); expect(() => parseDelay('10.1')).toThrow(/Delay/); expect(() => parseDelay('.0000000001')).toThrow(/decimal places/);
    expect(responseAt({ ...baseline(), delay }, 10000).phase - responseAt(baseline(), 10000).phase).toBeCloseTo(-.001 * 180 / Math.PI, 12);
  });
  it('accepts actual compact/braced MathLive fractions and signed decimals', () => {
    expect(parseReal('\\frac12')).toBe(0.5); expect(parseReal('\\frac{1}2')).toBe(0.5); expect(parseReal('\\frac1{2}')).toBe(0.5); expect(parseReal('-\\frac{1}{4}')).toBe(-0.25); expect(parseReal('\\frac{12}3')).toBe(4); expect(parseReal('.125')).toBe(0.125);
  });
  it('preserves outer grouping and unary signs without treating products as numbers', () => {
    expect(parseReal('-\\left(\\frac12\\right)')).toBe(-0.5); expect(parseReal('\\left(\\frac{-1}{2}\\right)')).toBe(-0.5); expect(parseReal('{-(-.5)}')).toBe(0.5);
    expect(() => parseReal('(1)(2)')).toThrow(); expect(() => parseReal('('.repeat(9) + '1' + ')'.repeat(9))).toThrow();
    expect(() => parseReal('\\frac{\\frac12}{3}')).toThrow();
  });
  it('rejects displayed mixed numbers and their signed/grouped variants in this scalar-only grammar', () => {
    for (const source of ['2\\frac12', '-2\\frac12', '\\left(2\\frac12\\right)', '2{\\frac12}', '\\frac{2\\frac12}{3}', '2+\\frac12', '2\\times\\frac12']) expect(() => parseReal(source)).toThrow(/unsupported/);
  });
  it.each(['', 'NaN', 'Infinity', 's', '2+3', '1e-2', '1E-2', '\\pi', '\\sqrt{2}', '\\frac10', '1000001', '.0000000001', '1'.repeat(100)])('rejects invalid numeric entry %s', source => { expect(() => parseReal(source)).toThrow(); });
  it('rejects excessive order, zero gain, invalid delay and unsupported quadratic damping', () => {
    const model = baseline();
    expect(() => normalize({ ...model, gain: 0 })).toThrow(/nonzero/);
    expect(() => normalize({ ...model, delay: -1 })).toThrow(/Delay/);
    expect(() => normalize({ ...model, originPower: 0.5 })).toThrow(/integer/);
    expect(() => normalize({ ...model, factors: Array(7).fill(model.factors[0]) })).toThrow(/six/);
    expect(() => normalize({ ...model, factors: [{ kind: 'second', position: 'pole', a0: 1, a1: 0.01, a2: 1 }] })).toThrow(/damping/);
    expect(() => normalize({ ...model, factors: [{ kind: 'second', position: 'pole', a0: 1, a1: 3, a2: 1 }] })).toThrow(/damping/);
    expect(() => normalize({ ...model, factors: [{ ...model.factors[0], a0: 0 }] })).toThrow(/a0/);
  });
  it('rejects invalid frequency ranges, sample counts and predictions', () => {
    expect(() => frequencyGrid(1, 1)).toThrow(/upper/); expect(() => frequencyGrid(0, 1)).toThrow(/Frequency/); expect(() => frequencyGrid(1, 10, 10000)).toThrow(/points/);
    expect(() => responseAt(baseline(), NaN)).toThrow(/Frequency/);
    expect(() => predictionAt(baseline(), 1, { gain: -1, corners: [1, 2] })).toThrow(/positive/);
    expect(() => predictionAt(baseline(), 1, { gain: 1, corners: [] })).toThrow(/one corner/);
  });
  it('uses a geometric grid with exact endpoints and bounded work', () => {
    const grid = frequencyGrid(0.1, 100, 101); expect(grid).toHaveLength(101); expect(grid[0]).toBe(0.1); expect(grid[100]).toBe(100);
    expect(grid[50]).toBeCloseTo(Math.sqrt(10), 14);
  });
});
