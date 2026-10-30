import { describe, expect, it } from 'vitest';
import { measure, metrics, openResponse, simulate, tune, validateController, validatePlant, type Controller, type Kind } from './math';

const base = { gain: 1, tau: 2, delay: .5 };
const close = (actual: number, expected: number, tolerance = 2e-6) => expect(Math.abs(actual - expected)).toBeLessThan(tolerance);

describe('reaction curve and named rules', () => {
  it('has exact dead time, exponential value and tangent intercepts', () => {
    expect(openResponse(base, .5)).toBe(0); close(openResponse(base, 2.5), 1 - Math.exp(-1));
    expect(measure(base, .5, 2.5)).toEqual({ delay: .5, tau: 2, slope: .5 });
  });
  it.each<[Kind, Controller]>([['P', { kp: 4, ti: null, td: 0 }], ['PI', { kp: 3.6, ti: 5 / 3, td: 0 }], ['PID', { kp: 4.8, ti: 1, td: .25 }]])('derives baseline %s, distinguishing integral time and gain', (kind, answer) => {
    const c = tune(base, measure(base, .5, 2.5), kind); close(c.kp, answer.kp); expect(c.ti).toEqual(answer.ti); expect(c.td).toEqual(answer.td);
    if (kind === 'PI') close(c.kp / c.ti!, 2.16);
  });
  it('recomputes from changed gain and marker estimates', () => {
    const p = { gain: 2, tau: 3, delay: 1 };
    expect(tune(p, measure(p, 1, 4), 'PID')).toEqual({ kp: 1.7999999999999998, ti: 2, td: .5 });
    close(tune(p, measure(p, .75, 4.5), 'PI').kp, 2.25);
    close(tune(p, measure(p, .75, 4.5), 'PI').ti!, 2.5);
  });
  it.each([{ gain: 0, tau: 2, delay: .5 }, { gain: NaN, tau: 2, delay: .5 }, { gain: 1, tau: Infinity, delay: .5 }, { gain: 1, tau: .1, delay: .1 }, { gain: 1, tau: 2, delay: 0 }, { gain: 1, tau: 2, delay: .05 }, { gain: 1, tau: 2, delay: 3 }])('rejects unsupported plant %j', p => expect(() => validatePlant(p)).toThrow());
  it.each([[.5, .5], [.5, .4], [0, 2], [11, 15], [.5, Infinity], [.02, 20]])('rejects unsupported markers %s, %s', (a, b) => expect(() => measure(base, a, b)).toThrow());
  it('accepts ratio boundaries and bounds', () => {
    expect(validatePlant({ gain: .05, tau: .4, delay: .02 })).toBeTruthy(); expect(validatePlant({ gain: 20, tau: 10, delay: 10 })).toBeTruthy();
  });
});

describe('delay retained in numerical feedback', () => {
  it.each<Kind>(['P', 'PI', 'PID'])('matches an independent first-interval convolution for %s', kind => {
    const c = tune(base, measure(base, .5, 2.5), kind), { trace, discrepancy } = simulate(base, c, 1.5);
    expect(discrepancy).toBeLessThan(1e-4);
    trace.time.forEach((t, i) => {
      if (t <= .5) close(trace.y[i], 0, 1e-10);
      if (t > .5 && t <= 1) {
        const a = t - .5, exponential = Math.exp(-a / 2);
        let convolution = 1 - exponential;
        if (c.ti !== null) convolution += (a - 2 * (1 - exponential)) / c.ti;
        if (c.td) { const tf = c.td / 10; convolution += 10 * tf / (tf - 2) * (Math.exp(-a / tf) - exponential); }
        close(trace.y[i], c.kp * convolution, 2e-5);
      }
    });
    close(trace.u[0], c.kp * (kind === 'PID' ? 11 : 1));
  });
  it('agrees with the independently expanded P-loop delay series after multiple returns', () => {
    const { trace } = simulate(base, { kp: 1, ti: null, td: 0 }, 5);
    function exact(t: number): number {
      let result = 0;
      for (let n = 1; n <= Math.floor(t / .5); n++) {
        const x = (t - n * .5) / 2; let term = 1, sum = 1;
        for (let k = 1; k < n; k++) { term *= x / k; sum += term; }
        result += (-1) ** (n - 1) * (1 - Math.exp(-x) * sum);
      }
      return result;
    }
    for (let i = 0; i < trace.time.length; i += 37) close(trace.y[i], exact(trace.time[i]), 3e-6);
    close(trace.time.at(-1)!, 5, 1e-12);
  });
  it('has matching responses when gain normalization preserves K*Kp', () => {
    const a = simulate(base, { kp: 1, ti: 3, td: 0 }, 8), b = simulate({ ...base, gain: 2 }, { kp: .5, ti: 3, td: 0 }, 8);
    a.trace.y.forEach((v, i) => close(v, b.trace.y[i], 1e-12));
    close(a.metrics.iae, b.metrics.iae, 1e-12); close(a.metrics.peakEffort, 2 * b.metrics.peakEffort, 1e-12);
  });
  it('computes baseline and changed-data/manual comparisons without a canned response', () => {
    const c = tune(base, measure(base, .5, 2.5), 'PID');
    const suggested = simulate(base, c, 20), manual = simulate(base, { kp: 2.4, ti: 2, td: .25 }, 20);
    expect(suggested.metrics.overshoot).toBeGreaterThan(20); expect(manual.metrics.overshoot).toBeLessThan(suggested.metrics.overshoot);
    expect(manual.metrics.entry).not.toBeNull(); expect(manual.metrics.peakEffort).toBeLessThan(suggested.metrics.peakEffort);
    const p = { gain: 2, tau: 3, delay: 1 };
    expect(simulate(p, tune(p, measure(p, 1, 4), 'PI'), 20).metrics.iae).not.toEqual(suggested.metrics.iae);
  });
  it('agrees with the independently reproduced exponential-midpoint/output-filter PID fixture', () => {
    // reference-fixtures.py: h=0.0001 and 0.00005 agree to <1.4e-6 in IAE
    // and <8.3e-7 in these output samples. Different integration and filter states.
    const r = simulate(base, { kp: 4.8, ti: 1, td: .25 }, 20);
    for (const [t, y] of [[1, 1.8114393296], [2, 1.0736025022], [5, 1.0237883834], [10, .9996962817], [20, 1.0000003065]]) {
      close(r.trace.y[Math.round(t / r.trace.step)], y, 3e-5);
    }
    close(r.metrics.overshoot, 81.72486153, .003); close(r.metrics.iae, 1.175697431, .00005);
    close(r.metrics.entry!, 5.1357, .001); close(r.metrics.peakEffort, 52.8, 1e-10);
  });
  it('reports an insufficient horizon without claiming settling', () => expect(simulate(base, { kp: 1, ti: 10, td: 0 }, 1).metrics.entry).toBeNull());
  it.each([-1, NaN, Infinity, 0, 201])('rejects horizon %s', h => expect(() => simulate(base, { kp: 1, ti: null, td: 0 }, h)).toThrow());
  it.each([{ kp: 0, ti: 1, td: 0 }, { kp: 501, ti: null, td: 0 }, { kp: 1, ti: 0, td: 0 }, { kp: 1, ti: NaN, td: 0 }, { kp: 1, ti: 1, td: -1 }, { kp: 1, ti: null, td: 1 }])('rejects controller %j', c => expect(() => validateController(c)).toThrow());
  it('rejects unresolved work and divergent responses', () => {
    expect(() => simulate(base, { kp: 1, ti: 1, td: .00001 }, 20)).toThrow(/100,000/);
    expect(() => simulate(base, { kp: 500, ti: null, td: 0 }, 20)).toThrow(/grows|refinement/);
  });
  it('integrates metrics independently and qualifies the observation tail', () => {
    const trace = { time: [0, 1, 2, 3, 4], y: [0, 1.2, 1.01, 1, 1], u: [3, -2, 1, 0, 0], step: 1 };
    const m = metrics(trace, base); close(m.overshoot, 20); close(m.iae, .71); expect(m.entry).toBe(2); expect(m.peakEffort).toBe(3); expect(m.endError).toBe(0);
    expect(metrics({ ...trace, time: [0, 1, 2, 3] , y: trace.y.slice(0, 4), u: trace.u.slice(0, 4) }, base).entry).toBeNull();
  });
});
