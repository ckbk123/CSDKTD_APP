import { describe, expect, it } from 'vitest';
import { EPS, constantRF, q } from './algebra';
import { gradeCount, gradeEntry } from './grade';
import { analyzeCoefficients, determinantWork } from './math';
import { parseCharacteristic } from './parser';

describe('CS02 student answers and worked arithmetic', () => {
  it('checks the root count and distinguishes each special treatment', () => {
    const ordinary = analyzeCoefficients(parseCharacteristic('s^3+7s^2+10s+K', 80));
    expect(gradeCount(ordinary, 2, 'ordinary').correct).toBe(true); expect(gradeCount(ordinary, 0, 'ordinary').correct).toBe(false);
    const epsilon = analyzeCoefficients(parseCharacteristic('s^4+2s^3+3s^2+6s+5', 0));
    expect(gradeCount(epsilon, 2, 'epsilon').correct).toBe(true); expect(gradeCount(epsilon, 2, 'auxiliary').correct).toBe(false);
    const auxiliary = analyzeCoefficients(parseCharacteristic('(s^2+4)(s+1)^3', 0));
    expect(gradeCount(auxiliary, 0, 'auxiliary').correct).toBe(true);
    const both = analyzeCoefficients(parseCharacteristic('s(s^4-s^3-1)', 0)); expect(gradeCount(both, 3, 'both').correct).toBe(true);
    expect(() => gradeCount(ordinary, 1.5, 'ordinary')).toThrow('integer');
  });
  it('requires exact fractions for finite entries and accepts correct infinite limits', () => {
    expect(gradeEntry(constantRF(q(50, 7)), { kind: 'finite', value: q(50, 7) }).correct).toBe(true);
    expect(gradeEntry(constantRF(q(50, 7)), { kind: 'finite', value: q(7142857, 1000000) }).correct).toBe(false);
    const epsilon = analyzeCoefficients(parseCharacteristic('s^4+2s^3+3s^2+6s+5', 0));
    expect(gradeEntry(epsilon.rows[3].values[0], { kind: 'negative-infinity' }).correct).toBe(true);
    expect(gradeEntry(epsilon.rows[3].values[0], { kind: 'positive-infinity' }).correct).toBe(false);
  });
  it('does not erase the positive Routh sign when epsilon has zero limit', () => {
    expect(gradeEntry(EPS, { kind: 'finite', value: q(0), side: 1 }).correct).toBe(true);
    expect(gradeEntry(EPS, { kind: 'finite', value: q(0), side: -1 }).correct).toBe(false);
    expect(gradeEntry(constantRF(q(0)), { kind: 'finite', value: q(0) }).correct).toBe(true);
  });
  it('exposes independently checked leading-minor row operations', () => {
    const work = determinantWork([[q(7), q(20)], [q(1), q(10)]]);
    expect(work.operations).toEqual([{ kind: 'eliminate', source: 0, target: 1, factor: q(1, 7) }]);
    expect(work.triangular).toEqual([[q(7), q(20)], [q(0), q(50, 7)]]); expect(work.value).toEqual(q(50));
    const swapped = determinantWork([[q(0), q(2)], [q(3), q(4)]]);
    expect(swapped.operations[0]).toEqual({ kind: 'swap', first: 0, second: 1 }); expect(swapped.value).toEqual(q(-6));
    expect(determinantWork([[q(1), q(2)], [q(2), q(4)]]).singularColumn).toBe(1);
  });
});
