import { describe, expect, it } from 'vitest';
import { prepare } from './calculation';
import { parsePlant } from './math';
describe('CP03 unchanged analytic solver and bounded drawing policy', () => {
  it('retains independent baseline particular/transient values and tail qualification', () => {
    const p = parsePlant('1/((s+1)(s+2))'), early = prepare(p, 1, 1, 0), late = prepare(p, 1, 1, 8);
    expect(early.samples).toHaveLength(901); expect(early.samples[0].particular).toBeCloseTo(-.3, 14); expect(early.actual![0].output).toBeCloseTo(0, 14);
    expect(early.bound).toBeCloseTo(.7, 14); expect(early.settled).toBe(false); expect(late.settled).toBe(true);
    expect(early.e.value.magnitude).toBeCloseTo(1 / Math.sqrt(10), 14); expect(early.e.value.phase).toBeCloseTo(-Math.atan(3), 14);
  });
  it('doubles both signal amplitudes while retaining the gain/phase and sample times', () => {
    const p = parsePlant('1/((s+1)(s+2))'), a = prepare(p, 1, 1, 8), b = prepare(p, 1, 2, 8);
    expect(a.e.value).toEqual(b.e.value); expect(b.responseAmplitude).toBe(2 * a.responseAmplitude);
    for (const i of [0, 123, 450, 900]) { expect(a.samples[i].t).toBe(b.samples[i].t); expect(b.samples[i].input).toBe(2 * a.samples[i].input); expect(b.samples[i].particular).toBe(2 * a.samples[i].particular); }
  });
  it('keeps formal frequency values while omitting unreliable actual traces', () => {
    const fast = prepare(parsePlant('s^2/(s^2+.01s+100)'), .01, 1, 0); expect(fast.actual).toBeUndefined(); expect(fast.actualError).toContain('12001'); expect(fast.samples).toHaveLength(901);
    const unstable = prepare(parsePlant('1/(s-2)'), 1, 1, 8); expect(unstable.actual).toBeUndefined(); expect(unstable.e.stable).toBe(false); expect(unstable.actualError).toContain('numeric reliability bound'); expect(unstable.e.value.magnitude).toBeCloseTo(1 / Math.sqrt(5), 14);
  });
});
