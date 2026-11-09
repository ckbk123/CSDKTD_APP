import { describe, expect, it, vi } from 'vitest';
import * as math from './math';
import { baseline, createSession, family, inspect } from './session';
describe('CR03 coordinate exploration, independent fixtures', () => {
  it('maps a varying original state to a constant new coordinate without changing output', () => {
    const checked = createSession().evaluate({ ...baseline(), T: family(2, 0, 1, 2, 1), initial: [1, -1] });
    expect(checked.transformed.model).toEqual({ A: [[-1, 0], [-.5, -2]], B: [1, .5], C: [.5, -1], D: 0 });
    expect(checked.transformed.initial).toEqual([1, -.5]);
    for (const point of checked.changed) {
      expect(point.state[0]).toBeCloseTo(1, 9); expect(point.state[1]).toBeCloseTo(-.5 * Math.exp(-2 * point.t), 9);
      expect(point.output).toBeCloseTo(.5 + .5 * Math.exp(-2 * point.t), 9);
    }
  });
  it('embeds each ordered pair in the full coupled four-state model', () => {
    const model = { A: [[-1, 1, 0, 0], [0, -1, 1, 0], [0, 0, -1, 1], [0, 0, 0, -1]], B: [0, 0, 0, 0], C: [1, 2, 3, 4], D: .25 };
    for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) if (i !== j) for (const s of [.5, 1.23456789, 2]) for (const h of [-2, .123456789, 2]) {
      const checked = createSession().evaluate({ model, T: family(4, i, j, s, h), initial: [0, 0, 0, 1], command: 0, horizon: 1, count: 3 });
      const t = .5, x = [t ** 3 / 6, t * t / 2, t, 1].map(v => v * Math.exp(-t));
      const z = [...x]; z[i] = s * x[i] + h * x[j]; z[j] = x[j] / s;
      z.forEach((value, k) => expect(checked.changed[1].state[k]).toBeCloseTo(value, 9));
      expect(checked.transformed.condition).toBeLessThanOrEqual(16);
    }
  });
  it('supports scalar and static models without inventing a second state', () => {
    const session = createSession();
    const scalar = session.evaluate({ model: { A: [[-2]], B: [1], C: [3], D: .5 }, T: family(1, 0, 0, 1.7, 0), initial: [1], command: 2, horizon: 1, count: 2 });
    expect(scalar.changed[1].state[0]).toBeCloseTo(1.7); expect(scalar.changed[1].output).toBeCloseTo(4);
    const fixed = session.evaluate({ model: { A: [], B: [], C: [], D: 3 }, T: [], initial: [], command: 2, horizon: 1, count: 2 });
    expect(inspect(fixed, 1).changed).toEqual({ t: 1, state: [], output: 6 });
  });
  it('uses cached original samples but independently evaluates every changed T', () => {
    const spy = vi.spyOn(math, 'samples'), session = createSession(), first = session.evaluate(baseline());
    expect(spy).toHaveBeenCalledTimes(2); expect(session.evaluate(baseline())).toBe(first); inspect(first, 100); expect(spy).toHaveBeenCalledTimes(2);
    const changed = session.evaluate({ ...baseline(), T: family(2, 0, 1, 1.3, .7) });
    expect(changed.original).toBe(first.original); expect(spy).toHaveBeenCalledTimes(3); expect(changed.changed).not.toBe(first.changed); spy.mockRestore();
  });
  it('retains the full original singularity, coefficient, tiny gain and conditioning screens', () => {
    const session = createSession();
    expect(() => session.evaluate({ ...baseline(), T: [[1, 1], [1, 1]] })).toThrow(/singular/);
    expect(() => session.evaluate({ ...baseline(), T: [[1, 0], [0, 1e-10]] })).toThrow(/condition/);
    expect(() => session.evaluate({ ...baseline(), model: { A: [[0, 1], [-1, 8.125]], B: [0, 1], C: [1, 0], D: 0 }, initial: [1.1, .1375], command: 0 })).toThrow(/condition/);
    expect(() => family(2, 0, 0, 1, 0)).toThrow(/distinct/); expect(() => family(2, 0, 1, .49, 0)).toThrow(/scale/);
    expect(() => inspect(session.evaluate(baseline()), 1.5)).toThrow(/integer/);
  });
});
