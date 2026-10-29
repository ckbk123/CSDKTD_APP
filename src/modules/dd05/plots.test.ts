import { describe, expect, it } from 'vitest';
import { createModel, design, simulate } from './math';
import { physicalAt, type Trace } from './plots';
describe('DD05 physical held-plant reconstruction', () => {
  it('matches an independent half-hold flow and every stored terminal endpoint', () => {
    const model = design({ plant: { gain: 1, tau: 1 }, sensor: .5, T: Math.log(2), structure: 'pi', reference: 1, preweight: 'raw' }, { mode: 'discrete', re: .2, im: .3 }, 0, 'comparator', true).model;
    const trace: Trace = { label: 'Fixture', matched: true, model, result: simulate(model, 20) };
    expect(physicalAt(trace, Math.log(2) / 2)).toBeCloseTo(4.4 * (1 - 1 / Math.sqrt(2)), 12);
    trace.result.samples.forEach(s => expect(physicalAt(trace, s.time)).toBeCloseTo(s.output, 11));
    expect(() => physicalAt(trace, -1)).toThrow(); expect(() => physicalAt(trace, Infinity)).toThrow();
  });
  it('keeps long zero-input decay instead of subtracting two nearly equal numbers', () => {
    // Kp=1/(1-exp(-30)) gives y[1]=1,e[1]=0,u[1]=0 from zero state.
    // During that actual second hold, y=exp(-elapsed/tau).
    const model = createModel({ plant: { gain: 1, tau: 1 / 3 }, sensor: 1, T: 10, structure: 'pi', reference: 1, preweight: 'raw' }, { kp: 1 / (1 - Math.exp(-30)), ki: 0, kd: 0 });
    const trace: Trace = { label: 'Zero-input hold', matched: false, model, result: simulate(model, 10) };
    expect(trace.result.samples[1].output).toBe(1); expect(trace.result.samples[1].control).toBe(0);
    expect(physicalAt(trace, 10 + 25 / 3)).toBeCloseTo(Math.exp(-25), 23);
  });
});
