import { describe, expect, it } from 'vitest';
import { classifyPole, heldFlow, modelAt, physicalOutputAt, simulate, validatePlant, validateTask } from './math';

const plant = { gain: 1, tau: 1 }, task = { reference: 1, initial: 0, horizon: 5 };
const fixed = { policy: 'fixed' as const, period: 0.1, fixedGain: 2, rate: 3 };
describe('DF04 independent physical/weighted comparison fixtures', () => {
  it('derives the complete baseline pole and exact held coefficients', () => {
    const model = modelAt(plant, task, fixed);
    expect(model.a).toBeCloseTo(Math.exp(-0.1), 14); expect(model.b).toBeCloseTo(1 - Math.exp(-0.1), 14);
    expect(model.pole).toBeCloseTo(3 * Math.exp(-0.1) - 2, 14); expect(model.steadyOutput).toBeCloseTo(2 / 3, 14);
    expect(modelAt(plant, task, { ...fixed, period: 0.5 }).pole).toBeLessThan(0);
    expect(modelAt(plant, task, { ...fixed, period: 0.5 }).stability).toBe('inside');
    expect(modelAt(plant, task, { ...fixed, period: Math.log(3) }).stability).toBe('boundary');
    expect(modelAt(plant, task, { ...fixed, period: 1.2 }).stability).toBe('outside');
    expect(modelAt(plant, task, { ...fixed, period: 1.2 }).steadyOutput).toBeNull();
  });
  it('checks alternating samples, each weighted index and no terminal double count', () => {
    const T = Math.LN2, run = simulate(plant, { ...task, horizon: 3 * T }, { ...fixed, period: T });
    expect(run.holds).toHaveLength(3);
    run.holds.map(h => h.output).forEach((y, k) => expect(y).toBeCloseTo([0, 1, 0.5][k], 14));
    run.holds.map(h => h.control).forEach((u, k) => expect(u).toBeCloseTo([2, 0, 1][k], 14));
    expect(run.terminal).toBeCloseTo(0.75, 14); expect(run.indices.raw).toBeCloseTo(1.25, 14);
    expect(run.indices.ise).toBeCloseTo(1.25 * T, 14); expect(run.indices.iae).toBeCloseTo(1.5 * T, 14);
    expect(run.indices.itae).toBeCloseTo(T * T, 14); expect(run.indices.effort).toBeCloseTo(5 * T, 14);
  });
  it('keeps a partial last hold and reconstructs its physical terminal value', () => {
    const T = Math.LN2, run = simulate(plant, { ...task, horizon: 2.5 * T }, { ...fixed, period: T });
    expect(run.holds).toHaveLength(3); expect(run.holds[2].weight).toBeCloseTo(0.5 * T, 14);
    expect(run.holds[2].end).toBe(2.5 * T); expect(run.terminal).toBeCloseTo(1 - 0.5 / Math.sqrt(2), 14);
    expect(run.indices.ise).toBeCloseTo(1.125 * T, 14); expect(run.indices.effort).toBeCloseTo(4.5 * T, 14);
    expect(physicalOutputAt(run, 0.5 * T)).toBeCloseTo(2 * (1 - 1 / Math.sqrt(2)), 14);
    expect(physicalOutputAt(run, run.task.horizon)).toBe(run.terminal);
    expect(physicalOutputAt(run, T)).toBeCloseTo(1, 14);
  });
  it('redesigns gain to a physical rate and exposes the different tracking bias', () => {
    const T = Math.LN2, run = simulate(plant, { ...task, horizon: 3 * T }, { ...fixed, period: T, policy: 'redesign', rate: 2 });
    expect(run.model.gain).toBeCloseTo(0.5, 14); expect(run.model.targetPole).toBeCloseTo(0.25, 14);
    expect(run.model.pole).toBeCloseTo(0.25, 14); expect(run.model.steadyOutput).toBeCloseTo(1 / 3, 14);
    run.holds.map(h => h.output).forEach((y, k) => expect(y).toBeCloseTo([0, 0.25, 0.3125][k], 14));
    expect(run.terminal).toBeCloseTo(0.328125, 14);
    expect(run.indices.ise).toBeCloseTo(2.03515625 * T, 14); expect(run.indices.effort).toBeCloseTo(0.5087890625 * T, 14);
    const zeroGain = modelAt(plant, task, { ...fixed, policy: 'redesign', rate: 1 });
    expect(zeroGain.gain).toBe(0); expect(zeroGain.pole).toBe(zeroGain.a);
  });
  it('does not confuse a raw sample sum with a common-horizon error integral', () => {
    [0.1, 0.2, 0.3].forEach((period, index) => {
      const run = simulate(plant, { ...task, horizon: 1 }, { ...fixed, period, fixedGain: 0 });
      expect(run.indices.raw).toBe([10, 5, 4][index]); expect(run.indices.ise).toBeCloseTo(1, 14);
      expect(run.indices.iae).toBeCloseTo(1, 14); expect(run.indices.effort).toBe(0); expect(run.terminal).toBe(0);
    });
  });
  it('changes plant units consistently while preserving the independently known pole', () => {
    const T = 0.5 * Math.LN2, run = simulate({ gain: 2, tau: 0.5 }, { ...task, horizon: 3 * T }, { ...fixed, period: T, fixedGain: 1 });
    expect(run.model.pole).toBeCloseTo(-0.5, 14); expect(run.terminal).toBeCloseTo(0.75, 14);
    expect(run.holds[0].control).toBe(1); expect(run.holds[2].control).toBeCloseTo(0.5, 14);
    expect(run.indices.effort).toBeCloseTo(1.25 * T, 14);
  });
  it('agrees with the independent closed form for changed reference and initial output', () => {
    const changed = { reference: 2, initial: 0.5, horizon: 1 }, run = simulate(plant, changed, { ...fixed, period: 0.2 });
    const q = 3 * Math.exp(-0.2) - 2, equilibrium = 4 / 3;
    run.holds.forEach((hold, k) => expect(hold.output).toBeCloseTo(equilibrium + (0.5 - equilibrium) * q ** k, 13));
    expect(run.terminal).toBeCloseTo(equilibrium + (0.5 - equilibrium) * q ** 5, 13);
  });
  it('allows a horizon shorter than one period without applying a second update', () => {
    const run = simulate(plant, { ...task, horizon: 0.05 }, fixed);
    expect(run.holds).toHaveLength(1); expect(run.indices.ise).toBe(0.05);
    expect(run.indices.effort).toBe(0.2); expect(run.terminal).toBeCloseTo(2 * (1 - Math.exp(-0.05)), 14);
  });
  it('retains zero-order held control while continuous output moves between ticks', () => {
    expect(heldFlow(plant, 0.5, 1, Math.LN2)).toBeCloseTo(0.75, 14);
    const run = simulate(plant, task, fixed);
    expect(physicalOutputAt(run, 0.05)).toBeCloseTo(2 * (1 - Math.exp(-0.05)), 14);
    expect(run.holds[0].control).toBe(2); expect(run.holds[0].contribution.effort).toBe(0.4);
  });
  it('retains the small physical tail over a long zero-control hold', () => {
    expect(heldFlow(plant, 1, 0, 30) / Math.exp(-30)).toBeCloseTo(1, 12);
    const run = simulate({ gain: 1, tau: 0.01 }, { ...task, initial: 1, horizon: 0.3 }, { ...fixed, period: 0.3, fixedGain: 0 });
    expect(run.terminal / Math.exp(-30)).toBeCloseTo(1, 12);
    const repeated = simulate({ gain: 1, tau: 0.01 }, { ...task, initial: 1, horizon: 1.5 }, { ...fixed, period: 0.3, fixedGain: 0 });
    expect(repeated.holds).toHaveLength(5); expect(repeated.terminal / Math.exp(-150)).toBeCloseTo(1, 12);
    const longHorizon = simulate({ gain: 1, tau: 0.01 }, { ...task, initial: 1, horizon: 60 }, { ...fixed, period: 0.3, fixedGain: 0 });
    expect(longHorizon.holds).toHaveLength(200); expect(longHorizon.holds.every(hold => hold.weight <= 0.3)).toBe(true);
  });
  it('rejects invalid data, impossible redesign, numerical conditioning and work limits', () => {
    for (const bad of [{ gain: 0, tau: 1 }, { gain: 1, tau: NaN }, { gain: 21, tau: 1 }]) expect(() => validatePlant(bad)).toThrow();
    for (const bad of [{ ...task, reference: 0 }, { ...task, horizon: 0 }, { ...task, initial: Infinity }]) expect(() => validateTask(bad)).toThrow();
    expect(() => modelAt(plant, task, { ...fixed, period: 0 })).toThrow();
    expect(() => modelAt({ gain: 1, tau: 0.01 }, task, { ...fixed, period: 1 })).toThrow(/T\/tau/);
    expect(() => modelAt(plant, task, { ...fixed, policy: 'redesign', rate: 0.5 })).toThrow(/lambda at least/);
    expect(() => modelAt(plant, task, { ...fixed, policy: 'redesign', rate: 100, period: 1 })).toThrow(/lambda\*T/);
    expect(() => modelAt(plant, task, { ...fixed, policy: 'redesign', rate: 100, period: 0.3 })).toThrow(/matching tolerance/);
    expect(() => simulate(plant, { ...task, horizon: 3 }, { ...fixed, period: 0.001 })).toThrow(/2000/);
    expect(() => simulate(plant, { ...task, horizon: 60 }, { ...fixed, fixedGain: 100, period: 1 })).toThrow(/no partial metrics/);
    expect(() => classifyPole(NaN)).toThrow(); expect(classifyPole(-1)).toBe('boundary');
    expect(() => heldFlow(plant, 1, 1, -1)).toThrow();
    const run = simulate(plant, task, fixed); expect(() => physicalOutputAt(run, 6)).toThrow();
  });
});
