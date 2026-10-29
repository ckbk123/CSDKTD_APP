import { describe, expect, it } from 'vitest';
import { simulate } from './math';

const plant = { gain: 1, tau: 1 }, task = { reference: 1, initial: 0, horizon: .9 };
const spec = { policy: 'fixed' as const, period: .3, fixedGain: 0, rate: 1 };

describe('DF04 terminal tick rounding and genuine partial holds', () => {
  // With K=0 and y(0)=0, y(t)=0 and e(t)=1 exactly: raw=count,
  // ISE=IAE=H, and held effort=0 independently of the simulator.
  it('does not count a decimal terminal tick as a phantom fourth hold', () => {
    const run = simulate(plant, task, spec);
    expect(run.holds).toHaveLength(3); expect(run.indices.raw).toBe(3);
    expect(run.indices.ise).toBeCloseTo(.9, 15); expect(spec.period * run.indices.raw).toBeCloseTo(run.indices.ise, 15);
    expect(run.holds.at(-1)!.end).toBe(.9); expect(run.terminal).toBe(0);
  });
  it('accepts exactly 2000 decimal periods instead of inventing interval 2001', () => {
    const run = simulate(plant, {...task, horizon: 2.044}, {...spec, period: .001022});
    expect(run.holds).toHaveLength(2000); expect(run.indices.raw).toBe(2000);
    expect(run.indices.ise).toBeCloseTo(2.044, 14); expect(run.indices.iae).toBeCloseTo(2.044, 14);
    expect(run.holds.at(-1)!.end).toBe(2.044); expect(run.indices.effort).toBe(0);
  });
  it.each([.91, .900000000001, .899999999999])('retains a real nonterminal remainder at H=%s', horizon => {
    const run = simulate(plant, {...task, horizon}, spec), count = horizon > .9 ? 4 : 3;
    expect(run.holds).toHaveLength(count); expect(run.indices.raw).toBe(count); expect(run.indices.ise).toBeCloseTo(horizon, 15);
    expect(run.holds.at(-1)!.end).toBe(horizon); expect(run.holds.at(-1)!.weight).toBeGreaterThan(0);
    if (horizon > .9) expect(run.holds.at(-1)!.weight).toBeCloseTo(horizon - .9, 15);
  });
  it('still enforces the limit when a genuine partial 2001st hold is requested', () => {
    expect(() => simulate(plant, {...task, horizon: 2.044000000001}, {...spec, period: .001022})).toThrow(/2000/);
  });
});
