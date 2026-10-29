import { describe, expect, it } from 'vitest';
import { buildResponse, futureEnvelope, normalizedAt } from './response';
const near = (actual: number, expected: number, tolerance = 1e-10) => expect(Math.abs(actual - expected)).toBeLessThan(tolerance * (1 + Math.abs(expected)));
describe('CF01 full closed-loop modal response', () => {
  it('matches the independently derived damped-sinusoid baseline, slope and poles', () => {
    const r = buildResponse({ g: 4, a1: 2, a0: 4 });
    near(r.damping, .5); near(r.naturalFrequency, 2); near(r.finalValue, 1);
    near(r.poles[0].re, -1); near(Math.abs(r.poles[0].im), Math.sqrt(3));
    for (const t of [0, .01, .2, 1, 2, 4.039, 10]) {
      const actual = normalizedAt(r, t), w = Math.sqrt(3);
      near(actual.value, 1 - Math.exp(-t) * (Math.cos(w * t) + Math.sin(w * t) / w));
      near(actual.slope, 4 / w * Math.exp(-t) * Math.sin(w * t));
    }
  });
  it('retains exact critical and triple real poles without dividing by a vanished gap', () => {
    const pair = buildResponse({ g: 1, a1: 2, a0: 1 });
    const triple = buildResponse({ g: 1, a1: 2, a0: 1, pole: 1 });
    expect(triple.poles).toHaveLength(3);
    for (const t of [0, .1, 1, 3, 10]) {
      near(normalizedAt(pair, t).value, 1 - (1 + t) * Math.exp(-t));
      near(normalizedAt(triple, t).value, 1 - (1 + t + t * t / 2) * Math.exp(-t));
      near(normalizedAt(triple, t).slope, t * t / 2 * Math.exp(-t));
    }
  });
  it('matches a changed overdamped transfer and handles an added distinct real pole', () => {
    const changed = buildResponse({ g: 10, a1: 3, a0: 2 }); // final value5; normalized 2/[(s+1)(s+2)]
    near(changed.finalValue, 5);
    const extra = buildResponse({ g: 4, a1: 2, a0: 4, pole: 1 });
    const slow = buildResponse({ g:4,a1:2,a0:4,pole:.2 });
    expect(slow.modes.find(m=>m.pole.im===0)!.coefficient.im).toBe(0);
    const A=-4/(.2*.2-2*.2+4),B=-1-A,C=(.2*A+B)/Math.sqrt(3);
    for (const t of [0, .05, 1, 4, 9]) {
      near(normalizedAt(changed, t).value, (1 - Math.exp(-t)) ** 2);
      near(normalizedAt(slow,t).value,1+A*Math.exp(-.2*t)+Math.exp(-t)*(B*Math.cos(Math.sqrt(3)*t)+C*Math.sin(Math.sqrt(3)*t)));
      near(normalizedAt(extra, t).value, 1 + Math.exp(-t) * (-4 / 3 + Math.cos(Math.sqrt(3) * t) / 3 - Math.sin(Math.sqrt(3) * t) / Math.sqrt(3)));
    }
  });
  it('preserves LHP cancellation and RHP inverse-response zeros with unchanged target pair', () => {
    const cancelled = buildResponse({ g: 1, a1: 2, a0: 1, pole: 1, zero: 1 });
    const inverse = buildResponse({ g: 1, a1: 2, a0: 1, pole: 1, zero: -1 });
    expect(cancelled.poles).toHaveLength(3);
    for (const t of [0, .1, .5, 2, 8]) {
      near(normalizedAt(cancelled, t).value, 1 - (1 + t) * Math.exp(-t));
      near(normalizedAt(inverse, t).value, 1 - (1 + t + t * t) * Math.exp(-t));
    }
    expect(normalizedAt(inverse, .5).value).toBeLessThan(0);
  });
  it('bounds the future rather than just the endpoint, including growing repeated factors', () => {
    const r = buildResponse({ g: 1, a1: 2, a0: 1, pole: 1 });
    for (const horizon of [0, .25, 1, 2, 5, 10]) {
      const bound = futureEnvelope(r, horizon);
      for (const dt of [0, .1, .5, 1, 3, 7, 20]) expect(Math.abs(normalizedAt(r, horizon + dt).value - 1)).toBeLessThanOrEqual(bound);
    }
    expect(futureEnvelope(r, 1)).toBeGreaterThan(.02);
    expect(futureEnvelope(r, 10)).toBeLessThan(.02);
    const slow = buildResponse({ g: 4, a1: 2, a0: 4, pole: .02 });
    expect(futureEnvelope(slow, 10)).toBeGreaterThan(.02);
  });
  it('rejects invalid, excessive and unresolved near-coincident models explicitly', () => {
    for (const bad of [NaN, 0, -1, 1001]) expect(() => buildResponse({ g: bad, a1: 2, a0: 4 })).toThrow(/positive/);
    expect(() => buildResponse({ g: 1, a1: -2, a0: 4 })).toThrow(/stable/);
    expect(() => buildResponse({ g: 1, a1: 2, a0: 0 })).toThrow(/stable/);
    expect(() => buildResponse({ g: 1, a1: 100, a0: 4 })).toThrow(/damping/);
    expect(() => buildResponse({ g: 1, a1: 2, a0: 4, pole: 0 })).toThrow(/added stable pole/);
    expect(() => buildResponse({ g: 1, a1: 2, a0: 4, zero: 0 })).toThrow(/added zero/);
    expect(() => buildResponse({ g: 1, a1: 3, a0: 2, pole: 1.0000001 })).toThrow(/too close/);
    expect(() => normalizedAt(buildResponse({ g: 1, a1: 2, a0: 1 }), Infinity)).toThrow(/time/);
  });
});
