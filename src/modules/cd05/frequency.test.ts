import { describe, expect, it } from 'vitest';
import { bode, centerPeak, closedLoop, constantLead, corners, designLead, frequency, margins, matchGain, requiredPhase } from './frequency';
import type { Lead, Plant } from './input';
const p = { k: 1, a: 2 }, lead = { K: 4, T: 1 / Math.sqrt(2), alpha: .5 };

describe('CD05 course and changed frequency constructions', () => {
  it('checks the baseline crossover from its independently solved quadratic in omega squared', () => {
    const actual = margins(p, constantLead(4)), w = Math.sqrt(-2 + Math.sqrt(20));
    expect(actual.omega).toBeCloseTo(w, 12);
    expect(actual.phaseMargin).toBeCloseTo(Math.atan(2 / w) * 180 / Math.PI, 11);
    expect(actual.phaseMargin).toBeCloseTo(51.827292372987756, 10);
    expect(actual.gainMargin).toBe('infinite'); expect(actual.magnitudeResidual).toBeLessThan(1e-13);
  });
  it('checks exact source corners/boost and actual target crossing', () => {
    const geometry = corners(lead), boost = Math.asin(1 / 3) * 180 / Math.PI;
    expect(geometry.zero).toBeCloseTo(Math.sqrt(2), 13); expect(geometry.pole).toBeCloseTo(2 * Math.sqrt(2), 13);
    expect(geometry.peak).toBeCloseTo(2, 13); expect(geometry.maxBoost).toBeCloseTo(boost, 13);
    const source = margins(p, lead);
    expect(source.omega).toBeCloseTo(2, 12); expect(source.phaseMargin).toBeCloseTo(45 + boost, 11);
    expect(source.phaseMargin).toBeCloseTo(64.47122063449069, 10);
    expect(frequency(p, lead, 2).loopDb).toBeCloseTo(0, 12);
    expect(frequency(p, lead, 2).plantPhase).toBe(-135);
  });
  it('distinguishes added phase from improvement over a different baseline crossover', () => {
    const after = margins(p, lead), before = margins(p, constantLead(4));
    expect(after.phaseMargin - before.phaseMargin).toBeCloseTo(12.64392826150293, 10);
    expect(Math.abs(corners(lead).maxBoost - (after.phaseMargin - before.phaseMargin))).toBeGreaterThan(6);
  });
  it('keeps the source-rounded constants distinct from their exact geometric values', () => {
    const rounded = margins(p, { K: 4, T: .7071067812, alpha: .5 });
    expect(Math.abs(rounded.omega - 2)).toBeLessThan(1e-9);
    expect(Math.abs(rounded.phaseMargin - 64.47122063449069)).toBeLessThan(1e-9);
  });
  it('supports the maximum available phase boundary without a false infeasibility report', () => {
    const plant = { k: 1, a: .1 }, target = 10, available = requiredPhase(plant, target, 60);
    const desired = available.naturalMargin + available.available;
    const designed = designLead(plant, target, desired);
    expect(designed.lead.alpha).toBeCloseTo(.02, 14);
    expect(margins(plant, designed.lead).phaseMargin).toBeCloseTo(desired, 10);
  });
  it('constructs a changed plant/target and verifies both actual constraints', () => {
    const changed = { k: 2, a: 4 }, designed = designLead(changed, 3, 70);
    expect(designed.required).toBeCloseTo(70 - Math.atan(4 / 3) * 180 / Math.PI, 12);
    expect(margins(changed, designed.lead).omega).toBeCloseTo(3, 12);
    expect(margins(changed, designed.lead).phaseMargin).toBeCloseTo(70, 11);
    expect(corners(designed.lead).peak).toBeCloseTo(3, 12);
  });
  it('recomputes the actual crossing after gain moves while preserving corner geometry', () => {
    const raised = { ...lead, K: 8 };
    expect(margins(p, raised).omega).toBeGreaterThan(2);
    expect(corners(raised)).toEqual(corners(lead));
    expect(closedLoop(p, raised).Kv).toBe(4); expect(closedLoop(p, raised).rampError).toBe(.25);
  });
  it('keeps corner placement and gain matching as separate design steps', () => {
    const moved = { ...lead, T: Math.sqrt(2) }, matched = matchGain(p, moved, 2);
    expect(matched.K).toBeCloseTo(Math.sqrt(32 / 3), 12);
    expect(frequency(p, moved, 2).loopDb).toBeGreaterThan(1);
    expect(frequency(p, matched, 2).loopDb).toBeCloseTo(0, 12);
    expect(centerPeak(moved, 2).T).toBeCloseTo(lead.T, 13);
  });
  it('computes analytic sample values and a continuous unwrapped phase branch', () => {
    const curve = bode(p, lead, .01, 100, 101);
    expect(curve).toHaveLength(101); expect(curve[0].omega).toBeCloseTo(.01, 14); expect(curve.at(-1)!.omega).toBeCloseTo(100, 10);
    curve.slice(1).forEach((at, i) => expect(at.loopDb).toBeLessThan(curve[i].loopDb));
    curve.forEach(at => { expect(at.phase).toBeGreaterThan(-180); expect(at.phase).toBeLessThan(0); });
    const plantOnly = frequency(p, constantLead(1), 2);
    expect(plantOnly.plantDb).toBeCloseTo(-20 * Math.log10(Math.sqrt(32)), 12); expect(plantOnly.plantPhase).toBe(-135);
  });
});

describe('CD05 full characteristic coefficients and final-value conditions', () => {
  it('derives every cubic coefficient rather than a second-order substitute', () => {
    const model = closedLoop(p, { K: 4, T: .5, alpha: .5 });
    expect(model.rawDenominator).toEqual([.25, 1.5, 4, 4]);
    expect(model.denominator).toEqual([1, 6, 16, 16]); expect(model.numerator).toEqual([0, 0, 8, 16]);
    expect(model.routh).toBe(5); expect(model.Kv).toBe(2); expect(model.rampError).toBe(.5);
  });
  it('uses the actual no-lead quadratic with no invented cancelling state', () => {
    expect(closedLoop(p, constantLead(4))).toEqual({ rawDenominator: [1, 2, 4], denominator: [1, 2, 4], numerator: [0, 0, 4], routh: 2, Kv: 2, rampError: .5 });
    expect(closedLoop(p, { K: 4, T: .01, alpha: 1 })).toEqual(closedLoop(p, constantLead(4)));
  });
  it('checks the positive expanded Routh quantity against independent coefficient products', () => {
    for (const q of [{ k: .2, a: .5 }, p, { k: 3, a: 8 }]) for (const c of [lead, { K: 2, T: .2, alpha: .1 }]) {
      const model = closedLoop(q, c), [a3, a2, a1, a0] = model.rawDenominator;
      expect(model.routh).toBeGreaterThan(0); expect(model.routh).toBeCloseTo(a2 * a1 - a3 * a0, 11);
    }
  });
});

describe('CD05 unsupported designs and bounded frequency work', () => {
  it('reports no required lead and unavailable single-section boost separately', () => {
    expect(requiredPhase(p, .1, 10).required).toBeLessThan(0);
    expect(() => designLead(p, .1, 10)).toThrow(/No positive lead/);
    expect(() => designLead({ k: 1, a: .1 }, 100, 85)).toThrow(/exceeds/);
    expect(() => designLead({ k: .01, a: 100 }, 100, 70)).toThrow(/gain/);
  });
  it.each([0, -1, 1e-9, 1e9, NaN, Infinity])('rejects frequency %s', omega => expect(() => frequency(p, lead, omega)).toThrow(/Frequency/));
  it.each([[0, 60], [101, 60], [2, 0], [2, 86], [NaN, 60]])('rejects target %s/%s', (omega, pm) => expect(() => designLead(p, omega, pm)).toThrow(/Target/));
  it('validates finite models and excessive/invalid Bode work', () => {
    expect(() => margins({ k: NaN, a: 2 }, lead)).toThrow(/finite/);
    expect(() => margins(p, { ...lead, alpha: 2 })).toThrow(/ratio/);
    for (const count of [100, 1202, 101.5]) expect(() => bode(p, lead, .1, 10, count)).toThrow(/101–1201/);
    expect(() => bode(p, lead, 10, .1)).toThrow(/increasing/);
    expect(() => centerPeak({ K: 4, T: 1, alpha: .02 }, .01)).toThrow(/time/);
  });
  it('accepts every parameter range corner for frequency and positive coefficient checks', () => {
    for (const k of [.01, 100]) for (const a of [.1, 100]) for (const K of [.01, 1000]) for (const T of [.01, 10]) for (const alpha of [.02, 1]) {
      const plant: Plant = { k, a }, controller: Lead = { K, T, alpha };
      expect(margins(plant, controller).phaseMargin).toBeGreaterThan(0);
      expect(closedLoop(plant, controller).denominator.every(v => v > 0)).toBe(true);
    }
  });
});
