import { describe, expect, it } from 'vitest';
import { complex } from './complex';
import { constantLead } from './frequency';
import { mv, solveComplex, sum, transition } from './numeric';
import { physicalModel, stepResponse } from './response';
const p = { k: 1, a: 2 };
const close = (actual: number, expected: number, tolerance = 2e-10): void => expect(Math.abs(actual - expected) / Math.max(1, Math.abs(expected))).toBeLessThanOrEqual(tolerance);

describe('CD05 bounded physical transition and modal solve', () => {
  it('checks independent nilpotent, rotation and Jordan exponential formulas', () => {
    expect(transition([[0, 1], [0, 0]], 2)).toEqual([[1, 2], [0, 1]]);
    const rotation = transition([[0, 1], [-1, 0]], 1);
    rotation.flat().forEach((v, i) => close(v, [Math.cos(1), Math.sin(1), -Math.sin(1), Math.cos(1)][i]));
    const jordan = transition([[-1, 1, 0], [0, -1, 1], [0, 0, -1]], 2);
    jordan.flat().forEach((v, i) => close(v, [1, 2, 2, 0, 1, 2, 0, 0, 1][i] * Math.exp(-2)));
    expect(transition([[1, 0], [0, 1]], 0)).toEqual([[1, 0], [0, 1]]);
  });
  it('checks an independent complex linear solution and preserves inputs', () => {
    const a = [[complex(1, 1), complex(2)], [complex(0), complex(2, -1)]], b = [complex(6, 2), complex(5)];
    const before = JSON.stringify({ a, b }), solved = solveComplex(a, b);
    close(solved.value[0].re, 1); close(solved.value[0].im, -1); close(solved.value[1].re, 2); close(solved.value[1].im, 1);
    expect(JSON.stringify({ a, b })).toBe(before); expect(solved.residual).toBeLessThan(1e-14);
    expect(sum([1e16, 1, -1e16])).toBe(1); expect(mv([[1, 2], [3, 4]], [2, -1])).toEqual([0, 2]);
  });
  it('reports singular/ill-conditioned modal solves and unbounded numerical work', () => {
    expect(() => solveComplex([[complex(1), complex(2)], [complex(2), complex(4)]], [complex(3), complex(6)])).toThrow(/singular/);
    expect(() => solveComplex([[complex(1), complex(1)], [complex(1), complex(1 + 1e-12)]], [complex(2), complex(2 + 1e-12)])).toThrow(/condition/);
    expect(() => transition([[1e10]], 200)).toThrow(/scaling work/); expect(() => transition([[100]], 1)).toThrow(/bound/);
    expect(() => transition([[NaN]], 1)).toThrow(/finite/); expect(() => transition([[0, 1]], 1)).toThrow(/square/);
    expect(() => transition([], 1)).toThrow(/square/);
  });
});

describe('CD05 complete unit-step response and measured metrics', () => {
  it('matches the independent damped-sinusoid baseline over every displayed sample', () => {
    const c = constantLead(4), r = stepResponse(p, c, 10);
    expect(r.states).toBe(2); expect(r.points).toHaveLength(401); expect(r.points[0]).toEqual({ t: 0, y: 0, error: 1, u: 4 });
    for (const row of r.points) {
      const expected = Math.exp(-row.t) * (Math.cos(Math.sqrt(3) * row.t) + Math.sin(Math.sqrt(3) * row.t) / Math.sqrt(3));
      close(row.error, expected); close(row.y, 1 - expected); close(row.u, 4 * expected);
    }
    expect(r.metrics.overshoot).toBeCloseTo(100 * Math.exp(-Math.PI / Math.sqrt(3)), 3);
    expect(Math.abs(r.metrics.peakTime - Math.PI / Math.sqrt(3))).toBeLessThanOrEqual(r.dt);
    expect(r.metrics.settling).toBeGreaterThan(4.03); expect(r.metrics.settling).toBeLessThan(4.05);
    close(r.tail!.bound, 2 / Math.sqrt(3) * Math.exp(-10) + 1e-8);
    expect(r.refinementResidual).toBeLessThan(1e-10); expect(r.peakRefinementDelta).toBeLessThanOrEqual(1e-4);
  });
  it('keeps the full controller zero and extra pole in the response', () => {
    const c = { K: 16 / 3, T: 3 / 8, alpha: 4 / 9 }, r = stepResponse(p, c, 6);
    expect(r.states).toBe(3); expect(r.poles.values.reduce((s, p) => s + p.multiplicity, 0)).toBe(3);
    for (const row of r.points) {
      const e = -.5 * Math.exp(-4 * row.t) + 1.5 * Math.exp(-2 * row.t) * Math.cos(2 * row.t) + .5 * Math.exp(-2 * row.t) * Math.sin(2 * row.t);
      close(row.error, e); close(row.y, 1 - e);
    }
    const at = r.points.find(row => row.t === .99)!;
    const dominantOnly = 1 - Math.exp(-2 * at.t) * (Math.cos(2 * at.t) + Math.sin(2 * at.t));
    expect(Math.abs(at.y - dominantOnly)).toBeGreaterThan(.09);
  });
  it('retains a cancelled characteristic mode with zero output residue', () => {
    const r = stepResponse(p, { K: 4, T: .5, alpha: .5 }, 8);
    expect(r.states).toBe(3);
    for (const row of r.points) close(row.error, Math.exp(-2 * row.t) * (Math.cos(2 * row.t) + Math.sin(2 * row.t)));
    const real = r.tail!.terms.find(term => term.pole.im === 0)!;
    expect(Math.hypot(real.coefficient.re, real.coefficient.im)).toBeLessThan(1e-12);
  });
  it('handles critical quadratic and full triple multiplicity with the exact polynomial-exponential response', () => {
    const cases = [
      { plant: p, lead: constantLead(1), states: 2 },
      { plant: { k: 1, a: 1 }, lead: { K: .5, T: 1, alpha: .5 }, states: 3 },
    ];
    for (const { plant, lead, states } of cases) {
      const r = stepResponse(plant, lead, 10); expect(r.states).toBe(states); expect(r.tail).toBeDefined();
      for (const row of r.points) close(row.error, (1 + row.t) * Math.exp(-row.t));
      close(r.tail!.bound, 11 * Math.exp(-10) + 1e-8);
      expect(r.metrics.overshoot).toBe(0); expect(r.metrics.settling).toBeGreaterThan(5.8); expect(r.metrics.settling).toBeLessThan(5.9);
    }
  });
  it('reports an insufficient horizon rather than inventing rise or settling results', () => {
    const r = stepResponse(p, constantLead(4), .1);
    expect(r.metrics.rise90).toBeUndefined(); expect(r.metrics.rise).toBeUndefined(); expect(r.metrics.settling).toBeUndefined();
    expect(r.tailMessage).toContain('does not confirm settling'); expect(r.tail!.bound).toBeGreaterThan(.02);
  });
  it('bounds every mode resolution, horizon and state convention', () => {
    expect(() => stepResponse(p, { K: 4, T: .01, alpha: .02 }, 10)).toThrow(/40000/);
    for (const horizon of [0, .01, 201, NaN]) expect(() => stepResponse(p, constantLead(4), horizon)).toThrow(/horizon/);
    const noLead = physicalModel(p, constantLead(4)), full = physicalModel(p, { K: 4, T: .5, alpha: .5 });
    expect(noLead.initial).toEqual([-1, 0]); expect(full.initial).toEqual([-1, 0, 0]);
    expect(full.acceleration).toBe(8); expect(full.A[2]).toEqual([-4, 0, -4]);
  });
});
