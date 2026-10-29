import { describe, expect, it } from 'vitest';
import { c, residual } from './complex';
import { baseline, characteristic, parseModel } from './model';
import { decimal, exactText, rational, toNumber } from './rational';
import { rules, vectors } from './rules';

describe('independent root-locus construction fixtures', () => {
  it('baseline segments count real poles/zeros to the right with multiplicity', () => {
    const expected = [
      { lower: -Infinity, upper: -5, rightCount: 3, onLocus: true },
      { lower: -5, upper: -2, rightCount: 2, onLocus: false },
      { lower: -2, upper: 0, rightCount: 1, onLocus: true },
      { lower: 0, upper: Infinity, rightCount: 0, onLocus: false },
    ];
    const actual = rules(baseline()).segments; expect(actual).toHaveLength(expected.length);
    actual.forEach((segment, i) => {
      expect(segment.rightCount).toBe(expected[i].rightCount); expect(segment.onLocus).toBe(expected[i].onLocus);
      for (const side of ['lower', 'upper'] as const) if (Number.isFinite(expected[i][side])) expect(segment[side]).toBeCloseTo(expected[i][side], 10); else expect(segment[side]).toBe(expected[i][side]);
    });
  });
  it('baseline asymptotes have independently derived centroid and directions', () => {
    const result = rules(baseline()); expect(exactText(result.asymptotes.centroid)).toBe('-7/3'); expect(result.asymptotes.angles).toEqual([60, 180, 300]);
    expect(result.stationaryPolynomial.map(exactText)).toEqual(['10/3', '14/3', '1']);
  });
  it('filters the negative-gain stationary point', () => {
    const result = rules(baseline()), eligible = result.breaks.filter(p => p.admissible), other = result.breaks.filter(p => !p.admissible);
    expect(eligible).toHaveLength(1); expect(other).toHaveLength(1);
    const x = (-7 + Math.sqrt(19)) / 3, k = -x * (x + 2) * (x + 5);
    expect(eligible[0].point).toBeCloseTo(x, 10); expect(eligible[0].gain).toBeCloseTo(k, 9); expect(other[0].gain).toBeLessThan(0);
    expect(eligible[0].residual).toBeLessThan(1e-10);
  });
  it('derives and verifies every baseline imaginary-axis candidate', () => {
    const result = rules(baseline()); expect(result.crossings).toHaveLength(2);
    expect(result.crossings[0]).toMatchObject({ omega: 0, gain: 0, kind: 'origin' });
    expect(result.crossings[1].gain).toBeCloseTo(70, 10); expect(result.crossings[1].omega).toBeCloseTo(Math.sqrt(10), 12);
  });
  it('keeps changing Kp distinct from plant proportional gain', () => {
    const pi = rules(parseModel('1', 's(s+2)', 'pi', '2.7'));
    expect(pi.crossings).toHaveLength(1); expect(pi.crossings[0].gain).toBeCloseTo(27 / 20, 10); expect(pi.crossings[0].omega).toBeCloseTo(Math.sqrt(27 / 20), 10);
    expect(pi.crossingEquation?.map(exactText)).toEqual(['27/10', '-2', '0']);
    expect(pi.asymptotes.count).toBe(2); expect(toNumber(pi.asymptotes.centroid)).toBe(-1); expect(pi.asymptotes.angles).toEqual([90, 270]);
  });
  it('computes a changed numerator zero and all associated rules', () => {
    const result = rules(parseModel('s+1', 's(s+2)(s+5)'));
    expect(result.asymptotes.count).toBe(2); expect(exactText(result.asymptotes.centroid)).toBe('-3'); expect(result.asymptotes.angles).toEqual([90, 270]);
    const eligible = result.segments.filter(s => s.onLocus); expect(eligible).toHaveLength(2);
    eligible.forEach((segment, i) => { expect(segment.lower).toBeCloseTo([[-5, -2], [-1, 0]][i][0], 10); expect(segment.upper).toBeCloseTo([[-5, -2], [-1, 0]][i][1], 10); });
    // jω equations: 7ω²=K and ω(10+K-ω²)=0 -> ω²=-5/3, so no positive-frequency crossing.
    expect(result.crossings.every(p => p.omega === 0)).toBe(true);
  });
  it('finds an origin crossing and direct real-axis motion in a first-order model', () => {
    const result = rules(parseModel('1', 's-2')); expect(result.crossings).toEqual([{ omega: 0, gain: 2, kind: 'origin', residual: 0 }]); expect(result.breaks).toEqual([]); expect(result.asymptotes.angles).toEqual([180]);
  });
  it('represents an axis family instead of claiming a finite crossing list', () => {
    const result = rules(parseModel('1', 's^2+1')); expect(result.axisFamily).toMatch(/family/); expect(result.crossings).toEqual([]);
  });
  it('handles an even quadratic moving through the origin', () => {
    const result = rules(parseModel('1', 's^2-1')); expect(result.axisFamily).toMatch(/family/); expect(result.crossings[0]).toMatchObject({ gain: 1, omega: 0 });
    expect(result.breaks.find(p => p.admissible)).toMatchObject({ point: 0, gain: 1 });
  });
  it('derives complex departure angles and conjugate symmetry', () => {
    const result = rules(parseModel('1', '(s+3)(s^2+2s+5)'));
    const upper = result.tangents.find(t => t.kind === 'departure' && t.root.im > 0)!;
    const lower = result.tangents.find(t => t.kind === 'departure' && t.root.im < 0)!;
    // At -1+2j: other pole vectors are 4j (90°), 2+2j (45°); 180-135=45°.
    expect(upper.angles[0]).toBeCloseTo(45, 10); expect(lower.angles[0]).toBeCloseTo(315, 10);
  });
  it('derives every departure ray at a repeated pole', () => {
    const result = rules(parseModel('1', '(s+1)^2')); expect(result.tangents[0].root.multiplicity).toBe(2); expect([...result.tangents[0].angles].sort((a, b) => a - b)).toEqual([90, 270]);
    expect(result.breaks[0].point).toBeCloseTo(-1, 10); expect(result.breaks[0].gain).toBeCloseTo(0, 12); expect(result.breaks[0].admissible).toBe(true);
  });
  it('derives complex-zero arrival rays from the local equation', () => {
    const result = rules(parseModel('s^2+2s+5', '(s+3)(s+4)(s+5)'));
    const upper = result.tangents.find(t => t.kind === 'arrival' && t.root.im > 0)!;
    // δ≈-D(z)/(K N′(z)); D(-1+2j)=-12+44j, N′=4j => -11-3j.
    const expected = (Math.atan2(-3, -11) * 180 / Math.PI + 360) % 360;
    expect(upper.angles[0]).toBeCloseTo(expected, 9);
  });
  it('removes cancelled factors only from geometry and retains their separate roots', () => {
    const model = parseModel('s-1', '(s-1)(s+2)'), result = rules(model);
    expect(model.fixed[0].re).toBe(1); expect(result.segments.filter(p => p.onLocus)).toMatchObject([{ lower: -Infinity, upper: -2 }]); expect(result.asymptotes.count).toBe(1); expect(exactText(result.asymptotes.centroid)).toBe('-2');
  });
  it('gives separate vectors from each pole and zero, with multiplicity', () => {
    const result = vectors(parseModel('s+1', '(s+2)^2'), c(0, 1)); expect(result).toHaveLength(2);
    expect(result.find(p => p.kind === 'pole')).toMatchObject({ dx: 2, dy: 1, from: { multiplicity: 2 } });
    expect(result.find(p => p.kind === 'zero')?.angle).toBeCloseTo(45, 12);
  });
  it('checks an independent changed imaginary pair against full Q', () => {
    // Q=s³+4s²+9s+K; crossing atK36 gives(s+4)(s²+9).
    const model = parseModel('1', 's^3+4s^2+9s');
    const crossing = rules(model).crossings.find(p => p.omega > 0)!; expect(crossing.gain).toBeCloseTo(36, 12); expect(crossing.omega).toBeCloseTo(3, 12);
    expect(residual(characteristic(model, decimal(String(crossing.gain), true)), c(0, 3))).toBeLessThan(1e-12);
  });
  it('keeps a genuine nonzero small coefficient', () => {
    const result = rules(parseModel('1', 's^2+0.000000001s+1')); expect(result.axisFamily).toBeUndefined(); expect(result.crossings).toEqual([]);
    expect(characteristic(parseModel('1', 's+1'), rational(0n)).map(exactText)).toEqual(['1', '1']);
  });
  it.each(['(s+1)(s^2+1)', '(s+2)(s^2+2)', '(s+3)(s^2+3)'])('retains exact K=0 imaginary-pair endpoints for %s', denominator => {
    const result = rules(parseModel('s', denominator)); expect(result.crossings.some(p => p.gain === 0 && p.omega > 0)).toBe(true);
  });
  it('retains a supported maximum-gain crossing endpoint', () => {
    // At K=1000: Q=s³+10s²+100s+1000=(s+10)(s²+100).
    const result = rules(parseModel('s', 's^3+10s^2-900s+1000')); expect(result.crossings.some(p => p.gain === 1000 && Math.abs(p.omega - 10) < 1e-10)).toBe(true);
  });
});
