import { describe, expect, it } from 'vitest';
import { analyseLimit, constants, errorNumerator, makeModel, trace, transition } from './math';
import { parseLinearExact as parse } from './parser';
import { decimal, exactText, ONE, toNumber } from './rational';

const model = (numerator = '4', pole = 's+2', n = 1, h = '1') => makeModel(parse(numerator), parse(pole), n, decimal(h));
const limit = (m = model(), channel: 'reference' | 'disturbance' | 'noise' = 'reference', error: 'comparator' | 'physical' = 'comparator', q = 1, amplitude = '1') => analyseLimit(m, channel, error, q, decimal(amplitude));
const finite = (value: ReturnType<typeof limit>) => { expect(value.kind).toBe('finite'); if (value.kind !== 'finite') throw Error('Expected finite'); return exactText(value.value); };

describe('CF02 exact signal algebra and final values', () => {
  it('derives the baseline Q, origin order and error constants', () => {
    const m = model();
    expect(m.closed.map(exactText)).toEqual(['4', '2', '1']);
    expect(m.stability.kind).toBe('stable');
    expect(constants(m).map(k => k.kind === 'finite' ? exactText(k.value!) : k.kind)).toEqual(['infinite', '2', 'zero']);
    expect(errorNumerator(m, 'reference', 'comparator').map(exactText)).toEqual(['0', '2', '1']);
    expect(finite(limit(m, 'reference', 'comparator', 0))).toBe('0');
    expect(finite(limit())).toBe('1/2');
    expect(limit()).toMatchObject({ zeroOrder: 1 });
  });
  it('changes gain, scale, sign and input amplitude from the data', () => {
    expect(finite(limit(model('8')))).toBe('1/4');
    expect(finite(limit(model('8', '2s+4')))).toBe('1/2');
    expect(finite(limit(model(), 'reference', 'physical', 1, '-3'))).toBe('-3/2');
  });
  it('derives the parabolic asymptote including its constant term', () => {
    const result = limit(model(), 'reference', 'comparator', 2);
    expect(result.kind).toBe('growth');
    if (result.kind === 'growth') expect(result.polynomial.map(exactText)).toEqual(['0', '1/2']);
  });
  it('does not confuse physical tracking with comparator error for nonunity H', () => {
    const m = model('4', 's+2', 1, '2');
    expect(finite(limit(m))).toBe('1/4');
    const physical = limit(m, 'reference', 'physical');
    expect(physical.kind).toBe('growth');
    if (physical.kind === 'growth') expect(physical.polynomial.map(exactText)).toEqual(['1/8', '1/2']);
    expect(finite(limit(m, 'reference', 'physical', 0))).toBe('1/2');
  });
  it('retains an exact cancellation that changes the numerator zero order', () => {
    // D+(H-1)N=s+2+(.8-1)*10=s, exactly; ramp error =1/10.
    const m = model('10', 's+2', 0, '.8');
    expect(errorNumerator(m, 'reference', 'physical').map(exactText)).toEqual(['0', '1']);
    expect(finite(limit(m, 'reference', 'physical'))).toBe('1/10');
    expect(limit(m, 'reference', 'physical')).toMatchObject({ zeroOrder: 1 });
  });
  it('uses type zero and a proper direct-feedthrough plant', () => {
    expect(finite(limit(model('4', 's+2', 0), 'reference', 'comparator', 0))).toBe('1/3');
    expect(finite(limit(model('2s+4', 's+2', 0), 'reference', 'comparator', 0))).toBe('1/3');
  });
  it('certifies the stable type-two fixture with the cubic Hurwitz determinant', () => {
    const m = model('4(s+1)', 's+2', 2);
    expect(m.closed.map(exactText)).toEqual(['4', '4', '2', '1']);
    expect(exactText(m.stability.determinant!)).toBe('4');
    expect(m.stability.kind).toBe('stable');
    expect(constants(m).map(k => k.kind)).toEqual(['infinite', 'infinite', 'finite']);
    expect(finite(limit(m, 'reference', 'physical', 2))).toBe('1/2');
    expect(finite(limit(m))).toBe('0');
  });
  it.each([['4', 'unstable'], ['4(s+2)', 'boundary'], ['4(s+3)', 'unstable']] as const)('refuses FVT for the type-two numerator %s', (num, verdict) => {
    const m = model(num, 's+2', 2);
    expect(m.stability.kind).toBe(verdict);
    expect(limit(m).kind).toBe('uncertified');
  });
  it('does not cancel an unstable full-loop mode out of its certificate', () => {
    const m = model('4(s+2)', 's+2', 2);
    expect(m.stability.kind).toBe('boundary'); // (s+2)(s²+4)
    expect(limit(m, 'noise', 'physical', 0).kind).toBe('uncertified');
  });
  it('keeps the zero-initial-state zero-input identity separate from loop stability', () => {
    const m = model('4', 's+2', 2);
    expect(finite(limit(m, 'reference', 'physical', 2, '0'))).toBe('0');
    expect(limit(m, 'reference', 'physical', 2, '0')).toMatchObject({ reason: 'zero-input' });
    expect(m.stability.kind).toBe('unstable');
  });
  it('recognizes an identically zero physical channel without erasing comparator error', () => {
    // P=2, H=1/2: y=2(r-y/2)=r, e_c=r/2.
    const m = model('2s+4', 's+2', 0, '.5');
    expect(limit(m, 'reference', 'physical', 2)).toMatchObject({ kind: 'finite', reason: 'zero-channel' });
    expect(finite(limit(m, 'reference', 'physical', 2))).toBe('0');
    expect(finite(limit(m, 'reference', 'comparator', 0))).toBe('1/2');
    for (const p of trace(m, 'reference', 2, ONE, 5).points) expect(Math.abs(p.physical)).toBeLessThan(1e-10);
  });
  it('distinguishes the disturbance and sensor channels and feedback sign', () => {
    const m = model();
    expect(finite(limit(m, 'disturbance', 'physical', 0))).toBe('-1');
    expect(finite(limit(m, 'disturbance', 'comparator', 0))).toBe('-1');
    expect(finite(limit(m, 'noise', 'physical', 0))).toBe('1');
    expect(finite(limit(m, 'noise', 'comparator', 0))).toBe('0');
    expect(finite(limit(model('4', 's+2', 1, '2'), 'disturbance', 'physical', 0))).toBe('-1/2');
    expect(finite(limit(model('4', 's+2', 1, '2'), 'noise', 'physical', 0))).toBe('1/2');
  });
  it.each([
    ['0', 's+2', 1, '1'], ['-4', 's+2', 1, '1'], ['4-s', 's+2', 1, '1'],
    ['4', '-s+2', 1, '1'], ['4', 's', 1, '1'], ['4', 's+.01', 1, '1'],
    ['51', 's+2', 1, '1'], ['.01', 's+2', 1, '1'], ['s+.01', 's+2', 1, '1'],
    ['4', 's+2', 3, '1'], ['4', 's+2', 1.5, '1'], ['4', 's+2', 1, '0'],
    ['4', 's+2', 1, '11'],
  ] as const)('rejects out-of-domain model %s / %s, n=%s, H=%s', (num, pole, n, h) => {
    expect(() => model(num, pole, n, h)).toThrow();
  });
  it('bounds source amplitude/order and horizon work', () => {
    expect(() => limit(model(), 'reference', 'comparator', 3)).toThrow();
    expect(() => limit(model(), 'reference', 'comparator', 1, '11')).toThrow();
    for (const time of [0, .01, 121, NaN, Infinity]) expect(() => trace(model(), 'reference', 1, ONE, time)).toThrow();
  });
});

describe('CF02 numerical trace checked against independent responses', () => {
  it('matches the inverse-Laplace baseline ramp at every sample', () => {
    const run = trace(model(), 'reference', 1, ONE, 10);
    expect(run.truncated).toBe(false);
    for (const p of run.points) {
      const expected = .5 - .5 * Math.exp(-p.t) * Math.cos(Math.sqrt(3) * p.t) + Math.exp(-p.t) * Math.sin(Math.sqrt(3) * p.t) / (2 * Math.sqrt(3));
      expect(p.comparator).toBeCloseTo(expected, 10);
      expect(p.physical).toBeCloseTo(p.comparator, 12);
      expect(p.output + p.physical).toBeCloseTo(p.input, 12);
    }
  });
  it('matches a type-zero first-order step', () => {
    for (const p of trace(model('4', 's+2', 0), 'reference', 0, ONE, 5).points) {
      expect(p.physical).toBeCloseTo(1 / 3 + 2 / 3 * Math.exp(-6 * p.t), 11);
    }
  });
  it('solves the algebraic loop for a direct feedthrough plant', () => {
    for (const p of trace(model('2s+4', 's+2', 0), 'reference', 0, ONE, 2).points) {
      expect(p.output).toBeCloseTo(2 / 3, 12); // P=2 identically, y=2(r-y)
      expect(p.comparator).toBeCloseTo(1 / 3, 12);
    }
  });
  it('matches the independent second-order step formula and channel signs', () => {
    const disturbance = trace(model(), 'disturbance', 0, ONE, 5);
    const noise = trace(model(), 'noise', 0, ONE, 5);
    disturbance.points.forEach((p, i) => {
      const y = 1 - Math.exp(-p.t) * (Math.cos(Math.sqrt(3) * p.t) + Math.sin(Math.sqrt(3) * p.t) / Math.sqrt(3));
      expect(p.output).toBeCloseTo(y, 11);
      expect(p.physical).toBeCloseTo(-y, 11);
      expect(noise.points[i].output).toBeCloseTo(-y, 11);
      expect(noise.points[i].comparator).toBeCloseTo(y - 1, 11);
    });
  });
  it('approaches type-two parabolic and nonunity-sensor asymptotes', () => {
    const run = trace(model('4(s+1)', 's+2', 2), 'reference', 2, ONE, 60);
    expect(run.points.at(-1)!.physical).toBeCloseTo(.5, 6);
    const end = trace(model('4', 's+2', 1, '2'), 'reference', 1, ONE, 30).points.at(-1)!;
    expect(end.comparator).toBeCloseTo(.25, 9);
    expect(end.physical).toBeCloseTo(15.125, 9);
  });
  it('matches a factorable cubic parabolic response throughout the trace', () => {
    // Q=(s+1)(s+2)(s+3), E=(s+6)/[s(s+1)(s+2)(s+3)].
    // Independent residues at 0,-1,-2,-3 are 1,-5/2,2,-1/2.
    const m = model('11s+6', 's+6', 2);
    expect(finite(limit(m, 'reference', 'physical', 2))).toBe('1');
    for (const p of trace(m, 'reference', 2, ONE, 8).points) {
      const expected = 1 - 2.5 * Math.exp(-p.t) + 2 * Math.exp(-2 * p.t) - .5 * Math.exp(-3 * p.t);
      expect(p.physical).toBeCloseTo(expected, 10);
    }
  });
  it('preserves a stable cancelled finite pole in the realized response', () => {
    // P=(s+2)/[s(s+2)]=1/s; reference ramp error is 1-exp(-t).
    for (const p of trace(model('s+2'), 'reference', 1, ONE, 6).points) expect(p.comparator).toBeCloseTo(1 - Math.exp(-p.t), 11);
  });
  it('matches a biproper nonunity-sensor response without a cancelled pole', () => {
    // P=(2s+1)/(s+2), H=3: Ec/R=(s+2)/(7s+5).
    for (const p of trace(model('2s+1', 's+2', 0, '3'), 'reference', 0, ONE, 6).points) {
      const ec = 2 / 5 - 9 / 35 * Math.exp(-5 * p.t / 7);
      expect(p.comparator).toBeCloseTo(ec, 11);
      expect(p.physical).toBeCloseTo((2 + ec) / 3, 11);
    }
  });
  it('preserves zero and negative excitations', () => {
    const m = model();
    expect(trace(m, 'reference', 2, decimal('0'), 10).points.every(p => p.output === 0 && p.physical === 0)).toBe(true);
    const a = trace(m, 'reference', 1, ONE, 3).points;
    trace(m, 'reference', 1, decimal('-2'), 3).points.forEach((p, i) => expect(p.output).toBeCloseTo(-2 * a[i].output, 11));
  });
  it('truncates a divergent trajectory and reports the bounded sample budget', () => {
    const result = trace(model('50', 's+.1', 2), 'reference', 2, decimal('10'), 120);
    expect(result.truncated).toBe(true);
    expect(result.points.length).toBeLessThanOrEqual(40_001);
    expect(result.points.every(p => Object.values(p).every(Number.isFinite))).toBe(true);
    const stiff = trace(model('50s+50', 's+10', 1, '10'), 'reference', 0, ONE, 120);
    expect(stiff.resolutionLimited).toBe(true);
    expect(stiff.points.length).toBe(40_001);
  });
  it('approximates independently known diagonal and nilpotent exponentials', () => {
    const diagonal = transition([[-2, 0], [0, 1]], .7);
    expect(diagonal[0][0]).toBeCloseTo(Math.exp(-1.4), 13);
    expect(diagonal[1][1]).toBeCloseTo(Math.exp(.7), 13);
    expect(diagonal[0][1]).toBe(0);
    const jordan = transition([[0, 1, 0], [0, 0, 1], [0, 0, 0]], 2);
    expect(jordan).toEqual([[1, 2, 2], [0, 1, 2], [0, 0, 1]]);
    expect(transition([[0]], 0)).toEqual([[1]]);
  });
  it('rejects malformed/oversized transition requests', () => {
    for (const matrix of [[], [[1, 2]], [[Infinity]], Array.from({ length: 7 }, () => Array(7).fill(0)), [[1e20]]]) expect(() => transition(matrix, 1)).toThrow();
    expect(() => transition([[1]], -1)).toThrow();
    expect(() => transition([[100]], 120)).toThrow(/overflow/);
  });
  it('keeps rational conversion separate from exact zero classification', () => {
    const m = model('10', 's+2', 0, '.80000000000000000000000000001');
    const result = limit(m, 'reference', 'physical');
    expect(result.kind).toBe('growth');
    if (result.kind === 'growth') expect(toNumber(result.polynomial[1])).toBeGreaterThan(0);
  });
});
